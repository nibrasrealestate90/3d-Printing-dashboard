"use client";

import React, { useState, useEffect } from "react";
import type { ExpenseRecordLike, ExpenseCategoryLike } from "@/lib/expenseAnalytics";
import { parseExpenseAmountToCents, DEFAULT_EXPENSE_CATEGORY_DEFINITIONS } from "@/components/ledgerCore";

export interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: ExpenseRecordLike | null; // null for Add, record for Edit
  categories: readonly ExpenseCategoryLike[];
  onSave: (data: {
    id?: string;
    title: string;
    amount: number;
    category: string;
    categoryId?: string;
    expenseDate: string;
    vendor?: string;
    paymentMethod: "Cash" | "Card" | "Bank Transfer" | "Other";
    description?: string;
  }) => Promise<boolean>;
}

export function ExpenseFormModal({
  isOpen,
  onClose,
  expense,
  categories,
  onSave,
}: ExpenseFormModalProps) {
  const isEditing = Boolean(expense && expense.id);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [vendor, setVendor] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Card" | "Bank Transfer" | "Other">("Card");
  const [description, setDescription] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const availableCategories = categories.length > 0 ? categories : DEFAULT_EXPENSE_CATEGORY_DEFINITIONS;

  useEffect(() => {
    if (isOpen) {
      setServerError(null);
      setErrors({});
      if (expense) {
        setTitle(expense.title || "");
        setAmount(expense.amount !== undefined ? String(expense.amount) : "");
        const matched = availableCategories.find(
          (c) => c.id === expense.categoryId || c.name.toLowerCase() === (expense.category || "").toLowerCase()
        );
        setCategoryId(matched?.id || expense.categoryId || "");
        setCategoryName(matched?.name || expense.category || "");
        setExpenseDate(String(expense.expenseDate || expense.date || "").slice(0, 10));
        setVendor(expense.vendor || "");
        setPaymentMethod((expense.paymentMethod as any) || "Card");
        setDescription(expense.description || expense.notes || "");
      } else {
        // Defaults for new expense
        setTitle("");
        setAmount("");
        const defaultCat = availableCategories[0];
        setCategoryId(defaultCat?.id || "");
        setCategoryName(defaultCat?.name || "");
        const todayStr = new Date().toISOString().slice(0, 10);
        setExpenseDate(todayStr);
        setVendor("");
        setPaymentMethod("Card");
        setDescription("");
      }
    }
  }, [isOpen, expense]);

  if (!isOpen) return null;

  function validate() {
    const errs: Record<string, string> = {};

    if (!title.trim()) {
      errs.title = "Expense title is required";
    }

    const parsed = parseExpenseAmountToCents(amount);
    if (!parsed.valid || parsed.amount === undefined) {
      errs.amount = parsed.error || "Valid monetary amount required";
    }

    if (!categoryId && !categoryName) {
      errs.category = "Category is required";
    }

    if (!expenseDate || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
      errs.expenseDate = "A valid calendar date (YYYY-MM-DD) is required";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validate()) return;

    const parsed = parseExpenseAmountToCents(amount);
    if (!parsed.valid || parsed.amount === undefined) return;

    // Resolve category name
    const matched = availableCategories.find((c) => c.id === categoryId);
    const finalCatName = matched?.name || categoryName || "Other Expenses";

    setIsSubmitting(true);
    setServerError(null);

    try {
      const payload = {
        ...(isEditing && expense?.id ? { id: expense.id } : {}),
        title: title.trim(),
        amount: parsed.amount,
        category: finalCatName,
        categoryId: matched?.id || categoryId || undefined,
        expenseDate,
        vendor: vendor.trim() || undefined,
        paymentMethod,
        description: description.trim() || undefined,
      };

      const success = await onSave(payload);
      if (success) {
        onClose();
      }
    } catch (err: any) {
      setServerError(err?.message || "Failed to save expense");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="modal-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
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
        overflowY: "auto",
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-modal-title"
        style={{
          background: "var(--color-surface, #EFF9F9)",
          border: "1px solid var(--color-border-strong, #C4D9D7)",
          borderRadius: "var(--radius-card, 24px)",
          boxShadow: "0 20px 48px rgba(6, 44, 47, 0.22)",
          width: "100%",
          maxWidth: "540px",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "26px 28px",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <h3
              id="expense-modal-title"
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 750,
                color: "var(--color-text-primary, #062C2F)",
                letterSpacing: "-0.3px",
              }}
            >
              {isEditing ? "Edit Expense Record" : "Record New Business Expense"}
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary, #506867)" }}>
              {isEditing ? "Update existing financial transaction details" : "Add a business expenditure to the commercial studio ledger"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--color-text-muted, #819493)",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              borderRadius: "50%",
            }}
            title="Close dialog"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>

        {/* Server Error Alert */}
        {serverError && (
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
            <b>Error:</b> {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Title */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "var(--color-text-primary, #062C2F)", marginBottom: "6px" }}>
              Expense Title <span style={{ color: "#F43F5E" }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Bambu Lab X1-C 0.4mm Hardened Hotend"
              disabled={isSubmitting}
              autoFocus
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "10px",
                border: errors.title ? "1px solid #F43F5E" : "1px solid var(--color-border-strong, #C4D9D7)",
                background: "var(--color-background, #E9F6F6)",
                color: "var(--color-text-primary, #062C2F)",
                fontSize: "13px",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
            {errors.title && <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#F43F5E" }}>{errors.title}</p>}
          </div>

          {/* Amount & Date Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            {/* Amount */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "var(--color-text-primary, #062C2F)", marginBottom: "6px" }}>
                Amount (AED) <span style={{ color: "#F43F5E" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted, #819493)" }}>
                  AED
                </span>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={isSubmitting}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 44px",
                    borderRadius: "10px",
                    border: errors.amount ? "1px solid #F43F5E" : "1px solid var(--color-border-strong, #C4D9D7)",
                    background: "var(--color-background, #E9F6F6)",
                    color: "var(--color-text-primary, #062C2F)",
                    fontSize: "13px",
                    fontWeight: 650,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>
              {errors.amount && <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#F43F5E" }}>{errors.amount}</p>}
            </div>

            {/* Date */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "var(--color-text-primary, #062C2F)", marginBottom: "6px" }}>
                Date <span style={{ color: "#F43F5E" }}>*</span>
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "10px",
                  border: errors.expenseDate ? "1px solid #F43F5E" : "1px solid var(--color-border-strong, #C4D9D7)",
                  background: "var(--color-background, #E9F6F6)",
                  color: "var(--color-text-primary, #062C2F)",
                  fontSize: "13px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
              {errors.expenseDate && <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#F43F5E" }}>{errors.expenseDate}</p>}
            </div>
          </div>

          {/* Category & Payment Method Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            {/* Category */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "var(--color-text-primary, #062C2F)", marginBottom: "6px" }}>
                Category <span style={{ color: "#F43F5E" }}>*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  const found = availableCategories.find((c) => c.id === e.target.value);
                  if (found) setCategoryName(found.name);
                }}
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "10px",
                  border: errors.category ? "1px solid #F43F5E" : "1px solid var(--color-border-strong, #C4D9D7)",
                  background: "var(--color-background, #E9F6F6)",
                  color: "var(--color-text-primary, #062C2F)",
                  fontSize: "13px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              >
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.category && <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#F43F5E" }}>{errors.category}</p>}
            </div>

            {/* Payment Method */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "var(--color-text-primary, #062C2F)", marginBottom: "6px" }}>
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border-strong, #C4D9D7)",
                  background: "var(--color-background, #E9F6F6)",
                  color: "var(--color-text-primary, #062C2F)",
                  fontSize: "13px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              >
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Vendor */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "var(--color-text-primary, #062C2F)", marginBottom: "6px" }}>
              Vendor / Supplier (Optional)
            </label>
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. Bambu Lab, DEWA, Amazon UAE, Etisalat"
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "10px",
                border: "1px solid var(--color-border-strong, #C4D9D7)",
                background: "var(--color-background, #E9F6F6)",
                color: "var(--color-text-primary, #062C2F)",
                fontSize: "13px",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {/* Description / Notes */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "var(--color-text-primary, #062C2F)", marginBottom: "6px" }}>
              Description & Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide internal notes, invoice numbers, or details regarding this business purchase..."
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "10px",
                border: "1px solid var(--color-border-strong, #C4D9D7)",
                background: "var(--color-background, #E9F6F6)",
                color: "var(--color-text-primary, #062C2F)",
                fontSize: "13px",
                fontFamily: "var(--font-sans, inherit)",
                boxSizing: "border-box",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: "9px 18px",
                borderRadius: "var(--radius-pill, 999px)",
                border: "1px solid var(--color-border-strong, #C4D9D7)",
                background: "transparent",
                color: "var(--color-text-secondary, #506867)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "9px 22px",
                borderRadius: "var(--radius-pill, 999px)",
                border: "none",
                background: "var(--color-focus, #397F7C)",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 650,
                cursor: isSubmitting ? "not-allowed" : "pointer",
                boxShadow: "0 2px 8px rgba(57, 127, 124, 0.32)",
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? (
                <>
                  <span
                    style={{
                      width: "14px",
                      height: "14px",
                      border: "2px solid #FFFFFF",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.6s linear infinite",
                    }}
                  />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEditing ? "Update Expense" : "Save Expense"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
