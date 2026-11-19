"use client";

import React, { useState, useEffect } from "react";
import {
  InstagramIcon,
  PlusSignIcon,
  Edit01Icon,
  Delete01Icon,
  ViewIcon,
  ViewOffIcon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  CancelCircleIcon,
  LinkSquare02Icon,
  Image01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";

interface InstagramItem {
  id: string;
  imageUrl: string;
  caption: string;
  postUrl?: string;
  published: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export function InstagramGalleryView() {
  const [items, setItems] = useState<InstagramItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InstagramItem | null>(null);
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formCaption, setFormCaption] = useState("");
  const [formPostUrl, setFormPostUrl] = useState("");
  const [formPublished, setFormPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/website/instagram");
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) {
        setItems(data.items);
      }
    } catch {
      setErrorMessage("Failed to load Instagram gallery.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
  }, []);

  function openCreateModal() {
    setEditingItem(null);
    setFormImageUrl("");
    setFormCaption("");
    setFormPostUrl("");
    setFormPublished(true);
    setModalError(null);
    setIsModalOpen(true);
  }

  function openEditModal(item: InstagramItem) {
    setEditingItem(item);
    setFormImageUrl(item.imageUrl);
    setFormCaption(item.caption);
    setFormPostUrl(item.postUrl || "");
    setFormPublished(item.published);
    setModalError(null);
    setIsModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);

    if (!formImageUrl.trim()) {
      setModalError("Photograph URL is required.");
      setSaving(false);
      return;
    }
    if (!formCaption.trim()) {
      setModalError("Caption is required.");
      setSaving(false);
      return;
    }

    const payload = {
      action: editingItem ? "update" : "create",
      id: editingItem?.id,
      imageUrl: formImageUrl.trim(),
      caption: formCaption.trim(),
      postUrl: formPostUrl.trim() || undefined,
      published: formPublished,
    };

    try {
      const res = await fetch("/api/admin/website/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsModalOpen(false);
        fetchItems();
      } else {
        setModalError(data.message || "Failed to save gallery entry.");
      }
    } catch {
      setModalError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublish(item: InstagramItem) {
    try {
      const res = await fetch("/api/admin/website/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_publish",
          id: item.id,
          published: !item.published,
        }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, published: !i.published } : i))
        );
      }
    } catch {
      alert("Failed to update status.");
    }
  }

  async function handleDelete(item: InstagramItem) {
    if (!window.confirm(`Delete this Instagram post ("${item.caption.slice(0, 30)}...")?`)) {
      return;
    }

    try {
      const res = await fetch("/api/admin/website/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: item.id }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      } else {
        alert("Failed to delete entry.");
      }
    } catch {
      alert("Network error.");
    }
  }

  async function handleMove(index: number, direction: "up" | "down") {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;

    const next = [...items];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;

    const orderedIds = next.map((i) => i.id);
    setItems(next);

    try {
      await fetch("/api/admin/website/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", orderedIds }),
      });
    } catch {
      fetchItems();
    }
  }

  const publishedCount = items.filter((i) => i.published).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Banner & Stats */}
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
            Instagram Showcase Gallery
          </h2>
          <p style={{ fontSize: "13px", color: "var(--bm-text-secondary)", margin: "4px 0 0" }}>
            Curate photography displayed in the homepage &quot;Follow Our Creations&quot; showcase.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "12px", color: "var(--bm-text-muted)" }}>Published Posts</span>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#10B981" }}>
              {publishedCount} <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--bm-text-muted)" }}>/ {items.length}</span>
            </div>
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
            <span>Add Instagram Post</span>
          </button>
        </div>
      </div>

      {/* Gallery Cards Grid */}
      {loading ? (
        <div style={{ background: "white", padding: "48px", borderRadius: "16px", textAlign: "center", color: "var(--bm-text-muted)" }}>
          Loading Instagram gallery...
        </div>
      ) : items.length === 0 ? (
        <div style={{ background: "white", padding: "48px", borderRadius: "16px", textAlign: "center", border: "1px solid var(--bm-border-subtle)" }}>
          <HugeIcon icon={InstagramIcon} size={36} color="var(--bm-text-muted)" />
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--bm-text-primary)", marginTop: "12px" }}>
            No Instagram Posts Yet
          </h3>
          <p style={{ fontSize: "13px", color: "var(--bm-text-secondary)", marginTop: "4px" }}>
            Add your first studio photograph to curate the public homepage gallery.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {items.map((item, idx) => (
            <div
              key={item.id}
              style={{
                background: "white",
                borderRadius: "16px",
                border: "1px solid var(--bm-border-subtle)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              {/* Photo Area */}
              <div style={{ position: "relative", width: "100%", aspectRatio: "1/1", background: "#F1F5F9" }}>
                <img
                  src={item.imageUrl}
                  alt={item.caption}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                {/* Order Badge */}
                <span
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    background: "rgba(0,0,0,0.65)",
                    color: "white",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  #{idx + 1}
                </span>

                {/* Status Badge */}
                <span
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    background: item.published ? "#10B981" : "#64748B",
                    color: "white",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  {item.published ? "Published" : "Hidden"}
                </span>
              </div>

              {/* Caption & Metadata */}
              <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: "13px", color: "var(--bm-text-primary)", lineHeight: 1.4, margin: "0 0 10px", fontWeight: 500 }}>
                    {item.caption}
                  </p>
                  {item.postUrl && (
                    <a
                      href={item.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11px",
                        color: "#C13584",
                        textDecoration: "none",
                        fontWeight: 600,
                      }}
                    >
                      <HugeIcon icon={LinkSquare02Icon} size={12} />
                      <span>View Instagram Post</span>
                    </a>
                  )}
                </div>

                {/* Actions Bar */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderTop: "1px solid var(--bm-border-subtle)",
                    paddingTop: "12px",
                    marginTop: "12px",
                  }}
                >
                  {/* Reorder Buttons */}
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      onClick={() => handleMove(idx, "up")}
                      disabled={idx === 0}
                      style={{
                        padding: "5px 8px",
                        borderRadius: "6px",
                        border: "1px solid var(--bm-border-subtle)",
                        background: idx === 0 ? "#F8FAFC" : "white",
                        cursor: idx === 0 ? "not-allowed" : "pointer",
                        color: idx === 0 ? "#CBD5E1" : "var(--bm-text-primary)",
                      }}
                      title="Move Left"
                    >
                      <HugeIcon icon={ArrowUp01Icon} size={14} />
                    </button>
                    <button
                      onClick={() => handleMove(idx, "down")}
                      disabled={idx === items.length - 1}
                      style={{
                        padding: "5px 8px",
                        borderRadius: "6px",
                        border: "1px solid var(--bm-border-subtle)",
                        background: idx === items.length - 1 ? "#F8FAFC" : "white",
                        cursor: idx === items.length - 1 ? "not-allowed" : "pointer",
                        color: idx === items.length - 1 ? "#CBD5E1" : "var(--bm-text-primary)",
                      }}
                      title="Move Right"
                    >
                      <HugeIcon icon={ArrowDown01Icon} size={14} />
                    </button>
                  </div>

                  {/* Edit / Toggle / Delete */}
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => handleTogglePublish(item)}
                      style={{
                        padding: "5px 8px",
                        borderRadius: "6px",
                        border: "1px solid var(--bm-border-subtle)",
                        background: "white",
                        cursor: "pointer",
                        color: item.published ? "#10B981" : "#64748B",
                      }}
                      title={item.published ? "Hide from website" : "Publish to website"}
                    >
                      <HugeIcon icon={item.published ? ViewIcon : ViewOffIcon} size={14} />
                    </button>
                    <button
                      onClick={() => openEditModal(item)}
                      style={{
                        padding: "5px 8px",
                        borderRadius: "6px",
                        border: "1px solid var(--bm-border-subtle)",
                        background: "white",
                        cursor: "pointer",
                        color: "var(--bm-text-primary)",
                      }}
                      title="Edit Post"
                    >
                      <HugeIcon icon={Edit01Icon} size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      style={{
                        padding: "5px 8px",
                        borderRadius: "6px",
                        border: "1px solid #FCA5A5",
                        background: "#FEF2F2",
                        cursor: "pointer",
                        color: "#DC2626",
                      }}
                      title="Delete Post"
                    >
                      <HugeIcon icon={Delete01Icon} size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add / Edit Post */}
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
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--bm-border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--bm-text-primary)", margin: 0 }}>
                {editingItem ? "Edit Instagram Post" : "Add Instagram Post"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--bm-text-muted)" }}
              >
                <HugeIcon icon={CancelCircleIcon} size={22} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {modalError && (
                <div style={{ padding: "10px 14px", borderRadius: "8px", background: "#FEE2E2", color: "#B91C1C", fontSize: "13px" }}>
                  {modalError}
                </div>
              )}

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "4px" }}>
                  Photograph URL *
                </label>
                <input
                  type="text"
                  required
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://... or /assets/images/..."
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                />
              </div>

              {formImageUrl && (
                <div style={{ width: "120px", height: "120px", borderRadius: "10px", overflow: "hidden", border: "1px solid var(--bm-border-subtle)", background: "#F1F5F9" }}>
                  <img src={formImageUrl} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "4px" }}>
                  Caption *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formCaption}
                  onChange={(e) => setFormCaption(e.target.value)}
                  placeholder="e.g. Fresh off the build plate: Dual-silk copper articulated dragon."
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--bm-text-secondary)", display: "block", marginBottom: "4px" }}>
                  Instagram Post URL (optional)
                </label>
                <input
                  type="url"
                  value={formPostUrl}
                  onChange={(e) => setFormPostUrl(e.target.value)}
                  placeholder="https://www.instagram.com/p/..."
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", marginTop: "4px" }}>
                <input
                  type="checkbox"
                  checked={formPublished}
                  onChange={(e) => setFormPublished(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "#10B981" }}
                />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--bm-text-primary)" }}>
                  Publish immediately on website
                </span>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
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
                  {saving ? "Saving..." : "Save Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
