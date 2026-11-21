"use client";

import React, { useState } from "react";
import type { ExpenseCategoryLike, ExpenseRecordLike } from "@/lib/expenseAnalytics";
import { CATEGORY_PALETTE, DEFAULT_CATEGORY_COLORS } from "@/lib/expenseAnalytics";

export interface ExpenseCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: readonly ExpenseCategoryLike[];
  expenses: readonly ExpenseRecordLike[];
  onAddCategory: (data: { name: string; color?: string }) => Promise<boolean>;
  onRenameCategory: (id: string, name: string) => Promise<boolean>;
  onDeleteCategory: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export function ExpenseCategoryModal({
  isOpen,
  onClose,
  categories,
  expenses,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
}: ExpenseCategoryModalProps) {
  const [newCatName, setNewCatName] = useState("");
  const [selectedColor, setSelectedColor] = useState<string>(CATEGORY_PALETTE[0]);
  const [isAdding, setIsAdding] = useState(false);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Compute usage counts for each category
  const usageCountMap = new Map<string, number>();
  for (const exp of expenses) {
    if (!exp) continue;
    const catId = exp.categoryId || "";
    const rawCat = (exp.category || "").trim().toLowerCase();
    for (const c of categories) {
      if ((catId && c.id === catId) || (rawCat && c.name.toLowerCase() === rawCat)) {
        usageCountMap.set(c.id, (usageCountMap.get(c.id) || 0) + 1);
      }
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const trimmed = newCatName.trim();
    if (!trimmed) {
      setErrorMsg("Category name is required");
      return;
    }

    // Check duplicate
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`A category named "${trimmed}" already exists.`);
      return;
    }

    setIsAdding(true);
    try {
      const ok = await onAddCategory({ name: trimmed, color: selectedColor });
      if (ok) {
        setNewCatName("");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to add category");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleSaveRename(id: string) {
    setErrorMsg(null);
    const trimmed = renamingName.trim();
    if (!trimmed) {
      setErrorMsg("Category name cannot be empty");
      return;
    }

    // Check duplicate among other categories
    if (categories.some((c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`Another category named "${trimmed}" already exists.`);
      return;
    }

    setIsRenaming(true);
    try {
      const ok = await onRenameCategory(id, trimmed);
      if (ok) {
        setRenamingId(null);
        setRenamingName("");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to rename category");
    } finally {
      setIsRenaming(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    setErrorMsg(null);
    const count = usageCountMap.get(id) || 0;
    if (count > 0) {
      setErrorMsg(`Cannot delete "${name}" because it is currently assigned to ${count} expense(s). Reassign them first.`);
      return;
    }

    setDeletingId(id);
    try {
      const res = await onDeleteCategory(id);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to delete category");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to delete category");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      className="modal-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isAdding && !isRenaming && !deletingId) onClose();
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
        aria-labelledby="manage-categories-title"
        style={{
          background: "var(--color-surface, #EFF9F9)",
          border: "1px solid var(--color-border-strong, #C4D9D7)",
          borderRadius: "var(--radius-card, 24px)",
          boxShadow: "0 20px 48px rgba(6, 44, 47, 0.22)",
          width: "100%",
          maxWidth: "580px",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "26px 28px",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <h3
              id="manage-categories-title"
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 750,
                color: "var(--color-text-primary, #062C2F)",
              }}
            >
              Expense Categories
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary, #506867)" }}>
              Manage classification tags for accounting and expense distribution charts
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--color-text-muted, #819493)",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
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
            <b>Error:</b> {errorMsg}
          </div>
        )}

        {/* Add New Category Section */}
        <div
          style={{
            background: "var(--color-surface-secondary, #E5F4F3)",
            border: "1px solid var(--color-border, #D7E6E5)",
            borderRadius: "14px",
            padding: "14px 16px",
            marginBottom: "20px",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-primary, #062C2F)", marginBottom: "8px" }}>
            Create Custom Category
          </div>
          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="New category name (e.g. 3D Scanning Services)"
                disabled={isAdding}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border-strong, #C4D9D7)",
                  background: "var(--color-surface, #EFF9F9)",
                  color: "var(--color-text-primary, #062C2F)",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={isAdding || !newCatName.trim()}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--color-focus, #397F7C)",
                  color: "#FFFFFF",
                  fontSize: "12px",
                  fontWeight: 650,
                  cursor: isAdding || !newCatName.trim() ? "not-allowed" : "pointer",
                  opacity: isAdding || !newCatName.trim() ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {isAdding ? "Adding..." : "Add Category"}
              </button>
            </div>

            {/* Color Swatch Picker */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted, #819493)" }}>
                Chart Color:
              </span>
              {CATEGORY_PALETTE.map((color) => {
                const isSelected = selectedColor === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      backgroundColor: color,
                      border: isSelected ? "2px solid #062C2F" : "1px solid rgba(0,0,0,0.15)",
                      transform: isSelected ? "scale(1.2)" : "scale(1)",
                      cursor: "pointer",
                      padding: 0,
                      transition: "transform 0.15s ease",
                    }}
                    title={color}
                  />
                );
              })}
            </div>
          </form>
        </div>

        {/* Existing Categories List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "320px", overflowY: "auto" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--color-text-muted, #819493)", marginBottom: "4px" }}>
            Current Categories ({categories.length})
          </div>
          {categories.map((c) => {
            const usageCount = usageCountMap.get(c.id) || 0;
            const isDef = Boolean(c.isDefault);
            const color = c.color || DEFAULT_CATEGORY_COLORS[c.id] || "#64748B";
            const isBeingRenamed = renamingId === c.id;

            return (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  background: "var(--color-surface-secondary, #E5F4F3)",
                  border: "1px solid var(--color-border, #D7E6E5)",
                  gap: "10px",
                }}
              >
                {/* Left: Swatch & Name or Rename Form */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      backgroundColor: color,
                      flexShrink: 0,
                    }}
                  />
                  {isBeingRenamed ? (
                    <div style={{ display: "flex", gap: "6px", flex: 1 }}>
                      <input
                        type="text"
                        value={renamingName}
                        onChange={(e) => setRenamingName(e.target.value)}
                        autoFocus
                        disabled={isRenaming}
                        style={{
                          flex: 1,
                          padding: "4px 8px",
                          borderRadius: "6px",
                          border: "1px solid var(--color-border-strong, #C4D9D7)",
                          background: "var(--color-surface, #EFF9F9)",
                          fontSize: "12px",
                          color: "var(--color-text-primary, #062C2F)",
                          outline: "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(c.id)}
                        disabled={isRenaming}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "6px",
                          border: "none",
                          background: "var(--color-focus, #397F7C)",
                          color: "#FFFFFF",
                          fontSize: "11px",
                          fontWeight: 650,
                          cursor: "pointer",
                        }}
                      >
                        {isRenaming ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "6px",
                          border: "1px solid var(--color-border, #D7E6E5)",
                          background: "transparent",
                          fontSize: "11px",
                          color: "var(--color-text-secondary, #506867)",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--color-text-primary, #062C2F)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {c.name}
                      </span>
                      {isDef && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "999px",
                            background: "rgba(6, 44, 47, 0.08)",
                            color: "var(--color-text-secondary, #506867)",
                          }}
                        >
                          Default
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Usage Count & Action Buttons */}
                {!isBeingRenamed && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: "11px",
                        color: usageCount > 0 ? "var(--color-focus, #397F7C)" : "var(--color-text-muted, #819493)",
                        fontWeight: 550,
                      }}
                      title={`${usageCount} expenses currently recorded under this category`}
                    >
                      {usageCount} {usageCount === 1 ? "expense" : "expenses"}
                    </span>

                    {/* Rename Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(c.id);
                        setRenamingName(c.name);
                        setErrorMsg(null);
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--color-focus, #397F7C)",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: "2px 4px",
                      }}
                    >
                      Rename
                    </button>

                    {/* Delete Button (Protected if isDefault or in use) */}
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id, c.name)}
                      disabled={isDef || usageCount > 0 || deletingId === c.id}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: isDef || usageCount > 0 ? "var(--color-text-muted, #819493)" : "#F43F5E",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        cursor: isDef || usageCount > 0 ? "not-allowed" : "pointer",
                        opacity: isDef || usageCount > 0 ? 0.4 : 1,
                        padding: "2px 4px",
                      }}
                      title={
                        isDef
                          ? "Default system categories cannot be deleted"
                          : usageCount > 0
                          ? `Cannot delete while ${usageCount} expense(s) are using this category`
                          : "Delete custom category"
                      }
                    >
                      {deletingId === c.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 18px",
              borderRadius: "var(--radius-pill, 999px)",
              border: "1px solid var(--color-border-strong, #C4D9D7)",
              background: "transparent",
              color: "var(--color-text-primary, #062C2F)",
              fontSize: "13px",
              fontWeight: 650,
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
