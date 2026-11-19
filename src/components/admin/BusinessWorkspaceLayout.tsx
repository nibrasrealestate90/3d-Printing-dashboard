"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  DashboardSquare01Icon,
  PackageIcon,
  Invoice01Icon,
  Layers01Icon,
  Mail01Icon,
  Calculator01Icon,
  UserMultiple02Icon,
  CreditCardIcon,
  Analytics01Icon,
  Settings01Icon,
  PrinterIcon,
  Logout01Icon,
  Menu01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Search01Icon,
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

const NAV_ITEMS = [
  { path: "/admin", label: "Overview", icon: DashboardSquare01Icon },
  { path: "/admin/products", label: "Products", icon: PackageIcon },
  { path: "/admin/orders", label: "Orders", icon: Invoice01Icon },
  { path: "/admin/inventory", label: "Inventory", icon: Layers01Icon },
  { path: "/admin/enquiries", label: "Enquiries", icon: Mail01Icon },
  { path: "/admin/quotations", label: "Quotations", icon: Calculator01Icon },
  { path: "/admin/customers", label: "Customers", icon: UserMultiple02Icon },
  { path: "/admin/expenses", label: "Expenses", icon: CreditCardIcon },
  { path: "/admin/reports", label: "Reports", icon: Analytics01Icon },
  { path: "/admin/settings", label: "Settings", icon: Settings01Icon },
];

const WEBSITE_NAV_ITEMS = [
  { path: "/admin/instagram", label: "Instagram", icon: InstagramIcon },
  { path: "/admin/media", label: "Media Library", icon: Image01Icon },
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

  const userEmail = user?.email || "admin@printstudio.ae";
  const userName = user?.full_name || "Administrator";
  const userRole = user?.role || "ADMIN";
  const userInitials = (userName || "AD")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

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

  const renderNavLinks = () => (
    <div className="bm-nav-group">
      <span className="bm-nav-group-title">Commercial Operations</span>
      {NAV_ITEMS.map((item) => {
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
          </Link>
        );
      })}

      <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--bm-border-subtle)" }}>
        <span className="bm-nav-group-title">Website & Media</span>
        {WEBSITE_NAV_ITEMS.map((item) => {
          const isActive = currentPath === item.path || currentPath.startsWith(`${item.path}/`);
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
            </Link>
          );
        })}
      </div>

      <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--bm-border-subtle)" }}>
        <span className="bm-nav-group-title">Manufacturing Console</span>
        <Link
          href="/admin/production"
          className="bm-nav-item"
          style={{ background: "rgba(6, 44, 47, 0.04)" }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="bm-nav-icon-wrap" style={{ background: "var(--bm-pastel-lime)", color: "#062C2F" }}>
            <HugeIcon icon={PrinterIcon} size={15} strokeWidth={2} />
          </div>
          <span style={{ fontWeight: 600 }}>Bambu Production</span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "999px",
              background: "#10B981",
              color: "#FFFFFF",
              fontWeight: 700,
            }}
          >
            LIVE
          </span>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="bm-page-container">
      <div className="bm-app-shell">
        {/* Desktop Persistent Sidebar */}
        <aside className="bm-sidebar" aria-label="Business Workspace Navigation">
          {/* Brand */}
          <Link href="/admin" className="bm-brand-wrap">
            <div className="bm-brand-logo">
              <Image src="/logo.svg" alt="Print Studio Logo" width={22} height={22} priority />
            </div>
            <div className="bm-brand-text">
              <h1>Print Studio</h1>
              <p>Dubai, UAE · Business</p>
            </div>
          </Link>

          {/* Workspace Switcher */}
          <div className="bm-switcher-card">
            <div className="bm-switcher-label">
              <span>Current Workspace</span>
              <span style={{ fontSize: "9px", color: "#10B981", fontWeight: 700 }}>ACTIVE</span>
            </div>
            <div className="bm-switcher-active-pill">
              <span className="bm-live-dot" />
              <span>Business Management</span>
            </div>
            <Link
              href="/admin/production"
              className="bm-switcher-btn"
              title="Switch to Bambu 3D Manufacturing & Printer Telemetry"
            >
              <span>Switch to Bambu Production</span>
              <HugeIcon icon={ArrowRight01Icon} size={13} strokeWidth={2} />
            </Link>
          </div>

          {/* Navigation Links */}
          <nav style={{ flex: 1, overflowY: "auto" }}>
            {renderNavLinks()}
          </nav>

          {/* User Profile Footer */}
          <div className="bm-sidebar-footer">
            <div className="bm-user-badge">
              <div className="bm-user-avatar">{userInitials}</div>
              <div className="bm-user-info">
                <p className="bm-user-name">{userName}</p>
                <p className="bm-user-email">{userEmail}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="bm-logout-btn"
              title="Sign Out of Console"
              aria-label="Sign Out"
            >
              <HugeIcon icon={Logout01Icon} size={15} strokeWidth={2} />
            </button>
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Image src="/logo.svg" alt="Logo" width={24} height={24} />
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--bm-text-primary)" }}>
                    Print Studio
                  </span>
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

              {/* Workspace Switcher in Drawer */}
              <div className="bm-switcher-card">
                <div className="bm-switcher-label">Active Workspace</div>
                <div className="bm-switcher-active-pill">
                  <span className="bm-live-dot" />
                  <span>Business Management</span>
                </div>
                <Link
                  href="/admin/production"
                  className="bm-switcher-btn"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>Switch to Bambu Production</span>
                  <HugeIcon icon={ArrowRight01Icon} size={13} strokeWidth={2} />
                </Link>
              </div>

              <nav style={{ flex: 1, overflowY: "auto" }}>
                {renderNavLinks()}
              </nav>

              <div className="bm-sidebar-footer" style={{ marginTop: "16px" }}>
                <div className="bm-user-badge">
                  <div className="bm-user-avatar">{userInitials}</div>
                  <div className="bm-user-info">
                    <p className="bm-user-name">{userName}</p>
                    <p className="bm-user-email">{userEmail}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="bm-logout-btn"
                  aria-label="Sign Out"
                >
                  <HugeIcon icon={Logout01Icon} size={15} strokeWidth={2} />
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
              {/* Direct Workspace Switcher Pill in Header */}
              <Link
                href="/admin/production"
                className="bm-header-bridge-btn"
                title="Open Bambu Production Workspace"
              >
                <HugeIcon icon={PrinterIcon} size={14} strokeWidth={2} />
                <span>Bambu Production</span>
              </Link>

              {/* User Avatar with Sign Out Quick Action */}
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="bm-user-avatar"
                style={{ cursor: "pointer", border: "1px solid var(--bm-border-strong)" }}
                title={`Signed in as ${userEmail} (${userRole}) • Click to Sign Out`}
                aria-label="Sign Out"
              >
                {userInitials}
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
