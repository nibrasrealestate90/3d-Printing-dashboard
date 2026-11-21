import assert from "assert";
import {
  parseExpenseAmountToCents,
  expenseCentsToAmount,
  formatExpenseAED,
  DEFAULT_EXPENSE_CATEGORY_DEFINITIONS,
  getStartEndForPeriod,
  getFilteredExpenses,
  calculateExpenseKPIs,
} from "../src/components/ledgerCore.js";

import {
  determineTrendGranularity,
  buildTrendBuckets,
  generateExpenseTrendData,
  generateCategoryDistributionData,
  generateCategoryComparisonData,
  parseYMD,
  formatYMD,
  addDaysYMD,
  getDaysDiff,
  formatDailyLabel,
  formatWeeklyLabel,
  formatMonthlyLabel,
} from "../src/lib/expenseAnalytics";

console.log("========================================================================");
console.log("  TASK 4: EXPENSE ANALYTICS & VISUALIZATION TEST SUITE");
console.log("========================================================================");

let passedCount = 0;
function pass(desc: string) {
  passedCount++;
  console.log(` ✅ [PASS ${passedCount}] ${desc}`);
}

// ============================================================================
// 1. FINANCIAL PRECISION & ARITHMETIC IN ANALYTICS
// ============================================================================
console.log("\n--- 1. Financial Precision & Integer Cents ---");

// Test 1.1: Precision cases: 0.10 + 0.20 = 0.30
{
  const expList = [
    { id: "e1", amount: 0.10, date: "2026-11-10", category: "Filament & Materials" },
    { id: "e2", amount: 0.20, date: "2026-11-10", category: "Filament & Materials" },
  ];
  const trend = generateExpenseTrendData(expList, {
    range: "custom",
    startDate: "2026-11-01",
    endDate: "2026-11-15",
  });
  assert.strictEqual(trend.totalCents, BigInt(30));
  assert.strictEqual(trend.totalAmount, 0.30);
  assert.strictEqual(trend.totalFormatted, "AED 0.30");

  const dist = generateCategoryDistributionData(expList);
  assert.strictEqual(dist.totalCents, BigInt(30));
  assert.strictEqual(dist.totalAmount, 0.30);
  assert.strictEqual(dist.items[0].cents, BigInt(30));
  assert.strictEqual(dist.items[0].amount, 0.30);
  pass("0.10 + 0.20 evaluates to exactly 0.30 AED with zero floating point drift");
}

// Test 1.2: 19.99 + 0.01 = 20.00
{
  const expList = [
    { id: "e1", amount: "19.99", date: "2026-11-05", category: "Spare Parts & Accessories" },
    { id: "e2", amount: 0.01, date: "2026-11-05", category: "Spare Parts & Accessories" },
  ];
  const trend = generateExpenseTrendData(expList, {
    range: "custom",
    startDate: "2026-11-01",
    endDate: "2026-11-10",
  });
  assert.strictEqual(trend.totalCents, BigInt(2000));
  assert.strictEqual(trend.totalAmount, 20.00);
  assert.strictEqual(trend.totalFormatted, "AED 20.00");
  pass("19.99 + 0.01 evaluates to exactly 20.00 AED");
}

// Test 1.3: Multi micro-transaction accumulation (100 * 0.01 = 1.00)
{
  const expList = Array.from({ length: 100 }, (_, i) => ({
    id: `m_${i}`,
    amount: "0.01",
    date: "2026-11-12",
    category: "Electricity & Utilities",
  }));
  const trend = generateExpenseTrendData(expList, {
    range: "custom",
    startDate: "2026-11-10",
    endDate: "2026-11-15",
  });
  assert.strictEqual(trend.totalCents, BigInt(100));
  assert.strictEqual(trend.totalAmount, 1.00);
  assert.strictEqual(trend.totalFormatted, "AED 1.00");
  pass("100 micro-transactions of 0.01 evaluate to exactly 1.00 AED with zero drift");
}

// Test 1.4: Large financial amount (10,000,000.00)
{
  const expList = [
    { id: "e_large", amount: 10000000.00, date: "2026-11-10", category: "Rent & Workspace" },
  ];
  const trend = generateExpenseTrendData(expList, {
    range: "custom",
    startDate: "2026-11-01",
    endDate: "2026-11-15",
  });
  assert.strictEqual(trend.totalCents, BigInt(1000000000));
  assert.strictEqual(trend.totalAmount, 10000000.00);
  assert.strictEqual(trend.totalFormatted, "AED 10,000,000.00");
  pass("Large financial amount of 10,000,000.00 AED handled with exact precision");
}

