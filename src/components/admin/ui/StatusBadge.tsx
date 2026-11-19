import React from "react";

export interface StatusBadgeProps {
  status: string;
  label?: string;
  variant?: "success" | "warning" | "danger" | "info" | "neutral";
}

export function StatusBadge({ status, label, variant }: StatusBadgeProps) {
  // Infer variant if not explicitly provided
  const normalized = status.toUpperCase();
  let resolvedVariant = variant;

  if (!resolvedVariant) {
    if (
      normalized.includes("COMPLETE") ||
      normalized.includes("PUBLISHED") ||
      normalized.includes("ACTIVE") ||
      normalized.includes("OPERATIONAL") ||
      normalized.includes("DELIVERED") ||
      normalized.includes("PAID")
    ) {
      resolvedVariant = "success";
    } else if (
      normalized.includes("PENDING") ||
      normalized.includes("REVIEW") ||
      normalized.includes("IN_PROGRESS") ||
      normalized.includes("PRODUCTION") ||
      normalized.includes("LOW_STOCK")
    ) {
      resolvedVariant = "warning";
    } else if (
      normalized.includes("FAIL") ||
      normalized.includes("CANCEL") ||
      normalized.includes("OUT_OF_STOCK") ||
      normalized.includes("REJECT")
    ) {
      resolvedVariant = "danger";
    } else if (
      normalized.includes("NEW") ||
      normalized.includes("INFO") ||
      normalized.includes("DRAFT")
    ) {
      resolvedVariant = "info";
    } else {
      resolvedVariant = "neutral";
    }
  }

  const variantClass = `bm-badge-${resolvedVariant}`;
  const displayText = label || status.replace(/_/g, " ");

  return (
    <span className={`bm-badge ${variantClass}`}>
      <span className="bm-badge-dot" />
      {displayText}
    </span>
  );
}
