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
  UserMultiple02Icon,
  CheckmarkCircle02Icon,
  Mail01Icon,
  Invoice01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";

interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  type: "B2B" | "Retail";
  totalOrders: number;
  totalSpent: number;
  lastActive: string;
}

export default async function CustomersPage() {
  const auth = await verifyServerSession();

  let customers: CustomerProfile[] = [];
  const clientMap = new Map<string, CustomerProfile>();

  if (sql) {
    try {
      // 1. Gather clients from invoices
      const invoiceRows = await sql`
        SELECT record_id, data, updated_at
        FROM ledger_collections
        WHERE collection_name = 'invoices'
        ORDER BY updated_at DESC;
      `.catch(() => []);

      invoiceRows.forEach((r: any) => {
        const d = r.data || {};
        const email = (d.clientEmail || d.customerEmail || "").trim().toLowerCase();
        const name = (d.clientName || d.customerName || "").trim();
        const amt = Number(d.total || d.amount || 0);

        if (email || name) {
          const key = email || name;
          const existing = clientMap.get(key);
          if (existing) {
            existing.totalOrders += 1;
            existing.totalSpent += amt;
          } else {
            clientMap.set(key, {
              id: key,
              name: name || "Studio Client",
              email: email || "Direct Studio Contact",
              phone: d.phone,
              company: d.company,
              type: amt > 1000 ? "B2B" : "Retail",
              totalOrders: 1,
              totalSpent: amt,
              lastActive: r.updated_at ? new Date(r.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Recent",
            });
          }
        }
      });

      // 2. Gather clients from quotes
      const quoteRows = await sql`
        SELECT customer_name, customer_email, customer_phone, created_at
        FROM public.store_quotes
        LIMIT 50;
      `.catch(() => []);

      quoteRows.forEach((q: any) => {
        const email = (q.customer_email || "").trim().toLowerCase();
        const name = (q.customer_name || "").trim();
        if (email || name) {
          const key = email || name;
          if (!clientMap.has(key)) {
            clientMap.set(key, {
              id: key,
              name: name || "Prospective Client",
              email: email || "Storefront RFQ",
              phone: q.customer_phone,
              type: "Retail",
              totalOrders: 0,
              totalSpent: 0,
              lastActive: q.created_at ? new Date(q.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Recent",
            });
          }
        }
      });

      customers = Array.from(clientMap.values());
    } catch {
      // Graceful fallback
    }
  }

  const b2bCount = customers.filter((c) => c.type === "B2B").length;

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin/customers"
      title="Customers"
      breadcrumbs="Sales & Clients"
    >
      <PageHeader
        title="Commercial Customer Directory"
        description="Maintain client relationships, corporate accounts, order histories, and custom manufacturing project profiles."
        badge={{ text: "Client Relations", variant: "info" }}
      />

      {/* KPI Cards Grid */}
      <div className="bm-metrics-grid">
        <MetricCard
          label="Total Clients"
          value={customers.length}
          subtext="Commercial buyers & RFQs"
          icon={UserMultiple02Icon}
          variant="mint"
        />
        <MetricCard
          label="Corporate / B2B"
          value={b2bCount}
          subtext="High-volume print buyers"
          icon={Invoice01Icon}
          variant="coral"
        />
        <MetricCard
          label="Repeat Orders"
          value={customers.filter((c) => c.totalOrders > 1).length}
          subtext="Multi-order accounts"
          icon={CheckmarkCircle02Icon}
          variant="lavender"
        />
        <MetricCard
          label="Delivery Accuracy"
          value="100%"
          subtext="Studio on-time fulfillment"
          icon={CheckmarkCircle02Icon}
          variant="accent"
        />
      </div>

      {/* Main Customers Card */}
      <div className="bm-card">
        <div className="bm-card-header">
          <div>
            <h2 className="bm-card-title">Commercial Accounts Directory</h2>
            <p className="bm-card-subtitle">Unified registry of past clients, quote requesters, and retail purchasers</p>
          </div>
          <span className="bm-badge bm-badge-neutral">
            <span className="bm-badge-dot" />
            {customers.length} {customers.length === 1 ? "Client" : "Clients"}
          </span>
        </div>

        {customers.length === 0 ? (
          <EmptyState
            icon={UserMultiple02Icon}
            title="No Clients Registered Yet"
            description="When clients submit CAD quote requests, storefront inquiries, or commercial order invoices, their client profiles will appear here."
            badge="DIRECTORY READY"
          />
        ) : (
          <div className="bm-table-container">
            <table className="bm-table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Contact Email</th>
                  <th>Account Type</th>
                  <th>Total Orders</th>
                  <th>Cumulative Revenue</th>
                  <th>Last Active</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>{c.name}</div>
                      {c.company && (
                        <div style={{ fontSize: "11px", color: "var(--bm-text-muted)" }}>{c.company}</div>
                      )}
                    </td>
                    <td style={{ color: "var(--bm-text-secondary)" }}>{c.email}</td>
                    <td>
                      <span
                        className={`bm-badge ${c.type === "B2B" ? "bm-badge-info" : "bm-badge-neutral"}`}
                      >
                        <span className="bm-badge-dot" />
                        {c.type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{c.totalOrders} {c.totalOrders === 1 ? "order" : "orders"}</td>
                    <td style={{ fontWeight: 700, color: "var(--bm-text-primary)" }}>
                      AED {c.totalSpent.toLocaleString()}
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--bm-text-muted)" }}>{c.lastActive}</td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        href={`mailto:${c.email}`}
                        className="bm-btn bm-btn-secondary"
                        style={{ padding: "4px 10px", fontSize: "11px" }}
                      >
                        Contact
                      </Link>
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