// ============================================================================
// 2. TREND GRANULARITY DETERMINATION
// ============================================================================
console.log("\n--- 2. Trend Granularity Determination ---");

// Test 2.1: Pre-defined short ranges evaluate to daily
assert.strictEqual(determineTrendGranularity("today"), "daily");
assert.strictEqual(determineTrendGranularity("7d"), "daily");
assert.strictEqual(determineTrendGranularity("30d"), "daily");
assert.strictEqual(determineTrendGranularity("this_month"), "daily");
assert.strictEqual(determineTrendGranularity("last_month"), "daily");
pass("today, 7d, 30d, this_month, and last_month resolve to daily granularity");

// Test 2.2: Custom range granularity scaling
assert.strictEqual(determineTrendGranularity("custom", "2026-11-01", "2026-11-15"), "daily"); // 14 days
assert.strictEqual(determineTrendGranularity("custom", "2026-10-01", "2026-10-31"), "daily"); // 30 days
assert.strictEqual(determineTrendGranularity("custom", "2026-09-01", "2026-11-01"), "weekly"); // 61 days
assert.strictEqual(determineTrendGranularity("custom", "2026-08-01", "2026-11-20"), "weekly"); // 111 days
assert.strictEqual(determineTrendGranularity("custom", "2026-01-01", "2026-11-20"), "monthly"); // 323 days
pass("Custom date ranges correctly switch between daily (<=31d), weekly (32-120d), and monthly (>120d)");

// Test 2.3: All range resolves to monthly
assert.strictEqual(determineTrendGranularity("all"), "monthly");
pass("'all' range defaults to monthly granularity");

// ============================================================================
// 3. DATE BUCKET GENERATION
// ============================================================================
console.log("\n--- 3. Continuous Chronological Bucket Generation ---");

// Test 3.1: Daily buckets produce every day with no gaps
{
  const buckets = buildTrendBuckets("daily", "2026-11-01", "2026-11-07");
  assert.strictEqual(buckets.length, 7);
  assert.strictEqual(buckets[0].key, "2026-11-01");
  assert.strictEqual(buckets[0].label, "Nov 1");
  assert.strictEqual(buckets[6].key, "2026-11-07");
  assert.strictEqual(buckets[6].label, "Nov 7");
  pass("Daily bucket generator creates 7 continuous buckets for a 7-day period");
}

// Test 3.2: Weekly buckets produce continuous 7-day windows
{
  const buckets = buildTrendBuckets("weekly", "2026-10-01", "2026-10-22");
  // 10-01 to 10-07, 10-08 to 10-14, 10-15 to 10-21, 10-22 to 10-22 (4 buckets)
  assert.strictEqual(buckets.length, 4);
  assert.strictEqual(buckets[0].startDate, "2026-10-01");
  assert.strictEqual(buckets[0].endDate, "2026-10-07");
  assert.strictEqual(buckets[1].startDate, "2026-10-08");
  assert.strictEqual(buckets[1].endDate, "2026-10-14");
  assert.strictEqual(buckets[3].startDate, "2026-10-22");
  assert.strictEqual(buckets[3].endDate, "2026-10-22");
  pass("Weekly bucket generator creates continuous weekly windows with zero gaps");
}

// Test 3.3: Monthly buckets produce every month in range
{
  const buckets = buildTrendBuckets("monthly", "2026-01-15", "2026-06-10");
  assert.strictEqual(buckets.length, 6);
  assert.strictEqual(buckets[0].key, "2026-01");
  assert.strictEqual(buckets[0].label, "Jan 2026");
  assert.strictEqual(buckets[5].key, "2026-06");
  assert.strictEqual(buckets[5].label, "Jun 2026");
  pass("Monthly bucket generator produces 6 continuous monthly buckets");
}

// ============================================================================
// 4. TREND AGGREGATION & BUCKETING (DAILY, WEEKLY, MONTHLY)
// ============================================================================
console.log("\n--- 4. Trend Aggregation by Granularity ---");

