"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  PackageIcon,
  Search01Icon,
  PlusSignIcon,
  Edit01Icon,
  CheckmarkCircle02Icon,
  CancelCircleIcon,
  ViewIcon,
  ViewOffIcon,
  StarIcon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  Delete01Icon,
  Image01Icon,
  Upload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";

interface ProductItem {
  id: string;
  name: string;
  internalName?: string;
  sku: string;
  category: string;
  sellingPrice: number;
  currency: string;
  description: string;
  internalNotes?: string;
  imageUrl: string | null;
  images: string[];
  material?: string;
  dimensions?: string;
  finish?: string;
  colors?: string[];
  supportsPersonalization: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  isAvailable: boolean;
  published: boolean;
  isBambuImport?: boolean;
  updatedAt: string;
}

const CATEGORIES = [
  "Home Decor",
  "Personalized Gifts",
  "Keychains & Accessories",
  "Desk Accessories",
  "Phone Stands",
  "Corporate Gifts",
  "Custom Prints",
];

export function ProductManagementView() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formCategory, setFormCategory] = useState("Home Decor");
  const [formPrice, setFormPrice] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMainImage, setFormMainImage] = useState("");
  const [formGalleryImages, setFormGalleryImages] = useState<string[]>([]);
  const [formMaterial, setFormMaterial] = useState("Matte Ivory PLA+");
  const [formDimensions, setFormDimensions] = useState("18 x 14 x 23 cm");
  const [formFinish, setFormFinish] = useState("0.16mm Layer Height, Smooth Satin Finish");
  const [formColors, setFormColors] = useState("Warm Cream, Deep Navy, Vibrant Orange");
  const [formPersonalizable, setFormPersonalizable] = useState(false);
  const [formFeatured, setFormFeatured] = useState(false);
  const [formBestseller, setFormBestseller] = useState(false);
  const [formPublished, setFormPublished] = useState(false);
  const [newGalleryUrl, setNewGalleryUrl] = useState("");

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products");
      const data = await res.json();
      if (res.ok && data.products) {
        setProducts(data.products);
      }
    } catch {
      setErrorMessage("Failed to load products from server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  function openCreateModal() {
    setEditingProduct(null);
    setFormName("");
    setFormSku(`PRN-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormCategory("Home Decor");
    setFormPrice("49.00");
    setFormDescription("");
    setFormMainImage("");
    setFormGalleryImages([]);
    setFormMaterial("Matte Ivory PLA+");
    setFormDimensions("15 x 12 x 18 cm");
    setFormFinish("0.16mm Precision Satin");
    setFormColors("Warm Cream, Deep Navy");
    setFormPersonalizable(false);
    setFormFeatured(false);
    setFormBestseller(false);
    setFormPublished(false);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  }

  function openEditModal(prod: ProductItem) {
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormSku(prod.sku || "");
    setFormCategory(prod.category || "Home Decor");
    setFormPrice(String(prod.sellingPrice || 0));
    setFormDescription(prod.description || "");
    setFormMainImage(prod.imageUrl || "");
    setFormGalleryImages(prod.images || (prod.imageUrl ? [prod.imageUrl] : []));
    setFormMaterial(prod.material || "Matte Ivory PLA+");
    setFormDimensions(prod.dimensions || "15 x 12 x 18 cm");
    setFormFinish(prod.finish || "0.16mm Precision Satin");
    setFormColors(Array.isArray(prod.colors) ? prod.colors.join(", ") : "");
    setFormPersonalizable(Boolean(prod.supportsPersonalization));
    setFormFeatured(Boolean(prod.isFeatured));
    setFormBestseller(Boolean(prod.isBestSeller));
    setFormPublished(Boolean(prod.published));
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  }

  async function handleTogglePublish(prod: ProductItem) {
    const nextState = !prod.published;
    const confirmMsg = nextState
      ? `Publish "${prod.name}" to the live public storefront?`
      : `Unpublish "${prod.name}"? It will no longer be visible to website visitors.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/admin/products/${prod.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: nextState }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === prod.id ? { ...p, published: nextState } : p))
        );
      } else {
        alert("Failed to update product publish status.");
      }
    } catch {
      alert("Network error while updating publish status.");
    }
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);

    const priceNum = parseFloat(formPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setErrorMessage("Please enter a valid selling price in AED.");
      setSaving(false);
      return;
    }

    if (!formName.trim()) {
      setErrorMessage("Product name is required.");
      setSaving(false);
      return;
    }

    const colorsArray = formColors
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    const payload = {
      id: editingProduct?.id,
      name: formName.trim(),
      publicName: formName.trim(),
      sku: formSku.trim(),
      category: formCategory,
      sellingPrice: priceNum,
      publicDescription: formDescription.trim(),
      imageUrl: formMainImage.trim() || null,
      images: formGalleryImages,
      material: formMaterial.trim(),
      dimensions: formDimensions.trim(),
      finish: formFinish.trim(),
      colors: colorsArray,
      supportsPersonalization: formPersonalizable,
      isFeatured: formFeatured,
      isBestSeller: formBestseller,
      published: formPublished,
    };

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage("Product saved successfully!");
        setTimeout(() => {
          setIsModalOpen(false);
          fetchProducts();
        }, 600);
      } else {
        setErrorMessage(data.message || "Failed to save product.");
      }
    } catch {
      setErrorMessage("Network error while saving product.");
    } finally {
      setSaving(false);
    }
  }

  function addGalleryImage() {
    if (!newGalleryUrl.trim()) return;
    const url = newGalleryUrl.trim();
    if (!formGalleryImages.includes(url)) {
      setFormGalleryImages([...formGalleryImages, url]);
      if (!formMainImage) {
        setFormMainImage(url);
      }
    }
    setNewGalleryUrl("");
  }

  function removeGalleryImage(index: number) {
    const updated = formGalleryImages.filter((_, idx) => idx !== index);
    setFormGalleryImages(updated);
    if (formMainImage === formGalleryImages[index]) {
      setFormMainImage(updated[0] || "");
    }
  }

  function moveGalleryImage(index: number, direction: "up" | "down") {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= formGalleryImages.length) return;
    const next = [...formGalleryImages];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setFormGalleryImages(next);
  }

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      searchQuery === "" ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat =
      categoryFilter === "all" || p.category.toLowerCase() === categoryFilter.toLowerCase();
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "published" && p.published) ||
      (statusFilter === "draft" && !p.published);
    return matchesSearch && matchesCat && matchesStatus;
  });

  const publishedCount = products.filter((p) => p.published).length;
  const featuredCount = products.filter((p) => p.isFeatured).length;
  const bestSellerCount = products.filter((p) => p.isBestSeller).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <div className="bm-metric-card" style={{ background: "white", padding: "16px 20px", borderRadius: "16px", border: "1px solid var(--bm-border-subtle)" }}>
          <div style={{ fontSize: "12px", color: "var(--bm-text-muted)", fontWeight: 600 }}>Total Products</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--bm-text-primary)", marginTop: "4px" }}>{products.length}</div>
          <div style={{ fontSize: "11px", color: "var(--bm-text-secondary)", marginTop: "2px" }}>Manufacturing & Commercial</div>
        </div>

        <div className="bm-metric-card" style={{ background: "white", padding: "16px 20px", borderRadius: "16px", border: "1px solid var(--bm-border-subtle)" }}>
          <div style={{ fontSize: "12px", color: "#065F46", fontWeight: 600 }}>Published on Storefront</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#10B981", marginTop: "4px" }}>{publishedCount}</div>
          <div style={{ fontSize: "11px", color: "var(--bm-text-secondary)", marginTop: "2px" }}>Active on printstudio.ae</div>
        </div>

        <div className="bm-metric-card" style={{ background: "white", padding: "16px 20px", borderRadius: "16px", border: "1px solid var(--bm-border-subtle)" }}>
          <div style={{ fontSize: "12px", color: "#9A3412", fontWeight: 600 }}>Featured Products</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#F45A00", marginTop: "4px" }}>{featuredCount}</div>
          <div style={{ fontSize: "11px", color: "var(--bm-text-secondary)", marginTop: "2px" }}>Homepage Hero Section</div>
        </div>

        <div className="bm-metric-card" style={{ background: "white", padding: "16px 20px", borderRadius: "16px", border: "1px solid var(--bm-border-subtle)" }}>
          <div style={{ fontSize: "12px", color: "#1E40AF", fontWeight: 600 }}>Bestsellers</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#3B82F6", marginTop: "4px" }}>{bestSellerCount}</div>
          <div style={{ fontSize: "11px", color: "var(--bm-text-secondary)", marginTop: "2px" }}>Store Bestseller Grid</div>
        </div>
      </div>

      {/* Action Bar & Controls */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          background: "white",
          padding: "16px 20px",
          borderRadius: "16px",
          border: "1px solid var(--bm-border-subtle)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--bm-bg-subtle, #F8FAFC)",
              padding: "8px 14px",
              borderRadius: "10px",
              border: "1px solid var(--bm-border-subtle)",
              minWidth: "240px",
            }}
          >
            <HugeIcon icon={Search01Icon} size={15} color="var(--bm-text-muted)" />
            <input
              type="text"
              placeholder="Search product name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: "13px",
                width: "100%",
                color: "var(--bm-text-primary)",
              }}
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "10px",
              border: "1px solid var(--bm-border-subtle)",
              fontSize: "13px",
              background: "white",
              color: "var(--bm-text-primary)",
              cursor: "pointer",
            }}
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{
              padding: "8px 12px",
              borderRadius: "10px",
              border: "1px solid var(--bm-border-subtle)",
              fontSize: "13px",
              background: "white",
              color: "var(--bm-text-primary)",
              cursor: "pointer",
            }}
          >
            <option value="all">All Statuses</option>
            <option value="published">Published Only</option>
            <option value="draft">Drafts Only</option>
          </select>
        </div>

        <button
          onClick={openCreateModal}
          className="bm-btn-primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 18px",
            borderRadius: "12px",
            background: "var(--bm-accent)",
            color: "#FFFFFF",
            fontWeight: 600,
            fontSize: "13px",
            border: "none",
            cursor: "pointer",
          }}
        >
          <HugeIcon icon={PlusSignIcon} size={16} />
          <span>New Commercial Product</span>
        </button>
      </div>

      {/* Product List Table */}
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          border: "1px solid var(--bm-border-subtle)",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--bm-text-muted)" }}>
            Loading products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--bm-text-muted)" }}>
            <div style={{ marginBottom: "12px" }}>
              <HugeIcon icon={PackageIcon} size={32} color="var(--bm-text-muted)" />
            </div>
            <p style={{ fontWeight: 600, fontSize: "15px", color: "var(--bm-text-primary)" }}>
              No products found
            </p>
            <p style={{ fontSize: "13px", marginTop: "4px" }}>
              Try adjusting your search filters or create a new commercial product.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid var(--bm-border-subtle)" }}>
                  <th style={{ padding: "14px 18px", fontWeight: 600, color: "var(--bm-text-secondary)" }}>Product</th>
                  <th style={{ padding: "14px 18px", fontWeight: 600, color: "var(--bm-text-secondary)" }}>Category</th>
                  <th style={{ padding: "14px 18px", fontWeight: 600, color: "var(--bm-text-secondary)" }}>Price (AED)</th>
                  <th style={{ padding: "14px 18px", fontWeight: 600, color: "var(--bm-text-secondary)" }}>Storefront Status</th>
                  <th style={{ padding: "14px 18px", fontWeight: 600, color: "var(--bm-text-secondary)" }}>Badges</th>
                  <th style={{ padding: "14px 18px", fontWeight: 600, color: "var(--bm-text-secondary)", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: "1px solid var(--bm-border-subtle)",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "8px",
                            background: "#F1F5F9",
                            overflow: "hidden",
                            flexShrink: 0,
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <HugeIcon icon={PackageIcon} size={20} color="#94A3B8" />
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>{p.name}</div>
                          <div style={{ fontSize: "11px", color: "var(--bm-text-muted)", marginTop: "2px" }}>
                            SKU: {p.sku || "N/A"} {p.isBambuImport ? "· Bambu IoT" : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 18px", color: "var(--bm-text-secondary)" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          background: "#F1F5F9",
                          fontSize: "12px",
                          fontWeight: 500,
                        }}
                      >
                        {p.category}
                      </span>
                    </td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "var(--bm-text-primary)" }}>
                      AED {p.sellingPrice.toFixed(2)}
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      <button
                        onClick={() => handleTogglePublish(p)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "5px 10px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          border: p.published ? "1px solid #10B981" : "1px solid #94A3B8",
                          background: p.published ? "rgba(16, 185, 129, 0.1)" : "rgba(148, 163, 184, 0.1)",
                          color: p.published ? "#065F46" : "#475569",
                        }}
                      >
                        <HugeIcon icon={p.published ? ViewIcon : ViewOffIcon} size={13} />
                        <span>{p.published ? "Published" : "Draft (Unpublished)"}</span>
                      </button>
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {p.isFeatured && (
                          <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "#FEF3C7", color: "#92400E", fontWeight: 700 }}>
                            Featured
                          </span>
                        )}
                        {p.isBestSeller && (
                          <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "#DBEAFE", color: "#1E40AF", fontWeight: 700 }}>
                            Bestseller
                          </span>
                        )}
                        {p.supportsPersonalization && (
                          <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "#F3E8FF", color: "#6B21A8", fontWeight: 700 }}>
                            Personalizable
                          </span>
                        )}
                        {!p.isFeatured && !p.isBestSeller && !p.supportsPersonalization && (
                          <span style={{ fontSize: "11px", color: "var(--bm-text-muted)" }}>—</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "14px 18px", textAlign: "right" }}>
                      <button
                        onClick={() => openEditModal(p)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          borderRadius: "8px",
                          border: "1px solid var(--bm-border-subtle)",
                          background: "white",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "var(--bm-text-primary)",
                          cursor: "pointer",
                        }}
                      >
                        <HugeIcon icon={Edit01Icon} size={14} />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / Create Product Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "20px",
              maxWidth: "760px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
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
                position: "sticky",
                top: 0,
                background: "white",
                zIndex: 2,
              }}
            >
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--bm-text-primary)", margin: 0 }}>
                  {editingProduct ? `Edit Product: ${editingProduct.name}` : "Create Commercial Product"}
                </h3>
                <p style={{ fontSize: "12px", color: "var(--bm-text-secondary)", margin: "4px 0 0" }}>
                  Configure storefront pricing, marketing images, specifications, and website publication.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--bm-text-muted)" }}
              >
                <HugeIcon icon={CancelCircleIcon} size={22} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProduct} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              {errorMessage && (
                <div style={{ padding: "12px", borderRadius: "8px", background: "#FEE2E2", color: "#B91C1C", fontSize: "13px" }}>
                  {errorMessage}
                </div>
              )}
              {successMessage && (
                <div style={{ padding: "12px", borderRadius: "8px", background: "#D1FAE5", color: "#065F46", fontSize: "13px" }}>
                  {successMessage}
                </div>
              )}

              {/* Section 1: Product Identity & Commercial Pricing */}
              <div>
                <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--bm-text-primary)", marginBottom: "12px" }}>
                  1. Product Identity & Pricing
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "4px" }}>
                      Public Product Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Geometric Moon Lamp"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "4px" }}>
                      Selling Price (AED) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="e.g. 149.00"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "4px" }}>
                      Storefront Category
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px", background: "white" }}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "4px" }}>
                      SKU Code
                    </label>
                    <input
                      type="text"
                      value={formSku}
                      onChange={(e) => setFormSku(e.target.value)}
                      placeholder="e.g. LC-ML-101"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: "12px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "4px" }}>
                    Public Marketing Description
                  </label>
                  <textarea
                    rows={3}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Describe the craftsmanship, lighting effect, material texture, and Dubai studio story..."
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                  />
                </div>
              </div>

              {/* Section 2: Storefront Media Gallery */}
              <div style={{ borderTop: "1px solid var(--bm-border-subtle)", paddingTop: "16px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--bm-text-primary)", marginBottom: "4px" }}>
                  2. Product Photography & Gallery
                </h4>
                <p style={{ fontSize: "12px", color: "var(--bm-text-secondary)", marginBottom: "12px" }}>
                  Upload multiple angles. The first photo serves as the primary storefront card image.
                </p>

                {/* Gallery List */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
                  {formGalleryImages.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: "relative",
                        width: "110px",
                        height: "110px",
                        borderRadius: "10px",
                        border: idx === 0 ? "2px solid #F45A00" : "1px solid var(--bm-border-subtle)",
                        overflow: "hidden",
                        background: "#F8FAFC",
                      }}
                    >
                      <img src={imgUrl} alt={`Gallery angle ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      {idx === 0 && (
                        <span style={{ position: "absolute", bottom: 4, left: 4, background: "#F45A00", color: "white", fontSize: "9px", fontWeight: 700, padding: "2px 4px", borderRadius: "3px" }}>
                          MAIN
                        </span>
                      )}
                      <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: "2px" }}>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => moveGalleryImage(idx, "up")}
                            style={{ background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: "4px", padding: "2px", cursor: "pointer" }}
                            title="Move earlier"
                          >
                            <HugeIcon icon={ArrowUp01Icon} size={12} />
                          </button>
                        )}
                        {idx < formGalleryImages.length - 1 && (
                          <button
                            type="button"
                            onClick={() => moveGalleryImage(idx, "down")}
                            style={{ background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: "4px", padding: "2px", cursor: "pointer" }}
                            title="Move later"
                          >
                            <HugeIcon icon={ArrowDown01Icon} size={12} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeGalleryImage(idx)}
                          style={{ background: "rgba(220,38,38,0.8)", color: "white", border: "none", borderRadius: "4px", padding: "2px", cursor: "pointer" }}
                          title="Remove image"
                        >
                          <HugeIcon icon={Delete01Icon} size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Image by URL / Storage Reference */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    value={newGalleryUrl}
                    onChange={(e) => setNewGalleryUrl(e.target.value)}
                    placeholder="Enter image URL or asset path (e.g. https://... or /assets/images/...)"
                    style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                  />
                  <button
                    type="button"
                    onClick={addGalleryImage}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      background: "var(--bm-bg-subtle, #F1F5F9)",
                      border: "1px solid var(--bm-border-subtle)",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Add Image
                  </button>
                </div>
              </div>

              {/* Section 3: Physical & Technical Specifications */}
              <div style={{ borderTop: "1px solid var(--bm-border-subtle)", paddingTop: "16px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--bm-text-primary)", marginBottom: "12px" }}>
                  3. Materials & Technical Specifications
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "4px" }}>
                      Material Specification
                    </label>
                    <input
                      type="text"
                      value={formMaterial}
                      onChange={(e) => setFormMaterial(e.target.value)}
                      placeholder="e.g. Matte Ivory PLA+ / Impact PETG"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "4px" }}>
                      Dimensions
                    </label>
                    <input
                      type="text"
                      value={formDimensions}
                      onChange={(e) => setFormDimensions(e.target.value)}
                      placeholder="e.g. 18 x 14 x 23 cm"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "4px" }}>
                      Print Finish Spec
                    </label>
                    <input
                      type="text"
                      value={formFinish}
                      onChange={(e) => setFormFinish(e.target.value)}
                      placeholder="e.g. 0.16mm Layer Height, Smooth Satin"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "4px" }}>
                      Available Color Palette (comma separated)
                    </label>
                    <input
                      type="text"
                      value={formColors}
                      onChange={(e) => setFormColors(e.target.value)}
                      placeholder="e.g. Warm Cream, Deep Navy, Soft Amber"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Storefront Publication & Badges */}
              <div style={{ borderTop: "1px solid var(--bm-border-subtle)", paddingTop: "16px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--bm-text-primary)", marginBottom: "12px" }}>
                  4. Commercial Flags & Visibility
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={formPublished}
                      onChange={(e) => setFormPublished(e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "#10B981" }}
                    />
                    <div>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--bm-text-primary)" }}>
                        Publish to Public Website
                      </span>
                      <p style={{ fontSize: "11px", color: "var(--bm-text-secondary)", margin: "2px 0 0" }}>
                        Make this product publicly visible on the live catalogue at /shop.
                      </p>
                    </div>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={formPersonalizable}
                      onChange={(e) => setFormPersonalizable(e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "#F45A00" }}
                    />
                    <div>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--bm-text-primary)" }}>
                        Enable Personalisation
                      </span>
                      <p style={{ fontSize: "11px", color: "var(--bm-text-secondary)", margin: "2px 0 0" }}>
                        Displays a custom lettering / monogram input field on the website product page.
                      </p>
                    </div>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={formFeatured}
                      onChange={(e) => setFormFeatured(e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "#F45A00" }}
                    />
                    <div>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--bm-text-primary)" }}>
                        Mark as Featured Product
                      </span>
                      <p style={{ fontSize: "11px", color: "var(--bm-text-secondary)", margin: "2px 0 0" }}>
                        Showcases this creation prominently in curated sections.
                      </p>
                    </div>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={formBestseller}
                      onChange={(e) => setFormBestseller(e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "#3B82F6" }}
                    />
                    <div>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--bm-text-primary)" }}>
                        Mark as Bestseller
                      </span>
                      <p style={{ fontSize: "11px", color: "var(--bm-text-secondary)", margin: "2px 0 0" }}>
                        Displays the Bestseller badge and includes in high-demand carousels.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  borderTop: "1px solid var(--bm-border-subtle)",
                  paddingTop: "16px",
                  marginTop: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "10px",
                    border: "1px solid var(--bm-border-subtle)",
                    background: "white",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: "10px 22px",
                    borderRadius: "10px",
                    background: "var(--bm-accent)",
                    color: "white",
                    fontSize: "13px",
                    fontWeight: 600,
                    border: "none",
                    cursor: saving ? "not-allowed" : "pointer",
                  }}
                >
                  {saving ? "Saving..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
