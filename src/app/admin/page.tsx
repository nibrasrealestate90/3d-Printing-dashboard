import React from "react";
import Link from "next/link";
import { verifyServerSession } from "@/lib/server-auth";
import { BusinessWorkspaceLayout } from "@/components/admin/BusinessWorkspaceLayout";
import { sql } from "@/lib/db";
import {
  PackageIcon,
  Invoice01Icon,
  CreditCardIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { EmptyState } from "@/components/admin/ui/EmptyState";

interface RecentOrder {
  id: string;
  invoiceNumber: string;
  customerName: string;
  amountAed: number;
  paymentStatus: string;
  date: string;
  sortTimestamp: number;
}

/**
 * Commercial Workspace Overview Dashboard
 * Displays essential store administration metrics:
 * 1. Total Orders (valid commercial sales)
 * 2. Total Revenue (billed sales volume in AED)
 * 3. Total Products (commercial catalog count)
 * 4. Recent Orders (latest 5 commercial sales orders)
 */
export default async function AdminOverviewPage() {
  const auth = await verifyServerSession();

  let totalOrdersCount = 0;
  let totalRevenueBilled = 0;
  let totalProductsCount = 0;
  let publishedProductsCount = 0;
  let recentOrders: RecentOrder[] = [];

  if (sql) {
    try {
      // 1. Fetch products from ledger_collections
      const productRows = await sql`
        SELECT record_id, data
        FROM public.ledger_collections
        WHERE collection_name = 'products';
      `.catch(() => []);

      totalProductsCount = productRows.length;
      publishedProductsCount = productRows.filter((r: any) => Boolean(r.data?.published)).length;
    } catch {
      // Graceful error fallback
    }

    try {
      // 2. Fetch commercial invoices from ledger_collections
      const invoiceRows = await sql`
        SELECT record_id, data, updated_at
        FROM public.ledger_collections
        WHERE collection_name = 'invoices'
        ORDER BY updated_at DESC;
      `.catch(() => []);

      const validSalesOrders: RecentOrder[] = [];

      for (const row of invoiceRows) {
        const d = (row.data && typeof row.data === "object") ? row.data : {};

        // Invariant: Exclude voided invoices
        const status = String(d.status || "").toLowerCase().trim();
        if (status === "void") continue;

        // Invariant: Exclude price quotations and Free-of-Charge (FOC) vouchers
        const type = String(d.type || "").toLowerCase().trim();
        if (type === "quote" || type === "foc") continue;

        // Valid sales order if type is explicitly 'sale' or omitted (legacy default)
        if (type !== "sale" && type !== "") continue;

        totalOrdersCount += 1;

        // Total Revenue: sum of valid commercial sales invoice totals, including VAT where stored or computed
        let orderTotal = 0;
        if (d.total != null && d.total !== "" && !isNaN(Number(d.total))) {
          orderTotal = Number(d.total);
        } else if (d.amount != null && d.amount !== "" && !isNaN(Number(d.amount))) {
          orderTotal = Number(d.amount);
        } else if (Array.isArray(d.lines) && d.lines.length > 0) {
          // Dynamic calculation from line items for legacy invoice structures (matches stored total definition)
          const sub = d.lines.reduce((acc: number, l: any) => {
            const qty = Number(l.qty) || 0;
            const price = Number(l.price) || 0;
            return acc + (qty * price);
          }, 0);
          const disc = Math.min(sub, Math.max(0, Number(d.discount) || 0));
          const vatPct = Number(d.vatPct ?? 5) || 0;
          const vat = ((sub - disc) * vatPct) / 100;
          orderTotal = sub - disc + vat;
        }

        if (orderTotal > 0) {
          totalRevenueBilled += orderTotal;
        }

        // Build recent order item (strictly no fabricated names or numbers)
        const rawInvNo = String(d.number || d.invoiceNumber || d.no || "").trim();
        const invNo = rawInvNo || "—";

        const rawCustomer = String(d.customerName || d.clientName || d.customer || "").trim();
        const customer = rawCustomer || "—";

        // Payment status: In ledgerCore data contract, d.status is invoice document lifecycle ("issued" | "void").
        // Check dedicated paymentStatus fields or safely derive payment status from paid vs orderTotal.
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

        const rawDate = d.date
          ? String(d.date)
          : (row.updated_at ? new Date(row.updated_at).toISOString().split("T")[0] : "");
        const sortTimestamp = d.date
          ? new Date(d.date).getTime()
          : (row.updated_at ? new Date(row.updated_at).getTime() : 0);
        const formattedDate = rawDate
          ? new Date(rawDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
          : "—";

        validSalesOrders.push({
          id: String(row.record_id || d.id || invNo),
          invoiceNumber: invNo,
          customerName: customer,
          amountAed: orderTotal,
          paymentStatus,
          date: formattedDate,
          sortTimestamp,
        });
      }

      // Sort newest first, top 5
      recentOrders = validSalesOrders
        .sort((a, b) => b.sortTimestamp - a.sortTimestamp)
        .slice(0, 5);
    } catch {
      // Graceful error fallback
    }
  }

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin"
      title="Overview"
      breadcrumbs="Business Management"
    >
      {/* 1. KPI Summary Cards Grid */}
      <section
        className="bm-metrics-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
        }}
        aria-label="Commercial Summary Metrics"
      >
        <MetricCard
          label="Total Orders"
          value={totalOrdersCount}
          subtext="Confirmed commercial sales orders"
          icon={Invoice01Icon}
          variant="mint"
        />

        <MetricCard
          label="Total Revenue"
          value={`AED ${totalRevenueBilled.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtext="Billed commercial sales volume"
          icon={CreditCardIcon}
          variant="coral"
        />

        <MetricCard
          label="Total Products"
          value={totalProductsCount}
          subtext={`${publishedProductsCount} published on storefront`}
          icon={PackageIcon}
          variant="lavender"
        />
      </section>

      {/* 2. Recent Commercial Orders Section */}
      <section style={{ marginTop: "24px" }} aria-label="Recent Commercial Orders">
        <div className="bm-card">
          <div className="bm-card-header">
            <div>
              <h2 className="bm-card-title">Recent Orders</h2>
              <p className="bm-card-subtitle">Latest confirmed sales invoices and commercial orders</p>
            </div>
            <Link href="/admin/orders" className="bm-card-action-btn">
              <span>View All Orders</span>
              <HugeIcon icon={ArrowRight01Icon} size={12} strokeWidth={2} />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <EmptyState
              icon={Invoice01Icon}
              title="No Commercial Orders Yet"
              description="When commercial sales invoices are logged or storefront orders are placed, the latest sales orders will appear here."
              actionText="Manage Commercial Orders"
              actionHref="/admin/orders"
              badge="READY FOR ORDERS"
            />
          ) : (
            <div className="bm-table-container">
              <table className="bm-table">
                <thead>
                  <tr>
                    <th>Invoice / Order Number</th>
                    <th>Customer</th>
                    <th>Amount (AED)</th>
                    <th>Payment Status</th>
                    <th>Order Date</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <span
                          style={{
                            fontFamily: "var(--bm-font-mono)",
                            fontWeight: 700,
                            fontSize: "12px",
                            color: "var(--bm-accent)",
                          }}
                        >
                          {order.invoiceNumber}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>
                        {order.customerName}
                      </td>
                      <td style={{ fontWeight: 700, color: "var(--bm-text-primary)" }}>
                        AED {order.amountAed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td>
                        <StatusBadge status={order.paymentStatus} />
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--bm-text-muted)", whiteSpace: "nowrap" }}>
                        {order.date}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link
                          href="/admin/orders"
                          style={{
                            fontSize: "12px",
                            color: "var(--bm-accent)",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          Details →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </BusinessWorkspaceLayout>
  );
}
