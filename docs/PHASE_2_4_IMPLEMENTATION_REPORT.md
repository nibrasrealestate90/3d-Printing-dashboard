# PHASE 2.4 — BUSINESS DATA FOUNDATION & STOREFRONT API IMPLEMENTATION REPORT

**Author:** Senior Full-Stack Engineer & Database Architect  
**Project:** `print-studio-app` (Dubai Precision 3D Printing & Manufacturing Studio)  
**Execution Date:** November 18, 2026  
**Implementation Scope:** Strictly Phase 2.4 ONLY  
**Cumulative Test Status:** **134 / 134 PASSED (100.0%)**

---

## 1. Executive Summary

Phase 2.4 establishes the additive commercial database foundation and public storefront APIs for `print-studio-app`. This phase transitions the application from a pure internal factory ledger into a dual-engine architecture:
1. **Engine 1 (Manufacturing Document Engine):** Preserved 100.0% with zero modifications. `public.ledger_collections` remains untouched at exactly 371 baseline records with identical canonical SHA-256 digest `d39c74285d77c00a33500f02be7595c9e495b999e2956879f2dd134e6232ef62`.
2. **Engine 2 (Commercial Relational Engine):** Purely additive PostgreSQL schema provisioning dedicated tables for customer enquiries (`public.store_enquiries`), custom quote requests (`public.store_quote_requests`), and private CAD attachments (`public.store_quote_files`), managed via the transactional migration engine with advisory lock `742910`.
3. **Public Storefront APIs:** Public, rate-limited, and rigorously sanitized endpoints for catalog discovery (`/api/store/products`), customer inquiries (`/api/store/enquiries`), pre-signed CAD uploads (`/api/store/quotes/presign`), and custom quote requests (`/api/store/quotes`).

---

## 2. Resolution of Phase 2.3 Review Findings

All three remediation items identified in the Phase 2.3 Independent Review have been resolved and verified with dedicated regression tests.

### 2.1 Documentation Correction: `/api/data` Authorization Scope
- **Finding:** `docs/PHASE_2_3_IMPLEMENTATION_REPORT.md` inaccurately characterized `/api/data` as a dual-gate endpoint accepting M2M tokens.
- **Remediation:** Corrected the route matrix in `docs/PHASE_2_3_IMPLEMENTATION_REPORT.md` (line 44) to explicitly state:
  `Administrator Session Cookie Only (Strictly No M2M)`.
- **Reality:** In `src/app/api/data/route.ts`, all operations (`GET`, `POST`, `DELETE`) enforce `requireAdminSession(req)`. M2M bearer authentication is strictly isolated to `/api/bambu/sync` for automated cloud synchronization.

