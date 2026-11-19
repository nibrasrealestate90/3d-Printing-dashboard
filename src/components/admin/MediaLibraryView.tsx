"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Image01Icon,
  Upload01Icon,
  Delete01Icon,
  Copy01Icon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  Search01Icon,
  CancelCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";

interface MediaAsset {
  id: string;
  storageKey: string;
  url: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  width?: number;
  height?: number;
  uploadedAt: string;
  uploadedBy?: string;
  referencedIn?: string[];
  isReferenced?: boolean;
}

export function MediaLibraryView({
  onSelectImage,
}: {
  onSelectImage?: (url: string) => void;
}) {
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchMedia() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/website/media");
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) {
        setItems(data.items);
      }
    } catch {
      setErrorMessage("Failed to load media library.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMedia();
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(10);

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const cadExts = [".step", ".stp", ".stl", ".3mf", ".obj"];
    if (cadExts.includes(ext)) {
      setUploadError(`CAD files (${ext}) are prohibited in the public media library. Please upload JPEG, PNG, or WebP images.`);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const allowed = [".jpg", ".jpeg", ".png", ".webp"];
    if (!allowed.includes(ext)) {
      setUploadError(`Unsupported file format. Please upload JPEG, PNG, or WebP.`);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Image file size exceeds the 10 MB maximum limit.");
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Read image dimensions in browser
    let dimensions: { width?: number; height?: number } = {};
    try {
      dimensions = await new Promise((resolve) => {
        const img = new window.Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({});
        img.src = URL.createObjectURL(file);
      });
    } catch {}

    setUploadProgress(30);

    try {
      // 1. Get Presigned Upload URL
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
        setUploadError(presignData.message || "Failed to authorize upload.");
        setIsUploading(false);
        return;
      }

      setUploadProgress(60);

      let finalPublicUrl = presignData.publicUrl;

      // 2. Upload via PUT if R2 uploadUrl is available
      if (presignData.storageConfigured && presignData.uploadUrl) {
        const uploadRes = await fetch(presignData.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": presignData.mimeType || file.type || "image/jpeg",
          },
          body: file,
        });

        if (!uploadRes.ok) {
          setUploadError(`Failed to upload to object storage (status ${uploadRes.status}).`);
          setIsUploading(false);
          return;
        }
      }

      setUploadProgress(85);

      // 3. Register with Media Library Catalog
      const regRes = await fetch("/api/admin/website/media/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSizeBytes: file.size,
          mimeType: file.type || "image/jpeg",
          storageKey: presignData.storageKey,
          url: finalPublicUrl,
          width: dimensions.width,
          height: dimensions.height,
        }),
      });

      if (regRes.ok) {
        setUploadProgress(100);
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          fetchMedia();
        }, 500);
      } else {
        const err = await regRes.json();
        setUploadError(err.message || "Failed to register media item.");
        setIsUploading(false);
      }
    } catch (err: any) {
      setUploadError(err.message || "Upload process failed.");
      setIsUploading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(item: MediaAsset) {
    if (item.isReferenced) {
      alert(
        `Cannot delete this image:\n\nIt is currently referenced by published content:\n${item.referencedIn?.join("\n")}\n\nPlease unpublish or change the photo in the referencing content before deleting.`
      );
      return;
    }

    if (!window.confirm(`Delete media asset "${item.fileName}" permanently?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/website/media/${item.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      } else {
        alert(data.message || "Failed to delete image.");
      }
    } catch {
      alert("Network error while deleting image.");
    }
  }

  function handleCopy(item: MediaAsset) {
    navigator.clipboard.writeText(item.url);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const filteredItems = items.filter((i) =>
    searchQuery === ""
      ? true
      : i.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalBytes = items.reduce((acc, i) => acc + (i.fileSizeBytes || 0), 0);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
  const inUseCount = items.filter((i) => i.isReferenced).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Banner & Upload Action */}
      <div
        style={{
          background: "white",
          padding: "20px 24px",
          borderRadius: "16px",
          border: "1px solid var(--bm-border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--bm-text-primary)", margin: 0 }}>
            Reusable Media Library
          </h2>
          <p style={{ fontSize: "13px", color: "var(--bm-text-secondary)", margin: "4px 0 0" }}>
            Central public repository for commercial product photography and Instagram showcase graphics.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "12px", color: "var(--bm-text-muted)" }}>Library Assets</span>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--bm-text-primary)" }}>
              {items.length} <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--bm-text-muted)" }}>({totalMb} MB)</span>
            </div>
          </div>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
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
                cursor: isUploading ? "not-allowed" : "pointer",
              }}
            >
              <HugeIcon icon={Upload01Icon} size={16} />
              <span>{isUploading ? `Uploading (${uploadProgress}%)...` : "Upload Image"}</span>
            </button>
          </div>
        </div>
      </div>

      {uploadError && (
        <div style={{ padding: "12px 16px", borderRadius: "12px", background: "#FEE2E2", color: "#B91C1C", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
          <HugeIcon icon={AlertCircleIcon} size={16} />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "white",
          padding: "12px 18px",
          borderRadius: "14px",
          border: "1px solid var(--bm-border-subtle)",
        }}
      >
        <HugeIcon icon={Search01Icon} size={16} color="var(--bm-text-muted)" />
        <input
          type="text"
          placeholder="Filter by image filename or storage path..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            border: "none",
            outline: "none",
            fontSize: "13px",
            width: "100%",
            color: "var(--bm-text-primary)",
          }}
        />
      </div>

      {/* Media Grid */}
      {loading ? (
        <div style={{ background: "white", padding: "48px", borderRadius: "16px", textAlign: "center", color: "var(--bm-text-muted)" }}>
          Loading media assets...
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{ background: "white", padding: "48px", borderRadius: "16px", textAlign: "center", border: "1px solid var(--bm-border-subtle)" }}>
          <HugeIcon icon={Image01Icon} size={36} color="var(--bm-text-muted)" />
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--bm-text-primary)", marginTop: "12px" }}>
            No Media Assets Found
          </h3>
          <p style={{ fontSize: "13px", color: "var(--bm-text-secondary)", marginTop: "4px" }}>
            Upload high-resolution photography (JPEG, PNG, WebP) up to 10 MB.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          {filteredItems.map((item) => (
            <div
              key={item.id}
              style={{
                background: "white",
                borderRadius: "14px",
                border: "1px solid var(--bm-border-subtle)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              {/* Thumbnail */}
              <div
                style={{
                  width: "100%",
                  aspectRatio: "4/3",
                  background: "#F1F5F9",
                  position: "relative",
                  overflow: "hidden",
                  cursor: onSelectImage ? "pointer" : "default",
                }}
                onClick={() => onSelectImage?.(item.url)}
              >
                <img
                  src={item.url}
                  alt={item.fileName}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />

                {/* Usage Badge */}
                <span
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: item.isReferenced ? "rgba(16, 185, 129, 0.9)" : "rgba(100, 116, 139, 0.8)",
                    color: "white",
                  }}
                  title={item.isReferenced ? `In use by: ${item.referencedIn?.join(", ")}` : "Unused asset"}
                >
                  {item.isReferenced ? "IN USE" : "UNUSED"}
                </span>
              </div>

              {/* Asset Info */}
              <div style={{ padding: "12px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--bm-text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={item.fileName}
                  >
                    {item.fileName}
                  </div>

                  <div style={{ fontSize: "11px", color: "var(--bm-text-muted)", marginTop: "4px" }}>
                    {item.width && item.height ? `${item.width} × ${item.height} · ` : ""}
                    {(item.fileSizeBytes / 1024).toFixed(0)} KB
                  </div>

                  {item.isReferenced && item.referencedIn && (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#065F46",
                        marginTop: "4px",
                        background: "#D1FAE5",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={item.referencedIn.join(", ")}
                    >
                      {item.referencedIn[0]}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderTop: "1px solid var(--bm-border-subtle)",
                    paddingTop: "10px",
                    marginTop: "10px",
                  }}
                >
                  <button
                    onClick={() => handleCopy(item)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid var(--bm-border-subtle)",
                      background: "white",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      color: copiedId === item.id ? "#10B981" : "var(--bm-text-primary)",
                    }}
                  >
                    <HugeIcon icon={copiedId === item.id ? CheckmarkCircle02Icon : Copy01Icon} size={12} />
                    <span>{copiedId === item.id ? "Copied" : "Copy URL"}</span>
                  </button>

                  <button
                    onClick={() => handleDelete(item)}
                    disabled={Boolean(item.isReferenced)}
                    style={{
                      padding: "4px 6px",
                      borderRadius: "6px",
                      border: "none",
                      background: item.isReferenced ? "transparent" : "#FEF2F2",
                      cursor: item.isReferenced ? "not-allowed" : "pointer",
                      color: item.isReferenced ? "#CBD5E1" : "#DC2626",
                    }}
                    title={item.isReferenced ? "Cannot delete: currently referenced by published content" : "Delete asset"}
                  >
                    <HugeIcon icon={Delete01Icon} size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
