/**
 * Expense Analytics Engine
 *
 * Pure, decoupled financial calculations and chart data preparation
 * for the 3D Print Studio Commercial Dashboard.
 *
 * Implements:
 * - Dynamic trend bucketing (Daily / Weekly / Monthly) with full chronological filling
 * - Decimal-safe BigInt cents accumulation with ZERO floating-point drift
 * - Category spending distribution with high-cardinality grouping
 * - Category spending comparison and ranking
 * - Missing date, invalid date, and uncategorized expense handling
 */

import {
  parseExpenseAmountToCents,
  expenseCentsToAmount,
  formatExpenseAED,
  DEFAULT_EXPENSE_CATEGORY_DEFINITIONS,
  getStartEndForPeriod,
  isDateInPeriod,
} from "@/components/ledgerCore";

// ============================================================================
// Types & Interfaces
// ============================================================================

export type TrendGranularity = "daily" | "weekly" | "monthly";

export interface ExpenseRecordLike {
  id?: string;
  amount: number | string;
  expenseDate?: string;
  date?: string;
  category?: string;
  categoryId?: string;
  description?: string;
  notes?: string;
  vendor?: string;
  paymentMethod?: string;
  referenceNumber?: string;
  status?: string;
  receiptUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface ExpenseCategoryLike {
  id: string;
  name: string;
  order?: number;
  color?: string;
  isDefault?: boolean;
  [key: string]: any;
}

export interface TrendBucket {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  cents: bigint;
  amount: number;
  formatted: string;
  count: number;
}

export interface TrendAnalyticsResult {
  granularity: TrendGranularity;
  startDate: string;
  endDate: string;
  buckets: TrendBucket[];
  totalCents: bigint;
  totalAmount: number;
  totalFormatted: string;
  transactionCount: number;
  peakBucket: TrendBucket | null;
  averageCentsPerBucket: bigint;
  averageAmountPerBucket: number;
  unbucketedCount: number;
  unbucketedCents: bigint;
}

export interface CategoryDistributionItem {
  id: string;
  name: string;
  color: string;
  cents: bigint;
  amount: number;
  formatted: string;
  count: number;
  percentage: number;
  isGrouped: boolean;
}

export interface CategoryDistributionResult {
  items: CategoryDistributionItem[];
  totalCents: bigint;
  totalAmount: number;
  totalFormatted: string;
  categoryCount: number;
  topCategory: CategoryDistributionItem | null;
}

export interface CategoryComparisonItem {
  id: string;
  name: string;
  color: string;
  cents: bigint;
  amount: number;
  formatted: string;
  count: number;
  percentage: number;
}

export interface CategoryComparisonResult {
  items: CategoryComparisonItem[];
  totalCents: bigint;
  totalAmount: number;
  totalFormatted: string;
  maxAmount: number;
}

// ============================================================================
// Color Tokens & Constants
// ============================================================================

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const CATEGORY_PALETTE: readonly string[] = [
  "#0D9488", // Teal 600
  "#14B8A6", // Teal 500
  "#0284C7", // Sky 600
  "#6366F1", // Indigo 500
  "#F59E0B", // Amber 500
  "#F43F5E", // Rose 500
  "#8B5CF6", // Purple 500
  "#10B981", // Emerald 500
  "#EC4899", // Pink 500
  "#F97316", // Orange 500
  "#06B6D4", // Cyan 500
  "#84CC16", // Lime 500
  "#64748B", // Slate 500
];

export const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  cat_default_filament_materials: "#0D9488",
  cat_default_electricity_utilities: "#F59E0B",
  cat_default_printer_maintenance_repairs: "#0284C7",
  cat_default_spare_parts_accessories: "#6366F1",
  cat_default_packaging_delivery: "#14B8A6",
  cat_default_marketing_advertising: "#EC4899",
  cat_default_software_subscriptions: "#8B5CF6",
  cat_default_rent_workspace: "#10B981",
  cat_default_transportation: "#F97316",
  cat_default_other_expenses: "#64748B",
  uncategorized: "#94A3B8",
};

// ============================================================================
// Pure Date Utilities (Timezone-agnostic UTC)
// ============================================================================

export function parseYMD(str: string | null | undefined): { year: number; month: number; day: number; str: string } | null {
  if (!str || typeof str !== "string") return null;
  const match = str.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day, str: match[0] };
}

export function formatYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDaysYMD(ymdStr: string, days: number): string {
  const parts = parseYMD(ymdStr);
  if (!parts) return ymdStr;
  const dt = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return dt.toISOString().slice(0, 10);
}

