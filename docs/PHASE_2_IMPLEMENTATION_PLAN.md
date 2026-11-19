# PHASE 2.0 IMPLEMENTATION PLAN & VERIFICATION RUNBOOK (REVISED v2.0.1)
**Step-by-Step Execution Sequence, Test Protocols & Zero-Downtime Rollback Strategy**

- **Document Identifier:** `docs/PHASE_2_IMPLEMENTATION_PLAN.md`
- **System Name:** Print Studio Ledger (`print-studio-app`)
- **Version:** 2.0.1-CORRECTED
- **Date:** 2026-11-18
- **Classification:** Principal Software Engineering Specification (READ-ONLY)
- **Status:** **APPROVED FOR PHASE 2.1 PENDING USER AUTHORIZATION**

---

## 1. Executive Implementation Roadmap

To eliminate risk accumulation and ensure absolute stability of the existing manufacturing system, Phase 2 is partitioned into four discrete, sequential sub-phases. **Each sub-phase must pass automated verification suites and maintain all 77 prior regression tests before proceeding to the next step:**

```
+─────────────────────────────────────────────────────────────────────────────────────────────────+
| PHASE 2.1: NEXT.JS 16 PROXY & MULTI-HOST ROUTING (HOSTNAME ROUTING ONLY)                        |
|                                                                                                 |
| • Implement src/proxy.ts in Node.js runtime (Next.js 16 default; no edge runtime).              |
| • Exact allowlisted Hostname matching (app.<domain>, www.<domain>, lvh.me:3000).                |
| • Implement canonical apex 308 redirects and default-deny unknown host handling.                |
| • Configure safe internal rewrites to /admin and /store skeletons without route collisions.     |
| • ZERO auth changes, ZERO database changes, ZERO API modifications in this sub-phase.          |
| • Automated Suite: tests/verify-phase2-proxy.ts (Target: 15 passing tests)                       |
+─────────────────────────────────────────────────────────────────────────────────────────────────+
                                                 │
                                                 ▼
+─────────────────────────────────────────────────────────────────────────────────────────────────+
| PHASE 2.2: SERVER-SIDE ADMINISTRATOR PROTECTION & MANUFACTURING API AUTH                        |
|                                                                                                 |
| • Authoritative Server Component layout session guard in src/app/admin/layout.tsx.              |
| • Protect /api/data and /api/bambu/sync with Dual-Gate Auth (Admin Session + M2M Bearer).       |
| • Timing-safe M2M secret evaluation, rotation, scopes, and audit logging.                       |
| • Preserve ledgerCore.js (Zero code changes; browser cookie transport maintains polling).      |
| • Automated Suite: tests/verify-phase2-guards.ts (Target: 18 passing tests)                      |
+─────────────────────────────────────────────────────────────────────────────────────────────────+
                                                 │
                                                 ▼
+─────────────────────────────────────────────────────────────────────────────────────────────────+
| PHASE 2.3: ADDITIVE STOREFRONT DATABASE MIGRATION & PUBLIC APIs                                 |
|                                                                                                 |
| • Apply additive DDL for store_enquiries, store_quote_requests, and store_quote_files.          |
| • Implement sanitized public endpoints under /api/store/* (Type-safe JSONB queries).           |
| • Version 1 Storefront UI: Strictly Enquiry-Only (NO cart, NO checkout, NO online payments).    |
| • Secure CAD upload pre-signing and private R2 storage integration.                             |
| • Automated Suite: tests/verify-phase2-store.ts (Target: 20 passing tests)                       |
+─────────────────────────────────────────────────────────────────────────────────────────────────+
                                                 │
                                                 ▼
+─────────────────────────────────────────────────────────────────────────────────────────────────+
| PHASE 2.4: INDEPENDENT SECURITY AUDIT, REGRESSION VERIFICATION & EVIDENCE GATE                  |
|                                                                                                 |
| • Run complete regression suite: 77 Phase 1 tests + 53 Phase 2 tests = 130 Total Tests (100%).  |
| • Cryptographically verify 371 rows & SHA-256 digest in public.ledger_collections.              |
| • Execute Playwright multi-subdomain browser test across app.lvh.me and www.lvh.me.             |
| • Generate docs/PHASE_2_INDEPENDENT_REVIEW.md and await formal Phase 3 authorization.           |
+─────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 2. Detailed Sub-Phase Breakdown

### Phase 2.1: Next.js 16 Proxy & Multi-Host Routing (Hostname Routing Only)

#### Objective
Establish high-performance ingress perimeter routing using Next.js 16 `src/proxy.ts` (executing in the Node.js runtime), resolving requests based on exact allowlisted `Host` headers.

#### Files to Create / Modify
- Create: `src/proxy.ts` (Next.js 16 Proxy implementation in Node.js runtime)
- Create: `src/app/admin/page.tsx` (Host administrative manufacturing workspace)
- Create: `src/app/store/page.tsx` (Host public storefront home skeleton)
- Create: `tests/verify-phase2-proxy.ts`

#### Strict Preservation Boundaries
- **ZERO AUTH CHANGES:** Do not add authentication guards to `/api/data` or `/api/bambu/sync` yet.
- **ZERO DATABASE CHANGES:** Do not execute any migrations or alter database records.
- **ZERO CLIENT CHANGES:** Do not modify `src/components/ledgerCore.js`.

#### Key Implementation Steps
1. Create `src/proxy.ts` exporting `export function proxy(request: NextRequest, event?: NextFetchEvent)`.
2. Extract `request.headers.get('host')` and strip port.
3. Implement static asset bypass matcher to skip `_next/static`, `_next/image`, and public media.
4. Match hostname against exact allowlists:
   - `ALLOWED_APEX_HOSTS`: Issue 308 permanent redirect to `https://www.${BASE_DOMAIN}`.
   - `ALLOWED_APP_HOSTS` (`app.<domain>`, `app.lvh.me`):
     - If path is `/`, rewrite internally to `/admin`.
     - If path starts with `/store/*`, redirect to `https://www.<domain>/store/*`.
     - Pass through `/admin/*`, `/login`, and `/api/*`.
   - `ALLOWED_STORE_HOSTS` (`www.<domain>`, `www.lvh.me`):
     - If path is `/`, rewrite internally to `/store`.
     - If path starts with `/products`, `/quote`, `/contact`, rewrite internally to `/store/*`.
     - If path starts with `/admin` or `/api/data` or `/api/bambu/*`, reject with HTTP 404.
   - Default-Deny: If host is unmapped, terminate with `HTTP 400 Bad Request`.

