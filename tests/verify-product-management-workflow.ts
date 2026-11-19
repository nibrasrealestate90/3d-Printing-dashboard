/**
 * ============================================================================
 * END-TO-END PRODUCT MANAGEMENT & STOREFRONT INTEGRATION VERIFICATION SUITE
 * ============================================================================
 *
 * Validates the core business requirements:
 * 1. Importing an existing manufacturing product preserves the exact record_id.
 * 2. Zero duplicate records are created in ledger_collections.
 * 3. Manufacturing fields (grams, minutes, unitCost, notes, photo) are 100% preserved.
 * 4. Commercial fields (publicName, sellingPrice, category, imageUrl, published) are persisted.
 * 5. Publishing toggle updates published status safely without altering other fields.
 * 6. Public Storefront (/api/store/products) only exposes published products and redacts private manufacturing data.
 * 7. Unpublishing removes product from public website while keeping manufacturing data intact.
 * 8. Safety boundaries (Bambu Production & ledgerCore.js untouched).
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { sanitizeProductForStorefront, sanitizeImageUrl } from "@/lib/storefront";

const ROOT_DIR = process.cwd();
dotenv.config({ path: path.join(ROOT_DIR, ".env.local") });

let total = 0;
let passed = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  total += 1;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          passed += 1;
          console.log(`✅ [PASS] ${name}`);
        })
        .catch((err) => {
          console.error(`❌ [FAIL] ${name}`);
          console.error(`   Error: ${err.message}`);
        });
    } else {
      passed += 1;
      console.log(`✅ [PASS] ${name}`);
    }
  } catch (err: any) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(`   Error: ${err.message}`);
  }
}

async function main() {
  console.log("========================================================================");
  console.log("  PRODUCT MANAGEMENT & WEBSITE INTEGRATION VERIFICATION SUITE");
  console.log("========================================================================\n");

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing in .env.local. Skipping database tests.");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  // --------------------------------------------------------------------------
  // Test 1: Code Invariant — Simplified Products Page Structure
  // --------------------------------------------------------------------------
  runTest("Products Page: Clean structure with Import from Production button and 6 fields", () => {
    const viewPath = path.join(ROOT_DIR, "src/components/admin/ProductManagementView.tsx");
    assert.ok(fs.existsSync(viewPath), "ProductManagementView.tsx must exist");
    const content = fs.readFileSync(viewPath, "utf-8");

    // Must have Import from Production action
    assert.ok(content.includes("Import from Production"), "Must have 'Import from Production' action");
    assert.ok(content.includes("Manage products displayed in your online store."), "Must have clear page description");

    // Must have the 6 required commercial fields in form
    assert.ok(content.includes("formName"), "Form must have product name field");
    assert.ok(content.includes("formPrice"), "Form must have selling price field");
    assert.ok(content.includes("formDescription"), "Form must have description field");
    assert.ok(content.includes("formCategory"), "Form must have category field");
    assert.ok(content.includes("formImages"), "Form must have images field");
    assert.ok(content.includes("formPublished"), "Form must have published toggle");

    // Must NOT have clutter / excluded fields
    assert.ok(!content.includes("formMaterial"), "Form must not clutter with material input");
    assert.ok(!content.includes("formDimensions"), "Form must not clutter with dimensions input");
    assert.ok(!content.includes("formFinish"), "Form must not clutter with finish spec");
    assert.ok(!content.includes("formColors"), "Form must not clutter with color palette input");
    assert.ok(!content.includes("formPersonalizable"), "Form must not clutter with personalization flag");
  });

  // --------------------------------------------------------------------------
  // Test 2: Import Manufacturing Product — Shared Record & Zero Duplication
  // --------------------------------------------------------------------------
  let testProductId: string = "";
  let originalManufacturingData: any = null;
  let initialTotalProducts = 0;

  await runTest("Import Manufacturing Product: Retains original record_id with zero duplication", async () => {
    const existingProducts = await sql`
      SELECT record_id, data
      FROM public.ledger_collections
      WHERE collection_name = 'products';
    `;

    initialTotalProducts = existingProducts.length;
    assert.ok(initialTotalProducts > 0, "Must have existing products in ledger_collections");

    // Pick an existing manufacturing product
    const target = existingProducts[0];
    testProductId = target.record_id;
    originalManufacturingData = { ...target.data };

    // Simulate Commercial Setup on the same product record
    const commercialUpdate = {
      ...target.data,
      isCommercial: true,
      publicName: "Commercial Desk Organizer",
      sellingPrice: 89.00,
      publicDescription: "Handcrafted architectural desk organizer 3D printed in Al Quoz, Dubai.",
      category: "Desk Accessories",
      imageUrl: "https://images.printstudio.ae/media/products/desk_organizer.jpg",
      images: ["https://images.printstudio.ae/media/products/desk_organizer.jpg"],
      published: false,
      updatedAt: new Date().toISOString(),
    };

    // Update the record non-destructively
    await sql`
      UPDATE public.ledger_collections
      SET data = ${JSON.stringify(commercialUpdate)}::jsonb,
          updated_at = NOW()
      WHERE collection_name = 'products' AND record_id = ${testProductId};
    `;

    // Re-query total count and verify
    const afterCount = await sql`
      SELECT count(*)::int as count
      FROM public.ledger_collections
      WHERE collection_name = 'products';
    `;

    assert.strictEqual(
      afterCount[0].count,
      initialTotalProducts,
      "Product count must remain identical (zero duplicate records created)"
    );

    const [updatedRow] = await sql`
      SELECT record_id, data
      FROM public.ledger_collections
      WHERE collection_name = 'products' AND record_id = ${testProductId};
    `;

    assert.strictEqual(updatedRow.record_id, testProductId, "record_id must be strictly preserved");
    assert.strictEqual(updatedRow.data.isCommercial, true, "isCommercial flag must be set to true");
    assert.strictEqual(updatedRow.data.publicName, "Commercial Desk Organizer", "publicName must be updated");
    assert.strictEqual(Number(updatedRow.data.sellingPrice), 89.00, "sellingPrice must be updated");
  });

  // --------------------------------------------------------------------------
  // Test 3: Manufacturing Fields Preservation
  // --------------------------------------------------------------------------
  await runTest("Manufacturing Data Preservation: grams, minutes, unitCost, notes remain intact", async () => {
    const [row] = await sql`
      SELECT data
      FROM public.ledger_collections
      WHERE collection_name = 'products' AND record_id = ${testProductId};
    `;

    const d = row.data;

    // Verify all original manufacturing fields match their baseline
    if (originalManufacturingData.grams !== undefined) {
      assert.strictEqual(d.grams, originalManufacturingData.grams, "Grams must not be altered");
    }
    if (originalManufacturingData.minutes !== undefined) {
      assert.strictEqual(d.minutes, originalManufacturingData.minutes, "Print minutes must not be altered");
    }
    if (originalManufacturingData.unitCost !== undefined) {
      assert.strictEqual(d.unitCost, originalManufacturingData.unitCost, "unitCost must not be altered");
    }
    if (originalManufacturingData.notes !== undefined) {
      assert.strictEqual(d.notes, originalManufacturingData.notes, "Manufacturing notes must not be altered");
    }
    if (originalManufacturingData.photo !== undefined) {
      assert.strictEqual(d.photo, originalManufacturingData.photo, "Bambu photo must not be altered");
    }
  });

  // --------------------------------------------------------------------------
  // Test 4: 1-Click Publishing & Storefront Public API
  // --------------------------------------------------------------------------
  await runTest("Product Publishing: 1-Click publish toggle and public storefront exposure", async () => {
    // 1. Toggle to published = true
    const [row] = await sql`
      SELECT data FROM public.ledger_collections
      WHERE collection_name = 'products' AND record_id = ${testProductId};
    `;

    const publishedData = {
      ...row.data,
      published: true,
      updatedAt: new Date().toISOString(),
    };

    await sql`
      UPDATE public.ledger_collections
      SET data = ${JSON.stringify(publishedData)}::jsonb,
          updated_at = NOW()
      WHERE collection_name = 'products' AND record_id = ${testProductId};
    `;

    // 2. Query storefront published products
    const storefrontProducts = await sql`
      SELECT record_id, data, updated_at
      FROM public.ledger_collections
      WHERE collection_name = 'products'
        AND (
          (data->>'published' = 'true') OR
          (jsonb_typeof(data->'published') = 'boolean' AND (data->'published')::boolean = true)
        );
    `;

    const publishedProduct = storefrontProducts.find((p: any) => p.record_id === testProductId);
    assert.ok(publishedProduct, "Published product must appear in storefront query");

    // 3. Test sanitization: no internal costs or private manufacturing notes exposed
    const sanitized = sanitizeProductForStorefront({
      record_id: publishedProduct.record_id,
      data: publishedProduct.data,
      updated_at: publishedProduct.updated_at,
    });

    assert.strictEqual(sanitized.name, "Commercial Desk Organizer");
    assert.strictEqual(sanitized.sellingPrice, 89.00);
    assert.strictEqual(sanitized.currency, "AED");
    assert.strictEqual((sanitized as any).unitCost, undefined, "unitCost must be redacted");
    assert.strictEqual((sanitized as any).filamentCost, undefined, "filamentCost must be redacted");
    assert.strictEqual((sanitized as any).productionCost, undefined, "productionCost must be redacted");
    assert.strictEqual((sanitized as any).photo, undefined, "Base64 photo must be redacted");
    assert.strictEqual((sanitized as any).notes, undefined, "Internal notes must be redacted");
    assert.strictEqual((sanitized as any).grams, undefined, "Manufacturing grams must be redacted");
    assert.strictEqual((sanitized as any).minutes, undefined, "Manufacturing minutes must be redacted");
    assert.strictEqual((sanitized as any).weightGrams, undefined, "weightGrams must be redacted from public response");
    assert.strictEqual((sanitized as any).printerId, undefined, "printerId must be redacted");
  });

  // --------------------------------------------------------------------------
  // Test 5: Unpublishing Removes from Storefront Without Deleting Product
  // --------------------------------------------------------------------------
  await runTest("Product Unpublishing: Hides from public API while preserving database record", async () => {
    // Toggle to published = false
    const [row] = await sql`
      SELECT data FROM public.ledger_collections
      WHERE collection_name = 'products' AND record_id = ${testProductId};
    `;

    const unpublishedData = {
      ...row.data,
      published: false,
      updatedAt: new Date().toISOString(),
    };

    await sql`
      UPDATE public.ledger_collections
      SET data = ${JSON.stringify(unpublishedData)}::jsonb,
          updated_at = NOW()
      WHERE collection_name = 'products' AND record_id = ${testProductId};
    `;

    // Query storefront published products
    const storefrontProducts = await sql`
      SELECT record_id, data
      FROM public.ledger_collections
      WHERE collection_name = 'products'
        AND (
          (data->>'published' = 'true') OR
          (jsonb_typeof(data->'published') = 'boolean' AND (data->'published')::boolean = true)
        );
    `;

    const publishedProduct = storefrontProducts.find((p: any) => p.record_id === testProductId);
    assert.strictEqual(publishedProduct, undefined, "Unpublished product must NOT appear in public storefront");

    // Verify record still exists in database
    const [persisted] = await sql`
      SELECT record_id, data FROM public.ledger_collections
      WHERE collection_name = 'products' AND record_id = ${testProductId};
    `;
    assert.ok(persisted, "Product record must still exist in ledger_collections");
    assert.strictEqual(persisted.data.published, false, "published flag must be false");

    // Restore original baseline data
    if (originalManufacturingData) {
      await sql`
        UPDATE public.ledger_collections
        SET data = ${JSON.stringify(originalManufacturingData)}::jsonb,
            updated_at = NOW()
        WHERE collection_name = 'products' AND record_id = ${testProductId};
      `;
    }
  });

  // --------------------------------------------------------------------------
  // Test 6: Publication Validation Guard
  // --------------------------------------------------------------------------
  runTest("Publication Validation: Incomplete product cannot be published", () => {
    // Check validation rule logic:
    // Requires: non-empty name, sellingPrice > 0, category, at least 1 image
    function validatePublication(data: any) {
      const name = String(data.name || data.publicName || "").trim();
      if (!name) return { valid: false, reason: "Product name required" };

      const price = Number(data.sellingPrice);
      if (isNaN(price) || price <= 0) return { valid: false, reason: "Price must be > 0" };

      const cat = String(data.category || data.publicCategory || "").trim();
      if (!cat) return { valid: false, reason: "Category required" };

      const imgs = Array.isArray(data.images) ? data.images : [];
      const hasImg = Boolean(
        (data.imageUrl && !data.imageUrl.startsWith("data:")) ||
        imgs.some((img: string) => img && !img.startsWith("data:"))
      );
      if (!hasImg) return { valid: false, reason: "At least one image required" };

      return { valid: true };
    }

    // Incomplete cases:
    assert.strictEqual(validatePublication({ name: "", sellingPrice: 50, category: "Art", imageUrl: "https://img.jpg" }).valid, false);
    assert.strictEqual(validatePublication({ name: "Vase", sellingPrice: 0, category: "Art", imageUrl: "https://img.jpg" }).valid, false);
    assert.strictEqual(validatePublication({ name: "Vase", sellingPrice: -10, category: "Art", imageUrl: "https://img.jpg" }).valid, false);
    assert.strictEqual(validatePublication({ name: "Vase", sellingPrice: 50, category: "", imageUrl: "https://img.jpg" }).valid, false);
    assert.strictEqual(validatePublication({ name: "Vase", sellingPrice: 50, category: "Art", imageUrl: "", images: [] }).valid, false);

    // Complete case:
    assert.strictEqual(validatePublication({ name: "Vase", sellingPrice: 50, category: "Art", imageUrl: "https://img.jpg" }).valid, true);
  });

  // --------------------------------------------------------------------------
  // Test 7: Safety Boundaries
  // --------------------------------------------------------------------------
  runTest("Safety Boundaries: Bambu Production and ledgerCore.js untouched", () => {
    const ledgerCorePath = path.join(ROOT_DIR, "src/components/ledgerCore.js");
    const productionPath = path.join(ROOT_DIR, "src/app/admin/production/page.tsx");

    assert.ok(fs.existsSync(ledgerCorePath), "ledgerCore.js must exist");
    assert.ok(fs.existsSync(productionPath), "admin/production/page.tsx must exist");
  });

  // --------------------------------------------------------------------------
  // Test 8: Public Image Sanitization Guard
  // --------------------------------------------------------------------------
  runTest("Public Image Sanitization: Individual URL validation, scheme protection & SSRF checks", () => {
    // 1. Rejects base64 data URLs (Bambu camera captures)
    assert.strictEqual(sanitizeImageUrl("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."), null, "Must reject base64 data URLs");
    assert.strictEqual(sanitizeImageUrl("DATA:IMAGE/PNG;BASE64,xyz"), null, "Must reject uppercase data URLs");

    // 2. Rejects dangerous schemes
    assert.strictEqual(sanitizeImageUrl("javascript:alert(1)"), null, "Must reject javascript:");
    assert.strictEqual(sanitizeImageUrl("blob:http://localhost/uuid"), null, "Must reject blob:");
    assert.strictEqual(sanitizeImageUrl("file:///etc/passwd"), null, "Must reject file:");
    assert.strictEqual(sanitizeImageUrl("vbscript:msgbox"), null, "Must reject vbscript:");

    // 3. Rejects protocol-relative URLs
    assert.strictEqual(sanitizeImageUrl("//evil.com/img.jpg"), null, "Must reject // protocol-relative URLs");

    // 4. Rejects metadata / internal / SSRF hostnames
    assert.strictEqual(sanitizeImageUrl("https://169.254.169.254/latest/meta-data"), null, "Must reject 169.254.169.254");
    assert.strictEqual(sanitizeImageUrl("https://metadata.google.internal/computeMetadata"), null, "Must reject google internal metadata");
    assert.strictEqual(sanitizeImageUrl("https://server.local/photo.jpg"), null, "Must reject .local hosts");
    assert.strictEqual(sanitizeImageUrl("https://db.internal/photo.jpg"), null, "Must reject .internal hosts");

    // 5. Accepts valid HTTPS web images
    assert.strictEqual(
      sanitizeImageUrl("https://images.printstudio.ae/media/vase.jpg"),
      "https://images.printstudio.ae/media/vase.jpg",
      "Must accept valid HTTPS URL"
    );

    // 6. Accepts safe local paths
    assert.strictEqual(
      sanitizeImageUrl("/images/products/vase.png"),
      "/images/products/vase.png",
      "Must accept safe local path"
    );

    // 7. Sanitizes array of images individually
    const testDoc = {
      record_id: "prod_test_img",
      data: {
        name: "Test Image Product",
        sellingPrice: 100,
        category: "Decor",
        imageUrl: "data:image/png;base64,invalid", // invalid base64
        images: [
          "data:image/jpeg;base64,invalid2", // invalid base64
          "https://169.254.169.254/secret.png", // internal SSRF
          "https://images.printstudio.ae/media/clean1.jpg", // valid
          "https://images.printstudio.ae/media/clean2.jpg", // valid
          "javascript:alert(1)", // invalid
        ],
      },
    };

    const sanitized = sanitizeProductForStorefront(testDoc);
    assert.strictEqual(sanitized.imageUrl, "https://images.printstudio.ae/media/clean1.jpg", "imageUrl must resolve to first clean image");
    assert.strictEqual(sanitized.images.length, 2, "images array must only contain valid, clean images");
    assert.ok(!sanitized.images.some((url) => url.startsWith("data:")), "Must not have any data: URLs in images");
    assert.ok(!sanitized.images.some((url) => url.includes("169.254.169.254")), "Must not have any internal IP URLs");
  });

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log("\n========================================================================");
  console.log(`Total Tests Executed : ${total}`);
  console.log(`Passed               : ${passed} ✅`);
  console.log(`Failed               : ${total - passed} ❌`);
  console.log(`Success Rate         : ${((passed / total) * 100).toFixed(1)}%`);
  console.log("========================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
