# Expense Management Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy Stock Management module in the Manufacturing workspace with a complete, production-ready, AED-denominated Expense Management module allowing manual expense tracking, category management, analytics, and reporting.

**Architecture:** Integrate the new Expense Management module directly into the existing 3D Print Studio dashboard architecture (`src/components/ledgerCore.js`, `src/components/hugeIcons.tsx`, and `src/app/ledger.css`) backed by Neon PostgreSQL (`public.ledger_collections`) with dedicated RESTful API endpoints (`/api/admin/expenses` and `/api/admin/expenses/categories`). Maintain strict isolation from filament inventory and product quantities to honor the core rule that expense tracking is strictly financial accounting, never automatic inventory deduction.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Vanilla JS runtime engine (`ledgerCore.js`), Neon PostgreSQL (`@neondatabase/serverless`), Apache ECharts 5.5, SheetJS (`xlsx`), jsPDF / autoTable, HugeIcons.

**Spec:** User request specification for "Build Expense Management Module — 3D Print Studio".

## Global Constraints

- Currency is strictly `AED` formatted with proper two-decimal representation.
- All monetary amounts use numeric/decimal arithmetic without floating-point inaccuracies.
- Expenses are strictly manual entries; recording an expense must NEVER modify Filament Inventory, spools, or product stock.
- Maintain existing 3D Print Studio design language: light mint background (`#E6F7F4`), deep teal primary (`#062C2F`), crisp card surfaces, dark mode support (`dark`), and HugeIcons.
- Sidebar in Manufacturing workspace: Remove "Stock Management", replace with "Expenses" in the same group with active tab highlighting. Preserve existing modules (Product Catalogue, Print Jobs, Filament Inventory, Cost Calculator).
- Historical database records must not be destructively deleted.

## Review Focus

- Expense amount input edge cases: non-numeric inputs, negative numbers, zero, very large numbers; must be validated and rejected gracefully.
- Category deletion safety: attempting to delete a category actively used by existing expense records must be blocked or require reassignment.
- Date range edge cases: leap years, end-of-month boundaries, custom ranges with start date > end date.
- Dynamic custom category creation in Add Expense modal: creating a new category on the fly must not discard entered form data.
- Filament Inventory integrity: verifying that creating, updating, or deleting a "Filament & Materials" expense does NOT alter `S.filaments` or `S.filament_stock`.

---

### Task 1: Database Backend & REST API Endpoints for Expenses and Categories

**Files:**
- Create: `src/app/api/admin/expenses/route.ts`
- Create: `src/app/api/admin/expenses/categories/route.ts`
- Modify: `src/app/api/data/route.ts:96-120`
- Test: `tests/api/expenses.test.ts`

**Interfaces:**
- Consumes: `sql` from `@/lib/db`, `verifyServerSession` from `@/lib/server-auth`, `logAuditEvent` from `@/lib/auth`.
- Produces: 
  - `GET /api/admin/expenses` (returns expenses list, metrics, categories, supports search, category filter, date filter)
  - `POST /api/admin/expenses` (validates and creates new expense record in `ledger_collections`)
  - `PUT /api/admin/expenses` (updates existing expense record)
  - `DELETE /api/admin/expenses` (deletes expense record after auth check)
  - `GET /api/admin/expenses/categories` (lists categories including 10 default categories + custom)
  - `POST /api/admin/expenses/categories` (adds custom category)
  - `PUT /api/admin/expenses/categories` (renames category)
  - `DELETE /api/admin/expenses/categories` (blocks if category is in use, or reassigns)

