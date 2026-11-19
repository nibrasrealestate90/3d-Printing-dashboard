"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { HugeIcon } from "@/components/hugeIcons";
import {
  Mail01Icon,
  Clock01Icon,
  CheckmarkCircle02Icon,
  Notification01Icon,
  ArchiveIcon,
  Search01Icon,
  Cancel01Icon,
  WhatsappIcon,
  EyeIcon,
  RefreshIcon,
  ArrowRight01Icon,
  AlertCircleIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";

export interface EnquiryItem {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  subject: string;
  message: string;
  productId?: string | null;
  status: "NEW" | "IN_REVIEW" | "RESPONDED" | "ARCHIVED";
  ipAddress?: string | null;
  createdAt: string;
}

export interface EnquiryMetrics {
  total: number;
  newCount: number;
  inReviewCount: number;
  respondedCount: number;
  archivedCount: number;
  allCount: number;
}

/**
 * Format international UAE phone number into clean WhatsApp click-to-chat URL
 */
export function formatWhatsAppLink(phone: string | null | undefined): { display: string; waLink: string } {
  const display = String(phone || "").trim();
  if (!display) return { display: "", waLink: "" };
  
  let digits = display.replace(/\D/g, "");
  if (!digits) return { display, waLink: "" };

  // Strip international exit prefix (00)
  if (digits.startsWith("00")) {
    digits = digits.replace(/^00+/, "");
  }

  let international = digits;

  // Case 1: UAE number entered with country code + leading zero e.g. +971 050 123 4567 -> 9710501234567
  if (digits.startsWith("97105") && digits.length === 13) {
    international = "971" + digits.slice(4);
  }
  // Case 2: Standard local 10-digit format starting with 05 (e.g. 050, 052, 054, 055, 056, 058)
  else if (digits.startsWith("05") && digits.length === 10) {
    international = "971" + digits.slice(1);
  }
  // Case 3: 9-digit format starting with 5 (e.g. 50, 52, 54, 55, 56, 58)
  else if (digits.startsWith("5") && digits.length === 9) {
    international = "971" + digits;
  }
  // Case 4: Already international 971 format e.g. 971501234567 (12 digits)
  else if (digits.startsWith("971") && digits.length === 12) {
    international = digits;
  }

  const waLink = international.length >= 7 ? `https://wa.me/${international}` : "";
  return { display, waLink };
}

/**
 * Format ISO date into user-friendly localized format
 */
export function formatEnquiryDate(isoString: string): { compact: string; full: string } {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { compact: "Recent", full: "Recently received" };
    const compact = d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const full = d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return { compact, full };
  } catch {
    return { compact: "Recent", full: "Recently received" };
  }
}

