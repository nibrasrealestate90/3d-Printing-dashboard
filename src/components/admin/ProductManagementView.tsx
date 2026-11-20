"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  PackageIcon,
  Search01Icon,
  Edit01Icon,
  CancelCircleIcon,
  ViewIcon,
  ViewOffIcon,
  Delete01Icon,
  Image01Icon,
  Upload01Icon,
  PrinterIcon,
  CheckmarkCircle02Icon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
  StarIcon,
  ImageNotFound01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { MediaLibraryView } from "@/components/admin/MediaLibraryView";

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
  published: boolean;
  isCommercial: boolean;
  grams?: number;
  minutes?: number;
  unitCost?: number;
  directPrice?: number;
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

const MAX_PRODUCT_IMAGES = 6;

function ProductTableThumbnail({
  imageUrl,
  name,
  imagesCount,
}: {
  imageUrl: string | null;
  name: string;
  imagesCount?: number;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [imageUrl]);

  return (
    <div
      style={{
        position: "relative",
        width: "48px",
        height: "48px",
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
        <>
          <img
            src={imageUrl}
            alt={name}
            onError={() => setHasError(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {imagesCount && imagesCount > 1 ? (
            <span
              style={{
                position: "absolute",
                bottom: "2px",
                right: "2px",
                background: "rgba(15, 23, 42, 0.75)",
                color: "white",
                fontSize: "9px",
                fontWeight: 700,
                padding: "1px 4px",
                borderRadius: "3px",
                lineHeight: "1.1",
              }}
              title={`${imagesCount} gallery photos`}
            >
              {imagesCount}
            </span>
          ) : null}
        </>
      ) : (
        <HugeIcon icon={hasError ? ImageNotFound01Icon : PackageIcon} size={22} color="#94A3B8" />
      )}
    </div>
  );
}

function GalleryThumbnailCard({
  imgUrl,
  idx,
  isPrimary,
  isUploadingImage,
  onRemove,
  onMoveLeft,
  onMoveRight,
  onSetPrimary,
  canMoveRight,
}: {
  imgUrl: string;
  idx: number;
  isPrimary: boolean;
  isUploadingImage: boolean;
  onRemove: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onSetPrimary: () => void;
  canMoveRight: boolean;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [imgUrl]);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        borderRadius: "10px",
        border: isPrimary ? "2px solid #0284C7" : "1px solid var(--bm-border-subtle)",
        background: "white",
        overflow: "hidden",
        boxShadow: isPrimary ? "0 2px 8px rgba(2, 132, 199, 0.15)" : "0 1px 3px rgba(0,0,0,0.05)",
        transition: "all 0.15s ease",
      }}
    >
      {/* Image Thumbnail Container */}
      <div style={{ position: "relative", width: "100%", height: "100px", background: "#F1F5F9" }}>
        {!hasError ? (
          <img
            src={imgUrl}
            alt={`Product image ${idx + 1}`}
            onError={() => setHasError(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "#F8FAFC",
              border: "1px dashed #CBD5E1",
              padding: "26px 6px 6px 6px",
              boxSizing: "border-box",
              textAlign: "center",
              userSelect: "none",
            }}
            title={`Image failed to load:\n${imgUrl}\n\nOriginal URL is preserved in product gallery.`}
          >
            <HugeIcon icon={ImageNotFound01Icon} size={22} color="#94A3B8" />
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#475569",
                marginTop: "4px",
                lineHeight: 1.2,
              }}
            >
              Image Unreachable
            </span>
            <span
              style={{
                fontSize: "9px",
                color: "#94A3B8",
                marginTop: "2px",
                fontWeight: 500,
                letterSpacing: "0.2px",
              }}
            >
              URL Preserved
            </span>
          </div>
        )}

        {/* Position & Primary Badge */}
        <div
          style={{
            position: "absolute",
            top: "6px",
            left: "6px",
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            background: isPrimary ? "#0284C7" : "rgba(15, 23, 42, 0.75)",
            color: "white",
            fontSize: "10px",
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: "4px",
            backdropFilter: "blur(4px)",
            letterSpacing: "0.2px",
            zIndex: 2,
          }}
        >
          {isPrimary && <HugeIcon icon={StarIcon} size={10} />}
          <span>{isPrimary ? "#1 PRIMARY" : `#${idx + 1}`}</span>
        </div>

        {/* Delete Button */}
        <button
          type="button"
          onClick={onRemove}
          disabled={isUploadingImage}
          style={{
            position: "absolute",
            top: "6px",
            right: "6px",
            width: "22px",
            height: "22px",
            background: "rgba(220, 38, 38, 0.9)",
            color: "white",
            border: "none",
            borderRadius: "4px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: isUploadingImage ? "not-allowed" : "pointer",
            opacity: isUploadingImage ? 0.5 : 1,
            transition: "background 0.15s ease",
            zIndex: 2,
          }}
          title={isPrimary ? "Remove primary image (next image will become primary)" : "Remove secondary image"}
        >
          <HugeIcon icon={Delete01Icon} size={12} />
        </button>
      </div>

      {/* Action Controls Toolbar */}
      <div
        style={{
          padding: "6px 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "4px",
          background: isPrimary ? "#F0F9FF" : "white",
          borderTop: isPrimary ? "1px solid #BAE6FD" : "1px solid var(--bm-border-subtle)",
        }}
      >
        {/* Reorder: Move Left */}
        <button
          type="button"
          onClick={onMoveLeft}
          disabled={idx === 0 || isUploadingImage}
          style={{
            width: "24px",
            height: "24px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bm-bg-subtle, #F1F5F9)",
            border: "1px solid var(--bm-border-subtle, #E2E8F0)",
            borderRadius: "4px",
            cursor: idx === 0 || isUploadingImage ? "not-allowed" : "pointer",
            opacity: idx === 0 || isUploadingImage ? 0.35 : 1,
            color: "var(--bm-text-primary, #0F172A)",
          }}
          title={idx === 0 ? "First image cannot move left" : "Move left"}
        >
          <HugeIcon icon={ArrowLeft01Icon} size={12} />
        </button>

        {/* Center Action: Set as Primary (if secondary) or "Primary" label */}
        {!isPrimary ? (
          <button
            type="button"
            onClick={onSetPrimary}
            disabled={isUploadingImage}
            style={{
              flex: 1,
              height: "24px",
              padding: "0 4px",
              fontSize: "10px",
              fontWeight: 600,
              background: "transparent",
              border: "1px solid #0284C7",
              color: "#0284C7",
              borderRadius: "4px",
              cursor: isUploadingImage ? "not-allowed" : "pointer",
              opacity: isUploadingImage ? 0.5 : 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title="Promote to primary image"
          >
            Set Primary
          </button>
        ) : (
          <span
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: "10px",
              fontWeight: 700,
              color: "#0284C7",
            }}
          >
            Primary
          </span>
        )}

        {/* Reorder: Move Right */}
        <button
          type="button"
          onClick={onMoveRight}
          disabled={!canMoveRight || isUploadingImage}
          style={{
            width: "24px",
            height: "24px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bm-bg-subtle, #F1F5F9)",
            border: "1px solid var(--bm-border-subtle, #E2E8F0)",
            borderRadius: "4px",
            cursor: !canMoveRight || isUploadingImage ? "not-allowed" : "pointer",
            opacity: !canMoveRight || isUploadingImage ? 0.35 : 1,
            color: "var(--bm-text-primary, #0F172A)",
          }}
          title={!canMoveRight ? "Last image cannot move right" : "Move right"}
        >
          <HugeIcon icon={ArrowRight01Icon} size={12} />
        </button>
      </div>
    </div>
  );
}