export function getDaysDiff(startStr: string, endStr: string): number {
  const p1 = parseYMD(startStr);
  const p2 = parseYMD(endStr);
  if (!p1 || !p2) return 0;
  const t1 = Date.UTC(p1.year, p1.month - 1, p1.day);
  const t2 = Date.UTC(p2.year, p2.month - 1, p2.day);
  return Math.round((t2 - t1) / (86400 * 1000));
}

export function formatDailyLabel(ymdStr: string): string {
  const p = parseYMD(ymdStr);
  if (!p) return ymdStr;
  return `${MONTH_NAMES_SHORT[p.month - 1]} ${p.day}`;
}

export function formatWeeklyLabel(startStr: string, endStr: string): string {
  const p1 = parseYMD(startStr);
  const p2 = parseYMD(endStr);
  if (!p1 || !p2) return `${startStr} - ${endStr}`;
  if (p1.month === p2.month) {
    if (p1.day === p2.day) return `${MONTH_NAMES_SHORT[p1.month - 1]} ${p1.day}`;
    return `${MONTH_NAMES_SHORT[p1.month - 1]} ${p1.day}–${p2.day}`;
  }
  return `${MONTH_NAMES_SHORT[p1.month - 1]} ${p1.day} – ${MONTH_NAMES_SHORT[p2.month - 1]} ${p2.day}`;
}

export function formatMonthlyLabel(ymStr: string): string {
  const parts = ymStr.slice(0, 7).split("-");
  if (parts.length < 2) return ymStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return ymStr;
  return `${MONTH_NAMES_SHORT[m - 1]} ${y}`;
}

// ============================================================================
// Granularity & Bucket Builders
// ============================================================================

/**
 * Automatically determine appropriate chart trend granularity based on
 * the active period range or date span.
 */
export function determineTrendGranularity(
  range: string = "30d",
  startDate?: string,
  endDate?: string
): TrendGranularity {
  if (range === "today" || range === "7d" || range === "30d" || range === "this_month" || range === "last_month") {
    return "daily";
  }

  if (range === "custom" && startDate && endDate) {
    const diff = getDaysDiff(startDate, endDate);
    if (diff <= 31) return "daily";
    if (diff <= 120) return "weekly";
    return "monthly";
  }

  if (range === "all") {
    return "monthly";
  }

  return "daily";
}

/**
 * Builds chronological buckets covering every day, week, or month in the range
 * so the chart timeline is continuous with zero omitted periods.
 */
export function buildTrendBuckets(
  granularity: TrendGranularity,
  startDate: string,
  endDate: string
): TrendBucket[] {
  const buckets: TrendBucket[] = [];
  const pStart = parseYMD(startDate);
  const pEnd = parseYMD(endDate);

  if (!pStart || !pEnd || pStart.str > pEnd.str) {
    return buckets;
  }

  if (granularity === "daily") {
    let curr = pStart.str;
    while (curr <= pEnd.str) {
      buckets.push({
        key: curr,
        label: formatDailyLabel(curr),
        startDate: curr,
        endDate: curr,
        cents: BigInt(0),
        amount: 0,
        formatted: "AED 0.00",
        count: 0,
      });
      curr = addDaysYMD(curr, 1);
    }
  } else if (granularity === "weekly") {
    let curr = pStart.str;
    while (curr <= pEnd.str) {
      let weekEnd = addDaysYMD(curr, 6);
      if (weekEnd > pEnd.str) weekEnd = pEnd.str;
      buckets.push({
        key: curr,
        label: formatWeeklyLabel(curr, weekEnd),
        startDate: curr,
        endDate: weekEnd,
        cents: BigInt(0),
        amount: 0,
        formatted: "AED 0.00",
        count: 0,
      });
      curr = addDaysYMD(weekEnd, 1);
    }
  } else {
    // monthly
    let currYear = pStart.year;
    let currMonth = pStart.month;
    const endYear = pEnd.year;
    const endMonth = pEnd.month;

    while (currYear < endYear || (currYear === endYear && currMonth <= endMonth)) {
      const ymKey = `${currYear}-${String(currMonth).padStart(2, "0")}`;
      const firstDay = `${ymKey}-01`;
      const lastDayNum = new Date(currYear, currMonth, 0).getDate();
      const lastDay = `${ymKey}-${String(lastDayNum).padStart(2, "0")}`;

      const bucketStart = firstDay < pStart.str ? pStart.str : firstDay;
      const bucketEnd = lastDay > pEnd.str ? pEnd.str : lastDay;

      buckets.push({
        key: ymKey,
        label: formatMonthlyLabel(ymKey),
        startDate: bucketStart,
        endDate: bucketEnd,
        cents: BigInt(0),
        amount: 0,
        formatted: "AED 0.00",
        count: 0,
      });

      currMonth++;
      if (currMonth > 12) {
        currMonth = 1;
        currYear++;
      }
    }
  }

  return buckets;
}