// Test 4.1: Daily trend aggregation
{
  const expenses = [
    { id: "e1", amount: 150.00, date: "2026-11-01", category: "Filament & Materials" },
    { id: "e2", amount: 50.00, date: "2026-11-01", category: "Packaging & Delivery" },
    { id: "e3", amount: 300.00, date: "2026-11-03", category: "Spare Parts & Accessories" },
    // Nov 2 has 0 expenses
  ];
  const trend = generateExpenseTrendData(expenses, {
    range: "custom",
    startDate: "2026-11-01",
    endDate: "2026-11-03",
  });
  assert.strictEqual(trend.granularity, "daily");
  assert.strictEqual(trend.buckets.length, 3);
  // Nov 1: 150 + 50 = 200
  assert.strictEqual(trend.buckets[0].cents, BigInt(20000));
  assert.strictEqual(trend.buckets[0].amount, 200.00);
  assert.strictEqual(trend.buckets[0].count, 2);
  // Nov 2: 0
  assert.strictEqual(trend.buckets[1].cents, BigInt(0));
  assert.strictEqual(trend.buckets[1].amount, 0);
  assert.strictEqual(trend.buckets[1].count, 0);
  // Nov 3: 300
  assert.strictEqual(trend.buckets[2].cents, BigInt(30000));
  assert.strictEqual(trend.buckets[2].amount, 300.00);
  assert.strictEqual(trend.buckets[2].count, 1);

  assert.strictEqual(trend.totalCents, BigInt(50000));
  assert.strictEqual(trend.totalAmount, 500.00);
  assert.strictEqual(trend.transactionCount, 3);
  assert.strictEqual(trend.peakBucket?.key, "2026-11-03");
  pass("Daily trend correctly aggregates expenses and preserves zero-spend days");
}

// Test 4.2: Weekly trend aggregation
{
  const expenses = [
    { id: "e1", amount: 100.00, date: "2026-10-02" }, // in week 1 (10-01 to 10-07)
    { id: "e2", amount: 200.00, date: "2026-10-06" }, // in week 1
    { id: "e3", amount: 500.00, date: "2026-10-10" }, // in week 2 (10-08 to 10-14)
  ];
  const trend = generateExpenseTrendData(expenses, {
    range: "custom",
    startDate: "2026-10-01",
    endDate: "2026-10-14",
    granularity: "weekly",
  });
  assert.strictEqual(trend.granularity, "weekly");
  assert.strictEqual(trend.buckets.length, 2);
  // Week 1: 100 + 200 = 300
  assert.strictEqual(trend.buckets[0].cents, BigInt(30000));
  assert.strictEqual(trend.buckets[0].count, 2);
  // Week 2: 500
  assert.strictEqual(trend.buckets[1].cents, BigInt(50000));
  assert.strictEqual(trend.buckets[1].count, 1);
  assert.strictEqual(trend.totalCents, BigInt(80000));
  pass("Weekly trend correctly aggregates expenses across 7-day boundaries");
}

// Test 4.3: Monthly trend aggregation
{
  const expenses = [
    { id: "e1", amount: 1000.00, date: "2026-01-15" },
    { id: "e2", amount: 1500.00, date: "2026-01-20" },
    { id: "e3", amount: 2000.00, date: "2026-02-10" },
    { id: "e4", amount: 3500.00, date: "2026-03-01" },
  ];
  const trend = generateExpenseTrendData(expenses, {
    range: "custom",
    startDate: "2026-01-01",
    endDate: "2026-03-31",
    granularity: "monthly",
  });
  assert.strictEqual(trend.granularity, "monthly");
  assert.strictEqual(trend.buckets.length, 3);
  assert.strictEqual(trend.buckets[0].cents, BigInt(250000)); // Jan: 2500
  assert.strictEqual(trend.buckets[1].cents, BigInt(200000)); // Feb: 2000
  assert.strictEqual(trend.buckets[2].cents, BigInt(350000)); // Mar: 3500
  assert.strictEqual(trend.totalCents, BigInt(800000));
  assert.strictEqual(trend.peakBucket?.key, "2026-03");
  pass("Monthly trend correctly aggregates expenses across calendar months");
}

// ============================================================================
// 5. PERIOD BOUNDARY BEHAVIOR
// ============================================================================
console.log("\n--- 5. Period Boundary Handling ---");

{
  const expenses = [
    { id: "before", amount: 100.00, date: "2026-10-31" }, // Before startDate
    { id: "onStart", amount: 200.00, date: "2026-11-01" }, // On startDate
    { id: "inside", amount: 300.00, date: "2026-11-05" }, // Inside
    { id: "onEnd", amount: 400.00, date: "2026-11-10" }, // On endDate
    { id: "after", amount: 500.00, date: "2026-11-11" }, // After endDate
  ];
  const trend = generateExpenseTrendData(expenses, {
    range: "custom",
    startDate: "2026-11-01",
    endDate: "2026-11-10",
  });
  // OnStart (200) + Inside (300) + OnEnd (400) = 900
  assert.strictEqual(trend.totalCents, BigInt(90000));
  assert.strictEqual(trend.totalAmount, 900.00);
  assert.strictEqual(trend.transactionCount, 3);
  // Before (100) and After (500) unbucketed = 600
  assert.strictEqual(trend.unbucketedCount, 2);
  assert.strictEqual(trend.unbucketedCents, BigInt(60000));
  pass("Exact period boundary dates are included while out-of-range dates are unbucketed");
}

