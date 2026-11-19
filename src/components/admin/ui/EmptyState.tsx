import React from "react";
import Link from "next/link";
import { HugeIcon, HugeIconData } from "@/components/hugeIcons";

export interface EmptyStateProps {
  icon?: HugeIconData | React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  actionText?: string;
  onAction?: () => void;
  actionHref?: string;
}

function renderEmptyIcon(icon: HugeIconData | React.ReactNode) {
  if (!icon) return null;
  if (Array.isArray(icon)) {
    return <HugeIcon icon={icon as HugeIconData} size={28} strokeWidth={2} />;
  }
  if (React.isValidElement(icon)) {
    return icon;
  }
  if (typeof icon === "function") {
    const IconComponent = icon as React.ComponentType<{ size?: number; strokeWidth?: number }>;
    return <IconComponent size={28} strokeWidth={2} />;
  }
  return null;
}

export function EmptyState({
  icon,
  title,
  description,
  badge,
  actionText,
  onAction,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="bm-empty-card">
      {icon && (
        <div className="bm-empty-icon">
          {renderEmptyIcon(icon)}
        </div>
      )}

      {badge && <span className="bm-empty-badge">{badge}</span>}

      <h3 className="bm-empty-title" style={{ marginTop: badge ? "12px" : "0" }}>
        {title}
      </h3>

      <p className="bm-empty-desc">{description}</p>

      {actionText && (
        <div>
          {actionHref ? (
            <Link href={actionHref} className="bm-btn bm-btn-primary">
              {actionText}
            </Link>
          ) : (
            <button type="button" onClick={onAction} className="bm-btn bm-btn-primary">
              {actionText}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
