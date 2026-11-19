# PHASE 2.0.1 ARCHITECTURE CORRECTIONS & FINAL APPROVAL GATE
**Audit Log, Security Boundary Adjustments & Technical Revisions**

- **Document Identifier:** `docs/PHASE_2_0_1_ARCHITECTURE_CORRECTIONS.md`
- **System Name:** Print Studio Ledger (`print-studio-app`)
- **Version:** 2.0.1-FINAL
- **Date:** 2026-11-18
- **Classification:** Principal Software Architecture Audit & Change Log (READ-ONLY)
- **Status:** **APPROVED FOR PHASE 2.1 PENDING USER AUTHORIZATION**

---

## 1. Executive Summary

In response to the Phase 2.0.1 architectural directives, a comprehensive revision of all four Phase 2 master specifications has been conducted:

1. [`docs/PHASE_2_ARCHITECTURE_BLUEPRINT.md`](file:///Users/subhamsantra/Desktop/Dashboard/3D%20PRINTING/docs/PHASE_2_ARCHITECTURE_BLUEPRINT.md)
2. [`docs/PHASE_2_ROUTE_MAP.md`](file:///Users/subhamsantra/Desktop/Dashboard/3D%20PRINTING/docs/PHASE_2_ROUTE_MAP.md)
3. [`docs/PHASE_2_SECURITY_BOUNDARIES.md`](file:///Users/subhamsantra/Desktop/Dashboard/3D%20PRINTING/docs/PHASE_2_SECURITY_BOUNDARIES.md)
4. [`docs/PHASE_2_IMPLEMENTATION_PLAN.md`](file:///Users/subhamsantra/Desktop/Dashboard/3D%20PRINTING/docs/PHASE_2_IMPLEMENTATION_PLAN.md)

This review confirms that the architecture is now fully corrected, conforms strictly to Next.js 16 conventions, establishes unambiguous defense-in-depth security boundaries, isolates M2M credentials, guarantees storefront data safety, enforces exact allowlist hostname routing, and partitions Phase 2 into four discrete, sequential sub-phases.

---

## 2. Comprehensive Change Log

| Item | Focus Area | Previous Phrasing / Limitation | Corrected Implementation (v2.0.1) | Documents Updated |
|---|---|---|---|---|
| **CORR-01** | **Proxy Security Boundary** | Implied that `src/proxy.ts` acted as an authoritative perimeter security gate for private data. | Strictly partitioned: `src/proxy.ts` performs hostname matching and URL rewriting only. Server Components (`admin/layout.tsx`) and every API route (`/api/data`, `/api/bambu/sync`) independently enforce authoritative session and M2M checks. **Proxy is NEVER the sole security control.** | Blueprint, Route Map, Security, Plan |
| **CORR-02** | **Next.js Runtime Terminology** | Referred to `src/proxy.ts` as an "Edge Proxy" or "Edge Runtime". | Corrected to **"Next.js 16 Proxy"** or **"Application Ingress Proxy"** executing in the **Node.js runtime by default**. Clarified that configurable Edge runtime in `proxy.ts` is unsupported in Next.js 16. | Blueprint, Route Map, Security, Plan |
| **CORR-03** | **Bambu API Authentication** | Blended session and M2M concepts without lifecycle constraints. | Established two separate paths: (1) Interactive Admin Session (`__Host-admin_session`) and (2) Trusted Automation Bearer M2M Key. Stored only as SHA-256 hash. Zero client JS exposure. Detailed key generation, rotation, scopes, rate limits, and audit logs. | Blueprint, Route Map, Security, Plan |
| **CORR-04** | **JSONB Type-Safe Querying** | Query used unsafe boolean casting `(data->>'published')::boolean = true`, which errors on invalid data. | Implemented type-safe SQL expression: `((data->>'published' = 'true') OR (jsonb_typeof(data->'published') = 'boolean' AND (data->'published')::boolean = true))`. | Blueprint, Route Map, Security, Plan |
| **CORR-05** | **Storefront Version 1 Scope** | Left e-commerce features (cart, checkout) ambiguous. | Strictly defined: **Version 1 is ENQUIRY-ONLY**. **NO cart, NO Buy Now, NO checkout, NO online payments.** Customers browse products and submit enquiries or CAD RFQ quote requests. | Blueprint, Route Map, Security, Plan |
| **CORR-06** | **Secure CAD Upload & R2 Storage** | Did not detail upload mechanics, file limits, or access controls. | Detailed complete pre-signed PUT pipeline to private Cloudflare R2 bucket. Strict 50 MB limit, CAD-only MIME whitelist (`.step`, `.stl`, `.3mf`), zero public bucket access, 15-minute presigned admin download URLs, 30-day purge policy. | Blueprint, Route Map, Security, Plan |
| **CORR-07** | **Exact Allowlisted Hostnames** | Relied on dynamic host resolution without explicit allowlists. | Defined exact allowlist matching (`ALLOWED_APP_HOSTS`, `ALLOWED_STORE_HOSTS`, `ALLOWED_APEX_HOSTS`). Strips ports, rejects unverified forwarded headers, and enforces default-deny HTTP 400 on unknown hosts. | Blueprint, Route Map, Security, Plan |
| **CORR-08** | **Isolated Sub-Phase Boundaries** | Allowed overlap of proxy routing and API auth guards. | Strictly partitioned: Phase 2.1 (Hostname routing only) -> Phase 2.2 (Server-side admin protection & API auth) -> Phase 2.3 (Additive DB migration & public APIs) -> Phase 2.4 (Full regression & review). | Implementation Plan |

---

## 3. Detailed Technical Breakdown of Corrections

### 3.1 Proxy Security Boundary & Authoritative Defense-in-Depth
- **The Ingress Proxy (`src/proxy.ts`):** Operates at the ingress level to map hostnames (`app.<domain>` vs `www.<domain>`), rewrite URLs internally (`/` -> `/admin` or `/store`), and perform non-authoritative convenience bouncing (e.g. redirecting browser GET requests for `/admin` to `/login?redirect=...`).
- **Authoritative Server Components (`src/app/admin/layout.tsx`):** Executes in the Node.js server environment before rendering the administration UI. Checks the `__Host-admin_session` cookie via `validateSession()`. If invalid or expired, issues a server redirect.
- **Authoritative Route Handlers (`/api/data`, `/api/bambu/sync`):** Independently invoke `requireAdminSession(req)` or `validateM2MToken(req)`. Every mutation checks CSRF origin headers (`validateOrigin(req)`). If an attacker directly invokes `/api/data` bypassing `proxy.ts`, the route handler immediately blocks the request with `HTTP 401 Unauthorized`.

### 3.2 Next.js 16 Runtime Architecture
- Next.js 16 replaces `middleware.ts` with `src/proxy.ts`.
- The proxy runs in the **Node.js runtime by default**.
- Next.js 16 does **not** allow configuring `export const runtime = 'edge'` inside `proxy.ts`. Attempting to do so causes a compilation failure.
- All documents now use the precise nomenclature: **Next.js 16 Proxy** (or Application Ingress Proxy) in Node.js runtime.

### 3.3 Bambu API Authentication (Dual-Path Specification)
1. **Interactive Dashboard Path:**
   - Client is `src/components/ledgerCore.js` running in the browser on `app.<domain>`.
   - Browser automatically attaches the HTTP-only `__Host-admin_session` cookie.
   - Server validates session against `public.sessions` in Neon PostgreSQL.
   - High-frequency polling (`GET /api/data?status=1`) and manual Bambu sync operate with **zero code modifications to `ledgerCore.js`**.
2. **Automated M2M Path:**
   - Dedicated Bearer key generated with 256 bits of CSPRNG entropy (`crypto.randomBytes(32).toString('base64url')`).
   - Raw key is stored strictly on the trusted worker (GitHub Action, Vercel Cron, external script) and **NEVER exposed in client JavaScript bundles** (no `NEXT_PUBLIC_` prefix).
   - Application stores only the SHA-256 hash in `process.env.BAMBU_M2M_API_KEY_HASH`.
   - Comparison uses timing-safe evaluation (`crypto.timingSafeEqual`).
   - Scoped strictly to `bambu:sync` and `ledger:read_status`.
   - Dedicated rate limiting (1 invocation / 60 seconds per IP).
   - Every invocation records an immutable log in `public.audit_logs`.

### 3.4 Public Storefront Safety & Version 1 Scope
- **Enquiry-Only Model:** Version 1 eliminates the complexity and attack surface of shopping carts, payment processing, webhooks, and customer accounts.
- **Type-Safe Queries:** JSONB queries explicitly check `(data->>'published' = 'true') OR (jsonb_typeof(data->'published') = 'boolean' AND (data->'published')::boolean = true)` to avoid unhandled database cast exceptions.
- **Strict Projection Whitelist:** `sanitizeProductForStorefront()` explicitly copies allowed fields (`id`, `name`, `slug`, `description`, `images`, `basePrice`, `colorsAvailable`, `dimensions`).
- **Complete Redaction:** Internal costs (`materialCost`, `electricityCost`, `machineHourlyRate`), profit margins, Bambu plate IDs, slicer settings, and supplier details are never included in API responses.
- **Secure CAD Uploads:**
  - Client calls `POST /api/store/quotes/presign` with file metadata.
  - Server validates MIME type (`.step`, `.stl`, `.3mf`) and size (<= 50 MB), issuing a 10-minute pre-signed PUT URL to a private Cloudflare R2 bucket.
  - The bucket has **zero public access**. Files are only accessible to administrators via 15-minute pre-signed GET URLs generated by `requireAdminSession()`.
  - Abandoned files are automatically purged after 30 days.

### 3.5 Hostname & Routing Safety
- **Allowlisted Matching:**
  - `ALLOWED_APP_HOSTS`: `app.<BASE_DOMAIN>`, `app.lvh.me`
  - `ALLOWED_STORE_HOSTS`: `www.<BASE_DOMAIN>`, `www.lvh.me`
  - `ALLOWED_APEX_HOSTS`: `<BASE_DOMAIN>`, `lvh.me`
- **Rejection of Unknown Hosts:** Any unmapped virtual host or direct IP connection receives `HTTP 400 Bad Request`.
- **Open Redirect Defense:** The return URL parameter (`?redirect=...`) is validated: must begin with `/`, cannot begin with `//` or `/\`, and cannot contain CRLF characters.
- **Local Development Parity:** Local development executes identically using `lvh.me:3000` without modifying `/etc/hosts` or configuring external DNS.

### 3.6 Revised Phase Boundaries
- **Phase 2.1 (Hostname Routing Only):** `src/proxy.ts` implementation, allowlisted host matching, internal rewrites to `/admin` and `/store` skeletons, canonical 308 apex redirect. **Zero auth or database changes.** Verified by 15 automated tests.
- **Phase 2.2 (Server-Side Admin Protection & API Auth):** Layout-level session checks, Dual-Gate auth on `/api/data` and `/api/bambu/sync`, M2M timing-safe auth, continuous polling verification in `ledgerCore.js`. Verified by 18 automated tests.
- **Phase 2.3 (Additive DB Migration & Public APIs):** Additive DDL (`store_enquiries`, `store_quote_requests`, `store_quote_files`), public sanitized storefront endpoints, enquiry-only UI, CAD presigned upload pipeline. Verified by 20 automated tests.
- **Phase 2.4 (Full Regression & Independent Review):** 130 grand total tests executed, database row count & SHA-256 hash verified, Playwright multi-subdomain browser audit.

---

## 4. Unresolved Deployment Assumptions

The following operational decisions remain intentionally decoupled from Phase 2 implementation and will be finalized prior to production deployment:

1. **Production Domain Selection:** The exact production apex domain (e.g., `printstudio.com` vs `printstudioledger.com`) is not finalized. All routing derives from runtime environment variables (`APP_HOSTNAME`, `STORE_HOSTNAME`, `APEX_HOSTNAME`).
2. **Cloudflare vs Vercel Compute Finalization:** While the architecture strongly recommends the **Hybrid Topology** (Vercel compute for native Next.js 16 Node runtime proxy + Cloudflare for DNS, WAF, and R2 object storage), the codebase remains fully portable to a Docker container or standalone Node.js server.
3. **R2 Credentials Provisioning:** R2 bucket name, account ID, access key ID, and secret access key will be provided via environment variables in Phase 2.3.
4. **Production DNS Records:** Creation of production CNAME/A records (`app`, `www`, `@`) will take place at release cutover and does not affect local development or automated verification.

---

## 5. Final Recommendation

Based on the completion of all corrections, rigorous threat modeling, type-safe database query design, and sequential phase boundary definition:

### **RECOMMENDATION: APPROVED FOR PHASE 2.1**

The architectural planning phase is 100% complete. The project is technically prepared to proceed immediately to **Phase 2.1: Next.js 16 Proxy & Multi-Host Routing (Hostname Routing Only)** upon your explicit authorization.
