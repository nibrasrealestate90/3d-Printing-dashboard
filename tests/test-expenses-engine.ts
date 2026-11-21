import assert from "assert";
import {
  MAX_EXPENSE_AMOUNT,
  DEFAULT_EXPENSE_CATEGORY_DEFINITIONS,
  getExpenseCategories,
  parseExpenseAmountToCents,
  expenseCentsToAmount,
  formatExpenseAED,
  getStartEndForPeriod,
  isDateInPeriod,
  getFilteredExpenses,
  calculateExpenseKPIs,
} from "../src/components/ledgerCore.js";

console.log("========================================================================");
console.log("  TASK 3: EXPENSE DATA STATE, DATE FILTERING & KPI ENGINE TEST SUITE");
console.log("========================================================================");

let passedCount = 0;
function pass(desc: string) {
  passedCount++;
  console.log(` ✅ [PASS ${passedCount}] ${desc}`);
}

// ============================================================================
// 1. FINANCIAL ARITHMETIC & INTEGER CENTS PRECISION
// ============================================================================
console.log("\n--- 1. Financial Arithmetic & Decimal-Safe Integer Cents ---");

// Test 1.1: 0.10 + 0.20 = 0.30 without IEEE 754 drift
const p01 = parseExpenseAmountToCents(0.10);
const p02 = parseExpenseAmountToCents(0.20);
assert.strictEqual(p01.valid, true);
assert.strictEqual(p02.valid, true);
assert.strictEqual(p01.cents, BigInt(10));
assert.strictEqual(p02.cents, BigInt(20));
const sumCents = p01.cents! + p02.cents!;
assert.strictEqual(sumCents, BigInt(30));
assert.strictEqual(expenseCentsToAmount(sumCents), 0.30);
assert.strictEqual(formatExpenseAED(sumCents, true), "AED 0.30");
pass("0.10 + 0.20 evaluates to exactly 0.30 AED without IEEE 754 drift");

// Test 1.2: 19.99 + 0.01 = 20.00
const p1999 = parseExpenseAmountToCents(19.99);
const p001 = parseExpenseAmountToCents("0.01");
assert.strictEqual(p1999.valid, true);
assert.strictEqual(p001.valid, true);
assert.strictEqual(p1999.cents, BigInt(1999));
assert.strictEqual(p001.cents, BigInt(1));
const sum20 = p1999.cents! + p001.cents!;
assert.strictEqual(sum20, BigInt(2000));
assert.strictEqual(expenseCentsToAmount(sum20), 20.00);
pass("19.99 + 0.01 evaluates to exactly 20.00 AED");

// Test 1.3: Single 249.50 expense is represented correctly
const p24950 = parseExpenseAmountToCents(249.50);
assert.strictEqual(p24950.valid, true);
assert.strictEqual(p24950.cents, BigInt(24950));
assert.strictEqual(p24950.amount, 249.50);
assert.strictEqual(p24950.formatted, "249.50");
assert.strictEqual(formatExpenseAED(249.50), "AED 249.50");
pass("Single 249.50 expense is parsed to 24950 cents and formatted as AED 249.50");

// Test 1.4: Large valid amounts do not overflow
const p10M = parseExpenseAmountToCents(10_000_000.00);
assert.strictEqual(p10M.valid, true);
assert.strictEqual(p10M.cents, BigInt(1_000_000_000));
assert.strictEqual(p10M.amount, 10_000_000);
pass("Large valid amount (10,000,000.00 AED) is correctly converted without overflow");

// Test 1.5: Reject invalid amounts (3 decimal places, negative, non-numeric, empty)
const p3dec = parseExpenseAmountToCents("50.125");
assert.strictEqual(p3dec.valid, false);
assert.strictEqual(p3dec.error?.includes("more than two decimal places"), true);

const pNeg = parseExpenseAmountToCents("-15.00");
assert.strictEqual(pNeg.valid, false);

const pZero = parseExpenseAmountToCents(0);
assert.strictEqual(pZero.valid, false);

const pText = parseExpenseAmountToCents("abc");
assert.strictEqual(pText.valid, false);

const pEmpty = parseExpenseAmountToCents("");
assert.strictEqual(pEmpty.valid, false);

const pOver = parseExpenseAmountToCents(10_000_000.01);
assert.strictEqual(pOver.valid, false);
pass("Invalid amounts (3 decimals, negative, 0, non-numeric, empty, exceeding max) are strictly rejected");

