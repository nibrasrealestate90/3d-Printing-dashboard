import React from "react";
import Link from "next/link";
import { verifyServerSession } from "@/lib/server-auth";
import { BusinessWorkspaceLayout } from "@/components/admin/BusinessWorkspaceLayout";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { sql } from "@/lib/db";
import {
  Layers01Icon,
  PackageIcon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  sellingPrice: number;
  stockUnits: number;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  updatedAt: string;
}

export default async function InventoryPage() {
  const auth = await verifyServerSession();

  let inventory: InventoryItem[] = [];
  let totalStockUnits = 0;
  let lowStockAlerts = 0;
  let totalInventoryValue = 0;

  if (sql) {
    try {
      const rows = await sql`
        SELECT record_id, data, updated_at
        FROM ledger_collections
        WHERE collection_name = 'products'
        ORDER BY updated_at DESC;
      `.catch(() => []);

      inventory = rows.map((r: any) => {
        const d = r.data || {};
        const price = Number(d.sellingPrice || d.price || 0);
        // Products in ledger have stock or default to on-demand
        const units = typeof d.stock === "number" ? d.stock : (d.isAvailable ? 12 : 0);
        totalStockUnits += units;
        totalInventoryValue += units * price;

        let status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" = "IN_STOCK";
        if (units === 0) {
          status = "OUT_OF_STOCK";
          lowStockAlerts++;
        } else if (units < 5) {
          status = "LOW_STOCK";
          lowStockAlerts++;
        }

        return {
          id: r.record_id || d.id || String(Math.random()),
          sku: d.sku || `SKU-${(r.record_id || "").slice(0, 6)}`,
          name: d.name || "Commercial Product",
          category: d.publicCategory || d.category || "3D Prints",
          sellingPrice: price,
          stockUnits: units,
          status,
          updatedAt: r.updated_at ? new Date(r.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Recent",
        };
      });
    } catch {
      // Graceful fallback
    }
  }

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin/inventory"
      title="Inventory"
      breadcrumbs="Core Operations"
    >
      <PageHeader
        title="Commercial Finished Goods Inventory"
        description="Monitor ready-to-ship stock, manufactured product batches, safety buffer levels, and reorder thresholds."
        badge={{ text: "Finished Goods", variant: "neutral" }}
        actions={
          <Link href="/admin/products" className="bm-btn bm-btn-primary">
            <HugeIcon icon={PlusSignIcon} size={15} strokeWidth={2} />
            <span>Manage Product Catalog</span>
          </Link>
        }
      />

      {/* KPI Cards Grid */}
      <div className="bm-metrics-grid">
        <MetricCard
          label="Catalog SKUs"
          value={inventory.length}
          subtext="Manufactured product lines"
          icon={PackageIcon}
          variant="mint"
        />
        <MetricCard
          label="Ready-to-Ship Units"
          value={totalStockUnits}
          subtext="Commercial shelf inventory"
          icon={Layers01Icon}
          variant="lavender"
        />
        <MetricCard
          label="Low Stock Warnings"
          value={lowStockAlerts}
          subtext="Below 5 units threshold"
          icon={AlertCircleIcon}
          variant="coral"
        />
        <MetricCard
          label="Retail Inventory Value"
          value={`AED ${totalInventoryValue.toLocaleString()}`}
          subtext="Finished goods valuation"
          icon={CheckmarkCircle02Icon}
          variant="accent"
        />
      </div>

      {/* Main Inventory Card */}
      <div className="bm-card">
        <div className="bm-card-header">
          <div>
            <h2 className="bm-card-title">Commercial Finished Goods Stock</h2>
            <p className="bm-card-subtitle">
              Ready-to-ship printed items and retail storefront availability. (For raw filament spools, visit Bambu Production).
            </p>
          </div>
          <span className="bm-badge bm-badge-neutral">
            <span className="bm-badge-dot" />
            {inventory.length} {inventory.length === 1 ? "SKU" : "SKUs"}
          </span>
        </div>

        {inventory.length === 0 ? (
          <EmptyState
            icon={Layers01Icon}
            title="No Products in Inventory"
            description="Add products to your commercial catalogue to track finished goods stock levels and automated low-stock warnings."
            actionText="Go to Products Catalog"
            actionHref="/admin/products"
            badge="CATALOG EMPTY"
          />
        ) : (
          <div className="bm-table-container">
            <table className="bm-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Selling Price</th>
                  <th>Available Units</th>
                  <th>Stock Status</th>
                  <th>Updated</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span style={{ fontFamily: "var(--bm-font-mono)", fontWeight: 700, fontSize: "12px", color: "var(--bm-accent)" }}>
                        {item.sku}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>{item.name}</td>
                    <td style={{ color: "var(--bm-text-secondary)" }}>{item.category}</td>
                    <td style={{ fontWeight: 600 }}>AED {item.sellingPrice.toFixed(2)}</td>
                    <td style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{item.stockUnits} units</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--bm-text-muted)" }}>{item.updatedAt}</td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        href="/admin/products"
                        style={{ fontSize: "12px", color: "var(--bm-accent)", textDecoration: "none", fontWeight: 600 }}
                      >
                        Edit →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </BusinessWorkspaceLayout>
  );
}
