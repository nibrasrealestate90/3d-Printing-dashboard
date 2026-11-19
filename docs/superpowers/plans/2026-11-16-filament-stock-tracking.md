# Filament Purchased Stock & Cost Tracking (AED) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Filament Inventory to support purchased spool stock and cost tracking (AED) alongside live Bambu Cloud consumption tracking, with an interactive "+ Add Spool" modal, quick restock actions, remaining stock alerts (<250g), and automatic rate population in the Cost Calculator.

**Architecture:** 
- Separate manual purchases from automated printer telemetry by persisting purchased spools in `ledger_collections` (`collection_name = 'filament_stock'`) so `POST /api/bambu/sync` never overwrites manual inventory.
- Aggregate purchased stock in the client state alongside Bambu-synced print consumption, providing an accurate reconciliation of `Purchased - Used = Remaining`.
- Connect unit costs from purchased spools directly to the Cost Calculator and optionally log new purchases to the Expenses ledger.

**Tech Stack:** Next.js 16 (App Router), Neon PostgreSQL, React / Vanilla JS core (`ledgerCore.js`), CSS Tokens (`ledger.css`), Playwright MCP.

**Spec:** User request from 2026-11-16: Upgrade Filament Inventory to support purchased stock and cost tracking (AED) alongside Bambu Cloud consumption tracking.

## Global Constraints
- `collection_name = 'filament_stock'` in `ledger_collections` must be used for purchased spools to keep manual stock strictly isolated from Bambu Cloud sync.
- Default currency is `AED` (`cur()`).
- Default spool weight is `1000` g; default cost per spool is `75` AED (giving `75 AED/kg`).
- Remaining stock must visually flag amber/red warning badges when `< 250` g.
- All file links must use markdown links with `file://` scheme and file basenames as link text.

## Review Focus
1. Brand/material/color matching: Ensure spools added via "+ Add Spool" correctly aggregate with matching Bambu-synced consumption rows by material and color hex.
2. Negative remaining stock handling: When Bambu prints consume filament before a purchase is logged, display a clear "Deficit / Unlogged purchase" badge instead of breaking or crashing.
3. Quick restock atomicity: The "+1 Spool" button must immediately increment stock and save to `filament_stock` without page refresh.
4. Token & secrets safety: Ensure settings and sensitive tokens remain untouched during data collection roundtrips.
5. Expenses linkage: When a spool is purchased with "Record in Expenses" enabled, the expense amount and description must match the spool cost and details.

---

### Task 1: Backend Persistence for `filament_stock` in `src/app/api/data/route.ts`

**Files:**
- Modify: `src/app/api/data/route.ts:85-125`
- Test: `tests/test_filament_stock_api.mjs`

**Interfaces:**
- Consumes: Neon `sql` client, `ledger_collections` table.
- Produces: `collections.filament_stock: any[]` in `GET /api/data`.

- [ ] **Step 1: Write the failing test**
Create `tests/test_filament_stock_api.mjs` to test inserting, fetching, and deleting a `filament_stock` record against `http://localhost:3000/api/data`.

- [ ] **Step 2: Run test to verify it fails**
Run: `node tests/test_filament_stock_api.mjs`
Expected: FAIL (missing `filament_stock` in `GET /api/data` collections).

- [ ] **Step 3: Update `src/app/api/data/route.ts`**
Add `filament_stock: []` to `grouped` in `GET /api/data` so all records where `collection_name = 'filament_stock'` are returned in the JSON payload.

- [ ] **Step 4: Run test to verify it passes**
Run: `node tests/test_filament_stock_api.mjs`
Expected: PASS.

- [ ] **Step 5: Verify build**
Run: `npm run build`
Expected: Clean build with 0 TypeScript/Turbopack errors.

---

### Task 2: Client State & Stock Calculations in `src/components/ledgerCore.js`

**Files:**
- Modify: `src/components/ledgerCore.js:9-30`, `src/components/ledgerCore.js:465-515`

**Interfaces:**
- Consumes: `S.filament_stock`, `S.filaments`, `S.prints`.
- Produces: `filPurchasedStock(f)`, `filRemainingGrams(f)`, `filUnitCostKg(f)`, `filStockValue(f)`.

- [ ] **Step 1: Register `filament_stock` in state and storage**
Add `"filament_stock"` to `COLLS` array, initialize `S.filament_stock = []`, and handle localStorage loading and saving.

- [ ] **Step 2: Implement stock calculation helpers**
Add helper functions:
- `filPurchasedStock(f)`: returns `{ spools: number, grams: number, totalCost: number, avgCostKg: number }` matching `f.material` and `f.color` (or ID).
- `filRemainingGrams(f)`: returns `purchasedGrams - usedGrams`.
- `filUnitCostKg(f)`: returns purchased cost per kg or defaults to 75 AED/kg.
- `filStockValue(f)`: returns `(remainingGrams / 1000) * unitCostKg`.

- [ ] **Step 3: Verify calculation logic with node test**
Run a node snippet verifying calculations for 0 purchased, 1 spool purchased, multiple spools, and depleted scenarios.

