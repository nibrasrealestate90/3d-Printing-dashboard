"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Tag01Icon,
  PlusSignIcon,
  Edit01Icon,
  Delete01Icon,
  ViewIcon,
  ViewOffIcon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  CancelCircleIcon,
  Image01Icon,
  PackageIcon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  Search01Icon,
  ImageNotFound01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { MediaLibraryView } from "@/components/admin/MediaLibraryView";
import { slugify, sanitizeImageUrl } from "@/lib/storefront";

export interface CategoryWithCount {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl: string;
  order: number;
  isPublished: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

function CategoryThumbnail({
  imageUrl,
  name,
}: {
  imageUrl: string | null;
  name: string;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [imageUrl]);

  return (
    <div
      style={{
        position: "relative",
        width: "52px",
        height: "52px",
        borderRadius: "10px",
        background: "#F1F5F9",
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid var(--bm-border-subtle)",
      }}
    >
      {imageUrl && !hasError ? (
        <img
          src={imageUrl}
          alt={name}
          onError={() => setHasError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <HugeIcon icon={hasError ? ImageNotFound01Icon : Tag01Icon} size={22} color="#94A3B8" />
      )}
    </div>
  );
}

export function CategoryManagementView() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryWithCount | null>(null);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [formDescription, setFormDescription] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formIsPublished, setFormIsPublished] = useState(true);
  const [showManualUrlInput, setShowManualUrlInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Media Library Picker State
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);

