import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/auth/AdminLoginForm";
import "@/app/admin-login.css";

export const metadata: Metadata = {
  title: "Administrator Sign In — Print Studio Ledger",
  description: "Secure administrator sign in for Dubai Print Studio management and manufacturing console.",
};

export default function AdminLoginPage() {
  return (
    <main className="admin-login-page">
      {/* Calm Ambient Lavender / Mint Foundation Radiance */}
      <div aria-hidden="true" className="admin-login-glow-lavender" />
      <div aria-hidden="true" className="admin-login-glow-mint" />

      {/* Top subtle studio header */}
      <header className="admin-login-header-bar">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10B981" }} />
          <span style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Print Studio Ledger v1.3
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.05em" }}>
          <span>REGION: DUBAI (UAE)</span>
          <span>·</span>
          <span>TIMEZONE: GST (UTC+4)</span>
        </div>
      </header>

      {/* Centered Login Card */}
      <section style={{ position: "relative", zIndex: 10, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Suspense fallback={<div className="admin-login-card" style={{ minHeight: "380px" }} />}>
          <AdminLoginForm />
        </Suspense>
      </section>

      {/* Footer studio information */}
      <footer className="admin-login-footer-bar">
        <p style={{ margin: 0 }}>
          &copy; {new Date().getFullYear()} Print Studio Ledger. All rights reserved. Precision Additive Manufacturing.
        </p>
      </footer>
    </main>
  );
}
