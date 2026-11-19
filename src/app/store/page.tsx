import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Print Studio Storefront — Precision 3D Printing & CAD Services",
  description: "Customer storefront and quotation portal for custom additive manufacturing and high-precision 3D prints.",
};

export default function StorefrontPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#090a0f",
        color: "#e2e8f0",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          maxWidth: "600px",
          width: "100%",
          padding: "48px 32px",
          backgroundColor: "#11131a",
          border: "1px solid #1f2330",
          borderRadius: "16px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: "9999px",
            backgroundColor: "rgba(59, 130, 246, 0.15)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            color: "#60a5fa",
            fontSize: "12px",
            fontFamily: "monospace",
            letterSpacing: "0.05em",
            marginBottom: "20px",
          }}
        >
          PHASE 2.1 PREVIEW • PUBLIC STOREFRONT
        </div>

        <h1
          style={{
            fontSize: "28px",
            fontWeight: 700,
            marginBottom: "12px",
            letterSpacing: "-0.02em",
            color: "#f8fafc",
          }}
        >
          Print Studio Storefront
        </h1>

        <p
          style={{
            fontSize: "15px",
            lineHeight: 1.6,
            color: "#94a3b8",
            marginBottom: "28px",
          }}
        >
          Welcome to the public showroom for precision additive manufacturing.
          Our customer-facing catalogue and CAD quotation portal are currently being configured for Phase 2.3.
        </p>

        <div
          style={{
            padding: "16px",
            borderRadius: "8px",
            backgroundColor: "#0d0e14",
            border: "1px solid #1a1d28",
            fontSize: "13px",
            color: "#64748b",
            fontFamily: "monospace",
          }}
        >
          STATUS: STOREFRONT ENTRY INITIALIZED (PLACEHOLDER)
          <br />
          WORKSPACE: PUBLIC (ENQUIRY-ONLY v1)
        </div>
      </div>
    </main>
  );
}
