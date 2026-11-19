# Print Studio Business Management Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely redesign the visual presentation, application shell, and operational UX of the Print Studio Business Management Workspace using the Finexy-inspired Universal Dashboard Design System, while keeping the Bambu Production Workspace 100% frozen and untouched.

**Architecture:** Token-first CSS foundation (`src/app/business-workspace.css`) providing the calm `#F4F4F2` canvas, crisp white cards, `#20211F` text, and `#F0643D` warm accent. Reusable component architecture (`src/components/admin/ui/`) for headers, metric cards, data tables, status badges, and empty states. Redesigned application shell (`BusinessWorkspaceLayout.tsx`) with seamless workspace switching to `/admin/production`. Polished operational implementations for Overview and all 11 business modules.

**Tech Stack:** Next.js 16.4.6 App Router, React 19, TypeScript, HugeIcons, Neon Postgres (`sql`).

**Spec:** `Universal Dashboard Design System.md` and reference visual `media_1795070963119_06a5c435.jpg`.

## Global Constraints

- Scope: Strictly modify Business Management Workspace (`/admin`, `/admin/*`, `BusinessWorkspaceLayout`, `business-workspace.css`, and business admin views).
- Bambu Production Workspace is FROZEN: Do NOT modify `src/components/ledgerCore.js`, Bambu dashboard, manufacturing product catalogue, print jobs, filament inventory, stock, or Bambu sync.
- Production Database: Do NOT delete, drop, or alter existing production data or schemas.
- Security Invariants: Preserve all server authentication guards (`verifyServerSession`, `requireAdminSession`), CSRF defenses, and IP extraction.
- Do NOT commit, push, or deploy (prepare complete verified implementation and report back).

## Review Focus

1. Workspace Switching: Seamless, bug-free transition between Business Management and Bambu Production (`/admin/production`).
2. Design Token Fidelity: Strict adherence to `#F4F4F2` canvas, `#FFFFFF` cards, `#F0643D` accent, 16–20px radii, and Emil Kowalski micro-interactions.
3. Honest Data Invariants: No fabricated financial figures or fake trends; zero/initial states must be authentic and actionable.
4. Mobile & Tablet Responsiveness: Navigation drawer, fluid metric grids, and horizontal table scrolling on small viewports.
5. Zero Build/Regression Errors: `npx tsx tests/verify-dashboard-metrics.ts`, `tests/verify-vercel-client-ip.ts`, `npx tsc --noEmit`, and `npm run build` must all pass.

---

### Task 1: Design Tokens & Foundational Stylesheet Overhaul

**Files:**
- Modify: `src/app/business-workspace.css`
- Test: `tests/verify-business-workspace-redesign.ts`

**Interfaces:**
- Consumes: Design system tokens from `Universal Dashboard Design System.md`.
- Produces: CSS custom properties (`--bm-canvas`, `--bm-surface`, `--bm-text-primary`, `--bm-accent`, `--bm-radius-*`, etc.) and utility classes for buttons, cards, badges, grids, and tables.

- [ ] **Step 1: Write test verifying token definitions and class presence in `tests/verify-business-workspace-redesign.ts`**
- [ ] **Step 2: Run test to confirm it fails on current legacy teal tokens**
- [ ] **Step 3: Update `src/app/business-workspace.css` with Universal Dashboard Design System tokens**
  - Replace legacy teal/mint colors with `#F4F4F2` canvas, `#FFFFFF` surface, `#20211F` text, `#686A66` secondary, `#E8E9E6` border, `#F0643D` accent, `#DE5531` hover, `#FFF0EA` soft accent.
  - Implement 4px spacing scale, 16-20px card radii, pill buttons, and subtle shadows (`0 2px 8px rgba(32, 33, 31, 0.04)`).
  - Add Emil Kowalski button feedback (`:active { transform: scale(0.97); }`, `cubic-bezier(0.23, 1, 0.32, 1)` easing).
- [ ] **Step 4: Run test to verify it passes**

---

### Task 2: Reusable Admin UI Component Library

**Files:**
- Create: `src/components/admin/ui/PageHeader.tsx`
- Create: `src/components/admin/ui/MetricCard.tsx`
- Create: `src/components/admin/ui/DataTable.tsx`
- Create: `src/components/admin/ui/StatusBadge.tsx`
- Create: `src/components/admin/ui/EmptyState.tsx`
- Test: `tests/verify-business-workspace-redesign.ts`

**Interfaces:**
- Produces:
  - `PageHeader({ title, description, badge, breadcrumbs, actions })`
  - `MetricCard({ label, value, subtext, icon, trend, variant, onClick })`
  - `DataTable({ columns, data, emptyState, searchPlaceholder, onSearch })`
  - `StatusBadge({ status, label, variant })`
  - `EmptyState({ icon, title, description, actionText, onAction })`

- [ ] **Step 1: Write tests for UI component signatures and rendering behavior**
- [ ] **Step 2: Create `PageHeader.tsx`**
- [ ] **Step 3: Create `MetricCard.tsx`**
- [ ] **Step 4: Create `DataTable.tsx`**
- [ ] **Step 5: Create `StatusBadge.tsx`**
- [ ] **Step 6: Create `EmptyState.tsx`**
- [ ] **Step 7: Run tests to verify all component exports and rendering pass**

---

