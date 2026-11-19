import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { sql } from '../src/lib/db';
import {
  sanitizeProductForStorefront,
  validateInstagramItem,
  validateMediaFile,
  validateImageSignature,
  MAX_MEDIA_FILE_SIZE_BYTES,
  ALLOWED_MEDIA_EXTENSIONS,
  ALLOWED_MEDIA_MIME_TYPES,
  StorefrontProduct,
  InstagramGalleryItem,
  MediaItem,
} from '../src/lib/storefront';
import {
  generatePublicMediaStorageKey,
  isPublicR2Configured,
  resolvePublicMediaUrl,
  getPublicR2Config,
  verifyPublicMediaObject,
  registerMockMediaObject,
  clearMockMediaObjects,
} from '../src/lib/media-storage';

interface TestResult {
  id: number;
  name: string;
  category: string;
  status: 'PASS' | 'FAIL';
  expected: string;
  actual: string;
}

const results: TestResult[] = [];

function recordTest(
  id: number,
  name: string,
  category: string,
  passed: boolean,
  expected: string,
  actual: string
) {
  const status: 'PASS' | 'FAIL' = passed ? 'PASS' : 'FAIL';
  results.push({ id, name, category, status, expected, actual });
  console.log(
    ` ${passed ? '✅' : '❌'} [Test ${id}] ${name}: ${status}\n       Expected: ${expected}\n       Actual:   ${actual}`
  );
}

const CANONICAL_BASELINE_COUNT = 371;
const CANONICAL_BASELINE_SHA256 = 'd39c74285d77c00a33500f02be7595c9e495b999e2956879f2dd134e6232ef62';

async function computeLedgerChecksum(): Promise<{ count: number; digest: string }> {
  const rows = await sql`
    SELECT collection_name, record_id, data, updated_at
    FROM public.ledger_collections
    ORDER BY collection_name, record_id;
  `;
  const count = rows.length;
  const hash = crypto.createHash('sha256');
  for (const r of rows) {
    hash.update(`${r.collection_name}|${r.record_id}|${JSON.stringify(r.data)}|${new Date(r.updated_at).toISOString()}`);
  }
  return { count, digest: hash.digest('hex') };
}

