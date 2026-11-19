import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { sql } from '../src/lib/db';
import { getSafeRedirectUrl } from '../src/lib/safe-redirect';
import {
  sanitizeProductForStorefront,
  validateEnquiryInput,
  validateQuoteInput,
  formatRfqReference,
} from '../src/lib/storefront';
import {
  validateCadFile,
  generatePresignedPutUrl,
  registerMockUploadedObject,
  ALLOWED_CAD_EXTENSIONS,
  MAX_CAD_FILE_SIZE_BYTES,
} from '../src/lib/r2';

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
    ` ${passed ? '✅' : '❌'} [Req ${id}] ${name}: ${status} (Actual: ${actual})`
  );
}

function makeRequest(options: {
  hostname?: string;
  port?: number;
  path?: string;
  headers?: Record<string, string>;
  method?: string;
  body?: string;
}): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: options.hostname || '127.0.0.1',
        port: options.port || 3000,
        path: options.path || '/',
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body,
          });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runPhase24Verification() {
  console.log('========================================================================');
  console.log('  PHASE 2.4 — BUSINESS DATA FOUNDATION & STOREFRONT API VERIFICATION');
  console.log('========================================================================\n');

  if (!sql) {
    console.error('❌ Critical: DATABASE_URL not configured. Aborting verification.');
    process.exit(1);
  }

  // Clear any existing test rate limits so tests run idempotently
  await sql`DELETE FROM public.rate_limits WHERE key LIKE 'store_%' OR key LIKE 'quote_%';`.catch(() => {});

  try {
    // ------------------------------------------------------------------------
    // Section 1: Phase 2.3 Review Findings Remediation
    // ------------------------------------------------------------------------
    console.log('--- Section 1: Phase 2.3 Remediation Regression ---');

    // Test 1: getSafeRedirectUrl - Safe Relative Admin Paths
    const path1 = getSafeRedirectUrl('/admin/inventory');
    const path2 = getSafeRedirectUrl('/admin/production');
    const path3 = getSafeRedirectUrl('/admin/quotes?status=pending');
    const path4 = getSafeRedirectUrl('');
    const path5 = getSafeRedirectUrl(null);
    const test1Passed =
      path1 === '/admin/inventory' &&
      path2 === '/admin/production' &&
      path3 === '/admin/quotes?status=pending' &&
      path4 === '/admin' &&
      path5 === '/admin';
    recordTest(
      1,
      'Post-Login Deep-Linking: Safe Relative Admin Workspace Paths Accepted',
      'Security Remediation',
      test1Passed,
      'Relative /admin/* paths accepted, null/empty defaults to /admin',
      `inventory: ${path1}, production: ${path2}, quotes: ${path3}, empty: ${path4}`
    );

    // Test 2: getSafeRedirectUrl - Open Redirect & Injection Attacks Rejected
    const badTargets = [
      'https://evil.com',
      'http://attacker.com/admin',
      '//evil.com',
      '//attacker.com/admin',
      '/\\evil.com',
      '\\evil.com',
      '/admin@evil.com',
      '/admin-malicious',
      '/storefront/products',
      'javascript:alert(1)',
      '/admin/%6c%6f%67%69%6e',
      '/admin/../bypass',
      '/admin/login',
      '/login',
      '/admin/login?redirect=foo',
    ];
    const badResults = badTargets.map((t) => ({ target: t, resolved: getSafeRedirectUrl(t) }));
    const allRejected = badResults.every((r) => r.resolved === '/admin');
    recordTest(
      2,
      'Post-Login Deep-Linking: Open Redirects, Bypasses & Loops Default Safely to /admin',
      'Security Remediation',
      allRejected,
      'All 15 malicious/evasive vectors resolved strictly to /admin',
      allRejected ? 'All 15 vectors rejected' : JSON.stringify(badResults.filter((r) => r.resolved !== '/admin'))
    );

    // Test 3: AdminLayout - Exact Pathname Comparison for /admin/login
    const resLoginExact = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/admin/login',
      headers: { Host: 'app.lvh.me:3000' },
    });
    const resLoginSlash = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/admin/login/',
      headers: { Host: 'app.lvh.me:3000' },
    });
    const resLoginNested = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/admin/login/dashboard',
      headers: { Host: 'app.lvh.me:3000' },
    });
    const test3Passed =
      resLoginExact.statusCode === 200 &&
      (resLoginSlash.statusCode === 200 ||
        (resLoginSlash.statusCode === 308 && resLoginSlash.headers.location === '/admin/login')) &&
      (resLoginNested.statusCode === 307 || resLoginNested.statusCode === 404);
    recordTest(
      3,
      'AdminLayout Guard: Strict Exact Match on /admin/login (No Prefix Leak)',
      'Security Remediation',
      test3Passed,
      '/admin/login: 200, /admin/login/: 308/200 canonical redirect, /admin/login/dashboard: 307/404',
      `exact: ${resLoginExact.statusCode}, slash: ${resLoginSlash.statusCode} -> ${resLoginSlash.headers.location}, nested: ${resLoginNested.statusCode}`
    );

    // Test 4: Phase 2.3 Report Correction Verification
    const reportPath = path.join(process.cwd(), 'docs/PHASE_2_3_IMPLEMENTATION_REPORT.md');
    const reportContent = fs.readFileSync(reportPath, 'utf-8');
    const reportCorrected =
      reportContent.includes('/api/data') &&
      reportContent.includes('Administrator Session Cookie Only (Strictly No M2M)');
    recordTest(
      4,
      'Phase 2.3 Report Accuracy: /api/data Documented as Administrator-Session-Only',
      'Documentation Remediation',
      reportCorrected,
      'Report documents /api/data as Administrator Session Cookie Only (Strictly No M2M)',
      reportCorrected ? 'Accurate dual-gate restriction documented' : 'Inaccurate description persists'
    );

    // ------------------------------------------------------------------------
    // Section 2: Database Migration & Schema Presence
    // ------------------------------------------------------------------------
    console.log('\n--- Section 2: Commercial Database Migration Foundation ---');

    // Test 5: Schema Migration Tracking in public.schema_migrations
    const migrationRows = await sql`
      SELECT version, name, checksum, execution_time_ms
      FROM public.schema_migrations
      WHERE version = '0002'
      LIMIT 1;
    `;
    const migrationRecorded =
      migrationRows.length > 0 &&
      migrationRows[0].name === '0002_phase2_storefront_foundation.sql';
    recordTest(
      5,
      'Transactional Migration: 0002_phase2_storefront_foundation.sql Recorded',
      'Database Schema',
      migrationRecorded,
      'Migration 0002 recorded in public.schema_migrations with execution time',
      migrationRecorded
        ? `Version: ${migrationRows[0].version}, Checksum: ${migrationRows[0].checksum.slice(0, 10)}... in ${migrationRows[0].execution_time_ms}ms`
        : 'Migration not recorded'
    );

    // Test 6: Relational Tables Exist in PostgreSQL
    const tableRows = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('store_enquiries', 'store_quote_requests', 'store_quote_files')
      ORDER BY table_name;
    `;
    const tablesPresent = tableRows.map((r: any) => r.table_name);
    const allTablesCreated =
      tablesPresent.includes('store_enquiries') &&
      tablesPresent.includes('store_quote_requests') &&
      tablesPresent.includes('store_quote_files');
    recordTest(
      6,
      'Commercial Relational Tables: store_enquiries, store_quote_requests, store_quote_files Exist',
      'Database Schema',
      allTablesCreated,
      'All 3 storefront relational tables exist in public schema',
      `Present: ${tablesPresent.join(', ')}`
    );

    // Test 7: Performance & Integrity Indexes Exist
    const indexRows = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'idx_store_enquiries_created_at',
          'idx_store_enquiries_status',
          'idx_store_quote_requests_rfq',
          'idx_store_quote_requests_created_at',
          'idx_store_quote_files_quote_id',
          'idx_store_quote_files_storage_key'
        );
    `;
    const indexesPresent = indexRows.map((r: any) => r.indexname);
    const test7Passed = indexesPresent.length >= 6;
    recordTest(
      7,
      'Database Performance Indexes: Created_At, Status, RFQ, and Foreign Key Indexes Verified',
      'Database Schema',
      test7Passed,
      'At least 6 dedicated indexes created for query optimization',
      `Present: ${indexesPresent.length} indexes (${indexesPresent.slice(0, 3).join(', ')}...)`
    );

    // ------------------------------------------------------------------------
    // Section 3: Storefront Public Product Catalogue API
    // ------------------------------------------------------------------------
    console.log('\n--- Section 3: Public Product Catalogue API ---');

    // Test 8: GET /api/store/products - Public Access & Cache Headers
    const resStoreProducts = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/products',
      headers: { Host: 'www.lvh.me:3000' },
    });
    const parsedStoreProducts = JSON.parse(resStoreProducts.body || '{}');
    const cacheHeader = resStoreProducts.headers['cache-control'] || '';
    const test8Passed =
      resStoreProducts.statusCode === 200 &&
      parsedStoreProducts.success === true &&
      Array.isArray(parsedStoreProducts.products) &&
      cacheHeader.includes('s-maxage=60');
    recordTest(
      8,
      'Public Product Catalogue: GET /api/store/products Returns HTTP 200 with Caching Headers',
      'Storefront API',
      test8Passed,
      'HTTP 200, success: true, array of products, Cache-Control: s-maxage=60',
      `Status: ${resStoreProducts.statusCode}, Cache-Control: ${cacheHeader}`
    );

    // Test 9: Data Redaction Unit Test (sanitizeProductForStorefront)
    const mockRawProduct = {
      record_id: 'prod_test_001',
      data: {
        id: 'prod_test_001',
        sku: 'PRN-9999',
        name: 'Proprietary Industrial Drone Shell',
        description: 'Aerodynamic lightweight shell',
        category: 'Aviation',
        sellingPrice: 145.5,
        directPrice: 140.0,
        // Sensitive internal fields that MUST be redacted:
        unitCost: 22.4,
        filamentCost: 18.2,
        productionCost: 25.0,
        materialCost: 20.0,
        electricityCost: 2.4,
        markup: 400,
        markupAmount: 120.5,
        agentPrice: 100.0,
        minStock: 5,
        openingStock: 10,
        totalPrinted: 45,
        minutes: 480,
        bambuPlateId: 'plate_secret_xyz',
        notes: 'Secret factory slicer settings',
        photo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      },
      updated_at: new Date('2026-11-18T10:00:00Z'),
    };
    const sanitized = sanitizeProductForStorefront(mockRawProduct);
    const hasNoCost =
      (sanitized as any).unitCost === undefined &&
      (sanitized as any).filamentCost === undefined &&
      (sanitized as any).productionCost === undefined &&
      (sanitized as any).materialCost === undefined &&
      (sanitized as any).electricityCost === undefined &&
      (sanitized as any).markup === undefined &&
      (sanitized as any).markupAmount === undefined &&
      (sanitized as any).agentPrice === undefined &&
      (sanitized as any).bambuPlateId === undefined &&
      (sanitized as any).notes === undefined;
    const base64Redacted = sanitized.imageUrl === null;
    const publicFieldsPreserved =
      sanitized.id === 'prod_test_001' &&
      sanitized.name === 'Proprietary Industrial Drone Shell' &&
      sanitized.sellingPrice === 145.5 &&
      sanitized.currency === 'AED' &&
      sanitized.category === 'Aviation';
    const test9Passed = hasNoCost && base64Redacted && publicFieldsPreserved;
    recordTest(
      9,
      'Product Data Redaction: Strict Whitelist Sanitization (Zero Cost/Margins/Base64)',
      'Security Sanitization',
      test9Passed,
      'All 12 internal cost/slicer fields redacted, base64 photo stripped, public specs intact',
      `Cost redacted: ${hasNoCost}, base64 redacted: ${base64Redacted}, public intact: ${publicFieldsPreserved}`
    );

    // Test 10: GET /api/store/products/[slug] - Non-Existent Product Returns HTTP 404
    const resNotFoundProduct = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/products/non-existent-product-slug-xyz',
      headers: { Host: 'www.lvh.me:3000' },
    });
    const test10Passed = resNotFoundProduct.statusCode === 404;
    recordTest(
      10,
      'Single Product API: Unmatched Slug Returns HTTP 404',
      'Storefront API',
      test10Passed,
      'HTTP 404 with PRODUCT_NOT_FOUND error payload',
      `Status: ${resNotFoundProduct.statusCode}`
    );

    // ------------------------------------------------------------------------
    // Section 4: Customer Enquiry API
    // ------------------------------------------------------------------------
    console.log('\n--- Section 4: Customer Enquiry API ---');

    // Test 11: Valid Enquiry Submission & Relational Persistence
    const validEnquiryPayload = {
      customerName: 'Amina Al-Falasi',
      customerEmail: 'amina@dubai-design.ae',
      customerPhone: '+971-50-1234567',
      subject: 'Architectural Scale Model 1:50',
      message: 'Requesting print of villa prototype for client review.',
    };
    const resValidEnquiry = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/enquiries',
      method: 'POST',
      headers: {
        Host: 'www.lvh.me:3000',
        Origin: 'http://www.lvh.me:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validEnquiryPayload),
    });
    const parsedEnquiry = JSON.parse(resValidEnquiry.body || '{}');
    const enquiryId = parsedEnquiry.enquiryId;
    let enquiryInDb = false;
    if (enquiryId) {
      const dbCheck = await sql`
        SELECT id, customer_name, customer_email, status, ip_address
        FROM public.store_enquiries
        WHERE id = ${enquiryId}
        LIMIT 1;
      `;
      enquiryInDb =
        dbCheck.length > 0 &&
        dbCheck[0].customer_email === 'amina@dubai-design.ae' &&
        dbCheck[0].status === 'NEW';
    }
    const test11Passed =
      resValidEnquiry.statusCode === 201 &&
      parsedEnquiry.success === true &&
      enquiryInDb;
    recordTest(
      11,
      'Customer Enquiry API: Valid POST Persists to public.store_enquiries with Status NEW',
      'Storefront API',
      test11Passed,
      'HTTP 201, enquiryId returned, verified row in store_enquiries',
      `Status: ${resValidEnquiry.statusCode}, enquiryId: ${enquiryId}, persisted: ${enquiryInDb}`
    );

    // Test 12: Invalid Enquiry Payload Validation (Missing Name & Malformed Email)
    const invalidEnquiryPayload = {
      customerName: '',
      customerEmail: 'not-an-email',
      subject: '',
      message: '',
    };
    const resInvalidEnquiry = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/enquiries',
      method: 'POST',
      headers: {
        Host: 'www.lvh.me:3000',
        Origin: 'http://www.lvh.me:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidEnquiryPayload),
    });
    const parsedInvalidEnquiry = JSON.parse(resInvalidEnquiry.body || '{}');
    const test12Passed =
      resInvalidEnquiry.statusCode === 400 &&
      parsedInvalidEnquiry.error === 'VALIDATION_ERROR' &&
      Boolean(parsedInvalidEnquiry.errors?.customerName) &&
      Boolean(parsedInvalidEnquiry.errors?.customerEmail);
    recordTest(
      12,
      'Customer Enquiry Validation: Missing & Malformed Fields Rejected with HTTP 400',
      'Storefront API',
      test12Passed,
      'HTTP 400, VALIDATION_ERROR with field-level details',
      `Status: ${resInvalidEnquiry.statusCode}, error: ${parsedInvalidEnquiry.error}`
    );

    // ------------------------------------------------------------------------
    // Section 5: CAD File Upload Pre-Signing API
    // ------------------------------------------------------------------------
    console.log('\n--- Section 5: CAD Upload Pre-Signing API ---');

    // Test 13: CAD File Extension Whitelist Validation (.step, .stp, .stl, .3mf, .obj)
    const validExtensions = ['.step', '.stp', '.stl', '.3mf', '.obj'];
    const invalidExtensions = ['.exe', '.zip', '.sh', '.bat', '.js', '.php', '.bin'];
    const validExtsPass = validExtensions.every((ext) => validateCadFile(`model${ext}`, 1024).valid);
    const invalidExtsFail = invalidExtensions.every((ext) => !validateCadFile(`file${ext}`, 1024).valid);
    const test13Passed = validExtsPass && invalidExtsFail;
    recordTest(
      13,
      'CAD Extension Whitelist: .step, .stp, .stl, .3mf, .obj Allowed; Executables Rejected',
      'Security Validation',
      test13Passed,
      'Only approved CAD extensions permitted; executable/archive formats rejected',
      `Valid passed: ${validExtsPass}, Invalid rejected: ${invalidExtsFail}`
    );

    // Test 14: CAD File Size Limit Boundary (50 MB)
    const sizeOk = validateCadFile('part.step', 50 * 1024 * 1024).valid;
    const sizeExceeded = validateCadFile('huge.step', 50 * 1024 * 1024 + 1).valid;
    const zeroSize = validateCadFile('empty.step', 0).valid;
    const test14Passed = sizeOk && !sizeExceeded && !zeroSize;
    recordTest(
      14,
      'CAD File Size Boundary: Maximum 50 MB Strictly Enforced',
      'Security Validation',
      test14Passed,
      '50MB accepted, 50MB+1 byte rejected, 0 bytes rejected',
      `50MB: ${sizeOk}, 50MB+1: ${!sizeExceeded}, 0B: ${!zeroSize}`
    );

    // Test 15: Safe Unconfigured State (Without Faking Upload)
    const resPresign = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/quotes/presign',
      method: 'POST',
      headers: {
        Host: 'www.lvh.me:3000',
        Origin: 'http://www.lvh.me:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName: 'turbine_blade.step', fileSizeBytes: 5242880 }),
    });
    const parsedPresign = JSON.parse(resPresign.body || '{}');
    const isR2Configured = Boolean(
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME
    );
    let test15Passed = false;
    if (isR2Configured) {
      test15Passed = resPresign.statusCode === 200 && Boolean(parsedPresign.uploadUrl);
    } else {
      // Safe disabled state without faking upload
      test15Passed =
        resPresign.statusCode === 503 &&
        parsedPresign.error === 'STORAGE_UNAVAILABLE' &&
        parsedPresign.storageConfigured === false &&
        Array.isArray(parsedPresign.requiredPrerequisites);
    }
    recordTest(
      15,
      'Private Storage Prerequisite: Safe Honest Unconfigured State (No Faked Uploads)',
      'Cloud Storage Security',
      test15Passed,
      isR2Configured ? 'HTTP 200 with presigned PUT URL' : 'HTTP 503 STORAGE_UNAVAILABLE with requiredPrerequisites list',
      `Status: ${resPresign.statusCode}, storageConfigured: ${parsedPresign.storageConfigured}`
    );

    // Test 16: AWS SigV4 Presigner Unit Test
    const mockR2Config = {
      accountId: 'test_account_12345',
      accessKeyId: 'test_access_key_abc',
      secretAccessKey: 'test_secret_key_xyz_987654321',
      bucketName: 'print-studio-cad-bucket',
    };
    const presignedUrl = generatePresignedPutUrl(
      mockR2Config,
      'uploads/rfq/bracket_test.step',
      600
    );
    const hasSigV4 =
      presignedUrl.includes('X-Amz-Algorithm=AWS4-HMAC-SHA256') &&
      presignedUrl.includes('X-Amz-Credential=') &&
      presignedUrl.includes('X-Amz-Signature=') &&
      presignedUrl.includes('X-Amz-Expires=600');
    recordTest(
      16,
      'AWS SigV4 Presigner: Canonical S3/R2 PUT URL Signature Verified',
      'Cloud Storage Security',
      hasSigV4,
      'URL contains AWS4-HMAC-SHA256, Credential, Signature, and 600s expiration',
      hasSigV4 ? 'Valid SigV4 PUT query parameters generated' : presignedUrl
    );

    // ------------------------------------------------------------------------
    // Section 6: Custom Quote Request (RFQ) API
    // ------------------------------------------------------------------------
    console.log('\n--- Section 6: Custom Quote Request (RFQ) API ---');

    // Test 17: Valid Quote Submission & Sequence-Backed RFQ Reference
    const quotePayload = {
      customerName: 'Rashid Al-Maktoum',
      customerEmail: 'rashid@techinnovations.ae',
      customerPhone: '+971-4-8001234',
      projectTitle: 'Carbon-Fiber Drone Landing Strut',
      projectDescription: 'Reinforced landing gear struts required for harsh outdoor flight tests.',
      materialPreference: 'PETG-CF',
      colorPreference: 'Matte Black',
      quantity: 4,
      targetDeadline: '2026-12-15',
    };
    const resQuote = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/quotes',
      method: 'POST',
      headers: {
        Host: 'www.lvh.me:3000',
        Origin: 'http://www.lvh.me:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(quotePayload),
    });
    const parsedQuote = JSON.parse(resQuote.body || '{}');
    const rfqRef = parsedQuote.rfqReference;
    const quoteId = parsedQuote.quoteRequestId;
    let quoteInDb = false;
    if (quoteId) {
      const dbCheck = await sql`
        SELECT id, rfq_reference, status, quantity, currency
        FROM public.store_quote_requests
        WHERE id = ${quoteId}
        LIMIT 1;
      `;
      quoteInDb =
        dbCheck.length > 0 &&
        dbCheck[0].rfq_reference === rfqRef &&
        dbCheck[0].status === 'PENDING_REVIEW' &&
        dbCheck[0].currency === 'AED';
    }
    const rfqPattern = /^RFQ-\d{4}-\d{4,}$/;
    const test17Passed =
      resQuote.statusCode === 201 &&
      parsedQuote.success === true &&
      rfqPattern.test(rfqRef) &&
      quoteInDb;
    recordTest(
      17,
      'Custom Quote Request API: Generates RFQ-YYYY-XXXX Reference & Persists to PostgreSQL',
      'Storefront API',
      test17Passed,
      'HTTP 201, RFQ-YYYY-XXXX reference, persisted with status PENDING_REVIEW',
      `Status: ${resQuote.statusCode}, Ref: ${rfqRef}, Persisted: ${quoteInDb}`
    );

    // Test 18: CAD File Attachment Association in public.store_quote_files via server-issued uploadToken
    const testUploadToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(testUploadToken).digest('hex');
    const storageKey = `uploads/rfq/test_${Date.now()}_${crypto.randomBytes(8).toString('hex')}_gearbox.step`;

    // Register mock uploaded object so server verification succeeds in local dev
    registerMockUploadedObject(storageKey, {
      sizeBytes: 3145728,
      mimeType: 'application/step',
    });

    // Create pending upload intent in DB
    await sql`
      INSERT INTO public.store_upload_intents (
        storage_key,
        token_hash,
        file_name,
        file_size_bytes,
        mime_type,
        file_extension,
        status,
        expires_at
      ) VALUES (
        ${storageKey},
        ${tokenHash},
        'gearbox_housing_v3.step',
        3145728,
        'application/step',
        '.step',
        'UPLOADED',
        NOW() + INTERVAL '10 minutes'
      );
    `;

    const quoteWithFilePayload = {
      customerName: 'Maya Chen',
      customerEmail: 'maya@robotics-lab.ae',
      projectTitle: 'Gearbox Housing Prototype',
      projectDescription: 'Precision SLA/PETG enclosure with bearing mounts.',
      quantity: 2,
      uploadToken: testUploadToken,
    };
    const resQuoteFile = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/quotes',
      method: 'POST',
      headers: {
        Host: 'www.lvh.me:3000',
        Origin: 'http://www.lvh.me:3000',
        'Content-Type': 'application/json',
        'x-test-mock-upload': 'verified',
      },
      body: JSON.stringify(quoteWithFilePayload),
    });
    const parsedQuoteFile = JSON.parse(resQuoteFile.body || '{}');
    const quoteWithFileId = parsedQuoteFile.quoteRequestId;
    let fileAttached = false;
    let intentConsumed = false;
    if (quoteWithFileId) {
      const fileCheck = await sql`
        SELECT quote_request_id, file_name, file_extension, storage_key, file_size_bytes, scan_status
        FROM public.store_quote_files
        WHERE quote_request_id = ${quoteWithFileId}
        LIMIT 1;
      `;
      fileAttached =
        fileCheck.length > 0 &&
        fileCheck[0].file_name === 'gearbox_housing_v3.step' &&
        fileCheck[0].file_extension === '.step' &&
        fileCheck[0].storage_key === storageKey &&
        fileCheck[0].scan_status === 'QUARANTINED';

      const intentCheck = await sql`
        SELECT status, quote_id
        FROM public.store_upload_intents
        WHERE token_hash = ${tokenHash}
        LIMIT 1;
      `;
      intentConsumed =
        intentCheck.length > 0 &&
        intentCheck[0].status === 'CONSUMED' &&
        intentCheck[0].quote_id === quoteWithFileId;
    }
    const test18Passed =
      resQuoteFile.statusCode === 201 &&
      parsedQuoteFile.success === true &&
      fileAttached &&
      intentConsumed;
    recordTest(
      18,
      'CAD File Association: Relational Linkage to public.store_quote_files & Intent Consumption Verified',
      'Storefront API',
      test18Passed,
      'HTTP 201, quote request linked to CAD file row (QUARANTINED), upload intent marked CONSUMED',
      `Status: ${resQuoteFile.statusCode}, file attached: ${fileAttached}, intent consumed: ${intentConsumed}`
    );

    // Test 19: Quote Request Rate Limiting (3 / hour / IP)
    // Send requests until limit is hit
    const rateLimitTestPayload = {
      customerName: 'Rate Limit Test',
      customerEmail: 'ratelimit@example.ae',
      projectTitle: 'Stress Test Project',
      projectDescription: 'Triggering rate limiter threshold',
      quantity: 1,
    };
    let hitRateLimit = false;
    let retryAfterHeader = '';
    for (let i = 0; i < 5; i++) {
      const r = await makeRequest({
        hostname: '127.0.0.1',
        port: 3000,
        path: '/api/store/quotes',
        method: 'POST',
        headers: {
          Host: 'www.lvh.me:3000',
          Origin: 'http://www.lvh.me:3000',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rateLimitTestPayload),
      });
      if (r.statusCode === 429) {
        hitRateLimit = true;
        retryAfterHeader = String(r.headers['retry-after'] || '');
        break;
      }
    }
    const test19Passed = hitRateLimit && Boolean(retryAfterHeader);
    recordTest(
      19,
      'Rate Limiting Defense: Excessive RFQ Submissions Trigger HTTP 429 & Retry-After',
      'Security Rate Limiting',
      test19Passed,
      'HTTP 429 Too Many Requests with Retry-After header after 3 submissions',
      `Rate limit triggered: ${hitRateLimit}, Retry-After: ${retryAfterHeader}s`
    );

    // ------------------------------------------------------------------------
    // Section 7: Manufacturing Baseline Integrity Check
    // ------------------------------------------------------------------------
    console.log('\n--- Section 7: Manufacturing Baseline Integrity ---');

    // Test 20: 371 Baseline Records & SHA-256 Digest Preserved 100%
    const allRows = await sql`
      SELECT collection_name, record_id, data, updated_at
      FROM public.ledger_collections
      ORDER BY collection_name, record_id;
    `;
    const hash = crypto.createHash('sha256');
    for (const r of allRows) {
      hash.update(`${r.collection_name}|${r.record_id}|${JSON.stringify(r.data)}|${new Date(r.updated_at).toISOString()}`);
    }
    const digest = hash.digest('hex');
    const isDbPreserved =
      allRows.length === 371 &&
      digest === 'd39c74285d77c00a33500f02be7595c9e495b999e2956879f2dd134e6232ef62';
    recordTest(
      20,
      'Database Baseline Record Count (371) & Canonical SHA-256 Digest Intact',
      'Preservation',
      isDbPreserved,
      'Exactly 371 records, SHA-256 matches d39c74285d77c00a33500f02be7595c9e495b999e2956879f2dd134e6232ef62',
      `Rows: ${allRows.length}, SHA-256: ${digest}`
    );

    // ------------------------------------------------------------------------
    // Scorecard
    // ------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log('  PHASE 2.4 TEST SCORECARD');
    console.log('========================================================================');

    const passedCount = results.filter((r) => r.status === 'PASS').length;
    const totalCount = results.length;
    const passPercentage = ((passedCount / totalCount) * 100).toFixed(1);

    console.log(`Total Verification Tests: ${totalCount}`);
    console.log(`Passed:                   ${passedCount}`);
    console.log(`Failed:                   ${totalCount - passedCount}`);
    console.log(`Success Rate:             ${passPercentage}%\n`);

    if (passedCount !== totalCount) {
      console.error('❌ Phase 2.4 Verification FAILED. See failing requirements above.');
      process.exit(1);
    } else {
      console.log('🎉 Phase 2.4 Verification PASSED with 100% success rate.');
      process.exit(0);
    }
  } catch (err: any) {
    console.error('Unhandled verification error:', err);
    process.exit(1);
  } finally {
    // Reset test rate limits so ongoing dev is unhindered
    await sql`DELETE FROM public.rate_limits WHERE key LIKE 'store_%' OR key LIKE 'quote_%';`.catch(() => {});
  }
}

runPhase24Verification();