- [ ] **Step 1: Write backend API validation & route tests**
  Create `tests/api/expenses.test.ts` testing:
  - Unauthorized requests return 401.
  - Expense creation requires `title`, `amount > 0`, `category`, and `expenseDate`.
  - Amount must be stored as clean decimal.
  - Deleting a category with associated expenses returns 409 Conflict with appropriate error message.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx tsx tests/api/expenses.test.ts`
  Expected: FAIL with module not found or connection error.

- [ ] **Step 3: Implement `src/app/api/admin/expenses/route.ts` and `src/app/api/admin/expenses/categories/route.ts`**
  Implement handlers with session verification, audit logging, and input validation.

- [ ] **Step 4: Update `src/app/api/data/route.ts`**
  Add `expense_categories: []` to the default grouped collections and ensure fallback dynamic collection handling so `/api/data` syncs both `expenses` and `expense_categories`.

- [ ] **Step 5: Run tests and verify they pass**
  Run: `npx tsx tests/api/expenses.test.ts`
  Expected: PASS

- [ ] **Step 6: Commit**
  ```bash
  git add src/app/api/admin/expenses src/app/api/data/route.ts tests/api/expenses.test.ts
  git commit -m "feat(expenses): add backend API endpoints for expense management and categories"
  ```

---

### Task 2: Sidebar Navigation Update (Replace Stock Management with Expenses)

**Files:**
- Modify: `src/components/ledgerCore.js:680-745`
- Modify: `src/components/ledgerCore.js:790-875`
- Modify: `src/components/hugeIcons.tsx:160-175`

**Interfaces:**
- Consumes: `APP_ICONS.navExpenses`
- Produces: 
  - `TABS` contains `["expenses", "Expenses"]` instead of `"stock"`
  - `NAV_GROUPS` under `"MANUFACTURING"` contains `{ key: "expenses", label: "Expenses", icon: APP_ICONS.navExpenses }`
  - `render()` maps `expenses` to page title "Expenses" and breadcrumb "MANUFACTURING :"
  - Old `stock` tab remains accessible internally or redirects to `expenses` to avoid breaking deep links, but is removed from the sidebar.

- [ ] **Step 1: Write UI unit test for navigation tabs**
  Verify `NAV_GROUPS` contains `expenses` with label "Expenses" and no longer lists `stock` in `MANUFACTURING`.

- [ ] **Step 2: Update `src/components/ledgerCore.js`**
  - Update `TABS` and `NAV_GROUPS` items.
  - Ensure `tabTitles.expenses = "Expenses"` and `tabCrumbs.expenses = "MANUFACTURING :"`.
  - Ensure `allowedTabs` includes `"expenses"`.

- [ ] **Step 3: Update `src/components/hugeIcons.tsx`**
  Ensure `APP_ICONS.navExpenses` renders a crisp SVG wallet/receipt icon that harmonizes with the other manufacturing icons.

- [ ] **Step 4: Verify navigation rendering in dev server**
  Verify sidebar renders `Expenses` in the Manufacturing group with correct icon and active state.

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/ledgerCore.js src/components/hugeIcons.tsx
  git commit -m "feat(sidebar): replace Stock Management with Expenses in Manufacturing workspace"
  ```

---

### Task 3: Expense Data State, Default Categories & Aggregation Engine

**Files:**
- Modify: `src/components/ledgerCore.js` (State initialization, category defaults, date filter computations)

**Interfaces:**
- Consumes: `S.expenses`, `S.expense_categories`
- Produces:
  - 10 Default Categories:
    1. Filament & Materials
    2. Electricity & Utilities
    3. Printer Maintenance & Repairs
    4. Spare Parts & Accessories
    5. Packaging & Delivery
    6. Marketing & Advertising
    7. Software & Subscriptions
    8. Rent & Workspace
    9. Transportation
    10. Other Expenses
  - Filter functions: `getFilteredExpenses(range, category, search, customStart, customEnd)`
  - Summary KPI metrics:
    - Card 1: Total Expenses for selected period (AED)
    - Card 2: This Month's total expenses (AED)
    - Card 3: Total Transactions count in selected period
    - Card 4: Highest Expense Category (name + AED amount)

- [ ] **Step 1: Write calculation unit test**
  Create test asserting KPI computations given mock expense records across various date ranges (Today, 7D, 30D, This Month, Last Month, Custom).

- [ ] **Step 2: Implement category and data management in `ledgerCore.js`**
  - Initialize default categories if `S.expense_categories` is empty.
  - Implement date range calculation helpers (`isDateInPeriod`, `getStartEndForPeriod`).
  - Implement KPI aggregation function `calculateExpenseKPIs()`.

