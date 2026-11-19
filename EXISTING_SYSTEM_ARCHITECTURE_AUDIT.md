# Existing System Architecture Audit: Print Studio Ledger (`print-studio-app`)
**Document Identifier:** `EXISTING_SYSTEM_ARCHITECTURE_AUDIT.md`  
**Audit Date:** November 17, 2026  
**Auditor:** Senior Software Architect & Technical Auditor  
**Audit Scope:** Full Codebase Inspection, Data Layer, Bambu Lab Integration, Security Posture, and Technical Debt Analysis  
**Repository Location:** `/Users/subhamsantra/Desktop/Dashboard/3D PRINTING`  

---

## Executive Summary

The **Print Studio Ledger** (`print-studio-app`) is a hybrid Next.js 16 (App Router) / React 19 application built as a specialized Studio Management and Manufacturing Resource Planning (MRP) ledger for a 3D printing business operating Bambu Lab 3D printers in the UAE (AED currency, 5% VAT).

The application originated from a standalone, single-file HTML/JS prototype ([Print Studio Ledger.html](file:///Users/subhamsantra/Desktop/Dashboard/3D%20PRINTING/Print%20Studio%20Ledger.html), 153 KB) that was subsequently wrapped into Next.js. While the project exhibits exceptional visual polish adhering to the custom Universal SaaS Design System ([DESIGN.md](file:///Users/subhamsantra/Desktop/Dashboard/3D%20PRINTING/DESIGN.md)), its internal architectural anatomy is characterized by a **massive client-side imperative core** ([ledgerCore.js](file:///Users/subhamsantra/Desktop/Dashboard/3D%20PRINTING/src/components/ledgerCore.js), 8,451 lines) mounted onto a minimal React shell ([PrintStudioLedger.tsx](file:///Users/subhamsantra/Desktop/Dashboard/3D%20PRINTING/src/components/PrintStudioLedger.tsx)), backed by a **single-table JSONB document-store pattern** in Neon Serverless PostgreSQL (`ledger_collections`).

The system currently manages **79 unique catalog products**, **220 historical Bambu print jobs**, **34 physical filament inventory records**, and full invoicing/calculation workflows.

---

## 1. Technology Stack Inventory

| Layer | Component / Package | Version | Implementation Details & Role |
|---|---|---|---|
| **Framework** | Next.js | `16.4.6` | App Router (`src/app`), Server Components shell, Client boundary at `page.tsx` |
| **Runtime / UI** | React / React-DOM | `19.3.0` | Container mount for Vanilla JS imperative rendering engine |
| **Language** | TypeScript / JavaScript | TS `5.x` / ES2017 | Next.js API routes & components in TS; core business logic in JS (`// @ts-nocheck`) |
| **Database** | Neon Serverless PostgreSQL | `@neondatabase/serverless` `^1.2.0` | Cloud Postgres database (`neondb`) hosted on branch `production` (`br-noisy-haze-aziu7zel`) |
| **Database Tooling** | `@neon/config`, `@neon/env` | `^1.14.0`, `^2.1.3` | Neon branch management and environment resolution |
| **Styling & Tokens** | Tailwind CSS / Custom CSS | `4.3.3` / `ledger.css` | Tailwind v4 via `@import "tailwindcss"`; 8,108-line custom design token system in [ledger.css](file:///Users/subhamsantra/Desktop/Dashboard/3D%20PRINTING/src/app/ledger.css) |
| **Icons** | HugeIcons Core Free Icons | `@hugeicons/core-free-icons` `^4.4.0` | Custom wrapper [hugeIcons.tsx](file:///Users/subhamsantra/Desktop/Dashboard/3D%20PRINTING/src/components/hugeIcons.tsx) rendering SVG icons for navigation and actions |
| **Visualization** | Apache ECharts | `^6.1.0` (CDN `5.5.0`) | Loaded via CDN `<Script>` in [layout.tsx](file:///Users/subhamsantra/Desktop/Dashboard/3D%20PRINTING/src/app/layout.tsx); powers print hours and filament trends |
| **Export Engines** | SheetJS (`xlsx`), jsPDF, jsPDF-AutoTable | `0.18.5`, `2.5.1`, `3.8.2` | Client-side Excel `.xlsx` workbook generation and vector PDF invoice/statement rendering |
| **External Integration**| Bambu Lab Cloud REST API | `v1` (Cloud) | Official user service tasks endpoint (`api.bambulab.com/v1/user-service/my/tasks`) |
| **Installed Unused** | MQTT.js | `^5.16.1` | Listed in `package.json` dependencies, but zero production imports in `src/` or `scripts/` |
| **Test Tooling** | Playwright | `^1.65.0` | 18 ad-hoc `.mjs` scripts in `tests/`; no test runner harness or `npm test` script |

---

## 2. Architecture & Data Flow Diagram

```mermaid
flowchart TD
    subgraph Browser ["Client Browser (Single-Page App)"]
        HTML ["Root Layout (layout.tsx)\n- Fontshare General Sans\n- CDN ECharts, jsPDF, SheetJS"]
        Shell ["PrintStudioLedger.tsx\n(Client Boundary, dynamic ssr:false)"]
        Core ["ledgerCore.js (8,451 lines)\n- Global In-Memory State S\n- IndexedDB & BroadcastChannel Sync\n- Imperative Template Rendering\n- Event Delegation & Modal Root"]
        Spool ["FilamentSpool.tsx\n- Dynamic 3D SVG Spools (34 Colors)"]
    end

    subgraph NextServer ["Next.js 16 App Router Backend"]
        ApiData ["/api/data\n- GET (all / single / ?status=1 polling)\n- POST (single upsert / syncAll)\n- DELETE (record delete)"]
        ApiBambu ["/api/bambu/sync\n- GET / POST (incremental task sync)\n- action=backfill-photos\n- Model title cleaner & MD5 hasher\n- S3 image base64 transcoder"]
        ApiHealth ["/api/health\n- Neon connection status check"]
        DBClient ["src/lib/db.ts\n- Neon HTTP query client (neon(DATABASE_URL))"]
    end

    subgraph NeonDB ["Neon Lakebase Serverless PostgreSQL"]
        Table [("public.ledger_collections\n- collection_name (text)\n- record_id (text)\n- data (jsonb)\n- updated_at (timestamptz)\nPRIMARY KEY (collection_name, record_id)")]
    end

    subgraph BambuCloud ["External Cloud Services"]
        BambuAPI ["Bambu Lab Cloud API\nhttps://api.bambulab.com/v1/user-service/my/tasks"]
        BambuS3 ["Bambu AWS S3 / OSS CDN\n(Presigned Temporary Cover URLs)"]
    end

    Shell --> Core
    Core --> Spool
    Core -- "fetch('/api/data', GET/POST/DELETE)" --> ApiData
    Core -- "fetch('/api/data?status=1') [5s Polling]" --> ApiData
    Core -- "fetch('/api/bambu/sync', POST)" --> ApiBambu
    ApiData --> DBClient
    ApiBambu --> DBClient
    ApiHealth --> DBClient
    DBClient --> Table
    ApiBambu -- "Bearer Token (BAMBU_TOKEN)" --> BambuAPI
    ApiBambu -- "Download Image Buffer & Base64 Encode" --> BambuS3
```

---

## 3. Application Module Inventory

The application interface is structured into **6 navigation sections** comprising **17 routes** managed dynamically via `ledgerCore.js`:

### 3.1 Overview Section
1. **Dashboard (`dashboard` / `vDash`)**
   - **Operational Purpose:** Executive command center displaying manufacturing throughput, machine utilization, and revenue health.
   - **Implementation Status:** Fully Implemented.
   - **Persistence:** Real-time computation derived from `S.products`, `S.prints`, and `S.filaments`.
   - **Key Features:** Timeframe filters (`24H`, `7D`, `30D`, `12M`, `ALL`), 5 KPI metric cards with % delta vs prior period, ECharts print hours trendline, filament consumption breakdown chart, top printed products ranking, recent activity feeds.
   - **Known Limitations:** Delta calculations compare against static mock baselines when historical data points in the previous sliding window are sparse.

### 3.2 Inventory & Production Section
2. **Product Catalogue (`products` / `vProducts`)**
   - **Operational Purpose:** Finished goods design catalogue for 3D printed products.
   - **Implementation Status:** Fully Implemented.
   - **Persistence:** Persisted in `ledger_collections` under `collection_name = 'products'`. Currently holds **79 unique records**.
   - **Key Features:** Dual layout (responsive 4-column card grid vs structured table view), search by title/SKU, category filtering, sorting (Most Printed, Newest, Name, Filament Weight), status badges (Printed 1+, Zero Prints, Missing Photos), slide-over Product Detail Drawer with print run history, unit costing, and Bambu task links. "Recover Photos" button invokes thumbnail backfill.
   - **Known Limitations:** Product photos are stored as heavy Base64 data strings directly inside JSONB (`products.data.photo`), resulting in large database payload transfer sizes.

3. **Filament Inventory (`filaments` / `vFil`)**
   - **Operational Purpose:** Raw material spool inventory and cost tracking.
   - **Implementation Status:** Fully Implemented.
   - **Persistence:** Persisted in `ledger_collections` under `collection_name = 'filament_stock'` (and mirrored in `'filaments'`). Currently holds **34 physical spool records**.
   - **Key Features:** Photorealistic 3D SVG spool graphics ([FilamentSpool.tsx](file:///Users/subhamsantra/Desktop/Dashboard/3D%20PRINTING/src/components/FilamentSpool.tsx)) with accurate dynamic color mapping for all 34 catalog colors, material badges (`CR-PLA`, `PLA+`, `Hyper PLA`, `CR-PETG`, `PETG`, `TPU`), spool weight (1.0 kg), unit price (AED 75/spool), `+ Add Filament` modal, and full Edit/Delete workflows.
   - **Known Limitations:** AMS automatic deduction is intentionally decoupled; spool depletion is managed through manual count adjustments rather than real-time gram-by-gram decrementing from print jobs.

4. **Stock Management (`stock` / `vStock`)**
   - **Operational Purpose:** Centralized MRP inventory hub bridging raw spool supply with finished printed output.
   - **Implementation Status:** Partially Implemented (Aggregated Hub View).
   - **Persistence:** Dynamically aggregated from `S.filament_stock`, `S.products`, and `S.prints`.
   - **Key Features:** KPI summary cards (34 spools / 34.0 kg inventory valued at AED 2,550.00; 167 finished pieces across 79 designs; 219 production runs; safety reorder status), quick breakdown pills by material family, direct navigation buttons to Spool Catalog and Product Grid.
   - **Known Limitations:** Does not yet persist purchase order (PO) receipt batches, warehouse bin locations, or physical cycle count logs in a dedicated database table.

5. **Print Log (`prints` / `vPrints`)**
   - **Operational Purpose:** Chronological production execution log synchronized from Bambu Lab 3D printers.
   - **Implementation Status:** Fully Implemented.
   - **Persistence:** Persisted in `ledger_collections` under `collection_name = 'prints'`. Currently holds **220 historical print records**.
   - **Key Features:** Displays Print Date, Model thumbnail, Job Title, Status pill (`Success`, `Printing`, `Canceled`, `Failed`), AMS filament slot mapping (`A1`–`A4`, `Ext` with color swatches and weight in grams), Printer identifier (`3DP-22E-489 (P2S)`), Build Plate (`Textured PEI Plate`), Actual print duration (hours), and Consumed grams. Status filtering, search, pagination, and Inspect/Edit/Delete modals.
   - **Known Limitations:** In-progress print telemetry is polled via the cloud task endpoint; real-time second-by-second extruder temperatures and live webcam streams are not integrated.

6. **Cost Calculator (`calc` / `vCalc`)**
   - **Operational Purpose:** Slicer manufacturing cost estimator and pricing recommendation engine.
   - **Implementation Status:** Fully Implemented.
   - **Persistence:** Product pricing can be saved directly back into `ledger_collections` (`products`).
   - **Key Features:** Slicer parameter inputs (filament grams, print minutes, hands-on prep time, packaging extras, electricity consumption kW & tariff, machine wear rate, failure allowance %). Live calculation of True Unit Cost, Agent Wholesale Price (+60%), and Direct Retail Price (+120%) with gross margins.
   - **Known Limitations:** Single-part estimation only; does not calculate multi-part assembly bill-of-materials (BOM) trees.

### 3.3 Customers & Sales Section
7. **Customers (`customers` / `vCustomers`)**
   - **Operational Purpose:** Client directory and commercial relationship overview.
   - **Implementation Status:** Partially Implemented (Derived from Billing Ledger).
   - **Persistence:** Dynamically aggregated on-the-fly from `S.invoices`.
   - **Key Features:** Client directory KPIs, cumulative sales revenue, average customer value, compliance rating, client registry table with total invoice counts, lifetime spend, and links to KYC Profile and `+ Invoice`.
   - **Known Limitations:** Lacks a standalone `customers` table; editing customer addresses or phone numbers requires updating individual invoice records.

8. **Orders (`orders` / `vOrders`)**
   - **Operational Purpose:** Production queue tracking and sales order fulfillment pipeline.
   - **Implementation Status:** Partially Implemented (Composite View).
   - **Persistence:** Synthesized dynamically from `S.prints` (production status) and `S.invoices` (billing status).
   - **Key Features:** Active queue counter, completed order volume, dispatched fulfillment records with status pills and quick links to inspect print logs.
   - **Known Limitations:** No dedicated multi-stage order lifecycle state machine (e.g., `Draft -> Paid -> In-Queue -> Printing -> Post-Processing -> Shipped`).

9. **Customer KYC (`kyc` / `vKyc`)**
   - **Operational Purpose:** Regulatory compliance registry for UAE corporate clients and trade licenses.
   - **Implementation Status:** Partially Implemented (Compliance Registry Shell).
   - **Persistence:** Derived from customer identities; demo/compliance records.
   - **Key Features:** Entity classification (B2B Corporate vs Individual), compliance tier status (`Tier 2 Verified`), document registry (Emirates ID, Trade License, TRN), bidirectional links to Customer directory.
   - **Known Limitations:** Document file attachments (PDF trade licenses or ID scans) cannot be uploaded to object storage yet.

10. **Quotations (`quotes` / `vQuotes`)**
    - **Operational Purpose:** Pre-production job estimates and commercial pricing proposals.
    - **Implementation Status:** Partially Implemented (Proposal Pipeline View).
    - **Persistence:** Pipeline view with quick hooks to Cost Calculator and invoice creation modal.
    - **Key Features:** Tracks quotation numbers (`QT-2026-xxx`), client scope, estimated grams, print time, total proposal AED, and status (`Approved`, `Pending Client`, `Draft`).
    - **Known Limitations:** Quotations are not yet stored in a dedicated `quotes` database collection separate from invoices.

### 3.4 Finance Section
11. **Invoices & Payments (`invoices` / `vInv`)**
    - **Operational Purpose:** Commercial billing, payment reconciliation, and tax documentation.
    - **Implementation Status:** Fully Implemented.
    - **Persistence:** Persisted in `ledger_collections` under `collection_name = 'invoices'`. Currently holds **0 production records** (ready for active billing).
    - **Key Features:** Modal for drafting Sales and Quotation invoices, line-item table with automatic product autocomplete, unit price lookup, discounts, 5% UAE VAT computation, payment logging (Cash, Card, Bank Transfer, Stripe), PDF invoice generation via `jspdf` and `jspdf-autotable`.
    - **Known Limitations:** Sequential invoice numbering relies on client timestamp calculations rather than atomic database sequences.

12. **Expenses (`expenses` / `vExp`)**
    - **Operational Purpose:** Operational overhead and capital expense voucher tracking.
    - **Implementation Status:** Fully Implemented.
    - **Persistence:** Persisted in `ledger_collections` under `collection_name = 'expenses'`. Currently holds **0 production records**.
    - **Key Features:** Voucher entry modal with expense categories (Filament, Maintenance, Equipment, Electricity, Rent, Marketing, Packaging), payment methods, receipts, and Excel export.
    - **Known Limitations:** Recurring expenses (monthly rent, cloud subscriptions) require manual monthly entry.

13. **Financial Reports (`reports` / `vReports`)**
    - **Operational Purpose:** Executive accounting summary and tax audit export.
    - **Implementation Status:** Fully Implemented.
    - **Persistence:** Computed dynamically across `S.invoices`, `S.expenses`, and `S.prints`.
    - **Key Features:** Real-time metrics for Gross Billed Revenue, Total Operating Expenses, Consumed Filament COGS (calculated from actual print grams * AED 75/kg), Net Operating Margin, Master Excel Export, and PDF Financial Report.
    - **Known Limitations:** Financial year closing and balance sheets are not yet implemented.

### 3.5 Automation Section
14. **Reminders (`reminders` / `vReminders`)**
    - **Operational Purpose:** Preventive hardware maintenance and credit control alerting.
    - **Implementation Status:** Fully Implemented (Operational Rules Engine).
    - **Persistence:** In-memory session tracking.
    - **Key Features:** Automatic maintenance threshold reminders (0.4mm nozzle wear check every 300 printing hours, Textured PEI plate washing every 15 prints, commercial unpaid invoice payment balance follow-ups).
    - **Known Limitations:** "Mark Complete" acknowledgment is session-bound and does not persist completion logs to Postgres.

15. **Automation History (`automation-history` / `vAutomationHistory`)**
    - **Operational Purpose:** Cloud integration telemetry and background synchronization audit trail.
    - **Implementation Status:** Fully Implemented (System Monitor).
    - **Persistence:** Real-time runtime monitor.
    - **Key Features:** Event logging for Bambu Cloud Task Polling, Presigned S3 Thumbnail Backfill, Elapsed Print Duration Ingestion, and Neon Serverless sync.
    - **Known Limitations:** Displays predefined synchronization health checkpoints rather than writing append-only rows to an `audit_logs` table.

### 3.6 Studio Section
16. **Accounts & Team (`accounts` / `vAcc`)**
    - **Operational Purpose:** Monthly Profit & Loss (P&L) accounting overview.
    - **Implementation Status:** Fully Implemented.
    - **Persistence:** Computed dynamically by aggregating invoices, expenses, and production runs per calendar month.
    - **Key Features:** Monthly columns for Sales Ex VAT, COGS, Gross Profit, FOC/Sample Cost, Expenses, Net Profit, VAT Collected, Cash Received, and Filament Bought.
    - **Known Limitations:** Accrual accounting adjustments are not supported; revenue is recognized based on invoice issue date.

17. **Settings (`settings` / `vSettings`)**
    - **Operational Purpose:** Studio configuration, pricing parameters, and Bambu API credentials.
    - **Implementation Status:** Fully Implemented.
    - **Persistence:** Persisted in `ledger_collections` under `collection_name = 'settings'` (`record_id = 'app-settings'`).
    - **Key Features:** Business information (Name, Phone, Email, Address, TRN, Currency AED, VAT 5%), Studio Cost Rates (kW, kWh electricity tariff, Machine wear rate, Labor rate, Failure margin %, Agent and Direct retail markups), Storage location tags, and Bambu Cloud Personal Access Token.
    - **Known Limitations:** Database currently contains two records under settings (`app-settings` and legacy `meta_settings`).

---

## 4. API Inventory

All API endpoints are implemented using Next.js App Router Route Handlers (`src/app/api/...`):

| Endpoint | Method(s) | Auth / Guards | Request Payload | Response Schema | Purpose |
|---|---|---|---|---|---|
| `/api/health` | `GET` | None | None | `{ status, provider, branch, branchId, serverTime, database }` | Verifies Neon Postgres connectivity and reports active branch. |
| `/api/data` | `GET` | None | Query params: `collection`, `status=1` | If `status=1`: `{ status: summary, version, timestamp }`. If `collection`: `{ items: [] }`. If none: `{ collections: { products, filaments, ... } }`. | Primary data retrieval route for all studio collections. Supports lightweight version check for client polling. |
| `/api/data` | `POST` | None | `{ collection, id, data }` OR `{ syncAll: true, collections: {...} }` | `{ success: true, id, collection }` | Single-record upsert or batch collection synchronization to PostgreSQL `ledger_collections`. |
| `/api/data` | `DELETE` | None | `{ collection, id }` | `{ success: true, deleted: id, collection }` | Deletes a record by collection name and record ID. |
| `/api/bambu/sync` | `GET` / `POST` | None (reads token from DB or env) | Optional `{ action: 'backfill-photos' }` | Normal sync: `{ success, newTasksCount, totalChecked, syncedAt, message }`. Backfill: `{ success, backfilledCount, remainingMissingCount, totalTasksChecked }`. | Synchronizes historical and active print tasks from Bambu Cloud API; deduplicates products; converts thumbnails to Base64. |

---

## 5. Database Schema & Data Inventory

### 5.1 Physical Schema
The database runs on **Neon Lakebase Serverless PostgreSQL** (`neondb`). It features **exactly one table**:

```sql
CREATE TABLE IF NOT EXISTS public.ledger_collections (
    collection_name text NOT NULL,
    record_id text NOT NULL,
    data jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ledger_collections_pkey PRIMARY KEY (collection_name, record_id)
);
```

### 5.2 Collection Inventory & Verified Record Counts

A live read-only query of `public.ledger_collections` confirms the following actual state:

| `collection_name` | Record Count | Oldest Record | Newest Record | Typical `record_id` Format | Primary Data Stored in `data` (JSONB) |
|---|---|---|---|---|---|
| `products` | **79** | 2026-11-14 | 2026-11-17 | `prod_<16-char-md5>` | Name, SKU, category, grams, minutes, base64 photo, sellingPrice, totalPrinted, unitCost |
| `prints` | **220** | 2026-11-14 | 2026-11-17 | `bambu_<task_id>` | bambuTaskId, date, productId, qty, failed, grams, hours, statusLabel, printerName, nozzle, filamentsUsed |
| `filaments` | **34** | 2026-11-17 | 2026-11-17 | `spool_<n>_<mat>_<color>` | Name, brand, material, diameter, color hex, colorName, price (75 AED), weightG (1000g) |
| `filament_stock` | **34** | 2026-11-17 | 2026-11-17 | `spool_<n>_<mat>_<color>` | Mirrored stock record: costPerSpool, totalWeightG, spoolQty, purchasedAt |
| `settings` | **2** | 2026-11-14 | 2026-11-16 | `app-settings`, `meta_settings` | bizName, currency, vatPct, cost rates, masked/encrypted bambuToken |
| `invoices` | **0** | — | — | `inv_<timestamp>` | Ready for live commercial billing |
| `expenses` | **0** | — | — | `exp_<timestamp>` | Ready for live expense logging |

### 5.3 Relationships Between Records
- **`prints.data.productId` -> `products.data.id`:** Foreign key relationship linking each print job back to its unique product model design.
- **`products.data.totalPrinted` <- `prints.data.qty`:** Aggregated count maintained via SQL trigger/update in `/api/bambu/sync`.
- **`invoices.data.lines[].productId` -> `products.data.id`:** Invoice line items link to products for automatic pricing and description population.

---

## 6. Bambu Lab Integration Architecture

### 6.1 Authentication & Credentials
- **Service Target:** Official Bambu Lab Cloud User Service (`https://api.bambulab.com/v1/user-service/my/tasks`).
- **Token Resolution:** The integration checks `ledger_collections` (`collection_name = 'settings'`, field `bambuToken`). If not found, it falls back to `process.env.BAMBU_TOKEN`.
- **Security Guard:** `GET /api/data` automatically masks the token as `••••••••` to prevent exposing it in browser developer tools or network payloads.

### 6.2 Task Ingestion & Deduplication
- **Pagination & Limit:** Fetches recent tasks with `limit=20` (or `limit=100` during photo backfill).
- **Calibration Filtering:** Tasks matching `calib`, `bed_level`, `flow_calib`, `temp_tower`, or `calibration` in their title are automatically excluded to keep the production ledger clean.
- **Title Sanitization:** `cleanModelTitle()` strips file extensions (`.gcode.3mf`, `.3mf`, `.gcode`) and print metadata tags (e.g. `(print-in-place)`).
- **Product ID Hashing:** Generates deterministic product IDs using `prod_` + `MD5(cleaned_title.toLowerCase()).slice(0, 16)`. If two print tasks print the same model file weeks apart, they correctly map to the exact same product record.

### 6.3 Thumbnail Handling & Base64 Ingestion
- **Presigned URL Expiry Problem:** Bambu Cloud provides temporary AWS S3 presigned URLs for task covers (`task.cover`) that expire within hours.
- **Architectural Solution:** During synchronization, `downloadImageAsBase64()` fetches the remote image buffer, infers the MIME type (`image/png`, `image/jpeg`, `image/webp`), and encodes it as a self-contained Base64 Data URL (`data:image/...;base64,...`) saved directly to `products.data.photo`.
- **Photo Recovery Action:** `/api/bambu/sync?action=backfill-photos` paginates historical tasks to recover missing photos for older products.

### 6.4 Telemetry & Status Mapping
- **Status Normalization:**
  - Status `2` / `finish` / `success` -> `statusLabel = 'Success'`, `qty = 1`
  - Status `3` / `cancel` / `canceled` -> `statusLabel = 'Canceled'`, `qty = 0`
  - Status `0` / `1` / `running` / `printing` -> `statusLabel = 'Printing'`, `qty = 0`
  - Status `4` / `failed` -> `statusLabel = 'Failed'`, `qty = 0`, `failed = 1`
- **Elapsed Print Time Calculation:** Prioritizes actual elapsed time `Math.round((endTime - startTime) / 3600)` over static slicer estimates (`costTime / 3600`).
- **Filament & AMS Mapping:** Parses `amsDetailMapping` into slot (`A1`–`A4`, `Ext`), material type (`PLA`, `PETG`, etc.), color hex code, and used weight in grams.

---

## 7. Current Security Posture

| Category | Status | Finding & Risk Assessment |
|---|---|---|
| **Authentication & Access Control** | **VULNERABLE** | **Zero Authentication:** The application has no user login, no sessions, no RBAC, and no middleware protecting `/api/data` or `/api/bambu/sync`. Anyone who can access the port or public URL can read, write, or delete the entire database. |
| **Bambu Token Protection** | **ACCEPTABLE (Basic)** | The token is masked as `••••••••` in GET responses, but the raw token is stored in plaintext JSONB inside `ledger_collections` and `.env.local`. |
| **SQL Injection** | **SECURE** | All database queries use tagged template literals (`sql`...``) from `@neondatabase/serverless`, ensuring parameterization for all dynamic values. |
| **Cross-Site Scripting (XSS)** | **MIXED** | `ledgerCore.js` uses an `esc()` function for user strings in HTML templates. However, rendering large HTML strings via `.innerHTML` across 8,000+ lines introduces residual risk if unescaped fields bypass the filter. |
| **Input Validation** | **VULNERABLE** | API route handlers parse `req.json()` directly without runtime schema validators (e.g., Zod). Malformed payloads could corrupt the JSONB structure. |
| **Denial of Service / Rate Limiting** | **VULNERABLE** | No rate limiting exists on `/api/bambu/sync` or `/api/data`. A malicious or malfunctioning client could flood requests to Neon or trigger Bambu API rate limit bans. |

---

## 8. Technical Debt Analysis

### 8.1 Monolithic Architecture & Code Bloat
- **`src/components/ledgerCore.js` (8,451 lines):** Contains global state management, event listeners, view rendering, calculations, modal lifecycles, and export routines in a single imperative file. This creates high maintenance overhead, makes isolated unit testing nearly impossible, and forces TypeScript checking to be disabled via `// @ts-nocheck`.
- **`src/app/ledger.css` (8,108 lines):** Monolithic stylesheet containing thousands of bespoke selectors, legacy prototype rules, and duplicated utility styles.

### 8.2 Database Pattern Limitations
- **Single-Table JSONB Document Store:** While flexible during rapid prototyping, storing all entities (`products`, `prints`, `filaments`, `invoices`, `expenses`, `settings`) in a single `(collection_name, record_id, data)` table prevents relational foreign key constraints, eliminates PostgreSQL native data validation, and prevents indexing on nested JSON fields without custom expressions.
- **Base64 Photo Bloat:** Storing full-resolution Base64 image strings inside `products.data.photo` bloats row sizes to 100KB–500KB each. Fetching `GET /api/data` transfers several megabytes of JSON data on every cold load.

### 8.3 Data Duplication & Redundancy
- **Dual Filament Collections:** `filaments` (34 rows) and `filament_stock` (34 rows) exist side-by-side with identical IDs.
- **Dual Settings Records:** `app-settings` and `meta_settings` both exist under collection `settings`.

### 8.4 Testing & Tooling Deficits
- **Lack of a Unified Test Runner:** 18 individual Playwright test scripts exist in `tests/`, but there is no `npm test` script in `package.json` and no automated CI/CD pipeline.
- **Unused Dependency:** `mqtt: ^5.16.1` is declared in `package.json` but never imported in production source code.

---

## 9. Existing Functionality That Must Be Preserved

During any future architectural refactoring or redesign, the following core capabilities must remain strictly intact:

1. **Bambu Lab Incremental Sync & Deduplication:** The MD5 title hashing algorithm (`cleanModelTitle` + 16-character MD5 hash) that pairs print jobs to unique product records without creating duplicate catalog entries.
2. **Offline Photo Preservation:** Product photos must continue to render reliably without depending on expired Bambu Cloud presigned S3 URLs.
3. **Exact 3D Filament Visuals:** The 34 exact color mappings, translucent PETG shaders, and 3D spool graphics in [FilamentSpool.tsx](file:///Users/subhamsantra/Desktop/Dashboard/3D%20PRINTING/src/components/FilamentSpool.tsx).
4. **Export Engines:** Direct client-side generation of Master Excel spreadsheets (`xlsx`) and formatted PDF commercial documents (`jspdf`).
5. **Costing & Pricing Logic:** The Slicer parameter calculator factoring electricity kW/kWh tariffs, machine wear, labor rates, and markup multipliers.
6. **Live Data Polling & Version Checking:** The lightweight `GET /api/data?status=1` polling loop that synchronizes UI state across browser tabs.

---

## 10. Recommendations for Future Development

### Phase 1: Security & Governance (Priority: High)
1. **Implement NextAuth / Neon Auth:** Add authentication and route guards to restrict dashboard access and protect API routes.
2. **Add Request Validation:** Introduce Zod schemas for all API payloads (`/api/data`, `/api/bambu/sync`) to guarantee payload integrity.
3. **Externalize Image Storage:** Migrate Base64 photos out of PostgreSQL JSONB into S3-compatible object storage (e.g., Neon Object Storage / Cloudflare R2 / AWS S3) and store public CDN URLs in `products.photo`.

### Phase 2: Architectural Modularization (Priority: High)
1. **Break Down `ledgerCore.js`:** Decompose the 8,451-line monolith into dedicated, typed React components using standard hooks (`useProducts`, `usePrints`, `useFilaments`).
2. **Adopt Normalized Database Tables:** Transition from the single `ledger_collections` JSONB table to dedicated, relational PostgreSQL tables (`products`, `prints`, `filaments`, `invoices`, `customers`, `expenses`).
3. **Clean Up Database Collections:** Consolidate `filament_stock` and `filaments` into a single canonical table; remove legacy `meta_settings`.

### Phase 3: Operational Maturation (Priority: Medium)
1. **Dedicated Customer & Order Persistence:** Upgrade `customers`, `orders`, and `kyc` from dynamically synthesized views into first-class persisted entities with real lifecycle workflows.
2. **Automate Test Pipeline:** Configure Playwright Test Runner (`playwright.config.ts`) and register `"test": "playwright test"` in `package.json`.
3. **Prune Unused Dependencies:** Remove `mqtt` from `package.json` if live socket streaming is not actively utilized.