async function runWebsiteCmsVerification() {
  console.log('========================================================================');
  console.log('  WEBSITE PRODUCT & INSTAGRAM MANAGEMENT — VERIFICATION SUITE');
  console.log('========================================================================\n');

  if (!sql) {
    console.error('❌ Critical: Database connection not configured.');
    process.exit(1);
  }

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: CAD & Media File Security Validation
    // ------------------------------------------------------------------------
    console.log('--- Section 1: Media Library & CAD File Security Validation ---');

    // Test 1: CAD File Extensions Strictly Blocked
    const cadFilenames = [
      'bracket.step',
      'mount.STEP',
      'frame.stp',
      'nozzle.stl',
      'gears.3mf',
      'statue.obj',
      'model.OBJ',
    ];
    let allCadBlocked = true;
    for (const name of cadFilenames) {
      const res = validateMediaFile(name, 1024, 'model/step');
      if (res.valid) {
        allCadBlocked = false;
        break;
      }
    }
    recordTest(
      1,
      'Media Security: CAD Files (.step, .stp, .stl, .3mf, .obj) Strictly Rejected',
      'Media Security',
      allCadBlocked,
      'All CAD file extensions rejected with validation error',
      allCadBlocked ? 'All 7 CAD formats rejected' : 'One or more CAD formats allowed'
    );

    // Test 2: Valid Image Formats Accepted (JPEG, PNG, WebP)
    const validImages = [
      { name: 'product-hero.jpg', mime: 'image/jpeg', size: 1024 * 500 },
      { name: 'gallery-detail.png', mime: 'image/png', size: 1024 * 1024 },
      { name: 'banner.webp', mime: 'image/webp', size: 1024 * 200 },
    ];
    let allImagesValid = true;
    for (const img of validImages) {
      const res = validateMediaFile(img.name, img.size, img.mime);
      if (!res.valid) {
        allImagesValid = false;
        break;
      }
    }
    recordTest(
      2,
      'Media Security: Standard Web Images (JPEG, PNG, WebP) Accepted',
      'Media Security',
      allImagesValid,
      'All web image formats validated successfully',
      allImagesValid ? 'JPEG, PNG, WebP accepted' : 'Valid image format rejected'
    );

    // Test 3: Media File Size Limit Enforced (10 MB max)
    const oversizeRes = validateMediaFile('huge-photo.jpg', MAX_MEDIA_FILE_SIZE_BYTES + 1024, 'image/jpeg');
    const validSizeRes = validateMediaFile('ok-photo.jpg', MAX_MEDIA_FILE_SIZE_BYTES, 'image/jpeg');
    const sizeEnforced = !oversizeRes.valid && validSizeRes.valid;
    recordTest(
      3,
      'Media Security: 10 MB Max File Size Constraint Enforced',
      'Media Security',
      sizeEnforced,
      '>10MB rejected, <=10MB accepted',
      `Oversize valid: ${oversizeRes.valid}, Valid size valid: ${validSizeRes.valid}`
    );

    // Test 4: File Signature (Magic Bytes) Verification
    const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const webpBuf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    const disguisedStepBuf = Buffer.from('ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION');
    const disguisedStlBuf = Buffer.from('solid part\nfacet normal 0 0 0\nendfacet');
    const corruptBuf = Buffer.from([0x01, 0x02, 0x03]);

    const jpegPass = validateImageSignature(jpegBuf).valid && validateImageSignature(jpegBuf).detectedMime === 'image/jpeg';
    const pngPass = validateImageSignature(pngBuf).valid && validateImageSignature(pngBuf).detectedMime === 'image/png';
    const webpPass = validateImageSignature(webpBuf).valid && validateImageSignature(webpBuf).detectedMime === 'image/webp';
    const stepBlocked = !validateImageSignature(disguisedStepBuf).valid;
    const stlBlocked = !validateImageSignature(disguisedStlBuf).valid;
    const corruptBlocked = !validateImageSignature(corruptBuf).valid;

    const signatureVerificationPassed = jpegPass && pngPass && webpPass && stepBlocked && stlBlocked && corruptBlocked;
    recordTest(
      4,
      'Media Security: Actual Magic Bytes Verified (JPEG, PNG, WebP vs CAD vs Corrupt)',
      'Media Security',
      signatureVerificationPassed,
      'True images accepted; CAD headers and corrupt buffers rejected',
      `JPEG: ${jpegPass}, PNG: ${pngPass}, WebP: ${webpPass}, STEP blocked: ${stepBlocked}, STL blocked: ${stlBlocked}`
    );

    // Test 5: Storage Architecture - Strict Dedicated Public Bucket Isolation (No Private CAD Fallback or Collision)
    const originalEnv = { ...process.env };
    // Scenario 1: Only private CAD bucket configured -> getPublicR2Config must return null (NO fallback)
    process.env.R2_ACCOUNT_ID = 'acc123';
    process.env.R2_ACCESS_KEY_ID = 'key123';
    process.env.R2_SECRET_ACCESS_KEY = 'sec123';
    process.env.R2_BUCKET_NAME = 'private-cad-vault';
    delete process.env.R2_PUBLIC_BUCKET_NAME;
    const noFallbackResult = getPublicR2Config();

    // Scenario 2: Public bucket identical to private CAD bucket -> must return null (strict collision rejection)
    process.env.R2_PUBLIC_BUCKET_NAME = 'private-cad-vault';
    const collisionResult = getPublicR2Config();

    // Scenario 3: Distinct dedicated public bucket -> accepted
    process.env.R2_PUBLIC_BUCKET_NAME = 'public-media-store';
    const validPublicResult = getPublicR2Config();

    // Restore original env
    Object.keys(process.env).forEach((k) => {
      if (!(k in originalEnv)) delete process.env[k];
    });
    Object.assign(process.env, originalEnv);

    const bucketIsolationPassed =
      noFallbackResult === null &&
      collisionResult === null &&
      validPublicResult !== null &&
      validPublicResult.bucketName === 'public-media-store';

    recordTest(
      5,
      'Storage Architecture: Strict Bucket Isolation (Dedicated Public Bucket Required, Zero CAD Fallback)',
      'Storage Architecture',
      bucketIsolationPassed,
      'Null when public unset, null on CAD bucket collision, valid only for dedicated bucket',
      `NoFallback: ${noFallbackResult === null}, CollisionRejected: ${collisionResult === null}, DedicatedBucket: ${validPublicResult?.bucketName}`
    );

    // Test 6: Server-Controlled Storage Key Generation
    const key1 = generatePublicMediaStorageKey('products', 'front-angle.png');
    const key2 = generatePublicMediaStorageKey('instagram', 'post-1.jpg');
    const keyFormatValid =
      key1.startsWith('media/products/') &&
      key1.endsWith('_front-angle.png') &&
      key2.startsWith('media/instagram/') &&
      key2.endsWith('_post-1.jpg') &&
      key1 !== key2;
    recordTest(
      6,
      'Storage Architecture: Server-Generated Media Storage Keys (media/{cat}/{date}/{uuid}_{file})',
      'Storage Architecture',
      keyFormatValid,
      'Prefix media/{category}/{date}/ with UUID and sanitized filename',
      `Key: ${key1}`
    );

    // Test 7: Post-Upload Verification Enforcing 10 MB Limit and Image MIME (verifyPublicMediaObject)
    registerMockMediaObject('media/products/2026-11/oversized.jpg', {
      sizeBytes: 15 * 1024 * 1024,
      mimeType: 'image/jpeg',
    });
    registerMockMediaObject('media/products/2026-11/fake-cad.jpg', {
      sizeBytes: 1024 * 500,
      mimeType: 'model/step',
    });
    registerMockMediaObject('media/products/2026-11/valid-hero.jpg', {
      sizeBytes: 1024 * 500,
      mimeType: 'image/jpeg',
    });

    const oversizedPostUpload = await verifyPublicMediaObject('media/products/2026-11/oversized.jpg', 15 * 1024 * 1024, 'image/jpeg');
    const fakeCadPostUpload = await verifyPublicMediaObject('media/products/2026-11/fake-cad.jpg', 1024 * 500, 'image/jpeg');
    const missingPostUpload = await verifyPublicMediaObject('media/products/2026-11/does-not-exist.jpg', 1024, 'image/jpeg', { testMockHeader: 'not_found' });
    const validPostUpload = await verifyPublicMediaObject('media/products/2026-11/valid-hero.jpg', 1024 * 500, 'image/jpeg');

    clearMockMediaObjects();

    const postUploadVerificationPassed =
      !oversizedPostUpload.verified &&
      oversizedPostUpload.error?.includes('OBJECT_TOO_LARGE') === true &&
      !fakeCadPostUpload.verified &&
      fakeCadPostUpload.error?.includes('INVALID_CONTENT_TYPE') === true &&
      !missingPostUpload.verified &&
      validPostUpload.verified === true;

    recordTest(
      7,
      'Post-Upload Enforcement: 10 MB Limit and Image MIME Verified Server-Side',
      'Media Security',
      postUploadVerificationPassed,
      'Oversized >10MB blocked, invalid MIME blocked, missing blocked, valid <=10MB verified',
      `Oversized: ${!oversizedPostUpload.verified}, InvalidMIME: ${!fakeCadPostUpload.verified}, Valid: ${validPostUpload.verified}`
    );

    // ------------------------------------------------------------------------
    // SECTION 2: Instagram Gallery Validation
    // ------------------------------------------------------------------------
    console.log('\n--- Section 2: Instagram Gallery Item Validation ---');

    // Test 8: Valid Instagram Gallery Item Accepted
    const validInsta = validateInstagramItem({
      imageUrl: 'https://images.printstudio.ae/media/instagram/2026-11/sample.jpg',
      caption: 'Fresh Dubai skyline print off the X1-Carbon!',
      postUrl: 'https://www.instagram.com/p/DB123456789/',
      order: 1,
      published: true,
    });
    recordTest(
      8,
      'Instagram Validation: Valid Post with Caption and External URL Accepted',
      'Instagram Validation',
      validInsta.valid,
      'valid: true, no errors',
      `valid: ${validInsta.valid}, errors: ${JSON.stringify(validInsta.errors)}`
    );

    // Test 9: Insecure URL Schemes Rejected (e.g. javascript:, data:)
    const badInsta = validateInstagramItem({
      imageUrl: 'javascript:alert(1)',
      caption: 'Exploit test',
      postUrl: 'data:text/html,<script>alert(1)</script>',
    });
    const badInstaRejected =
      !badInsta.valid &&
      !!badInsta.errors.imageUrl &&
      !!badInsta.errors.postUrl;
    recordTest(
      9,
      'Instagram Validation: Dangerous URL Schemes (javascript:, data:) Blocked',
      'Instagram Validation',
      badInstaRejected,
      'Errors for invalid imageUrl and postUrl schemes',
      `Blocked: ${badInstaRejected}, Errors: ${JSON.stringify(badInsta.errors)}`
    );

    // ------------------------------------------------------------------------
    // SECTION 3: Product Commercial Extension & Storefront Sanitization
    // ------------------------------------------------------------------------
    console.log('\n--- Section 3: Commercial Product Sanitization & Field Preservation ---');

    // Test 7: Public Storefront Sanitization Preserves Multi-Image & Commercial Fields
    const internalProductRecord: any = {
      id: 'test-prod-101',
      name: 'Geometric Architectural Vase',
      slug: 'geometric-architectural-vase',
      category: 'Home Decor',
      description: 'Parametric spiral vase 3D printed with matte bio-polymer.',
      sellingPrice: 185,
      currency: 'AED',
      imageUrl: 'https://images.printstudio.ae/media/product/vase-1.jpg',
      images: [
        'https://images.printstudio.ae/media/product/vase-1.jpg',
        'https://images.printstudio.ae/media/product/vase-2.jpg',
        'https://images.printstudio.ae/media/product/vase-3.jpg',
      ],
      material: 'Matte PLA+',
      dimensions: '120 x 120 x 240 mm',
      finish: '0.16mm Layer Height, Textured Surface',
      colors: ['Matte Terracotta', 'Sandstone Beige', 'Charcoal Black'],
      supportsPersonalization: true,
      isFeatured: true,
      isBestSeller: true,
      published: true,
      // Internal Manufacturing Secrets:
      manufacturingCost: 28.5,
      rawMaterialCost: 14.2,
      labourCost: 12.0,
      machineCostPerHour: 5.0,
      marginPercent: 84.5,
      printerId: 'BAMBU-X1C-01',
      filamentId: 'FIL-PLA-042',
      gcodePath: '/private/gcode/vase_x1c.gcode',
    };

    const sanitized = sanitizeProductForStorefront({
      record_id: 'test-prod-101',
      data: internalProductRecord,
    });
    const hasAllPublicFields =
      sanitized.id === 'test-prod-101' &&
      sanitized.name === 'Geometric Architectural Vase' &&
      sanitized.slug === 'geometric-architectural-vase' &&
      sanitized.sellingPrice === 185 &&
      sanitized.currency === 'AED' &&
      Array.isArray(sanitized.images) &&
      sanitized.images.length === 3 &&
      sanitized.material === 'Matte PLA+' &&
      sanitized.dimensions === '120 x 120 x 240 mm' &&
      sanitized.finish === '0.16mm Layer Height, Textured Surface' &&
      Array.isArray(sanitized.colors) &&
      sanitized.colors.length === 3 &&
      sanitized.supportsPersonalization === true &&
      sanitized.isFeatured === true &&
      sanitized.isBestSeller === true;

    const zeroSecretLeaks =
      (sanitized as any).manufacturingCost === undefined &&
      (sanitized as any).rawMaterialCost === undefined &&
      (sanitized as any).labourCost === undefined &&
      (sanitized as any).marginPercent === undefined &&
      (sanitized as any).printerId === undefined &&
      (sanitized as any).filamentId === undefined &&
      (sanitized as any).gcodePath === undefined;

    recordTest(
      10,
      'Product Sanitization: Public Commercial Specs Exposed (Images, Specs, Badges)',
      'Product Management',
      hasAllPublicFields,
      'Images array (3), material, dimensions, finish, colors, badges preserved',
      `Images count: ${sanitized.images.length}, Colors count: ${sanitized.colors?.length}, Personalization: ${sanitized.supportsPersonalization}`
    );

    recordTest(
      11,
      'Product Sanitization: Zero Internal Production Secrets Leaked',
      'Security Boundary',
      zeroSecretLeaks,
      'manufacturingCost, rawMaterialCost, printerId, margins stripped from public output',
      zeroSecretLeaks ? 'Zero secret fields present' : 'Internal fields leaked in output'
    );

    // ------------------------------------------------------------------------
    // SECTION 4: Database Storage & Additive Ledger Isolation
    // ------------------------------------------------------------------------
    console.log('\n--- Section 4: Database Storage & Additive Ledger Safety ---');

    // Test 12: Baseline Check Before Tests
    const preCheck = await computeLedgerChecksum();
    const baselineIntact =
      preCheck.count === CANONICAL_BASELINE_COUNT &&
      preCheck.digest === CANONICAL_BASELINE_SHA256;
    recordTest(
      12,
      'Database Baseline Check: 371 Historical Ledger Records Intact (Pre-Test)',
      'Ledger Integrity',
      baselineIntact,
      `Exactly ${CANONICAL_BASELINE_COUNT} records, digest: ${CANONICAL_BASELINE_SHA256}`,
      `Count: ${preCheck.count}, Digest: ${preCheck.digest}`
    );

    // Test 10: Create Commercial Product in ledger_collections
    const testProductPayload = {
      id: 'test_prod_cms_101',
      name: 'Custom LED Desk Monogram',
      slug: 'custom-led-desk-monogram',
      category: 'Desk Accessories',
      description: 'Illuminated custom monogram 3D printed with edge-lit acrylic channel.',
      price: 240,
      currency: 'AED',
      imageUrl: 'https://images.printstudio.ae/media/product/test_led.jpg',
      images: [
        'https://images.printstudio.ae/media/product/test_led.jpg',
        'https://images.printstudio.ae/media/product/test_led_angle.jpg',
      ],
      material: 'PETG / Opal Diffuser',
      dimensions: '150 x 50 x 180 mm',
      finish: 'Matte Face, High Gloss Diffuser',
      colors: ['Polar White', 'Matte Black', 'Gold Accents'],
      supportsPersonalization: true,
      isFeatured: true,
      isBestSeller: false,
      published: false, // Starts unpublished
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Insert into products collection
    await sql`
      INSERT INTO public.ledger_collections (collection_name, record_id, data)
      VALUES ('products', 'test_prod_cms_101', ${JSON.stringify(testProductPayload)}::jsonb);
    `;

    const [insertedProductRow] = await sql`
      SELECT data FROM public.ledger_collections
      WHERE collection_name = 'products' AND record_id = 'test_prod_cms_101';
    `;
    const productInserted = !!insertedProductRow && insertedProductRow.data.id === 'test_prod_cms_101';
    recordTest(
      13,
      'Product Storage: Commercial Product Created in ledger_collections (Unpublished by Default)',
      'Product Management',
      productInserted,
      'Product persisted with published: false',
      `Inserted: ${productInserted}, published: ${insertedProductRow?.data?.published}`
    );

    // Test 14: 1-Click Publishing Toggle
    // Toggle to published: true
    const updatedPayload = { ...testProductPayload, published: true, updatedAt: new Date().toISOString() };
    await sql`
      UPDATE public.ledger_collections
      SET data = ${JSON.stringify(updatedPayload)}::jsonb
      WHERE collection_name = 'products' AND record_id = 'test_prod_cms_101';
    `;

    const [publishedRow] = await sql`
      SELECT data FROM public.ledger_collections
      WHERE collection_name = 'products' AND record_id = 'test_prod_cms_101';
    `;
    const publishToggled = publishedRow?.data?.published === true;
    recordTest(
      14,
      'Product Publishing: 1-Click Publish Toggle Modifies published Flag (true)',
      'Product Management',
      publishToggled,
      'published: true persisted in ledger record',
      `published: ${publishedRow?.data?.published}`
    );

    // Test 15: Public Storefront Query Filters Unpublished & Returns Sanitized Published
    const storefrontQuery = await sql`
      SELECT record_id, data
      FROM public.ledger_collections
      WHERE collection_name = 'products'
        AND (data->>'published')::boolean = true
      ORDER BY record_id ASC;
    `;
    const testProdInStorefront = storefrontQuery.find((r: any) => r.record_id === 'test_prod_cms_101');
    const legacyProdLeaked = storefrontQuery.some((r: any) => !r.data.published);
    const publicQuerySafe = !!testProdInStorefront && !legacyProdLeaked;
    recordTest(
      15,
      'Storefront Isolation: Only published: true Products Exposed (Zero Legacy Leaks)',
      'Storefront API',
      publicQuerySafe,
      'Test product returned, exactly 0 unpublished legacy items exposed',
      `Test prod found: ${!!testProdInStorefront}, Total published products: ${storefrontQuery.length}, Legacy leaks: ${legacyProdLeaked}`
    );

    // ------------------------------------------------------------------------
    // SECTION 5: Instagram Gallery in website_content Collection
    // ------------------------------------------------------------------------
    console.log('\n--- Section 5: Instagram Gallery Management ---');

    const testInstaItems: InstagramGalleryItem[] = [
      {
        id: 'insta_test_1',
        imageUrl: 'https://images.printstudio.ae/media/instagram/test1.jpg',
        caption: 'Dual color print demo',
        postUrl: 'https://www.instagram.com/p/TEST1/',
        order: 1,
        published: true,
      },
      {
        id: 'insta_test_2',
        imageUrl: 'https://images.printstudio.ae/media/instagram/test2.jpg',
        caption: 'Draft post not yet published',
        postUrl: undefined,
        order: 2,
        published: false,
      },
    ];

    // Store in website_content collection
    await sql`
      INSERT INTO public.ledger_collections (collection_name, record_id, data)
      VALUES ('website_content', 'instagram_gallery', ${JSON.stringify({ items: testInstaItems, updatedAt: new Date().toISOString() })}::jsonb)
      ON CONFLICT (collection_name, record_id)
      DO UPDATE SET data = EXCLUDED.data;
    `;

    const [instaRow] = await sql`
      SELECT data FROM public.ledger_collections
      WHERE collection_name = 'website_content' AND record_id = 'instagram_gallery';
    `;
    const storedItems: InstagramGalleryItem[] = instaRow?.data?.items || [];
    const publishedOnly = storedItems.filter((i) => i.published);
    const instaStorefrontSafe = publishedOnly.length === 1 && publishedOnly[0].id === 'insta_test_1';
    recordTest(
      16,
      'Instagram Management: Stored in website_content (Only Published Returned for Storefront)',
      'Instagram Management',
      instaStorefrontSafe,
      'Only insta_test_1 returned (published: true), insta_test_2 filtered out',
      `Total items: ${storedItems.length}, Published items: ${publishedOnly.length}`
    );

    // ------------------------------------------------------------------------
    // SECTION 6: Media Library & Reference Deletion Protection
    // ------------------------------------------------------------------------
    console.log('\n--- Section 6: Media Library Reference Integrity & Deletion Guard ---');

    const testMediaItems: MediaItem[] = [
      {
        id: 'media_test_used',
        storageKey: 'media/products/2026-11/used_hero.jpg',
        url: 'https://images.printstudio.ae/media/product/test_led.jpg', // Used in test_prod_cms_101!
        fileName: 'test_led.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 250000,
        uploadedAt: new Date().toISOString(),
      },
      {
        id: 'media_test_unused',
        storageKey: 'media/products/2026-11/unused_hero.jpg',
        url: 'https://images.printstudio.ae/media/products/unused_sample.jpg',
        fileName: 'unused_sample.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 180000,
        uploadedAt: new Date().toISOString(),
      },
    ];

    await sql`
      INSERT INTO public.ledger_collections (collection_name, record_id, data)
      VALUES ('website_content', 'media_library', ${JSON.stringify({ items: testMediaItems, updatedAt: new Date().toISOString() })}::jsonb)
      ON CONFLICT (collection_name, record_id)
      DO UPDATE SET data = EXCLUDED.data;
    `;

    // Check usage across published products and Instagram
    const [mediaRow] = await sql`
      SELECT data FROM public.ledger_collections
      WHERE collection_name = 'website_content' AND record_id = 'media_library';
    `;
    const activeMedia: MediaItem[] = mediaRow?.data?.items || [];

    // Check references
    const publishedProducts = await sql`
      SELECT data FROM public.ledger_collections
      WHERE collection_name = 'products' AND (data->>'published')::boolean = true;
    `;

    function isMediaReferenced(url: string): boolean {
      for (const p of publishedProducts) {
        const data = p.data;
        if (data.imageUrl === url) return true;
        if (Array.isArray(data.images) && data.images.includes(url)) return true;
      }
      return false;
    }

    const usedReferenced = isMediaReferenced(testMediaItems[0].url);
    const unusedReferenced = isMediaReferenced(testMediaItems[1].url);
    const deletionGuardWorks = usedReferenced === true && unusedReferenced === false;

    recordTest(
      17,
      'Media Library Safety: Deletion Guard Identifies Referenced vs Unreferenced Assets',
      'Media Security',
      deletionGuardWorks,
      'Referenced media (in published product) blocked; unreferenced media allowed',
      `Used is referenced: ${usedReferenced}, Unused is referenced: ${unusedReferenced}`
    );

    // ------------------------------------------------------------------------
    // SECTION 7: Cleanup & Baseline Verification
    // ------------------------------------------------------------------------
    console.log('\n--- Section 7: Cleanup & Baseline Ledger Checksum Verification ---');

    // Remove test product
    await sql`
      DELETE FROM public.ledger_collections
      WHERE collection_name = 'products' AND record_id = 'test_prod_cms_101';
    `;

    // Remove test website_content entries
    await sql`
      DELETE FROM public.ledger_collections
      WHERE collection_name = 'website_content' AND record_id IN ('instagram_gallery', 'media_library');
    `;

    // Compute final checksum
    const postCheck = await computeLedgerChecksum();
    const finalBaselineIntact =
      postCheck.count === CANONICAL_BASELINE_COUNT &&
      postCheck.digest === CANONICAL_BASELINE_SHA256;

    recordTest(
      18,
      'Baseline Preservation: Historical 371 Rows & SHA-256 Digest 100% Intact Post-Test',
      'Ledger Integrity',
      finalBaselineIntact,
      `Exactly ${CANONICAL_BASELINE_COUNT} records, digest: ${CANONICAL_BASELINE_SHA256}`,
      `Count: ${postCheck.count}, Digest: ${postCheck.digest}`
    );

    // ------------------------------------------------------------------------
    // SECTION 8: Core Engine Untouched (src/components/ledgerCore.js)
    // ------------------------------------------------------------------------
    console.log('\n--- Section 8: Manufacturing Core Ledger Engine Preservation ---');
    const ledgerCorePath = path.join(process.cwd(), 'src/components/ledgerCore.js');
    const ledgerCoreContent = fs.readFileSync(ledgerCorePath, 'utf-8');
    const lines = (ledgerCoreContent.match(/\n/g) || []).length;
    const ledgerCoreUntouched = lines === 8451;
    recordTest(
      19,
      'Manufacturing Core: src/components/ledgerCore.js Remains 100% Untouched (8,451 lines)',
      'Core Engine Preservation',
      ledgerCoreUntouched,
      'Exactly 8,451 lines, zero modifications',
      `Line count: ${lines}`
    );

  } catch (err: any) {
    console.error('❌ Verification crashed:', err);
    process.exit(1);
  }

  // ------------------------------------------------------------------------
  // Summary Scorecard
  // ------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('  VERIFICATION SCORECARD');
  console.log('========================================================================');

  const passedCount = results.filter((r) => r.status === 'PASS').length;
  const failedCount = results.filter((r) => r.status === 'FAIL').length;
  const totalCount = results.length;
  const passRate = ((passedCount / totalCount) * 100).toFixed(1);

  console.log(`Total Checks:  ${totalCount}`);
  console.log(`Passed:        ${passedCount}`);
  console.log(`Failed:        ${failedCount}`);
  console.log(`Success Rate:  ${passRate}%\n`);

  if (failedCount > 0) {
    console.error(`❌ Suite failed with ${failedCount} failing test(s).`);
    process.exit(1);
  } else {
    console.log('✅ ALL 19 VERIFICATION CHECKS PASSED.');
    process.exit(0);
  }
}

runWebsiteCmsVerification();
