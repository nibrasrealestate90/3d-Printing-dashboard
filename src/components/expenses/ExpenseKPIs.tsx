"use client";

import React from "react";
import { formatExpenseAED } from "@/components/ledgerCore";

export interface ExpenseKPIsProps {
  kpis: {
    totalExpenses: number;
    totalExpensesCents: bigint;
    totalExpensesFormatted: string;
    thisMonthExpenses: number;
    thisMonthExpensesCents: bigint;
    thisMonthExpensesFormatted: string;
    transactionsCount: number;
    highestCategory: {
      name: string;
      amount: number;
      cents?: bigint;
      formatted?: string;
    } | null;
  };
  activePeriodLabel: string;
  isFiltered?: boolean;
}

export function ExpenseKPIs({ kpis, activePeriodLabel, isFiltered = false }: ExpenseKPIsProps) {
  const topCatAmount = kpis.highestCategory
    ? kpis.highestCategory.formatted || formatExpenseAED(kpis.highestCategory.cents ?? kpis.highestCategory.amount)
    : "AED 0.00";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "14px",
        marginBottom: "20px",
      }}
    >
      {/* 1. Total Expenses (Filtered) */}
      <div
        className="metric-card metric-card--mint"
        style={{
          position: "relative",
          borderRadius: "var(--radius-card, 24px)",
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxShadow: "var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06))",
          border: "1px solid var(--color-border, #D7E6E5)",
          minHeight: "128px",
        }}
      >
        <div className="card-top-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            className="card-icon-container"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.72)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-accent, #062C2F)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
              <path d="M14 8H8" />
              <path d="M16 12H8" />
              <path d="M13 16H8" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 650,
              padding: "2px 8px",
              borderRadius: "999px",
              background: "rgba(6, 44, 47, 0.08)",
              color: "var(--color-text-primary, #062C2F)",
            }}
          >
            {isFiltered ? "Filtered" : activePeriodLabel}
          </span>
        </div>
        <div className="card-body" style={{ marginTop: "8px" }}>
          <div className="card-label" style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary, #506867)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Total Expenses
          </div>
          <div className="card-value" style={{ fontSize: "24px", fontWeight: 750, color: "var(--color-text-primary, #062C2F)", letterSpacing: "-0.5px" }}>
            {kpis.totalExpensesFormatted}
          </div>
          <div className="card-subtitle" style={{ fontSize: "11.5px", color: "var(--color-text-secondary, #506867)", marginTop: "3px" }}>
            {activePeriodLabel} spend
          </div>
        </div>
      </div>

      {/* 2. This Month Baseline (Unfiltered) */}
      <div
        className="metric-card metric-card--lime"
        style={{
          position: "relative",
          borderRadius: "var(--radius-card, 24px)",
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxShadow: "var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06))",
          border: "1px solid var(--color-border, #D7E6E5)",
          minHeight: "128px",
        }}
      >
        <div className="card-top-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            className="card-icon-container"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.72)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-accent, #062C2F)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 650,
              padding: "2px 8px",
              borderRadius: "999px",
              background: "rgba(16, 185, 129, 0.16)",
              color: "#064E3B",
            }}
            title="Unfiltered baseline of all expenses recorded in the current calendar month"
          >
            Baseline
          </span>
        </div>
        <div className="card-body" style={{ marginTop: "8px" }}>
          <div className="card-label" style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary, #506867)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            This Month
          </div>
          <div className="card-value" style={{ fontSize: "24px", fontWeight: 750, color: "var(--color-text-primary, #062C2F)", letterSpacing: "-0.5px" }}>
            {kpis.thisMonthExpensesFormatted}
          </div>
          <div className="card-subtitle" style={{ fontSize: "11.5px", color: "var(--color-text-secondary, #506867)", marginTop: "3px" }}>
            Calendar month baseline (unfiltered)
          </div>
        </div>
      </div>

      {/* 3. Transactions Count */}
      <div
        className="metric-card metric-card--lavender"
        style={{
          position: "relative",
          borderRadius: "var(--radius-card, 24px)",
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxShadow: "var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06))",
          border: "1px solid var(--color-border, #D7E6E5)",
          minHeight: "128px",
        }}
      >
        <div className="card-top-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            className="card-icon-container"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.72)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-accent, #062C2F)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" x2="21" y1="6" y2="6" />
              <line x1="8" x2="21" y1="12" y2="12" />
              <line x1="8" x2="21" y1="18" y2="18" />
              <line x1="3" x2="3.01" y1="6" y2="6" />
              <line x1="3" x2="3.01" y1="12" y2="12" />
              <line x1="3" x2="3.01" y1="18" y2="18" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 650,
              padding: "2px 8px",
              borderRadius: "999px",
              background: "rgba(99, 102, 241, 0.14)",
              color: "#3730A3",
            }}
          >
            {kpis.transactionsCount} Entries
          </span>
        </div>
        <div className="card-body" style={{ marginTop: "8px" }}>
          <div className="card-label" style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary, #506867)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Transactions
          </div>
          <div className="card-value" style={{ fontSize: "24px", fontWeight: 750, color: "var(--color-text-primary, #062C2F)", letterSpacing: "-0.5px" }}>
            {kpis.transactionsCount}
          </div>
          <div className="card-subtitle" style={{ fontSize: "11.5px", color: "var(--color-text-secondary, #506867)", marginTop: "3px" }}>
            Matching active filters
          </div>
        </div>
      </div>

      {/* 4. Top Category */}
      <div
        className="metric-card metric-card--neutral"
        style={{
          position: "relative",
          borderRadius: "var(--radius-card, 24px)",
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxShadow: "var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06))",
          border: "1px solid var(--color-border, #D7E6E5)",
          minHeight: "128px",
        }}
      >
        <div className="card-top-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            className="card-icon-container"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.72)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-accent, #062C2F)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
              <path d="M7 7h.01" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 650,
              padding: "2px 8px",
              borderRadius: "999px",
              background: "rgba(6, 44, 47, 0.08)",
              color: "var(--color-text-primary, #062C2F)",
            }}
          >
            Top Category
          </span>
        </div>
        <div className="card-body" style={{ marginTop: "8px" }}>
          <div className="card-label" style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary, #506867)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Top Expense Category
          </div>
          <div
            className="card-value"
            style={{
              fontSize: "18px",
              fontWeight: 750,
              color: "var(--color-text-primary, #062C2F)",
              letterSpacing: "-0.3px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={kpis.highestCategory?.name || "None"}
          >
            {kpis.highestCategory ? kpis.highestCategory.name : "None"}
          </div>
          <div className="card-subtitle" style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-focus, #397F7C)", marginTop: "3px" }}>
            {kpis.highestCategory ? topCatAmount : "No expenses recorded"}
          </div>
        </div>
      </div>
    </div>
  );
}
