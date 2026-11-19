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
  Mail01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Calculator01Icon,
  ArrowRight01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";

interface EnquiryRecord {
  id: number | string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

export default async function EnquiriesPage() {
  const auth = await verifyServerSession();

  let enquiries: EnquiryRecord[] = [];
  let totalCount = 0;
  let newCount = 0;
  let quotedCount = 0;

  if (sql) {
    try {
      const rows = await sql`
        SELECT id, customer_name, customer_email, customer_phone, subject, message, status, created_at
        FROM public.store_enquiries
        ORDER BY created_at DESC
        LIMIT 50;
      `.catch(() => []);

      enquiries = rows.map((r: any) => ({
        id: r.id,
        customer_name: r.customer_name,
        customer_email: r.customer_email,
        customer_phone: r.customer_phone,
        subject: r.subject,
        message: r.message,
        status: r.status || "NEW",
        created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      }));

      totalCount = enquiries.length;
      newCount = enquiries.filter((e) => e.status === "NEW").length;
      quotedCount = enquiries.filter((e) => e.status === "QUOTED").length;
    } catch {
      // Graceful fallback if table does not exist yet
    }
  }

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin/enquiries"
      title="Customer Enquiries"
      breadcrumbs="Sales & Pipeline"
    >
      <PageHeader
        title="Customer Enquiries"
        description="Review inbound inquiries and commercial manufacturing requests submitted via the public storefront."
        badge={{ text: "Storefront Inbox", variant: "accent" }}
      />

      {/* Metric Cards Grid */}
      <div className="bm-metrics-grid">
        <MetricCard
          label="Total Inbound"
          value={totalCount}
          subtext="Storefront inquiries received"
          icon={Mail01Icon}
          variant="mint"
        />
        <MetricCard
          label="Awaiting Response"
          value={newCount}
          subtext="Pending client triage"
          icon={Clock01Icon}
          variant="coral"
        />
        <MetricCard
          label="Converted to Quote"
          value={quotedCount}
          subtext="Advanced to CAD quotation"
          icon={Calculator01Icon}
          variant="lavender"
        />
        <MetricCard
          label="Response SLA"
          value="< 4 hrs"
          subtext="Target turnaround time"
          icon={CheckmarkCircle02Icon}
          variant="accent"
        />
      </div>

      {/* Main Enquiries Content Card */}
      <div className="bm-card">
        <div className="bm-card-header">
          <div>
            <h2 className="bm-card-title">Inbound Message Inbox</h2>
            <p className="bm-card-subtitle">Real-time triage of public storefront inquiries</p>
          </div>
          <span className="bm-badge bm-badge-neutral">
            <span className="bm-badge-dot" />
            {enquiries.length} {enquiries.length === 1 ? "Message" : "Messages"}
          </span>
        </div>

        {enquiries.length === 0 ? (
          <EmptyState
            icon={Mail01Icon}
            title="No Inquiries in Queue"
            description="Your storefront enquiry feed is active. When prospective clients submit inquiries via your website, they will appear here in real time for triage."
            badge="INBOX READY"
          />
        ) : (
          <div className="bm-table-container">
            <table className="bm-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Subject</th>
                  <th>Message Preview</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enquiries.map((enq) => (
                  <tr key={enq.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>
                        {enq.customer_name}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--bm-text-muted)" }}>
                        {enq.customer_email}
                      </div>
                    </td>
                    <td style={{ fontWeight: 500, color: "var(--bm-text-primary)", maxWidth: "220px" }}>
                      {enq.subject}
                    </td>
                    <td style={{ color: "var(--bm-text-secondary)", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {enq.message}
                    </td>
                    <td>
                      <StatusBadge status={enq.status} />
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--bm-text-muted)", whiteSpace: "nowrap" }}>
                      {new Date(enq.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link
                        href={`mailto:${enq.customer_email}?subject=Re: ${encodeURIComponent(enq.subject)}`}
                        className="bm-btn bm-btn-secondary"
                        style={{ padding: "4px 10px", fontSize: "11px", marginRight: "6px" }}
                      >
                        Reply
                      </Link>
                      <Link
                        href="/admin/quotations"
                        className="bm-btn bm-btn-primary"
                        style={{ padding: "4px 10px", fontSize: "11px" }}
                      >
                        Convert to RFQ
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