// ============================================================================
// 6. EMPTY, MISSING, AND MALFORMED DATASETS
// ============================================================================
console.log("\n--- 6. Empty & Malformed Dataset Resilience ---");

// Test 6.1: Empty expense array
{
  const trend = generateExpenseTrendData([], { range: "7d", referenceDate: "2026-11-20" });
  assert.strictEqual(trend.totalCents, BigInt(0));
  assert.strictEqual(trend.totalAmount, 0);
  assert.strictEqual(trend.transactionCount, 0);
  assert.strictEqual(trend.peakBucket, null);
  assert.strictEqual(trend.buckets.length, 7);
  assert.strictEqual(trend.buckets.every((b) => b.cents === BigInt(0)), true);

  const dist = generateCategoryDistributionData([]);
  assert.strictEqual(dist.totalCents, BigInt(0));
  assert.strictEqual(dist.items.length, 0);
  assert.strictEqual(dist.topCategory, null);
  pass("Empty expense array yields zero totals and zero-filled buckets without error");
}

// Test 6.2: Missing and invalid expense dates
{
  const expenses = [
    { id: "valid", amount: 100.00, date: "2026-11-05" },
    { id: "no_date", amount: 50.00 },
    { id: "null_date", amount: 60.00, date: null },
    { id: "invalid_str", amount: 70.00, date: "not-a-date" },
    { id: "bad_month", amount: 80.00, date: "2026-99-99" },
  ];
  const trend = generateExpenseTrendData(expenses, {
    range: "custom",
    startDate: "2026-11-01",
    endDate: "2026-11-10",
  });
  assert.strictEqual(trend.totalCents, BigInt(10000));
  assert.strictEqual(trend.transactionCount, 1);
  assert.strictEqual(trend.unbucketedCount, 4);
  assert.strictEqual(trend.unbucketedCents, BigInt(26000)); // 50+60+70+80 = 260
  pass("Missing and malformed date strings handled safely without crashing");
}

// Test 6.3: Malformed amount resilience
{
  const expenses = [
    { id: "e1", amount: "not_a_number", date: "2026-11-05" },
    { id: "e2", amount: -50, date: "2026-11-05" },
    { id: "e3", amount: null, date: "2026-11-05" },
    { id: "e4", amount: 150.00, date: "2026-11-05" },
  ];
  const trend = generateExpenseTrendData(expenses as any, {
    range: "custom",
    startDate: "2026-11-01",
    endDate: "2026-11-10",
  });
  assert.strictEqual(trend.totalCents, BigInt(15000));
  assert.strictEqual(trend.transactionCount, 1);
  pass("Malformed amounts skipped safely by validation engine");
}

// ============================================================================
// 7. CATEGORY AGGREGATION & DISTRIBUTION
// ============================================================================
console.log("\n--- 7. Category Aggregation & Distribution ---");

// Test 7.1: Category aggregation by ID and name
{
  const expenses = [
    { id: "e1", amount: 200.00, categoryId: "cat_default_filament_materials" },
    { id: "e2", amount: 100.00, category: "Filament & Materials" },
    { id: "e3", amount: 150.00, category: "Electricity & Utilities" },
  ];
  const dist = generateCategoryDistributionData(expenses);
  assert.strictEqual(dist.totalCents, BigInt(45000));
  assert.strictEqual(dist.totalAmount, 450.00);
  assert.strictEqual(dist.items.length, 2);

  const filamentCat = dist.items.find((c) => c.name === "Filament & Materials");
  assert.ok(filamentCat);
  assert.strictEqual(filamentCat!.cents, BigInt(30000));
  assert.strictEqual(filamentCat!.count, 2);
  assert.strictEqual(filamentCat!.amount, 300.00);

  const elecCat = dist.items.find((c) => c.name === "Electricity & Utilities");
  assert.ok(elecCat);
  assert.strictEqual(elecCat!.cents, BigInt(15000));
  assert.strictEqual(elecCat!.count, 1);
  pass("Category aggregation correctly matches both categoryId and human category name");
}