#### Acceptance & Verification Criteria
- Automated suite `tests/verify-phase2-proxy.ts` passes with 100% success (15 tests).
- Requesting `http://app.lvh.me:3000/` loads the Admin Workspace.
- Requesting `http://www.lvh.me:3000/` loads the Storefront skeleton.
- Requesting `http://www.lvh.me:3000/api/data` returns HTTP 404.
- Requesting `http://lvh.me:3000/` returns HTTP 308 redirect to `www.lvh.me:3000`.

---

### Phase 2.2: Server-Side Administrator Protection & Manufacturing API Authentication

#### Objective
Implement authoritative server-side session checks and wrap `/api/data` and `/api/bambu/sync` with Dual-Gate Authentication (Admin Session + M2M Bearer).

#### Files to Create / Modify
- Create: `src/app/admin/layout.tsx` (Authoritative Server Component session guard)
- Modify: `src/app/api/data/route.ts` (Add `requireAdminSession` and `validateM2MToken` gates)
- Modify: `src/app/api/bambu/sync/route.ts` (Add `requireAdminSession` and `validateM2MToken` gates)
- Modify: `src/lib/auth.ts` (Add timing-safe `validateM2MToken()` helper)
- Create: `tests/verify-phase2-guards.ts`

#### Strict Preservation Boundaries
- **ABSOLUTELY ZERO CHANGES TO `src/components/ledgerCore.js`:** The client-side dashboard in `ledgerCore.js` makes `fetch('/api/data')` and `fetch('/api/bambu/sync')` calls. Because these execute on the same origin (`app.<domain>`), the browser's credentials mechanism automatically attaches `__Host-admin_session`.
- Do NOT alter JSON formatting or response structures expected by `ledgerCore.js`.
- Do NOT break `status=1` polling logic.