- [ ] **Step 3: Verify KPI calculations match actual database records**
  Run calculation tests to confirm correct aggregation and AED formatting.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/ledgerCore.js
  git commit -m "feat(expenses): implement expense state, categories, and KPI calculation engine"
  ```

---

### Task 4: Analytics Visualizations (Spending Trend & Category Donut with ECharts)

**Files:**
- Modify: `src/components/ledgerCore.js` (`bindExpenseCharts`, `vExpenses`)
- Modify: `src/app/ledger.css` (Chart container styles, tooltips, responsive grid)

**Interfaces:**
- Consumes: ECharts 5.5 (`window.echarts`), filtered expense records.
- Produces:
  - Line/Area Chart: Spending Trend over time (daily buckets for <= 30 days, monthly/weekly for longer ranges).
  - Donut Chart: Expenses by Category with total amounts, percentage of spending, and color legend.
  - Clean tooltips formatted with `AED XX.XX`.
  - Resize observer for responsive layout.

- [ ] **Step 1: Write DOM layout for analytics cards in `vExpenses`**
  Add two chart cards side-by-side or stacked on mobile: `#expenseTrendChart` and `#expenseCategoryChart`.

- [ ] **Step 2: Implement `bindExpenseCharts()` in `ledgerCore.js`**
  - Aggregate time buckets (daily/weekly/monthly).
  - Aggregate category totals and calculate percentages.
  - Initialize ECharts instances with teal/mint palette (e.g. `#0A6C74`, `#F0643D`, `#10B981`, `#6366F1`, `#F59E0B`, `#EC4899`, `#14B8A6`, `#8B5CF6`).
  - Handle empty data states gracefully with an informative placeholder.

- [ ] **Step 3: Add CSS styles in `src/app/ledger.css`**
  Style chart wrappers with rounded borders, soft shadows, and dark mode palette.

- [ ] **Step 4: Verify chart rendering and responsiveness**
  Check that charts update dynamically when the date filter or category filter changes.

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/ledgerCore.js src/app/ledger.css
  git commit -m "feat(expenses): add ECharts spending trend and category donut analytics"
  ```

---

### Task 5: Expense Management Page UI & Recent Expenses Table

**Files:**
- Modify: `src/components/ledgerCore.js` (`vExpenses`, `renderTopbarActions`)
- Modify: `src/app/ledger.css` (Expenses table styles, search bar, filter pills, pagination)

**Interfaces:**
- Consumes: Filtered expense records, category list.
- Produces:
  - Header actions: `Add Expense` (primary), `Export Excel`, `Report PDF`.
  - Date filter buttons: Today, Last 7 Days, Last 30 Days, This Month, Last Month, Custom Date Range.
  - 4 Summary Cards.
  - Search bar (by title or vendor) and Category filter dropdown.
  - Expenses Table with columns:
    - Date
    - Expense (Title)
    - Category (with distinct visual tag)
    - Vendor
    - Payment Method (Cash, Card, Bank Transfer, Other)
    - Amount (AED)
    - Actions (View details, Edit, Delete)
  - Sorting by Date and Amount (asc/desc).
  - Pagination (10/25 items per page with Prev/Next controls).
  - Empty state when no expenses match filters.

- [ ] **Step 1: Implement `vExpenses()` HTML template in `ledgerCore.js`**
  Assemble header, date range selector, 4 summary cards, analytics section, search/filter controls, and data table.

- [ ] **Step 2: Add table event listeners in `ledgerCore.js`**
  Handle search input debounce, category select change, date filter clicks, sort toggles, and pagination clicks.

- [ ] **Step 3: Style the expenses table and controls in `src/app/ledger.css`**
  Ensure clean spacing, responsive overflow, badge colors for payment methods and categories, and complete dark mode compatibility.

- [ ] **Step 4: Verify table rendering with demo records and empty states**
  Test filtering by search query, category, and date range.

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/ledgerCore.js src/app/ledger.css
  git commit -m "feat(expenses): build Expense Management dashboard and interactive data table"
  ```

---

### Task 6: Add & Edit Expense Workflow, Custom Category Modal & Safe Deletion

**Files:**
- Modify: `src/components/ledgerCore.js` (`openExpenseModal`, `openCategoryManagerModal`, `openDelModal`)
- Modify: `src/app/ledger.css` (Modal styling, category badges, receipt upload input)

