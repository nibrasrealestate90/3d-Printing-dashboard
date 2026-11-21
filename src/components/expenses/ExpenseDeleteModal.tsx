"use client";

import React, { useState } from "react";
import type { ExpenseRecordLike } from "@/lib/expenseAnalytics";
import { formatExpenseAED, parseExpenseAmountToCents } from "@/components/ledgerCore";

export interface ExpenseDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: ExpenseRecordLike | null;
  onConfirm: () => Promise<boolean>;
}

export function ExpenseDeleteModal({
  isOpen,
  onClose,
  expense,
  onConfirm,
}: ExpenseDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!isOpen || !expense) return null;

  const parsed = parseExpenseAmountToCents(expense.amount);
  const formattedAmount = parsed.valid && parsed.cents !== undefined
    ? formatExpenseAED(parsed.cents, true)
    : `AED ${Number(expense.amount || 0).toFixed(2)}`;

  async function handleDelete() {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const ok = await onConfirm();
      if (ok) {
        onClose();
      }
    } catch (err: any) {
      setDeleteError(err?.message || "Failed to delete expense record");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div
      className="modal-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(6, 44, 47, 0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        zIndex: 1000,
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-expense-modal-title"
        style={{
          background: "var(--color-surface, #EFF9F9)",
          border: "1px solid var(--color-border-strong, #C4D9D7)",
          borderRadius: "var(--radius-card, 24px)",
          boxShadow: "0 20px 48px rgba(6, 44, 47, 0.22)",
          width: "100%",
          maxWidth: "460px",
          padding: "26px 28px",
          boxSizing: "border-box",
        }}
      >
        {/* Warning Icon & Title */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "16px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "rgba(244, 63, 94, 0.14)",
              color: "#F43F5E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" x2="10" y1="11" y2="17" />
              <line x1="14" x2="14" y1="11" y2="17" />
            </svg>
          </div>
          <div>
            <h3
              id="delete-expense-modal-title"
              style={{
                margin: 0,
                fontSize: "17px",
                fontWeight: 750,
                color: "var(--color-text-primary, #062C2F)",
              }}
            >
              Delete Expense Record?
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary, #506867)" }}>
              This will permanently remove this financial transaction from the studio accounts.
            </p>
          </div>
        </div>

        {/* Expense Context Details Card */}
        <div
          style={{
            background: "var(--color-surface-secondary, #E5F4F3)",
            border: "1px solid var(--color-border, #D7E6E5)",
            borderRadius: "12px",
            padding: "12px 16px",
            marginBottom: "18px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-primary, #062C2F)" }}>
              {expense.title}
            </span>
            <span style={{ fontSize: "14px", fontWeight: 750, color: "#F43F5E", fontVariantNumeric: "tabular-nums" }}>
              {formattedAmount}
            </span>
          </div>
          <div style={{ display: "flex", gap: "10px", fontSize: "11.5px", color: "var(--color-text-secondary, #506867)" }}>
            <span>Category: <b>{expense.category || "Uncategorized"}</b></span>
            <span>•</span>
            <span>Date: <b>{expense.expenseDate || expense.date || "—"}</b></span>
          </div>
        </div>

        {deleteError && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              background: "rgba(244, 63, 94, 0.12)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              color: "#E11D48",
              fontSize: "12px",
              marginBottom: "16px",
            }}
          >
            <b>Error:</b> {deleteError}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            style={{
              padding: "9px 18px",
              borderRadius: "var(--radius-pill, 999px)",
              border: "1px solid var(--color-border-strong, #C4D9D7)",
              background: "transparent",
              color: "var(--color-text-secondary, #506867)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: isDeleting ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 20px",
              borderRadius: "var(--radius-pill, 999px)",
              border: "none",
              background: "#F43F5E",
              color: "#FFFFFF",
              fontSize: "13px",
              fontWeight: 650,
              cursor: isDeleting ? "not-allowed" : "pointer",
              boxShadow: "0 2px 8px rgba(244, 63, 94, 0.35)",
              opacity: isDeleting ? 0.7 : 1,
            }}
          >
            {isDeleting ? "Deleting..." : "Delete Record"}
          </button>
        </div>
      </div>
    </div>
  );
}
