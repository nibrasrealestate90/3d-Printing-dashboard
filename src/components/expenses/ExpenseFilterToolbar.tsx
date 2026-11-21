"use client";

import React from "react";
import type { ExpenseCategoryLike } from "@/lib/expenseAnalytics";

export interface ExpenseFilterToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedRange: string;
  onRangeChange: (range: string) => void;
  customStart: string;
  customEnd: string;
  onCustomDatesChange: (start: string, end: string) => void;
  selectedCategory: string;
  onCategoryChange: (catId: string) => void;
  categories: readonly ExpenseCategoryLike[];
  onOpenCategoriesModal?: () => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  totalMatching: number;
  totalAll: number;
}

export function ExpenseFilterToolbar({
  searchQuery,
  onSearchChange,
  selectedRange,
  onRangeChange,
  customStart,
  customEnd,
  onCustomDatesChange,
  selectedCategory,
  onCategoryChange,
  categories,
  onOpenCategoriesModal,
  onClearFilters,
  hasActiveFilters,
  totalMatching,
  totalAll,
}: ExpenseFilterToolbarProps) {
  const PERIOD_OPTIONS = [
    { id: "today", label: "Today" },
    { id: "7d", label: "7D" },
    { id: "30d", label: "30D" },
    { id: "this_month", label: "This Month" },
    { id: "last_month", label: "Last Month" },
    { id: "custom", label: "Custom" },
    { id: "all", label: "All Time" },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        background: "var(--color-surface, #EFF9F9)",
        border: "1px solid var(--color-border, #D7E6E5)",
        borderRadius: "var(--radius-card, 24px)",
        padding: "16px 20px",
        marginBottom: "20px",
        boxShadow: "var(--shadow-card, 0 2px 8px rgba(0,0,0,0.04))",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        {/* Search Input Box */}
        <div
          style={{
            position: "relative",
            flex: "1 1 260px",
            minWidth: "220px",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-muted, #819493)",
              display: "flex",
              alignItems: "center",
              pointerEvents: "none",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" x2="16.65" y1="21" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by title, vendor, or notes..."
            style={{
              width: "100%",
              padding: "9px 36px 9px 36px",
              borderRadius: "var(--radius-pill, 999px)",
              border: "1px solid var(--color-border-strong, #C4D9D7)",
              background: "var(--color-background, #E9F6F6)",
              color: "var(--color-text-primary, #062C2F)",
              fontSize: "13px",
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "var(--font-sans, inherit)",
              transition: "border-color 0.15s ease",
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
                color: "var(--color-text-muted, #819493)",
              }}
              title="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" x2="6" y1="6" y2="18" />
                <line x1="6" x2="18" y1="6" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Category Selector & Manage Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "0 1 auto", flexWrap: "wrap" }}>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            style={{
              padding: "9px 14px",
              borderRadius: "var(--radius-pill, 999px)",
              border: "1px solid var(--color-border-strong, #C4D9D7)",
              background: "var(--color-background, #E9F6F6)",
              color: "var(--color-text-primary, #062C2F)",
              fontSize: "13px",
              fontWeight: 500,
              outline: "none",
              cursor: "pointer",
              fontFamily: "var(--font-sans, inherit)",
              boxSizing: "border-box",
              minWidth: "160px",
            }}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name || cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {onOpenCategoriesModal && (
            <button
              type="button"
              onClick={onOpenCategoriesModal}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "var(--radius-pill, 999px)",
                border: "1px solid var(--color-border-strong, #C4D9D7)",
                background: "var(--color-surface, #EFF9F9)",
                color: "var(--color-text-primary, #062C2F)",
                fontSize: "12.5px",
                fontWeight: 650,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
              title="Manage categories"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                <path d="M7 7h.01" />
              </svg>
              Categories
            </button>
          )}
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "var(--radius-pill, 999px)",
              border: "1px solid var(--color-border, #D7E6E5)",
              background: "var(--color-surface-secondary, #E5F4F3)",
              color: "#F43F5E",
              fontSize: "12px",
              fontWeight: 650,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Reset all active filters"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Clear Filters
          </button>
        )}

        {/* Counter Info */}
        <div
          style={{
            fontSize: "12px",
            color: "var(--color-text-secondary, #506867)",
            fontWeight: 550,
            whiteSpace: "nowrap",
            marginLeft: "auto",
          }}
        >
          Showing <b style={{ color: "var(--color-text-primary, #062C2F)" }}>{totalMatching}</b> of {totalAll}
        </div>
      </div>

      {/* Date Period Selector Pills */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          flexWrap: "wrap",
          paddingTop: "6px",
          borderTop: "1px dashed var(--color-border, #D7E6E5)",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 650,
            color: "var(--color-text-muted, #819493)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginRight: "4px",
          }}
        >
          Period:
        </span>
        <div
          className="segmented-control"
          style={{
            display: "inline-flex",
            background: "var(--color-surface-secondary, #E5F4F3)",
            padding: "3px",
            borderRadius: "var(--radius-pill, 999px)",
            border: "1px solid var(--color-border, #D7E6E5)",
            flexWrap: "wrap",
            gap: "2px",
          }}
        >
          {PERIOD_OPTIONS.map((opt) => {
            const isActive = selectedRange === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onRangeChange(opt.id)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "var(--radius-pill, 999px)",
                  fontSize: "12px",
                  fontWeight: isActive ? 650 : 500,
                  border: "none",
                  background: isActive ? "var(--color-focus, #397F7C)" : "transparent",
                  color: isActive ? "#FFFFFF" : "var(--color-text-secondary, #506867)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  fontFamily: "var(--font-sans, inherit)",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Custom Date Range Picker Fields */}
        {selectedRange === "custom" && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              marginLeft: "8px",
              background: "var(--color-surface-secondary, #E5F4F3)",
              padding: "4px 10px",
              borderRadius: "var(--radius-pill, 999px)",
              border: "1px solid var(--color-border, #D7E6E5)",
            }}
          >
            <input
              type="date"
              value={customStart}
              onChange={(e) => onCustomDatesChange(e.target.value, customEnd)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "12px",
                color: "var(--color-text-primary, #062C2F)",
                fontWeight: 600,
                outline: "none",
                fontFamily: "var(--font-sans, inherit)",
              }}
            />
            <span style={{ fontSize: "11px", color: "var(--color-text-muted, #819493)" }}>to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => onCustomDatesChange(customStart, e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "12px",
                color: "var(--color-text-primary, #062C2F)",
                fontWeight: 600,
                outline: "none",
                fontFamily: "var(--font-sans, inherit)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