// Test 7.2: Uncategorized expense handling
{
  const expenses = [
    { id: "e1", amount: 100.00 }, // no category
    { id: "e2", amount: 200.00, category: "" }, // empty string
    { id: "e3", amount: 300.00, category: "uncategorized" },
    { id: "e4", amount: 400.00, category: "Filament & Materials" },
  ];
  const dist = generateCategoryDistributionData(expenses);
  assert.strictEqual(dist.totalCents, BigInt(100000));
  assert.strictEqual(dist.items.length, 2);

  const uncat = dist.items.find((c) => c.id === "uncategorized");
  assert.ok(uncat);
  assert.strictEqual(uncat!.cents, BigInt(60000)); // 100 + 200 + 300 = 600
  assert.strictEqual(uncat!.count, 3);
  assert.strictEqual(uncat!.percentage, 60.0);
  pass("Uncategorized expenses gracefully grouped under 'Uncategorized' with exact share");
}

// Test 7.3: Custom category support
{
  const customCategories = [
    { id: "cat_custom_3d_scanner", name: "3D Scanner Maintenance", color: "#EC4899" },
  ];
  const expenses = [
    { id: "e1", amount: 500.00, categoryId: "cat_custom_3d_scanner" },
    { id: "e2", amount: 250.00, category: "R&D Prototyping" }, // ad-hoc custom name
  ];
  const dist = generateCategoryDistributionData(expenses, customCategories);
  assert.strictEqual(dist.totalCents, BigInt(75000));
  assert.strictEqual(dist.items.length, 2);

  const custom1 = dist.items.find((c) => c.id === "cat_custom_3d_scanner");
  assert.ok(custom1);
  assert.strictEqual(custom1!.color, "#EC4899");
  assert.strictEqual(custom1!.cents, BigInt(50000));

  const custom2 = dist.items.find((c) => c.name === "R&D Prototyping");
  assert.ok(custom2);
  assert.strictEqual(custom2!.cents, BigInt(25000));
  pass("Custom and ad-hoc categories cleanly supported with custom palette tokens");
}

// Test 7.4: High-cardinality grouping into 'Other Categories'
{
  // 8 distinct categories with spending
  const expenses = [
    { id: "e1", amount: 1000.00, category: "Cat 1" },
    { id: "e2", amount: 800.00, category: "Cat 2" },
    { id: "e3", amount: 600.00, category: "Cat 3" },
    { id: "e4", amount: 400.00, category: "Cat 4" },
    { id: "e5", amount: 200.00, category: "Cat 5" },
    { id: "e6", amount: 100.00, category: "Cat 6" },
    { id: "e7", amount: 50.00, category: "Cat 7" },
    { id: "e8", amount: 20.00, category: "Cat 8" },
  ];
  const totalCentsExpected = BigInt(317000); // 3170.00 AED

  // maxCategories = 5 -> Top 4 kept, remainder grouped into "Other Categories"
  const dist = generateCategoryDistributionData(expenses, [], { maxCategories: 5 });
  assert.strictEqual(dist.totalCents, totalCentsExpected);
  assert.strictEqual(dist.items.length, 5);

  // Top 4 items
  assert.strictEqual(dist.items[0].name, "Cat 1");
  assert.strictEqual(dist.items[1].name, "Cat 2");
  assert.strictEqual(dist.items[2].name, "Cat 3");
  assert.strictEqual(dist.items[3].name, "Cat 4");

  // 5th item is grouped
  const otherItem = dist.items[4];
  assert.strictEqual(otherItem.id, "grouped_other");
  assert.strictEqual(otherItem.name, "Other Categories");
  assert.strictEqual(otherItem.isGrouped, true);
  // 200 + 100 + 50 + 20 = 370.00 AED
  assert.strictEqual(otherItem.cents, BigInt(37000));
  assert.strictEqual(otherItem.amount, 370.00);
  assert.strictEqual(otherItem.count, 4);

  // Verify financial integrity: sum of all items cents === totalCents
  const sumItemsCents = dist.items.reduce((acc, it) => acc + it.cents, BigInt(0));
  assert.strictEqual(sumItemsCents, totalCentsExpected);
  pass("High-cardinality categories grouped into 'Other Categories' with 100% cents preservation");
}

// ============================================================================
// 8. CATEGORY COMPARISON RANKING
// ============================================================================
console.log("\n--- 8. Category Comparison Ranking ---");

