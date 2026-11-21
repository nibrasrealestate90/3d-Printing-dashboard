# Workspace Architecture Realignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Realign workspace boundaries so the Commercial Dashboard (`/admin`) is strictly dedicated to **Website Management** (products catalog publishing, categories, media library, Instagram, website settings), while **Orders**, **Enquiries**, **Customers**, and **Reports** (sales/VAT/invoicing reports) are pulled out and integrated directly into the **Bambu Production & Operations App** (`/`).

**Architecture:** 
1. **Commercial Dashboard (`/admin`)** becomes **Website Management Console**: Focuses solely on storefront content (Products, Categories, Media Library, Instagram, Website Settings). Orders, Enquiries, Customers, and Reports navigation and widgets are completely removed.
2. **Bambu Production App (`/`)** becomes **Production & Operations Ledger**: Expands from printing hardware and filament inventory to include:
   - **Commerce & Fulfillment**: Dedicated tabs for **Orders & Fulfillment**, **Enquiries & Quotes**, and **Customers Directory**, directly backed by the PostgreSQL APIs (`/api/admin/orders`, `/api/admin/enquiries`, `/api/admin/customers`).
   - **Finance & Operations**: **Reports** (Sales, Invoicing, VAT 5%, Monthly Breakdown, CSV/PDF Exports) and **Expenses** (Supplies, Utilities, Maintenance).
3. **Cross-Workspace Transition**: Switcher buttons are updated to `"Switch to Website Management"` and `"Switch to Bambu Production & Operations"`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Vanilla JS runtime engine (`ledgerCore.js`), Neon PostgreSQL (`@neondatabase/serverless`), Apache ECharts 5.5, SheetJS (`xlsx`), jsPDF / autoTable, HugeIcons.

**Spec:** User directives: 
- *"commercial dashboard would only consits website management - pull out orders, enquiries, customers and put it in in the bamboo bamboo production app - make this architecture - setup plan"*
- *"include report as well,"*

---

## Global Constraints

- Currency representation remains strictly `AED` formatted with two decimals.
- Existing database tables in `public.ledger_collections` (`invoices`, `sales`, `enquiries`, `products`, `prints`, `filaments`, `expenses`) must be preserved without schema breaking changes.
- RESTful APIs (`/api/admin/orders`, `/api/admin/enquiries`, `/api/admin/customers`) remain authoritative and will now be consumed by the Bambu Production app.
- Both light mode and dark mode (`html.dark`) must be supported with identical design tokens across both workspaces.
- Navigation transitions must remain seamless with no loss of authentication state (`admin_session` cookie).

---

## Review Focus

1. **Overview KPI Integrity**: Verifying that removing orders/revenue/reports from `/admin` does not throw undefined errors in `/admin/page.tsx` or break metric calculations.
2. **Tab State & Direct Linking**: Ensuring direct URL access (e.g. `/?tab=orders`, `/?tab=enquiries`, `/?tab=customers`, `/?tab=reports`) opens the corresponding tab in `ledgerCore.js`.
3. **Data Sync & Real-Time Reflection**: Changing an order's fulfillment status in the Bambu app immediately reflects in PostgreSQL and is visible upon re-query.
4. **Reports Analytics & Tax Compliance**: Ensuring the Reports view in Bambu App computes VAT (5%), gross sales, net sales, and exportable invoices accurately.
5. **Session Security**: Ensuring that all API requests initiated from `ledgerCore.js` pass valid credentials and CSRF validation.

---

### Task 1: Realign Commercial Dashboard Navigation (`BusinessWorkspaceLayout.tsx`)

**Files:**
- Modify: `src/components/admin/BusinessWorkspaceLayout.tsx`
- Modify: `src/app/business-workspace.css`
- Test: `tests/verify-commercial-website-nav.mjs`

**Interfaces:**
- Consumes: HugeIcons (`PackageIcon`, `Tag01Icon`, `Image01Icon`, `InstagramIcon`, `Settings01Icon`, `PrinterIcon`).
- Produces: Updated navigation structure with Orders, Enquiries, Customers, and Reports removed; workspace branded as "Website Management"; bottom switcher pointing to Bambu Production with updated copy.

