import React from "react";
import Link from "next/link";
import Image from "next/image";
import { verifyServerSession } from "@/lib/server-auth";
import { BusinessWorkspaceLayout } from "@/components/admin/BusinessWorkspaceLayout";
import { sql } from "@/lib/db";
import {
  PackageIcon,
  Tag01Icon,
  Image01Icon,
  InstagramIcon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { EmptyState } from "@/components/admin/ui/EmptyState";

interface RecentProduct {
  id: string;
  name: string;
  category: string;
  priceAed: number;
  published: boolean;
  image?: string;
  date: string;
}

/**
 * Commercial Website Management Overview Dashboard
 * Displays essential website & storefront administration metrics:
 * 1. Published Products (catalog items live on storefront)
 * 2. Store Categories (website catalog taxonomy)
 * 3. Media Assets (images, banners, and cloud assets)
 * 4. Website Storefront Status (online and active)
 */
export default async function AdminOverviewPage() {
  const auth = await verifyServerSession();

  let totalProductsCount = 0;
  let publishedProductsCount = 0;
  let totalCategoriesCount = 0;
  let totalMediaCount = 0;
  let recentProducts: RecentProduct[] = [];

  if (sql) {
    try {
      // 1. Fetch products from ledger_collections
      const productRows = await sql`
        SELECT record_id, data, updated_at
        FROM public.ledger_collections
        WHERE collection_name = 'products'
        ORDER BY updated_at DESC;
      `.catch(() => []);

      totalProductsCount = productRows.length;
      publishedProductsCount = productRows.filter((r: any) => Boolean(r.data?.published)).length;

      recentProducts = productRows.slice(0, 5).map((r: any) => {
        const d = r.data || {};
        return {
          id: String(r.record_id || d.id || ""),
          name: String(d.name || d.title || "Untitled Product"),
          category: String(d.category || "General"),
          priceAed: Number(d.priceAed ?? d.price ?? 0),
          published: Boolean(d.published),
          image: typeof d.imageUrl === "string" ? d.imageUrl : (typeof d.photo === "string" && !d.photo.startsWith("data:") ? d.photo : undefined),
          date: r.updated_at ? new Date(r.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Recently",
        };
      });
    } catch {
      // Graceful error fallback
    }

    try {
      // 2. Fetch categories count
      const categoryRows = await sql`
        SELECT record_id
        FROM public.ledger_collections
        WHERE collection_name = 'categories';
      `.catch(() => []);
      totalCategoriesCount = categoryRows.length;
    } catch {
      // Graceful error fallback
    }

    try {
      // 3. Fetch media assets count
      const mediaRows = await sql`
        SELECT record_id
        FROM public.ledger_collections
        WHERE collection_name = 'media';
      `.catch(() => []);
      totalMediaCount = mediaRows.length;
    } catch {
      // Graceful error fallback
    }
  }

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin"
      title="Website Overview"
      breadcrumbs="Website Management"
    >
      {/* 1. Website Management KPI Metrics Grid */}
      <section
        className="bm-metrics-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "16px",
        }}
        aria-label="Website Storefront Metrics"
      >
        <MetricCard
          label="Published Products"
          value={publishedProductsCount}
          subtext={`${totalProductsCount} total in catalog`}
          icon={PackageIcon}
          variant="mint"
        />

        <MetricCard
          label="Store Categories"
          value={totalCategoriesCount}
          subtext="Active storefront taxonomy"
          icon={Tag01Icon}
          variant="lavender"
        />

        <MetricCard
          label="Media Assets"
          value={totalMediaCount}
          subtext="High-res photos & banners"
          icon={Image01Icon}
          variant="coral"
        />

        <MetricCard
          label="Storefront Status"
          value="Live & Online"
          subtext="Dubai e-commerce engine"
          icon={CheckmarkCircle02Icon}
          variant="mint"
        />
      </section>

      {/* 2. Storefront Catalog Showcase Section */}
      <section style={{ marginTop: "24px" }} aria-label="Recent Storefront Products">
        <div className="bm-card">
          <div className="bm-card-header">
            <div>
              <h2 className="bm-card-title">Storefront Catalog Highlights</h2>
              <p className="bm-card-subtitle">Latest products configured for the public e-commerce store</p>
            </div>
            <Link href="/admin/products" className="bm-card-action-btn">
              <span>Manage Products</span>
              <HugeIcon icon={ArrowRight01Icon} size={12} strokeWidth={2} />
            </Link>
          </div>

          {recentProducts.length === 0 ? (
            <EmptyState
              icon={PackageIcon}
              title="No Storefront Products Yet"
              description="Add products or publish existing models to feature them on the commercial storefront website."
              actionText="Add New Product"
              actionHref="/admin/products"
              badge="CATALOG READY"
            />
          ) : (
            <div className="bm-table-container">
              <table className="bm-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price (AED)</th>
                    <th>Store Visibility</th>
                    <th>Last Updated</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentProducts.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          {p.image ? (
                            <div style={{ width: "36px", height: "36px", borderRadius: "8px", overflow: "hidden", position: "relative", flexShrink: 0, border: "1px solid var(--bm-border-subtle)" }}>
                              <Image src={p.image} alt={p.name} fill sizes="36px" style={{ objectFit: "cover" }} />
                            </div>
                          ) : (
                            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "var(--bm-surface-secondary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--bm-text-muted)" }}>
                              <HugeIcon icon={PackageIcon} size={16} strokeWidth={1.8} />
                            </div>
                          )}
                          <span style={{ fontWeight: 600, color: "var(--bm-text-primary)" }}>
                            {p.name}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px", background: "var(--bm-surface-secondary)", color: "var(--bm-text-secondary)" }}>
                          {p.category}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 600, color: "var(--bm-text-primary)" }}>
                          AED {p.priceAed.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        {p.published ? (
                          <StatusBadge status="PUBLISHED" variant="success" />
                        ) : (
                          <StatusBadge status="DRAFT" variant="neutral" />
                        )}
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--bm-text-muted)" }}>
                        {p.date}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link
                          href={`/admin/products`}
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "var(--bm-accent)",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span>Edit</span>
                          <HugeIcon icon={ArrowRight01Icon} size={12} strokeWidth={2} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* 3. Quick Website Management Portals */}
      <section style={{ marginTop: "24px" }} aria-label="Website Management Quick Actions">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
          <div className="bm-card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--bm-accent-soft)", color: "var(--bm-accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <HugeIcon icon={Tag01Icon} size={18} strokeWidth={2} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--bm-text-primary)" }}>Store Categories</h3>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--bm-text-muted)" }}>Organize public browsing taxonomy</p>
              </div>
            </div>
            <Link href="/admin/categories" className="bm-card-action-btn" style={{ width: "100%", justifyContent: "center" }}>
              <span>Manage Store Categories</span>
              <HugeIcon icon={ArrowRight01Icon} size={12} strokeWidth={2} />
            </Link>
          </div>

          <div className="bm-card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(178, 188, 238, 0.35)", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <HugeIcon icon={Image01Icon} size={18} strokeWidth={2} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--bm-text-primary)" }}>Media Library</h3>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--bm-text-muted)" }}>Hero banners, photos & CDN assets</p>
              </div>
            </div>
            <Link href="/admin/media" className="bm-card-action-btn" style={{ width: "100%", justifyContent: "center" }}>
              <span>Upload & Manage Media</span>
              <HugeIcon icon={ArrowRight01Icon} size={12} strokeWidth={2} />
            </Link>
          </div>

          <div className="bm-card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(237, 178, 183, 0.35)", color: "#E11D48", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <HugeIcon icon={InstagramIcon} size={18} strokeWidth={2} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--bm-text-primary)" }}>Instagram Showcase</h3>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--bm-text-muted)" }}>Curate social media showcase feed</p>
              </div>
            </div>
            <Link href="/admin/instagram" className="bm-card-action-btn" style={{ width: "100%", justifyContent: "center" }}>
              <span>Curate Social Feed</span>
              <HugeIcon icon={ArrowRight01Icon} size={12} strokeWidth={2} />
            </Link>
          </div>
        </div>
      </section>
    </BusinessWorkspaceLayout>
  );
}