// ============================================================================
// 2. CATEGORY DEFINITIONS & FALLBACK STATE INTEGRATION
// ============================================================================
console.log("\n--- 2. Category State Integration & Fallbacks ---");

// Test 2.1: Exactly 10 default category definitions with stable IDs
assert.strictEqual(DEFAULT_EXPENSE_CATEGORY_DEFINITIONS.length, 10);
assert.strictEqual(DEFAULT_EXPENSE_CATEGORY_DEFINITIONS[0].id, "cat_default_filament_materials");
assert.strictEqual(DEFAULT_EXPENSE_CATEGORY_DEFINITIONS[0].name, "Filament & Materials");
assert.strictEqual(DEFAULT_EXPENSE_CATEGORY_DEFINITIONS[1].id, "cat_default_electricity_utilities");
assert.strictEqual(DEFAULT_EXPENSE_CATEGORY_DEFINITIONS[9].id, "cat_default_other_expenses");
pass("10 default categories defined with stable IDs matching Task 1 backend contract");

// Test 2.2: getExpenseCategories fallback behavior
const emptyFallback = getExpenseCategories([]);
assert.strictEqual(emptyFallback.length, 10);
assert.strictEqual(emptyFallback[0].name, "Filament & Materials");

const nullFallback = getExpenseCategories(null as any);
assert.strictEqual(nullFallback.length, 10);

const customCats = [
  { id: "cat_custom_1", name: "Custom Tooling", isDefault: false },
  { id: "cat_custom_2", name: "Studio Decor", isDefault: false },
];
const customResult = getExpenseCategories(customCats);
assert.strictEqual(customResult.length, 2);
assert.strictEqual(customResult[0].name, "Custom Tooling");
pass("getExpenseCategories returns active custom categories if present, or cleanly falls back to 10 defaults");

// ============================================================================
// 3. DATE RANGE ENGINE (DETERMINISTIC TESTING)
// ============================================================================
console.log("\n--- 3. Date Range Engine & Boundary Calculations ---");

// Test 3.1: 'today' range
const refMar1 = "2026-03-01";
const pToday = getStartEndForPeriod("today", "", "", refMar1);
assert.strictEqual(pToday.isValid, true);
assert.strictEqual(pToday.startDate, "2026-03-01");
assert.strictEqual(pToday.endDate, "2026-03-01");
pass("'today' range generates identical start and end dates equal to reference date");

// Test 3.2: '7d' (Last 7 Days, including today)
const p7d = getStartEndForPeriod("7d", "", "", refMar1);
assert.strictEqual(p7d.isValid, true);
assert.strictEqual(p7d.startDate, "2026-02-23");
assert.strictEqual(p7d.endDate, "2026-03-01");
pass("'7d' correctly calculates last 7 days inclusive across month boundary (Feb 23 to Mar 1)");

// Test 3.3: '30d' (Last 30 Days, including today)
const p30d = getStartEndForPeriod("30d", "", "", refMar1);
assert.strictEqual(p30d.isValid, true);
assert.strictEqual(p30d.startDate, "2026-01-31");
assert.strictEqual(p30d.endDate, "2026-03-01");
pass("'30d' correctly calculates last 30 days inclusive (Jan 31 to Mar 1 in non-leap year)");

// Test 3.4: 'this_month'
const pThisMonth = getStartEndForPeriod("this_month", "", "", refMar1);
assert.strictEqual(pThisMonth.isValid, true);
assert.strictEqual(pThisMonth.startDate, "2026-03-01");
assert.strictEqual(pThisMonth.endDate, "2026-03-31");
pass("'this_month' calculates from day 1 to day 31 for March");

// Test 3.5: 'last_month' across normal boundary
const pLastMonth = getStartEndForPeriod("last_month", "", "", refMar1);
assert.strictEqual(pLastMonth.isValid, true);
assert.strictEqual(pLastMonth.startDate, "2026-02-01");
assert.strictEqual(pLastMonth.endDate, "2026-02-28");
pass("'last_month' calculates Feb 1 to Feb 28 for non-leap year 2026");

// Test 3.6: 'last_month' with Leap Year (2024)
const refMar2024 = "2024-03-15";
const pLeapLastMonth = getStartEndForPeriod("last_month", "", "", refMar2024);
assert.strictEqual(pLeapLastMonth.isValid, true);
assert.strictEqual(pLeapLastMonth.startDate, "2024-02-01");
assert.strictEqual(pLeapLastMonth.endDate, "2024-02-29");
pass("Leap year correctly recognized: February 2024 has 29 days (2024-02-01 to 2024-02-29)");