- [ ] **Step 1: Write test to verify Commercial Dashboard navigation items**
  Create `tests/verify-commercial-website-nav.mjs` to assert:
  - `/admin` sidebar contains: Overview, Products, Categories, Media Library, Instagram, Settings.
  - `/admin` sidebar does NOT contain: Orders, Enquiries, Customers, Reports.
  - Workspace brand label displays "Website Management".
  - Bottom switcher button text is "Switch to Bambu Production & Operations".

- [ ] **Step 2: Run test to verify it fails**
  Run: `node tests/verify-commercial-website-nav.mjs`
  Expected: FAIL because Orders, Enquiries, Customers, and Reports are currently present.

- [ ] **Step 3: Update `src/components/admin/BusinessWorkspaceLayout.tsx`**
  - Group navigation strictly for Website Management:
    ```typescript
    const STOREFRONT_NAV_ITEMS: NavItem[] = [
      { path: "/admin", label: "Overview", icon: DashboardSquare01Icon },
      { path: "/admin/products", label: "Products", icon: PackageIcon },
      { path: "/admin/categories", label: "Categories", icon: Tag01Icon },
    ];
    const MEDIA_MARKETING_NAV_ITEMS: NavItem[] = [
      { path: "/admin/media", label: "Media Library", icon: Image01Icon },
      { path: "/admin/instagram", label: "Instagram", icon: InstagramIcon },
    ];
    const SYSTEM_NAV_ITEMS: NavItem[] = [
      { path: "/admin/settings", label: "Settings", icon: Settings01Icon },
    ];
    ```
  - Update header badge to "Website Management".
  - Update switcher button text to "Switch to Bambu Production & Operations".

- [ ] **Step 4: Run test to verify it passes**
  Run: `node tests/verify-commercial-website-nav.mjs`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/admin/BusinessWorkspaceLayout.tsx src/app/business-workspace.css tests/verify-commercial-website-nav.mjs
  git commit -m "refactor(admin): restrict commercial dashboard strictly to website management navigation"
  ```

---

### Task 2: Redesign Commercial Overview Page for Website Management (`/admin/page.tsx`)

**Files:**
- Modify: `src/app/admin/page.tsx`
- Test: `tests/verify-website-overview.mjs`

**Interfaces:**
- Consumes: `sql` from `@/lib/db`, `verifyServerSession` from `@/lib/server-auth`.
- Produces: Website-centric overview metrics (Total Products, Published Products, Store Categories, Media Assets) and quick-action cards for storefront management.

- [ ] **Step 1: Write test for website-centric overview KPIs**
  Create `tests/verify-website-overview.mjs` asserting:
  - Metric cards: "Published Products", "Store Categories", "Media Assets", "Website Status".
  - Absence of "Total Orders", "Total Revenue", and "Recent Orders" sales tables.
  - Presence of Storefront Content & Media Assets summary widget.

- [ ] **Step 2: Run test to verify it fails**
  Run: `node tests/verify-website-overview.mjs`
  Expected: FAIL because page still renders orders and revenue.

- [ ] **Step 3: Update `src/app/admin/page.tsx`**
  - Query:
    - Total catalog products and published products count.
    - Store categories count from `ledger_collections WHERE collection_name = 'categories'`.
    - Media uploads count from `ledger_collections WHERE collection_name = 'media'`.
  - Render website management KPI cards and recent media/catalog activity.

- [ ] **Step 4: Run test to verify it passes**
  Run: `node tests/verify-website-overview.mjs`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/app/admin/page.tsx tests/verify-website-overview.mjs
  git commit -m "feat(admin): re-orient overview dashboard to website management metrics"
  ```

---

### Task 3: Expand Bambu Production Navigation & Tab Router (`ledgerCore.js` & `PrintStudioLedger.tsx`)

**Files:**
- Modify: `src/components/ledgerCore.js:1070-1120`
- Modify: `src/components/PrintStudioLedger.tsx:60-90`
- Modify: `src/components/hugeIcons.tsx`
- Test: `tests/verify-bambu-navigation.mjs`

