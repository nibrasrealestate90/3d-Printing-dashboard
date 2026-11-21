"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { ExpenseRecordLike, ExpenseCategoryLike } from "@/lib/expenseAnalytics";
import {
  getFilteredExpenses,
  calculateExpenseKPIs,
  getExpenseCategories,
  getStartEndForPeriod,
  DEFAULT_EXPENSE_CATEGORY_DEFINITIONS,
} from "@/components/ledgerCore";
import {
  generateExpenseTrendData,
  generateCategoryDistributionData,
  generateCategoryComparisonData,
} from "@/lib/expenseAnalytics";

import { ExpenseKPIs } from "./ExpenseKPIs";
import { ExpenseFilterToolbar } from "./ExpenseFilterToolbar";
import { ExpenseTransactionTable } from "./ExpenseTransactionTable";
import { ExpenseAnalyticsCard } from "./ExpenseAnalyticsCard";
import { ExpenseTrendChart } from "./ExpenseTrendChart";
import { ExpenseCategoryDistributionChart } from "./ExpenseCategoryDistributionChart";
import { ExpenseCategoryComparisonChart } from "./ExpenseCategoryComparisonChart";
import { ExpenseFormModal } from "./ExpenseFormModal";
import { ExpenseDeleteModal } from "./ExpenseDeleteModal";
import { ExpenseCategoryModal } from "./ExpenseCategoryModal";

