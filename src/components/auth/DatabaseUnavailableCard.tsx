"use client";

import React from "react";
import Image from "next/image";
import { AlertCircleIcon, Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";
import "@/app/admin-login.css";

interface DatabaseUnavailableCardProps {
  error?: string;
}

export function DatabaseUnavailableCard({ error }: DatabaseUnavailableCardProps) {
  return (
    <main
      className="admin-login-page"
      style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div aria-hidden="true" className="admin-login-glow-lavender" />
      <div aria-hidden="true" className="admin-login-glow-mint" />

      <div
        className="admin-login-card"
        role="alert"
        aria-live="assertive"
        data-testid="db-unavailable-card"
        style={{ maxWidth: "480px", textAlign: "center" }}
      >
        {/* Header Icon */}
        <div
          style={{
            margin: "0 auto 16px auto",
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            backgroundColor: "rgba(237, 178, 183, 0.25)",
            border: "1px solid rgba(237, 178, 183, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#C53030",
          }}
        >
          <HugeIcon icon={AlertCircleIcon} size={28} strokeWidth={2} />
        </div>

        <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: "999px", background: "#EDB2B7", color: "#651A1A", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "12px" }}>
          HTTP 503 • Service Unavailable
        </div>

        <h1
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--color-text-primary, #062C2F)",
            margin: "0 0 10px 0",
            letterSpacing: "-0.02em",
          }}
        >
          Database Connection Offline
        </h1>

        <p
          style={{
            fontSize: "13px",
            lineHeight: 1.6,
            color: "var(--color-text-secondary, #506867)",
            margin: "0 0 20px 0",
          }}
        >
          The PostgreSQL database service is temporarily offline or unreachable.
          Session authentication could not be completed.
          <br />
          <strong>Your credentials were not rejected.</strong>
        </p>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              fontFamily: "monospace",
              fontSize: "11px",
              color: "#64748B",
              marginBottom: "20px",
              wordBreak: "break-all",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="admin-session-primary-btn"
            style={{ justifyContent: "center" }}
          >
            <HugeIcon icon={Refresh01Icon} size={16} strokeWidth={2} />
            <span>Retry Connection</span>
          </button>

          <a
            href="/login"
            className="admin-session-secondary-btn"
            style={{ justifyContent: "center", textDecoration: "none" }}
          >
            Return to Sign In
          </a>
        </div>
      </div>
    </main>
  );
}