**Interfaces:**
- Consumes: Icons from `hugeIcons.tsx` (`Invoice01Icon`, `Mail01Icon`, `UserMultiple02Icon`, `Analytics01Icon`).
- Produces: Updated `NAV_GROUPS` with `COMMERCE & FULFILLMENT` group (`orders`, `enquiries`, `customers`) and `FINANCE & OPERATIONS` group (`reports`, `expenses`, `settings`). Updated URL hash/param routing, and updated bottom switcher ("Switch to Website Management").

- [ ] **Step 1: Write test for Bambu app navigation groups**
  Create `tests/verify-bambu-navigation.mjs` asserting:
  - Navigation has groups: `MANUFACTURING`, `COMMERCE & FULFILLMENT`, `FINANCE & OPERATIONS`.
  - `COMMERCE & FULFILLMENT` contains tabs: `orders` ("Orders & Fulfillment"), `enquiries` ("Enquiries & Quotes"), `customers` ("Customers").
  - `FINANCE & OPERATIONS` contains tabs: `reports` ("Financial & Sales Reports"), `expenses` ("Expenses"), `settings` ("Settings").
  - Switcher button says "Switch to Website Management".

- [ ] **Step 2: Run test to verify it fails**
  Run: `node tests/verify-bambu-navigation.mjs`
  Expected: FAIL because tabs do not exist in `NAV_GROUPS`.

- [ ] **Step 3: Update `NAV_GROUPS` and `TABS` in `src/components/ledgerCore.js`**
  ```javascript
  const NAV_GROUPS = [
    {
      group: "MANUFACTURING",
      items: [
        { key: "dashboard", label: "Dashboard", icon: APP_ICONS.navDashboard },
        { key: "prints", label: "Print Jobs", icon: APP_ICONS.navPrints },
        { key: "products", label: "Product Catalogue", icon: APP_ICONS.navProducts },
        { key: "filaments", label: "Filament Inventory", icon: APP_ICONS.navFilaments },
        { key: "calc", label: "Cost Calculator", icon: APP_ICONS.navCalc }
      ]
    },
    {
      group: "COMMERCE & FULFILLMENT",
      items: [
        { key: "orders", label: "Orders & Fulfillment", icon: APP_ICONS.navOrders },
        { key: "enquiries", label: "Enquiries & Quotes", icon: APP_ICONS.navEnquiries },
        { key: "customers", label: "Customers", icon: APP_ICONS.navCustomers }
      ]
    },
    {
      group: "FINANCE & OPERATIONS",
      items: [
        { key: "reports", label: "Financial Reports", icon: APP_ICONS.navReports },
        { key: "expenses", label: "Expenses", icon: APP_ICONS.navExpenses },
        { key: "settings", label: "Settings", icon: APP_ICONS.navSettings }
      ]
    }
  ];
  ```
  - Update `PrintStudioLedger.tsx` switcher text: "Switch to Website Management".

- [ ] **Step 4: Run test to verify it passes**
  Run: `node tests/verify-bambu-navigation.mjs`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/ledgerCore.js src/components/PrintStudioLedger.tsx src/components/hugeIcons.tsx tests/verify-bambu-navigation.mjs
  git commit -m "feat(bambu): add commerce, fulfillment, and financial reports navigation"
  ```

---

### Task 4: Implement Orders & Fulfillment Tab in Bambu Production App

**Files:**
- Modify: `src/components/ledgerCore.js`
- Modify: `src/app/ledger.css`
- Test: `tests/verify-orders-tab.mjs`

**Interfaces:**
- Consumes: `GET /api/admin/orders`, `PUT /api/admin/orders/:id`.
- Produces: `renderOrdersTab()`, order filtering by fulfillment status (`ALL`, `IN_PRODUCTION`, `READY`, `DELIVERED`), status updates, invoice preview, and direct link to Bambu print jobs.

- [ ] **Step 1: Write test for Orders tab rendering and interaction**
  Create `tests/verify-orders-tab.mjs` asserting:
  - Navigating to `/?tab=orders` renders Orders & Fulfillment view.
  - KPI cards: Total Orders, In Production, Ready for Delivery, Total Revenue (AED).
  - Order row displays: Invoice #, Customer, Line items with quantities, Total AED, Payment Status, Fulfillment status badge/dropdown.
  - Fulfillment status change triggers API PUT and updates badge.

- [ ] **Step 2: Run test to verify it fails**
  Run: `node tests/verify-orders-tab.mjs`
  Expected: FAIL because `renderOrdersTab` is not yet implemented.

- [ ] **Step 3: Implement `renderOrdersTab()` in `src/components/ledgerCore.js`**
  - Fetch orders from `/api/admin/orders`.
  - Render KPIs, search & filter toolbar, and responsive orders table.
  - Add fulfillment status change handler that updates status (`IN_PRODUCTION` -> `READY` -> `DELIVERED`).
  - Add modal to view complete line items, customer delivery notes, and print specifications.

- [ ] **Step 4: Run test to verify it passes**
  Run: `node tests/verify-orders-tab.mjs`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/ledgerCore.js src/app/ledger.css tests/verify-orders-tab.mjs
  git commit -m "feat(bambu): implement production orders and fulfillment management tab"
  ```