export function EnquiryManagementView() {
  const [enquiries, setEnquiries] = useState<EnquiryItem[]>([]);
  const [metrics, setMetrics] = useState<EnquiryMetrics>({
    total: 0,
    newCount: 0,
    inReviewCount: 0,
    respondedCount: 0,
    archivedCount: 0,
    allCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("ALL");

  // Detail Drawer State
  const [selectedEnquiry, setSelectedEnquiry] = useState<EnquiryItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch enquiries from API
  const fetchEnquiries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/enquiries");
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load customer enquiries.");
      }

      setEnquiries(data.enquiries || []);
      if (data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (err: any) {
      console.error("Error fetching enquiries:", err);
      setError(err.message || "Could not retrieve enquiries. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  // Handle status update
  const handleUpdateStatus = async (enquiryId: string, newStatus: "NEW" | "IN_REVIEW" | "RESPONDED" | "ARCHIVED") => {
    if (updatingStatus) return;

    try {
      setUpdatingStatus(true);
      setStatusFeedback(null);

      const res = await fetch(`/api/admin/enquiries/${enquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update enquiry status.");
      }

      // Update local state immediately
      setEnquiries((prev) =>
        prev.map((e) => (e.id === enquiryId ? { ...e, status: newStatus } : e))
      );

      if (selectedEnquiry && selectedEnquiry.id === enquiryId) {
        setSelectedEnquiry((prev) => (prev ? { ...prev, status: newStatus } : null));
      }

      // Recompute metrics locally
      setMetrics((prev) => {
        const target = enquiries.find((e) => e.id === enquiryId);
        if (!target || target.status === newStatus) return prev;

        const next = { ...prev };
        // Decrement old
        if (target.status === "NEW") next.newCount = Math.max(0, next.newCount - 1);
        else if (target.status === "IN_REVIEW") next.inReviewCount = Math.max(0, next.inReviewCount - 1);
        else if (target.status === "RESPONDED") next.respondedCount = Math.max(0, next.respondedCount - 1);
        else if (target.status === "ARCHIVED") next.archivedCount = Math.max(0, next.archivedCount - 1);

        // Increment new
        if (newStatus === "NEW") next.newCount += 1;
        else if (newStatus === "IN_REVIEW") next.inReviewCount += 1;
        else if (newStatus === "RESPONDED") next.respondedCount += 1;
        else if (newStatus === "ARCHIVED") next.archivedCount += 1;

        // Recalculate total non-archived
        next.total = next.newCount + next.inReviewCount + next.respondedCount;

        return next;
      });

      setStatusFeedback({ type: "success", text: `Status updated to ${newStatus.replace("_", " ")}.` });
    } catch (err: any) {
      console.error("Error updating status:", err);
      setStatusFeedback({ type: "error", text: err.message || "Failed to update status." });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Keyboard navigation: Escape closes drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen]);

  // Filtered Enquiries
  const filteredEnquiries = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;
    const thirtyDaysMs = 30 * oneDayMs;

    return enquiries.filter((item) => {
      // 1. Status Filter
      if (statusFilter === "ACTIVE") {
        if (item.status === "ARCHIVED") return false;
      } else if (statusFilter !== "ALL" && item.status !== statusFilter) {
        return false;
      }

      // 2. Search Query (name, email, phone, subject, message)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.customerName.toLowerCase().includes(q);
        const matchEmail = item.customerEmail.toLowerCase().includes(q);
        const matchPhone = item.customerPhone ? item.customerPhone.toLowerCase().includes(q) : false;
        const matchSubject = item.subject.toLowerCase().includes(q);
        const matchMessage = item.message.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchSubject && !matchMessage) {
          return false;
        }
      }

      // 3. Date Range Filter
      if (dateRangeFilter !== "ALL") {
        const itemTime = new Date(item.createdAt).getTime();
        const diff = now - itemTime;
        if (dateRangeFilter === "TODAY" && diff > oneDayMs) return false;
        if (dateRangeFilter === "7D" && diff > sevenDaysMs) return false;
        if (dateRangeFilter === "30D" && diff > thirtyDaysMs) return false;
      }

      return true;
    });
  }, [enquiries, statusFilter, searchQuery, dateRangeFilter]);

  const hasActiveFilters = searchQuery.trim() !== "" || statusFilter !== "ALL" || dateRangeFilter !== "ALL";

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setDateRangeFilter("ALL");
  };

  const openDrawer = (enquiry: EnquiryItem) => {
    setSelectedEnquiry(enquiry);
    setStatusFeedback(null);
    setIsDrawerOpen(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* =========================================================================
          1. PAGE HEADER
          ========================================================================= */}
      <PageHeader
        title="Customer Enquiries"
        description="Review, triage, and reply to general customer questions and service requests submitted via your online store."
        badge={{ text: "Storefront Inbox", variant: "accent" }}
        actions={
          <button
            onClick={fetchEnquiries}
            disabled={loading}
            className="bm-btn bm-btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
            title="Refresh Inbound Messages"
          >
            <HugeIcon icon={RefreshIcon} size={15} strokeWidth={2} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* =========================================================================
          2. ACCURATE DATABASE-DERIVED METRICS (4 CARDS)
          ========================================================================= */}
      <div className="bm-metrics-grid">
        <MetricCard
          label="Total Enquiries"
          value={metrics.total}
          subtext="All customer enquiries"
          icon={Mail01Icon}
          variant="mint"
        />
        <MetricCard
          label="New Enquiries"
          value={metrics.newCount}
          subtext="Awaiting studio review"
          icon={Notification01Icon}
          variant="coral"
        />
        <MetricCard
          label="In Review"
          value={metrics.inReviewCount}
          subtext="Currently being investigated"
          icon={Clock01Icon}
          variant="lavender"
        />
        <MetricCard
          label="Responded"
          value={metrics.respondedCount}
          subtext="Customer contacted"
          icon={CheckmarkCircle02Icon}
          variant="accent"
        />
      </div>

      {/* =========================================================================
          3. MAIN INBOX CARD (SEARCH, FILTER & DATA TABLE)
          ========================================================================= */}
      <div className="bm-card">
        {/* Card Header & Controls */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--bm-border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <h2 className="bm-card-title" style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
                Inbound Message Queue
              </h2>
              <p className="bm-card-subtitle" style={{ margin: "2px 0 0 0", fontSize: "13px" }}>
                Direct inquiries submitted from website visitors and prospective clients
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="bm-badge bm-badge-neutral">
                <span className="bm-badge-dot" />
                {filteredEnquiries.length} {filteredEnquiries.length === 1 ? "Enquiry" : "Enquiries"}
              </span>
              {metrics.archivedCount > 0 && statusFilter !== "ARCHIVED" && (
                <button
                  onClick={() => setStatusFilter("ARCHIVED")}
                  className="bm-btn bm-btn-secondary"
                  style={{ fontSize: "11px", padding: "4px 10px" }}
                >
                  <HugeIcon icon={ArchiveIcon} size={13} strokeWidth={2} />
                  <span>Archived ({metrics.archivedCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* Search & Filters Row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "12px",
            }}
          >
            {/* Search Input */}
            <div style={{ position: "relative", flex: "1 1 280px" }}>
              <div
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--bm-text-muted)",
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <HugeIcon icon={Search01Icon} size={16} strokeWidth={2} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by customer, email, phone, or subject..."
                className="bm-input"
                style={{
                  paddingLeft: "36px",
                  paddingRight: searchQuery ? "32px" : "12px",
                  fontSize: "13px",
                  height: "38px",
                  width: "100%",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    color: "var(--bm-text-muted)",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="Clear search"
                >
                  <HugeIcon icon={Cancel01Icon} size={14} strokeWidth={2} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bm-select"
                style={{ height: "38px", fontSize: "13px", minWidth: "150px" }}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">All Active</option>
                <option value="NEW">New ({metrics.newCount})</option>
                <option value="IN_REVIEW">In Review ({metrics.inReviewCount})</option>
                <option value="RESPONDED">Responded ({metrics.respondedCount})</option>
                <option value="ARCHIVED">Archived ({metrics.archivedCount})</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value)}
                className="bm-select"
                style={{ height: "38px", fontSize: "13px", minWidth: "130px" }}
              >
                <option value="ALL">All Time</option>
                <option value="TODAY">Today (24h)</option>
                <option value="7D">Last 7 Days</option>
                <option value="30D">Last 30 Days</option>
              </select>
            </div>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="bm-btn bm-btn-secondary"
                style={{ height: "38px", fontSize: "12px", padding: "0 12px" }}
              >
                <HugeIcon icon={Cancel01Icon} size={14} strokeWidth={2} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div
            style={{
              padding: "24px",
              background: "var(--bm-error-bg, #FEF2F2)",
              borderBottom: "1px solid var(--bm-border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--bm-error, #DC2626)" }}>
              <HugeIcon icon={AlertCircleIcon} size={20} strokeWidth={2} />
              <span style={{ fontSize: "13px", fontWeight: 500 }}>{error}</span>
            </div>
            <button onClick={fetchEnquiries} className="bm-btn bm-btn-secondary" style={{ fontSize: "12px" }}>
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div style={{ padding: "48px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ height: "40px", background: "var(--bm-surface-muted)", borderRadius: "6px", animation: "pulse 1.5s infinite" }} />
            <div style={{ height: "40px", background: "var(--bm-surface-muted)", borderRadius: "6px", animation: "pulse 1.5s infinite" }} />
            <div style={{ height: "40px", background: "var(--bm-surface-muted)", borderRadius: "6px", animation: "pulse 1.5s infinite" }} />
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredEnquiries.length === 0 && (
          <div style={{ padding: "48px 24px" }}>
            <EmptyState
              icon={Mail01Icon}
              title={hasActiveFilters ? "No Enquiries Match Your Filter" : "No Customer Enquiries Yet"}
              description={
                hasActiveFilters
                  ? "Try resetting your search query or status filter to see all inquiries."
                  : "General customer questions and product inquiries submitted through your online storefront will appear here automatically."
              }
              badge={hasActiveFilters ? "FILTERED" : "INBOX READY"}
              actionText={hasActiveFilters ? "Clear Filters" : undefined}
              onAction={hasActiveFilters ? resetFilters : undefined}
            />
          </div>
        )}

        {/* Enquiries Data Table */}
        {!loading && filteredEnquiries.length > 0 && (
          <div className="bm-table-container">
            <table className="bm-table">
              <thead>
                <tr>
                  <th style={{ width: "220px" }}>Customer</th>
                  <th style={{ width: "170px" }}>Phone / WhatsApp</th>
                  <th style={{ width: "220px" }}>Subject</th>
                  <th>Message Preview</th>
                  <th style={{ width: "160px" }}>Received</th>
                  <th style={{ width: "120px" }}>Status</th>
                  <th style={{ width: "100px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEnquiries.map((enq) => {
                  const { display: phoneDisplay, waLink } = formatWhatsAppLink(enq.customerPhone);
                  const { compact: dateCompact } = formatEnquiryDate(enq.createdAt);

                  return (
                    <tr
                      key={enq.id}
                      onClick={() => openDrawer(enq)}
                      style={{ cursor: "pointer", transition: "background 0.15s ease" }}
                    >
                      {/* Customer Name & Email */}
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--bm-text-primary)", fontSize: "13px" }}>
                          {enq.customerName}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--bm-text-muted)" }}>
                          {enq.customerEmail}
                        </div>
                      </td>

                      {/* Phone / WhatsApp */}
                      <td onClick={(e) => e.stopPropagation()}>
                        {phoneDisplay ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {waLink ? (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  color: "var(--bm-text-primary)",
                                  textDecoration: "none",
                                  fontSize: "12px",
                                  fontWeight: 500,
                                }}
                                title="Open WhatsApp direct chat"
                              >
                                <span style={{ color: "#25D366", display: "flex" }}>
                                  <HugeIcon icon={WhatsappIcon} size={15} strokeWidth={2} />
                                </span>
                                <span>{phoneDisplay}</span>
                              </a>
                            ) : (
                              <span style={{ fontSize: "12px", color: "var(--bm-text-primary)" }}>{phoneDisplay}</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "var(--bm-text-muted)", fontSize: "12px" }}>—</span>
                        )}
                      </td>

                      {/* Subject */}
                      <td>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "var(--bm-text-primary)",
                            fontSize: "13px",
                            maxWidth: "220px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={enq.subject}
                        >
                          {enq.subject}
                        </div>
                      </td>

                      {/* Message Preview */}
                      <td>
                        <div
                          style={{
                            color: "var(--bm-text-secondary)",
                            fontSize: "12.5px",
                            maxWidth: "340px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={enq.message}
                        >
                          {enq.message}
                        </div>
                      </td>

                      {/* Received Date & Time */}
                      <td style={{ fontSize: "12px", color: "var(--bm-text-muted)", whiteSpace: "nowrap" }}>
                        {dateCompact}
                      </td>

                      {/* Status Badge */}
                      <td onClick={(e) => e.stopPropagation()}>
                        <StatusBadge status={enq.status} />
                      </td>

                      {/* Action */}
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openDrawer(enq)}
                          className="bm-btn bm-btn-secondary"
                          style={{
                            padding: "4px 10px",
                            fontSize: "11px",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <HugeIcon icon={EyeIcon} size={13} strokeWidth={2} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          4. ENQUIRY DETAILS DRAWER (SLIDE-OUT INSPECTION & STATUS MANAGEMENT)
          ========================================================================= */}
      {isDrawerOpen && selectedEnquiry && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            justifyContent: "flex-end",
            zIndex: 100,
          }}
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            style={{
              background: "white",
              width: "100%",
              maxWidth: "560px",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              boxShadow: "-10px 0 30px rgba(0,0,0,0.15)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--bm-border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                background: "var(--bm-surface)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <StatusBadge status={selectedEnquiry.status} />
                  <span style={{ fontSize: "11px", color: "var(--bm-text-muted)" }}>
                    ID: {selectedEnquiry.id.slice(0, 8)}...
                  </span>
                </div>
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "var(--bm-text-primary)",
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {selectedEnquiry.subject}
                </h3>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--bm-text-muted)",
                  padding: "4px",
                  display: "flex",
                  borderRadius: "4px",
                }}
                title="Close Drawer (Esc)"
              >
                <HugeIcon icon={Cancel01Icon} size={20} strokeWidth={2} />
              </button>
            </div>

            {/* Drawer Body */}
            <div
              style={{
                padding: "24px",
                overflowY: "auto",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "24px",
              }}
            >
              {/* Feedback Alert */}
              {statusFeedback && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "6px",
                    fontSize: "12.5px",
                    fontWeight: 500,
                    background:
                      statusFeedback.type === "success"
                        ? "var(--bm-success-bg, #ECFDF5)"
                        : "var(--bm-error-bg, #FEF2F2)",
                    color:
                      statusFeedback.type === "success"
                        ? "var(--bm-success, #059669)"
                        : "var(--bm-error, #DC2626)",
                    border: `1px solid ${
                      statusFeedback.type === "success" ? "#A7F3D0" : "#FECACA"
                    }`,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <HugeIcon
                    icon={statusFeedback.type === "success" ? CheckmarkCircle02Icon : AlertCircleIcon}
                    size={16}
                    strokeWidth={2}
                  />
                  <span>{statusFeedback.text}</span>
                </div>
              )}

              {/* Customer Contact Box */}
              <div
                style={{
                  background: "var(--bm-surface-subtle)",
                  borderRadius: "8px",
                  padding: "16px",
                  border: "1px solid var(--bm-border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "var(--bm-accent-subtle, #EEF2FF)",
                        color: "var(--bm-accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "13px",
                      }}
                    >
                      {selectedEnquiry.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--bm-text-primary)", fontSize: "14px" }}>
                        {selectedEnquiry.customerName}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--bm-text-muted)" }}>
                        {formatEnquiryDate(selectedEnquiry.createdAt).full}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                    paddingTop: "8px",
                    borderTop: "1px solid var(--bm-border-subtle)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "11px", color: "var(--bm-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                      Email Address
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--bm-text-primary)", fontWeight: 500, wordBreak: "break-all" }}>
                      {selectedEnquiry.customerEmail}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "var(--bm-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                      Phone / WhatsApp
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--bm-text-primary)", fontWeight: 500 }}>
                      {selectedEnquiry.customerPhone || "Not provided"}
                    </div>
                  </div>
                </div>

                {/* Direct Communication Buttons */}
                <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                  {/* Email Mailto Action */}
                  <a
                    href={`mailto:${selectedEnquiry.customerEmail}?subject=${encodeURIComponent(
                      `Re: ${selectedEnquiry.subject}`
                    )}`}
                    className="bm-btn bm-btn-secondary"
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      fontSize: "12px",
                      textDecoration: "none",
                      height: "36px",
                    }}
                  >
                    <HugeIcon icon={Mail01Icon} size={15} strokeWidth={2} />
                    <span>Reply via Email</span>
                  </a>

                  {/* WhatsApp Action */}
                  {(() => {
                    const { waLink } = formatWhatsAppLink(selectedEnquiry.customerPhone);
                    if (waLink) {
                      return (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bm-btn"
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            fontSize: "12px",
                            textDecoration: "none",
                            background: "#25D366",
                            color: "white",
                            border: "none",
                            height: "36px",
                            fontWeight: 600,
                          }}
                        >
                          <HugeIcon icon={WhatsappIcon} size={15} strokeWidth={2} />
                          <span>WhatsApp Chat</span>
                        </a>
                      );
                    }
                    return (
                      <button
                        disabled
                        className="bm-btn bm-btn-secondary"
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          fontSize: "12px",
                          opacity: 0.5,
                          cursor: "not-allowed",
                          height: "36px",
                        }}
                        title="Customer did not provide a phone number"
                      >
                        <HugeIcon icon={WhatsappIcon} size={15} strokeWidth={2} />
                        <span>No WhatsApp Phone</span>
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* Message Body Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "var(--bm-text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Customer Message
                </div>
                <div
                  style={{
                    background: "var(--bm-surface)",
                    border: "1px solid var(--bm-border-subtle)",
                    borderRadius: "8px",
                    padding: "16px 20px",
                    fontSize: "13.5px",
                    lineHeight: 1.6,
                    color: "var(--bm-text-primary)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    minHeight: "120px",
                  }}
                >
                  {selectedEnquiry.message}
                </div>
              </div>

              {/* Status Management Section */}
              <div
                style={{
                  background: "var(--bm-surface-subtle)",
                  border: "1px solid var(--bm-border-subtle)",
                  borderRadius: "8px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--bm-text-primary)" }}>
                    Triage & Status Management
                  </div>
                  {updatingStatus && (
                    <span style={{ fontSize: "11px", color: "var(--bm-text-muted)" }}>
                      Saving changes...
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "12px", color: "var(--bm-text-muted)", lineHeight: 1.4 }}>
                  Track customer inquiry progression. Mark as <strong>Responded</strong> once the customer has been contacted (enquiry does not need to be fully resolved).
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    onClick={() => handleUpdateStatus(selectedEnquiry.id, "NEW")}
                    disabled={updatingStatus || selectedEnquiry.status === "NEW"}
                    className={`bm-btn ${selectedEnquiry.status === "NEW" ? "bm-btn-primary" : "bm-btn-secondary"}`}
                    style={{
                      fontSize: "12px",
                      padding: "8px 12px",
                      fontWeight: selectedEnquiry.status === "NEW" ? 700 : 500,
                      opacity: selectedEnquiry.status === "NEW" ? 1 : 0.85,
                    }}
                  >
                    Mark as New
                  </button>

                  <button
                    onClick={() => handleUpdateStatus(selectedEnquiry.id, "IN_REVIEW")}
                    disabled={updatingStatus || selectedEnquiry.status === "IN_REVIEW"}
                    className={`bm-btn ${selectedEnquiry.status === "IN_REVIEW" ? "bm-btn-primary" : "bm-btn-secondary"}`}
                    style={{
                      fontSize: "12px",
                      padding: "8px 12px",
                      fontWeight: selectedEnquiry.status === "IN_REVIEW" ? 700 : 500,
                      opacity: selectedEnquiry.status === "IN_REVIEW" ? 1 : 0.85,
                    }}
                  >
                    Mark as In Review
                  </button>

                  <button
                    onClick={() => handleUpdateStatus(selectedEnquiry.id, "RESPONDED")}
                    disabled={updatingStatus || selectedEnquiry.status === "RESPONDED"}
                    className={`bm-btn ${selectedEnquiry.status === "RESPONDED" ? "bm-btn-primary" : "bm-btn-secondary"}`}
                    style={{
                      fontSize: "12px",
                      padding: "8px 12px",
                      fontWeight: selectedEnquiry.status === "RESPONDED" ? 700 : 500,
                      opacity: selectedEnquiry.status === "RESPONDED" ? 1 : 0.85,
                    }}
                  >
                    Mark as Responded
                  </button>

                  <button
                    onClick={() => handleUpdateStatus(selectedEnquiry.id, "ARCHIVED")}
                    disabled={updatingStatus || selectedEnquiry.status === "ARCHIVED"}
                    className={`bm-btn ${selectedEnquiry.status === "ARCHIVED" ? "bm-btn-primary" : "bm-btn-secondary"}`}
                    style={{
                      fontSize: "12px",
                      padding: "8px 12px",
                      fontWeight: selectedEnquiry.status === "ARCHIVED" ? 700 : 500,
                      opacity: selectedEnquiry.status === "ARCHIVED" ? 1 : 0.85,
                    }}
                  >
                    Archive Enquiry
                  </button>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--bm-border-subtle)",
                display: "flex",
                justifyContent: "flex-end",
                background: "var(--bm-surface)",
              }}
            >
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="bm-btn bm-btn-secondary"
                style={{ fontSize: "13px", padding: "8px 20px" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
