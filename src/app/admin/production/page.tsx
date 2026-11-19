"use client";

import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft01Icon, DashboardSquare01Icon } from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";
import "@/app/business-workspace.css";

const PrintStudioLedger = dynamic(
  () => import("@/components/PrintStudioLedger"),
  { ssr: false }
);

export default function BambuProductionPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top Bridge Bar linking back to Business Management Workspace */}
      <header className="bm-production-topbar" aria-label="Production Workspace Navigation">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#10B981" }} />
          <span style={{ fontWeight: 700, letterSpacing: "-0.01em" }}>
            Bambu Production Workspace
          </span>
          <span style={{ opacity: 0.6 }}>·</span>
          <span style={{ opacity: 0.8, fontSize: "11px" }}>
            Real-Time 3D Manufacturing Engine & Telemetry
          </span>
        </div>

        <Link
          href="/admin"
          className="bm-production-topbar-btn"
          title="Return to Business Management Workspace"
        >
          <HugeIcon icon={ArrowLeft01Icon} size={14} strokeWidth={2} />
          <span>Switch to Business Management</span>
        </Link>
      </header>

      {/* Existing Manufacturing Dashboard */}
      <div style={{ flex: 1 }}>
        <PrintStudioLedger />
      </div>
    </div>
  );
}