---

### Task 5: Implement Enquiries & Quotes Tab in Bambu Production App

**Files:**
- Modify: `src/components/ledgerCore.js`
- Modify: `src/app/ledger.css`
- Test: `tests/verify-enquiries-tab.mjs`

**Interfaces:**
- Consumes: `GET /api/admin/enquiries`, `PUT /api/admin/enquiries/:id`.
- Produces: `renderEnquiriesTab()`, enquiry cards, WhatsApp direct link, status toggle (`NEW` / `IN_REVIEW` / `RESPONDED` / `ARCHIVED`), and CAD quote estimation launcher.

- [ ] **Step 1: Write test for Enquiries tab rendering and interaction**
  Create `tests/verify-enquiries-tab.mjs` asserting:
  - Navigating to `/?tab=enquiries` renders Enquiries & Quotes view.
  - KPI cards: New Requests, In Review, Responded, Total.
  - Enquiry card displays: Customer name, email, phone with WhatsApp link, subject, message text, date.
  - Quick action to update status to `IN_REVIEW` or `RESPONDED`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `node tests/verify-enquiries-tab.mjs`
  Expected: FAIL because `renderEnquiriesTab` is not implemented.

- [ ] **Step 3: Implement `renderEnquiriesTab()` in `src/components/ledgerCore.js`**
  - Fetch enquiries from `/api/admin/enquiries`.
  - Render KPI summary cards and list of enquiry cards with status tags.
  - Attach WhatsApp direct action (`https://wa.me/<digits>?text=...`).
  - Add status dropdown / quick toggle to mark as Responded or Archive.

- [ ] **Step 4: Run test to verify it passes**
  Run: `node tests/verify-enquiries-tab.mjs`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/ledgerCore.js src/app/ledger.css tests/verify-enquiries-tab.mjs
  git commit -m "feat(bambu): implement customer enquiries and quotes management tab"
  ```

---

### Task 6: Implement Customers Directory Tab in Bambu Production App

**Files:**
- Modify: `src/components/ledgerCore.js`
- Modify: `src/app/ledger.css`
- Test: `tests/verify-customers-tab.mjs`

**Interfaces:**
- Consumes: `GET /api/admin/customers`.
- Produces: `renderCustomersTab()`, client roster cards, total spend in AED, order history modal, WhatsApp & Email quick actions.

- [ ] **Step 1: Write test for Customers tab rendering and interaction**
  Create `tests/verify-customers-tab.mjs` asserting:
  - Navigating to `/?tab=customers` renders Customer Directory view.
  - KPI cards: Total Clients, Repeat Clients, Cumulative Lifetime Value (AED).
  - Customer directory table: Client Name, Email, Phone (WhatsApp clickable), Total Orders, Total AED spent.
  - Clicking customer opens order history modal listing previous print jobs and invoices.

- [ ] **Step 2: Run test to verify it fails**
  Run: `node tests/verify-customers-tab.mjs`
  Expected: FAIL because `renderCustomersTab` is not implemented.

- [ ] **Step 3: Implement `renderCustomersTab()` in `src/components/ledgerCore.js`**
  - Fetch customers from `/api/admin/customers`.
  - Render customer search toolbar, KPI metrics, and client table.
  - Render customer detail drawer/modal showing past order numbers, dates, items, and status.

- [ ] **Step 4: Run test to verify it passes**
  Run: `node tests/verify-customers-tab.mjs`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/ledgerCore.js src/app/ledger.css tests/verify-customers-tab.mjs
  git commit -m "feat(bambu): implement customer directory and order history tab"
  ```