---

### Task 3: Modal UI for `+ Add Spool` and Quick Restock in `src/components/ledgerCore.js`

**Files:**
- Modify: `src/components/ledgerCore.js:3125-3250`, `src/components/ledgerCore.js:4120-4250`

**Interfaces:**
- Consumes: `openAddSpoolModal(spoolObj)`, `save("filament_stock", id, data)`.
- Produces: Modal form rendering, quick restock click handler `data-restock-fil`.

- [ ] **Step 1: Implement `openAddSpoolModal(spoolObj)`**
Construct modal with:
- Brand select/input (`eSUN`, `Creality`, `Bambu Lab`, `YLH`, etc.)
- Material select (`PLA`, `PLA+`, `Hyper PLA`, `PLA+ Silk`, `PETG`, `CR-PETG`, `ABS`, `TPU`)
- Color Name & Hex Swatch (using `FILAMENT_SWATCHES` and `colorPickerHtml`)
- Spool Weight (default 1000g)
- Quantity (default 1)
- Cost per Spool (default 75 AED)
- Storage Location (`A1 • P2S`, `A2 • P2S`, `A3 • P2S`, `A4 • P2S`, `Ext Spool`, `Shelf Storage`)
- "Record in Expenses" checkbox (default checked, logs to `expenses` under `Filament purchase`).

- [ ] **Step 2: Implement submission handler**
Save purchased spool to `filament_stock` via `save("filament_stock", spoolId, spoolData)` and optionally save to `expenses`.

- [ ] **Step 3: Implement `+1 Spool` quick-restock handler**
In the global click listener, handle `data-restock-fil="${f.id}"` to automatically insert 1 new spool (1000g @ unit cost) into `filament_stock` and show a success toast.

---

### Task 4: Upgrade Filament Inventory Table in `src/components/ledgerCore.js`

**Files:**
- Modify: `src/components/ledgerCore.js:2285-2385`

**Interfaces:**
- Consumes: `vFil()`, `filPurchasedStock`, `filRemainingGrams`, `filUnitCostKg`.
- Produces: Upgraded table with 7 columns: `FILAMENT`, `LOCATION`, `PURCHASED`, `USED`, `REMAINING`, `UNIT COST / VALUE`, `ACTIONS`.

- [ ] **Step 1: Add `+ Add Spool` button to toolbar**
In `vFil()`, place a primary button `<button class="btn pri btn-pill-primary" id="addSpoolBtn">+ Add Spool</button>` next to the search input.

- [ ] **Step 2: Render upgraded table columns**
- `FILAMENT`: Brand, Material, Color Swatch & Color Name.
- `LOCATION`: AMS Slot badge or Shelf badge.
- `PURCHASED`: Total spools and kg (e.g. `2 spools · 2.00 kg`).
- `USED`: Synced from Bambu Cloud (e.g. `493 g`).
- `REMAINING`: Remaining grams/kg with status pill (green if `>500g`, amber if `250-500g`, red alert if `<250g`, or deficit alert if unlogged).
- `UNIT COST / VALUE`: e.g. `75 AED/kg · 150 AED total`.
- `ACTIONS`: `+1 Spool` quick restock button, Edit, Delete.

- [ ] **Step 3: Verify styling in light and dark mode**
Ensure CSS styles in `src/app/ledger.css` match SaaS quality standards.

---

### Task 5: Connect to Cost Calculator & Expenses in `src/components/ledgerCore.js`

**Files:**
- Modify: `src/components/ledgerCore.js:1845-1875`

**Interfaces:**
- Consumes: `calc.filamentId`, `filUnitCostKg`.
- Produces: Auto-filled `c_costKg` value (75 AED/kg) in Cost Calculator.

- [ ] **Step 1: Update Cost Calculator filament selection**
Ensure `filCostKg` returns the authoritative purchased cost per kg from `filament_stock` (or default 75 AED/kg).

- [ ] **Step 2: Auto-populate input on filament change**
When user selects a filament in `c_fil`, auto-fill `c_costKg` with `75.00` (or the spool's specific cost per kg).

---

### Task 6: End-to-End Verification with Playwright

**Files:**
- Test: Playwright browser verification

- [ ] **Step 1: Verify `npm run build`**
Confirm zero build errors.

- [ ] **Step 2: Browser Verification**
- Navigate to Filament Inventory at `http://localhost:3000`.
- Verify `+ Add Spool` button is present and opens the modal.
- Add an `eSUN PLA+ Purple` spool (1000g, 1 spool, 75 AED, `A1 • P2S`, recorded to expenses).
- Verify table displays: Purchased `1 spool · 1.00 kg`, Used `493 g`, Remaining `507 g`, Unit Cost `75 AED/kg · 75 AED total`.
- Click `+1 Spool` and verify Purchased becomes `2 spools · 2.00 kg` and Remaining becomes `1.51 kg`.
- Check Cost Calculator auto-fills `75.00 AED/kg`.
- Take verification screenshots and save to artifacts directory.
