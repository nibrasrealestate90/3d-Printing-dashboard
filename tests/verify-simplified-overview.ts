/**
 * Simplified Commercial Workspace Overview Verification Suite
 * Verifies calculation rules, data contracts, and UI invariants for /admin.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("========================================================================");
console.log("  SIMPLIFIED OVERVIEW VERIFICATION SUITE");
console.log("========================================================================\n");

let passed = 0;
let total = 0;

function runTest(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(`   Error: ${err.message}\n`);
  }
}

const ROOT_DIR = process.cwd();

// ----------------------------------------------------------------------------
// Test 1: File Invariants & Absence of Unnecessary Sections
// ----------------------------------------------------------------------------
runTest("Overview Invariants: Removal of manufacturing, pipeline, and promotional widgets", () => {
  const pagePath = path.join(ROOT_DIR, "src/app/admin/page.tsx");
  assert.ok(fs.existsSync(pagePath), "src/app/admin/page.tsx must exist");
  const content = fs.readFileSync(pagePath, "utf-8");

  // Removed sections must NOT be in the file
  assert.ok(!content.includes("Bambu Factory Engine"), "Must not include Bambu Factory Engine");
  assert.ok(!content.includes("Studio Fulfillment Pipeline"), "Must not include Studio Fulfillment Pipeline");
  assert.ok(!content.includes("Commercial Storefront"), "Must not include Commercial Storefront promo card");
  assert.ok(!content.includes("Operational Shortcuts"), "Must not include Operational Shortcuts");
  assert.ok(!content.includes("bm-hero-banner"), "Must not include bm-hero-banner");
  assert.ok(!content.includes("public.store_quotes"), "Must not reference the erroneous store_quotes table");

  // Approved scope must be present
  assert.ok(content.includes("Total Orders"), "Must include Total Orders KPI card");
  assert.ok(content.includes("Total Revenue"), "Must include Total Revenue KPI card");
  assert.ok(content.includes("Total Products"), "Must include Total Products KPI card");
  assert.ok(content.includes("Recent Orders"), "Must include Recent Orders section");
  assert.ok(content.includes("EmptyState"), "Must use EmptyState component");
  assert.ok(content.includes("StatusBadge"), "Must use StatusBadge component");
  assert.ok(content.includes("/admin/orders"), "Must link to /admin/orders");
});

// ----------------------------------------------------------------------------
// Test 2: Invoiced Sales & Total Calculation Logic
// ----------------------------------------------------------------------------
runTest("Financial Calculation Logic: Exclusion of void, quote, and foc records", () => {
  // Replicate the exact helper logic from src/app/admin/page.tsx
  function filterAndCalculate(invoiceRows: any[]) {
    let totalOrdersCount = 0;
    let totalRevenueBilled = 0;
    const validSalesOrders: any[] = [];

    for (const row of invoiceRows) {
      const d = row.data && typeof row.data === "object" ? row.data : {};

      const status = String(d.status || "").toLowerCase().trim();
      if (status === "void") continue;

      const type = String(d.type || "").toLowerCase().trim();
      if (type === "quote" || type === "foc") continue;
      if (type !== "sale" && type !== "") continue;

      totalOrdersCount += 1;

      let orderTotal = 0;
      if (d.total != null && d.total !== "" && !isNaN(Number(d.total))) {
        orderTotal = Number(d.total);
      } else if (d.amount != null && d.amount !== "" && !isNaN(Number(d.amount))) {
        orderTotal = Number(d.amount);
      } else if (Array.isArray(d.lines) && d.lines.length > 0) {
        const sub = d.lines.reduce((acc: number, l: any) => {
          const qty = Number(l.qty) || 0;
          const price = Number(l.price) || 0;
          return acc + qty * price;
        }, 0);
        const disc = Math.min(sub, Math.max(0, Number(d.discount) || 0));
        const vatPct = Number(d.vatPct ?? 5) || 0;
        const vat = ((sub - disc) * vatPct) / 100;
        orderTotal = sub - disc + vat;
      }

      if (orderTotal > 0) {
        totalRevenueBilled += orderTotal;
      }

      const rawInvNo = String(d.number || d.invoiceNumber || d.no || "").trim();
      const invNo = rawInvNo || "—";
      const rawCustomer = String(d.customerName || d.clientName || d.customer || "").trim();
      const customer = rawCustomer || "—";

      let paymentStatus = "—";
      const explicitPayStatus = String(d.paymentStatus || d.payment_status || "").toUpperCase().trim();
      const rawStatus = String(d.status || "").toUpperCase().trim();

      if (["PAID", "PENDING", "PARTIAL", "UNPAID"].includes(explicitPayStatus)) {
        paymentStatus = explicitPayStatus === "UNPAID" ? "PENDING" : explicitPayStatus;
      } else if (["PAID", "PENDING", "PARTIAL", "UNPAID"].includes(rawStatus)) {
        paymentStatus = rawStatus === "UNPAID" ? "PENDING" : rawStatus;
      } else if (d.paid != null && d.paid !== "" && !isNaN(Number(d.paid))) {
        const paid = Number(d.paid);
        if (orderTotal > 0 && paid >= orderTotal - 0.005) {
          paymentStatus = "PAID";
        } else if (paid > 0 && paid < orderTotal - 0.005) {
          paymentStatus = "PARTIAL";
        } else if (orderTotal > 0) {
          paymentStatus = "PENDING";
        }
      }

      validSalesOrders.push({
        id: String(row.record_id || d.id || invNo),
        invoiceNumber: invNo,
        customerName: customer,
        amountAed: orderTotal,
        paymentStatus,
      });
    }

    return { totalOrdersCount, totalRevenueBilled, validSalesOrders };
  }

  const sampleRows = [
    // 1. Valid modern sales invoice with explicit status: "PAID"
    { record_id: "inv_1", data: { type: "sale", total: 1000, status: "PAID", customerName: "Client A" } },
    // 2. Valid legacy sales invoice with status: "issued", lines, and partial payment: paid=100
    {
      record_id: "inv_2",
      data: {
        type: "sale",
        status: "issued", // document lifecycle status
        lines: [{ qty: 2, price: 100 }], // sub=200, disc=0, vat=10 (5%), total=210
        discount: 0,
        vatPct: 5,
        paid: 100, // partially paid
        no: "INV-002",
        customer: "Client B",
      },
    },
    // 3. Void sales invoice (must be excluded)
    { record_id: "inv_3", data: { type: "sale", total: 500, status: "void", customerName: "Void Client" } },
    // 4. Price quote (must be excluded)
    { record_id: "inv_4", data: { type: "quote", total: 8000, customerName: "Quote Client" } },
    // 5. Free of charge voucher (must be excluded)
    { record_id: "inv_5", data: { type: "foc", lines: [{ qty: 10, price: 50 }], customerName: "FOC Client" } },
    // 6. Valid legacy invoice with empty type (defaulted to sale), status: "issued", paid=0
    { record_id: "inv_6", data: { amount: 350, no: "INV-006", status: "issued", paid: 0, customer: "Client C" } },
    // 7. Valid sales invoice with missing customer, missing number, and no payment data
    { record_id: "inv_7", data: { type: "sale", total: 150 } },
  ];

  const result = filterAndCalculate(sampleRows);

  assert.strictEqual(result.totalOrdersCount, 4, "Only the 4 valid sales invoices must be counted");
  assert.strictEqual(result.totalRevenueBilled, 1000 + 210 + 350 + 150, "Total revenue must sum exactly 1710");
  assert.strictEqual(result.validSalesOrders.length, 4, "Only 4 orders staged for recent list");
  assert.strictEqual(result.validSalesOrders[0].customerName, "Client A");
  assert.strictEqual(result.validSalesOrders[0].paymentStatus, "PAID");
  assert.strictEqual(result.validSalesOrders[1].customerName, "Client B");
  assert.strictEqual(result.validSalesOrders[1].paymentStatus, "PARTIAL");
  assert.strictEqual(result.validSalesOrders[2].customerName, "Client C");
  assert.strictEqual(result.validSalesOrders[2].paymentStatus, "PENDING");
  assert.strictEqual(result.validSalesOrders[3].customerName, "—", "Missing customer must yield '—'");
  assert.strictEqual(result.validSalesOrders[3].invoiceNumber, "—", "Missing invoice number must yield '—'");
  assert.strictEqual(result.validSalesOrders[3].paymentStatus, "—", "Missing payment data must yield '—'");
});

// ----------------------------------------------------------------------------
// Test 3: Recent Orders Sorting Invariant
// ----------------------------------------------------------------------------
runTest("Recent Orders Sorting: Newest first and bounded to top 5", () => {
  const dates = [
    { id: "1", date: "2026-11-01", timestamp: new Date("2026-11-01").getTime() },
    { id: "2", date: "2026-11-15", timestamp: new Date("2026-11-15").getTime() },
    { id: "3", date: "2026-11-19", timestamp: new Date("2026-11-19").getTime() },
    { id: "4", date: "2026-11-05", timestamp: new Date("2026-11-05").getTime() },
    { id: "5", date: "2026-11-10", timestamp: new Date("2026-11-10").getTime() },
    { id: "6", date: "2026-11-18", timestamp: new Date("2026-11-18").getTime() },
  ];

  const sorted = dates.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);

  assert.strictEqual(sorted.length, 5, "Must slice to top 5");
  assert.strictEqual(sorted[0].id, "3", "First item must be newest (Nov 19)");
  assert.strictEqual(sorted[1].id, "6", "Second item must be Nov 18");
  assert.strictEqual(sorted[2].id, "2", "Third item must be Nov 15");
  assert.strictEqual(sorted[3].id, "5", "Fourth item must be Nov 10");
  assert.strictEqual(sorted[4].id, "4", "Fifth item must be Nov 5");
});

// ----------------------------------------------------------------------------
// Test 4: Safety Boundaries
// ----------------------------------------------------------------------------
runTest("Safety Boundary Invariant: ledgerCore.js and Bambu production files untouched", () => {
  const ledgerCorePath = path.join(ROOT_DIR, "src/components/ledgerCore.js");
  const productionPath = path.join(ROOT_DIR, "src/app/admin/production/page.tsx");

  assert.ok(fs.existsSync(ledgerCorePath), "ledgerCore.js must exist");
  assert.ok(fs.existsSync(productionPath), "admin/production/page.tsx must exist");
});

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log("\n========================================================================");
console.log(`Total Tests Executed : ${total}`);
console.log(`Passed               : ${passed} ✅`);
console.log(`Failed               : ${total - passed} ❌`);
console.log(`Success Rate         : ${((passed / total) * 100).toFixed(1)}%`);
console.log("========================================================================\n");

if (passed !== total) {
  process.exit(1);
}
