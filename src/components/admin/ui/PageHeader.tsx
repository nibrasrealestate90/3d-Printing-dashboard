import React from "react";

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: string;
  badge?: {
    text: string;
    variant?: "accent" | "success" | "warning" | "neutral" | "info";
  };
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  badge,
  actions,
  children,
}: PageHeaderProps) {
  const badgeClasses = {
    accent: "bm-badge-info",
    success: "bm-badge-success",
    warning: "bm-badge-warning",
    neutral: "bm-badge-neutral",
    info: "bm-badge-info",
  };

  const badgeClass = badge?.variant ? badgeClasses[badge.variant] : "bm-badge-neutral";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        marginBottom: "8px",
      }}
    >
      {breadcrumbs && (
        <div
          style={{
            fontSize: "12px",
            color: "var(--bm-text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontWeight: 500,
          }}
        >
          <span>{breadcrumbs}</span>
          <span>/</span>
          <span style={{ color: "var(--bm-text-secondary)", fontWeight: 600 }}>{title}</span>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ maxWidth: "720px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <h1
              style={{
                fontSize: "26px",
                fontWeight: 700,
                color: "var(--bm-text-primary)",
                margin: 0,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              {title}
            </h1>
            {badge && (
              <span className={`bm-badge ${badgeClass}`}>
                <span className="bm-badge-dot" />
                {badge.text}
              </span>
            )}
          </div>
          {description && (
            <p
              style={{
                fontSize: "13px",
                color: "var(--bm-text-secondary)",
                margin: "6px 0 0 0",
                lineHeight: 1.5,
              }}
            >
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexShrink: 0,
            }}
          >
            {actions}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
