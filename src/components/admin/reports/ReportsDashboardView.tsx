"use client";

import React, { useState, useMemo } from "react";
import type { NormalizedInvoice, ReportingPeriod, ChartMonthData } from "./types";
import { MonthlySalesChart } from "./MonthlySalesChart";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { HugeIcon } from "@/components/hugeIcons";
import {
  Invoice01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  PackageIcon,
  Search01Icon,
  Calendar01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";

interface ReportsDashboardViewProps {
  initialInvoices: NormalizedInvoice[];
  configuredVatRate: number;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function parseInvoiceDate(inv: NormalizedInvoice): Date {
  if (inv.date && /^\d{4}-\d{2}-\d{2}/.test(inv.date)) {
    const [y, m, d] = inv.date.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  const parsed = new Date(inv.createdAt || inv.date);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function ReportsDashboardView({
  initialInvoices,
  configuredVatRate,
}: ReportsDashboardViewProps) {
  const [period, setPeriod] = useState<ReportingPeriod>("this_year");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Filter invoices based on selected reporting period
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (period === "this_year") {
      startDate = new Date(currentYear, 0, 1, 0, 0, 0, 0);
      endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    } else if (period === "this_month") {
      startDate = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
      endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    } else if (period === "last_month") {
      startDate = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
      endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    } else if (period === "custom") {
      if (customStartDate) {
        const [y, m, d] = customStartDate.split("-").map(Number);
        startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
      }
      if (customEndDate) {
        const [y, m, d] = customEndDate.split("-").map(Number);
        endDate = new Date(y, m - 1, d, 23, 59, 59, 999);
      }
    }

    return initialInvoices.filter((inv) => {
      const invDate = parseInvoiceDate(inv);
      if (startDate && invDate < startDate) return false;
      if (endDate && invDate > endDate) return false;
      return true;
    });
  }, [initialInvoices, period, customStartDate, customEndDate]);

  // Aggregate Primary Financial KPIs from filtered invoices
  const { totalSales, collectedRevenue, outstanding, totalOrders } = useMemo(() => {
    let salesSum = 0;
    let paidSum = 0;
    let outSum = 0;

    for (const inv of filteredInvoices) {
      salesSum += inv.total;
      paidSum += inv.paid;
      outSum += inv.balance;
    }

    return {
      totalSales: Number(salesSum.toFixed(2)),
      collectedRevenue: Number(paidSum.toFixed(2)),
      outstanding: Number(outSum.toFixed(2)),
      totalOrders: filteredInvoices.length,
    };
  }, [filteredInvoices]);

  // Monthly Sales Trend for Apache ECharts
  const chartData = useMemo<ChartMonthData[]>(() => {
    const now = new Date();
    const currentYear = now.getFullYear();

    const monthlyMap = new Map<string, { sales: number; orderCount: number; label: string }>();

    if (period === "this_year" || period === "this_month" || period === "last_month") {
      for (let m = 0; m < 12; m++) {
        const key = `${currentYear}-${String(m + 1).padStart(2, "0")}`;
        const label = `${MONTH_NAMES[m]} ${currentYear}`;
        monthlyMap.set(key, { sales: 0, orderCount: 0, label });
      }
    } else if (period === "custom" && customStartDate && customEndDate) {
      const [sy, sm] = customStartDate.split("-").map(Number);
      const [ey, em] = customEndDate.split("-").map(Number);
      let y = sy;
      let m = sm - 1;
      const targetY = ey;
      const targetM = em - 1;

      while (y < targetY || (y === targetY && m <= targetM)) {
        const key = `${y}-${String(m + 1).padStart(2, "0")}`;
        const label = `${MONTH_NAMES[m]} ${y}`;
        monthlyMap.set(key, { sales: 0, orderCount: 0, label });
        m++;
        if (m > 11) {
          m = 0;
          y++;
        }
      }
    } else {
      // all_time
      let earliestYear = currentYear;
      for (const inv of filteredInvoices) {
        const d = parseInvoiceDate(inv);
        if (d.getFullYear() < earliestYear) earliestYear = d.getFullYear();
      }
      for (let y = earliestYear; y <= currentYear; y++) {
        for (let m = 0; m < 12; m++) {
          const key = `${y}-${String(m + 1).padStart(2, "0")}`;
          const label = `${MONTH_NAMES[m]} ${y}`;
          monthlyMap.set(key, { sales: 0, orderCount: 0, label });
        }
      }
    }

    for (const inv of filteredInvoices) {
      const d = parseInvoiceDate(inv);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (monthlyMap.has(key)) {
        const entry = monthlyMap.get(key)!;
        entry.sales += inv.total;
        entry.orderCount += 1;
      } else {
        const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
        monthlyMap.set(key, { sales: inv.total, orderCount: 1, label });
      }
    }

    return Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, val]) => ({
        monthKey,
        monthLabel: val.label,
        sales: Number(val.sales.toFixed(2)),
        orderCount: val.orderCount,
      }));
  }, [filteredInvoices, period, customStartDate, customEndDate]);

  // VAT Summary Calculations
  const vatSummary = useMemo(() => {
    let taxableSum = 0;
    let outputVatSum = 0;

    for (const inv of filteredInvoices) {
      taxableSum += inv.taxableAmount;
      outputVatSum += inv.vat;
    }

    return {
      configuredRate: configuredVatRate,
      taxableSales: Number(taxableSum.toFixed(2)),
      outputVat: Number(outputVatSum.toFixed(2)),
      invoiceCount: filteredInvoices.length,
    };
  }, [filteredInvoices, configuredVatRate]);

  // Search & Pagination for Sales Records Table
  const searchedInvoices = useMemo(() => {
    if (!searchQuery.trim()) return filteredInvoices;
    const q = searchQuery.toLowerCase().trim();
    return filteredInvoices.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.customerEmail.toLowerCase().includes(q) ||
        inv.customerPhone.includes(q)
    );
  }, [filteredInvoices, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(searchedInvoices.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedInvoices = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return searchedInvoices.slice(start, start + pageSize);
  }, [searchedInvoices, safeCurrentPage, pageSize]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* =========================================================================
          1. HEADER & REPORTING PERIOD SELECTOR
          ========================================================================= */}
      <PageHeader
        title="Commercial Business Reports"
        description="Track sales performance, customer payments and business revenue."
        badge={{ text: "Executive Analytics", variant: "accent" }}
      />

      {/* Period Selector Controls */}
      <div
        className="bm-card"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px",
          padding: "14px 18px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: "var(--bm-text-secondary)",
              marginRight: "4px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <HugeIcon icon={Calendar01Icon} size={14} />
            Reporting Period
          </span>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--bm-surface-muted)",
              borderRadius: "var(--bm-radius-pill)",
              padding: "3px",
              border: "1px solid var(--bm-border)",
              gap: "2px",
            }}
          >
            {(
              [
                { id: "this_year", label: "This Year" },
                { id: "this_month", label: "This Month" },
                { id: "last_month", label: "Last Month" },
                { id: "all_time", label: "All Time" },
                { id: "custom", label: "Custom Range" },
              ] as const
            ).map((opt) => {
              const active = period === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setPeriod(opt.id);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: active ? 700 : 500,
                    borderRadius: "var(--bm-radius-pill)",
                    border: "none",
                    background: active ? "var(--bm-surface)" : "transparent",
                    color: active ? "var(--bm-accent)" : "var(--bm-text-secondary)",
                    boxShadow: active ? "0 1px 3px rgba(0, 0, 0, 0.08)" : "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Range Date Pickers */}
        {period === "custom" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "var(--bm-text-muted)" }}>From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bm-input"
                style={{
                  fontSize: "12px",
                  padding: "4px 8px",
                  borderRadius: "var(--bm-radius-sm)",
                  border: "1px solid var(--bm-border)",
                  background: "var(--bm-surface)",
                  color: "var(--bm-text-primary)",
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "var(--bm-text-muted)" }}>To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bm-input"
                style={{
                  fontSize: "12px",
                  padding: "4px 8px",
                  borderRadius: "var(--bm-radius-sm)",
                  border: "1px solid var(--bm-border)",
                  background: "var(--bm-surface)",
                  color: "var(--bm-text-primary)",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          2. FOUR FINANCIAL KPI CARDS
          ========================================================================= */}
      <div className="bm-metrics-grid">
        <MetricCard
          label="Total Sales"
          value={`AED ${totalSales.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          subtext="Total value of confirmed sales invoices"
          icon={Invoice01Icon}
          variant="mint"
        />
        <MetricCard
          label="Collected Revenue"
          value={`AED ${collectedRevenue.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          subtext="Payments recorded against sales invoices"
          icon={CheckmarkCircle02Icon}
          variant="success"
        />
        <MetricCard
          label="Outstanding"
          value={`AED ${outstanding.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          subtext="Remaining customer payment balances"
          icon={Clock01Icon}
          variant="coral"
        />
        <MetricCard
          label="Total Orders"
          value={totalOrders}
          subtext="Confirmed commercial sales orders"
          icon={PackageIcon}
          variant="lavender"
        />
      </div>

      {/* =========================================================================
          3. MONTHLY SALES TREND (APACHE ECHARTS)
          ========================================================================= */}
      <div className="bm-card">
        <div className="bm-card-header" style={{ marginBottom: "16px" }}>
          <div>
            <h2 className="bm-card-title">Sales Performance</h2>
            <p className="bm-card-subtitle">Monthly invoiced sales over time</p>
          </div>
          <span className="bm-badge bm-badge-neutral">
            <span className="bm-badge-dot" />
            Confirmed Sales Invoices
          </span>
        </div>

        <MonthlySalesChart data={chartData} />
      </div>

      {/* =========================================================================
          4. SALES RECORDS TABLE
          ========================================================================= */}
      <div className="bm-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div>
            <h2 className="bm-card-title">Sales Records</h2>
            <p className="bm-card-subtitle">
              Commercial invoices matching the selected reporting period
            </p>
          </div>

          {/* Search Bar */}
          <div style={{ position: "relative", minWidth: "240px", maxWidth: "340px", flex: 1 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search invoice # or customer..."
              style={{
                width: "100%",
                padding: "8px 14px 8px 34px",
                fontSize: "12px",
                borderRadius: "var(--bm-radius-pill)",
                border: "1px solid var(--bm-border)",
                background: "var(--bm-surface)",
                color: "var(--bm-text-primary)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "11px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--bm-text-muted)",
                pointerEvents: "none",
              }}
            >
              <HugeIcon icon={Search01Icon} size={15} />
            </div>
          </div>
        </div>

        {/* Invoices Table Shell */}
        <div className="bm-table-container">
          <table className="bm-table">
            <thead>
              <tr>
                <th style={{ width: "120px" }}>Invoice Number</th>
                <th>Customer</th>
                <th style={{ width: "120px" }}>Invoice Date</th>
                <th style={{ textAlign: "right", width: "120px" }}>Invoice Amount</th>
                <th style={{ textAlign: "right", width: "120px" }}>Amount Paid</th>
                <th style={{ textAlign: "right", width: "130px" }}>Outstanding</th>
                <th style={{ textAlign: "center", width: "110px" }}>Payment Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedInvoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: "center", padding: "40px", color: "var(--bm-text-muted)" }}
                  >
                    No sales invoices found matching your criteria.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <span
                        style={{
                          fontFamily: "var(--bm-font-mono)",
                          fontWeight: 700,
                          fontSize: "12px",
                          color: "var(--bm-accent)",
                        }}
                      >
                        {inv.invoiceNumber}
                      </span>
                    </td>
                    <td>
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "var(--bm-text-primary)",
                            fontSize: "13px",
                          }}
                        >
                          {inv.customerName}
                        </div>
                        {(inv.customerEmail || inv.customerPhone) && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "var(--bm-text-muted)",
                              marginTop: "2px",
                            }}
                          >
                            {inv.customerEmail || inv.customerPhone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: "12px", color: "var(--bm-text-secondary)" }}>
                        {inv.date}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600, fontSize: "13px" }}>
                      AED{" "}
                      {inv.total.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontSize: "13px",
                        color: inv.paid > 0 ? "var(--bm-success)" : "var(--bm-text-muted)",
                      }}
                    >
                      AED{" "}
                      {inv.paid.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontSize: "13px",
                        fontWeight: inv.balance > 0.005 ? 600 : 400,
                        color: inv.balance > 0.005 ? "var(--bm-accent)" : "var(--bm-text-muted)",
                      }}
                    >
                      AED{" "}
                      {inv.balance.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <StatusBadge status={inv.paymentStatus} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        {searchedInvoices.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: "14px",
              borderTop: "1px solid var(--bm-border)",
              marginTop: "12px",
              fontSize: "12px",
              color: "var(--bm-text-secondary)",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              Showing{" "}
              <span style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>
                {(safeCurrentPage - 1) * pageSize + 1}
              </span>{" "}
              to{" "}
              <span style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>
                {Math.min(safeCurrentPage * pageSize, searchedInvoices.length)}
              </span>{" "}
              of{" "}
              <span style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>
                {searchedInvoices.length}
              </span>{" "}
              invoices
            </div>

            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="bm-btn bm-btn-secondary"
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <HugeIcon icon={ArrowLeft01Icon} size={12} />
                  Previous
                </button>
                <span style={{ padding: "0 6px", fontSize: "11px", fontWeight: 600 }}>
                  Page {safeCurrentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="bm-btn bm-btn-secondary"
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  Next
                  <HugeIcon icon={ArrowRight01Icon} size={12} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          5. UAE VAT SUMMARY
          ========================================================================= */}
      <div className="bm-card">
        <div className="bm-card-header" style={{ marginBottom: "16px" }}>
          <div>
            <h2 className="bm-card-title">UAE VAT Summary</h2>
            <p className="bm-card-subtitle">
              Management tax summary based on issued commercial sales invoices
            </p>
          </div>
          <span className="bm-badge bm-badge-info">
            <span className="bm-badge-dot" />
            Federal Tax Authority
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "14px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              padding: "16px",
              background: "var(--bm-surface-muted)",
              borderRadius: "var(--bm-radius-md)",
              border: "1px solid var(--bm-border)",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: "var(--bm-text-muted)",
              }}
            >
              Configured VAT Rate
            </span>
            <p
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--bm-text-primary)",
                margin: "4px 0 0 0",
              }}
            >
              {vatSummary.configuredRate}%
            </p>
            <span style={{ fontSize: "11px", color: "var(--bm-text-secondary)" }}>
              Standard UAE VAT Schedule
            </span>
          </div>

          <div
            style={{
              padding: "16px",
              background: "var(--bm-surface-muted)",
              borderRadius: "var(--bm-radius-md)",
              border: "1px solid var(--bm-border)",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: "var(--bm-text-muted)",
              }}
            >
              Taxable Sales (Net of VAT)
            </span>
            <p
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--bm-text-primary)",
                margin: "4px 0 0 0",
              }}
            >
              AED{" "}
              {vatSummary.taxableSales.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <span style={{ fontSize: "11px", color: "var(--bm-text-secondary)" }}>
              Total net commercial sales
            </span>
          </div>

          <div
            style={{
              padding: "16px",
              background: "var(--bm-accent-soft)",
              borderRadius: "var(--bm-radius-md)",
              border: "1px solid rgba(240, 100, 61, 0.2)",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: "var(--bm-accent)",
              }}
            >
              Estimated Output VAT
            </span>
            <p
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--bm-accent)",
                margin: "4px 0 0 0",
              }}
            >
              AED{" "}
              {vatSummary.outputVat.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <span style={{ fontSize: "11px", color: "var(--bm-text-secondary)" }}>
              Tax collected on sales
            </span>
          </div>

          <div
            style={{
              padding: "16px",
              background: "var(--bm-surface-muted)",
              borderRadius: "var(--bm-radius-md)",
              border: "1px solid var(--bm-border)",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: "var(--bm-text-muted)",
              }}
            >
              Applicable Invoices
            </span>
            <p
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--bm-text-primary)",
                margin: "4px 0 0 0",
              }}
            >
              {vatSummary.invoiceCount}
            </p>
            <span style={{ fontSize: "11px", color: "var(--bm-text-secondary)" }}>
              Recorded sales documents
            </span>
          </div>
        </div>

        {/* Regulatory Disclosure Note */}
        <div
          style={{
            padding: "12px 16px",
            background: "var(--bm-surface-muted)",
            borderRadius: "var(--bm-radius-sm)",
            borderLeft: "3px solid var(--bm-accent)",
            fontSize: "12px",
            color: "var(--bm-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          <strong>Notice:</strong> VAT amounts shown are management summaries based on recorded
          invoices and are not an official tax filing.
        </div>
      </div>
    </div>
  );
}
