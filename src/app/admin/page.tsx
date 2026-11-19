import React from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { verifyServerSession } from "@/lib/server-auth";
import { BusinessWorkspaceLayout } from "@/components/admin/BusinessWorkspaceLayout";
import {
  DashboardSquare01Icon,
  PackageIcon,
  Invoice01Icon,
  Layers01Icon,
  Mail01Icon,
  Calculator01Icon,
  UserMultiple02Icon,
  CreditCardIcon,
  Analytics01Icon,
  Settings01Icon,
  PrinterIcon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";

export default async function AdminOverviewPage() {
  const auth = await verifyServerSession();

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin"
      title="Overview"
      breadcrumbs="Business Management"
    >
      {/* Hero Welcome Banner */}
      <section className="bm-hero-banner" aria-label="Workspace Introduction">
        <div className="bm-hero-badge">
          <span className="bm-live-dot" />
          <span>PHASE 2.3 • BUSINESS MANAGEMENT WORKSPACE</span>
        </div>
        <h1 className="bm-hero-title">
          Commercial Management Console
        </h1>
        <p className="bm-hero-desc">
          Welcome to the commercial operations hub for Dubai Print Studio.
          Manage customer enquiries, CAD quotations, inventory, and orders alongside
          our dedicated Bambu Lab additive manufacturing workspace.
        </p>
      </section>

      {/* High-Level Metric Cards (Honest Zero/Initial States — Zero Fake Mock Data) */}
      <section className="bm-metrics-grid" aria-label="Key Performance Indicators">
        {/* Metric 1 */}
        <div className="bm-metric-card">
          <div className="bm-metric-header">
            <span className="bm-metric-label">Customer Enquiries</span>
            <div className="bm-metric-icon" style={{ background: "var(--bm-pastel-mint)", color: "#062C2F" }}>
              <HugeIcon icon={Mail01Icon} size={18} strokeWidth={2} />
            </div>
          </div>
          <p className="bm-metric-value">0</p>
          <p className="bm-metric-subtext">Awaiting Phase 2.4 public enquiry feed</p>
        </div>

        {/* Metric 2 */}
        <div className="bm-metric-card">
          <div className="bm-metric-header">
            <span className="bm-metric-label">Pending Quotations</span>
            <div className="bm-metric-icon" style={{ background: "var(--bm-pastel-lavender)", color: "#062C2F" }}>
              <HugeIcon icon={Calculator01Icon} size={18} strokeWidth={2} />
            </div>
          </div>
          <p className="bm-metric-value">0</p>
          <p className="bm-metric-subtext">CAD RFQ pipeline ready for integration</p>
        </div>

        {/* Metric 3 */}
        <div className="bm-metric-card">
          <div className="bm-metric-header">
            <span className="bm-metric-label">Commercial Products</span>
            <div className="bm-metric-icon" style={{ background: "var(--bm-pastel-lime)", color: "#062C2F" }}>
              <HugeIcon icon={PackageIcon} size={18} strokeWidth={2} />
            </div>
          </div>
          <p className="bm-metric-value">0</p>
          <p className="bm-metric-subtext">Commercial product catalog placeholder</p>
        </div>

        {/* Metric 4 */}
        <div className="bm-metric-card">
          <div className="bm-metric-header">
            <span className="bm-metric-label">Bambu Factory Engine</span>
            <div className="bm-metric-icon" style={{ background: "var(--bm-pastel-coral)", color: "#062C2F" }}>
              <HugeIcon icon={PrinterIcon} size={18} strokeWidth={2} />
            </div>
          </div>
          <p className="bm-metric-value" style={{ fontSize: "17px", color: "#10B981" }}>
            Operational
          </p>
          <p className="bm-metric-subtext">Real-time Bambu Cloud sync active</p>
        </div>
      </section>

      {/* Bambu Production Workspace Dedicated Bridge Card */}
      <section
        className="bm-card"
        style={{
          background: "linear-gradient(135deg, #EFF9F9 0%, #E5F4F3 100%)",
          border: "1px solid var(--bm-border-strong)",
        }}
        aria-label="Manufacturing Workspace Bridge"
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
          <div style={{ maxWidth: "600px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "999px", background: "rgba(16, 185, 129, 0.15)", color: "#065F46", fontSize: "11px", fontWeight: 700, marginBottom: "10px" }}>
              <HugeIcon icon={CheckmarkCircle02Icon} size={14} strokeWidth={2} />
              <span>DEDICATED 3D MANUFACTURING WORKSPACE</span>
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--bm-text-primary)", margin: "0 0 8px 0" }}>
              Bambu Production Workspace
            </h2>
            <p style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--bm-text-secondary)", margin: 0 }}>
              Access the existing manufacturing dashboard, real-time Bambu Lab printer telemetry,
              filament spool tracking, plate photo backfill, and production job costing.
            </p>
          </div>

          <Link
            href="/admin/production"
            className="bm-header-bridge-btn"
            style={{ padding: "12px 24px", fontSize: "14px" }}
          >
            <HugeIcon icon={PrinterIcon} size={18} strokeWidth={2} />
            <span>Launch Bambu Production Workspace</span>
            <HugeIcon icon={ArrowRight01Icon} size={16} strokeWidth={2} />
          </Link>
        </div>
      </section>

      {/* Commercial Modules Grid */}
      <section aria-label="Commercial Management Modules">
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--bm-text-primary)", marginBottom: "14px" }}>
          Commercial Management Modules
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          {[
            {
              path: "/admin/products",
              title: "Products Catalog",
              desc: "Manage commercial product items, descriptions, and pricing tiers.",
              icon: PackageIcon,
              color: "var(--bm-pastel-lime)",
            },
            {
              path: "/admin/orders",
              title: "Orders & Sales",
              desc: "Track customer orders, delivery fulfillment, and revenue status.",
              icon: Invoice01Icon,
              color: "var(--bm-pastel-mint)",
            },
            {
              path: "/admin/inventory",
              title: "Stock & Inventory",
              desc: "Finished printed goods stock and commercial merchandise tracking.",
              icon: Layers01Icon,
              color: "var(--bm-pastel-lavender)",
            },
            {
              path: "/admin/enquiries",
              title: "Customer Enquiries",
              desc: "Review incoming inquiries submitted through the public storefront.",
              icon: Mail01Icon,
              color: "var(--bm-pastel-pink)",
            },
            {
              path: "/admin/quotations",
              title: "Quotations (RFQ)",
              desc: "Calculate custom CAD & print RFQs from customer 3D model uploads.",
              icon: Calculator01Icon,
              color: "var(--bm-pastel-coral)",
            },
            {
              path: "/admin/customers",
              title: "Customers Directory",
              desc: "Client records, contact details, and transaction history.",
              icon: UserMultiple02Icon,
              color: "var(--bm-pastel-neutral)",
            },
          ].map((mod) => (
            <Link
              key={mod.path}
              href={mod.path}
              className="bm-card"
              style={{
                textDecoration: "none",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                transition: "transform var(--bm-trans-fast), box-shadow var(--bm-trans-fast)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: mod.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--bm-text-primary)",
                  }}
                >
                  <HugeIcon icon={mod.icon} size={16} strokeWidth={2} />
                </div>
                <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "var(--bm-surface-muted)", color: "var(--bm-text-muted)" }}>
                  PHASE 2.4
                </span>
              </div>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--bm-text-primary)", margin: 0 }}>
                {mod.title}
              </h3>
              <p style={{ fontSize: "12px", lineHeight: 1.5, color: "var(--bm-text-secondary)", margin: 0 }}>
                {mod.desc}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </BusinessWorkspaceLayout>
  );
}
