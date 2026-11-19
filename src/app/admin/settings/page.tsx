import React from "react";
import Link from "next/link";
import { verifyServerSession } from "@/lib/server-auth";
import { BusinessWorkspaceLayout } from "@/components/admin/BusinessWorkspaceLayout";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import {
  Settings01Icon,
  PrinterIcon,
  CheckmarkCircle02Icon,
  CreditCardIcon,
  Layers01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";

export default async function SettingsPage() {
  const auth = await verifyServerSession();

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin/settings"
      title="Settings"
      breadcrumbs="System"
    >
      <PageHeader
        title="Commercial Studio Settings"
        description="Studio business profile, currency & VAT configuration, storefront policies, and additive manufacturing integration status."
        badge={{ text: "Configuration", variant: "neutral" }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px", maxWidth: "900px" }}>
        {/* Business Identity */}
        <div className="bm-card">
          <h2 className="bm-card-title" style={{ marginBottom: "4px" }}>
            Studio Commercial Profile
          </h2>
          <p className="bm-card-subtitle" style={{ marginBottom: "16px" }}>
            Commercial identity shown on customer invoices, quotations, and public storefront
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "6px" }}>
                Studio Legal Name
              </label>
              <input
                type="text"
                readOnly
                defaultValue="Print Studio Dubai FZ-LLC"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "var(--bm-radius-md)",
                  border: "1px solid var(--bm-border)",
                  background: "var(--bm-surface-muted)",
                  color: "var(--bm-text-primary)",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "6px" }}>
                Operating Jurisdiction
              </label>
              <input
                type="text"
                readOnly
                defaultValue="Dubai, United Arab Emirates"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "var(--bm-radius-md)",
                  border: "1px solid var(--bm-border)",
                  background: "var(--bm-surface-muted)",
                  color: "var(--bm-text-primary)",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "6px" }}>
                Commercial Currency
              </label>
              <input
                type="text"
                readOnly
                defaultValue="AED (United Arab Emirates Dirham)"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "var(--bm-radius-md)",
                  border: "1px solid var(--bm-border)",
                  background: "var(--bm-surface-muted)",
                  color: "var(--bm-text-primary)",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "6px" }}>
                Federal Tax Authority (FTA) TRN
              </label>
              <input
                type="text"
                readOnly
                defaultValue="100-XXXX-XXXX-0003"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "var(--bm-radius-md)",
                  border: "1px solid var(--bm-border)",
                  background: "var(--bm-surface-muted)",
                  color: "var(--bm-text-primary)",
                  fontSize: "13px",
                  boxSizing: "border-box",
                  fontFamily: "var(--bm-font-mono)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Bambu Production Bridge */}
        <div className="bm-card">
          <div className="bm-card-header">
            <div>
              <h2 className="bm-card-title">Bambu Lab Production Bridge</h2>
              <p className="bm-card-subtitle">Integration between commercial orders and additive manufacturing</p>
            </div>
            <StatusBadge status="OPERATIONAL" />
          </div>

          <div
            style={{
              padding: "16px",
              background: "var(--bm-surface-muted)",
              borderRadius: "var(--bm-radius-md)",
              border: "1px solid var(--bm-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "var(--bm-accent-soft)",
                  color: "var(--bm-accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <HugeIcon icon={PrinterIcon} size={20} strokeWidth={2} />
              </div>
              <div>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--bm-text-primary)", margin: "0 0 2px 0" }}>
                  Bambu Cloud & MQTT Factory Engine
                </p>
                <p style={{ fontSize: "12px", color: "var(--bm-text-secondary)", margin: 0 }}>
                  Real-time synchronization for print jobs, filament spools, and printer status
                </p>
              </div>
            </div>

            <Link href="/admin/production" className="bm-btn bm-btn-primary">
              <span>Open Bambu Production Workspace →</span>
            </Link>
          </div>
        </div>
      </div>
    </BusinessWorkspaceLayout>
  );
}
