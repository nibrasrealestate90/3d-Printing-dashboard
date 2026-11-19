"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { HugeIcon } from "@/components/hugeIcons";
import {
  UserMultiple02Icon,
  ShoppingBag01Icon,
  Search01Icon,
  Cancel01Icon,
  Mail01Icon,
  WhatsappIcon,
  EyeIcon,
  RefreshIcon,
  Invoice01Icon,
  Calendar01Icon,
  Building01Icon,
  Coins01Icon,
} from "@hugeicons/core-free-icons";

export interface CustomerOrderHistoryItem {
  id: string;
  orderNumber: string;
  date: string;
  total: number;
  paymentStatus: "PAID" | "PARTIAL" | "PENDING";
  fulfillmentStatus: "IN_PRODUCTION" | "READY" | "DELIVERED";
  itemsCount: number;
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  totalOrders: number;
  cumulativeSales: number;
  lastOrderDate: string;
  orders: CustomerOrderHistoryItem[];
}

export interface CustomerMetrics {
  totalCustomers: number;
  repeatCustomers: number;
}

/**
 * Robust UAE WhatsApp number normalization
 */
export function formatWhatsAppLink(phone: string | null | undefined): { display: string; cleanDigits: string; waLink: string } {
  const display = String(phone || "").trim();
  if (!display) return { display: "", cleanDigits: "", waLink: "" };

  let digits = display.replace(/\D/g, "");
  if (!digits) return { display, cleanDigits: "", waLink: "" };

  // Strip international exit prefix (00)
  if (digits.startsWith("00")) {
    digits = digits.replace(/^00+/, "");
  }

  let international = digits;
  if (digits.startsWith("97105") && digits.length === 13) {
    international = "971" + digits.slice(4);
  } else if (digits.startsWith("05") && digits.length === 10) {
    international = "971" + digits.slice(1);
  } else if (digits.startsWith("5") && digits.length === 9) {
    international = "971" + digits;
  } else if (digits.startsWith("971") && digits.length === 12) {
    international = digits;
  }

  const waLink = international.length >= 7 ? `https://wa.me/${international}` : "";
  return { display, cleanDigits: international, waLink };
}

/**
 * Localized date formatter
 */
export function formatCustomerDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr || "Recent";
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr || "Recent";
  }
}

