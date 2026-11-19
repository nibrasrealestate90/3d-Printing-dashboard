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
  Invoice01Icon,
  Clock01Icon,
  CheckmarkCircle02Icon,
  PrinterIcon,
  CreditCardIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";

interface OrderItem {
  id: string;
  invoiceNumber: string;
  customerName: string;
  itemsSummary: string;
  totalAed: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  date: string;
}

export default async function OrdersPage() {
  const auth = await verifyServerSession();

  let orders: OrderItem[] = [];
  let totalRevenue = 0;
  let inProductionCount = 0;
  let completedCount = 0;

  if (sql) {
    try {
      const rows = await sql`
        SELECT record_id, data, updated_at
        FROM ledger_collections
        WHERE collection_name = 'invoices'
        ORDER BY updated_at DESC
        LIMIT 50;
      `.catch(() => []);

      orders = rows.map((r: any) => {
        const d = r.data || {};
        const items = Array.isArray(d.items) ? d.items.map((i: any) => i.name || "Custom Print").join(", ") : "3D Printed Models";
        const amt = Number(d.total || d.amount || 0);
        totalRevenue += amt;

        const isComplete = d.status === "PAID" || d.fulfillmentStatus === "DELIVERED";
        if (isComplete) completedCount++;
        else inProductionCount++;

        return {
          id: r.record_id || d.id || String(Math.random()),
          invoiceNumber: d.number || d.invoiceNumber || `INV-${r.record_id?.slice(0, 6)}`,
          customerName: d.clientName || d.customerName || "Studio Client",
          itemsSummary: items,
          totalAed: amt,
          paymentStatus: d.status || "PAID",
          fulfillmentStatus: d.fulfillmentStatus || "IN_PRODUCTION",
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
      currentPath="/admin/orders"
      title="Commercial Orders"
      breadcrumbs="Core Operations"
    >
      <PageHeader
        title="Commercial Orders & Fulfillment"
        description="Monitor commercial client contracts, manufacturing fulfillment stages, invoice creation, and courier delivery status."
        badge={{ text: "Order Lifecycle", variant: "success" }}
      />

      {/* KPI Cards Grid */}
      <div className="bm-metrics-grid">
        <MetricCard
          label="Total Commercial Orders"
          value={orders.length}
          subtext="Processed sales invoices"
          icon={Invoice01Icon}
          variant="mint"
        />
        <MetricCard
          label="In Production Queue"
          value={inProductionCount}
          subtext="Active on Bambu printers"
          icon={PrinterIcon}
          variant="coral"
        />
        <MetricCard
          label="Delivered & Completed"
          value={completedCount}
          subtext="Fulfilled client orders"
          icon={CheckmarkCircle02Icon}
          variant="lavender"
        />
        <MetricCard
          label="Commercial Order Volume"
          value={`AED ${totalRevenue.toLocaleString()}`}
          subtext="Recorded invoice totals"
          icon={CreditCardIcon}
          variant="accent"
        />
      </div>

      {/* Main Orders Table Card */}
      <div className="bm-card">
        <div className="bm-card-header">
          <div>
            <h2 className="bm-card-title">Commercial Orders Directory</h2>
            <p className="bm-card-subtitle">Active client orders linked to manufacturing production</p>
          </div>
          <span className="bm-badge bm-badge-neutral">
            <span className="bm-badge-dot" />
            {orders.length} {orders.length === 1 ? "Order" : "Orders"}
          </span>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            icon={Invoice01Icon}
            title="No Commercial Orders Logged Yet"
            description="When quotes are accepted by clients or storefront orders are placed, commercial sales invoices and fulfillment stages will be tracked here."
            badge="READY FOR ORDERS"
          />
        ) : (
          <div className="bm-table-container">
            <table className="bm-table">
              <thead>
                <tr>
                  <th>Order / Invoice #</th>
                  <th>Client</th>
                  <th>Manufactured Items</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Fulfillment</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <span style={{ fontFamily: "var(--bm-font-mono)", fontWeight: 700, fontSize: "12px", color: "var(--bm-accent)" }}>
                        {order.invoiceNumber}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>{order.customerName}</td>
                    <td style={{ color: "var(--bm-text-secondary)", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {order.itemsSummary}
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--bm-text-primary)" }}>AED {order.totalAed.toLocaleString()}</td>
                    <td>
                      <StatusBadge status={order.paymentStatus} />
                    </td>
                    <td>
                      <StatusBadge status={order.fulfillmentStatus} />
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--bm-text-muted)", whiteSpace: "nowrap" }}>{order.date}</td>
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