#### Key Implementation Steps
1. In `src/app/admin/layout.tsx`, verify session validity before rendering Server Components:
   ```typescript
   import { cookies } from 'next/headers';
   import { redirect } from 'next/navigation';
   import { validateSession, SESSION_COOKIE_NAME } from '@/lib/auth';

   export default async function AdminLayout({ children }: { children: React.ReactNode }) {
     const cookieStore = await cookies();
     const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
     const auth = token ? await validateSession(token) : null;
     if (!auth) {
       redirect('/login?redirect=/admin');
     }
     return <div className="admin-workspace-layout">{children}</div>;
   }
   ```
2. Implement `validateM2MToken(req)` in `src/lib/auth.ts` using constant-time `crypto.timingSafeEqual()`.
3. In `src/app/api/data/route.ts` and `src/app/api/bambu/sync/route.ts`:
   ```typescript
   const isM2M = validateM2MToken(req);
   if (!isM2M) {
     const auth = await requireAdminSession(req);
     if (auth instanceof Response) return auth;
   }
   ```
4. Audit log all successful M2M invocations with `action: 'M2M_BAMBU_SYNC'`.

#### Acceptance & Verification Criteria
- Automated suite `tests/verify-phase2-guards.ts` passes with 100% success (18 tests).
- Unauthenticated requests to `/api/data` return HTTP 401 Unauthorized.
- Authenticated browser sessions on `app.<domain>` continue polling `/api/data?status=1` and receive HTTP 200 with zero errors.
- Manual sync and automatic Bambu sync succeed without disruption.
- M2M requests with valid `Authorization: Bearer <KEY>` header succeed.

---

### Phase 2.3: Additive Storefront Database Migration & Public APIs

#### Objective
Provision additive relational database tables for customer interactions and implement sanitized public storefront APIs.

#### Files to Create / Modify
- Create: `scripts/migrations/002_phase2_storefront_tables.sql`
- Create: `src/app/api/store/products/route.ts` (Type-safe public product catalog)
- Create: `src/app/api/store/products/[slug]/route.ts` (Single product details)
- Create: `src/app/api/store/enquiries/route.ts` (Customer enquiry submissions)
- Create: `src/app/api/store/quotes/presign/route.ts` (CAD upload presigning)
- Create: `src/app/api/store/quotes/route.ts` (Custom CAD RFQ submissions)
- Create: `tests/verify-phase2-store.ts`

#### Strict Preservation Boundaries
- Do NOT touch `public.ledger_collections`.
- All SQL migrations are purely additive (`CREATE TABLE IF NOT EXISTS`).

#### Key Implementation Steps
1. Execute additive migration creating `public.store_enquiries`, `public.store_quote_requests`, and `public.store_quote_files`.
2. Implement type-safe JSONB product queries in `/api/store/products`:
   ```sql
   WHERE collection_name = 'products'
     AND (
       (data->>'published' = 'true') OR
       (jsonb_typeof(data->'published') = 'boolean' AND (data->'published')::boolean = true)
     )
   ```
3. Map items through `sanitizeProductForStorefront()` whitelist mapper.
4. Implement `POST /api/store/enquiries` with IP rate limiting (5 / hour).
5. Implement `POST /api/store/quotes/presign` for private R2 upload URLs (50 MB limit, CAD MIME types only).
6. Implement `POST /api/store/quotes` with unique reference codes (`RFQ-YYYY-XXXX`).