export function CustomerManagementView() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [metrics, setMetrics] = useState<CustomerMetrics>({
    totalCustomers: 0,
    repeatCustomers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "NEW" | "REPEAT">("ALL");

  // Drawer State
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Fetch Customers from API
  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/customers");
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load customer directory.");
      }

      setCustomers(data.customers || []);
      if (data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (err: any) {
      console.error("Error fetching customers:", err);
      setError(err.message || "Could not retrieve customers. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Keyboard navigation: Escape key closes the detail drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen]);

  // Client-side filtering & search
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // 1. Filter by customer order category
      if (filterType === "NEW" && c.totalOrders !== 1) return false;
      if (filterType === "REPEAT" && c.totalOrders < 2) return false;

      // 2. Search query matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = c.name.toLowerCase().includes(q);
        const matchEmail = c.email.toLowerCase().includes(q);
        const matchPhone = c.phone ? c.phone.toLowerCase().includes(q) : false;
        const matchCompany = c.company ? c.company.toLowerCase().includes(q) : false;
        if (!matchName && !matchEmail && !matchPhone && !matchCompany) {
          return false;
        }
      }

      return true;
    });
  }, [customers, filterType, searchQuery]);

  const hasActiveFilters = searchQuery.trim() !== "" || filterType !== "ALL";

  const resetFilters = () => {
    setSearchQuery("");
    setFilterType("ALL");
  };

  const openDrawer = (customer: CustomerProfile) => {
    setSelectedCustomer(customer);
    setIsDrawerOpen(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* =========================================================================
          1. PAGE HEADER
          ========================================================================= */}
      <PageHeader
        title="Customers"
        description="Lightweight commercial customer directory automatically aggregated from verified sales orders."
        badge={{ text: "Client Directory", variant: "info" }}
        actions={
          <button
            onClick={fetchCustomers}
            disabled={loading}
            className="bm-btn bm-btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
            title="Refresh Customer Directory"
          >
            <HugeIcon icon={RefreshIcon} size={15} strokeWidth={2} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* =========================================================================
          2. SUMMARY CARDS (EXACTLY 2: TOTAL CUSTOMERS & REPEAT CUSTOMERS)
          ========================================================================= */}
      <div className="bm-metrics-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <MetricCard
          label="Total Customers"
          value={metrics.totalCustomers}
          subtext="Unique registered clients"
          icon={UserMultiple02Icon}
          variant="mint"
        />
        <MetricCard
          label="Repeat Customers"
          value={metrics.repeatCustomers}
          subtext="Clients with 2 or more orders"
          icon={ShoppingBag01Icon}
          variant="lavender"
        />
      </div>

      {/* =========================================================================
          3. MAIN DIRECTORY CARD (SEARCH, FILTER & TABLE)
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
                Customer Directory
              </h2>
              <p className="bm-card-subtitle" style={{ margin: "2px 0 0 0", fontSize: "13px" }}>
                Commercial client accounts derived from confirmed sales invoices
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="bm-badge bm-badge-neutral">
                <span className="bm-badge-dot" />
                {filteredCustomers.length} {filteredCustomers.length === 1 ? "Client" : "Clients"}
              </span>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            {/* Search Input */}
            <div style={{ position: "relative", flex: "1 1 280px" }}>
              <span
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--bm-text-muted)",
                  pointerEvents: "none",
                  display: "flex",
                }}
              >
                <HugeIcon icon={Search01Icon} size={16} strokeWidth={2} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by customer name, email, or phone..."
                className="bm-input"
                style={{
                  width: "100%",
                  paddingLeft: "36px",
                  paddingRight: searchQuery ? "32px" : "12px",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--bm-text-muted)",
                    padding: 0,
                    display: "flex",
                  }}
                  title="Clear search"
                >
                  <HugeIcon icon={Cancel01Icon} size={14} strokeWidth={2} />
                </button>
              )}
            </div>

            {/* Filter Dropdown */}
            <div style={{ minWidth: "180px" }}>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as "ALL" | "NEW" | "REPEAT")}
                className="bm-select"
                style={{ width: "100%" }}
              >
                <option value="ALL">All Customers</option>
                <option value="NEW">New Customers (1 order)</option>
                <option value="REPEAT">Repeat Customers (2+ orders)</option>
              </select>
            </div>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="bm-btn bm-btn-secondary"
                style={{ fontSize: "12px", padding: "8px 12px", whiteSpace: "nowrap" }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            style={{
              padding: "16px 24px",
              background: "var(--bm-danger-bg)",
              borderBottom: "1px solid var(--bm-danger-border)",
              color: "var(--bm-danger)",
              fontSize: "13px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{error}</span>
            <button onClick={fetchCustomers} className="bm-btn bm-btn-secondary" style={{ fontSize: "11px", padding: "4px 8px" }}>
              Retry
            </button>
          </div>
        )}

        {/* Table / Content */}
        {loading && customers.length === 0 ? (
          <div style={{ padding: "64px 24px", textAlign: "center", color: "var(--bm-text-muted)" }}>
            <div style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>
              <HugeIcon icon={RefreshIcon} size={24} strokeWidth={2} />
            </div>
            <p style={{ marginTop: "12px", fontSize: "14px" }}>Loading customer directory...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <EmptyState
            icon={UserMultiple02Icon}
            title={hasActiveFilters ? "No Customers Match Your Search" : "No Customers Found"}
            description={
              hasActiveFilters
                ? "Try adjusting your search query or switching your customer filter to 'All Customers'."
                : "When confirmed sales orders are created, customer profiles will automatically aggregate here."
            }
            badge={hasActiveFilters ? "NO MATCHES" : "DIRECTORY EMPTY"}
            actionText={hasActiveFilters ? "Reset Search & Filters" : undefined}
            onAction={hasActiveFilters ? resetFilters : undefined}
          />
        ) : (
          <div className="bm-table-container">
            <table className="bm-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Email & Phone</th>
                  <th>Total Orders</th>
                  <th>Cumulative Sales</th>
                  <th>Last Order Date</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => {
                  const wa = formatWhatsAppLink(c.phone);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => openDrawer(c)}
                      style={{ cursor: "pointer" }}
                      className="bm-table-row-hover"
                    >
                      {/* 1. Customer Name */}
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>{c.name}</div>
                        {c.company && (
                          <div style={{ fontSize: "11px", color: "var(--bm-text-muted)", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                            <HugeIcon icon={Building01Icon} size={12} strokeWidth={2} />
                            <span>{c.company}</span>
                          </div>
                        )}
                      </td>

                      {/* 2. Email & Phone */}
                      <td>
                        <div style={{ fontSize: "13px", color: "var(--bm-text-secondary)" }}>
                          {c.email || <span style={{ color: "var(--bm-text-muted)" }}>No email</span>}
                        </div>
                        {c.phone ? (
                          <div style={{ fontSize: "12px", color: "var(--bm-text-muted)", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                            <span>{c.phone}</span>
                            {wa.waLink && (
                              <span
                                style={{ color: "var(--bm-success)", display: "inline-flex" }}
                                title="WhatsApp contact available"
                              >
                                <HugeIcon icon={WhatsappIcon} size={12} strokeWidth={2} />
                              </span>
                            )}
                          </div>
                        ) : (
                          <div style={{ fontSize: "11px", color: "var(--bm-text-muted)", marginTop: "2px" }}>—</div>
                        )}
                      </td>

                      {/* 3. Total Orders */}
                      <td>
                        <span
                          className={`bm-badge ${c.totalOrders >= 2 ? "bm-badge-info" : "bm-badge-neutral"}`}
                          style={{ fontWeight: 600 }}
                        >
                          <span className="bm-badge-dot" />
                          {c.totalOrders} {c.totalOrders === 1 ? "order" : "orders"}
                        </span>
                      </td>

                      {/* 4. Cumulative Sales */}
                      <td>
                        <span style={{ fontWeight: 700, color: "var(--bm-text-primary)", fontFamily: "var(--bm-font-mono)", fontSize: "13px" }}>
                          AED {c.cumulativeSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* 5. Last Order Date */}
                      <td style={{ fontSize: "13px", color: "var(--bm-text-muted)", whiteSpace: "nowrap" }}>
                        {formatCustomerDate(c.lastOrderDate)}
                      </td>

                      {/* 6. Action */}
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDrawer(c);
                          }}
                          className="bm-btn bm-btn-secondary"
                          style={{ padding: "4px 10px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
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
          4. CUSTOMER DETAILS DRAWER
          ========================================================================= */}
      {isDrawerOpen && selectedCustomer && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.45)",
              backdropFilter: "blur(2px)",
              zIndex: 9998,
            }}
          />

          {/* Slide-out Drawer */}
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "100%",
              maxWidth: "520px",
              backgroundColor: "var(--bm-surface)",
              boxShadow: "-4px 0 24px rgba(0, 0, 0, 0.15)",
              zIndex: 9999,
              display: "flex",
              flexDirection: "column",
              animation: "slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Drawer Header */}
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
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "var(--bm-text-primary)" }}>
                  {selectedCustomer.name}
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--bm-text-muted)" }}>
                  {selectedCustomer.company ? `${selectedCustomer.company} • ` : ""}
                  Customer Profile
                </p>
              </div>

              <button
                onClick={() => setIsDrawerOpen(false)}
                className="bm-btn bm-btn-secondary"
                style={{ padding: "6px", display: "flex", borderRadius: "50%" }}
                title="Close Drawer (Esc)"
              >
                <HugeIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
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
                gap: "20px",
              }}
            >
              {/* Contact Information Card */}
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
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--bm-text-primary)" }}>
                  Contact Information
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--bm-text-muted)", textTransform: "uppercase" }}>Email</span>
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--bm-text-primary)", wordBreak: "break-all" }}>
                      {selectedCustomer.email || "—"}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: "11px", color: "var(--bm-text-muted)", textTransform: "uppercase" }}>Phone</span>
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--bm-text-primary)" }}>
                      {selectedCustomer.phone || "—"}
                    </div>
                  </div>

                  {selectedCustomer.company && (
                    <div style={{ gridColumn: "span 2" }}>
                      <span style={{ fontSize: "11px", color: "var(--bm-text-muted)", textTransform: "uppercase" }}>Company</span>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--bm-text-primary)" }}>
                        {selectedCustomer.company}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Performance Overview Badges */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div
                  style={{
                    padding: "14px 16px",
                    background: "var(--bm-surface-subtle)",
                    border: "1px solid var(--bm-border-subtle)",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--bm-text-muted)", fontSize: "12px" }}>
                    <HugeIcon icon={Invoice01Icon} size={14} strokeWidth={2} />
                    <span>Total Orders</span>
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--bm-text-primary)", marginTop: "4px" }}>
                    {selectedCustomer.totalOrders}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--bm-text-muted)", marginTop: "2px" }}>
                    {selectedCustomer.totalOrders >= 2 ? "Repeat Buyer" : "First-time Buyer"}
                  </div>
                </div>

                <div
                  style={{
                    padding: "14px 16px",
                    background: "var(--bm-surface-subtle)",
                    border: "1px solid var(--bm-border-subtle)",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--bm-text-muted)", fontSize: "12px" }}>
                    <HugeIcon icon={Coins01Icon} size={14} strokeWidth={2} />
                    <span>Cumulative Sales</span>
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--bm-text-primary)", fontFamily: "var(--bm-font-mono)", marginTop: "4px" }}>
                    AED {selectedCustomer.cumulativeSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--bm-text-muted)", marginTop: "2px" }}>
                    Lifetime Revenue
                  </div>
                </div>
              </div>

              {/* Order History Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--bm-text-primary)" }}>
                    Order History ({selectedCustomer.orders.length})
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--bm-text-muted)" }}>
                    Last Active: {formatCustomerDate(selectedCustomer.lastOrderDate)}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedCustomer.orders.map((ord) => (
                    <div
                      key={ord.id}
                      style={{
                        padding: "12px 14px",
                        background: "var(--bm-surface-subtle)",
                        border: "1px solid var(--bm-border-subtle)",
                        borderRadius: "6px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontFamily: "var(--bm-font-mono)", fontWeight: 700, fontSize: "12px", color: "var(--bm-accent)" }}>
                            {ord.orderNumber}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--bm-text-muted)" }}>
                            {formatCustomerDate(ord.date)}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--bm-text-muted)", marginTop: "2px" }}>
                          {ord.itemsCount} {ord.itemsCount === 1 ? "item" : "items"}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontFamily: "var(--bm-font-mono)", fontWeight: 700, fontSize: "12px", color: "var(--bm-text-primary)" }}>
                          AED {ord.total.toFixed(2)}
                        </span>
                        <StatusBadge status={ord.paymentStatus} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--bm-border-subtle)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                background: "var(--bm-surface)",
              }}
            >
              {/* WhatsApp Action */}
              {(() => {
                const wa = formatWhatsAppLink(selectedCustomer.phone);
                return wa.waLink ? (
                  <a
                    href={wa.waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bm-btn bm-btn-secondary"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      textDecoration: "none",
                    }}
                  >
                    <span style={{ color: "var(--bm-success)", display: "flex" }}>
                      <HugeIcon icon={WhatsappIcon} size={15} strokeWidth={2} />
                    </span>
                    <span>Chat on WhatsApp</span>
                  </a>
                ) : (
                  <button
                    disabled
                    className="bm-btn bm-btn-secondary"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      opacity: 0.5,
                      cursor: "not-allowed",
                    }}
                    title="No phone number registered"
                  >
                    <HugeIcon icon={WhatsappIcon} size={15} strokeWidth={2} />
                    <span>No WhatsApp</span>
                  </button>
                );
              })()}

              {/* Email Action */}
              {selectedCustomer.email ? (
                <a
                  href={`mailto:${selectedCustomer.email}?subject=Print%20Studio%20-%20Customer%20Service`}
                  className="bm-btn bm-btn-primary"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    textDecoration: "none",
                  }}
                >
                  <HugeIcon icon={Mail01Icon} size={15} strokeWidth={2} />
                  <span>Send Email</span>
                </a>
              ) : (
                <button
                  disabled
                  className="bm-btn bm-btn-primary"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    opacity: 0.5,
                    cursor: "not-allowed",
                  }}
                  title="No email address registered"
                >
                  <HugeIcon icon={Mail01Icon} size={15} strokeWidth={2} />
                  <span>No Email</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
