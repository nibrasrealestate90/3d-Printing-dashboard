"use client";

import React from "react";
import type { ExpenseRecordLike, ExpenseCategoryLike } from "@/lib/expenseAnalytics";
import { formatExpenseAED, parseExpenseAmountToCents, DEFAULT_EXPENSE_CATEGORY_DEFINITIONS } from "@/components/ledgerCore";
import { DEFAULT_CATEGORY_COLORS } from "@/lib/expenseAnalytics";

export interface ExpenseTransactionTableProps {
  expenses: readonly ExpenseRecordLike[];
  categories: readonly ExpenseCategoryLike[];
  loading?: boolean;
  onEdit: (expense: ExpenseRecordLike) => void;
  onDelete: (expense: ExpenseRecordLike) => void;
  onAddExpense: () => void;
}

export function ExpenseTransactionTable({
  expenses,
  categories,
  loading = false,
  onEdit,
  onDelete,
  onAddExpense,
}: ExpenseTransactionTableProps) {
  // Build category color lookup map
  const catDefs = categories.length > 0 ? categories : DEFAULT_EXPENSE_CATEGORY_DEFINITIONS;
  const categoryMap = new Map<string, ExpenseCategoryLike>();
  for (const c of catDefs) {
    if (c.id) categoryMap.set(c.id, c);
    if (c.name) categoryMap.set(c.name.toLowerCase().trim(), c);
  }

  function getCategoryInfo(exp: ExpenseRecordLike) {
    const rawCat = (exp.category || "").trim();
    const catId = exp.categoryId || "";
    let matched: ExpenseCategoryLike | undefined;

    if (catId && categoryMap.has(catId)) {
      matched = categoryMap.get(catId);
    } else if (rawCat && categoryMap.has(rawCat.toLowerCase())) {
      matched = categoryMap.get(rawCat.toLowerCase());
    }

    const name = matched?.name || rawCat || "Uncategorized";
    const color = matched?.color || (matched?.id ? DEFAULT_CATEGORY_COLORS[matched.id] : undefined) || DEFAULT_CATEGORY_COLORS.uncategorized || "#64748B";

    return { name, color };
  }

  function formatDisplayDate(dateStr?: string) {
    if (!dateStr) return "—";
    const match = dateStr.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return dateStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[parseInt(match[2], 10) - 1] || match[2];
    const day = parseInt(match[3], 10);
    const year = match[1];
    return `${month} ${day}, ${year}`;
  }

  function formatDisplayAmount(amount: number | string) {
    const parsed = parseExpenseAmountToCents(amount);
    if (parsed.valid && parsed.cents !== undefined) {
      return formatExpenseAED(parsed.cents, true);
    }
    return `AED ${Number(amount || 0).toFixed(2)}`;
  }

  if (loading) {
    return (
      <div
        style={{
          background: "var(--color-surface, #EFF9F9)",
          border: "1px solid var(--color-border, #D7E6E5)",
          borderRadius: "var(--radius-card, 24px)",
          padding: "48px 24px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
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
        <span style={{ fontSize: "13px", fontWeight: 550 }}>Loading transactions...</span>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div
        style={{
          background: "var(--color-surface, #EFF9F9)",
          border: "1px solid var(--color-border, #D7E6E5)",
          borderRadius: "var(--radius-card, 24px)",
          padding: "54px 24px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "var(--shadow-card, 0 2px 8px rgba(0,0,0,0.04))",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "var(--color-surface-secondary, #E5F4F3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-text-muted, #819493)",
            marginBottom: "14px",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
            <path d="M14 8H8" />
            <path d="M16 12H8" />
            <path d="M13 16H8" />
          </svg>
        </div>
        <h3
          style={{
            margin: "0 0 6px 0",
            fontSize: "16px",
            fontWeight: 700,
            color: "var(--color-text-primary, #062C2F)",
          }}
        >
          No Expense Transactions Found
        </h3>
        <p
          style={{
            margin: "0 0 20px 0",
            fontSize: "13px",
            color: "var(--color-text-secondary, #506867)",
            maxWidth: "360px",
            lineHeight: "1.4",
          }}
        >
          No expenses match the current filter criteria or date range. You can adjust your filters or record a new transaction.
        </p>
        <button
          type="button"
          onClick={onAddExpense}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 20px",
            borderRadius: "var(--radius-pill, 999px)",
            border: "none",
            background: "var(--color-focus, #397F7C)",
            color: "#FFFFFF",
            fontSize: "13px",
            fontWeight: 650,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(57, 127, 124, 0.28)",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Record Expense
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--color-surface, #EFF9F9)",
        border: "1px solid var(--color-border, #D7E6E5)",
        borderRadius: "var(--radius-card, 24px)",
        overflow: "hidden",
        boxShadow: "var(--shadow-card, 0 2px 8px rgba(0,0,0,0.04))",
      }}
    >
      {/* Desktop Table View */}
      <div className="expense-desktop-table-container" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "var(--color-surface-secondary, #E5F4F3)" }}>
              <th style={{ padding: "12px 18px", color: "var(--color-text-secondary, #506867)", fontWeight: 650, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", width: "120px" }}>
                Date
              </th>
              <th style={{ padding: "12px 18px", color: "var(--color-text-secondary, #506867)", fontWeight: 650, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Expense & Details
              </th>
              <th style={{ padding: "12px 18px", color: "var(--color-text-secondary, #506867)", fontWeight: 650, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Category
              </th>
              <th style={{ padding: "12px 18px", color: "var(--color-text-secondary, #506867)", fontWeight: 650, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Method
              </th>
              <th style={{ padding: "12px 18px", color: "var(--color-text-secondary, #506867)", fontWeight: 650, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "right" }}>
                Amount
              </th>
              <th style={{ padding: "12px 18px", color: "var(--color-text-secondary, #506867)", fontWeight: 650, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center", width: "90px" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp, idx) => {
              const { name: catName, color: catColor } = getCategoryInfo(exp);
              const dateFormatted = formatDisplayDate(exp.expenseDate || exp.date);
              const amountFormatted = formatDisplayAmount(exp.amount);

              return (
                <tr
                  key={exp.id || idx}
                  style={{
                    borderTop: "1px solid var(--color-border, #D7E6E5)",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--color-surface-secondary, #E5F4F3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Date */}
                  <td style={{ padding: "14px 18px", whiteSpace: "nowrap", color: "var(--color-text-secondary, #506867)", fontWeight: 550 }}>
                    {dateFormatted}
                  </td>

                  {/* Title & Vendor/Notes */}
                  <td style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontWeight: 650, color: "var(--color-text-primary, #062C2F)" }}>
                        {exp.title || "Untitled Expense"}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11.5px", color: "var(--color-text-secondary, #506867)", flexWrap: "wrap" }}>
                        {exp.vendor && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <b>Vendor:</b> {exp.vendor}
                          </span>
                        )}
                        {exp.description && (
                          <span
                            style={{
                              fontStyle: "italic",
                              color: "var(--color-text-muted, #819493)",
                              maxWidth: "280px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={exp.description}
                          >
                            • {exp.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Category Badge */}
                  <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "3px 10px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background: "var(--color-surface-secondary, #E5F4F3)",
                        border: "1px solid var(--color-border, #D7E6E5)",
                        color: "var(--color-text-primary, #062C2F)",
                      }}
                    >
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: catColor,
                          flexShrink: 0,
                        }}
                      />
                      {catName}
                    </span>
                  </td>

                  {/* Payment Method */}
                  <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "11.5px",
                        fontWeight: 550,
                        background: "var(--color-surface-secondary, #E5F4F3)",
                        color: "var(--color-text-secondary, #506867)",
                      }}
                    >
                      {exp.paymentMethod || "Card"}
                    </span>
                  </td>

                  {/* Amount (Tabular Numbers) */}
                  <td
                    style={{
                      padding: "14px 18px",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 750,
                      fontSize: "14px",
                      color: "var(--color-text-primary, #062C2F)",
                    }}
                  >
                    {amountFormatted}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "14px 18px", textAlign: "center", whiteSpace: "nowrap" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => onEdit(exp)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "30px",
                          height: "30px",
                          borderRadius: "8px",
                          border: "1px solid var(--color-border, #D7E6E5)",
                          background: "var(--color-surface-secondary, #E5F4F3)",
                          color: "var(--color-focus, #397F7C)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        title="Edit expense"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => onDelete(exp)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "30px",
                          height: "30px",
                          borderRadius: "8px",
                          border: "1px solid var(--color-border, #D7E6E5)",
                          background: "var(--color-surface-secondary, #E5F4F3)",
                          color: "#F43F5E",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        title="Delete expense"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View (Rendered conditionally via CSS classes or media styling) */}
      <div className="expense-mobile-card-list" style={{ display: "none", flexDirection: "column", gap: "10px", padding: "12px" }}>
        {expenses.map((exp, idx) => {
          const { name: catName, color: catColor } = getCategoryInfo(exp);
          const dateFormatted = formatDisplayDate(exp.expenseDate || exp.date);
          const amountFormatted = formatDisplayAmount(exp.amount);

          return (
            <div
              key={exp.id || idx}
              style={{
                background: "var(--color-surface-secondary, #E5F4F3)",
                border: "1px solid var(--color-border, #D7E6E5)",
                borderRadius: "14px",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--color-text-secondary, #506867)", fontWeight: 550, marginBottom: "2px" }}>
                    {dateFormatted}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--color-text-primary, #062C2F)" }}>
                    {exp.title}
                  </div>
                </div>
                <div style={{ fontSize: "15px", fontWeight: 750, color: "var(--color-text-primary, #062C2F)", fontVariantNumeric: "tabular-nums" }}>
                  {amountFormatted}
                </div>
              </div>

              {exp.vendor && (
                <div style={{ fontSize: "12px", color: "var(--color-text-secondary, #506867)" }}>
                  <b>Vendor:</b> {exp.vendor}
                </div>
              )}

              {exp.description && (
                <div style={{ fontSize: "12px", color: "var(--color-text-muted, #819493)", fontStyle: "italic" }}>
                  {exp.description}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "6px", borderTop: "1px dashed var(--color-border, #D7E6E5)" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: "var(--color-surface, #EFF9F9)",
                    border: "1px solid var(--color-border, #D7E6E5)",
                  }}
                >
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: catColor }} />
                  {catName}
                </span>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => onEdit(exp)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border, #D7E6E5)",
                      background: "var(--color-surface, #EFF9F9)",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      color: "var(--color-focus, #397F7C)",
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(exp)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border, #D7E6E5)",
                      background: "var(--color-surface, #EFF9F9)",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      color: "#F43F5E",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .expense-desktop-table-container {
            display: none !important;
          }
          .expense-mobile-card-list {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
