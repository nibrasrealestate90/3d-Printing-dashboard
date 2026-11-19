"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  DashboardSquare01Icon,
  PackageIcon,
  Invoice01Icon,
  Mail01Icon,
  UserMultiple02Icon,
  CreditCardIcon,
  Analytics01Icon,
  Settings01Icon,
  PrinterIcon,
  Logout01Icon,
  Menu01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  InstagramIcon,
  Image01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";
import "@/app/business-workspace.css";

export interface BusinessWorkspaceLayoutProps {
  user?: {
    id?: string;
    email?: string;
    full_name?: string;
    role?: string;
  };
  currentPath: string;
  title: string;
  breadcrumbs?: string;
  children: React.ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: any;
  badge?: string;
}

const CORE_NAV_ITEMS: NavItem[] = [
  { path: "/admin", label: "Overview", icon: DashboardSquare01Icon },
  { path: "/admin/products", label: "Products", icon: PackageIcon },
  { path: "/admin/orders", label: "Orders", icon: Invoice01Icon },
];

const SALES_NAV_ITEMS: NavItem[] = [
  { path: "/admin/enquiries", label: "Enquiries", icon: Mail01Icon },
  { path: "/admin/customers", label: "Customers", icon: UserMultiple02Icon },
];

const FINANCE_STORE_NAV_ITEMS: NavItem[] = [
  { path: "/admin/expenses", label: "Expenses", icon: CreditCardIcon },
  { path: "/admin/reports", label: "Reports", icon: Analytics01Icon },
  { path: "/admin/instagram", label: "Instagram", icon: InstagramIcon },
  { path: "/admin/media", label: "Media Library", icon: Image01Icon },
];

const SYSTEM_NAV_ITEMS: NavItem[] = [
  { path: "/admin/settings", label: "Settings", icon: Settings01Icon },
];