// ============================================================================
// Expense Trend Calculation
// ============================================================================

export interface TrendAnalyticsOptions {
  range?: string;
  startDate?: string;
  endDate?: string;
  granularity?: TrendGranularity;
  referenceDate?: string | Date | null;
}

/**
 * Pure calculation to generate expense trend data over time.
 * Uses integer BigInt cents for aggregation to prevent any floating-point accumulation.
 */
export function generateExpenseTrendData(
  expenses: readonly ExpenseRecordLike[] = [],
  options: TrendAnalyticsOptions = {}
): TrendAnalyticsResult {
  const range = options.range || "30d";
  const refDate = options.referenceDate || new Date();

  // Resolve start/end bounds
  let startDate = options.startDate || "";
  let endDate = options.endDate || "";

  if (!startDate || !endDate) {
    const period = getStartEndForPeriod(range, options.startDate, options.endDate, refDate as any);
    if (range === "all") {
      // Find min and max date from expenses
      let minExpDate = "";
      let maxExpDate = "";
      for (const e of expenses) {
        if (!e) continue;
        const d = String(e.expenseDate || e.date || "").slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          if (!minExpDate || d < minExpDate) minExpDate = d;
          if (!maxExpDate || d > maxExpDate) maxExpDate = d;
        }
      }
      if (minExpDate && maxExpDate) {
        // Expand to first of min month and last of max month
        const pMin = parseYMD(minExpDate)!;
        const pMax = parseYMD(maxExpDate)!;
        startDate = formatYMD(pMin.year, pMin.month, 1);
        const lastDay = new Date(pMax.year, pMax.month, 0).getDate();
        endDate = formatYMD(pMax.year, pMax.month, lastDay);
      } else {
        // Default to last 6 months when all has no expenses
        const pRef = parseYMD(typeof refDate === "string" ? refDate : refDate.toISOString().slice(0, 10)) || { year: 2026, month: 11, day: 20 };
        const endMonth = pRef.month;
        const endYear = pRef.year;
        let startMonth = endMonth - 5;
        let startYear = endYear;
        if (startMonth <= 0) {
          startMonth += 12;
          startYear -= 1;
        }
        startDate = formatYMD(startYear, startMonth, 1);
        const lastDay = new Date(endYear, endMonth, 0).getDate();
        endDate = formatYMD(endYear, endMonth, lastDay);
      }
    } else {
      startDate = period.startDate;
      endDate = period.endDate;
    }
  }

  // Determine granularity
  const granularity = options.granularity || determineTrendGranularity(range, startDate, endDate);

  // Build sequential continuous buckets
  const buckets = buildTrendBuckets(granularity, startDate, endDate);

  // Lookup structures for fast bucket matching
  const bucketKeyMap = new Map<string, TrendBucket>();
  for (const b of buckets) {
    bucketKeyMap.set(b.key, b);
  }

  let totalCents = BigInt(0);
  let transactionCount = 0;
  let unbucketedCount = 0;
  let unbucketedCents = BigInt(0);

  // Distribute expenses into buckets
  for (const exp of expenses) {
    if (!exp || typeof exp !== "object") continue;

    const parsed = parseExpenseAmountToCents(exp.amount);
    if (!parsed.valid || parsed.cents === undefined) {
      continue;
    }

    const expDate = String(exp.expenseDate || exp.date || "").slice(0, 10);
    const parsedDate = parseYMD(expDate);

    if (!parsedDate) {
      // Invalid or missing date
      unbucketedCount++;
      unbucketedCents += parsed.cents;
      continue;
    }

    // Check if within bounds
    if (startDate && expDate < startDate) {
      unbucketedCount++;
      unbucketedCents += parsed.cents;
      continue;
    }
    if (endDate && expDate > endDate) {
      unbucketedCount++;
      unbucketedCents += parsed.cents;
      continue;
    }

    // Match bucket
    let targetBucket: TrendBucket | undefined;
    if (granularity === "daily") {
      targetBucket = bucketKeyMap.get(expDate);
    } else if (granularity === "monthly") {
      targetBucket = bucketKeyMap.get(expDate.slice(0, 7));
    } else {
      // weekly
      for (const b of buckets) {
        if (expDate >= b.startDate && expDate <= b.endDate) {
          targetBucket = b;
          break;
        }
      }
    }

    if (targetBucket) {
      targetBucket.cents += parsed.cents;
      targetBucket.count++;
      totalCents += parsed.cents;
      transactionCount++;
    } else {
      unbucketedCount++;
      unbucketedCents += parsed.cents;
    }
  }

  // Finalize bucket display values and find peak
  let peakBucket: TrendBucket | null = null;
  let maxBucketCents = BigInt(0);

  for (const b of buckets) {
    b.amount = expenseCentsToAmount(b.cents);
    b.formatted = formatExpenseAED(b.cents, true);
    if (b.cents > maxBucketCents) {
      maxBucketCents = b.cents;
      peakBucket = b;
    }
  }

  const bucketCountBigInt = BigInt(Math.max(1, buckets.length));
  const averageCentsPerBucket = buckets.length > 0 ? totalCents / bucketCountBigInt : BigInt(0);

  return {
    granularity,
    startDate,
    endDate,
    buckets,
    totalCents,
    totalAmount: expenseCentsToAmount(totalCents),
    totalFormatted: formatExpenseAED(totalCents, true),
    transactionCount,
    peakBucket,
    averageCentsPerBucket,
    averageAmountPerBucket: expenseCentsToAmount(averageCentsPerBucket),
    unbucketedCount,
    unbucketedCents,
  };
}

