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
          {typeof icon === "object" && "name" in (icon as any) ? (
            <HugeIcon icon={icon as HugeIconData} size={28} strokeWidth={2} />
          ) : (
            (icon as React.ReactNode)
          )}
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