### Task 3: Redesign Application Shell & Navigation Layout

**Files:**
- Modify: `src/components/admin/BusinessWorkspaceLayout.tsx`
- Test: `tests/verify-business-workspace-redesign.ts`

**Interfaces:**
- Consumes: UI tokens, navigation routes, user authentication session.
- Produces: AppShell layout with sidebar, brand area, workspace switcher pill, topbar with breadcrumbs/search/profile, and responsive mobile drawer.

- [ ] **Step 1: Add tests verifying workspace switcher link to `/admin/production` and navigation items**
- [ ] **Step 2: Redesign sidebar navigation with clean white card aesthetic on `#F4F4F2` canvas**
- [ ] **Step 3: Implement prominent dual workspace switcher pill linking to Bambu Production (`/admin/production`)**
- [ ] **Step 4: Organize navigation into logical groups: Core Management, Sales & Clients, Finance & Storefront, System**
- [ ] **Step 5: Modernize TopBar with breadcrumb hierarchy, global search pill, studio status pill, and user profile**
- [ ] **Step 6: Enhance responsive mobile navigation drawer**
- [ ] **Step 7: Run tests to verify layout structure and links**

---

### Task 4: Redesign Overview Dashboard

**Files:**
- Modify: `src/app/admin/page.tsx`
- Test: `tests/verify-business-workspace-redesign.ts`

**Interfaces:**
- Consumes: Database enquiries (`store_enquiries`), quotations (`store_quotes`), products (`products` collection), and auth session.
- Produces: Modern Finexy-style executive operational overview.

- [ ] **Step 1: Add test verifying overview metrics and sections**
- [ ] **Step 2: Implement time-aware executive greeting banner with active manager profile**
- [ ] **Step 3: Implement operational KPI grid (Active Enquiries, Pending Quotes, Commercial Products, Stock Alerts, Bambu Sync Status)**
- [ ] **Step 4: Implement two-column operational layout (Recent Commercial Activity table + Storefront & Inventory Snapshot)**
- [ ] **Step 5: Implement quick action shortcuts for high-frequency workflows**
- [ ] **Step 6: Run tests to verify dashboard rendering and honest data presentation**

---

### Task 5: Redesign Business Management Modules

**Files:**
- Modify: `src/components/admin/ProductManagementView.tsx`
- Modify: `src/app/admin/orders/page.tsx`
- Modify: `src/app/admin/inventory/page.tsx`
- Modify: `src/app/admin/enquiries/page.tsx`
- Modify: `src/app/admin/quotations/page.tsx`
- Modify: `src/app/admin/customers/page.tsx`
- Modify: `src/app/admin/expenses/page.tsx`
- Modify: `src/app/admin/reports/page.tsx`
- Modify: `src/app/admin/settings/page.tsx`
- Modify: `src/components/admin/InstagramGalleryView.tsx`
- Modify: `src/components/admin/MediaLibraryView.tsx`
- Test: `tests/verify-business-workspace-redesign.ts`

**Interfaces:**
- Consumes: Shared UI component library (`PageHeader`, `MetricCard`, `DataTable`, `StatusBadge`, `EmptyState`).
- Produces: High-polish, cohesive business management modules adhering to the Universal Dashboard Design System.

- [ ] **Step 1: Refactor `ProductManagementView.tsx` with updated tokens, filters, cards, and modal**
- [ ] **Step 2: Upgrade `Orders` module with operational orders table, stage filters, and fulfillment stats**
- [ ] **Step 3: Upgrade `Inventory` module with stock health cards, low-stock warnings, and reorder controls**
- [ ] **Step 4: Upgrade `Enquiries` module with inbox view, query triage, and convert-to-quote action**
- [ ] **Step 5: Upgrade `Quotations` module with CAD RFQ pipeline, file inspection badges, and review actions**
- [ ] **Step 6: Upgrade `Customers` module with client directory, order counts, and contact cards**
- [ ] **Step 7: Upgrade `Expenses` module with category breakdown, expense ledger, and monthly totals**
- [ ] **Step 8: Upgrade `Reports` module with performance summary, commercial metrics, and export controls**
- [ ] **Step 9: Upgrade `Settings` module with studio profile, tax/currency settings, and integration status**
- [ ] **Step 10: Refresh `InstagramGalleryView.tsx` and `MediaLibraryView.tsx` with new design tokens**
- [ ] **Step 11: Run tests to verify all 11 modules render properly**

---

### Task 6: Full Verification, Security & Production Build Checks

**Files:**
- Test: `tests/verify-dashboard-metrics.ts`
- Test: `tests/verify-vercel-client-ip.ts`
- Test: `tests/verify-business-workspace-redesign.ts`

- [ ] **Step 1: Execute `npx tsx tests/verify-dashboard-metrics.ts` to ensure Bambu Production is 100% untouched**
- [ ] **Step 2: Execute `npx tsx tests/verify-vercel-client-ip.ts` to ensure security regression tests pass**
- [ ] **Step 3: Execute `npx tsx tests/verify-business-workspace-redesign.ts` to verify full workspace redesign**
- [ ] **Step 4: Run `npx tsc --noEmit` and verify zero TypeScript errors**
- [ ] **Step 5: Run `npm run build` and verify clean production build**
- [ ] **Step 6: Confirm `git status` shows only authorized business workspace files and no secrets or production data**