// ============================================================================
// Category Spending Distribution & Comparison
// ============================================================================

export interface CategoryDistributionOptions {
  maxCategories?: number;
  customPalette?: readonly string[];
}

/**
 * Pure calculation to generate category distribution data for pie/donut charts.
 * Aggregates with BigInt cents and cleanly groups categories beyond maxCategories into "Other".
 */
export function generateCategoryDistributionData(
  expenses: readonly ExpenseRecordLike[] = [],
  categories: readonly ExpenseCategoryLike[] = [],
  options: CategoryDistributionOptions = {}
): CategoryDistributionResult {
  const maxCategories = typeof options.maxCategories === "number" && options.maxCategories > 1
    ? options.maxCategories
    : 6;

  // Build category lookup maps
  const catDefs = categories.length > 0 ? categories : DEFAULT_EXPENSE_CATEGORY_DEFINITIONS;
  const idMap = new Map<string, ExpenseCategoryLike>();
  const nameMap = new Map<string, ExpenseCategoryLike>();

  for (const cat of catDefs) {
    if (!cat) continue;
    if (cat.id) idMap.set(cat.id, cat);
    if (cat.name) nameMap.set(cat.name.trim().toLowerCase(), cat);
  }

  // Aggregate cents and counts per category key
  interface TempCategoryAgg {
    id: string;
    name: string;
    color?: string;
    cents: bigint;
    count: number;
  }

  const categoryAggMap = new Map<string, TempCategoryAgg>();
  let totalCents = BigInt(0);

  for (const exp of expenses) {
    if (!exp || typeof exp !== "object") continue;

    const parsed = parseExpenseAmountToCents(exp.amount);
    if (!parsed.valid || parsed.cents === undefined) {
      continue;
    }

    // Determine category
    const catId = exp.categoryId || "";
    const rawCategory = (exp.category || "").trim();
    let matchedCat: ExpenseCategoryLike | undefined;

    if (catId && idMap.has(catId)) {
      matchedCat = idMap.get(catId);
    } else if (rawCategory && nameMap.has(rawCategory.toLowerCase())) {
      matchedCat = nameMap.get(rawCategory.toLowerCase());
    }

    let resolvedId: string;
    let resolvedName: string;
    let customColor: string | undefined;

    if (matchedCat) {
      resolvedId = matchedCat.id;
      resolvedName = matchedCat.name;
      customColor = matchedCat.color;
    } else if (rawCategory && rawCategory.toLowerCase() !== "uncategorized") {
      // Custom ad-hoc category
      resolvedId = `cat_custom_${rawCategory.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
      resolvedName = rawCategory;
    } else {
      resolvedId = "uncategorized";
      resolvedName = "Uncategorized";
    }

    totalCents += parsed.cents;

    const existing = categoryAggMap.get(resolvedId);
    if (existing) {
      existing.cents += parsed.cents;
      existing.count++;
    } else {
      categoryAggMap.set(resolvedId, {
        id: resolvedId,
        name: resolvedName,
        color: customColor,
        cents: parsed.cents,
        count: 1,
      });
    }
  }

  // Filter out zero-spend categories and sort descending
  const sorted = Array.from(categoryAggMap.values())
    .filter((c) => c.cents > BigInt(0))
    .sort((a, b) => (b.cents > a.cents ? 1 : b.cents < a.cents ? -1 : 0));

  const totalCategoriesWithSpend = sorted.length;
  const palette = options.customPalette || CATEGORY_PALETTE;

  const items: CategoryDistributionItem[] = [];
  let colorIndex = 0;

  function getColor(catId: string, customCol?: string): string {
    if (customCol) return customCol;
    if (DEFAULT_CATEGORY_COLORS[catId]) return DEFAULT_CATEGORY_COLORS[catId];
    const col = palette[colorIndex % palette.length];
    colorIndex++;
    return col;
  }

  function calcPercentage(cents: bigint, total: bigint): number {
    if (total === BigInt(0)) return 0;
    // Calculate percentage with 1 decimal place without floating-point accumulation
    const scaled = (cents * BigInt(1000)) / total;
    return Number(scaled) / 10;
  }

  if (sorted.length <= maxCategories) {
    for (const cat of sorted) {
      items.push({
        id: cat.id,
        name: cat.name,
        color: getColor(cat.id, cat.color),
        cents: cat.cents,
        amount: expenseCentsToAmount(cat.cents),
        formatted: formatExpenseAED(cat.cents, true),
        count: cat.count,
        percentage: calcPercentage(cat.cents, totalCents),
        isGrouped: false,
      });
    }
  } else {
    // Keep top (maxCategories - 1)
    const topCount = maxCategories - 1;
    for (let i = 0; i < topCount; i++) {
      const cat = sorted[i];
      items.push({
        id: cat.id,
        name: cat.name,
        color: getColor(cat.id, cat.color),
        cents: cat.cents,
        amount: expenseCentsToAmount(cat.cents),
        formatted: formatExpenseAED(cat.cents, true),
        count: cat.count,
        percentage: calcPercentage(cat.cents, totalCents),
        isGrouped: false,
      });
    }

    // Group the rest into "Other Categories"
    let groupedCents = BigInt(0);
    let groupedCount = 0;
    for (let i = topCount; i < sorted.length; i++) {
      groupedCents += sorted[i].cents;
      groupedCount += sorted[i].count;
    }

    if (groupedCents > BigInt(0)) {
      items.push({
        id: "grouped_other",
        name: "Other Categories",
        color: DEFAULT_CATEGORY_COLORS.cat_default_other_expenses || "#64748B",
        cents: groupedCents,
        amount: expenseCentsToAmount(groupedCents),
        formatted: formatExpenseAED(groupedCents, true),
        count: groupedCount,
        percentage: calcPercentage(groupedCents, totalCents),
        isGrouped: true,
      });
    }
  }

  const topCategory = items.length > 0 ? items[0] : null;

  return {
    items,
    totalCents,
    totalAmount: expenseCentsToAmount(totalCents),
    totalFormatted: formatExpenseAED(totalCents, true),
    categoryCount: totalCategoriesWithSpend,
    topCategory,
  };
}

/**
 * Pure calculation to generate category ranking comparison data (e.g. for horizontal bar chart).
 * Returns all positive-spend categories sorted descending.
 */
export function generateCategoryComparisonData(
  expenses: readonly ExpenseRecordLike[] = [],
  categories: readonly ExpenseCategoryLike[] = [],
  options: { maxItems?: number } = {}
): CategoryComparisonResult {
  const distribution = generateCategoryDistributionData(expenses, categories, {
    maxCategories: 999, // Do not group for comparison ranking
  });

  let items: CategoryComparisonItem[] = distribution.items.map((it) => ({
    id: it.id,
    name: it.name,
    color: it.color,
    cents: it.cents,
    amount: it.amount,
    formatted: it.formatted,
    count: it.count,
    percentage: it.percentage,
  }));

  if (typeof options.maxItems === "number" && options.maxItems > 0) {
    items = items.slice(0, options.maxItems);
  }

  let maxAmount = 0;
  for (const it of items) {
    if (it.amount > maxAmount) maxAmount = it.amount;
  }

  return {
    items,
    totalCents: distribution.totalCents,
    totalAmount: distribution.totalAmount,
    totalFormatted: distribution.totalFormatted,
    maxAmount,
  };
}
