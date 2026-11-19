"use client";

import React, { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { HugeIcon } from "@/components/hugeIcons";
import {
  Invoice01Icon,
  Clock01Icon,
  CheckmarkCircle02Icon,
  PlusSignIcon,
  Search01Icon,
  CancelCircleIcon,
  Delete02Icon,
  PackageIcon,
  CreditCardIcon,
  Message01Icon,
  Edit01Icon,
} from "@hugeicons/core-free-icons";

export interface OrderItemLine {
  productId?: string;
  name: string;
  qty: number;
  price: number;
  total: number;
  imageUrl?: string;
}

export interface OrderData {
  id: string;
  invoiceNumber: string;
  no: string;
  date: string;
  customerName: string;
  clientName: string;
  customerPhone: string;
  phone: string;
  customerEmail?: string;
  email?: string;
  lines: OrderItemLine[];
  subtotal: number;
  discount: number;
  vatPct: number;
  vat: number;
  total: number;
  paid: number;
  balance: number;
  status?: string;
  paymentStatus: "PAID" | "PARTIAL" | "PENDING";
  fulfillmentStatus: "IN_PRODUCTION" | "READY" | "DELIVERED";
  paymentMethod: string;
  notes?: string;
  updatedAt: string;
}

export interface CatalogueProduct {
  id: string;
  name: string;
  publicName?: string;
  sellingPrice: number;
  category?: string;
  imageUrl?: string;
}

/**
 * Format phone number and construct WhatsApp direct chat URL
 */
export function getWhatsAppInfo(phone: string): { display: string; waLink: string } {
  const display = String(phone || "").trim();
  const digits = display.replace(/\D/g, "");
  let international = digits;
  if (digits.startsWith("05") && digits.length === 10) {
    // UAE mobile e.g. 050 123 4567 -> 971 50 123 4567
    international = "971" + digits.slice(1);
  } else if (digits.startsWith("5") && digits.length === 9) {
    international = "971" + digits;
  }
  const waLink = international ? `https://wa.me/${international}` : "";
  return { display, waLink };
}

export function OrderManagementView() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [metrics, setMetrics] = useState({
    totalOrders: 0,
    pendingPayments: 0,
    deliveredOrders: 0,
  });
  const [loading, setLoading] = useState(true);
  const [catalogueProducts, setCatalogueProducts] = useState<CatalogueProduct[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | "PAID" | "PARTIAL" | "PENDING">("ALL");
  const [fulfillmentFilter, setFulfillmentFilter] = useState<"ALL" | "IN_PRODUCTION" | "READY" | "DELIVERED">("ALL");

  // Create Order Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formCustomerName, setFormCustomerName] = useState("");
  const [formWhatsApp, setFormWhatsApp] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formLines, setFormLines] = useState<OrderItemLine[]>([]);
  const [formDiscount, setFormDiscount] = useState("0");
  const [formPaidAmount, setFormPaidAmount] = useState("0");
  const [formPaymentMethod, setFormPaymentMethod] = useState("Cash");
  const [formFulfillmentStatus, setFormFulfillmentStatus] = useState<"IN_PRODUCTION" | "READY" | "DELIVERED">("IN_PRODUCTION");
  const [formNotes, setFormNotes] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [configuredVatPct, setConfiguredVatPct] = useState(5);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Order Details Drawer State
  const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [drawerFulfillment, setDrawerFulfillment] = useState<"IN_PRODUCTION" | "READY" | "DELIVERED">("IN_PRODUCTION");
  const [drawerPaidAmount, setDrawerPaidAmount] = useState("");
  const [drawerPaymentMethod, setDrawerPaymentMethod] = useState("Cash");
  const [drawerNotes, setDrawerNotes] = useState("");
  const [drawerUpdating, setDrawerUpdating] = useState(false);
  const [drawerMessage, setDrawerMessage] = useState<string | null>(null);

  // Fetch orders and summary metrics
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/orders");
      const data = await res.json();
      if (res.ok && data.success) {
        setOrders(data.orders || []);
        if (data.metrics) {
          setMetrics(data.metrics);
        }
        if (data.configuredVatPct !== undefined && !isNaN(Number(data.configuredVatPct))) {
          setConfiguredVatPct(Number(data.configuredVatPct));
        }
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch commercial catalogue products for product picker
  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/admin/products");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.products)) {
        setCatalogueProducts(
          data.products.map((p: any) => ({
            id: p.id,
            name: p.publicName || p.name,
            sellingPrice: Number(p.sellingPrice || p.directPrice || 0),
            category: p.category,
            imageUrl: p.imageUrl,
          }))
        );
      }
    } catch (err) {
      console.error("Error fetching catalogue products:", err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, []);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNo = o.invoiceNumber.toLowerCase().includes(q);
        const matchName = o.customerName.toLowerCase().includes(q);
        const matchPhone = o.customerPhone.toLowerCase().includes(q);
        if (!matchNo && !matchName && !matchPhone) return false;
      }
      // Payment filter
      if (paymentFilter !== "ALL" && o.paymentStatus !== paymentFilter) {
        return false;
      }
      // Fulfilment filter
      if (fulfillmentFilter !== "ALL" && o.fulfillmentStatus !== fulfillmentFilter) {
        return false;
      }
      return true;
    });
  }, [orders, searchQuery, paymentFilter, fulfillmentFilter]);

  // Financial calculations for Create Order Form
  const formCalculations = useMemo(() => {
    const subtotal = formLines.reduce((acc, l) => acc + l.total, 0);
    const discNum = parseFloat(formDiscount) || 0;
    const discount = Math.min(subtotal, Math.max(0, discNum));
    const vatPct = configuredVatPct;
    const taxable = Math.max(0, subtotal - discount);
    const vat = (taxable * vatPct) / 100;
    const grandTotal = Number((taxable + vat).toFixed(2));
    const paidNum = parseFloat(formPaidAmount) || 0;
    const paid = Math.min(grandTotal, Math.max(0, paidNum));
    const balance = Number(Math.max(0, grandTotal - paid).toFixed(2));

    let derivedPaymentStatus: "PAID" | "PARTIAL" | "PENDING" = "PENDING";
    if (grandTotal > 0 && paid >= grandTotal - 0.005) {
      derivedPaymentStatus = "PAID";
    } else if (paid > 0 && paid < grandTotal - 0.005) {
      derivedPaymentStatus = "PARTIAL";
    }

    return {
      subtotal,
      discount,
      vatPct,
      vat: Number(vat.toFixed(2)),
      grandTotal,
      paid,
      balance,
      derivedPaymentStatus,
    };
  }, [formLines, formDiscount, formPaidAmount, configuredVatPct]);

  // Open Create Order Modal
  const openCreateModal = () => {
    setFormCustomerName("");
    setFormWhatsApp("");
    setFormEmail("");
    setFormLines([]);
    setFormDiscount("0");
    setFormPaidAmount("0");
    setFormPaymentMethod("Cash");
    setFormFulfillmentStatus("IN_PRODUCTION");
    setFormNotes("");
    setSelectedProductId("");
    setFormError(null);
    setFormSuccess(null);
    setIsCreateModalOpen(true);
  };

  // Add Product from Catalogue to Order Lines
  const handleAddProduct = () => {
    if (!selectedProductId) return;
    const product = catalogueProducts.find((p) => p.id === selectedProductId);
    if (!product) return;

    // Check if already in lines
    const existingIndex = formLines.findIndex((l) => l.productId === product.id);
    if (existingIndex >= 0) {
      // Increase qty
      setFormLines((prev) =>
        prev.map((l, idx) =>
          idx === existingIndex
            ? { ...l, qty: l.qty + 1, total: Number(((l.qty + 1) * l.price).toFixed(2)) }
            : l
        )
      );
    } else {
      // Add new line
      const newLine: OrderItemLine = {
        productId: product.id,
        name: product.name,
        qty: 1,
        price: product.sellingPrice,
        total: product.sellingPrice,
        imageUrl: product.imageUrl,
      };
      setFormLines((prev) => [...prev, newLine]);
    }
    setSelectedProductId("");
  };

  // Update line quantity
  const handleUpdateLineQty = (index: number, newQty: number) => {
    if (newQty < 1) return;
    setFormLines((prev) =>
      prev.map((l, idx) =>
        idx === index ? { ...l, qty: newQty, total: Number((newQty * l.price).toFixed(2)) } : l
      )
    );
  };

  // Update line price (order-specific override)
  const handleUpdateLinePrice = (index: number, newPrice: number) => {
    if (isNaN(newPrice) || newPrice < 0) return;
    setFormLines((prev) =>
      prev.map((l, idx) =>
        idx === index ? { ...l, price: newPrice, total: Number((l.qty * newPrice).toFixed(2)) } : l
      )
    );
  };

  // Remove line item
  const handleRemoveLine = (index: number) => {
    setFormLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Submit Order Creation
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return; // Idempotency check

    setFormError(null);
    setFormSuccess(null);

    // Validations
    if (!formCustomerName.trim()) {
      setFormError("Customer name is required.");
      return;
    }
    const cleanDigits = formWhatsApp.replace(/\D/g, "");
    if (!formWhatsApp.trim() || cleanDigits.length < 7) {
      setFormError("A valid WhatsApp number with at least 7 digits is required.");
      return;
    }
    if (formLines.length === 0) {
      setFormError("Please add at least one product to the order.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        customerName: formCustomerName.trim(),
        whatsappNumber: formWhatsApp.trim(),
        email: formEmail.trim() || undefined,
        items: formLines,
        discount: formCalculations.discount,
        paidAmount: formCalculations.paid,
        paymentMethod: formPaymentMethod,
        fulfillmentStatus: formFulfillmentStatus,
        notes: formNotes.trim(),
      };

      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFormSuccess(`Order ${data.order.invoiceNumber} created successfully!`);
        setTimeout(() => {
          setIsCreateModalOpen(false);
          fetchOrders();
        }, 600);
      } else {
        setFormError(data.message || "Failed to create order.");
      }
    } catch {
      setFormError("Network error while creating order.");
    } finally {
      setSaving(false);
    }
  };

  // Open Order Details Drawer
  const openOrderDetails = (order: OrderData) => {
    setSelectedOrder(order);
    setDrawerFulfillment(order.fulfillmentStatus);
    setDrawerPaidAmount(String(order.paid));
    setDrawerPaymentMethod(order.paymentMethod || "Cash");
    setDrawerNotes(order.notes || "");
    setDrawerMessage(null);
    setIsDetailsDrawerOpen(true);
  };

  // Update order from Drawer (fulfilment / payment / notes)
  const handleUpdateOrder = async () => {
    if (!selectedOrder || drawerUpdating) return;

    setDrawerUpdating(true);
    setDrawerMessage(null);

    try {
      const payload: any = {
        fulfillmentStatus: drawerFulfillment,
        paidAmount: parseFloat(drawerPaidAmount) || 0,
        paymentMethod: drawerPaymentMethod,
        notes: drawerNotes.trim(),
      };

      const res = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setDrawerMessage("Order updated successfully!");
        fetchOrders();
        setSelectedOrder((prev) => (prev ? { ...prev, ...data.order } : null));
        setTimeout(() => {
          setDrawerMessage(null);
        }, 2000);
      } else {
        setDrawerMessage(data.message || "Failed to update order.");
      }
    } catch {
      setDrawerMessage("Network error while updating order.");
    } finally {
      setDrawerUpdating(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Page Header */}
      <PageHeader
        title="Orders"
        description="Manage commercial customer orders placed via WhatsApp and automatically generate official sales invoices."
        actions={
          <button
            onClick={openCreateModal}
            className="bm-btn bm-btn-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            <HugeIcon icon={PlusSignIcon} size={16} />
            <span>Create Order</span>
          </button>
        }
      />

      {/* 2. Three Summary Cards */}
      <div className="bm-metrics-grid">
        <MetricCard
          label="Total Orders"
          value={metrics.totalOrders}
          subtext="Valid sales invoices"
          icon={Invoice01Icon}
          variant="mint"
        />
        <MetricCard
          label="Pending Payments"
          value={metrics.pendingPayments}
          subtext="Outstanding balance > 0 AED"
          icon={Clock01Icon}
          variant="coral"
        />
        <MetricCard
          label="Delivered Orders"
          value={metrics.deliveredOrders}
          subtext="Fulfilled & delivered orders"
          icon={CheckmarkCircle02Icon}
          variant="lavender"
        />
      </div>

      {/* 3. Orders Directory Card */}
      <div className="bm-card">
        {/* Card Header & Controls */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "14px",
            marginBottom: "18px",
          }}
        >
          {/* Search Box */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--bm-bg-subtle, #F8FAFC)",
              padding: "8px 14px",
              borderRadius: "10px",
              border: "1px solid var(--bm-border-subtle)",
              flex: 1,
              maxWidth: "360px",
            }}
          >
            <HugeIcon icon={Search01Icon} size={15} color="var(--bm-text-muted)" />
            <input
              type="text"
              placeholder="Search by invoice #, customer, or phone..."
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

          {/* Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Payment Filter */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
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
              <option value="ALL">All Payments</option>
              <option value="PAID">Paid</option>
              <option value="PARTIAL">Partial</option>
              <option value="PENDING">Pending</option>
            </select>

            {/* Fulfilment Filter */}
            <select
              value={fulfillmentFilter}
              onChange={(e) => setFulfillmentFilter(e.target.value as any)}
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
              <option value="ALL">All Fulfilment</option>
              <option value="IN_PRODUCTION">In Production</option>
              <option value="READY">Ready</option>
              <option value="DELIVERED">Delivered</option>
            </select>

            <span className="bm-badge bm-badge-neutral">
              <span className="bm-badge-dot" />
              {filteredOrders.length} {filteredOrders.length === 1 ? "Order" : "Orders"}
            </span>
          </div>
        </div>

        {/* 4. Orders Table */}
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--bm-text-muted)" }}>
            Loading orders directory...
          </div>
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            icon={Invoice01Icon}
            title={orders.length === 0 ? "No Commercial Orders Yet" : "No Matching Orders Found"}
            description={
              orders.length === 0
                ? "Enter customer orders confirmed via WhatsApp to automatically generate official sales invoices and monitor fulfillment."
                : "Try clearing search filters or checking spelling."
            }
            badge="STORE ORDERS READY"
            actionText="Create Order"
            onAction={openCreateModal}
          />
        ) : (
          <div className="bm-table-container">
            <table className="bm-table">
              <thead>
                <tr>
                  <th>Order / Invoice #</th>
                  <th>Customer Name</th>
                  <th>WhatsApp</th>
                  <th>Order Date</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Fulfilment</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const { display, waLink } = getWhatsAppInfo(order.customerPhone);
                  const itemsSummary =
                    order.lines.length > 0
                      ? order.lines.map((l) => `${l.qty}x ${l.name}`).join(", ")
                      : "Custom 3D Print";

                  return (
                    <tr
                      key={order.id}
                      onClick={() => openOrderDetails(order)}
                      style={{ cursor: "pointer" }}
                    >
                      {/* Invoice Number */}
                      <td style={{ fontWeight: 700, color: "var(--bm-text-primary)", whiteSpace: "nowrap" }}>
                        {order.invoiceNumber}
                      </td>

                      {/* Customer Name */}
                      <td style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>
                        {order.customerName}
                      </td>

                      {/* WhatsApp Phone */}
                      <td>
                        {waLink ? (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              color: "#25D366",
                              fontWeight: 600,
                              textDecoration: "none",
                              fontSize: "12px",
                            }}
                            title="Open WhatsApp chat with customer"
                          >
                            <HugeIcon icon={Message01Icon} size={14} color="#25D366" />
                            <span>{display}</span>
                          </a>
                        ) : (
                          <span style={{ color: "var(--bm-text-muted)", fontSize: "12px" }}>—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td style={{ fontSize: "12px", color: "var(--bm-text-secondary)", whiteSpace: "nowrap" }}>
                        {order.date}
                      </td>

                      {/* Items */}
                      <td
                        style={{
                          fontSize: "12px",
                          color: "var(--bm-text-secondary)",
                          maxWidth: "240px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={itemsSummary}
                      >
                        {itemsSummary}
                      </td>

                      {/* Total AED */}
                      <td style={{ fontWeight: 700, color: "var(--bm-text-primary)", whiteSpace: "nowrap" }}>
                        AED {order.total.toFixed(2)}
                      </td>

                      {/* Payment Status Badge */}
                      <td>
                        <StatusBadge
                          status={order.paymentStatus}
                          variant={
                            order.paymentStatus === "PAID"
                              ? "success"
                              : order.paymentStatus === "PARTIAL"
                              ? "warning"
                              : "danger"
                          }
                        />
                      </td>

                      {/* Fulfilment Status Badge */}
                      <td>
                        <StatusBadge
                          status={order.fulfillmentStatus}
                          variant={
                            order.fulfillmentStatus === "DELIVERED"
                              ? "success"
                              : order.fulfillmentStatus === "READY"
                              ? "info"
                              : "warning"
                          }
                        />
                      </td>

                      {/* Action */}
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openOrderDetails(order);
                          }}
                          className="bm-btn bm-btn-secondary"
                          style={{ padding: "5px 12px", fontSize: "12px", fontWeight: 600 }}
                        >
                          Details
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
          5. CREATE ORDER MODAL
          ========================================================================= */}
      {isCreateModalOpen && (
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
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
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
                background: "#F8FAFC",
              }}
            >
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--bm-text-primary)", margin: 0 }}>
                  Create Commercial Order
                </h3>
                <p style={{ fontSize: "12px", color: "var(--bm-text-secondary)", margin: "4px 0 0" }}>
                  Record a confirmed customer order and automatically generate its official sales invoice.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--bm-text-muted)" }}
              >
                <HugeIcon icon={CancelCircleIcon} size={22} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleCreateOrder} style={{ display: "flex", flexDirection: "column", overflow: "hidden", flex: 1 }}>
              <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>
                {/* Alert Messages */}
                {formError && (
                  <div
                    style={{
                      padding: "12px 16px",
                      background: "#FEE2E2",
                      border: "1px solid #F87171",
                      borderRadius: "10px",
                      color: "#991B1B",
                      fontSize: "13px",
                      fontWeight: 500,
                    }}
                  >
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div
                    style={{
                      padding: "12px 16px",
                      background: "#D1FAE5",
                      border: "1px solid #34D399",
                      borderRadius: "10px",
                      color: "#065F46",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    {formSuccess}
                  </div>
                )}

                {/* Section A: Customer Details */}
                <div>
                  <h4 style={{ fontSize: "13px", fontWeight: 700, color: "var(--bm-text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 12px 0" }}>
                    A. Customer Details
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--bm-text-primary)" }}>
                        Customer Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rashid Al Falasi"
                        value={formCustomerName}
                        onChange={(e) => setFormCustomerName(e.target.value)}
                        required
                        className="bm-input"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--bm-text-primary)" }}>
                        WhatsApp Number *
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. +971 50 123 4567"
                        value={formWhatsApp}
                        onChange={(e) => setFormWhatsApp(e.target.value)}
                        required
                        className="bm-input"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                      />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--bm-text-primary)" }}>
                        Email (Optional)
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. customer@example.com"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        className="bm-input"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                      />
                    </div>
                  </div>
                </div>

                <hr style={{ border: "none", borderTop: "1px solid var(--bm-border-subtle)", margin: 0 }} />

                {/* Section B: Select Products */}
                <div>
                  <h4 style={{ fontSize: "13px", fontWeight: 700, color: "var(--bm-text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 12px 0" }}>
                    B. Order Items
                  </h4>

                  {/* Product Selector */}
                  <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--bm-border-subtle)",
                        fontSize: "13px",
                        background: "white",
                        color: "var(--bm-text-primary)",
                      }}
                    >
                      <option value="">Select a product from catalogue...</option>
                      {catalogueProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — AED {p.sellingPrice.toFixed(2)} {p.category ? `(${p.category})` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddProduct}
                      disabled={!selectedProductId}
                      className="bm-btn bm-btn-secondary"
                      style={{
                        padding: "8px 16px",
                        fontSize: "13px",
                        fontWeight: 600,
                        opacity: selectedProductId ? 1 : 0.5,
                        cursor: selectedProductId ? "pointer" : "not-allowed",
                      }}
                    >
                      + Add Item
                    </button>
                  </div>

                  {/* Selected Line Items List */}
                  {formLines.length === 0 ? (
                    <div
                      style={{
                        padding: "24px",
                        textAlign: "center",
                        borderRadius: "10px",
                        background: "#F8FAFC",
                        border: "1px dashed var(--bm-border-subtle)",
                        color: "var(--bm-text-muted)",
                        fontSize: "13px",
                      }}
                    >
                      No products added yet. Select a product above to add to this order.
                    </div>
                  ) : (
                    <div style={{ border: "1px solid var(--bm-border-subtle)", borderRadius: "10px", overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                        <thead>
                          <tr style={{ background: "#F8FAFC", borderBottom: "1px solid var(--bm-border-subtle)", textAlign: "left" }}>
                            <th style={{ padding: "10px 12px" }}>Product</th>
                            <th style={{ padding: "10px 12px", width: "110px" }}>Price (AED)</th>
                            <th style={{ padding: "10px 12px", width: "90px" }}>Qty</th>
                            <th style={{ padding: "10px 12px", width: "110px" }}>Line Total</th>
                            <th style={{ padding: "10px 12px", width: "40px" }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {formLines.map((line, idx) => (
                            <tr key={idx} style={{ borderBottom: idx < formLines.length - 1 ? "1px solid var(--bm-border-subtle)" : "none" }}>
                              <td style={{ padding: "10px 12px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  {line.imageUrl ? (
                                    <img
                                      src={line.imageUrl}
                                      alt={line.name}
                                      style={{ width: "32px", height: "32px", borderRadius: "6px", objectFit: "cover" }}
                                    />
                                  ) : (
                                    <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <HugeIcon icon={PackageIcon} size={16} color="#94A3B8" />
                                    </div>
                                  )}
                                  <span style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>{line.name}</span>
                                </div>
                              </td>
                              <td style={{ padding: "10px 12px" }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={line.price}
                                  onChange={(e) => handleUpdateLinePrice(idx, parseFloat(e.target.value))}
                                  style={{ width: "80px", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                                />
                              </td>
                              <td style={{ padding: "10px 12px" }}>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={line.qty}
                                  onChange={(e) => handleUpdateLineQty(idx, parseInt(e.target.value, 10))}
                                  style={{ width: "60px", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                                />
                              </td>
                              <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--bm-text-primary)" }}>
                                AED {line.total.toFixed(2)}
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "right" }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLine(idx)}
                                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "#EF4444" }}
                                  title="Remove item"
                                >
                                  <HugeIcon icon={Delete02Icon} size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <hr style={{ border: "none", borderTop: "1px solid var(--bm-border-subtle)", margin: 0 }} />

                {/* Section C: Financial Calculation & Payment */}
                <div>
                  <h4 style={{ fontSize: "13px", fontWeight: 700, color: "var(--bm-text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 12px 0" }}>
                    C. Financials & Payment
                  </h4>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    {/* Inputs */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--bm-text-primary)" }}>
                          Order Discount (AED)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formDiscount}
                          onChange={(e) => setFormDiscount(e.target.value)}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--bm-text-primary)" }}>
                          Amount Paid Now (AED)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formPaidAmount}
                          onChange={(e) => setFormPaidAmount(e.target.value)}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--bm-text-primary)" }}>
                          Payment Method
                        </label>
                        <select
                          value={formPaymentMethod}
                          onChange={(e) => setFormPaymentMethod(e.target.value)}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px", background: "white" }}
                        >
                          <option value="Cash">Cash</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Card">Card</option>
                          <option value="Payment Link">Payment Link</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--bm-text-primary)" }}>
                          Initial Fulfilment Status
                        </label>
                        <select
                          value={formFulfillmentStatus}
                          onChange={(e) => setFormFulfillmentStatus(e.target.value as any)}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px", background: "white" }}
                        >
                          <option value="IN_PRODUCTION">In Production (Default)</option>
                          <option value="READY">Ready for Delivery</option>
                          <option value="DELIVERED">Delivered</option>
                        </select>
                      </div>
                    </div>

                    {/* Breakdown Summary Box */}
                    <div
                      style={{
                        background: "#F8FAFC",
                        padding: "16px",
                        borderRadius: "12px",
                        border: "1px solid var(--bm-border-subtle)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--bm-text-secondary)" }}>
                        <span>Subtotal:</span>
                        <span style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>AED {formCalculations.subtotal.toFixed(2)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--bm-text-secondary)" }}>
                        <span>Discount:</span>
                        <span style={{ fontWeight: 600, color: "#EF4444" }}>- AED {formCalculations.discount.toFixed(2)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--bm-text-secondary)" }}>
                        <span>VAT ({formCalculations.vatPct}%):</span>
                        <span style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>AED {formCalculations.vat.toFixed(2)}</span>
                      </div>
                      <hr style={{ border: "none", borderTop: "1px solid var(--bm-border-subtle)", margin: "4px 0" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", fontWeight: 700, color: "var(--bm-text-primary)" }}>
                        <span>Grand Total:</span>
                        <span>AED {formCalculations.grandTotal.toFixed(2)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#065F46", fontWeight: 600 }}>
                        <span>Amount Paid:</span>
                        <span>AED {formCalculations.paid.toFixed(2)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: formCalculations.balance > 0 ? "#DC2626" : "#059669", fontWeight: 700 }}>
                        <span>Outstanding Balance:</span>
                        <span>AED {formCalculations.balance.toFixed(2)}</span>
                      </div>
                      <div style={{ marginTop: "6px", paddingTop: "8px", borderTop: "1px dashed var(--bm-border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", color: "var(--bm-text-muted)" }}>Payment Status:</span>
                        <StatusBadge
                          status={formCalculations.derivedPaymentStatus}
                          variant={
                            formCalculations.derivedPaymentStatus === "PAID"
                              ? "success"
                              : formCalculations.derivedPaymentStatus === "PARTIAL"
                              ? "warning"
                              : "danger"
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <hr style={{ border: "none", borderTop: "1px solid var(--bm-border-subtle)", margin: 0 }} />

                {/* Section D: Optional Order Notes */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--bm-text-primary)" }}>
                    Order Notes & Instructions (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Deliver before Friday evening, customer requested gift packaging..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--bm-border-subtle)", fontSize: "13px", resize: "vertical" }}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: "16px 24px",
                  borderTop: "1px solid var(--bm-border-subtle)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  background: "#F8FAFC",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="bm-btn bm-btn-secondary"
                  style={{ padding: "8px 16px", fontSize: "13px" }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || formLines.length === 0}
                  className="bm-btn bm-btn-primary"
                  style={{
                    padding: "8px 20px",
                    fontSize: "13px",
                    fontWeight: 600,
                    opacity: saving || formLines.length === 0 ? 0.6 : 1,
                    cursor: saving || formLines.length === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  {saving ? "Creating Order & Invoice..." : "Create Order & Generate Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          6. ORDER DETAILS DRAWER / MODAL
          ========================================================================= */}
      {isDetailsDrawerOpen && selectedOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            justifyContent: "flex-end",
            zIndex: 100,
          }}
          onClick={() => setIsDetailsDrawerOpen(false)}
        >
          <div
            style={{
              background: "white",
              width: "100%",
              maxWidth: "520px",
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
                background: "#F8FAFC",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--bm-text-primary)", margin: 0 }}>
                    {selectedOrder.invoiceNumber}
                  </h3>
                  <StatusBadge
                    status={selectedOrder.paymentStatus}
                    variant={
                      selectedOrder.paymentStatus === "PAID"
                        ? "success"
                        : selectedOrder.paymentStatus === "PARTIAL"
                        ? "warning"
                        : "danger"
                    }
                  />
                  <StatusBadge
                    status={selectedOrder.fulfillmentStatus}
                    variant={
                      selectedOrder.fulfillmentStatus === "DELIVERED"
                        ? "success"
                        : selectedOrder.fulfillmentStatus === "READY"
                        ? "info"
                        : "warning"
                    }
                  />
                </div>
                <p style={{ fontSize: "12px", color: "var(--bm-text-secondary)", margin: "4px 0 0" }}>
                  Order Date: {selectedOrder.date} · Official Sales Invoice
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailsDrawerOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--bm-text-muted)" }}
              >
                <HugeIcon icon={CancelCircleIcon} size={22} />
              </button>
            </div>

            {/* Drawer Content */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
              {drawerMessage && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#D1FAE5",
                    border: "1px solid #34D399",
                    borderRadius: "8px",
                    color: "#065F46",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  {drawerMessage}
                </div>
              )}

              {/* Customer Info Card */}
              <div
                style={{
                  background: "#F8FAFC",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid var(--bm-border-subtle)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--bm-text-muted)", textTransform: "uppercase" }}>
                    Customer Contact
                  </span>
                  {selectedOrder.customerPhone && (
                    <a
                      href={getWhatsAppInfo(selectedOrder.customerPhone).waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bm-btn"
                      style={{
                        padding: "4px 10px",
                        fontSize: "12px",
                        background: "#25D366",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      <HugeIcon icon={Message01Icon} size={13} color="white" />
                      <span>Chat on WhatsApp</span>
                    </a>
                  )}
                </div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--bm-text-primary)" }}>
                  {selectedOrder.customerName}
                </div>
                <div style={{ fontSize: "13px", color: "var(--bm-text-secondary)", marginTop: "2px" }}>
                  WhatsApp: <strong>{selectedOrder.customerPhone || "—"}</strong>
                </div>
                {selectedOrder.customerEmail && (
                  <div style={{ fontSize: "13px", color: "var(--bm-text-secondary)", marginTop: "2px" }}>
                    Email: {selectedOrder.customerEmail}
                  </div>
                )}
              </div>

              {/* Order Items */}
              <div>
                <h4 style={{ fontSize: "12px", fontWeight: 700, color: "var(--bm-text-muted)", textTransform: "uppercase", margin: "0 0 10px 0" }}>
                  Ordered Items ({selectedOrder.lines.length})
                </h4>
                <div style={{ border: "1px solid var(--bm-border-subtle)", borderRadius: "10px", overflow: "hidden" }}>
                  {selectedOrder.lines.map((l, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "12px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: i < selectedOrder.lines.length - 1 ? "1px solid var(--bm-border-subtle)" : "none",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--bm-text-primary)", fontSize: "13px" }}>
                          {l.name}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--bm-text-muted)", marginTop: "2px" }}>
                          {l.qty} × AED {l.price.toFixed(2)}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: "var(--bm-text-primary)", fontSize: "13px" }}>
                        AED {l.total.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div
                style={{
                  background: "#F8FAFC",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid var(--bm-border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontSize: "13px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--bm-text-secondary)" }}>
                  <span>Subtotal:</span>
                  <span>AED {selectedOrder.subtotal.toFixed(2)}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#EF4444" }}>
                    <span>Discount:</span>
                    <span>- AED {selectedOrder.discount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--bm-text-secondary)" }}>
                  <span>VAT ({selectedOrder.vatPct}%):</span>
                  <span>AED {selectedOrder.vat.toFixed(2)}</span>
                </div>
                <hr style={{ border: "none", borderTop: "1px solid var(--bm-border-subtle)", margin: "4px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "15px", color: "var(--bm-text-primary)" }}>
                  <span>Total Amount:</span>
                  <span>AED {selectedOrder.total.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#065F46", fontWeight: 600 }}>
                  <span>Amount Paid:</span>
                  <span>AED {selectedOrder.paid.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: selectedOrder.balance > 0 ? "#DC2626" : "#059669", fontWeight: 700 }}>
                  <span>Outstanding Balance:</span>
                  <span>AED {selectedOrder.balance.toFixed(2)}</span>
                </div>
              </div>

              {/* Manage Fulfilment & Payment */}
              <div
                style={{
                  background: "white",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid var(--bm-border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <h4 style={{ fontSize: "12px", fontWeight: 700, color: "var(--bm-text-muted)", textTransform: "uppercase", margin: 0 }}>
                  Update Order Status
                </h4>

                {/* Fulfilment Status */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--bm-text-primary)" }}>
                    Fulfilment Stage
                  </label>
                  <select
                    value={drawerFulfillment}
                    onChange={(e) => setDrawerFulfillment(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--bm-border-subtle)",
                      fontSize: "13px",
                      background: "white",
                      color: "var(--bm-text-primary)",
                    }}
                  >
                    <option value="IN_PRODUCTION">In Production</option>
                    <option value="READY">Ready for Delivery</option>
                    <option value="DELIVERED">Delivered</option>
                  </select>
                </div>

                {/* Payment Amount Paid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--bm-text-primary)" }}>
                      Total Paid (AED)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={selectedOrder.total}
                      value={drawerPaidAmount}
                      onChange={(e) => setDrawerPaidAmount(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--bm-border-subtle)",
                        fontSize: "13px",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--bm-text-primary)" }}>
                      Payment Method
                    </label>
                    <select
                      value={drawerPaymentMethod}
                      onChange={(e) => setDrawerPaymentMethod(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--bm-border-subtle)",
                        fontSize: "13px",
                        background: "white",
                      }}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Card">Card</option>
                      <option value="Payment Link">Payment Link</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--bm-text-primary)" }}>
                    Order Notes
                  </label>
                  <textarea
                    rows={2}
                    value={drawerNotes}
                    onChange={(e) => setDrawerNotes(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--bm-border-subtle)",
                      fontSize: "13px",
                      resize: "vertical",
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleUpdateOrder}
                  disabled={drawerUpdating}
                  className="bm-btn bm-btn-primary"
                  style={{
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                    alignSelf: "flex-end",
                    opacity: drawerUpdating ? 0.6 : 1,
                  }}
                >
                  {drawerUpdating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