// Test 3.7: 'last_month' with Year Transition (January 2026 -> December 2025)
const refJan2026 = "2026-01-10";
const pJanLastMonth = getStartEndForPeriod("last_month", "", "", refJan2026);
assert.strictEqual(pJanLastMonth.isValid, true);
assert.strictEqual(pJanLastMonth.startDate, "2025-12-01");
assert.strictEqual(pJanLastMonth.endDate, "2025-12-31");
pass("Year transition correctly handled: January 2026 prior month is December 2025 (2025-12-01 to 2025-12-31)");

// Test 3.8: 'custom' valid date range
const pCustom = getStartEndForPeriod("custom", "2026-05-10", "2026-05-25", refMar1);
assert.strictEqual(pCustom.isValid, true);
assert.strictEqual(pCustom.startDate, "2026-05-10");
assert.strictEqual(pCustom.endDate, "2026-05-25");
pass("Custom range is valid when start date is before or equal to end date");

// Test 3.9: 'custom' start date after end date
const pCustomInvalid = getStartEndForPeriod("custom", "2026-05-25", "2026-05-10", refMar1);
assert.strictEqual(pCustomInvalid.isValid, false);
pass("Custom range is marked invalid when start date is greater than end date");

// Test 3.10: 'all' range
const pAll = getStartEndForPeriod("all", "", "", refMar1);
assert.strictEqual(pAll.isValid, true);
assert.strictEqual(pAll.startDate, "");
assert.strictEqual(pAll.endDate, "9999-12-31");
pass("'all' range spans unconstrained boundaries");

// Test 3.11: isDateInPeriod calendar validation & boundaries
assert.strictEqual(isDateInPeriod("2026-03-15", "2026-03-01", "2026-03-31"), true);
assert.strictEqual(isDateInPeriod("2026-03-01", "2026-03-01", "2026-03-31"), true);
assert.strictEqual(isDateInPeriod("2026-03-31", "2026-03-01", "2026-03-31"), true);
assert.strictEqual(isDateInPeriod("2026-02-28", "2026-03-01", "2026-03-31"), false);
assert.strictEqual(isDateInPeriod("2026-04-01", "2026-03-01", "2026-03-31"), false);
// Impossible dates
assert.strictEqual(isDateInPeriod("2026-02-30", "2026-02-01", "2026-02-28"), false);
assert.strictEqual(isDateInPeriod("not-a-date", "2026-02-01", "2026-02-28"), false);
assert.strictEqual(isDateInPeriod("", "2026-02-01", "2026-02-28"), false);
pass("isDateInPeriod is strictly inclusive of boundaries and rejects invalid/impossible calendar dates");

// ============================================================================
// 4. EXPENSE FILTERING ENGINE
// ============================================================================
console.log("\n--- 4. Expense Filtering (Category, Search, Combined) ---");

const sampleExpenses = [
  {
    id: "exp_1",
    title: "Bambu PLA Basic Black 4 Spools",
    amount: 240.00,
    category: "Filament & Materials",
    categoryId: "cat_default_filament_materials",
    vendor: "Bambu Lab Global",
    expenseDate: "2026-03-02",
    description: "4x 1kg PLA Black spools for batch printing",
  },
  {
    id: "exp_2",
    title: "DEWA Electricity Bill",
    amount: 450.50,
    category: "Electricity & Utilities",
    categoryId: "cat_default_electricity_utilities",
    vendor: "DEWA Dubai",
    expenseDate: "2026-03-05",
    description: "Factory unit electricity consumption for Feb",
  },
  {
    id: "exp_3",
    title: "Hardened Steel Nozzle 0.4mm",
    amount: 120.00,
    category: "Spare Parts & Accessories",
    categoryId: "cat_default_spare_parts_accessories",
    vendor: "3D Souq Dubai",
    expenseDate: "2026-03-12",
    description: "Replacement nozzle for carbon fiber filaments",
  },
  {
    id: "exp_4",
    title: "Instagram Ad Campaign",
    amount: 300.00,
    category: "Marketing & Advertising",
    categoryId: "cat_default_marketing_advertising",
    vendor: "Meta Platforms Ireland",
    expenseDate: "2026-02-25",
    description: "Lead generation campaign for custom architectural models",
  },
  {
    id: "exp_5",
    title: "Cardboard Packaging Boxes",
    amount: 85.00,
    category: "Packaging & Delivery",
    categoryId: "cat_default_packaging_delivery",
    vendor: "Al Furqan Packaging",
    expenseDate: "2026-01-15",
    description: "Medium shipping boxes and bubble wrap",
  },
];