#### Acceptance & Verification Criteria
- Automated suite `tests/verify-phase2-store.ts` passes with 100% success (20 tests).
- Storefront product feed returns published items only with zero cost or manufacturing data.
- Enquiry and Quote submissions persist correctly in PostgreSQL.
- Rate limiting triggers HTTP 429 when abuse limits are exceeded.

---

### Phase 2.4: Comprehensive E2E Verification & Independent Evidence Gate

#### Objective
Execute the grand regression suite (130 automated tests), verify database record invariants, and capture Playwright browser screenshots across subdomains.

#### Execution Protocol
1. **Run Suite 1:** `tests/verify-phase1-auth.ts` (22 Tests) -> Confirm 22/22 Pass.
2. **Run Suite 2:** `tests/verify-phase1-hardened.ts` (16 Tests) -> Confirm 16/16 Pass.
3. **Run Suite 3:** `tests/verify-phase1-2-1.ts` (19 Tests) -> Confirm 19/19 Pass.
4. **Run Suite 4:** `tests/verify-phase1-3.ts` (20 Tests) -> Confirm 20/20 Pass.
5. **Run Suite 5:** `tests/verify-phase2-proxy.ts` (15 Tests) -> Confirm 15/15 Pass.
6. **Run Suite 6:** `tests/verify-phase2-guards.ts` (18 Tests) -> Confirm 18/18 Pass.
7. **Run Suite 7:** `tests/verify-phase2-store.ts` (20 Tests) -> Confirm 20/20 Pass.
8. **Grand Total:** Verify all **130 tests pass (100%)**.
9. **Database Invariant Check:**
   - Execute SQL:
     ```sql
     SELECT collection_name, count(*)::int FROM public.ledger_collections GROUP BY collection_name;
     ```
   - Assert exact row counts: `prints` (221), `products` (80), `filaments` (34), `filament_stock` (34), `settings` (2) = **371 records**.
   - Assert SHA-256 digest: `d39c74285d77c00a33500f02be7595c9e495b999e2956879f2dd134e6232ef62`.
10. **Generate Review Artifact:** Prepare `docs/PHASE_2_INDEPENDENT_REVIEW.md` and await authorization before Phase 3.

---

## 3. Production Rollback Strategy (Zero Downtime)

### 3.1 Git & Code Rollback
- Since all Phase 2 changes are staged additively on feature branches or discrete commits, rolling back requires checking out the clean Phase 1.3 commit:
  ```bash
  git checkout phase-1-3-verified
  ```
- Re-run build and dev/production server:
  ```bash
  npm run build && npm run start
  ```

### 3.2 Database Rollback Safety
- **Zero Structural Risk to Engine 1:** Because Phase 2 introduces zero modifications to `public.ledger_collections`, rolling back application code leaves all manufacturing data 100% intact.
- **Additive Table Teardown (Optional):** If necessary, the additive storefront tables can be dropped cleanly without touching core data:
  ```sql
  DROP TABLE IF EXISTS public.store_quote_files CASCADE;
  DROP TABLE IF EXISTS public.store_quote_requests CASCADE;
  DROP TABLE IF EXISTS public.store_enquiries CASCADE;
  ```

---

## 4. Strict Stop Gate & Authorization Checklist

Before any code is modified or migrations are run for Phase 2:

- [ ] Technical review of revised `docs/PHASE_2_ARCHITECTURE_BLUEPRINT.md` complete.
- [ ] Technical review of revised `docs/PHASE_2_ROUTE_MAP.md` complete.
- [ ] Technical review of revised `docs/PHASE_2_SECURITY_BOUNDARIES.md` complete.
- [ ] Technical review of revised `docs/PHASE_2_IMPLEMENTATION_PLAN.md` complete.
- [ ] Production database record count verified (371 records, SHA-256 baseline matching).
- [ ] Formal authorization received from user to begin Phase 2.1 implementation.

**STATUS: PLANNING COMPLETE & CORRECTED — STOPPED AT GATE AWAITING USER APPROVAL.**