  // Delete & Protection Dialog State
  const [deletingCategory, setDeletingCategory] = useState<CategoryWithCount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteBlockedReason, setDeleteBlockedReason] = useState<string | null>(null);

  // Reorder State
  const [reordering, setReordering] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/website/categories", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) {
        setCategories(data.items);
      } else {
        setErrorMessage(data.message || "Failed to load categories.");
      }
    } catch {
      setErrorMessage("Network error while loading categories. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Dismiss feedback automatically after 5 seconds
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // Open Add Category Modal
  function handleOpenCreateModal() {
    setEditingCategory(null);
    setFormName("");
    setFormSlug("");
    setIsSlugManuallyEdited(false);
    setFormDescription("");
    setFormImageUrl("");
    setFormIsPublished(true);
    setShowManualUrlInput(false);
    setModalError(null);
    setFieldErrors({});
    setIsMediaPickerOpen(false);
    setIsModalOpen(true);
  }

  // Open Edit Category Modal
  function handleOpenEditModal(cat: CategoryWithCount) {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setIsSlugManuallyEdited(true); // Don't auto-overwrite existing established slug on name edit
    setFormDescription(cat.description || "");
    setFormImageUrl(cat.imageUrl);
    setFormIsPublished(cat.isPublished);
    setShowManualUrlInput(false);
    setModalError(null);
    setFieldErrors({});
    setIsMediaPickerOpen(false);
    setIsModalOpen(true);
  }

  // Name Input Change Handler
  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setFormName(val);
    if (fieldErrors.name) {
      setFieldErrors((prev) => ({ ...prev, name: "" }));
    }
    if (!isSlugManuallyEdited) {
      setFormSlug(slugify(val));
      if (fieldErrors.slug) {
        setFieldErrors((prev) => ({ ...prev, slug: "" }));
      }
    }
  }

  // Slug Input Change Handler
  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.toLowerCase().replace(/\s+/g, "-");
    setFormSlug(val);
    setIsSlugManuallyEdited(true);
    if (fieldErrors.slug) {
      setFieldErrors((prev) => ({ ...prev, slug: "" }));
    }
  }

  // Save Category Form (Create or Update)
  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    setModalError(null);
    const errors: Record<string, string> = {};

    const trimmedName = formName.trim();
    if (!trimmedName) {
      errors.name = "Category name is required.";
    } else if (trimmedName.length > 100) {
      errors.name = "Category name cannot exceed 100 characters.";
    } else {
      const isDupName = categories.some(
        (c) => c.id !== editingCategory?.id && c.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (isDupName) {
        errors.name = `A category named "${trimmedName}" already exists.`;
      }
    }

    let finalSlug = formSlug.trim().toLowerCase();
    if (!finalSlug && trimmedName) {
      finalSlug = slugify(trimmedName);
    }
    if (!finalSlug) {
      errors.slug = "Category URL slug is required.";
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(finalSlug)) {
      errors.slug = "Slug must contain only lowercase letters, numbers, and hyphens.";
    } else {
      const isDupSlug = categories.some(
        (c) => c.id !== editingCategory?.id && c.slug === finalSlug
      );
      if (isDupSlug) {
        errors.slug = `A category with slug "${finalSlug}" already exists.`;
      }
    }

    const trimmedImg = formImageUrl.trim();
    if (!trimmedImg) {
      errors.imageUrl = "Category photograph is required.";
    } else if (!sanitizeImageUrl(trimmedImg)) {
      errors.imageUrl = "Invalid image URL scheme. Please use an HTTPS link or select from Media Library.";
    }

    if (formDescription.length > 500) {
      errors.description = "Description cannot exceed 500 characters.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const isEditing = Boolean(editingCategory);
      const payload: Record<string, any> = {
        action: isEditing ? "update" : "create",
        name: trimmedName,
        slug: finalSlug,
        description: formDescription.trim() || undefined,
        imageUrl: trimmedImg,
        isPublished: formIsPublished,
      };

      if (isEditing && editingCategory) {
        payload.id = editingCategory.id;
        payload.order = editingCategory.order;
      }

      const res = await fetch("/api/admin/website/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsModalOpen(false);
        setFeedback({
          type: "success",
          message: `Category "${trimmedName}" ${isEditing ? "updated" : "created"} successfully.`,
        });
        await fetchCategories();
      } else {
        if (data.errors && typeof data.errors === "object") {
          setFieldErrors(data.errors);
        } else {
          setModalError(data.message || "Failed to save category.");
        }
      }
    } catch {
      setModalError("Network error while saving category. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Toggle Publication Status
  async function handleTogglePublish(cat: CategoryWithCount) {
    const newStatus = !cat.isPublished;
    // Optimistic UI update
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, isPublished: newStatus } : c))
    );

    try {
      const res = await fetch("/api/admin/website/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_publish",
          id: cat.id,
          isPublished: newStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        // Revert on failure
        setCategories((prev) =>
          prev.map((c) => (c.id === cat.id ? { ...c, isPublished: cat.isPublished } : c))
        );
        setFeedback({
          type: "error",
          message: data.message || `Failed to update status for "${cat.name}".`,
        });
      } else {
        setFeedback({
          type: "success",
          message: `Category "${cat.name}" is now ${newStatus ? "published on storefront" : "hidden from storefront"}.`,
        });
      }
    } catch {
      // Revert on network error
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, isPublished: cat.isPublished } : c))
      );
      setFeedback({
        type: "error",
        message: "Network error updating publication status.",
      });
    }
  }

  // Reorder Categories (Move Up / Down)
  async function handleMove(index: number, direction: "up" | "down") {
    if (reordering || searchQuery.trim().length > 0) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= categories.length) return;

    const updated = [...categories];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIdx, 0, moved);

    // Optimistically update local display
    setCategories(updated);
    setReordering(true);

    try {
      const res = await fetch("/api/admin/website/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorder",
          orderedIds: updated.map((c) => c.id),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        // Revert
        setCategories(categories);
        setFeedback({
          type: "error",
          message: data.message || "Failed to reorder categories.",
        });
      } else {
        setFeedback({
          type: "success",
          message: `Category "${moved.name}" moved ${direction}. Display order saved.`,
        });
      }
    } catch {
      setCategories(categories);
      setFeedback({
        type: "error",
        message: "Network error while saving category order.",
      });
    } finally {
      setReordering(false);
    }
  }

  // Open Delete / Guard Dialog
  function handleInitiateDelete(cat: CategoryWithCount) {
    setDeletingCategory(cat);
    setDeleteBlockedReason(null);
  }

  // Execute Confirmed Delete
  async function handleConfirmDelete() {
    if (!deletingCategory) return;
    setIsDeleting(true);
    setDeleteBlockedReason(null);

    try {
      const res = await fetch("/api/admin/website/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          id: deletingCategory.id,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({
          type: "success",
          message: `Category "${deletingCategory.name}" has been permanently deleted.`,
        });
        setDeletingCategory(null);
        await fetchCategories();
      } else {
        // Check for CATEGORY_IN_USE or specific explanation
        if (data.error === "CATEGORY_IN_USE" || data.assignedProductsCount > 0) {
          setDeleteBlockedReason(data.message);
        } else {
          setDeleteBlockedReason(data.message || "Failed to delete category.");
        }
      }
    } catch {
      setDeleteBlockedReason("Network error while deleting category. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  // Metrics computation from API data
  const totalCategories = categories.length;
  const publishedCategories = categories.filter((c) => c.isPublished).length;
  const totalProductsAssigned = categories.reduce((sum, c) => sum + (c.productCount || 0), 0);

  // Filter categories by search
  const filteredCategories = categories.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1280px" }}>
      {/* 1. Page Header */}
      <PageHeader
        title="Product Categories"
        description="Organize your commercial catalog into curated categories displayed in the storefront navigation."
        breadcrumbs="Core Operations"
        badge={{
          text: `${publishedCategories} / ${totalCategories} Live`,
          variant: "success",
        }}
        actions={
          <button
            onClick={handleOpenCreateModal}
            className="bm-btn bm-btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <HugeIcon icon={PlusSignIcon} size={16} strokeWidth={2.5} />
            <span>Add Category</span>
          </button>
        }
      />

      {/* Operation Feedback Banner */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 500,
            background: feedback.type === "success" ? "var(--bm-success-soft)" : "#FEE2E2",
            color: feedback.type === "success" ? "var(--bm-success)" : "#B91C1C",
            border: `1px solid ${feedback.type === "success" ? "rgba(16, 185, 129, 0.3)" : "#FCA5A5"}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <HugeIcon
              icon={feedback.type === "success" ? CheckmarkCircle02Icon : AlertCircleIcon}
              size={18}
            />
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            aria-label="Dismiss message"
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <HugeIcon icon={CancelCircleIcon} size={16} />
          </button>
        </div>
      )}

      {/* 2. Metric Cards */}
      <div className="bm-metrics-grid">
        <MetricCard
          label="Total Categories"
          value={totalCategories}
          subtext="Catalog collections"
          icon={Tag01Icon}
          variant="mint"
        />
        <MetricCard
          label="Published on Store"
          value={publishedCategories}
          subtext={`${totalCategories - publishedCategories} hidden or draft`}
          icon={ViewIcon}
          variant="accent"
        />
        <MetricCard
          label="Products Assigned"
          value={totalProductsAssigned}
          subtext="Commercial items categorized"
          icon={PackageIcon}
          variant="lavender"
        />
      </div>

      {/* 3. Category Table / List Card */}
      <div className="bm-card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Table Toolbar & Search */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--bm-border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
            background: "var(--bm-surface)",
          }}
        >
          <div style={{ position: "relative", minWidth: "260px", maxWidth: "380px", flex: 1 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories by name or slug..."
              style={{
                width: "100%",
                padding: "8px 14px 8px 34px",
                fontSize: "13px",
                borderRadius: "var(--bm-radius-pill)",
                border: "1px solid var(--bm-border-subtle)",
                background: "white",
                color: "var(--bm-text-primary)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "11px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--bm-text-muted)",
                pointerEvents: "none",
              }}
            >
              <HugeIcon icon={Search01Icon} size={15} />
            </div>
          </div>

          <div style={{ fontSize: "12px", color: "var(--bm-text-muted)" }}>
            {searchQuery.trim().length > 0 ? (
              <span>
                Filtering: <strong>{filteredCategories.length}</strong> of {totalCategories} categories
                (clear search to reorder)
              </span>
            ) : (
              <span>
                Displaying <strong>{totalCategories}</strong> catalog {totalCategories === 1 ? "category" : "categories"}
              </span>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div style={{ padding: "64px 20px", textAlign: "center", color: "var(--bm-text-muted)" }}>
            <div style={{ marginBottom: "12px" }}>
              <HugeIcon icon={Tag01Icon} size={32} color="var(--bm-text-muted)" />
            </div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 500 }}>Loading product categories...</p>
          </div>
        ) : errorMessage ? (
          /* Error State */
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <HugeIcon icon={AlertCircleIcon} size={36} color="#DC2626" />
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--bm-text-primary)", margin: "12px 0 6px" }}>
              Unable to Load Categories
            </h3>
            <p style={{ fontSize: "13px", color: "var(--bm-text-secondary)", maxWidth: "400px", margin: "0 auto 16px" }}>
              {errorMessage}
            </p>
            <button onClick={fetchCategories} className="bm-btn bm-btn-secondary">
              Retry
            </button>
          </div>
        ) : categories.length === 0 ? (
          /* Empty State */
          <div style={{ padding: "48px 20px" }}>
            <EmptyState
              icon={Tag01Icon}
              title="No Categories Created Yet"
              description="Create your first category to structure your product catalog and display collections in the storefront 'Shop by Category' section."
              actionText="Add First Category"
              onAction={handleOpenCreateModal}
            />
          </div>
        ) : filteredCategories.length === 0 ? (
          /* Search Empty State */
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <HugeIcon icon={Search01Icon} size={32} color="var(--bm-text-muted)" />
            <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--bm-text-primary)", margin: "12px 0 4px" }}>
              No categories match &quot;{searchQuery}&quot;
            </h3>
            <p style={{ fontSize: "13px", color: "var(--bm-text-muted)", margin: "0 0 16px" }}>
              Check your search query or clear the filter to view all categories.
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="bm-btn bm-btn-secondary"
              style={{ fontSize: "12px", padding: "6px 14px" }}
            >
              Clear Search Filter
            </button>
          </div>
        ) : (
          /* Active Table */
          <div className="bm-table-container">
            <table className="bm-table">
              <thead>
                <tr>
                  <th style={{ width: "90px", textAlign: "center" }}>Order</th>
                  <th style={{ width: "70px" }}>Image</th>
                  <th style={{ minWidth: "220px" }}>Category Name & Slug</th>
                  <th style={{ minWidth: "240px" }}>Description</th>
                  <th style={{ width: "120px", textAlign: "center" }}>Products</th>
                  <th style={{ width: "120px", textAlign: "center" }}>Status</th>
                  <th style={{ width: "160px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((cat, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === filteredCategories.length - 1;
                  const isSearchActive = searchQuery.trim().length > 0;

                  return (
                    <tr key={cat.id}>
                      {/* 1. Order & Reordering Controls */}
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "var(--bm-text-secondary)",
                              fontVariantNumeric: "tabular-nums",
                              minWidth: "24px",
                              textAlign: "right",
                            }}
                          >
                            #{cat.order || idx + 1}
                          </span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginLeft: "4px" }}>
                            <button
                              type="button"
                              onClick={() => handleMove(idx, "up")}
                              disabled={isFirst || isSearchActive || reordering}
                              title={
                                isSearchActive
                                  ? "Clear search to reorder"
                                  : isFirst
                                  ? "Already at top"
                                  : "Move Up"
                              }
                              aria-label={`Move ${cat.name} up`}
                              style={{
                                border: "none",
                                background: "transparent",
                                cursor: isFirst || isSearchActive ? "not-allowed" : "pointer",
                                opacity: isFirst || isSearchActive ? 0.25 : 0.7,
                                padding: "2px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--bm-text-primary)",
                                borderRadius: "4px",
                              }}
                            >
                              <HugeIcon icon={ArrowUp01Icon} size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMove(idx, "down")}
                              disabled={isLast || isSearchActive || reordering}
                              title={
                                isSearchActive
                                  ? "Clear search to reorder"
                                  : isLast
                                  ? "Already at bottom"
                                  : "Move Down"
                              }
                              aria-label={`Move ${cat.name} down`}
                              style={{
                                border: "none",
                                background: "transparent",
                                cursor: isLast || isSearchActive ? "not-allowed" : "pointer",
                                opacity: isLast || isSearchActive ? 0.25 : 0.7,
                                padding: "2px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--bm-text-primary)",
                                borderRadius: "4px",
                              }}
                            >
                              <HugeIcon icon={ArrowDown01Icon} size={13} />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* 2. Photograph Thumbnail */}
                      <td>
                        <CategoryThumbnail imageUrl={cat.imageUrl} name={cat.name} />
                      </td>

                      {/* 3. Name & Slug */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--bm-text-primary)" }}>
                            {cat.name}
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              fontFamily: "monospace",
                              color: "var(--bm-text-muted)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            title={`Storefront path: /category/${cat.slug}`}
                          >
                            <span>/category/{cat.slug}</span>
                          </span>
                        </div>
                      </td>

                      {/* 4. Description */}
                      <td>
                        <p
                          style={{
                            fontSize: "12px",
                            color: cat.description ? "var(--bm-text-secondary)" : "var(--bm-text-muted)",
                            margin: 0,
                            lineHeight: 1.4,
                            maxWidth: "340px",
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                          title={cat.description || "No description provided"}
                        >
                          {cat.description || "—"}
                        </p>
                      </td>

                      {/* 5. Products Assigned */}
                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            fontSize: "12px",
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: cat.productCount > 0 ? "var(--bm-accent-soft)" : "#F1F5F9",
                            color: cat.productCount > 0 ? "var(--bm-accent)" : "var(--bm-text-muted)",
                          }}
                          title={`${cat.productCount} product(s) assigned in commercial catalog`}
                        >
                          <HugeIcon icon={PackageIcon} size={13} />
                          <span>{cat.productCount}</span>
                        </span>
                      </td>

                      {/* 6. Publication Status */}
                      <td style={{ textAlign: "center" }}>
                        <StatusBadge
                          status={cat.isPublished ? "PUBLISHED" : "DRAFT"}
                          label={cat.isPublished ? "Published" : "Hidden"}
                        />
                      </td>

                      {/* 7. Row Actions */}
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          {/* Toggle Publish Quick Action */}
                          <button
                            type="button"
                            onClick={() => handleTogglePublish(cat)}
                            title={cat.isPublished ? "Hide from storefront" : "Publish on storefront"}
                            aria-label={cat.isPublished ? "Hide category" : "Publish category"}
                            style={{
                              border: "1px solid var(--bm-border-subtle)",
                              background: "white",
                              cursor: "pointer",
                              padding: "6px",
                              borderRadius: "6px",
                              color: cat.isPublished ? "#10B981" : "var(--bm-text-muted)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <HugeIcon icon={cat.isPublished ? ViewIcon : ViewOffIcon} size={15} />
                          </button>

                          {/* Edit Action */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(cat)}
                            title="Edit Category Details"
                            aria-label={`Edit ${cat.name}`}
                            style={{
                              border: "1px solid var(--bm-border-subtle)",
                              background: "white",
                              cursor: "pointer",
                              padding: "6px",
                              borderRadius: "6px",
                              color: "var(--bm-text-primary)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <HugeIcon icon={Edit01Icon} size={15} />
                          </button>

                          {/* Delete Action */}
                          <button
                            type="button"
                            onClick={() => handleInitiateDelete(cat)}
                            title={
                              cat.productCount > 0
                                ? `Cannot delete: ${cat.productCount} product(s) assigned`
                                : "Delete Category"
                            }
                            aria-label={`Delete ${cat.name}`}
                            style={{
                              border: "1px solid var(--bm-border-subtle)",
                              background: "white",
                              cursor: "pointer",
                              padding: "6px",
                              borderRadius: "6px",
                              color: cat.productCount > 0 ? "var(--bm-text-muted)" : "#DC2626",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <HugeIcon icon={Delete01Icon} size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ADD / EDIT CATEGORY MODAL */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              setIsModalOpen(false);
            }
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "20px",
              maxWidth: "580px",
              width: "100%",
              boxShadow: "0 20px 45px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "90vh",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--bm-border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "white",
              }}
            >
              <div>
                <h3
                  id="category-modal-title"
                  style={{ fontSize: "17px", fontWeight: 700, color: "var(--bm-text-primary)", margin: 0 }}
                >
                  {editingCategory ? "Edit Product Category" : "Add New Category"}
                </h3>
                <p style={{ fontSize: "12px", color: "var(--bm-text-muted)", margin: "3px 0 0" }}>
                  {editingCategory
                    ? "Update category naming, photograph, and publication state."
                    : "Create a dynamic category collection for your commercial products."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !saving && setIsModalOpen(false)}
                disabled={saving}
                aria-label="Close modal"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: saving ? "not-allowed" : "pointer",
                  color: "var(--bm-text-muted)",
                }}
              >
                <HugeIcon icon={CancelCircleIcon} size={22} />
              </button>
            </div>

            {/* Modal Form */}
            <form
              onSubmit={handleSaveCategory}
              style={{ padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "18px" }}
            >
              {modalError && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: "#FEE2E2",
                    color: "#B91C1C",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <HugeIcon icon={AlertCircleIcon} size={16} />
                  <span>{modalError}</span>
                </div>
              )}

              {/* 1. Category Name */}
              <div>
                <label
                  htmlFor="category-name-input"
                  style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "6px" }}
                >
                  Category Name *
                </label>
                <input
                  id="category-name-input"
                  type="text"
                  required
                  maxLength={100}
                  value={formName}
                  onChange={handleNameChange}
                  placeholder="e.g. Desk Accessories"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${fieldErrors.name ? "#DC2626" : "var(--bm-border-subtle)"}`,
                    fontSize: "13px",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
                {fieldErrors.name && (
                  <span style={{ fontSize: "11px", color: "#DC2626", marginTop: "4px", display: "block" }}>
                    {fieldErrors.name}
                  </span>
                )}
              </div>

              {/* 2. URL Slug */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label
                    htmlFor="category-slug-input"
                    style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", margin: 0 }}
                  >
                    URL Slug *
                  </label>
                  <span style={{ fontSize: "11px", color: "var(--bm-text-muted)" }}>
                    Storefront path: /category/{formSlug || "..."}
                  </span>
                </div>
                <input
                  id="category-slug-input"
                  type="text"
                  required
                  value={formSlug}
                  onChange={handleSlugChange}
                  placeholder="e.g. desk-accessories"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${fieldErrors.slug ? "#DC2626" : "var(--bm-border-subtle)"}`,
                    fontSize: "13px",
                    fontFamily: "monospace",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
                {fieldErrors.slug ? (
                  <span style={{ fontSize: "11px", color: "#DC2626", marginTop: "4px", display: "block" }}>
                    {fieldErrors.slug}
                  </span>
                ) : (
                  <span style={{ fontSize: "11px", color: "var(--bm-text-muted)", marginTop: "3px", display: "block" }}>
                    Automatically generated from category name. Only lowercase letters, numbers, and hyphens.
                  </span>
                )}
              </div>

              {/* 3. Description */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label
                    htmlFor="category-description-input"
                    style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", margin: 0 }}
                  >
                    Description (optional)
                  </label>
                  <span
                    style={{
                      fontSize: "11px",
                      color: formDescription.length > 450 ? "#EA580C" : "var(--bm-text-muted)",
                      fontWeight: formDescription.length > 450 ? 600 : 400,
                    }}
                  >
                    {formDescription.length} / 500
                  </span>
                </div>
                <textarea
                  id="category-description-input"
                  rows={3}
                  maxLength={500}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description displayed on the category banner and storefront meta tags..."
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${fieldErrors.description ? "#DC2626" : "var(--bm-border-subtle)"}`,
                    fontSize: "13px",
                    boxSizing: "border-box",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
                {fieldErrors.description && (
                  <span style={{ fontSize: "11px", color: "#DC2626", marginTop: "4px", display: "block" }}>
                    {fieldErrors.description}
                  </span>
                )}
              </div>

              {/* 4. Category Photograph */}
              <div>
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--bm-text-secondary)",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Category Photograph *
                </label>

                {formImageUrl ? (
                  /* Image Selected Preview Card */
                  <div
                    style={{
                      display: "flex",
                      gap: "14px",
                      alignItems: "center",
                      padding: "12px",
                      borderRadius: "10px",
                      background: "#F8FAFC",
                      border: `1px solid ${fieldErrors.imageUrl ? "#DC2626" : "var(--bm-border-subtle)"}`,
                    }}
                  >
                    <div
                      style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "8px",
                        overflow: "hidden",
                        border: "1px solid var(--bm-border-subtle)",
                        background: "#E2E8F0",
                        flexShrink: 0,
                        position: "relative",
                      }}
                    >
                      <img
                        src={formImageUrl}
                        alt="Selected category preview"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--bm-text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          marginBottom: "4px",
                        }}
                      >
                        Selected Media Asset
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--bm-text-primary)",
                          fontFamily: "monospace",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "100%",
                          marginBottom: "8px",
                        }}
                        title={formImageUrl}
                      >
                        {formImageUrl}
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => setIsMediaPickerOpen(true)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            border: "1px solid var(--bm-border-subtle)",
                            background: "white",
                            color: "var(--bm-text-primary)",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <HugeIcon icon={Image01Icon} size={13} />
                          <span>Change Photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormImageUrl("");
                            setShowManualUrlInput(false);
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            border: "none",
                            background: "transparent",
                            color: "#DC2626",
                            fontSize: "11px",
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          <HugeIcon icon={Delete01Icon} size={13} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Image Selector Empty State */
                  <div
                    onClick={() => setIsMediaPickerOpen(true)}
                    style={{
                      border: `2px dashed ${fieldErrors.imageUrl ? "#DC2626" : "var(--bm-border-subtle)"}`,
                      borderRadius: "12px",
                      padding: "24px 16px",
                      textAlign: "center",
                      background: "#F8FAFC",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ color: "var(--bm-text-muted)", marginBottom: "6px" }}>
                      <HugeIcon icon={Image01Icon} size={28} />
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--bm-text-primary)" }}>
                      Choose from Media Library
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--bm-text-muted)", marginTop: "2px" }}>
                      Select an existing photo or upload high-resolution category artwork to R2
                    </div>
                  </div>
                )}

                {fieldErrors.imageUrl && (
                  <span style={{ fontSize: "11px", color: "#DC2626", marginTop: "4px", display: "block" }}>
                    {fieldErrors.imageUrl}
                  </span>
                )}

                {/* Optional Manual URL Fallback Toggle */}
                <div style={{ marginTop: "8px" }}>
                  {!showManualUrlInput ? (
                    <button
                      type="button"
                      onClick={() => setShowManualUrlInput(true)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--bm-accent)",
                        fontSize: "11px",
                        cursor: "pointer",
                        padding: 0,
                        textDecoration: "underline",
                      }}
                    >
                      Or enter image URL manually
                    </button>
                  ) : (
                    <div style={{ marginTop: "6px" }}>
                      <input
                        type="url"
                        value={formImageUrl}
                        onChange={(e) => {
                          setFormImageUrl(e.target.value);
                          if (fieldErrors.imageUrl) setFieldErrors((prev) => ({ ...prev, imageUrl: "" }));
                        }}
                        placeholder="https://.../categories/example.webp"
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--bm-border-subtle)",
                          fontSize: "12px",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Storefront Publish Checkbox */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  cursor: "pointer",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "#F8FAFC",
                  border: "1px solid var(--bm-border-subtle)",
                }}
              >
                <input
                  type="checkbox"
                  checked={formIsPublished}
                  onChange={(e) => setFormIsPublished(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "var(--bm-accent)", marginTop: "2px" }}
                />
                <div>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--bm-text-primary)", display: "block" }}>
                    Publish on public storefront
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--bm-text-muted)", display: "block", marginTop: "1px" }}>
                    When checked, this category appears immediately in &quot;Shop by Category&quot; and storefront navigation.
                  </span>
                </div>
              </label>

              {/* Modal Actions */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  marginTop: "8px",
                  paddingTop: "16px",
                  borderTop: "1px solid var(--bm-border-subtle)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="bm-btn bm-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bm-btn bm-btn-primary"
                  style={{ minWidth: "130px" }}
                >
                  {saving ? "Saving..." : editingCategory ? "Update Category" : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MEDIA LIBRARY PICKER MODAL */}
      {/* ========================================================================= */}
      {isMediaPickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="media-picker-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 150,
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsMediaPickerOpen(false);
            }
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "20px",
              maxWidth: "960px",
              width: "100%",
              height: "85vh",
              maxHeight: "800px",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid var(--bm-border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "white",
              }}
            >
              <div>
                <h3
                  id="media-picker-title"
                  style={{ fontSize: "16px", fontWeight: 700, color: "var(--bm-text-primary)", margin: 0 }}
                >
                  Select Category Image from Media Library
                </h3>
                <p style={{ fontSize: "12px", color: "var(--bm-text-muted)", margin: "2px 0 0" }}>
                  Click any image to select it as the category photograph, or upload a new photo directly to R2.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMediaPickerOpen(false)}
                aria-label="Close Media Library Picker"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--bm-text-muted)",
                }}
              >
                <HugeIcon icon={CancelCircleIcon} size={22} />
              </button>
            </div>

            <div style={{ padding: "20px", overflowY: "auto", flex: 1, background: "#F8FAFC" }}>
              <MediaLibraryView
                onSelectImage={(url) => {
                  setFormImageUrl(url);
                  setFieldErrors((prev) => ({ ...prev, imageUrl: "" }));
                  setIsMediaPickerOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE / GUARD CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deletingCategory && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              setDeletingCategory(null);
            }
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "18px",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {/* If products are assigned or backend returned CATEGORY_IN_USE: Show Guard Explanation */}
            {deletingCategory.productCount > 0 || deleteBlockedReason ? (
              <>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: "var(--bm-warning-soft)",
                      color: "var(--bm-warning)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <HugeIcon icon={AlertCircleIcon} size={22} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3
                      id="delete-dialog-title"
                      style={{ fontSize: "16px", fontWeight: 700, color: "var(--bm-text-primary)", margin: "0 0 6px" }}
                    >
                      Deletion Blocked: Products Assigned
                    </h3>
                    <p style={{ fontSize: "13px", color: "var(--bm-text-secondary)", lineHeight: 1.5, margin: 0 }}>
                      {deleteBlockedReason || (
                        <>
                          Cannot delete category <strong>&quot;{deletingCategory.name}&quot;</strong> because{" "}
                          <strong>
                            {deletingCategory.productCount}{" "}
                            {deletingCategory.productCount === 1 ? "product is" : "products are"}
                          </strong>{" "}
                          currently assigned to it.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: "#F8FAFC",
                    border: "1px solid var(--bm-border-subtle)",
                    fontSize: "12px",
                    color: "var(--bm-text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  To protect your storefront catalog and prevent disconnected products, please reassign or delete
                  all assigned products in the Commercial Products workspace before deleting this category.
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setDeletingCategory(null)}
                    className="bm-btn bm-btn-secondary"
                  >
                    Close
                  </button>
                  <Link
                    href="/admin/products"
                    className="bm-btn bm-btn-primary"
                    style={{ textDecoration: "none" }}
                  >
                    Go to Products
                  </Link>
                </div>
              </>
            ) : (
              /* If product count === 0: Show Confirmation Dialog */
              <>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: "#FEE2E2",
                      color: "#DC2626",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <HugeIcon icon={Delete01Icon} size={20} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3
                      id="delete-dialog-title"
                      style={{ fontSize: "16px", fontWeight: 700, color: "var(--bm-text-primary)", margin: "0 0 6px" }}
                    >
                      Delete Category &quot;{deletingCategory.name}&quot;?
                    </h3>
                    <p style={{ fontSize: "13px", color: "var(--bm-text-secondary)", lineHeight: 1.5, margin: 0 }}>
                      Are you sure you want to delete this category? It will be permanently removed from your catalog
                      and storefront navigation. This action cannot be undone.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setDeletingCategory(null)}
                    disabled={isDeleting}
                    className="bm-btn bm-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "var(--bm-radius-md)",
                      background: "#DC2626",
                      color: "#FFFFFF",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: isDeleting ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {isDeleting ? "Deleting..." : "Delete Category"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