{
  const expenses = [
    { id: "e1", amount: 150.00, category: "Electricity & Utilities" },
    { id: "e2", amount: 800.00, category: "Filament & Materials" },
    { id: "e3", amount: 350.00, category: "Spare Parts & Accessories" },
  ];
  const comparison = generateCategoryComparisonData(expenses);
  assert.strictEqual(comparison.items.length, 3);
  // Ranked descending
  assert.strictEqual(comparison.items[0].name, "Filament & Materials");
  assert.strictEqual(comparison.items[0].amount, 800.00);
  assert.strictEqual(comparison.items[1].name, "Spare Parts & Accessories");
  assert.strictEqual(comparison.items[1].amount, 350.00);
  assert.strictEqual(comparison.items[2].name, "Electricity & Utilities");
  assert.strictEqual(comparison.items[2].amount, 150.00);
  assert.strictEqual(comparison.maxAmount, 800.00);
  pass("Category comparison correctly ranks categories descending by spend amount");
}

// ============================================================================
// 9. FILTERING COMPATIBILITY WITH TASK 3 ENGINE
// ============================================================================
console.log("\n--- 9. Filtering Compatibility with Task 3 Engine ---");

{
  const rawExpenses = [
    { id: "e1", amount: 100.00, date: "2026-11-05", category: "Filament & Materials" },
    { id: "e2", amount: 200.00, date: "2026-11-15", category: "Filament & Materials" },
    { id: "e3", amount: 300.00, date: "2026-11-25", category: "Electricity & Utilities" },
    { id: "e4", amount: 400.00, date: "2026-10-15", category: "Filament & Materials" },
  ];

  // 1. Filter using Task 3 helper
  const filtered = getFilteredExpenses(rawExpenses, {
    range: "this_month",
    category: "Filament & Materials",
    referenceDate: "2026-11-20",
  });
  assert.strictEqual(filtered.length, 2); // e1 and e2

  // 2. Compute KPIs using Task 3 helper
  const kpis = calculateExpenseKPIs(filtered, rawExpenses, "2026-11-20");
  assert.strictEqual(kpis.totalExpensesCents, BigInt(30000));
  assert.strictEqual(kpis.totalExpenses, 300.00);

  // 3. Compute Analytics using Task 4 functions on the same filtered data
  const trend = generateExpenseTrendData(filtered, {
    range: "this_month",
    referenceDate: "2026-11-20",
  });
  const dist = generateCategoryDistributionData(filtered);

  // 4. Assert 100% financial alignment between Task 3 KPIs and Task 4 Analytics
  assert.strictEqual(trend.totalCents, kpis.totalExpensesCents);
  assert.strictEqual(dist.totalCents, kpis.totalExpensesCents);
  assert.strictEqual(dist.totalAmount, kpis.totalExpenses);
  pass("Task 4 analytics align 100% with Task 3 filtering and KPI engine");
}

// ============================================================================
// 10. INVENTORY ISOLATION & OBJECT IMMUTABILITY
// ============================================================================
console.log("\n--- 10. Inventory Isolation & Object Immutability ---");

{
  // Deeply freeze expense array to ensure no mutation
  const rawExpenses = Object.freeze([
    Object.freeze({ id: "e1", amount: 100.00, date: "2026-11-05", category: "Filament & Materials" }),
    Object.freeze({ id: "e2", amount: 200.00, date: "2026-11-10", category: "Filament & Materials" }),
  ]);

  // Execute analytics operations
  const trend = generateExpenseTrendData(rawExpenses, { range: "30d", referenceDate: "2026-11-20" });
  const dist = generateCategoryDistributionData(rawExpenses);
  const comp = generateCategoryComparisonData(rawExpenses);

  assert.strictEqual(trend.totalCents, BigInt(30000));
  assert.strictEqual(dist.totalCents, BigInt(30000));
  assert.strictEqual(comp.totalCents, BigInt(30000));

  // Verify global S object state (if defined in runtime)
  if (typeof (globalThis as any).S !== "undefined") {
    const S = (globalThis as any).S;
    assert.strictEqual(S.filaments !== undefined, true);
    assert.strictEqual(S.filament_stock !== undefined, true);
    assert.strictEqual(S.products !== undefined, true);
  }

  pass("Analytics operates strictly on read-only frozen data without mutating inputs or inventory");
}

console.log("\n========================================================================");
console.log(`  ALL ${passedCount} TASK 4 ANALYTICS & VISUALIZATION TESTS PASSED (100%)`);
console.log("========================================================================\n");
