export interface NormalizedInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO string
  total: number;
  paid: number;
  balance: number;
  paymentStatus: "PAID" | "PARTIAL" | "PENDING";
  vat: number;
  taxableAmount: number;
  vatPct: number;
}

export type ReportingPeriod = "all_time" | "this_month" | "last_month" | "this_year" | "custom";

export interface ChartMonthData {
  monthKey: string; // "YYYY-MM"
  monthLabel: string; // "Jan 2026"
  sales: number;
  orderCount: number;
}

export interface VatSummaryData {
  configuredRate: number;
  taxableSales: number;
  outputVat: number;
  invoiceCount: number;
}
