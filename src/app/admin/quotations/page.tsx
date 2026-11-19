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
  Calculator01Icon,
  Clock01Icon,
  CheckmarkCircle02Icon,
  Layers01Icon,
  ArrowRight01Icon,
  FileCodeIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";

interface QuoteRecord {
  id: number | string;
  rfq_reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  project_title: string;
  project_description?: string;
  material_preference?: string;
  color_preference?: string;
  quantity: number;
  target_deadline?: string;
  status: string;
  created_at: string;
}

export default async function QuotationsPage() {
  const auth = await verifyServerSession();

  let quotes: QuoteRecord[] = [];
  let totalCount = 0;
  let pendingCount = 0;
  let quotedCount = 0;

  if (sql) {
    try {
      const rows = await sql`
        SELECT id, rfq_reference, customer_name, customer_email, customer_phone,
               project_title, project_description, material_preference, color_preference,
               quantity, target_deadline, status, created_at
        FROM public.store_quotes
        ORDER BY created_at DESC
        LIMIT 50;
      `.catch(() => []);

      quotes = rows.map((r: any) => ({
        id: r.id,
        rfq_reference: r.rfq_reference,
        customer_name: r.customer_name,
        customer_email: r.customer_email,
        customer_phone: r.customer_phone,
        project_title: r.project_title,
        project_description: r.project_description,
        material_preference: r.material_preference,
        color_preference: r.color_preference,
        quantity: Number(r.quantity || 1),
        target_deadline: r.target_deadline,
        status: r.status || "PENDING_REVIEW",
        created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      }));

      totalCount = quotes.length;
      pendingCount = quotes.filter((q) => q.status === "PENDING_REVIEW").length;
      quotedCount = quotes.filter((q) => q.status === "QUOTED" || q.status === "ACCEPTED").length;
    } catch {
      // Graceful fallback
    }
  }

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin/quotations"
      title="Quotations"
      breadcrumbs="Sales & Pipeline"
    >
      <PageHeader
        title="Custom Quotations & RFQs"
        description="Engineering review, filament calculation, machine run-time estimation, and quotation dispatch for custom CAD manufacturing requests."
        badge={{ text: "CAD RFQ Pipeline", variant: "warning" }}
      />

      {/* KPI Cards Grid */}
      <div className="bm-metrics-grid">
        <MetricCard
          label="Total CAD RFQs"
          value={totalCount}
          subtext="Inbound 3D print projects"
          icon={Calculator01Icon}
          variant="mint"
        />
        <MetricCard
          label="Awaiting Engineering Review"
          value={pendingCount}
          subtext="Unquoted client projects"
          icon={Clock01Icon}
          variant="coral"
        />
        <MetricCard
          label="Quotes Dispatched"
          value={quotedCount}
          subtext="Client approved or sent"
          icon={CheckmarkCircle02Icon}
          variant="lavender"
        />
        <MetricCard
          label="Standard Studio Margin"
          value="65%"
          subtext="Target commercial markup"
          icon={Layers01Icon}
          variant="accent"
        />
      </div>

      {/* Main Quotations Card */}
      <div className="bm-card">
        <div className="bm-card-header">
          <div>
            <h2 className="bm-card-title">Active CAD Quotation Requests</h2>
            <p className="bm-card-subtitle">Detailed client specifications and estimated production parameters</p>
          </div>
          <span className="bm-badge bm-badge-neutral">
            <span className="bm-badge-dot" />
            {quotes.length} {quotes.length === 1 ? "Project" : "Projects"}
          </span>
        </div>

        {quotes.length === 0 ? (
          <EmptyState
            icon={Calculator01Icon}
            title="No Pending Quotation Requests"
            description="When clients submit custom CAD 3D models (STEP, STL, OBJ) via the public RFQ portal, their specifications and project files will be staged here for pricing calculation."
            badge="RFQ PIPELINE ACTIVE"
          />
        ) : (
          <div className="bm-table-container">
            <table className="bm-table">
              <thead>
                <tr>
                  <th>RFQ Reference</th>
                  <th>Client</th>
                  <th>Project / CAD Model</th>
                  <th>Material & Color</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td>
                      <span style={{ fontFamily: "var(--bm-font-mono)", fontWeight: 700, fontSize: "12px", color: "var(--bm-accent)" }}>
                        {quote.rfq_reference}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>{quote.customer_name}</div>
                      <div style={{ fontSize: "11px", color: "var(--bm-text-muted)" }}>{quote.customer_email}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>{quote.project_title}</div>
                      {quote.project_description && (
                        <div style={{ fontSize: "11px", color: "var(--bm-text-secondary)", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {quote.project_description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: "12px", color: "var(--bm-text-primary)", fontWeight: 500 }}>
                        {quote.material_preference || "Standard PLA"}
                      </span>
                      {quote.color_preference && (
                        <div style={{ fontSize: "11px", color: "var(--bm-text-muted)" }}>{quote.color_preference}</div>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>{quote.quantity} pcs</td>
                    <td>
                      <StatusBadge status={quote.status} />
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--bm-text-muted)", whiteSpace: "nowrap" }}>
                      {new Date(quote.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link
                        href={`mailto:${quote.customer_email}?subject=Quotation: ${encodeURIComponent(quote.rfq_reference)} - ${encodeURIComponent(quote.project_title)}`}
                        className="bm-btn bm-btn-primary"
                        style={{ padding: "4px 12px", fontSize: "11px" }}
                      >
                        Prepare Quote →
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