---

### Task 7: Implement Financial & Sales Reports Tab in Bambu Production App

**Files:**
- Modify: `src/components/ledgerCore.js`
- Modify: `src/app/ledger.css`
- Test: `tests/verify-reports-tab.mjs`

**Interfaces:**
- Consumes: `public.ledger_collections` (`invoices` and `sales`), Apache ECharts, SheetJS, jsPDF.
- Produces: `renderReportsTab()`:
  - KPI cards: Total Billed Sales (AED), Net Sales (before VAT), Output VAT Collected (5% AED), Average Order Value.
  - Monthly & quarterly revenue breakdown charts (ECharts).
  - Invoice ledger table with date, invoice #, customer, subtotal, 5% VAT, total AED, payment method, payment status.
  - 1-click Export to Excel (`.xlsx`) and Tax Compliance PDF report (`.pdf`).

- [ ] **Step 1: Write test for Reports tab rendering and export capabilities**
  Create `tests/verify-reports-tab.mjs` asserting:
  - Navigating to `/?tab=reports` renders Financial Reports view.
  - KPI metrics: Gross Sales, Net Sales, 5% VAT, Invoices count.
  - Invoice ledger table contains formatted AED amounts.
  - Export buttons for CSV/Excel and PDF exist and trigger without errors.

- [ ] **Step 2: Run test to verify it fails**
  Run: `node tests/verify-reports-tab.mjs`
  Expected: FAIL because `renderReportsTab` is not implemented.

- [ ] **Step 3: Implement `renderReportsTab()` in `src/components/ledgerCore.js`**
  - Calculate sales analytics from `S.invoices` / `S.sales`.
  - Render VAT tax summary card (5% UAE VAT rate).
  - Render ECharts monthly sales progression curve.
  - Render invoice breakdown table with search, date range filter, and export handlers.

- [ ] **Step 4: Run test to verify it passes**
  Run: `node tests/verify-reports-tab.mjs`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/ledgerCore.js src/app/ledger.css tests/verify-reports-tab.mjs
  git commit -m "feat(bambu): implement financial sales, tax, and invoicing reports tab"
  ```

---

### Task 8: Full System Verification, URL Redirects & Production Build

**Files:**
- Modify: `src/proxy.ts` (redirect `/admin/orders`, `/admin/enquiries`, `/admin/customers`, `/admin/reports` to `/?tab=...`)
- Test: `tests/verify-full-architecture-realignment.mjs`

**Interfaces:**
- Consumes: Both workspaces, all updated routes, proxy routing.
- Produces: 100% passing test suite across both dashboards, zero TypeScript errors (`npx tsc --noEmit`), and successful production build (`npm run build`).

- [ ] **Step 1: Add canonical redirects for legacy `/admin` commerce & reporting routes**
  In `src/proxy.ts`, redirect:
  - `/admin/orders` -> `/?tab=orders`
  - `/admin/enquiries` -> `/?tab=enquiries`
  - `/admin/customers` -> `/?tab=customers`
  - `/admin/reports` -> `/?tab=reports`

- [ ] **Step 2: Run full end-to-end verification test suite**
  Execute: `node tests/verify-full-architecture-realignment.mjs`
  Verify:
  - Website Management dashboard contains only storefront tools.
  - Bambu Production app handles manufacturing + orders, enquiries, customers, and financial reports.
  - Workspace switcher links work bidirectionally.

- [ ] **Step 3: Run TypeScript & Next.js production build verification**
  Run: `npx tsc --noEmit && npm run build`
  Expected: 0 errors across all static and dynamic routes.

- [ ] **Step 4: Final commit**
  ```bash
  git add src/proxy.ts tests/verify-full-architecture-realignment.mjs docs/superpowers/plans/2026-11-21-workspace-architecture-realignment.md
  git commit -m "chore(architecture): complete workspace realignment including reports into bambu production app"
  ```