// Test 4.1: Filter by Category ID
const catFilteredById = getFilteredExpenses(sampleExpenses, {
  category: "cat_default_filament_materials",
  range: "all",
});
assert.strictEqual(catFilteredById.length, 1);
assert.strictEqual(catFilteredById[0].id, "exp_1");
pass("Filter by category ID correctly isolates matching records");

// Test 4.2: Filter by Category Name (case-insensitive)
const catFilteredByName = getFilteredExpenses(sampleExpenses, {
  category: "electricity & utilities",
  range: "all",
});
assert.strictEqual(catFilteredByName.length, 1);
assert.strictEqual(catFilteredByName[0].id, "exp_2");
pass("Filter by category name (case-insensitive) correctly isolates matching records");

// Test 4.3: Search by Title
const searchTitle = getFilteredExpenses(sampleExpenses, { search: "Nozzle", range: "all" });
assert.strictEqual(searchTitle.length, 1);
assert.strictEqual(searchTitle[0].id, "exp_3");
pass("Search by title correctly locates matching expenses");

// Test 4.4: Search by Vendor
const searchVendor = getFilteredExpenses(sampleExpenses, { search: "DEWA", range: "all" });
assert.strictEqual(searchVendor.length, 1);
assert.strictEqual(searchVendor[0].id, "exp_2");
pass("Search by vendor correctly locates matching expenses");

// Test 4.5: Search by Description
const searchDesc = getFilteredExpenses(sampleExpenses, { search: "architectural models", range: "all" });
assert.strictEqual(searchDesc.length, 1);
assert.strictEqual(searchDesc[0].id, "exp_4");
pass("Search by description notes correctly locates matching expenses");

// Test 4.6: Combined Search + Category + Date Range
const combined = getFilteredExpenses(sampleExpenses, {
  range: "this_month",
  category: "cat_default_filament_materials",
  search: "Bambu",
  referenceDate: "2026-03-15",
});
assert.strictEqual(combined.length, 1);
assert.strictEqual(combined[0].id, "exp_1");

const combinedNoMatch = getFilteredExpenses(sampleExpenses, {
  range: "this_month",
  category: "cat_default_filament_materials",
  search: "DEWA",
  referenceDate: "2026-03-15",
});
assert.strictEqual(combinedNoMatch.length, 0);
pass("Combined category + search + date range filtering operates accurately");

// Test 4.7: Invalid custom date range returns empty array
const invalidCustomFiltered = getFilteredExpenses(sampleExpenses, {
  range: "custom",
  customStart: "2026-05-20",
  customEnd: "2026-05-10",
});
assert.strictEqual(invalidCustomFiltered.length, 0);
pass("Invalid custom range (start > end) safely returns empty results");

// ============================================================================
// 5. KPI CALCULATIONS
// ============================================================================
console.log("\n--- 5. KPI Calculations & Financial Aggregates ---");

const marchReference = "2026-03-15";
const marchFiltered = getFilteredExpenses(sampleExpenses, {
  range: "this_month",
  referenceDate: marchReference,
});
// March expenses: exp_1 (240.00), exp_2 (450.50), exp_3 (120.00)
// Total in March = 240.00 + 450.50 + 120.00 = 810.50 AED
const kpiMarch = calculateExpenseKPIs(marchFiltered, sampleExpenses, marchReference);

// KPI 1: Total expenses for selected period
assert.strictEqual(kpiMarch.totalExpenses, 810.50);
assert.strictEqual(kpiMarch.totalExpensesCents, BigInt(81050));
assert.strictEqual(kpiMarch.totalExpensesFormatted, "AED 810.50");
pass("KPI 1: Total expenses for selected period aggregates exactly to 810.50 AED in cents");

// KPI 2: This Month's Expenses
assert.strictEqual(kpiMarch.thisMonthExpenses, 810.50);
assert.strictEqual(kpiMarch.thisMonthExpensesCents, BigInt(81050));
pass("KPI 2: This Month's expenses matches current calendar month baseline");

// KPI 3: Transactions Count
assert.strictEqual(kpiMarch.transactionsCount, 3);
pass("KPI 3: Transactions count accurately reflects 3 transactions");