export function ProductManagementView() {
  const [allProducts, setAllProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSearchQuery, setImportSearchQuery] = useState("");
  const [selectedForImport, setSelectedForImport] = useState<ProductItem | null>(null);

  // Commercial Details Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields (Strictly the 6 essential selling fields)
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("Home Decor");
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formPublished, setFormPublished] = useState(false);

  // Media Library Picker & Inline Upload State
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products");
      const data = await res.json();
      if (res.ok && Array.isArray(data.products)) {
        setAllProducts(data.products);
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

  // Commercial products are those configured for commercial sale
  const commercialProducts = allProducts.filter((p) => p.isCommercial);

  // Filtered commercial products for the main table
  const filteredProducts = commercialProducts.filter((p) => {
    const matchesSearch =
      searchQuery === "" ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "published" && p.published) ||
      (statusFilter === "draft" && !p.published);
    return matchesSearch && matchesStatus;
  });

  // Manufacturing products available for import
  const filteredManufacturingProducts = allProducts.filter((p) => {
    if (!importSearchQuery.trim()) return true;
    const q = importSearchQuery.toLowerCase();
    const name = (p.internalName || p.name).toLowerCase();
    const notes = (p.internalNotes || "").toLowerCase();
    return name.includes(q) || notes.includes(q);
  });

  // --- Handlers: Import from Production ---
  function openImportModal() {
    setSelectedForImport(null);
    setImportSearchQuery("");
    setIsImportModalOpen(true);
  }

  function handleContinueToSetup() {
    if (!selectedForImport) return;
    setIsImportModalOpen(false);

    // Open commercial setup pre-filled with the manufacturing product's data
    setEditingProduct(selectedForImport);
    setFormName(selectedForImport.name || selectedForImport.internalName || "");
    const initialPrice = selectedForImport.sellingPrice || selectedForImport.directPrice || 49.0;
    setFormPrice(String(initialPrice.toFixed(2)));
    setFormDescription(selectedForImport.description || "");
    setFormCategory(selectedForImport.category && CATEGORIES.includes(selectedForImport.category) ? selectedForImport.category : "Home Decor");
    
    // Clean initial images (exclude base64 strings if raw Bambu thumbnail)
    const initialImgs: string[] = [];
    if (selectedForImport.imageUrl && !selectedForImport.imageUrl.startsWith("data:")) {
      initialImgs.push(selectedForImport.imageUrl);
    }
    if (Array.isArray(selectedForImport.images)) {
      for (const img of selectedForImport.images) {
        if (img && !img.startsWith("data:") && !initialImgs.includes(img)) {
          initialImgs.push(img);
        }
      }
    }
    setFormImages(initialImgs.slice(0, MAX_PRODUCT_IMAGES));
    setFormPublished(Boolean(selectedForImport.published));
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsEditModalOpen(true);
  }

  // --- Handlers: Edit Commercial Product ---
  function openEditModal(prod: ProductItem) {
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormPrice(String(prod.sellingPrice || 0));
    setFormDescription(prod.description || "");
    setFormCategory(prod.category || "Home Decor");

    const initialImgs: string[] = [];
    if (Array.isArray(prod.images) && prod.images.length > 0) {
      for (const img of prod.images) {
        if (img && !initialImgs.includes(img)) {
          initialImgs.push(img);
        }
      }
    } else if (prod.imageUrl && !prod.imageUrl.startsWith("data:")) {
      initialImgs.push(prod.imageUrl);
    }
    setFormImages(initialImgs.slice(0, MAX_PRODUCT_IMAGES));

    setFormPublished(Boolean(prod.published));
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsEditModalOpen(true);
  }

  // --- Handlers: 1-Click Publish Toggle ---
  async function handleTogglePublish(prod: ProductItem) {
    const nextState = !prod.published;

    // Publication Validation check:
    if (nextState) {
      const hasName = Boolean(prod.name && prod.name.trim());
      const hasPrice = typeof prod.sellingPrice === "number" && prod.sellingPrice > 0;
      const hasCategory = Boolean(prod.category && prod.category.trim());
      const hasImage = Boolean(
        prod.imageUrl || (Array.isArray(prod.images) && prod.images.length > 0)
      );

      if (!hasName || !hasPrice || !hasCategory || !hasImage) {
        alert(
          "Cannot publish incomplete product.\n\nPlease click Edit to ensure the product has:\n• Display Name\n• Selling Price (> 0 AED)\n• Category\n• At least one product image"
        );
        return;
      }
    }

    try {
      const res = await fetch(`/api/admin/products/${prod.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: nextState }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setAllProducts((prev) =>
          prev.map((p) => (p.id === prod.id ? { ...p, published: nextState } : p))
        );
      } else {
        alert(data.message || "Failed to update product publication status.");
      }
    } catch {
      alert("Network error while updating publish status.");
    }
  }

  // --- Handlers: Save Commercial Details ---
  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProduct) return;

    setSaving(true);
    setErrorMessage(null);

    const priceNum = parseFloat(formPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setErrorMessage("Please enter a valid selling price in AED.");
      setSaving(false);
      return;
    }

    if (!formName.trim()) {
      setErrorMessage("Product display name is required.");
      setSaving(false);
      return;
    }

    const cleanImages = formImages.slice(0, MAX_PRODUCT_IMAGES);
    const payload = {
      id: editingProduct.id,
      name: formName.trim(),
      publicName: formName.trim(),
      sellingPrice: priceNum,
      publicDescription: formDescription.trim(),
      category: formCategory,
      publicCategory: formCategory,
      imageUrl: cleanImages[0] || null,
      images: cleanImages,
      published: formPublished,
      isCommercial: true,
    };

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage("Product details saved successfully!");
        setTimeout(() => {
          setIsEditModalOpen(false);
          fetchProducts();
        }, 500);
      } else {
        setErrorMessage(data.message || "Failed to save product.");
      }
    } catch {
      setErrorMessage("Network error while saving product.");
    } finally {
      setSaving(false);
    }
  }

  // --- Handlers: Media & Gallery Management ---
  function handleSelectFromMediaLibrary(url: string) {
    if (formImages.length >= MAX_PRODUCT_IMAGES) {
      setErrorMessage(`Maximum limit of ${MAX_PRODUCT_IMAGES} images already reached. Remove an image before adding a new one.`);
      return;
    }
    if (formImages.includes(url)) {
      setErrorMessage("This image is already in the product gallery.");
      return;
    }
    setFormImages((prev) => (prev.length < MAX_PRODUCT_IMAGES && !prev.includes(url) ? [...prev, url] : prev));
    setErrorMessage(null);
  }

  function handleRemoveImage(index: number) {
    setFormImages((prev) => prev.filter((_, idx) => idx !== index));
    setErrorMessage(null);
  }

  function handleSetPrimary(index: number) {
    if (index <= 0 || index >= formImages.length) return;
    setFormImages((prev) => {
      const selected = prev[index];
      const rest = prev.filter((_, idx) => idx !== index);
      return [selected, ...rest];
    });
    setErrorMessage(null);
  }

  function handleMoveImage(index: number, direction: "left" | "right") {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= formImages.length) return;
    setFormImages((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
    setErrorMessage(null);
  }

  async function handleDirectFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const availableSlots = MAX_PRODUCT_IMAGES - formImages.length;
    if (availableSlots <= 0) {
      setErrorMessage(`Maximum limit of ${MAX_PRODUCT_IMAGES} images already reached. Remove an image to upload a new one.`);
      return;
    }

    let filesToProcess = files;
    let slotWarning: string | null = null;
    if (files.length > availableSlots) {
      filesToProcess = files.slice(0, availableSlots);
      slotWarning = `Only ${availableSlots} more image slot${availableSlots > 1 ? "s" : ""} available. Accepted the first ${availableSlots} of ${files.length} selected files.`;
      setErrorMessage(slotWarning);
    } else {
      setErrorMessage(null);
    }

    setIsUploadingImage(true);
    const errors: string[] = [];

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      setUploadStatusText(`Uploading ${i + 1} of ${filesToProcess.length}: ${file.name}...`);

      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      const cadExts = [".step", ".stp", ".stl", ".3mf", ".obj"];
      if (cadExts.includes(ext)) {
        errors.push(`${file.name}: CAD files are prohibited in product gallery. Please upload JPEG, PNG, or WebP.`);
        continue;
      }
      const allowed = [".jpg", ".jpeg", ".png", ".webp"];
      if (!allowed.includes(ext)) {
        errors.push(`${file.name}: Unsupported file format. Please upload JPEG, PNG, or WebP.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        errors.push(`${file.name}: File size exceeds 10 MB limit.`);
        continue;
      }

      try {
        // 1. Request presigned upload URL
        const presignRes = await fetch("/api/admin/website/media/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileSizeBytes: file.size,
            mimeType: file.type || "image/jpeg",
            category: "products",
          }),
        });

        const presignData = await presignRes.json();
        if (!presignRes.ok || !presignData.success) {
          throw new Error(presignData.message || "Failed to authorize image upload.");
        }

        // 2. Upload file directly if R2 is configured
        if (presignData.storageConfigured && presignData.uploadUrl) {
          const uploadRes = await fetch(presignData.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": presignData.mimeType || file.type || "image/jpeg" },
            body: file,
          });
          if (!uploadRes.ok) {
            throw new Error(`Failed to upload to storage (HTTP ${uploadRes.status}).`);
          }
        }

        // 3. Register image in Media Library catalog
        const regRes = await fetch("/api/admin/website/media/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileSizeBytes: file.size,
            mimeType: file.type || "image/jpeg",
            storageKey: presignData.storageKey,
            publicUrl: presignData.publicUrl,
            url: presignData.publicUrl,
          }),
        });

        const regData = await regRes.json();
        if (regRes.ok && regData.success) {
          const newUrl = presignData.publicUrl;
          setFormImages((prev) => {
            if (prev.length < MAX_PRODUCT_IMAGES && !prev.includes(newUrl)) {
              return [...prev, newUrl];
            }
            return prev;
          });
        } else {
          throw new Error(regData.message || "Failed to register media asset.");
        }
      } catch (err: any) {
        errors.push(`${file.name}: ${err.message || "Upload failed."}`);
      }
    }

    setIsUploadingImage(false);
    setUploadStatusText("");

    if (errors.length > 0) {
      setErrorMessage(slotWarning ? `${slotWarning} | ${errors.join(" | ")}` : errors.join(" | "));
    } else if (slotWarning) {
      setErrorMessage(slotWarning);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Header with Title, Description, and Import Action */}
      <PageHeader
        title="Products"
        description="Manage products displayed in your online store."
        actions={
          <button
            onClick={openImportModal}
            className="bm-btn bm-btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <HugeIcon icon={PrinterIcon} size={16} strokeWidth={2} />
            <span>Import from Production</span>
          </button>
        }
      />

      {/* 2. Search & Filter Bar */}
      {commercialProducts.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            background: "white",
            padding: "14px 18px",
            borderRadius: "14px",
            border: "1px solid var(--bm-border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "260px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "var(--bm-bg-subtle, #F8FAFC)",
                padding: "8px 14px",
                borderRadius: "10px",
                border: "1px solid var(--bm-border-subtle)",
                width: "100%",
                maxWidth: "360px",
              }}
            >
              <HugeIcon icon={Search01Icon} size={15} color="var(--bm-text-muted)" />
              <input
                type="text"
                placeholder="Search products by name or category..."
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
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                padding: "8px 14px",
                borderRadius: "10px",
                border: "1px solid var(--bm-border-subtle)",
                fontSize: "13px",
                background: "white",
                color: "var(--bm-text-primary)",
                cursor: "pointer",
              }}
            >
              <option value="all">All Statuses ({commercialProducts.length})</option>
              <option value="published">
                Published ({commercialProducts.filter((p) => p.published).length})
              </option>
              <option value="draft">
                Drafts ({commercialProducts.filter((p) => !p.published).length})
              </option>
            </select>
          </div>
        </div>
      )}

      {/* 3. Product List Table or Empty State */}
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
        ) : commercialProducts.length === 0 ? (
          <EmptyState
            icon={PackageIcon}
            title="No Commercial Products Yet"
            description="Select manufactured products from your Bambu Production inventory to configure selling prices, descriptions, photography, and publish them to your online store."
            actionText="Import from Production"
            onAction={openImportModal}
            badge="STOREFRONT READY"
          />
        ) : filteredProducts.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--bm-text-muted)" }}>
            <p style={{ fontWeight: 600, fontSize: "15px", color: "var(--bm-text-primary)" }}>
              No matching products found
            </p>
            <p style={{ fontSize: "13px", marginTop: "4px" }}>
              Try adjusting your search query or status filter.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid var(--bm-border-subtle)" }}>
                  <th style={{ padding: "14px 18px", fontWeight: 600, color: "var(--bm-text-secondary)" }}>Product</th>
                  <th style={{ padding: "14px 18px", fontWeight: 600, color: "var(--bm-text-secondary)" }}>Category</th>
                  <th style={{ padding: "14px 18px", fontWeight: 600, color: "var(--bm-text-secondary)" }}>Selling Price</th>
                  <th style={{ padding: "14px 18px", fontWeight: 600, color: "var(--bm-text-secondary)" }}>Publication Status</th>
                  <th style={{ padding: "14px 18px", fontWeight: 600, color: "var(--bm-text-secondary)", textAlign: "right" }}>Action</th>
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
                    {/* Product Image & Name */}
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <ProductTableThumbnail
                          imageUrl={p.imageUrl}
                          name={p.name}
                          imagesCount={p.images?.length}
                        />
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--bm-text-primary)", fontSize: "14px" }}>
                            {p.name}
                          </div>
                          {p.internalName && p.internalName !== p.name && (
                            <div style={{ fontSize: "11px", color: "var(--bm-text-muted)", marginTop: "2px" }}>
                              Prod: {p.internalName}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td style={{ padding: "14px 18px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          background: "#F1F5F9",
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "var(--bm-text-secondary)",
                        }}
                      >
                        {p.category}
                      </span>
                    </td>

                    {/* Selling Price */}
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "var(--bm-text-primary)", fontSize: "14px" }}>
                      AED {p.sellingPrice.toFixed(2)}
                    </td>

                    {/* Publication Status (1-click toggle) */}
                    <td style={{ padding: "14px 18px" }}>
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(p)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "5px 12px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          border: p.published ? "1px solid #10B981" : "1px solid #94A3B8",
                          background: p.published ? "rgba(16, 185, 129, 0.1)" : "rgba(148, 163, 184, 0.1)",
                          color: p.published ? "#065F46" : "#475569",
                        }}
                        title={p.published ? "Click to unpublish from storefront" : "Click to publish to live storefront"}
                      >
                        <HugeIcon icon={p.published ? ViewIcon : ViewOffIcon} size={13} />
                        <span>{p.published ? "Published" : "Draft (Hidden)"}</span>
                      </button>
                    </td>

                    {/* Edit Action */}
                    <td style={{ padding: "14px 18px", textAlign: "right" }}>
                      <button
                        onClick={() => openEditModal(p)}
                        className="bm-btn bm-btn-secondary"
                        style={{
                          padding: "6px 14px",
                          fontSize: "12px",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
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

      {/* 4. Import from Production Modal */}
      {isImportModalOpen && (
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
              maxWidth: "720px",
              width: "100%",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
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
              }}
            >
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--bm-text-primary)", margin: 0 }}>
                  Import from Bambu Production
                </h3>
                <p style={{ fontSize: "12px", color: "var(--bm-text-secondary)", margin: "4px 0 0" }}>
                  Select a manufactured product from your Bambu Product Inventory to configure commercial selling details.
                </p>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--bm-text-muted)" }}
              >
                <HugeIcon icon={CancelCircleIcon} size={22} />
              </button>
            </div>

            {/* Modal Search */}
            <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--bm-border-subtle)", background: "#F8FAFC" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "white",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: "1px solid var(--bm-border-subtle)",
                }}
              >
                <HugeIcon icon={Search01Icon} size={15} color="var(--bm-text-muted)" />
                <input
                  type="text"
                  placeholder="Search manufacturing products by model name..."
                  value={importSearchQuery}
                  onChange={(e) => setImportSearchQuery(e.target.value)}
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
            </div>

            {/* Selectable Products List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {filteredManufacturingProducts.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--bm-text-muted)" }}>
                  No manufacturing products match your search.
                </div>
              ) : (
                filteredManufacturingProducts.map((prod) => {
                  const isSelected = selectedForImport?.id === prod.id;
                  const alreadyImported = prod.isCommercial;

                  return (
                    <div
                      key={prod.id}
                      onClick={() => setSelectedForImport(prod)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        borderRadius: "12px",
                        border: isSelected
                          ? "2px solid var(--bm-accent)"
                          : "1px solid var(--bm-border-subtle)",
                        background: isSelected ? "var(--bm-accent-soft, #FFF7ED)" : "white",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "8px",
                            background: "#F1F5F9",
                            overflow: "hidden",
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {prod.imageUrl && !prod.imageUrl.startsWith("data:") ? (
                            <img src={prod.imageUrl} alt={prod.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <HugeIcon icon={PrinterIcon} size={20} color="#94A3B8" />
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--bm-text-primary)", fontSize: "13px" }}>
                            {prod.internalName || prod.name}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--bm-text-muted)", marginTop: "2px" }}>
                            {prod.grams ? `${prod.grams}g` : ""} {prod.minutes ? `· ${prod.minutes} min print` : ""}{" "}
                            {prod.unitCost ? `· Unit Cost: AED ${prod.unitCost.toFixed(2)}` : ""}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {alreadyImported ? (
                          <span
                            style={{
                              fontSize: "11px",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              background: "#D1FAE5",
                              color: "#065F46",
                              fontWeight: 600,
                            }}
                          >
                            In Store
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: "11px",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              background: "#F1F5F9",
                              color: "var(--bm-text-secondary)",
                              fontWeight: 500,
                            }}
                          >
                            Available
                          </span>
                        )}

                        <div
                          style={{
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            border: isSelected ? "2px solid var(--bm-accent)" : "2px solid #CBD5E1",
                            background: isSelected ? "var(--bm-accent)" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {isSelected && <HugeIcon icon={CheckmarkCircle02Icon} size={14} color="white" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--bm-border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#F8FAFC",
              }}
            >
              <div style={{ fontSize: "12px", color: "var(--bm-text-secondary)" }}>
                {selectedForImport ? (
                  <span>
                    Selected: <strong>{selectedForImport.internalName || selectedForImport.name}</strong>
                  </span>
                ) : (
                  <span>Select a product above to continue.</span>
                )}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="bm-btn bm-btn-secondary"
                  style={{ padding: "8px 16px", fontSize: "13px" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleContinueToSetup}
                  disabled={!selectedForImport}
                  className="bm-btn bm-btn-primary"
                  style={{
                    padding: "8px 18px",
                    fontSize: "13px",
                    opacity: selectedForImport ? 1 : 0.5,
                    cursor: selectedForImport ? "pointer" : "not-allowed",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>Continue to Commercial Setup</span>
                  <HugeIcon icon={ArrowRight01Icon} size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Commercial Product Details Modal (Strictly 6 Fields) */}
      {isEditModalOpen && (
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
              maxWidth: "680px",
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
                  {editingProduct?.isCommercial ? "Edit Commercial Product" : "Commercial Product Setup"}
                </h3>
                <p style={{ fontSize: "12px", color: "var(--bm-text-secondary)", margin: "4px 0 0" }}>
                  Record ID: <code style={{ fontFamily: "monospace" }}>{editingProduct?.id}</code> · Manufacturing fields preserved.
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
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

              {/* 1. Product Display Name & 2. Selling Price */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "6px" }}>
                    Product Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Geometric Moon Lamp"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--bm-border-subtle)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "6px" }}>
                    Selling Price (AED) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="e.g. 149.00"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--bm-border-subtle)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* 3. Category */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "6px" }}>
                  Storefront Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--bm-border-subtle)",
                    fontSize: "13px",
                    background: "white",
                    boxSizing: "border-box",
                  }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Description */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "6px" }}>
                  Storefront Product Description
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe craftsmanship, finish details, and studio quality for website visitors..."
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--bm-border-subtle)",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* 5. Product Images (Gallery, Select from Media Library, Upload) */}
              <div style={{ borderTop: "1px solid var(--bm-border-subtle)", paddingTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--bm-text-primary)", display: "block" }}>
                        Product Images
                      </label>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          background: formImages.length >= MAX_PRODUCT_IMAGES ? "#FEE2E2" : "#F1F5F9",
                          color: formImages.length >= MAX_PRODUCT_IMAGES ? "#DC2626" : "var(--bm-text-secondary)",
                          border: formImages.length >= MAX_PRODUCT_IMAGES ? "1px solid #FECACA" : "1px solid var(--bm-border-subtle)",
                        }}
                      >
                        {formImages.length} / {MAX_PRODUCT_IMAGES} images
                      </span>
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--bm-text-secondary)", display: "block", marginTop: "2px" }}>
                      Image #1 is authoritative storefront primary photo. Drag or use arrows to reorder.
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleDirectFileUpload}
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      multiple
                      style={{ display: "none" }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage || formImages.length >= MAX_PRODUCT_IMAGES}
                      className="bm-btn bm-btn-secondary"
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        opacity: isUploadingImage || formImages.length >= MAX_PRODUCT_IMAGES ? 0.6 : 1,
                        cursor: isUploadingImage || formImages.length >= MAX_PRODUCT_IMAGES ? "not-allowed" : "pointer",
                      }}
                      title={formImages.length >= MAX_PRODUCT_IMAGES ? `Maximum ${MAX_PRODUCT_IMAGES} images reached` : "Upload image files"}
                    >
                      <HugeIcon icon={Upload01Icon} size={14} />
                      <span>{isUploadingImage ? "Uploading..." : "Upload Photos"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMediaPickerOpen(true)}
                      disabled={isUploadingImage || formImages.length >= MAX_PRODUCT_IMAGES}
                      className="bm-btn bm-btn-secondary"
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        opacity: isUploadingImage || formImages.length >= MAX_PRODUCT_IMAGES ? 0.6 : 1,
                        cursor: isUploadingImage || formImages.length >= MAX_PRODUCT_IMAGES ? "not-allowed" : "pointer",
                      }}
                      title={formImages.length >= MAX_PRODUCT_IMAGES ? `Maximum ${MAX_PRODUCT_IMAGES} images reached` : "Pick from media library"}
                    >
                      <HugeIcon icon={Image01Icon} size={14} />
                      <span>Media Library</span>
                    </button>
                  </div>
                </div>

                {/* Upload Status / Progress Indicator */}
                {isUploadingImage && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      marginBottom: "12px",
                      borderRadius: "8px",
                      background: "#EFF6FF",
                      border: "1px solid #BFDBFE",
                      fontSize: "12px",
                      color: "#1E40AF",
                      fontWeight: 500,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "12px",
                        height: "12px",
                        border: "2px solid #3B82F6",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    <span>{uploadStatusText || "Processing upload..."}</span>
                  </div>
                )}

                {/* Images Preview Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                    gap: "12px",
                    background: "#F8FAFC",
                    padding: "12px",
                    borderRadius: "12px",
                    border: "1px dashed var(--bm-border-subtle)",
                    minHeight: "130px",
                  }}
                >
                  {formImages.length === 0 ? (
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        textAlign: "center",
                        padding: "24px 0",
                        color: "var(--bm-text-muted)",
                        fontSize: "13px",
                      }}
                    >
                      No product images added yet. Click &ldquo;Upload Photos&rdquo; or &ldquo;Media Library&rdquo; to add up to {MAX_PRODUCT_IMAGES} images.
                    </div>
                  ) : (
                    formImages.map((imgUrl, idx) => {
                      const isPrimary = idx === 0;
                      return (
                        <GalleryThumbnailCard
                          key={`${imgUrl}-${idx}`}
                          imgUrl={imgUrl}
                          idx={idx}
                          isPrimary={isPrimary}
                          isUploadingImage={isUploadingImage}
                          onRemove={() => handleRemoveImage(idx)}
                          onMoveLeft={() => handleMoveImage(idx, "left")}
                          onMoveRight={() => handleMoveImage(idx, "right")}
                          onSetPrimary={() => handleSetPrimary(idx)}
                          canMoveRight={idx < formImages.length - 1}
                        />
                      );
                    })
                  )}

                  {/* Add Image Slot Placeholder (if under limit) */}
                  {formImages.length > 0 && formImages.length < MAX_PRODUCT_IMAGES && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        minHeight: "135px",
                        borderRadius: "10px",
                        border: "2px dashed var(--bm-border-subtle)",
                        background: "white",
                        cursor: isUploadingImage ? "not-allowed" : "pointer",
                        opacity: isUploadingImage ? 0.5 : 1,
                        color: "var(--bm-text-muted)",
                        padding: "12px",
                      }}
                      title="Upload an additional image"
                    >
                      <HugeIcon icon={Upload01Icon} size={20} />
                      <span style={{ fontSize: "11px", fontWeight: 600 }}>
                        + Add Image #{formImages.length + 1}
                      </span>
                      <span style={{ fontSize: "10px" }}>
                        ({MAX_PRODUCT_IMAGES - formImages.length} slots left)
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* 6. Published Toggle */}
              <div style={{ borderTop: "1px solid var(--bm-border-subtle)", paddingTop: "16px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={formPublished}
                    onChange={(e) => setFormPublished(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "#10B981" }}
                  />
                  <div>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--bm-text-primary)" }}>
                      Publish to Online Storefront
                    </span>
                    <p style={{ fontSize: "12px", color: "var(--bm-text-secondary)", margin: "2px 0 0" }}>
                      When enabled, this product is immediately visible on the public website at /shop.
                    </p>
                  </div>
                </label>
              </div>

              {/* Form Actions */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  borderTop: "1px solid var(--bm-border-subtle)",
                  paddingTop: "16px",
                  marginTop: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="bm-btn bm-btn-secondary"
                  style={{ padding: "10px 18px", fontSize: "13px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || isUploadingImage}
                  className="bm-btn bm-btn-primary"
                  style={{
                    padding: "10px 22px",
                    fontSize: "13px",
                    fontWeight: 600,
                    opacity: saving || isUploadingImage ? 0.6 : 1,
                    cursor: saving || isUploadingImage ? "not-allowed" : "pointer",
                  }}
                >
                  {saving ? "Saving..." : isUploadingImage ? "Uploading Photos..." : "Save Product Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Media Library Picker Modal (Reuses existing Media Library) */}
      {isMediaPickerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 110,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "20px",
              maxWidth: "880px",
              width: "100%",
              maxHeight: "88vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "16px 24px",
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
                <h3 style={{ fontSize: "17px", fontWeight: 700, color: "var(--bm-text-primary)", margin: 0 }}>
                  Select Image from Media Library
                </h3>
                <p style={{ fontSize: "12px", color: "var(--bm-text-secondary)", margin: "2px 0 0" }}>
                  Click an image to add it to your commercial product gallery.
                </p>
              </div>
              <button
                onClick={() => setIsMediaPickerOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--bm-text-muted)" }}
              >
                <HugeIcon icon={CancelCircleIcon} size={22} />
              </button>
            </div>

            <div style={{ padding: "20px" }}>
              <MediaLibraryView
                onSelectImage={(url) => {
                  handleSelectFromMediaLibrary(url);
                  setIsMediaPickerOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
