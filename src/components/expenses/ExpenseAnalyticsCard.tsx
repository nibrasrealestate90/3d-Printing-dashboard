"use client";

import React from "react";

export interface ExpenseAnalyticsCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  minHeight?: string | number;
  loading?: boolean;
  error?: string | null;
}

export function ExpenseAnalyticsCard({
  title,
  subtitle,
  badge,
  action,
  children,
  className = "",
  style = {},
  minHeight,
  loading = false,
  error = null,
}: ExpenseAnalyticsCardProps) {
  return (
    <div
      className={`expense-analytics-card ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--color-surface, #EFF9F9)",
        border: "1px solid var(--color-border, #D7E6E5)",
        borderRadius: "var(--radius-card, 24px)",
        boxShadow: "var(--shadow-card, 0 2px 10px rgba(0,0,0,0.06))",
        padding: "20px 22px",
        minHeight: minHeight ?? "360px",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        ...style,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: "180px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <h3
              style={{
                margin: 0,
                fontSize: "15px",
                fontWeight: 650,
                color: "var(--color-text-primary, #062C2F)",
                fontFamily: "var(--font-sans, inherit)",
                letterSpacing: "-0.2px",
              }}
            >
              {title}
            </h3>
            {badge && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 600,
                  background: "var(--color-surface-secondary, #E5F4F3)",
                  color: "var(--color-focus, #397F7C)",
                  border: "1px solid var(--color-border, #D7E6E5)",
                  lineHeight: "1.4",
                }}
              >
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "12px",
                color: "var(--color-text-secondary, #506867)",
                lineHeight: "1.4",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {action && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {action}
          </div>
        )}
      </div>

      {/* Main Content / Error / Loading States */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          minHeight: 0,
        }}
      >
        {loading ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "260px",
              gap: "12px",
              color: "var(--color-text-muted, #819493)",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                border: "3px solid var(--color-border, #D7E6E5)",
                borderTopColor: "var(--color-focus, #397F7C)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <span style={{ fontSize: "12px", fontWeight: 500 }}>
              Updating analytics...
            </span>
          </div>
        ) : error ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "240px",
              background: "var(--color-surface-secondary, #E5F4F3)",
              borderRadius: "var(--radius-md, 16px)",
              border: "1px dashed var(--color-border-strong, #C4D9D7)",
              color: "var(--color-text-muted, #819493)",
              textAlign: "center",
              padding: "20px",
            }}
          >
            <p
              style={{
                margin: "0 0 4px 0",
                fontWeight: 600,
                fontSize: "13px",
                color: "#F43F5E",
              }}
            >
              Visualization Unavailable
            </p>
            <p style={{ margin: 0, fontSize: "12px", maxWidth: "340px" }}>{error}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