export function ExpenseManagementView() {
  // 1. Data State (Expenses & Categories)
  const [expenses, setExpenses] = useState<ExpenseRecordLike[]>(() => {
    if (typeof window !== "undefined" && (window as any).S && Array.isArray((window as any).S.expenses)) {
      return (window as any).S.expenses;
    }
    return [];
  });

  const [categories, setCategories] = useState<ExpenseCategoryLike[]>(() => {
    if (typeof window !== "undefined" && (window as any).S && Array.isArray((window as any).S.expense_categories)) {
      return getExpenseCategories((window as any).S.expense_categories);
    }
    return DEFAULT_EXPENSE_CATEGORY_DEFINITIONS;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // 2. Filter & Date Range State
  const [searchQuery, setSearchQuery] = useState("");
  const [range, setRange] = useState("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  // 3. Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecordLike | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<ExpenseRecordLike | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = useCallback((text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
  }, []);

  // Fetch from API to ensure synchronized records
  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [expRes, catRes] = await Promise.all([
        fetch("/api/admin/expenses", { cache: "no-store" }),
        fetch("/api/admin/expenses/categories", { cache: "no-store" }),
      ]);

      if (expRes.ok) {
        const expJson = await expRes.json();
        if (Array.isArray(expJson.expenses)) {
          setExpenses(expJson.expenses);
          if (typeof window !== "undefined" && (window as any).S) {
            (window as any).S.expenses = expJson.expenses;
            if (typeof (window as any).save === "function") (window as any).save();
          }
        }
      }

      if (catRes.ok) {
        const catJson = await catRes.json();
        if (Array.isArray(catJson.categories) && catJson.categories.length > 0) {
          const valid = getExpenseCategories(catJson.categories);
          setCategories(valid);
          if (typeof window !== "undefined" && (window as any).S) {
            (window as any).S.expense_categories = valid;
            if (typeof (window as any).save === "function") (window as any).save();
          }
        }
      }
    } catch (err) {
      console.warn("Could not fetch remote expenses; using local state:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Compute active period label for display
  const activePeriodLabel = useMemo(() => {
    switch (range) {
      case "today":
        return "Today";
      case "7d":
        return "Last 7 Days";
      case "30d":
        return "Last 30 Days";
      case "this_month":
        return "This Month";
      case "last_month":
        return "Last Month";
      case "custom":
        return customStart && customEnd ? `${customStart} to ${customEnd}` : "Custom Range";
      case "all":
      default:
        return "All Time";
    }
  }, [range, customStart, customEnd]);

  // Filter expenses using approved Task 3 engine
  const filteredExpenses = useMemo(() => {
    return getFilteredExpenses(expenses, {
      range,
      customStart,
      customEnd,
      category: selectedCategory,
      search: searchQuery,
    });
  }, [expenses, range, customStart, customEnd, selectedCategory, searchQuery]);

  // Compute KPIs using approved Task 3 engine
  const kpis = useMemo(() => {
    return calculateExpenseKPIs(filteredExpenses, expenses);
  }, [filteredExpenses, expenses]);

  // Resolved period bounds for analytics charts
  const periodBounds = useMemo(() => {
    return getStartEndForPeriod(range, customStart, customEnd);
  }, [range, customStart, customEnd]);

  // Analytics datasets (Task 4)
  const trendData = useMemo(() => {
    return generateExpenseTrendData(filteredExpenses, {
      range,
      startDate: periodBounds.startDate,
      endDate: periodBounds.endDate,
    });
  }, [filteredExpenses, range, periodBounds]);

  const categoryDistributionData = useMemo(() => {
    return generateCategoryDistributionData(filteredExpenses, categories);
  }, [filteredExpenses, categories]);

  const categoryComparisonData = useMemo(() => {
    return generateCategoryComparisonData(filteredExpenses, categories, { maxItems: 10 });
  }, [filteredExpenses, categories]);

  const hasActiveFilters = Boolean(searchQuery || selectedCategory || range !== "30d" || customStart || customEnd);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setRange("30d");
    setCustomStart("");
    setCustomEnd("");
    setSelectedCategory("");
  }, []);

  // --------------------------------------------------------------------------
  // Expense CRUD Handlers
  // --------------------------------------------------------------------------

  const handleOpenAddModal = useCallback(() => {
    setEditingExpense(null);
    setIsFormModalOpen(true);
  }, []);

  // Listen to global openAddExpenseModal events (e.g. from topbar button)
  useEffect(() => {
    const handler = () => handleOpenAddModal();
    window.addEventListener("openAddExpenseModal", handler);
    return () => window.removeEventListener("openAddExpenseModal", handler);
  }, [handleOpenAddModal]);

  const handleOpenEditModal = useCallback((exp: ExpenseRecordLike) => {
    setEditingExpense(exp);
    setIsFormModalOpen(true);
  }, []);

  const handleOpenDeleteModal = useCallback((exp: ExpenseRecordLike) => {
    setDeletingExpense(exp);
    setIsDeleteModalOpen(true);
  }, []);

  const handleSaveExpense = useCallback(
    async (payload: any) => {
      const isEditing = Boolean(payload.id);
      const endpoint = "/api/admin/expenses";
      const method = isEditing ? "PUT" : "POST";

      try {
        const res = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || `Failed to ${isEditing ? "update" : "create"} expense`);
        }

        const savedExp: ExpenseRecordLike = json.expense || payload;

        // Update local state immediately
        setExpenses((prev) => {
          let updated: ExpenseRecordLike[];
          if (isEditing) {
            updated = prev.map((e) => (e.id === savedExp.id ? { ...e, ...savedExp } : e));
          } else {
            updated = [savedExp, ...prev];
          }
          if (typeof window !== "undefined" && (window as any).S) {
            (window as any).S.expenses = updated;
            if (typeof (window as any).save === "function") (window as any).save();
          }
          return updated;
        });

        showToast(isEditing ? "Expense updated successfully." : "Expense recorded successfully.", "success");
        return true;
      } catch (err: any) {
        console.error("Save expense error:", err);
        showToast(err.message || "Failed to save expense", "error");
        return false;
      }
    },
    [showToast]
  );

  const handleDeleteExpenseConfirm = useCallback(async () => {
    if (!deletingExpense || !deletingExpense.id) return false;
    const expId = deletingExpense.id;

    try {
      const res = await fetch(`/api/admin/expenses?id=${encodeURIComponent(expId)}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete expense");
      }

      setExpenses((prev) => {
        const updated = prev.filter((e) => e.id !== expId);
        if (typeof window !== "undefined" && (window as any).S) {
          (window as any).S.expenses = updated;
          if (typeof (window as any).save === "function") (window as any).save();
        }
        return updated;
      });

      showToast("Expense record removed from ledger.", "success");
      return true;
    } catch (err: any) {
      console.error("Delete expense error:", err);
      showToast(err.message || "Failed to delete expense", "error");
      return false;
    }
  }, [deletingExpense, showToast]);

  // --------------------------------------------------------------------------
  // Category Management Handlers
  // --------------------------------------------------------------------------

  const handleAddCategory = useCallback(
    async (catData: { name: string; color?: string }) => {
      try {
        const res = await fetch("/api/admin/expenses/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(catData),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to create category");
        }

        const newCat = json.category;
        setCategories((prev) => {
          const updated = [...prev, newCat];
          if (typeof window !== "undefined" && (window as any).S) {
            (window as any).S.expense_categories = updated;
            if (typeof (window as any).save === "function") (window as any).save();
          }
          return updated;
        });

        showToast(`Category "${catData.name}" created.`, "success");
        return true;
      } catch (err: any) {
        showToast(err.message || "Failed to add category", "error");
        throw err;
      }
    },
    [showToast]
  );

  const handleRenameCategory = useCallback(
    async (id: string, name: string) => {
      try {
        const res = await fetch("/api/admin/expenses/categories", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, name }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to rename category");
        }

        const updatedCat = json.category;
        setCategories((prev) => {
          const updated = prev.map((c) => (c.id === id ? { ...c, ...updatedCat } : c));
          if (typeof window !== "undefined" && (window as any).S) {
            (window as any).S.expense_categories = updated;
            if (typeof (window as any).save === "function") (window as any).save();
          }
          return updated;
        });

        // Also update local expense records using this category
        setExpenses((prev) =>
          prev.map((e) => (e.categoryId === id ? { ...e, category: name } : e))
        );

        showToast(`Category renamed to "${name}".`, "success");
        return true;
      } catch (err: any) {
        showToast(err.message || "Failed to rename category", "error");
        throw err;
      }
    },
    [showToast]
  );

  const handleDeleteCategory = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/admin/expenses/categories?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });

        const json = await res.json();
        if (!res.ok) {
          return { success: false, error: json.error || "Failed to delete category" };
        }

        setCategories((prev) => {
          const updated = prev.filter((c) => c.id !== id);
          if (typeof window !== "undefined" && (window as any).S) {
            (window as any).S.expense_categories = updated;
            if (typeof (window as any).save === "function") (window as any).save();
          }
          return updated;
        });

        showToast("Category removed.", "success");
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || "Failed to delete category" };
      }
    },
    [showToast]
  );

  return (
    <div className="expenses-view-container" style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 18px",
            borderRadius: "12px",
            background: toastMessage.type === "success" ? "#064E3B" : "#7F1D1D",
            color: "#FFFFFF",
            boxShadow: "0 12px 28px rgba(0,0,0,0.25)",
            fontSize: "13px",
            fontWeight: 600,
            animation: "slideInRight 0.25s ease forwards",
          }}
        >
          <span>{toastMessage.type === "success" ? "✓" : "⚠"}</span>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: 750,
              color: "var(--color-text-primary, #062C2F)",
              letterSpacing: "-0.4px",
            }}
          >
            Expenses
          </h2>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: "13px",
              color: "var(--color-text-secondary, #506867)",
              lineHeight: "1.4",
            }}
          >
            Track, categorize, and review business expenditures, studio supplies, and operating overheads.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Manage Categories Button */}
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "9px 16px",
              borderRadius: "var(--radius-pill, 999px)",
              border: "1px solid var(--color-border-strong, #C4D9D7)",
              background: "var(--color-surface, #EFF9F9)",
              color: "var(--color-text-primary, #062C2F)",
              fontSize: "13px",
              fontWeight: 650,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
              <path d="M7 7h.01" />
            </svg>
            Categories
          </button>

          {/* Add Expense Button */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "9px 20px",
              borderRadius: "var(--radius-pill, 999px)",
              border: "none",
              background: "var(--color-focus, #397F7C)",
              color: "#FFFFFF",
              fontSize: "13px",
              fontWeight: 650,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(57, 127, 124, 0.35)",
              transition: "all 0.15s ease",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Expense
          </button>
        </div>
      </div>

      {/* 1. KPI Cards */}
      <ExpenseKPIs kpis={kpis} activePeriodLabel={activePeriodLabel} isFiltered={hasActiveFilters} />

      {/* 2. Analytics Visualizations Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        {/* Trend Chart (7 cols on desktop) */}
        <div style={{ gridColumn: "span 7" }} className="analytics-trend-col">
          <ExpenseAnalyticsCard
            title="Spending Progression"
            subtitle={`${activePeriodLabel} • ${trendData.granularity.toUpperCase()} aggregation`}
            badge={trendData.totalFormatted}
          >
            <ExpenseTrendChart data={trendData} height="280px" />
          </ExpenseAnalyticsCard>
        </div>

        {/* Category Distribution Donut Chart (5 cols on desktop) */}
        <div style={{ gridColumn: "span 5" }} className="analytics-dist-col">
          <ExpenseAnalyticsCard
            title="Category Share"
            subtitle="Breakdown by expense classification"
            badge={`${categoryDistributionData.categoryCount} Categories`}
          >
            <ExpenseCategoryDistributionChart data={categoryDistributionData} height="280px" />
          </ExpenseAnalyticsCard>
        </div>

        {/* Category Comparison Ranking (Full 12 cols) */}
        {categoryComparisonData.items.length > 0 && (
          <div style={{ gridColumn: "span 12" }}>
            <ExpenseAnalyticsCard
              title="Category Spend Ranking"
              subtitle="Ranked expenditure totals across business categories"
              badge={`Peak: AED ${categoryComparisonData.maxAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            >
              <ExpenseCategoryComparisonChart data={categoryComparisonData} />
            </ExpenseAnalyticsCard>
          </div>
        )}
      </div>

      {/* 3. Filter Toolbar */}
      <ExpenseFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedRange={range}
        onRangeChange={setRange}
        customStart={customStart}
        customEnd={customEnd}
        onCustomDatesChange={(start, end) => {
          setCustomStart(start);
          setCustomEnd(end);
        }}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        categories={categories}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
        totalMatching={filteredExpenses.length}
        totalAll={expenses.length}
      />

      {/* 4. Transactions Table */}
      <ExpenseTransactionTable
        expenses={filteredExpenses}
        categories={categories}
        loading={isLoading}
        onEdit={handleOpenEditModal}
        onDelete={handleOpenDeleteModal}
        onAddExpense={handleOpenAddModal}
      />

      {/* 5. Modals */}
      <ExpenseFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        expense={editingExpense}
        categories={categories}
        onSave={handleSaveExpense}
      />

      <ExpenseDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        expense={deletingExpense}
        onConfirm={handleDeleteExpenseConfirm}
      />

      <ExpenseCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        expenses={expenses}
        onAddCategory={handleAddCategory}
        onRenameCategory={handleRenameCategory}
        onDeleteCategory={handleDeleteCategory}
      />

      <style jsx>{`
        @media (max-width: 980px) {
          .analytics-trend-col,
          .analytics-dist-col {
            grid-column: span 12 !important;
          }
        }
      `}</style>
    </div>
  );
}