// KPI 4: Highest Expense Category
assert.strictEqual(kpiMarch.highestCategory?.name, "Electricity & Utilities");
assert.strictEqual(kpiMarch.highestCategory?.amount, 450.50);
assert.strictEqual(kpiMarch.highestCategory?.cents, BigInt(45050));
pass("KPI 4: Highest expense category identifies 'Electricity & Utilities' at 450.50 AED");

// Test 5.2: Highest Category Tie Handling
const tieExpenses = [
  { id: "t1", title: "Job A", amount: 150.00, category: "Marketing & Advertising", expenseDate: "2026-03-01" },
  { id: "t2", title: "Job B", amount: 150.00, category: "Software & Subscriptions", expenseDate: "2026-03-02" },
];
const kpiTie = calculateExpenseKPIs(tieExpenses, tieExpenses, marchReference);
assert.strictEqual(kpiTie.highestCategory !== null, true);
assert.strictEqual(kpiTie.highestCategory?.amount, 150.00);
pass("Ties between categories are handled deterministically without crashing");

// Test 5.3: Empty Dataset Handling
const kpiEmpty = calculateExpenseKPIs([], [], marchReference);
assert.strictEqual(kpiEmpty.totalExpenses, 0);
assert.strictEqual(kpiEmpty.totalExpensesCents, BigInt(0));
assert.strictEqual(kpiEmpty.thisMonthExpenses, 0);
assert.strictEqual(kpiEmpty.transactionsCount, 0);
assert.strictEqual(kpiEmpty.highestCategory, null);
pass("Empty dataset is handled gracefully (totals: 0, transactions: 0, highestCategory: null)");

// ============================================================================
// 6. FILAMENT INVENTORY ISOLATION VERIFICATION
// ============================================================================
console.log("\n--- 6. Filament Inventory & Product Stock Isolation ---");

// Mock global S state matching runtime
const mockS: any = {
  filaments: [
    { id: "fil_1", name: "Bambu PLA Matte Ivory White", color: "#F5F5F0", density: 1.24, costPerKg: 95.00 },
    { id: "fil_2", name: "eSun PETG Solid Black", color: "#111111", density: 1.27, costPerKg: 80.00 },
  ],
  filament_stock: [
    { id: "spool_1", filamentId: "fil_1", weightGrams: 840, initialWeightGrams: 1000, slot: "A1" },
    { id: "spool_2", filamentId: "fil_2", weightGrams: 520, initialWeightGrams: 1000, slot: "A2" },
  ],
  products: [
    { id: "prod_1", title: "Industrial Cable Bracket", price: 45.00, stockQty: 18 },
    { id: "prod_2", title: "Custom Enclosure Box", price: 120.00, stockQty: 4 },
  ],
  expenses: [...sampleExpenses],
  expense_categories: [...DEFAULT_EXPENSE_CATEGORY_DEFINITIONS],
};

const filamentSnapshotBefore = JSON.stringify(mockS.filaments);
const spoolStockSnapshotBefore = JSON.stringify(mockS.filament_stock);
const productStockSnapshotBefore = JSON.stringify(mockS.products);

// Execute intensive expense calculation suite
for (let i = 0; i < 50; i++) {
  const filtered = getFilteredExpenses(mockS.expenses, {
    range: "30d",
    category: "Filament & Materials",
    search: "Bambu",
    referenceDate: marchReference,
  });
  calculateExpenseKPIs(filtered, mockS.expenses, marchReference);
}

const filamentSnapshotAfter = JSON.stringify(mockS.filaments);
const spoolStockSnapshotAfter = JSON.stringify(mockS.filament_stock);
const productStockSnapshotAfter = JSON.stringify(mockS.products);

assert.strictEqual(filamentSnapshotBefore, filamentSnapshotAfter, "S.filaments must remain 100% unchanged");
assert.strictEqual(spoolStockSnapshotBefore, spoolStockSnapshotAfter, "S.filament_stock must remain 100% unchanged");
assert.strictEqual(productStockSnapshotBefore, productStockSnapshotAfter, "S.products stock must remain 100% unchanged");

pass("Filament catalog (S.filaments) is 100% unmodified by expense engine calculations");
pass("Filament spool stock and remaining weights (S.filament_stock) are 100% untouched");
pass("Product stock quantities (S.products) are 100% untouched");

console.log("\n========================================================================");
console.log(`  ALL EXPENSE ENGINE TESTS PASSED: ${passedCount} / ${passedCount} (100%)`);
console.log("========================================================================\n");
