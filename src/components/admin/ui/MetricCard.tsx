import React from "react";
import { HugeIcon, HugeIconData } from "@/components/hugeIcons";

export interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: HugeIconData | React.ReactNode;
  trend?: {
    direction: "up" | "down" | "neutral";
    text: string;
  };
  variant?: "default" | "accent" | "success" | "warning" | "mint" | "coral" | "lavender";
  onClick?: () => void;
}

function renderMetricIcon(icon: HugeIconData | React.ReactNode) {
  if (!icon) return null;
  if (Array.isArray(icon)) {
    return <HugeIcon icon={icon as HugeIconData} size={18} strokeWidth={2} />;
  }
  if (React.isValidElement(icon)) {
    return icon;
  }
  if (typeof icon === "function") {
    const IconComponent = icon as React.ComponentType<{ size?: number; strokeWidth?: number }>;
    return <IconComponent size={18} strokeWidth={2} />;
  }
  return null;
}

export function MetricCard({
  label,
  value,
  subtext,
  icon,
  trend,
  variant = "default",
  onClick,
}: MetricCardProps) {
  const iconBackgrounds: Record<string, { bg: string; color: string }> = {
    default: { bg: "var(--bm-surface-muted)", color: "var(--bm-text-secondary)" },
    accent: { bg: "var(--bm-accent-soft)", color: "var(--bm-accent)" },
    success: { bg: "var(--bm-success-soft)", color: "var(--bm-success)" },
    warning: { bg: "var(--bm-warning-soft)", color: "var(--bm-warning)" },
    mint: { bg: "var(--bm-pastel-mint)", color: "var(--bm-text-primary)" },
    coral: { bg: "var(--bm-pastel-coral)", color: "var(--bm-accent)" },
    lavender: { bg: "var(--bm-pastel-lavender)", color: "var(--bm-text-primary)" },
  };

  const colors = iconBackgrounds[variant] || iconBackgrounds.default;

  return (
    <div
      className="bm-metric-card"
      onClick={onClick}
      style={{
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div className="bm-metric-header">
        <span className="bm-metric-label">{label}</span>
        {icon && (
          <div
            className="bm-metric-icon"
            style={{
              background: colors.bg,
              color: colors.color,
            }}
          >
            {renderMetricIcon(icon)}
          </div>
        )}
      </div>

      <div className="bm-metric-value">{value}</div>

      {(subtext || trend) && (
        <div className="bm-metric-subtext">
          {trend && (
            <span className={`bm-metric-trend-pill ${trend.direction}`}>
              {trend.direction === "up" && "↑"}
              {trend.direction === "down" && "↓"}
              {trend.direction === "neutral" && "•"} {trend.text}
            </span>
          )}
          {subtext && <span>{subtext}</span>}
        </div>
      )}
    </div>
  );
}
