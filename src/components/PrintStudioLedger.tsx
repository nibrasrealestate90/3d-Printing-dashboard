"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { initLedger } from "./ledgerCore";
import {
  HugeIcon,
  Layers01Icon,
  ArrowLeft01Icon,
  Menu01Icon,
  Moon02Icon,
  Sun03Icon,
  Logout01Icon,
} from "./hugeIcons";
import {
  DashboardSquare01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { useWorkspaceTransition } from "@/components/workspace";
import { LogoutConfirmationModal } from "@/components/auth/LogoutConfirmationModal";

export default function PrintStudioLedger() {
  const { isSwitching, switchToWorkspace } = useWorkspaceTransition();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/admin/auth/logout", {
        method: "POST",
        headers: { Accept: "application/json" },
        credentials: "include",
      });
    } catch (_) {
      // Proceed to login regardless of network failure
    }
    window.location.href = "/login";
  }

  useEffect(() => {
    const cleanup = initLedger();
    return () => {
      if (typeof cleanup === "function") {
        cleanup();
      }
    };
  }, []);

  return (
    <div className="canvas-wrapper">
      <div className="app-shell" id="app">
        {/* ========================================================================
             Sidebar Navigation (DESIGN.md Universal SaaS System)
             ======================================================================== */}
        <aside className="app-sidebar sidebar" id="mainSidebar">
          {/* Brand Header with 3D Studio Badge Logo */}
          <button type="button" className="sidebar-brand" id="brandHeader" data-tab="dashboard" title="3D Studio — Dashboard">
            <div className="brand-logo-wrap" id="brandLogoBtn">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="3-D Studio Logo" className="sidebar-logo-img" width={68} height={68} />
            </div>
            <span id="bizName" style={{ display: "none" }}>Print Studio</span>
          </button>

          {/* Navigation Groups */}
          <nav className="sidebar-nav" id="sidebarNav"></nav>

          {/* Sidebar Footer */}
          <div className="sidebar-footer">
            <a
              href="/admin"
              className={`btn-switch-workspace ${isSwitching ? "disabled" : ""}`}
              id="switchWorkspaceBtn"
              onClick={(e) => {
                e.preventDefault();
                if (!isSwitching) {
                  switchToWorkspace("business", "/admin");
                }
              }}
              aria-disabled={isSwitching}
              title="Switch to Website Management Workspace"
            >
              <div className="btn-switch-workspace-left">
                <div className="btn-switch-workspace-icon">
                  <HugeIcon icon={DashboardSquare01Icon} size={15} strokeWidth={2} />
                </div>
                <span>Switch to Website Management</span>
              </div>
              <HugeIcon icon={ArrowRight01Icon} size={13} strokeWidth={2} className="btn-switch-workspace-arrow" />
            </a>
            <button
              className="btn-sidebar-logout"
              id="sidebarLogoutBtn"
              type="button"
              onClick={() => setIsLogoutModalOpen(true)}
              disabled={isLoggingOut}
              title="Sign Out of Session"
              aria-label="Sign Out"
            >
              <HugeIcon icon={Logout01Icon} size={15} strokeWidth={2} />
              <span>{isLoggingOut ? "Signing out..." : "Log Out"}</span>
            </button>

            <button className="btn-sidebar-collapse" id="collapseSidebarBtn" title="Toggle Sidebar">
              <HugeIcon icon={ArrowLeft01Icon} size={16} strokeWidth={2} />
              <span>Collapse Sidebar</span>
            </button>
          </div>
        </aside>
        <div className="sidebar-backdrop" id="sidebarBackdrop"></div>

        {/* ========================================================================
             Main Workspace (app-main)
             ======================================================================== */}
        <div className="app-main main-wrapper">
          {/* Header Topbar */}
          <header className="page-header topbar">
            <div className="topbar-left">
              <button className="mobile-menu-btn" id="mobileMenuBtn" aria-label="Open Navigation">
                <HugeIcon icon={Menu01Icon} size={20} strokeWidth={2.2} />
              </button>
              <div className="page-title-box">
                <span className="breadcrumb-tiny" id="crumbText">OVERVIEW :</span>
                <h1 className="page-title" id="pageTitleText">Dashboard</h1>
              </div>
            </div>

            <div className="topbar-right header-actions">
              {/* Dynamic per-page actions slot */}
              <div id="topbarActions" className="topbar-actions-slot"></div>
              
              {/* Theme Toggle (subtle icon container) */}
              <button className="btn-icon" id="themeToggleBtn" title="Toggle Theme">
                <HugeIcon id="moonIcon" icon={Moon02Icon} size={18} strokeWidth={2} />
                <HugeIcon id="sunIcon" icon={Sun03Icon} size={18} strokeWidth={2} style={{ display: "none" }} />
              </button>

              {/* Logout Header Button */}
              <button
                className="btn-icon btn-header-logout"
                id="headerLogoutBtn"
                type="button"
                onClick={() => setIsLogoutModalOpen(true)}
                disabled={isLoggingOut}
                title="Log Out"
                aria-label="Log Out"
              >
                <HugeIcon icon={Logout01Icon} size={17} strokeWidth={2} />
              </button>
            </div>
          </header>

          {/* Main Content Panels Area */}
          <main className="main-content" id="main"></main>
        </div>
      </div>

      <div id="modalRoot"></div>

      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
        isLoggingOut={isLoggingOut}
      />
    </div>
  );
}