### 2.2 Secure Post-Login Deep-Linking in `AdminLoginForm.tsx`
- **Finding:** `AdminLoginForm.tsx` hardcoded `router.push("/")` upon successful authentication, ignoring the `?redirect=` search parameter and lacking open-redirect validation.
- **Remediation:**
  1. Created dedicated security validator `src/lib/safe-redirect.ts` (`getSafeRedirectUrl`).
  2. Enforces strict whitelist rules:
     - Only safe relative paths within the trusted administrator application (`/admin`, `/admin/*`, `/`).
     - Rejects absolute URLs (`https://`, `http://`, `javascript:`, `data:`).
     - Rejects protocol-relative URLs (`//`).
     - Rejects backslashes (`\` and `%5c`) and Windows file paths.
     - Rejects path traversal attempts (`..` and `%2e%2e`).
     - Rejects redirect loops back to sign-in forms (`/admin/login`, `/login`).
     - Rejects ASCII control characters (0x00–0x1F, 0x7F) and malformed URI encodings.
     - Safely defaults to `/admin`.
  3. Integrated `useSearchParams().get('redirect')` into `AdminLoginForm.tsx` for both initial form submission and active-session entry buttons.
  4. Wrapped `AdminLoginForm` in a `<Suspense>` boundary in `src/app/admin/login/page.tsx` conforming to Next.js 16 App Router streaming standards.

### 2.3 Exact Pathname Comparison in `src/app/admin/layout.tsx`
- **Finding:** `src/app/admin/layout.tsx` used `pathname.startsWith('/admin/login')`, which could theoretically permit sub-path bypasses if nested routes existed.
- **Remediation:** Replaced with strict exact pathname comparison:
  ```tsx
  // 1. Bypass authentication check strictly for administrative login page (exact match)
  if (pathname === '/admin/login' || pathname === '/admin/login/') {
    return <>{children}</>;
  }
  ```
- **Canonical Behavior:** Requests to `/admin/login/` are canonically redirected via HTTP 308 by Next.js to `/admin/login`, safely landing on the exact match without exposing child routes.

---

## 3. Commercial Database Foundation

### 3.1 Migration Architecture (`migrations/0002_phase2_storefront_foundation.sql`)

The migration executes within an atomic PostgreSQL transaction under transaction-scoped advisory lock `742910` via `scripts/migrate.ts`.

```sql
CREATE SEQUENCE IF NOT EXISTS public.store_rfq_seq START WITH 1001;

CREATE TABLE IF NOT EXISTS public.store_enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name VARCHAR(150) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    product_id VARCHAR(64),
    status VARCHAR(30) NOT NULL DEFAULT 'NEW'
        CHECK (status IN ('NEW', 'IN_REVIEW', 'RESPONDED', 'ARCHIVED')),
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_enquiries_created_at ON public.store_enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_enquiries_status ON public.store_enquiries(status);
CREATE INDEX IF NOT EXISTS idx_store_enquiries_email ON public.store_enquiries(customer_email);

CREATE TABLE IF NOT EXISTS public.store_quote_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_reference VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(150) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    project_title VARCHAR(200) NOT NULL,
    project_description TEXT NOT NULL,
    material_preference VARCHAR(100),
    color_preference VARCHAR(100),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    target_deadline DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW'
        CHECK (status IN ('PENDING_REVIEW', 'ESTIMATING', 'QUOTED', 'ACCEPTED', 'DECLINED', 'ARCHIVED')),
    currency VARCHAR(10) NOT NULL DEFAULT 'AED',
    estimated_amount NUMERIC(10,2),
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_quote_requests_rfq ON public.store_quote_requests(rfq_reference);
CREATE INDEX IF NOT EXISTS idx_store_quote_requests_created_at ON public.store_quote_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_quote_requests_status ON public.store_quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_store_quote_requests_email ON public.store_quote_requests(customer_email);

CREATE TABLE IF NOT EXISTS public.store_quote_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_request_id UUID REFERENCES public.store_quote_requests(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    mime_type VARCHAR(100) NOT NULL,
    file_extension VARCHAR(10) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    checksum_sha256 VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_quote_files_quote_id ON public.store_quote_files(quote_request_id);
CREATE INDEX IF NOT EXISTS idx_store_quote_files_storage_key ON public.store_quote_files(storage_key);
```

### 3.2 Database Migration Runner Execution Log

```
--- Starting Hardened Migration Runner ---
Acquired transaction-scoped advisory lock (742910).
Pre-migration ledger_collections count: 371
Migration 0001_phase1_auth_foundation.sql already applied and checksum verified (792aebcaa3...). Skipping.
Applying migration within transaction: 0002_phase2_storefront_foundation.sql...
Applied 0002_phase2_storefront_foundation.sql in 1078ms.
Admin user admin@printstudio.ae already exists.
Post-migration ledger_collections count: 371
INTEGRITY VERIFIED: ledger_collections count remains exactly 371.
Transaction committed successfully.
Current public tables: [
  'audit_logs',
  'ledger_collections',
  'rate_limits',
  'schema_migrations',
  'sessions',
  'store_enquiries',
  'store_quote_files',
  'store_quote_requests',
  'users'
]
--- Migration Finished Successfully ---
```

---

## 4. Public Storefront API Specifications

### 4.1 Product Catalog (`GET /api/store/products` & `GET /api/store/products/[slug]`)
- **Hostnames:** `www.<domain>`, `www.lvh.me`, `app.<domain>` (for administrative catalog previews).
- **Access:** Public, Read-Only.
- **Cache-Control:** `public, s-maxage=60, stale-while-revalidate=300`.
- **Query Filters:**
  - `category`: Filters published items by category (case-insensitive).
  - `limit`: Bounded integer (default 24, max 100).
- **Publishing Boundary:**
  ```sql
  WHERE collection_name = 'products'
    AND (
      (data->>'published' = 'true') OR
      (jsonb_typeof(data->'published') = 'boolean' AND (data->'published')::boolean = true)
    )
  ```
- **Strict Data Redaction (`sanitizeProductForStorefront`):**
  - **Whitelisted fields:** `id`, `slug`, `sku`, `name`, `description`, `category`, `sellingPrice`, `currency`, `weightGrams`, `imageUrl`, `isAvailable`, `updatedAt`.
  - **Redacted fields:** `unitCost`, `filamentCost`, `productionCost`, `materialCost`, `electricityCost`, `markup`, `markupAmount`, `agentPrice`, `minStock`, `openingStock`, `totalPrinted`, `minutes`, `bambuPlateId`, `printerId`, internal notes.
  - **Thumbnail Redaction:** Base64 Bambu camera frame captures (`data:image/*`) are stripped to prevent payload bloat and proprietary factory exposure. Only external CDN / HTTP URLs are permitted.

### 4.2 Customer Enquiries (`POST /api/store/enquiries`)
- **Access:** Public.
- **Abuse Prevention:** Sliding window IP rate limiter (5 requests / hour / IP). Exceeding requests receive HTTP 429 with `Retry-After`.
- **Validation:** Bounded lengths (name <= 150, email <= 255, subject <= 200, message <= 5000), valid email regex.
- **Persistence:** Persisted in `public.store_enquiries` with initial status `'NEW'` and client IP recorded for audit tracking.
- **Response:** `HTTP 201 Created` with `{ success: true, enquiryId: "uuid", message: "..." }`.

### 4.3 CAD Upload Pre-Signing (`POST /api/store/quotes/presign`)
- **Access:** Public.
- **Abuse Prevention:** Sliding window IP rate limiter (5 requests / hour / IP).
- **CAD File Validation:**
  - **Allowed Extensions:** Strictly `.step`, `.stp`, `.stl`, `.3mf`, `.obj`. (All executables, archives, and scripts rejected).
  - **Size Limit:** Max **50 MB** (`52,428,800` bytes).
- **Storage Prerequisite & Honest Unconfigured State:**
  - When Cloudflare R2 credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) are present, generates AWS SigV4 pre-signed PUT URL valid for 600 seconds (10 minutes).
  - When R2 credentials are not configured on the environment, returns **HTTP 503 Service Unavailable** with `storageConfigured: false` and a list of required prerequisites without faking upload tokens or silent failure.

### 4.4 Custom Quote Requests (`POST /api/store/quotes`)
- **Access:** Public.
- **Abuse Prevention:** Sliding window IP rate limiter (3 requests / hour / IP).
- **Atomic Sequence Reference:** Query `SELECT nextval('public.store_rfq_seq')` to format human-readable reference `RFQ-YYYY-XXXX` (e.g. `RFQ-2026-1001`).
- **Persistence:**
  - Header record inserted into `public.store_quote_requests` with status `'PENDING_REVIEW'` and currency `'AED'`.
  - If CAD file metadata is provided (`storageKey`, `fileName`, `fileSizeBytes`), an associated child row is atomically inserted into `public.store_quote_files` linked by foreign key.
- **Response:** `HTTP 201 Created` with `{ success: true, rfqReference: "RFQ-2026-1001", quoteRequestId: "uuid", message: "..." }`.

---

## 5. Verification Test Results Matrix

### 5.1 Phase 2.4 Dedicated Verification Suite (`tests/verify-phase2-4-store.ts`)

| # | Test Name | Category | Status | Details |
|---|---|---|:---:|---|
| 1 | Post-Login Deep-Linking Safe Admin Paths | Security Remediation | **PASS** | Relative `/admin/*` paths accepted; empty defaults to `/admin` |
| 2 | Post-Login Open Redirect & Loop Rejection | Security Remediation | **PASS** | All 15 malicious/evasive vectors resolved strictly to `/admin` |
| 3 | AdminLayout Exact Match on `/admin/login` | Security Remediation | **PASS** | Exact `/admin/login`: 200, slash: 308 -> 200, nested: 404 |
| 4 | Phase 2.3 Report Accuracy Verification | Documentation | **PASS** | `/api/data` accurately documented as Admin Session Cookie Only |
| 5 | Transactional Migration 0002 Tracking | Database Schema | **PASS** | Recorded in `public.schema_migrations` with execution time |
| 6 | Relational Tables Exist in PostgreSQL | Database Schema | **PASS** | `store_enquiries`, `store_quote_requests`, `store_quote_files` present |
| 7 | Dedicated Query Optimization Indexes | Database Schema | **PASS** | 6 performance and foreign-key indexes verified |
| 8 | GET `/api/store/products` Catalog & Cache | Storefront API | **PASS** | HTTP 200, `success: true`, Cache-Control `s-maxage=60` |
| 9 | Product Whitelist Data Redaction | Security Sanitization | **PASS** | All 12 cost/margin fields redacted; base64 photo stripped |
| 10 | GET `/api/store/products/[slug]` 404 Fallback | Storefront API | **PASS** | Non-existent slug returns clean HTTP 404 |
| 11 | POST `/api/store/enquiries` Persistence | Storefront API | **PASS** | HTTP 201, UUID returned, row in `store_enquiries` with status `NEW` |
| 12 | Customer Enquiry Validation Rejections | Storefront API | **PASS** | HTTP 400 with field-level errors for invalid inputs |
| 13 | CAD Extension Whitelist Enforcement | Security Validation | **PASS** | `.step`, `.stp`, `.stl`, `.3mf`, `.obj` pass; `.exe`, `.zip` rejected |
| 14 | CAD File Size Limit Boundary (50 MB) | Security Validation | **PASS** | 50MB accepted; 50MB+1 byte and 0 bytes rejected |
| 15 | Safe Honest Unconfigured State for R2 | Cloud Security | **PASS** | HTTP 503 `STORAGE_UNAVAILABLE` without faking upload |
| 16 | AWS SigV4 Presigner URL Signature | Cloud Security | **PASS** | Generates valid canonical S3/R2 PUT URL with SigV4 params |
| 17 | POST `/api/store/quotes` RFQ Sequence | Storefront API | **PASS** | HTTP 201, `RFQ-YYYY-XXXX` generated, row in `store_quote_requests` |
| 18 | CAD File Association Foreign Key Linkage | Storefront API | **PASS** | Child row in `store_quote_files` verified with foreign key |
| 19 | Quote Request Rate Limiting Defense | Rate Limiting | **PASS** | Exceeding 3 submissions triggers HTTP 429 & `Retry-After` |
| 20 | Database Baseline Count & Digest Intact | Preservation | **PASS** | Exactly 371 rows, SHA-256: `d39c74285d77c00a33500f02be7595c9e495b999e2956879f2dd134e6232ef62` |

**Suite Result: 20 / 20 PASSED (100.0%)**

---

### 5.2 Cumulative Regression Test Battery (All 8 Suites)

| Suite File | Scope / Focus | Tests | Passed | Pass Rate |
|---|---|:---:|:---:|:---:|
| `tests/verify-phase1-auth.ts` | Phase 1 Security, Sessions, Rate Limits, Audit | 22 | 22 | 100.0% |
| `tests/verify-phase1-hardened.ts` | Phase 1.2 IP Extraction, CSRF Protocol, Cleanup | 16 | 16 | 100.0% |
| `tests/verify-phase1-2-1.ts` | Phase 1.2.1 Progressive Delay, Proxies, No-DoS | 19 | 19 | 100.0% |
| `tests/verify-phase1-3.ts` | Phase 1.3 UI Integration, Mobile, Keyboard, Storage | 20 | 20 | 100.0% |
| `tests/verify-phase2-proxy.ts` | Phase 2.1 Multi-Host Routing, Apex, Host Isolation | 15 | 15 | 100.0% |
| `tests/verify-phase2-auth-api.ts` | Phase 2.2.1 Dual-Gate M2M & Sync Hardening | 11 | 11 | 100.0% |
| `tests/verify-phase2-3-workspace.ts` | Phase 2.3 Workspace Layout & Route Protection | 11 | 11 | 100.0% |
| `tests/verify-phase2-4-store.ts` | Phase 2.4 Storefront Foundation & APIs | 20 | 20 | 100.0% |
| **GRAND TOTAL** | **Full System Cumulative Regression Battery** | **134** | **134** | **100.0%** |

---

## 6. Manufacturing Engine Invariants & Preservation Guarantees

1. **`src/components/ledgerCore.js` Unmodified:**
   - Modified by **0 bytes**.
   - Continuous 4-second polling (`GET /api/data?status=1`) and live MQTT feeds remain completely intact.
2. **Database Baseline Integrity:**
   - Pre-migration record count: `371`
   - Post-migration record count: `371`
   - Canonical SHA-256 Digest: `d39c74285d77c00a33500f02be7595c9e495b999e2956879f2dd134e6232ef62` (Verified 100.0% identical).
3. **Dual-Gate API Protection:**
   - `/api/data` requires active administrator session cookie; M2M access is denied.
   - `/api/bambu/sync` permits administrator session OR scoped M2M bearer token. Live sync execution is never triggered during testing; isolated mock sinks on port 3999 are used for SSRF testing.

---

## 7. Stop Gate & Readiness for Review

Phase 2.4 implementation is complete. All code changes adhere strictly to the approved scope.

- **No modifications** were made outside Phase 2.4.
- **No Git commits, pushes, or deployments** were executed.
- Work is now halted for independent security and architecture review before proceeding to Phase 2.5.
