import React from "react";
import { verifyServerSession } from "@/lib/server-auth";
import { BusinessWorkspaceLayout } from "@/components/admin/BusinessWorkspaceLayout";
import { ReportsDashboardView } from "@/components/admin/reports/ReportsDashboardView";
import type { NormalizedInvoice } from "@/components/admin/reports/types";
import { sql } from "@/lib/db";

export default async function ReportsPage() {
  const auth = await verifyServerSession();

  let configuredVatRate = 5;
  const normalizedInvoices: NormalizedInvoice[] = [];

  if (sql) {
    try {
      // 1. Fetch configured VAT rate from settings collection
      const settingsRows = await sql`
        SELECT record_id, data FROM public.ledger_collections 
        WHERE collection_name = 'settings' 
        ORDER BY CASE WHEN record_id = 'app-settings' THEN 0 ELSE 1 END, updated_at DESC;
      `.catch(() => []);

      for (const row of settingsRows) {
        const d = (row.data && typeof row.data === "object") ? row.data : {};
        if (d.vatPct !== undefined && d.vatPct !== null && d.vatPct !== "") {
          const parsed = Number(d.vatPct);
          if (!isNaN(parsed) && parsed >= 0) {
            configuredVatRate = parsed;
            break;
          }
        }
      }

      // 2. Fetch all invoices from ledger_collections
      const invoiceRows = await sql`
        SELECT record_id, data, updated_at 
        FROM public.ledger_collections 
        WHERE collection_name = 'invoices' 
        ORDER BY updated_at DESC;
      `.catch(() => []);

      for (const r of invoiceRows) {
        const d = (r.data && typeof r.data === "object") ? r.data : {};

        // Exclude voided invoices
        const statusLower = String(d.status || "").toLowerCase().trim();
        if (statusLower === "void") continue;

        // Exclude quotations and FOC invoices
        const typeLower = String(d.type || "").toLowerCase().trim();
        if (typeLower === "quote" || typeLower === "foc") continue;
        if (typeLower !== "sale" && typeLower !== "") continue;

        // Calculate invoice total amount
        let orderTotal = 0;
        if (d.total != null && d.total !== "" && !isNaN(Number(d.total))) {
          orderTotal = Number(d.total);
        } else if (d.amount != null && d.amount !== "" && !isNaN(Number(d.amount))) {
          orderTotal = Number(d.amount);
        } else if (Array.isArray(d.lines)) {
          const sub = d.lines.reduce(
            (acc: number, l: any) => acc + (Number(l.qty) || 0) * (Number(l.price) || 0),
            0
          );
          const disc = Math.min(sub, Math.max(0, Number(d.discount) || 0));
          const vatRate =
            d.vatPct != null && d.vatPct !== "" && !isNaN(Number(d.vatPct))
              ? Math.max(0, Number(d.vatPct))
              : configuredVatRate;
          orderTotal = sub - disc + ((sub - disc) * vatRate) / 100;
        }
        orderTotal = Number(orderTotal.toFixed(2));

        // Calculate paid and outstanding balance
        const paid = Math.max(0, Number(d.paid ?? 0));
        const balance = Math.max(0, Number((orderTotal - paid).toFixed(2)));

        // Derive payment status
        let paymentStatus: "PAID" | "PARTIAL" | "PENDING" = "PENDING";
        const rawPs = String(d.paymentStatus || "").toUpperCase().trim();
        if (rawPs === "PAID" || rawPs === "PARTIAL" || rawPs === "PENDING") {
          paymentStatus = rawPs;
        } else if (balance <= 0.005) {
          paymentStatus = "PAID";
        } else if (paid > 0.005) {
          paymentStatus = "PARTIAL";
        } else {
          paymentStatus = "PENDING";
        }

        // Calculate VAT & Taxable Sales Amount
        let vatAmount = 0;
        const invoiceVatPct =
          d.vatPct != null && d.vatPct !== "" && !isNaN(Number(d.vatPct))
            ? Math.max(0, Number(d.vatPct))
            : configuredVatRate;

        if (d.vat != null && d.vat !== "" && !isNaN(Number(d.vat)) && Number(d.vat) >= 0) {
          vatAmount = Number(Number(d.vat).toFixed(2));
        } else if (invoiceVatPct > 0) {
          vatAmount = Number(((orderTotal * invoiceVatPct) / (100 + invoiceVatPct)).toFixed(2));
        }
        const taxableAmount = Math.max(0, Number((orderTotal - vatAmount).toFixed(2)));

        // Extract customer and invoice identification
        const invoiceNumber = String(
          d.invoiceNumber ||
            d.number ||
            d.no ||
            `INV-${String(r.record_id || "").slice(-4).toUpperCase()}`
        ).trim();

        const customerName = String(
          d.customerName || d.client || d.clientName || "Studio Client"
        ).trim();

        const customerEmail = String(
          d.customerEmail || d.email || d.clientEmail || ""
        ).trim();

        const customerPhone = String(
          d.customerPhone || d.phone || d.clientPhone || ""
        ).trim();

        // Extract invoice date
        let dateStr = "";
        if (d.date && typeof d.date === "string" && d.date.length >= 10) {
          dateStr = d.date.slice(0, 10);
        } else if (d.createdAt && typeof d.createdAt === "string" && d.createdAt.length >= 10) {
          dateStr = d.createdAt.slice(0, 10);
        } else if (r.updated_at) {
          dateStr = new Date(r.updated_at).toISOString().slice(0, 10);
        } else {
          dateStr = new Date().toISOString().slice(0, 10);
        }

        const createdAtStr = String(d.createdAt || r.updated_at || new Date().toISOString());

        normalizedInvoices.push({
          id: String(r.record_id || d.id || `inv_${normalizedInvoices.length}`),
          invoiceNumber,
          customerName,
          customerEmail,
          customerPhone,
          date: dateStr,
          createdAt: createdAtStr,
          total: orderTotal,
          paid: Number(paid.toFixed(2)),
          balance,
          paymentStatus,
          vat: vatAmount,
          taxableAmount,
          vatPct: invoiceVatPct,
        });
      }
    } catch (err) {
      console.error("Error loading commercial reports data:", err);
    }
  }

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin/reports"
      title="Reports"
      breadcrumbs="Store & Finance"
    >
      <ReportsDashboardView
        initialInvoices={normalizedInvoices}
        configuredVatRate={configuredVatRate}
      />
    </BusinessWorkspaceLayout>
  );
}
