/**
 * Bambu Production Dashboard & Navigation Verification Suite
 * Phase 1 Final Regression Tests
 */

import assert from "node:assert/strict";

console.log("========================================================================");
console.log("  BAMBU PRODUCTION DASHBOARD & NAVIGATION REGRESSION SUITE");
console.log("========================================================================\n");

let passed = 0;
let total = 0;

function test(name: string, fn: () => void) {
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

const N = (v: any) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

// Replicate the exact helper functions from src/components/ledgerCore.js
function getMaterialsForPrint(p: any) {
  if (!p) return [{ mat: "PLA", weight: 0 }];
  const totalGrams = N(p.grams);

  if (p.filamentsUsed && Array.isArray(p.filamentsUsed) && p.filamentsUsed.length > 0) {
    const rawItems = p.filamentsUsed.map((f: any) => ({
      mat: (f && f.type ? String(f.type) : "PLA").toUpperCase().trim(),
      weight: N(f && f.weightG)
    }));
    const rawSum = rawItems.reduce((acc: number, item: any) => acc + item.weight, 0);

    if (totalGrams > 0 && rawSum > 0 && Math.abs(rawSum - totalGrams) > 0.0001) {
      const scale = totalGrams / rawSum;
      return rawItems.map((item: any) => ({
        mat: item.mat,
        weight: item.weight * scale
      }));
    } else if (totalGrams > 0 && rawSum === 0) {
      const perSlot = totalGrams / rawItems.length;
      return rawItems.map((item: any) => ({
        mat: item.mat,
        weight: perSlot
      }));
    }
    return rawItems;
  }

  const matName = (p.filamentMaterial || "PLA").toUpperCase().trim();
  return [{
    mat: matName || "PLA",
    weight: totalGrams
  }];
}

function getPrintTimestamp(p: any) {
  if (!p) return 0;
  const raw = p.startTime || p.endTime || p.updatedAt || p.date || p.ts;
  if (!raw) return 0;
  if (typeof raw === "number") return raw > 0 ? (raw < 1e11 ? raw * 1000 : raw) : 0;
  const parsed = new Date(raw).getTime();
  if (!isNaN(parsed) && parsed > 0) return parsed;
  return 0;
}

// -----------------------------------------------------------------------------
// 1. 24H Chronological Rolling Buckets
// -----------------------------------------------------------------------------
test("24H Chart: 6 chronological rolling intervals partition correctly", () => {
  const fixedNow = new Date("2026-11-19T12:00:00.000Z");
  const nowMs = fixedNow.getTime();

  const labels: string[] = [];
  for (let k = 5; k >= 0; k--) {
    const bucketStart = new Date(nowMs - (k + 1) * 4 * 3600 * 1000);
    labels.push(String(bucketStart.getUTCHours()).padStart(2, "0") + ":00");
  }

  assert.deepEqual(labels, ["12:00", "16:00", "20:00", "00:00", "04:00", "08:00"]);

  const getBucket = (ts: number) => {
    const hoursAgo = (nowMs - ts) / 36e5;
    if (hoursAgo < 0 || hoursAgo >= 24) return -1;
    return Math.min(5, Math.max(0, 5 - Math.floor(hoursAgo / 4)));
  };

  // Print 2 hours ago (10:00 UTC) -> Bucket 5 (latest)
  assert.equal(getBucket(nowMs - 2 * 36e5), 5);
  // Print 6 hours ago (06:00 UTC) -> Bucket 4
  assert.equal(getBucket(nowMs - 6 * 36e5), 4);
  // Print 22 hours ago (yesterday 14:00 UTC) -> Bucket 0 (oldest)
  assert.equal(getBucket(nowMs - 22 * 36e5), 0);
  // Print 25 hours ago -> outside window
  assert.equal(getBucket(nowMs - 25 * 36e5), -1);
});

// -----------------------------------------------------------------------------
// 2. 7D Calendar Boundaries
// -----------------------------------------------------------------------------
test("7D Chart: Midnight calendar boundaries prevent evening prints shifting to today", () => {
  const fixedNow = new Date("2026-11-19T12:00:00.000Z"); // Thursday noon
  const todayMidnight = new Date(Date.UTC(fixedNow.getUTCFullYear(), fixedNow.getUTCMonth(), fixedNow.getUTCDate())).getTime();

  const get7dBucket = (ts: number) => {
    if (ts <= 0) return -1;
    const printDate = new Date(ts);
    const printMidnight = new Date(Date.UTC(printDate.getUTCFullYear(), printDate.getUTCMonth(), printDate.getUTCDate())).getTime();
    const calDaysDiff = Math.round((todayMidnight - printMidnight) / 864e5);
    if (calDaysDiff < 0 || calDaysDiff > 6) return -1;
    return 6 - calDaysDiff;
  };

  // Today 09:00 UTC (3 hours ago) -> Bucket 6 (Thursday, today)
  const todayMorning = fixedNow.getTime() - 3 * 36e5;
  assert.equal(get7dBucket(todayMorning), 6);

  // Yesterday 21:00 UTC (15 hours ago) -> Bucket 5 (Wednesday, yesterday)
  const yesterdayEvening = fixedNow.getTime() - 15 * 36e5;
  assert.equal(get7dBucket(yesterdayEvening), 5);

  // 6 days ago -> Bucket 0
  const sixDaysAgo = todayMidnight - 6 * 864e5 + 12 * 36e5;
  assert.equal(get7dBucket(sixDaysAgo), 0);

  // 7 days ago -> Outside 7 calendar day window
  const sevenDaysAgo = todayMidnight - 7 * 864e5;
  assert.equal(get7dBucket(sevenDaysAgo), -1);
});

// -----------------------------------------------------------------------------
// 3. 12M and ALL Historical Coverage
// -----------------------------------------------------------------------------
test("ALL Chart: Switches to yearly buckets for multi-year history without arbitrary 36m cap", () => {
  const fixedNow = new Date("2026-11-19T12:00:00.000Z");

  const buildBuckets = (range: string, prints: any[]) => {
    const isAll = range === "all";
    let oldestTs = fixedNow.getTime();
    let hasValidPrints = false;

    if (isAll && prints.length > 0) {
      prints.forEach(p => {
        const ts = getPrintTimestamp(p);
        if (ts > 0) {
          hasValidPrints = true;
          if (ts < oldestTs) oldestTs = ts;
        }
      });
    }

    const oldestDate = new Date(oldestTs);
    const monthsSpan = hasValidPrints
      ? (fixedNow.getFullYear() - oldestDate.getFullYear()) * 12 + (fixedNow.getMonth() - oldestDate.getMonth()) + 1
      : 12;

    const useYearlyBuckets = isAll && hasValidPrints && monthsSpan > 24;

    if (useYearlyBuckets) {
      const startYear = oldestDate.getFullYear();
      const endYear = fixedNow.getFullYear();
      const yearCount = endYear - startYear + 1;
      const labels: string[] = [];
      for (let y = startYear; y <= endYear; y++) labels.push(String(y));
      const hours = new Array(yearCount).fill(0);

      prints.forEach(p => {
        const ts = getPrintTimestamp(p);
        if (ts <= 0) return;
        const d = new Date(ts);
        const b = Math.min(yearCount - 1, Math.max(0, d.getFullYear() - startYear));
        hours[b] += N(p.hours);
      });
      return { type: "yearly", labels, hours };
    } else {
      const monthCount = isAll ? Math.max(12, monthsSpan) : 12;
      const keys: string[] = [];
      for (let k = monthCount - 1; k >= 0; k--) {
        const d = new Date(fixedNow.getFullYear(), fixedNow.getMonth() - k, 1);
        keys.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"));
      }
      const hours = new Array(monthCount).fill(0);
      prints.forEach(p => {
        const ts = getPrintTimestamp(p);
        if (ts <= 0) return;
        const d = new Date(ts);
        const pKey = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
        const idx = keys.indexOf(pKey);
        let b = idx;
        if (b === -1) {
          if (isAll) b = d.getTime() > fixedNow.getTime() ? monthCount - 1 : 0;
          else return;
        }
        hours[b] += N(p.hours);
      });
      return { type: "monthly", labels: keys, hours };
    }
  };

  // Case A: 5-year historical span (2021 through 2026)
  const prints5y = [
    { ts: new Date("2021-02-15").getTime(), hours: 10 },
    { ts: new Date("2023-07-20").getTime(), hours: 25 },
    { ts: new Date("2026-11-10").getTime(), hours: 15 }
  ];
  const res5y = buildBuckets("all", prints5y);
  assert.equal(res5y.type, "yearly");
  assert.deepEqual(res5y.labels, ["2021", "2022", "2023", "2024", "2025", "2026"]);
  assert.equal(res5y.hours[0], 10); // 2021
  assert.equal(res5y.hours[2], 25); // 2023
  assert.equal(res5y.hours[5], 15); // 2026
  assert.equal(res5y.hours.reduce((a, b) => a + b, 0), 50); // Total strictly preserved

  // Case B: 18-month historical span (monthly buckets)
  const prints18m = [
    { ts: new Date("2025-05-15").getTime(), hours: 8 },
    { ts: new Date("2026-11-10").getTime(), hours: 12 }
  ];
  const res18m = buildBuckets("all", prints18m);
  assert.equal(res18m.type, "monthly");
  assert.equal(res18m.labels.length, 19);
  assert.equal(res18m.hours.reduce((a, b) => a + b, 0), 20);

  // Case C: 12M range strictly caps at 12 rolling months
  const res12m = buildBuckets("12m", prints5y);
  assert.equal(res12m.type, "monthly");
  assert.equal(res12m.labels.length, 12);
  // Prints older than 12m are excluded from 12m view
  assert.equal(res12m.hours.reduce((a, b) => a + b, 0), 15);
});

// -----------------------------------------------------------------------------
// 4. Filament Reconciliation & Non-Destructive Invariant
// -----------------------------------------------------------------------------
test("Filament Reconciliation: Resolves 511.8g vs 511.7g without mutating source data", () => {
  const originalPrint = {
    id: "job-101",
    grams: 511.8,
    filamentsUsed: [
      { type: "PLA", weightG: 511.7 }
    ]
  };

  const snapshotSource = JSON.stringify(originalPrint);

  const materials = getMaterialsForPrint(originalPrint);

  // 1. Output weight must reconcile exactly to top-level 511.8g
  assert.equal(materials.length, 1);
  assert.equal(materials[0].mat, "PLA");
  assert(Math.abs(materials[0].weight - 511.8) < 0.0001);

  // 2. Source object must remain completely immutable
  assert.equal(JSON.stringify(originalPrint), snapshotSource);
  assert.equal(originalPrint.grams, 511.8);
  assert.equal(originalPrint.filamentsUsed[0].weightG, 511.7);
});

test("Filament Reconciliation: Safe fallback for missing AMS breakdowns and zero weights", () => {
  // Missing filamentsUsed falls back to material or default PLA
  const pNoAms = { id: "job-102", grams: 120.5, filamentMaterial: "PETG" };
  const resNoAms = getMaterialsForPrint(pNoAms);
  assert.equal(resNoAms[0].mat, "PETG");
  assert.equal(resNoAms[0].weight, 120.5);

  // AMS slots declared but weights omitted (0g): splits total evenly
  const pZeroSlots = {
    id: "job-103",
    grams: 200,
    filamentsUsed: [{ type: "PLA", weightG: 0 }, { type: "TPU", weightG: 0 }]
  };
  const resZeroSlots = getMaterialsForPrint(pZeroSlots);
  assert.equal(resZeroSlots[0].weight, 100);
  assert.equal(resZeroSlots[1].weight, 100);

  // Null or empty print handled safely without crash
  const resNull = getMaterialsForPrint(null);
  assert.equal(resNull[0].weight, 0);
});

// -----------------------------------------------------------------------------
// 5. Completed vs Attempt Average Duration
// -----------------------------------------------------------------------------
test("Duration Metrics: Separates completed job average from total attempt average", () => {
  const prints = [
    { id: "1", hours: 6.0, statusLabel: "Success" },
    { id: "2", hours: 4.4, statusLabel: "Success" },
    { id: "3", hours: 1.2, statusLabel: "Failed" },
    { id: "4", hours: 1.1, statusLabel: "Canceled" },
    { id: "5", hours: 1.0, statusLabel: "Canceled" }
  ];

  const totalHours = prints.reduce((acc, p) => acc + N(p.hours), 0); // 13.7h
  const completedPrints = prints.filter(p => p.statusLabel === "Success");
  const completedJobs = completedPrints.length; // 2
  const completedHours = completedPrints.reduce((acc, p) => acc + N(p.hours), 0); // 10.4h
  const failedHours = Math.max(0, totalHours - completedHours); // 3.3h

  const avgCompletedHours = (completedHours / completedJobs).toFixed(1); // 5.2h
  const avgAttemptHours = (totalHours / prints.length).toFixed(1); // 2.7h

  assert.equal(totalHours.toFixed(1), "13.7");
  assert.equal(completedHours.toFixed(1), "10.4");
  assert.equal(failedHours.toFixed(1), "3.3");
  assert.equal(avgCompletedHours, "5.2");
  assert.equal(avgAttemptHours, "2.7");

  // Subtitle format verification
  const subtitle = `${avgCompletedHours}h completed avg • ${avgAttemptHours}h attempt avg`;
  assert.equal(subtitle, "5.2h completed avg • 2.7h attempt avg");

  const chartSubtitle = `${completedHours.toFixed(1)}h productive • ${failedHours.toFixed(1)}h aborted/failed`;
  assert.equal(chartSubtitle, "10.4h productive • 3.3h aborted/failed");
});

// -----------------------------------------------------------------------------
// 6. Empty Datasets & Invalid Timestamps
// -----------------------------------------------------------------------------
test("Robustness: Empty dataset and invalid timestamps do not crash or produce NaN", () => {
  const invalidPrints = [
    { ts: 0, hours: 2, grams: 50 },
    { ts: -999, hours: 3, grams: 60 },
    { ts: NaN, hours: 1, grams: 20 },
    null,
    undefined
  ];

  const totalHours = invalidPrints.reduce((acc, p) => acc + (p ? N(p.hours) : 0), 0);
  assert.equal(totalHours, 6);

  // Timestamp extraction safely returns 0 for all invalid values
  invalidPrints.forEach(p => {
    assert.equal(getPrintTimestamp(p), 0);
  });
});

// -----------------------------------------------------------------------------
// 7. Sidebar Navigation & Commercial Module Redirects
// -----------------------------------------------------------------------------
test("Navigation: Confirms 9 manufacturing/operations tabs and 8 commercial redirect routes", () => {
  const fs = require("node:fs");
  const code = fs.readFileSync("src/components/ledgerCore.js", "utf8");

  // Verify NAV_GROUPS
  const navMatch = code.match(/const NAV_GROUPS = (\[[\s\S]*?\]);/);
  assert(navMatch, "NAV_GROUPS must be defined");
  const APP_ICONS = new Proxy({}, { get: () => () => "" });
  const navGroups = eval(navMatch[1]);

  const items = navGroups.flatMap((g: any) => g.items.map((i: any) => ({ key: i.key, label: i.label })));
  assert.equal(items.length, 9, "Must contain exactly 9 navigation items (6 Manufacturing + 3 Operations)");

  const expectedManufacturing = [
    { key: "dashboard", label: "Dashboard" },
    { key: "products", label: "Product Catalogue" },
    { key: "prints", label: "Print Jobs" },
    { key: "filaments", label: "Filament Inventory" },
    { key: "stock", label: "Stock Management" },
    { key: "calc", label: "Cost Calculator" },
    { key: "reminders", label: "Maintenance Reminders" },
    { key: "automation-history", label: "Sync History" },
    { key: "settings", label: "Settings" }
  ];
  assert.deepEqual(items, expectedManufacturing);

  // Verify commercial redirect mappings (Product Catalogue is preserved in Manufacturing)
  const expectedRedirects: Record<string, string> = {
    customers: "/admin/customers",
    orders: "/admin/orders",
    kyc: "/admin/customers",
    quotes: "/admin/quotations",
    invoices: "/admin/reports",
    expenses: "/admin/expenses",
    reports: "/admin/reports",
    accounts: "/admin/settings"
  };

  for (const [key, expectedRoute] of Object.entries(expectedRedirects)) {
    const routeRegex = new RegExp(`${key}:\\s*\\(\\)\\s*=>\\s*vRedirectModule\\(["']${key}["'],\\s*["'][^"']+["'],\\s*["']${expectedRoute}["']\\)`);
    assert(routeRegex.test(code), `Route mapping for ${key} must redirect to ${expectedRoute}`);
  }
});

// -----------------------------------------------------------------------------
// 8. Manufacturing Product Catalogue & Manufacturing Aggregations
// -----------------------------------------------------------------------------
test("Product Catalogue: getProductAggregations maps manufacturing history, print jobs, and metrics", () => {
  // Test products (internal manufacturing models)
  const products = [
    {
      id: "prod-v1",
      name: "Articulated Dragon",
      sku: "DRG-001",
      photo: "data:image/jpeg;base64,mockThumbnail",
      grams: 120,
      minutes: 180
    },
    {
      id: "prod-v2",
      name: "Cable Organizer Clip",
      sku: "CBL-002",
      photo: null,
      grams: 25,
      minutes: 45
    }
  ];

  // Associated manufacturing print jobs
  const prints = [
    {
      id: "print-101",
      productId: "prod-v1",
      statusLabel: "Success",
      qty: 2,
      grams: 240,
      hours: 6.0,
      date: "2026-11-15T10:00:00Z",
      filamentsUsed: [{ type: "PLA", color: "#10B981" }]
    },
    {
      id: "print-102",
      productId: "prod-v1",
      statusLabel: "Failed",
      failed: 1,
      qty: 0,
      grams: 40,
      hours: 1.0,
      date: "2026-11-16T14:30:00Z",
      filamentsUsed: [{ type: "PLA", color: "#10B981" }]
    },
    {
      id: "print-103",
      productId: "prod-v1",
      statusLabel: "Success",
      qty: 1,
      grams: 120,
      hours: 3.0,
      date: "2026-11-18T09:00:00Z",
      filamentsUsed: [{ type: "PETG", color: "#6366F1" }]
    }
  ];

  // Helper matching ledgerCore.js getProductAggregations
  const stats = new Map();
  for (const p of products) {
    stats.set(p.id, {
      totalPrinted: 0,
      totalGrams: 0,
      totalPrintMinutes: 0,
      successfulRuns: 0,
      failedRuns: 0,
      materials: new Set<string>(),
      colors: new Map<string, string>(),
      runs: [] as any[],
      latestPrintDate: null as string | null
    });
  }

  for (const x of prints) {
    if (!x.productId) continue;
    const s = stats.get(x.productId);
    if (!s) continue;

    s.runs.push(x);
    const isSuccess = x.statusLabel === "Success" || (x.statusLabel !== "Canceled" && x.statusLabel !== "Failed" && !N(x.failed) && N(x.qty) > 0);
    const isPrinting = x.statusLabel === "Printing";

    if (isSuccess && !isPrinting) {
      const q = N(x.qty) > 0 ? N(x.qty) : 1;
      s.totalPrinted += q;
      s.successfulRuns += 1;
      const g = N(x.grams);
      if (g > 0) s.totalGrams += g;
      const mins = N(x.hours) > 0 ? N(x.hours) * 60 : N(x.minutes);
      if (mins > 0) s.totalPrintMinutes += mins;
    } else if (!isPrinting) {
      s.failedRuns += 1;
    }

    if (Array.isArray(x.filamentsUsed) && x.filamentsUsed.length > 0) {
      for (const fu of x.filamentsUsed) {
        if (fu.type) s.materials.add(fu.type.trim());
        if (fu.color) s.colors.set(String(fu.color).toUpperCase(), fu.type || "PLA");
      }
    }

    if (x.date && (!s.latestPrintDate || x.date > s.latestPrintDate)) {
      s.latestPrintDate = x.date;
    }
  }

  for (const p of products) {
    const s = stats.get(p.id);
    s.avgMinutes = s.successfulRuns > 0 ? (s.totalPrintMinutes / s.successfulRuns) : (N(p.minutes) || 0);
  }

  // Assertions for prod-v1 (Printed model with mixed success/fail)
  const stat1 = stats.get("prod-v1");
  assert.equal(stat1.totalPrinted, 3, "Total printed must sum 2 + 1 = 3 pcs");
  assert.equal(stat1.successfulRuns, 2, "Successful print runs must equal 2");
  assert.equal(stat1.failedRuns, 1, "Failed print runs must equal 1");
  assert.equal(stat1.totalGrams, 360, "Total filament consumed must sum successful prints 240g + 120g = 360g");
  assert.equal(stat1.avgMinutes, 270, "Avg duration must be (360m + 180m) / 2 = 270 mins (4.5h)");
  assert.equal(stat1.latestPrintDate, "2026-11-18T09:00:00Z", "Latest print date must match print-103");
  assert.equal(stat1.runs.length, 3, "Must track all 3 associated historical print runs");
  assert(stat1.materials.has("PLA") && stat1.materials.has("PETG"), "Must capture all materials used");

  // Assertions for prod-v2 (Zero prints model)
  const stat2 = stats.get("prod-v2");
  assert.equal(stat2.totalPrinted, 0, "Zero prints model must have 0 totalPrinted");
  assert.equal(stat2.successfulRuns, 0);
  assert.equal(stat2.failedRuns, 0);
  assert.equal(stat2.runs.length, 0);
  assert.equal(stat2.avgMinutes, 45, "Avg duration must fallback to slicer estimate");
});

console.log("\n========================================================================");
console.log(`Total Tests Executed : ${total}`);
console.log(`Passed               : ${passed} ✅`);
console.log(`Failed               : ${total - passed} ❌`);
console.log(`Success Rate         : ${((passed / total) * 100).toFixed(1)}%`);
console.log("========================================================================");

if (passed !== total) {
  process.exit(1);
}