**Interfaces:**
- Consumes: `save()`, `del()`, `S.expenses`, `S.expense_categories`
- Produces:
  - Add Expense Modal / Drawer:
    - Title (required text)
    - Amount (required numeric > 0 in AED)
    - Category (required dropdown + "+ New Category" button)
    - Expense Date (required date, defaults to today)
    - Vendor / Supplier (optional text)
    - Payment Method (Cash, Card, Bank Transfer, Other - defaults to Card)
    - Description / Notes (optional textarea)
    - Receipt / Invoice Attachment (optional URL or file reference)
  - On-the-fly Category Creator:
    - Allows adding a custom category without losing already entered form data.
  - Edit Expense Modal:
    - Pre-populates all fields, allows modification and saving.
  - Category Management Modal:
    - Lists categories, allows editing name, and prevents deletion of categories actively referenced by existing expenses.
  - Delete Confirmation Dialog:
    - Warns user before deletion, permanently deletes record upon confirmation.

- [ ] **Step 1: Implement `openExpenseModal(exp, isNew)` in `ledgerCore.js`**
  Render modal into `#modalRoot`, wire validation on submit (rejecting empty title, non-numeric or <=0 amounts, missing date or category).

- [ ] **Step 2: Implement on-the-fly Category creation**
  Preserve form draft state when user clicks "+ New Category", prompt for new category name, save to `S.expense_categories`, and auto-select in the dropdown.

- [ ] **Step 3: Implement Category Management modal**
  Include checks: if category is referenced by any expense in `S.expenses`, disable delete button with tooltip/message "Category in use by X expenses".

- [ ] **Step 4: Wire Delete Confirmation dialog**
  Use `openDelModal()` with clear warning and safe removal via `del("expenses", id)`.

- [ ] **Step 5: Test modal interactions**
  Verify adding new expense, editing existing expense, validation errors, and custom category creation.

- [ ] **Step 6: Commit**
  ```bash
  git add src/components/ledgerCore.js src/app/ledger.css
  git commit -m "feat(expenses): implement Add/Edit modal, custom category manager, and safe delete dialog"
  ```

---

### Task 7: Export to Excel & PDF Report Integration

**Files:**
- Modify: `src/components/ledgerCore.js` (`exportXlsx`, `reportPdf`)

**Interfaces:**
- Consumes: `S.expenses`, `window.XLSX`, `window.jspdf`
- Produces:
  - Excel Export (`data-xls="expenses"`): exports clean formatted table including Date, Title, Category, Vendor, Payment Method, Description, and Amount (AED), with total summary row.
  - PDF Report (`data-pdf="expenses"`): generates executive operational expenses report with Studio header, summary KPI stat cards, and AutoTable.

- [ ] **Step 1: Enhance `expRows` in `sheets()` in `ledgerCore.js`**
  Include all new fields (Date, Title, Category, Vendor, Payment Method, Amount, Description).

- [ ] **Step 2: Enhance `reportPdf` expenses section in `ledgerCore.js`**
  Include Date, Title, Category, Vendor, Payment Method, and Amount formatted in AED with column width optimizations.

- [ ] **Step 3: Verify Excel and PDF downloads in browser**
  Trigger export and verify downloaded files contain expected columns and totals.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/ledgerCore.js
  git commit -m "feat(expenses): enhance Excel and PDF export reports with full expense details"
  ```

---

### Task 8: End-to-End Verification, TypeScript & Production Build

**Files:**
- Test: `tests/e2e/expenses.spec.ts` (Playwright automated test)
- Verification of:
  - Adding an expense
  - Editing an expense
  - Deleting an expense
  - Creating a custom category
  - Date and category filtering
  - Summary KPI updates
  - Chart rendering
  - Filament Inventory isolation (verifying no spool/inventory changes)
  - `npx tsc --noEmit` and `npm run build`

- [ ] **Step 1: Write Playwright E2E test `tests/e2e/expenses.spec.ts`**
  Automate navigating to Expenses, recording an expense, creating a custom category, filtering by date, and asserting that Filament Inventory numbers remain untouched.

- [ ] **Step 2: Run Playwright test**
  Run: `npx playwright test tests/e2e/expenses.spec.ts`
  Expected: PASS

- [ ] **Step 3: Run TypeScript compiler and production build**
  Run: `npx tsc --noEmit && npm run build`
  Expected: PASS with 0 errors.

- [ ] **Step 4: Take visual snapshots in browser for review**
  Capture light mode, dark mode, Add Expense modal, and populated table.

- [ ] **Step 5: Final review and commit**
  ```bash
  git add .
  git commit -m "feat(expenses): complete production-ready Expense Management module"
  ```
