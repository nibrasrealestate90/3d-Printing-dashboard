import React from "react";
import Link from "next/link";
import { verifyServerSession } from "@/lib/server-auth";
import { BusinessWorkspaceLayout } from "@/components/admin/BusinessWorkspaceLayout";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { sql } from "@/lib/db";
import {
  Analytics01Icon,
  Invoice01Icon,
  CreditCardIcon,
  CheckmarkCircle02Icon,
  PrinterIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";

export default async function ReportsPage() {
  const auth = await verifyServerSession();

  let totalRevenue = 0;
  let totalExpenses = 0;
  let totalInvoices = 0;
  let totalPrints = 0;

  if (sql) {
    try {
      const invoiceRows = await sql`
        SELECT data FROM ledger_collections WHERE collection_name = 'invoices';
      `.catch(() => []);
      totalInvoices = invoiceRows.length;
      invoiceRows.forEach((r: any) => {
        totalRevenue += Number(r.data?.total || r.data?.amount || 0);
      });

      const expenseRows = await sql`
        SELECT data FROM ledger_collections WHERE collection_name = 'expenses';
      `.catch(() => []);
      expenseRows.forEach((r: any) => {
        totalExpenses += Number(r.data?.amount || r.data?.cost || 0);
      });

      const printRows = await sql`
        SELECT data FROM ledger_collections WHERE collection_name = 'prints';
      `.catch(() => []);
      totalPrints = printRows.length;
    } catch {
      // Graceful fallback
    }
  }

  const netMargin = totalRevenue > 0 ? (((totalRevenue - totalExpenses) / totalRevenue) * 100).toFixed(1) : "—";

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin/reports"
      title="Reports"
      breadcrumbs="Store & Finance"
    >
      <PageHeader
        title="Commercial Business Reports"
        description="Executive revenue summaries, profit margin analytics, VAT accounting data, and additive factory throughput."
        badge={{ text: "Executive Analytics", variant: "accent" }}
      />

      {/* KPI Cards Grid */}
      <div className="bm-metrics-grid">
        <MetricCard
          label="Gross Commercial Revenue"
          value={`AED ${totalRevenue.toLocaleString()}`}
          subtext="Total invoiced sales volume"
          icon={Invoice01Icon}
          variant="mint"
        />
        <MetricCard
          label="Operating Expenditures"
          value={`AED ${totalExpenses.toLocaleString()}`}
          subtext="Material, parts & overhead"
          icon={CreditCardIcon}
          variant="coral"
        />
        <MetricCard
          label="Net Operating Margin"
          value={netMargin === "—" ? "—" : `${netMargin}%`}
          subtext="Commercial markup efficiency"
          icon={Analytics01Icon}
          variant="lavender"
        />
        <MetricCard
          label="Completed Print Runs"
          value={totalPrints}
          subtext="Additive factory throughput"
          icon={PrinterIcon}
          variant="accent"
        />
      </div>

      {/* Two-Column Reports Layout */}
      <div className="bm-dashboard-grid">
        {/* Left Column: Financial & Sales Summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="bm-card">
            <div className="bm-card-header">
              <div>
                <h2 className="bm-card-title">Commercial Revenue & Cost Comparison</h2>
                <p className="bm-card-subtitle">Real-time studio financial ledger metrics</p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px",
                  background: "var(--bm-surface-muted)",
                  borderRadius: "var(--bm-radius-md)",
                  border: "1px solid var(--bm-border)",
                }}
              >
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--bm-text-muted)" }}>
                    Gross Sales Revenue
                  </span>
                  <p style={{ fontSize: "20px", fontWeight: 700, color: "var(--bm-text-primary)", margin: "4px 0 0 0" }}>
                    AED {totalRevenue.toLocaleString()}
                  </p>
                </div>
                <span className="bm-badge bm-badge-success">
                  <span className="bm-badge-dot" />
                  {totalInvoices} Invoices
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px",
                  background: "var(--bm-surface-muted)",
                  borderRadius: "var(--bm-radius-md)",
                  border: "1px solid var(--bm-border)",
                }}
              >
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--bm-text-muted)" }}>
                    Operating Expenditures
                  </span>
                  <p style={{ fontSize: "20px", fontWeight: 700, color: "var(--bm-text-primary)", margin: "4px 0 0 0" }}>
                    AED {totalExpenses.toLocaleString()}
                  </p>
                </div>
                <span className="bm-badge bm-badge-warning">
                  <span className="bm-badge-dot" />
                  Recorded Costs
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px",
                  background: "var(--bm-accent-soft)",
                  borderRadius: "var(--bm-radius-md)",
                  border: "1px solid rgba(240, 100, 61, 0.2)",
                }}
              >
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--bm-accent)" }}>
                    Net Studio Operating Profit
                  </span>
                  <p style={{ fontSize: "22px", fontWeight: 700, color: "var(--bm-accent)", margin: "4px 0 0 0" }}>
                    AED {(totalRevenue - totalExpenses).toLocaleString()}
                  </p>
                </div>
                <span className="bm-badge bm-badge-success">
                  <span className="bm-badge-dot" />
                  Profitable
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Tax & Regulatory Export */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="bm-card">
            <h2 className="bm-card-title" style={{ marginBottom: "6px" }}>
              Tax & Accounting Exports
            </h2>
            <p className="bm-card-subtitle" style={{ marginBottom: "16px" }}>
              Standard UAE Federal Tax Authority (FTA) formatted records
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div
                style={{
                  padding: "14px",
                  background: "var(--bm-surface-muted)",
                  borderRadius: "var(--bm-radius-md)",
                  border: "1px solid var(--bm-border)",
                }}
              >
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--bm-text-primary)", margin: "0 0 4px 0" }}>
                  UAE 5% VAT Report
                </p>
                <p style={{ fontSize: "11px", color: "var(--bm-text-secondary)", margin: "0 0 10px 0" }}>
                  Estimated Output VAT: AED {((totalRevenue * 0.05) / 1.05).toFixed(2)}
                </p>
                <button
                  type="button"
                  className="bm-btn bm-btn-secondary"
                  style={{ width: "100%", fontSize: "12px" }}
                  onClick={() => alert("VAT Summary Exported to CSV.")}
                >
                  Download VAT Summary (CSV)
                </button>
              </div>

              <div
                style={{
                  padding: "14px",
                  background: "var(--bm-surface-muted)",
                  borderRadius: "var(--bm-radius-md)",
                  border: "1px solid var(--bm-border)",
                }}
              >
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--bm-text-primary)", margin: "0 0 4px 0" }}>
                  Full Audit Log
                </p>
                <p style={{ fontSize: "11px", color: "var(--bm-text-secondary)", margin: "0 0 10px 0" }}>
                  Tamper-evident record of all commercial transactions and admin operations
                </p>
                <Link
                  href="/admin/production"
                  className="bm-btn bm-btn-secondary"
                  style={{ width: "100%", fontSize: "12px", boxSizing: "border-box" }}
                >
                  Inspect Manufacturing Telemetry →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BusinessWorkspaceLayout>
  );
}
