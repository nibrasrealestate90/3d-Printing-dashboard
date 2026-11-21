"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { ExpenseRecordLike, ExpenseCategoryLike } from "@/lib/expenseAnalytics";
import {
  getFilteredExpenses,
  calculateExpenseKPIs,
  getExpenseCategories,
  DEFAULT_EXPENSE_CATEGORY_DEFINITIONS,
} from "@/components/ledgerCore";

import { ExpenseKPIs } from "./ExpenseKPIs";
import { ExpenseFilterToolbar } from "./ExpenseFilterToolbar";
import { ExpenseTransactionTable } from "./ExpenseTransactionTable";
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
            if (typeof (window as any).persistExpenseData === "function") {
              (window as any).persistExpenseData("expenses");
            }
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
            if (typeof (window as any).persistExpenseData === "function") {
              (window as any).persistExpenseData("expense_categories");
            }
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

      const commitLocally = (savedExp: ExpenseRecordLike, isLocalOnly = false) => {
        setExpenses((prev) => {
          let updated: ExpenseRecordLike[];
          if (isEditing) {
            updated = prev.map((e) => (e.id === savedExp.id ? { ...e, ...savedExp } : e));
          } else {
            updated = [savedExp, ...prev];
          }
          if (typeof window !== "undefined" && (window as any).S) {
            (window as any).S.expenses = updated;
            if (typeof (window as any).persistExpenseData === "function") {
              (window as any).persistExpenseData("expenses");
            }
          }
          return updated;
        });
        showToast(
          isLocalOnly
            ? (isEditing ? "Expense updated locally." : "Expense recorded locally.")
            : (isEditing ? "Expense updated successfully." : "Expense recorded successfully."),
          "success"
        );
      };

      try {
        const res = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 401 || res.status === 503) {
            const fallbackExp: ExpenseRecordLike = {
              ...payload,
              id: payload.id || `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              updatedAt: new Date().toISOString(),
              createdAt: payload.createdAt || new Date().toISOString(),
            };
            commitLocally(fallbackExp, true);
            return true;
          }
          throw new Error(json.message || json.error || `Failed to ${isEditing ? "update" : "create"} expense`);
        }

        const savedExp: ExpenseRecordLike = json.expense || payload;
        commitLocally(savedExp, false);
        return true;
      } catch (err: any) {
        console.error("Save expense fallback:", err);
        const fallbackExp: ExpenseRecordLike = {
          ...payload,
          id: payload.id || `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          updatedAt: new Date().toISOString(),
          createdAt: payload.createdAt || new Date().toISOString(),
        };
        commitLocally(fallbackExp, true);
        return true;
      }
    },
    [showToast]
  );

  const handleDeleteExpenseConfirm = useCallback(async () => {
    if (!deletingExpense || !deletingExpense.id) return false;
    const expId = deletingExpense.id;

    const commitDeleteLocally = (isLocalOnly = false) => {
      setExpenses((prev) => {
        const updated = prev.filter((e) => e.id !== expId);
        if (typeof window !== "undefined" && (window as any).S) {
          (window as any).S.expenses = updated;
          if (typeof (window as any).persistExpenseData === "function") {
            (window as any).persistExpenseData("expenses");
          }
        }
        return updated;
      });
      showToast(
        isLocalOnly ? "Expense record removed locally." : "Expense record removed from ledger.",
        "success"
      );
    };

    try {
      const res = await fetch(`/api/admin/expenses?id=${encodeURIComponent(expId)}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 || res.status === 503) {
          commitDeleteLocally(true);
          return true;
        }
        throw new Error(json.message || json.error || "Failed to delete expense");
      }

      commitDeleteLocally(false);
      return true;
    } catch (err: any) {
      console.error("Delete expense fallback:", err);
      commitDeleteLocally(true);
      return true;
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

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 401 || res.status === 503) {
            const fallbackCat: ExpenseCategoryLike = {
              id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              name: catData.name,
              color: catData.color,
              isDefault: false,
            };
            setCategories((prev) => {
              const updated = [...prev, fallbackCat];
              if (typeof window !== "undefined" && (window as any).S) {
                (window as any).S.expense_categories = updated;
                if (typeof (window as any).persistExpenseData === "function") {
                  (window as any).persistExpenseData("expense_categories");
                }
              }
              return updated;
            });
            showToast(`Category "${catData.name}" created locally.`, "success");
            return true;
          }
          throw new Error(json.message || json.error || "Failed to create category");
        }

        const newCat = json.category;
        setCategories((prev) => {
          const updated = [...prev, newCat];
          if (typeof window !== "undefined" && (window as any).S) {
            (window as any).S.expense_categories = updated;
            if (typeof (window as any).persistExpenseData === "function") {
              (window as any).persistExpenseData("expense_categories");
            }
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

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 401 || res.status === 503) {
            setCategories((prev) => {
              const updated = prev.map((c) => (c.id === id ? { ...c, name } : c));
              if (typeof window !== "undefined" && (window as any).S) {
                (window as any).S.expense_categories = updated;
                if (typeof (window as any).persistExpenseData === "function") {
                  (window as any).persistExpenseData("expense_categories");
                }
              }
              return updated;
            });
            setExpenses((prev) =>
              prev.map((e) => (e.categoryId === id ? { ...e, category: name } : e))
            );
            showToast(`Category renamed to "${name}" locally.`, "success");
            return true;
          }
          throw new Error(json.message || json.error || "Failed to rename category");
        }

        const updatedCat = json.category;
        setCategories((prev) => {
          const updated = prev.map((c) => (c.id === id ? { ...c, ...updatedCat } : c));
          if (typeof window !== "undefined" && (window as any).S) {
            (window as any).S.expense_categories = updated;
            if (typeof (window as any).persistExpenseData === "function") {
              (window as any).persistExpenseData("expense_categories");
            }
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
      const commitCategoryDelete = () => {
        setCategories((prev) => {
          const updated = prev.filter((c) => c.id !== id);
          if (typeof window !== "undefined" && (window as any).S) {
            (window as any).S.expense_categories = updated;
            if (typeof (window as any).persistExpenseData === "function") {
              (window as any).persistExpenseData("expense_categories");
            }
          }
          return updated;
        });
      };

      try {
        const res = await fetch(`/api/admin/expenses/categories?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 401 || res.status === 503) {
            const inUseLocally = expenses.some(
              (e) => e.categoryId === id || (e.category || "").toLowerCase() === (categories.find(c => c.id === id)?.name || "").toLowerCase()
            );
            if (inUseLocally) {
              return { success: false, error: "Cannot delete category while expenses are assigned to it." };
            }
            commitCategoryDelete();
            showToast("Category removed locally.", "success");
            return { success: true };
          }
          return { success: false, error: json.message || json.error || "Failed to delete category" };
        }

        commitCategoryDelete();
        showToast("Category removed.", "success");
        return { success: true };
      } catch (err: any) {
        const inUseLocally = expenses.some(
          (e) => e.categoryId === id || (e.category || "").toLowerCase() === (categories.find(c => c.id === id)?.name || "").toLowerCase()
        );
        if (inUseLocally) {
          return { success: false, error: "Cannot delete category while expenses are assigned to it." };
        }
        commitCategoryDelete();
        showToast("Category removed locally.", "success");
        return { success: true };
      }
    },
    [showToast, expenses, categories]
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

      {/* 1. KPI Cards (Uplifted to Top) */}
      <ExpenseKPIs kpis={kpis} activePeriodLabel={activePeriodLabel} isFiltered={hasActiveFilters} />

      {/* 2. Filter Toolbar */}
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
        onOpenCategoriesModal={() => setIsCategoryModalOpen(true)}
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
    </div>
  );
}
