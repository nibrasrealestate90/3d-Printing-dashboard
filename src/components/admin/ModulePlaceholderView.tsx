"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft01Icon, ArrowRight01Icon, PrinterIcon } from "@hugeicons/core-free-icons";
import { HugeIcon, HugeIconData } from "@/components/hugeIcons";
import { BusinessWorkspaceLayout } from "./BusinessWorkspaceLayout";

export interface ModulePlaceholderViewProps {
  user?: {
    id?: string;
    email?: string;
    full_name?: string;
    role?: string;
  };
  currentPath: string;
  title: string;
  subtitle: string;
  icon: HugeIconData;
  iconBgColor: string;
  phaseTarget?: string;
  description: string;
  capabilities: string[];
}

export function ModulePlaceholderView({
  user,
  currentPath,
  title,
  subtitle,
  icon,
  iconBgColor,
  phaseTarget = "Phase 2.4",
  description,
  capabilities,
}: ModulePlaceholderViewProps) {
  return (
    <BusinessWorkspaceLayout
      user={user}
      currentPath={currentPath}
      title={title}
      breadcrumbs="Business Management"
    >
      <div className="bm-empty-card" data-testid={`module-${title.toLowerCase().replace(/\s+/g, '-')}`}>
        {/* Module Icon Badge */}
        <div
          className="bm-empty-icon"
          style={{ background: iconBgColor, color: "#062C2F" }}
        >
          <HugeIcon icon={icon} size={30} strokeWidth={2} />
        </div>

        <div className="bm-empty-badge">
          <span>{`SCHEDULED FOR ${phaseTarget.toUpperCase()}`}</span>
        </div>

        <h1 className="bm-empty-title" style={{ marginTop: "12px" }}>
          {title}
        </h1>

        <p className="bm-empty-desc">
          {description}
        </p>

        {/* Planned Capabilities */}
        <div
          style={{
            maxWidth: "480px",
            width: "100%",
            textAlign: "left",
            background: "var(--bm-surface)",
            border: "1px solid var(--bm-border)",
            borderRadius: "var(--bm-radius-md)",
            padding: "16px 20px",
            marginBottom: "24px",
          }}
        >
          <p
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--bm-text-muted)",
              margin: "0 0 10px 0",
            }}
          >
            Planned Architecture Capabilities:
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: "18px",
              fontSize: "12px",
              lineHeight: 1.7,
              color: "var(--bm-text-secondary)",
            }}
          >
            {capabilities.map((c, idx) => (
              <li key={idx}>{c}</li>
            ))}
          </ul>
        </div>

        {/* Navigation Action Buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
          <Link
            href="/admin"
            className="bm-header-bridge-btn"
            style={{ background: "transparent", color: "var(--bm-text-primary)", borderColor: "var(--bm-border-strong)" }}
          >
            <HugeIcon icon={ArrowLeft01Icon} size={14} strokeWidth={2} />
            <span>Return to Overview</span>
          </Link>

          <Link
            href="/admin/production"
            className="bm-header-bridge-btn"
          >
            <HugeIcon icon={PrinterIcon} size={14} strokeWidth={2} />
            <span>Launch Bambu Production</span>
            <HugeIcon icon={ArrowRight01Icon} size={14} strokeWidth={2} />
          </Link>
        </div>
      </div>
    </BusinessWorkspaceLayout>
  );
}
