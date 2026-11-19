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
  CreditCardIcon,
  Layers01Icon,
  Settings01Icon,
  PackageIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";

interface ExpenseRecord {
  id: string;
  category: string;
  description: string;
  vendor?: string;
  amount: number;
  paymentMethod: string;
  date: string;
}

export default async function ExpensesPage() {
  const auth = await verifyServerSession();

  let expenses: ExpenseRecord[] = [];
  let totalExpenses = 0;
  let materialCosts = 0;
  let maintenanceCosts = 0;
  let packagingCosts = 0;

  if (sql) {
    try {
      const rows = await sql`
        SELECT record_id, data, updated_at
        FROM ledger_collections
        WHERE collection_name = 'expenses'
        ORDER BY updated_at DESC
        LIMIT 50;
      `.catch(() => []);

      expenses = rows.map((r: any) => {
        const d = r.data || {};
        const amt = Number(d.amount || d.cost || 0);
        totalExpenses += amt;

        const cat = (d.category || "General").toLowerCase();
        if (cat.includes("filament") || cat.includes("material") || cat.includes("resin")) {
          materialCosts += amt;
        } else if (cat.includes("part") || cat.includes("nozzle") || cat.includes("maintenance")) {
          maintenanceCosts += amt;
        } else if (cat.includes("package") || cat.includes("shipping") || cat.includes("box")) {
          packagingCosts += amt;
        }

        return {
          id: r.record_id || d.id || String(Math.random()),
          category: d.category || "Studio Operating",
          description: d.description || d.title || "Operating Expense",
          vendor: d.vendor || d.supplier || "Local Vendor",
          amount: amt,
          paymentMethod: d.paymentMethod || "Corporate Card",
          date: r.updated_at ? new Date(r.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Recent",
        };
      });
    } catch {
      // Graceful fallback
    }
  }

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin/expenses"
      title="Expenses"
      breadcrumbs="Store & Finance"
    >
      <PageHeader
        title="Studio Operating Expenses"
        description="Monitor commercial operating expenditures, filament purchases, replacement nozzles, build plates, packaging, and shipping overheads."
        badge={{ text: "Cost Accounting", variant: "warning" }}
      />

      {/* KPI Cards Grid */}
      <div className="bm-metrics-grid">
        <MetricCard
          label="Total Logged Costs"
          value={`AED ${totalExpenses.toLocaleString()}`}
          subtext="Recorded studio expenses"
          icon={CreditCardIcon}
          variant="coral"
        />
        <MetricCard
          label="Raw Materials"
          value={`AED ${materialCosts.toLocaleString()}`}
          subtext="Filament & resin stock"
          icon={Layers01Icon}
          variant="mint"
        />
        <MetricCard
          label="Spares & Maintenance"
          value={`AED ${maintenanceCosts.toLocaleString()}`}
          subtext="Nozzles, hotends & belts"
          icon={Settings01Icon}
          variant="lavender"
        />
        <MetricCard
          label="Logistics & Packaging"
          value={`AED ${packagingCosts.toLocaleString()}`}
          subtext="Boxes, inserts & shipping"
          icon={PackageIcon}
          variant="accent"
        />
      </div>

      {/* Main Expenses Table Card */}
      <div className="bm-card">
        <div className="bm-card-header">
          <div>
            <h2 className="bm-card-title">Commercial Expense Ledger</h2>
            <p className="bm-card-subtitle">All operational expenditures tracked against studio revenue</p>
          </div>
          <span className="bm-badge bm-badge-neutral">
            <span className="bm-badge-dot" />
            {expenses.length} {expenses.length === 1 ? "Record" : "Records"}
          </span>
        </div>

        {expenses.length === 0 ? (
          <EmptyState
            icon={CreditCardIcon}
            title="No Operating Expenses Logged"
            description="Keep your commercial profit margins accurate by logging recurring studio operating costs, raw filament restocks, and replacement components."
            badge="EXPENSES READY"
          />
        ) : (
          <div className="bm-table-container">
            <table className="bm-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Vendor / Supplier</th>
                  <th>Payment Method</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td style={{ fontSize: "12px", color: "var(--bm-text-muted)" }}>{exp.date}</td>
                    <td>
                      <span className="bm-badge bm-badge-neutral">
                        <span className="bm-badge-dot" />
                        {exp.category}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>{exp.description}</td>
                    <td style={{ color: "var(--bm-text-secondary)" }}>{exp.vendor}</td>
                    <td style={{ fontSize: "12px", color: "var(--bm-text-muted)" }}>{exp.paymentMethod}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "var(--bm-text-primary)" }}>
                      AED {exp.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </BusinessWorkspaceLayout>
  );
}
