import React from "react";
import Link from "next/link";
import { verifyServerSession } from "@/lib/server-auth";
import { BusinessWorkspaceLayout } from "@/components/admin/BusinessWorkspaceLayout";
import { sql } from "@/lib/db";
import {
  PackageIcon,
  Mail01Icon,
  Calculator01Icon,
  PrinterIcon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  PlusSignIcon,
  Image01Icon,
  InstagramIcon,
  Layers01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";

interface ActivityItem {
  id: string;
  type: "enquiry" | "quote" | "product";
  title: string;
  customerOrMeta: string;
  status: string;
  date: string;
  href: string;
}

export default async function AdminOverviewPage() {
  const auth = await verifyServerSession();

  let enquiriesCount = 0;
  let pendingQuotesCount = 0;
  let productsCount = 0;
  let publishedProductsCount = 0;
  let recentActivities: ActivityItem[] = [];

  if (sql) {
    try {
      // 1. Enquiries count & recent entries
      const enqRows = await sql`
        SELECT id, customer_name, subject, status, created_at 
        FROM public.store_enquiries 
        ORDER BY created_at DESC 
        LIMIT 4;
      `.catch(() => []);

      const enqTotal = await sql`
        SELECT count(*)::int as count FROM public.store_enquiries;
      `.catch(() => [{ count: 0 }]);

      enquiriesCount = Number(enqTotal[0]?.count || 0);

      enqRows.forEach((r: any) => {
        recentActivities.push({
          id: `enq-${r.id}`,
          type: "enquiry",
          title: r.subject || "Customer Inquiry",
          customerOrMeta: r.customer_name || "Prospective Client",
          status: r.status || "NEW",
          date: r.created_at ? new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Recent",
          href: "/admin/enquiries",
        });
      });
    } catch {
      // Graceful fallback
    }

    try {
      // 2. Quotes count & recent entries
      const quoteRows = await sql`
        SELECT id, rfq_reference, customer_name, project_title, status, created_at 
        FROM public.store_quotes 
        ORDER BY created_at DESC 
        LIMIT 4;
      `.catch(() => []);

      const quoteTotal = await sql`
        SELECT count(*)::int as count FROM public.store_quotes;
      `.catch(() => [{ count: 0 }]);

      pendingQuotesCount = Number(quoteTotal[0]?.count || 0);

      quoteRows.forEach((r: any) => {
        recentActivities.push({
          id: `quote-${r.id}`,
          type: "quote",
          title: r.project_title || r.rfq_reference || "Custom CAD Print RFQ",
          customerOrMeta: r.customer_name || "Client RFQ",
          status: r.status || "PENDING_REVIEW",
          date: r.created_at ? new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Recent",
          href: "/admin/quotations",
        });
      });
    } catch {
      // Graceful fallback
    }

    try {
      // 3. Products in ledger_collections
      const productRows = await sql`
        SELECT data FROM ledger_collections WHERE collection_name = 'products';
      `.catch(() => []);

      productsCount = productRows.length;
      publishedProductsCount = productRows.filter((r: any) => r.data?.published).length;
    } catch {
      // Graceful fallback
    }
  }

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin"
      title="Overview"
      breadcrumbs="Business Management"
    >
      {/* KPI Cards Grid */}
      <section className="bm-metrics-grid" aria-label="Key Operational Indicators">
        <MetricCard
          label="Active Enquiries"
          value={enquiriesCount}
          subtext="Storefront client communications"
          icon={Mail01Icon}
          variant="mint"
        />

        <MetricCard
          label="Pending Quotations"
          value={pendingQuotesCount}
          subtext="CAD RFQ engineering pipeline"
          icon={Calculator01Icon}
          variant="coral"
        />

        <MetricCard
          label="Commercial Products"
          value={productsCount}
          subtext={`${publishedProductsCount} published on storefront`}
          icon={PackageIcon}
          variant="lavender"
        />

        <MetricCard
          label="Bambu Factory Engine"
          value="Operational"
          subtext="Bambu Cloud MQTT telemetry active"
          icon={PrinterIcon}
          variant="accent"
        />
      </section>

      {/* Two-Column Operational Dashboard Layout */}
      <section className="bm-dashboard-grid" aria-label="Operational Activity and Storefront Summary">
        {/* Left Column: Recent Activity Feed (65%) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="bm-card">
            <div className="bm-card-header">
              <div>
                <h2 className="bm-card-title">Recent Commercial Activity</h2>
                <p className="bm-card-subtitle">Latest incoming enquiries and quotation requests</p>
              </div>
              <Link href="/admin/enquiries" className="bm-card-action-btn">
                <span>View Inbox</span>
                <HugeIcon icon={ArrowRight01Icon} size={12} strokeWidth={2} />
              </Link>
            </div>

            {recentActivities.length === 0 ? (
              <div
                style={{
                  padding: "36px 20px",
                  textAlign: "center",
                  background: "var(--bm-surface-muted)",
                  borderRadius: "var(--bm-radius-md)",
                  border: "1px dashed var(--bm-border-strong)",
                }}
              >
                <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--bm-text-primary)", margin: "0 0 4px 0" }}>
                  Awaiting Inbound Requests
                </p>
                <p style={{ fontSize: "12px", color: "var(--bm-text-secondary)", margin: 0 }}>
                  Customer enquiries and custom CAD quote requests submitted on the public storefront will appear here live.
                </p>
              </div>
            ) : (
              <div className="bm-table-container">
                <table className="bm-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Subject / Project</th>
                      <th>Client</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActivities.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              color: item.type === "quote" ? "var(--bm-accent)" : "var(--bm-info)",
                            }}
                          >
                            {item.type === "quote" ? "CAD RFQ" : "Enquiry"}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>{item.title}</td>
                        <td style={{ color: "var(--bm-text-secondary)" }}>{item.customerOrMeta}</td>
                        <td>
                          <StatusBadge status={item.status} />
                        </td>
                        <td style={{ fontSize: "12px", color: "var(--bm-text-muted)" }}>{item.date}</td>
                        <td style={{ textAlign: "right" }}>
                          <Link
                            href={item.href}
                            style={{
                              fontSize: "12px",
                              color: "var(--bm-accent)",
                              textDecoration: "none",
                              fontWeight: 600,
                            }}
                          >
                            Review →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Operational Workflow Card */}
          <div className="bm-card">
            <h2 className="bm-card-title" style={{ marginBottom: "12px" }}>
              Studio Fulfillment Pipeline
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
              }}
            >
              <div style={{ background: "var(--bm-surface-muted)", padding: "14px", borderRadius: "var(--bm-radius-md)", border: "1px solid var(--bm-border)" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--bm-text-muted)", textTransform: "uppercase" }}>Stage 1</span>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--bm-text-primary)", margin: "4px 0" }}>Inbound RFQ</p>
                <p style={{ fontSize: "11px", color: "var(--bm-text-secondary)", margin: 0 }}>Review customer specifications and CAD files</p>
              </div>

              <div style={{ background: "var(--bm-surface-muted)", padding: "14px", borderRadius: "var(--bm-radius-md)", border: "1px solid var(--bm-border)" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--bm-text-muted)", textTransform: "uppercase" }}>Stage 2</span>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--bm-text-primary)", margin: "4px 0" }}>Price Quotation</p>
                <p style={{ fontSize: "11px", color: "var(--bm-text-secondary)", margin: 0 }}>Calculate filament cost, machine time & margin</p>
              </div>

              <div style={{ background: "var(--bm-surface-muted)", padding: "14px", borderRadius: "var(--bm-radius-md)", border: "1px solid var(--bm-border)" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--bm-text-muted)", textTransform: "uppercase" }}>Stage 3</span>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--bm-text-primary)", margin: "4px 0" }}>Bambu Print Queue</p>
                <p style={{ fontSize: "11px", color: "var(--bm-text-secondary)", margin: 0 }}>Dispatch print task to X1C/P1S factory printers</p>
              </div>

              <div style={{ background: "var(--bm-surface-muted)", padding: "14px", borderRadius: "var(--bm-radius-md)", border: "1px solid var(--bm-border)" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--bm-text-muted)", textTransform: "uppercase" }}>Stage 4</span>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--bm-text-primary)", margin: "4px 0" }}>Client Delivery</p>
                <p style={{ fontSize: "11px", color: "var(--bm-text-secondary)", margin: 0 }}>Quality inspection, tax invoice & UAE courier dispatch</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Storefront Status & Quick Actions (35%) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Storefront Overview Card */}
          <div className="bm-card">
            <div className="bm-card-header">
              <div>
                <h2 className="bm-card-title">Commercial Storefront</h2>
                <p className="bm-card-subtitle">Public digital presence and catalog health</p>
              </div>
              <span className="bm-badge bm-badge-success">
                <span className="bm-badge-dot" />
                Live in UAE
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px",
                  background: "var(--bm-surface-muted)",
                  borderRadius: "var(--bm-radius-md)",
                  border: "1px solid var(--bm-border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--bm-accent-soft)", color: "var(--bm-accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <HugeIcon icon={PackageIcon} size={16} />
                  </div>
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--bm-text-primary)", display: "block" }}>
                      Catalog Products
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--bm-text-muted)" }}>
                      {publishedProductsCount} active out of {productsCount}
                    </span>
                  </div>
                </div>
                <Link href="/admin/products" className="bm-btn bm-btn-secondary" style={{ padding: "5px 12px", fontSize: "11px" }}>
                  Manage
                </Link>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px",
                  background: "var(--bm-surface-muted)",
                  borderRadius: "var(--bm-radius-md)",
                  border: "1px solid var(--bm-border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--bm-pastel-pink)", color: "#9D174D", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <HugeIcon icon={InstagramIcon} size={16} />
                  </div>
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--bm-text-primary)", display: "block" }}>
                      Instagram Showcase
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--bm-text-muted)" }}>
                      Curated store gallery
                    </span>
                  </div>
                </div>
                <Link href="/admin/instagram" className="bm-btn bm-btn-secondary" style={{ padding: "5px 12px", fontSize: "11px" }}>
                  Curate
                </Link>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px",
                  background: "var(--bm-surface-muted)",
                  borderRadius: "var(--bm-radius-md)",
                  border: "1px solid var(--bm-border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--bm-pastel-lavender)", color: "#3730A3", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <HugeIcon icon={Image01Icon} size={16} />
                  </div>
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--bm-text-primary)", display: "block" }}>
                      Cloudflare R2 Media
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--bm-text-muted)" }}>
                      High-resolution render assets
                    </span>
                  </div>
                </div>
                <Link href="/admin/media" className="bm-btn bm-btn-secondary" style={{ padding: "5px 12px", fontSize: "11px" }}>
                  Library
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Actions Shortcuts */}
          <div className="bm-card">
            <h2 className="bm-card-title" style={{ marginBottom: "12px" }}>
              Operational Shortcuts
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Link
                href="/admin/products"
                className="bm-btn bm-btn-primary"
                style={{ width: "100%", justifyContent: "flex-start", boxSizing: "border-box" }}
              >
                <HugeIcon icon={PlusSignIcon} size={16} strokeWidth={2} />
                <span>Create Commercial Product</span>
              </Link>

              <Link
                href="/admin/quotations"
                className="bm-btn bm-btn-secondary"
                style={{ width: "100%", justifyContent: "flex-start", boxSizing: "border-box" }}
              >
                <HugeIcon icon={Calculator01Icon} size={16} strokeWidth={2} />
                <span>Review Pending RFQ Quotes</span>
              </Link>

              <Link
                href="/admin/production"
                className="bm-btn bm-btn-secondary"
                style={{
                  width: "100%",
                  justifyContent: "flex-start",
                  boxSizing: "border-box",
                  borderColor: "var(--bm-accent)",
                  color: "var(--bm-accent)",
                  background: "var(--bm-accent-soft)",
                }}
              >
                <HugeIcon icon={PrinterIcon} size={16} strokeWidth={2} />
                <span>Open Bambu Production Workspace →</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </BusinessWorkspaceLayout>
  );
}