export function BusinessWorkspaceLayout({
  user,
  currentPath,
  title,
  breadcrumbs = "Business Management",
  children,
}: BusinessWorkspaceLayoutProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/admin/auth/logout", {
        method: "POST",
        headers: { Accept: "application/json" },
        credentials: "include",
      });
      router.push("/login");
    } catch {
      router.push("/login");
    } finally {
      setIsLoggingOut(false);
    }
  }

  const renderNavSection = (heading: string, items: NavItem[]) => (
    <div className="bm-nav-group">
      <span className="bm-nav-group-title">{heading}</span>
      {items.map((item) => {
        const isActive =
          item.path === "/admin"
            ? currentPath === "/admin" || currentPath === "/admin/overview"
            : currentPath === item.path || currentPath.startsWith(`${item.path}/`);

        return (
          <Link
            key={item.path}
            href={item.path}
            className="bm-nav-item"
            aria-current={isActive ? "page" : undefined}
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="bm-nav-icon-wrap">
              <HugeIcon icon={item.icon} size={15} strokeWidth={2} />
            </div>
            <span>{item.label}</span>
            {item.badge && (
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "10px",
                  padding: "1px 6px",
                  borderRadius: "999px",
                  background: "var(--bm-accent-soft)",
                  color: "var(--bm-accent)",
                  fontWeight: 700,
                }}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );

  const renderNavLinks = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {renderNavSection("Core Operations", CORE_NAV_ITEMS)}
      {renderNavSection("Sales & Clients", SALES_NAV_ITEMS)}
      {renderNavSection("Store & Finance", FINANCE_STORE_NAV_ITEMS)}
      {renderNavSection("System", SYSTEM_NAV_ITEMS)}
    </div>
  );

  return (
    <div className="bm-page-container">
      <div className="bm-app-shell">
        {/* Desktop Persistent Sidebar */}
        <aside className="bm-sidebar" aria-label="Business Workspace Navigation">
          {/* Brand Area */}
          <Link href="/admin" className="bm-brand-wrap">
            <div className="bm-brand-logo">
              <Image src="/logo.svg" alt="Print Studio Logo" width={22} height={22} priority />
            </div>
            <div className="bm-brand-text">
              <h1>Print Studio</h1>
              <p>Commercial Workspace</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }}>
            {renderNavLinks()}
          </nav>

          {/* Workspace Switcher Button at Bottom of Sidebar */}
          <div className="bm-sidebar-bottom">
            <Link
              href="/admin/production"
              className="bm-workspace-switch-btn"
              title="Switch to Bambu 3D Manufacturing Workspace"
            >
              <div className="bm-workspace-switch-left">
                <div className="bm-workspace-switch-icon">
                  <HugeIcon icon={PrinterIcon} size={15} strokeWidth={2} />
                </div>
                <span>Switch to Bambu Production</span>
              </div>
              <HugeIcon icon={ArrowRight01Icon} size={14} strokeWidth={2} />
            </Link>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            className="bm-mobile-drawer-backdrop"
            onClick={() => setMobileMenuOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <div className="bm-mobile-drawer-panel" onClick={(e) => e.stopPropagation()}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "16px",
                  borderBottom: "1px solid var(--bm-border-subtle)",
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div className="bm-brand-logo" style={{ width: "32px", height: "32px" }}>
                    <Image src="/logo.svg" alt="Logo" width={20} height={20} />
                  </div>
                  <div>
                    <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--bm-text-primary)", display: "block" }}>
                      Print Studio
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--bm-text-muted)" }}>
                      Business Management
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--bm-text-secondary)" }}
                  aria-label="Close menu"
                >
                  <HugeIcon icon={ArrowLeft01Icon} size={18} strokeWidth={2} />
                </button>
              </div>

              <nav style={{ flex: 1, overflowY: "auto" }}>
                {renderNavLinks()}
              </nav>

              <div className="bm-sidebar-bottom" style={{ marginTop: "16px" }}>
                <Link
                  href="/admin/production"
                  className="bm-workspace-switch-btn"
                  onClick={() => setMobileMenuOpen(false)}
                  title="Switch to Bambu 3D Manufacturing Workspace"
                >
                  <div className="bm-workspace-switch-left">
                    <div className="bm-workspace-switch-icon">
                      <HugeIcon icon={PrinterIcon} size={15} strokeWidth={2} />
                    </div>
                    <span>Switch to Bambu Production</span>
                  </div>
                  <HugeIcon icon={ArrowRight01Icon} size={14} strokeWidth={2} />
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="bm-header-logout-btn"
                  style={{ width: "100%", justifyContent: "center", padding: "8px 12px", marginTop: "8px" }}
                  title="Sign Out of Session"
                  aria-label="Sign Out"
                >
                  <HugeIcon icon={Logout01Icon} size={14} strokeWidth={2} />
                  <span>{isLoggingOut ? "Signing out..." : "Sign Out"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Viewport */}
        <div className="bm-main-wrapper">
          {/* Header */}
          <header className="bm-header">
            <div className="bm-header-left">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="bm-mobile-menu-btn"
                aria-label="Open navigation menu"
              >
                <HugeIcon icon={Menu01Icon} size={18} strokeWidth={2} />
              </button>
              <div className="bm-header-title">
                <h2>{title}</h2>
                <div className="bm-header-breadcrumbs">
                  <span>{breadcrumbs}</span>
                  <span>/</span>
                  <span style={{ color: "var(--bm-text-primary)", fontWeight: 600 }}>{title}</span>
                </div>
              </div>
            </div>

            <div className="bm-header-actions">
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="bm-header-logout-btn"
                title="Sign Out of Session"
                aria-label="Sign Out"
              >
                <HugeIcon icon={Logout01Icon} size={14} strokeWidth={2} />
                <span>{isLoggingOut ? "Signing out..." : "Sign Out"}</span>
              </button>
            </div>
          </header>

          {/* Main Body */}
          <main className="bm-content">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
