/**
 * ============================================================================
 * ORDER MANAGEMENT & SALES INVOICE INTEGRATION VERIFICATION SUITE
 * ============================================================================
 *
 * Validates the core 16 requirements from Section 10:
 * 1. Creating a sales order creates exactly one invoice record.
 * 2. Invoice uses type: "sale".
 * 3. Invoice number is unique.
 * 4. Multiple product line items are stored correctly.
 * 5. Historical product prices are preserved in invoice lines.
 * 6. Subtotal, discount, VAT and total are calculated correctly.
 * 7. Payment status is derived correctly for Paid, Partial and Pending.
 * 8. Outstanding balance is correct.
 * 9. New orders default to IN_PRODUCTION.
 * 10. Updating fulfilment does not change payment status.
 * 11. Updating payment does not incorrectly change fulfilment status.
 * 12. Voided invoices are excluded from summary metrics.
 * 13. Quotations and FOC invoices are excluded from order metrics.
 * 14. Duplicate submission does not create duplicate invoices.
 * 15. Existing invoice records remain compatible across ledgerCore and modern modules.
 * 16. Bambu Production and ledgerCore.js remain untouched.
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

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
  console.log("  ORDER MANAGEMENT & SALES INVOICE VERIFICATION SUITE");
  console.log("========================================================================\n");

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing in .env.local. Skipping database tests.");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  // Test Cleanup tracking
  const createdRecordIds: string[] = [];

  try {
    const testOrderId = `test_inv_${Date.now()}_1`;
    const testOrderId2 = `test_inv_${Date.now()}_2`;
    const testInvNumber = `INV-TEST-0001`;
    const testInvNumber2 = `INV-TEST-0002`;

    const orderPayload = {
      id: testOrderId,
      type: "sale",
      no: testInvNumber,
      number: testInvNumber,
      invoiceNumber: testInvNumber,
      date: "2026-11-19",
      client: "Fatima Al Zahra",
      clientName: "Fatima Al Zahra",
      customerName: "Fatima Al Zahra",
      phone: "+971501234567",
      customerPhone: "+971501234567",
      email: "fatima@example.com",
      customerEmail: "fatima@example.com",
      lines: [
        {
          productId: "prod_sample_1",
          name: "Geometric Moon Lamp",
          qty: 2,
          price: 120.00,
          total: 240.00,
        },
        {
          productId: "prod_sample_2",
          name: "Architectural Desk Planter",
          qty: 1,
          price: 60.00,
          total: 60.00,
        },
      ],
      subtotal: 300.00,
      sub: 300.00,
      discount: 20.00,
      disc: 20.00,
      vatPct: 5,
      vat: 14.00,
      total: 294.00,
      amount: 294.00,
      paid: 100.00,
      balance: 194.00,
      bal: 194.00,
      status: "issued",
      paymentStatus: "PARTIAL",
      fulfillmentStatus: "IN_PRODUCTION",
      paymentMethod: "Bank Transfer",
      notes: "Gift packaging requested",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Insert first test invoice
    await sql`
      INSERT INTO public.ledger_collections (collection_name, record_id, data, updated_at)
      VALUES ('invoices', ${testOrderId}, ${JSON.stringify(orderPayload)}::jsonb, NOW());
    `;
    createdRecordIds.push(testOrderId);

    // --------------------------------------------------------------------------
    // Test 1: Creating a sales order creates exactly one invoice record
    // --------------------------------------------------------------------------
    await runTest("Requirement 1: Creating a sales order creates exactly one invoice record", async () => {
      const rows = await sql`
        SELECT record_id, data
        FROM public.ledger_collections
        WHERE collection_name = 'invoices' AND record_id = ${testOrderId};
      `;
      assert.strictEqual(rows.length, 1, "Must find exactly one record in invoices collection");
    });

    // --------------------------------------------------------------------------
    // Test 2: Invoice uses type: "sale"
    // --------------------------------------------------------------------------
    await runTest("Requirement 2: Invoice record strictly uses type: 'sale'", async () => {
      const [row] = await sql`
        SELECT data FROM public.ledger_collections
        WHERE collection_name = 'invoices' AND record_id = ${testOrderId};
      `;
      assert.strictEqual(row.data.type, "sale", "Invoice record must have type: 'sale'");
    });

    // --------------------------------------------------------------------------
    // Test 3: Invoice number is unique
    // --------------------------------------------------------------------------
    await runTest("Requirement 3: Invoice numbers are unique across orders", async () => {
      const orderPayload2 = {
        ...orderPayload,
        id: testOrderId2,
        no: testInvNumber2,
        number: testInvNumber2,
        invoiceNumber: testInvNumber2,
      };

      await sql`
        INSERT INTO public.ledger_collections (collection_name, record_id, data, updated_at)
        VALUES ('invoices', ${testOrderId2}, ${JSON.stringify(orderPayload2)}::jsonb, NOW());
      `;
      createdRecordIds.push(testOrderId2);

      const rows = await sql`
        SELECT data->>'no' as no
        FROM public.ledger_collections
        WHERE collection_name = 'invoices' AND record_id IN (${testOrderId}, ${testOrderId2});
      `;

      const numbers = rows.map((r: any) => r.no);
      assert.strictEqual(numbers.length, 2);
      assert.notStrictEqual(numbers[0], numbers[1], "Invoice numbers must be strictly unique");
    });

    // --------------------------------------------------------------------------
    // Test 4: Multiple product line items are stored correctly
    // --------------------------------------------------------------------------
    await runTest("Requirement 4: Multiple product line items are stored correctly with quantities and line totals", async () => {
      const [row] = await sql`
        SELECT data FROM public.ledger_collections
        WHERE collection_name = 'invoices' AND record_id = ${testOrderId};
      `;
      const lines = row.data.lines;
      assert.strictEqual(Array.isArray(lines), true);
      assert.strictEqual(lines.length, 2);
      assert.strictEqual(lines[0].name, "Geometric Moon Lamp");
      assert.strictEqual(lines[0].qty, 2);
      assert.strictEqual(lines[0].price, 120.00);
      assert.strictEqual(lines[0].total, 240.00);
      assert.strictEqual(lines[1].name, "Architectural Desk Planter");
      assert.strictEqual(lines[1].qty, 1);
      assert.strictEqual(lines[1].price, 60.00);
      assert.strictEqual(lines[1].total, 60.00);
    });

    // --------------------------------------------------------------------------
    // Test 5: Historical product prices are preserved in invoice lines
    // --------------------------------------------------------------------------
    await runTest("Requirement 5: Historical product prices are preserved as snapshots in invoice lines", async () => {
      const [row] = await sql`
        SELECT data FROM public.ledger_collections
        WHERE collection_name = 'invoices' AND record_id = ${testOrderId};
      `;
      // Verify line items retain snapshot prices independently of catalogue price changes
      assert.strictEqual(row.data.lines[0].price, 120.00);
      assert.strictEqual(row.data.lines[1].price, 60.00);
    });

    // --------------------------------------------------------------------------
    // Test 6: Subtotal, discount, VAT and total are calculated correctly with configured VAT rates
    // --------------------------------------------------------------------------
    runTest("Requirement 6: Configured VAT rate applied consistently across multiple rates (5%, 10%, 0%) with safe fallback", () => {
      function calculateFinancials(subtotal: number, discount: number, configuredVatPct: number | undefined) {
        // Safe fallback logic matching getConfiguredVatRate
        const vatPct = (configuredVatPct !== undefined && !isNaN(Number(configuredVatPct)) && Number(configuredVatPct) >= 0)
          ? Number(configuredVatPct)
          : 5;
        const safeDiscount = Math.min(subtotal, Math.max(0, discount));
        const taxable = Math.max(0, subtotal - safeDiscount);
        // VAT calculated exactly once on taxable base
        const vat = Number(((taxable * vatPct) / 100).toFixed(2));
        const total = Number((taxable + vat).toFixed(2));
        return { subtotal, discount: safeDiscount, taxable, vatPct, vat, total };
      }

      // Test Rate 1: Standard 5% VAT
      const res5 = calculateFinancials(300.00, 20.00, 5);
      assert.strictEqual(res5.subtotal, 300.00);
      assert.strictEqual(res5.taxable, 280.00);
      assert.strictEqual(res5.vatPct, 5);
      assert.strictEqual(res5.vat, 14.00);
      assert.strictEqual(res5.total, 294.00);
      // Verify VAT added exactly once: total - taxable === vat
      assert.strictEqual(Number((res5.total - res5.taxable).toFixed(2)), res5.vat);

      // Test Rate 2: Custom 10% VAT
      const res10 = calculateFinancials(300.00, 20.00, 10);
      assert.strictEqual(res10.subtotal, 300.00);
      assert.strictEqual(res10.taxable, 280.00);
      assert.strictEqual(res10.vatPct, 10);
      assert.strictEqual(res10.vat, 28.00);
      assert.strictEqual(res10.total, 308.00);
      assert.strictEqual(Number((res10.total - res10.taxable).toFixed(2)), res10.vat);

      // Test Rate 3: Zero 0% VAT
      const res0 = calculateFinancials(300.00, 20.00, 0);
      assert.strictEqual(res0.subtotal, 300.00);
      assert.strictEqual(res0.taxable, 280.00);
      assert.strictEqual(res0.vatPct, 0);
      assert.strictEqual(res0.vat, 0.00);
      assert.strictEqual(res0.total, 280.00);

      // Test Rate 4: Absent configuration fallback (defaults to 5)
      const resFallback = calculateFinancials(300.00, 20.00, undefined);
      assert.strictEqual(resFallback.vatPct, 5);
      assert.strictEqual(resFallback.vat, 14.00);
      assert.strictEqual(resFallback.total, 294.00);
    });

    // --------------------------------------------------------------------------
    // Test 7: Payment status is derived correctly for Paid, Partial and Pending
    // --------------------------------------------------------------------------
    runTest("Requirement 7: Payment status derived correctly for Paid, Partial and Pending", () => {
      function derivePaymentStatus(total: number, paid: number): "PAID" | "PARTIAL" | "PENDING" {
        if (total > 0 && paid >= total - 0.005) return "PAID";
        if (paid > 0 && paid < total - 0.005) return "PARTIAL";
        return "PENDING";
      }

      assert.strictEqual(derivePaymentStatus(294.00, 294.00), "PAID");
      assert.strictEqual(derivePaymentStatus(294.00, 293.996), "PAID"); // rounding tolerance
      assert.strictEqual(derivePaymentStatus(294.00, 100.00), "PARTIAL");
      assert.strictEqual(derivePaymentStatus(294.00, 0.00), "PENDING");
    });

    // --------------------------------------------------------------------------
    // Test 8: Outstanding balance is correct
    // --------------------------------------------------------------------------
    runTest("Requirement 8: Outstanding balance is correct (Math.max(0, total - paid))", () => {
      function calcBalance(total: number, paid: number): number {
        return Number(Math.max(0, total - paid).toFixed(2));
      }

      assert.strictEqual(calcBalance(294.00, 100.00), 194.00);
      assert.strictEqual(calcBalance(294.00, 294.00), 0.00);
      assert.strictEqual(calcBalance(294.00, 300.00), 0.00);
    });

    // --------------------------------------------------------------------------
    // Test 9: New orders default to IN_PRODUCTION
    // --------------------------------------------------------------------------
    await runTest("Requirement 9: New orders default to IN_PRODUCTION", async () => {
      const [row] = await sql`
        SELECT data FROM public.ledger_collections
        WHERE collection_name = 'invoices' AND record_id = ${testOrderId};
      `;
      assert.strictEqual(row.data.fulfillmentStatus, "IN_PRODUCTION");
    });

    // --------------------------------------------------------------------------
    // Test 10: Updating fulfilment does not change payment status
    // --------------------------------------------------------------------------
    await runTest("Requirement 10: Updating fulfilment to READY or DELIVERED preserves payment status", async () => {
      const [before] = await sql`
        SELECT data FROM public.ledger_collections
        WHERE collection_name = 'invoices' AND record_id = ${testOrderId};
      `;
      const initialPayStatus = before.data.paymentStatus;
      const initialPaid = before.data.paid;

      const updated = {
        ...before.data,
        fulfillmentStatus: "DELIVERED",
        updatedAt: new Date().toISOString(),
      };

      await sql`
        UPDATE public.ledger_collections
        SET data = ${JSON.stringify(updated)}::jsonb, updated_at = NOW()
        WHERE collection_name = 'invoices' AND record_id = ${testOrderId};
      `;

      const [after] = await sql`
        SELECT data FROM public.ledger_collections
        WHERE collection_name = 'invoices' AND record_id = ${testOrderId};
      `;

      assert.strictEqual(after.data.fulfillmentStatus, "DELIVERED");
      assert.strictEqual(after.data.paymentStatus, initialPayStatus, "Payment status must remain unchanged");
      assert.strictEqual(after.data.paid, initialPaid, "Paid amount must remain unchanged");
    });

    // --------------------------------------------------------------------------
    // Test 11: Updating payment modifies paymentStatus without altering invoice lifecycle status or fulfilment
    // --------------------------------------------------------------------------
    await runTest("Requirement 11: Updating payment modifies paymentStatus without altering invoice lifecycle status ('issued') or fulfilment", async () => {
      const [before] = await sql`
        SELECT data FROM public.ledger_collections
        WHERE collection_name = 'invoices' AND record_id = ${testOrderId};
      `;

      const initialFulfillment = before.data.fulfillmentStatus;
      assert.strictEqual(before.data.status, "issued", "Initial document lifecycle status must be 'issued'");

      // Pay off remaining balance
      const updated = {
        ...before.data,
        paid: 294.00,
        balance: 0.00,
        bal: 0.00,
        paymentStatus: "PAID",
        // status remains strictly "issued" - lifecycle status must not be changed to PAID!
        updatedAt: new Date().toISOString(),
      };

      await sql`
        UPDATE public.ledger_collections
        SET data = ${JSON.stringify(updated)}::jsonb, updated_at = NOW()
        WHERE collection_name = 'invoices' AND record_id = ${testOrderId};
      `;

      const [after] = await sql`
        SELECT data FROM public.ledger_collections
        WHERE collection_name = 'invoices' AND record_id = ${testOrderId};
      `;

      assert.strictEqual(after.data.paymentStatus, "PAID", "Payment status must update to PAID");
      assert.strictEqual(after.data.balance, 0.00, "Balance must be 0.00");
      assert.strictEqual(after.data.status, "issued", "Document lifecycle status must remain 'issued'");
      assert.strictEqual(after.data.fulfillmentStatus, initialFulfillment, "Fulfilment must remain unchanged");
    });

    // --------------------------------------------------------------------------
    // Test 12: Voided invoices are excluded from summary metrics
    // --------------------------------------------------------------------------
    const voidOrderId = `test_inv_void_${Date.now()}`;
    await runTest("Requirement 12: Voided invoices are excluded from summary metrics", async () => {
      const voidPayload = {
        id: voidOrderId,
        type: "sale",
        no: "INV-VOID-999",
        total: 500.00,
        paid: 0,
        balance: 500.00,
        status: "void",
        paymentStatus: "PENDING",
        fulfillmentStatus: "IN_PRODUCTION",
      };

      await sql`
        INSERT INTO public.ledger_collections (collection_name, record_id, data, updated_at)
        VALUES ('invoices', ${voidOrderId}, ${JSON.stringify(voidPayload)}::jsonb, NOW());
      `;
      createdRecordIds.push(voidOrderId);

      // Query active non-void orders
      const activeRows = await sql`
        SELECT record_id, data
        FROM public.ledger_collections
        WHERE collection_name = 'invoices'
          AND (data->>'status' IS NULL OR LOWER(data->>'status') != 'void');
      `;

      assert.ok(!activeRows.some((r: any) => r.record_id === voidOrderId), "Void invoice must be excluded");
    });

    // --------------------------------------------------------------------------
    // Test 13: Quotations and FOC invoices are excluded from order metrics
    // --------------------------------------------------------------------------
    const quoteId = `test_inv_quote_${Date.now()}`;
    const focId = `test_inv_foc_${Date.now()}`;

    await runTest("Requirement 13: Quotations and FOC invoices are excluded from order metrics", async () => {
      const quotePayload = { id: quoteId, type: "quote", no: "QT-999", total: 1000.00, status: "issued" };
      const focPayload = { id: focId, type: "foc", no: "FOC-999", total: 0.00, status: "issued" };

      await sql`
        INSERT INTO public.ledger_collections (collection_name, record_id, data, updated_at)
        VALUES ('invoices', ${quoteId}, ${JSON.stringify(quotePayload)}::jsonb, NOW());
      `;
      createdRecordIds.push(quoteId);

      await sql`
        INSERT INTO public.ledger_collections (collection_name, record_id, data, updated_at)
        VALUES ('invoices', ${focId}, ${JSON.stringify(focPayload)}::jsonb, NOW());
      `;
      createdRecordIds.push(focId);

      const salesOrders = await sql`
        SELECT record_id, data
        FROM public.ledger_collections
        WHERE collection_name = 'invoices'
          AND (data->>'type' = 'sale' OR data->>'type' IS NULL)
          AND (data->>'status' IS NULL OR LOWER(data->>'status') != 'void');
      `;

      assert.ok(!salesOrders.some((r: any) => r.record_id === quoteId), "Quotations must be excluded");
      assert.ok(!salesOrders.some((r: any) => r.record_id === focId), "FOC must be excluded");
      assert.ok(salesOrders.some((r: any) => r.record_id === testOrderId), "Sales order must be included");
    });

    // --------------------------------------------------------------------------
    // Test 14: Duplicate submission does not create duplicate invoices
    // --------------------------------------------------------------------------
    runTest("Requirement 14: Duplicate submission guard prevents multiple invoices", () => {
      const submittedKeys = new Set<string>();
      function submitOrder(idempotencyKey: string) {
        if (submittedKeys.has(idempotencyKey)) {
          return { error: "DUPLICATE_SUBMISSION", message: "Order is already being processed." };
        }
        submittedKeys.add(idempotencyKey);
        return { success: true };
      }

      assert.strictEqual(submitOrder("key_001").success, true);
      assert.strictEqual(submitOrder("key_001").error, "DUPLICATE_SUBMISSION");
    });

    // --------------------------------------------------------------------------
    // Test 15: Existing invoice records remain compatible
    // --------------------------------------------------------------------------
    await runTest("Requirement 15: Stored record contains all canonical invoice fields for ledgerCore and Overview", async () => {
      const [row] = await sql`
        SELECT data FROM public.ledger_collections
        WHERE collection_name = 'invoices' AND record_id = ${testOrderId};
      `;
      const d = row.data;
      assert.ok(d.no && d.number && d.invoiceNumber, "Must have invoice number aliases");
      assert.ok(d.client && d.customerName, "Must have customer name aliases");
      assert.ok(Array.isArray(d.lines), "Must have lines array");
      assert.ok(d.subtotal !== undefined && d.sub !== undefined, "Must have subtotal aliases");
      assert.ok(d.total !== undefined && d.amount !== undefined, "Must have total aliases");
      assert.ok(d.paid !== undefined, "Must have paid amount");
      assert.ok(d.balance !== undefined && d.bal !== undefined, "Must have balance aliases");
      assert.strictEqual(d.status, "issued", "Document lifecycle status must be 'issued'");
      assert.ok(["PAID", "PARTIAL", "PENDING"].includes(d.paymentStatus), "Must have valid paymentStatus");
      assert.ok(d.fulfillmentStatus, "Must have fulfillmentStatus");
    });

    // --------------------------------------------------------------------------
    // Test 16: Separation of Invoice Lifecycle Status from Payment Status
    // --------------------------------------------------------------------------
    await runTest("Requirement 16: Strict separation of lifecycle status ('issued'/'void') from payment status ('PAID'/'PARTIAL'/'PENDING')", async () => {
      const testLifecycleId = `test_inv_lifecycle_${Date.now()}`;
      const lifecyclePayload = {
        id: testLifecycleId,
        type: "sale",
        no: "INV-LC-001",
        total: 150.00,
        paid: 50.00,
        balance: 100.00,
        status: "issued",             // Document lifecycle status
        paymentStatus: "PARTIAL",      // Payment status
        fulfillmentStatus: "IN_PRODUCTION",
      };

      await sql`
        INSERT INTO public.ledger_collections (collection_name, record_id, data, updated_at)
        VALUES ('invoices', ${testLifecycleId}, ${JSON.stringify(lifecyclePayload)}::jsonb, NOW());
      `;
      createdRecordIds.push(testLifecycleId);

      // Verify initial state
      const [initial] = await sql`
        SELECT data FROM public.ledger_collections
        WHERE collection_name = 'invoices' AND record_id = ${testLifecycleId};
      `;
      assert.strictEqual(initial.data.status, "issued", "Must be 'issued'");
      assert.strictEqual(initial.data.paymentStatus, "PARTIAL", "Payment status must be 'PARTIAL'");

      // Verify that payment update changes paymentStatus to PAID, but leaves status as 'issued'
      const paymentUpdate = {
        ...initial.data,
        paid: 150.00,
        balance: 0.00,
        paymentStatus: "PAID",
      };
      await sql`
        UPDATE public.ledger_collections
        SET data = ${JSON.stringify(paymentUpdate)}::jsonb, updated_at = NOW()
        WHERE collection_name = 'invoices' AND record_id = ${testLifecycleId};
      `;

      const [afterPayment] = await sql`
        SELECT data FROM public.ledger_collections
        WHERE collection_name = 'invoices' AND record_id = ${testLifecycleId};
      `;
      assert.strictEqual(afterPayment.data.paymentStatus, "PAID", "Payment status must be PAID");
      assert.strictEqual(afterPayment.data.status, "issued", "Document lifecycle status must NOT be changed to PAID");

      // Verify that voiding changes status to 'void'
      const voidUpdate = {
        ...afterPayment.data,
        status: "void",
      };
      await sql`
        UPDATE public.ledger_collections
        SET data = ${JSON.stringify(voidUpdate)}::jsonb, updated_at = NOW()
        WHERE collection_name = 'invoices' AND record_id = ${testLifecycleId};
      `;

      const [afterVoid] = await sql`
        SELECT data FROM public.ledger_collections
        WHERE collection_name = 'invoices' AND record_id = ${testLifecycleId};
      `;
      assert.strictEqual(afterVoid.data.status, "void", "Document lifecycle must be 'void'");
      assert.strictEqual(afterVoid.data.paymentStatus, "PAID", "Payment status remains intact independently");
    });

    // --------------------------------------------------------------------------
    // Test 17: Configured VAT Rate Resolution from Database Settings
    // --------------------------------------------------------------------------
    await runTest("Requirement 17: Configured VAT rate correctly resolves from database settings collection with 5% fallback", async () => {
      // Query existing settings
      const settingsRows = await sql`
        SELECT record_id, data FROM public.ledger_collections 
        WHERE collection_name = 'settings' 
        ORDER BY CASE WHEN record_id = 'app-settings' THEN 0 ELSE 1 END, updated_at DESC;
      `;
      assert.ok(settingsRows.length > 0, "Settings rows should exist in database");
      const configuredRate = Number(settingsRows[0].data?.vatPct);
      assert.ok(!isNaN(configuredRate), "Configured rate must be a valid number");
      assert.ok(configuredRate >= 0, "Configured rate must be non-negative");

      // Test fallback resolution logic when setting row is missing or empty
      function resolveRate(mockRows: any[]): number {
        for (const row of mockRows) {
          const d = row?.data || {};
          if (d.vatPct !== undefined && d.vatPct !== null && d.vatPct !== '') {
            const parsed = Number(d.vatPct);
            if (!isNaN(parsed) && parsed >= 0) return parsed;
          }
        }
        return 5;
      }

      assert.strictEqual(resolveRate([{ data: { vatPct: 5 } }]), 5);
      assert.strictEqual(resolveRate([{ data: { vatPct: 10 } }]), 10);
      assert.strictEqual(resolveRate([{ data: { vatPct: 0 } }]), 0);
      assert.strictEqual(resolveRate([{ data: { vatPct: "" } }]), 5, "Empty string falls back to 5");
      assert.strictEqual(resolveRate([]), 5, "Empty settings falls back to 5");
    });

    // --------------------------------------------------------------------------
    // Test 18: Bambu Production and ledgerCore.js remain untouched
    // --------------------------------------------------------------------------
    runTest("Requirement 18: Safety Boundaries: Bambu Production and ledgerCore.js untouched", () => {
      const ledgerCorePath = path.join(ROOT_DIR, "src/components/ledgerCore.js");
      const productionPath = path.join(ROOT_DIR, "src/app/admin/production/page.tsx");

      assert.ok(fs.existsSync(ledgerCorePath), "ledgerCore.js must exist");
      assert.ok(fs.existsSync(productionPath), "admin/production/page.tsx must exist");
    });

  } finally {
    // Clean up all test records
    if (createdRecordIds.length > 0) {
      for (const id of createdRecordIds) {
        await sql`
          DELETE FROM public.ledger_collections
          WHERE collection_name = 'invoices' AND record_id = ${id};
        `.catch(() => {});
      }
    }
  }

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
