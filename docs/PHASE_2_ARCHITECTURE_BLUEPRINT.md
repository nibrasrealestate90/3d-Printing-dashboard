# PHASE 2.0 ARCHITECTURAL BLUEPRINT (REVISED v2.0.1)
**Unified Subdomain Routing, Dual-Engine Security & Storefront Foundation**

- **Document Identifier:** `docs/PHASE_2_ARCHITECTURE_BLUEPRINT.md`
- **System Name:** Print Studio Ledger (`print-studio-app`)
- **Version:** 2.0.1-CORRECTED
- **Date:** 2026-11-18
- **Classification:** Principal Software Architecture Specification (READ-ONLY)
- **Status:** **APPROVED FOR PHASE 2.1 PENDING USER AUTHORIZATION**

---

## 1. Executive Summary & Vision

Print Studio Ledger unifies three core business experiences through a single codebase and database while enforcing strict architectural boundaries:

1. **Bambu Production Workspace:** The existing 3D manufacturing system providing real-time Bambu Cloud synchronization, print task logging, filament spool telemetry, and production job costing.
2. **Business Management Workspace:** The private administrator dashboard for product catalog management, manufacturing operations, pricing algorithms, filament inventory, and system configuration.
3. **Public Customer Storefront (Version 1 Enquiry-Only):** A fast, responsive, customer-facing web experience for browsing published 3D printed products, submitting product enquiries, and requesting custom CAD / 3D printing quotations (RFQ). **Version 1 is strictly enquiry-only: no shopping cart, no Buy Now button, no checkout, and no online payment processing.**

```
                                      +---------------------------------------------+
                                      |                 DNS / EDGE                  |
                                      |           Cloudflare WAF & SSL              |
                                      +---------------------------------------------+
                                                     |               |
                           Host: app.<domain>        |               |   Host: www.<domain>
                           (or app.lvh.me:3000)      |               |   (or www.lvh.me:3000)
                                                     v               v
+-------------------------------------------------------------------------------------------------------------------------+
|                                              NEXT.JS 16 APPLICATION RUNTIME                                             |
|                                                                                                                         |
|   +-----------------------------------------------------------------------------------------------------------------+   |
|   |                          NEXT.JS 16 PROXY: src/proxy.ts (NODE.JS RUNTIME DEFAULT)                               |   |
|   |   - Exact Allowlisted Hostname Matching (Rejects arbitrary Host / forwarded-host headers)                      |   |
|   |   - Static Asset Pass-Through (_next/static, public media)                                                      |   |
|   |   - Safe Internal URL Rewriting (/ -> /admin, / -> /store)                                                      |   |
|   |   - Perimeter Navigation Gate (Bounces unauthenticated browser GET hits on app.<domain> to /login)             |   |
|   |   - NON-AUTHORITATIVE: Proxy is NEVER the sole security control for private manufacturing data                 |   |
|   +-----------------------------------------------------------------------------------------------------------------+   |
|                              |                                                             |                            |
|             Internal Route:  | /admin/*                                   Internal Route:  | /store/*                   |
|                              v                                                             v                            |
|   +---------------------------------------------------+         +---------------------------------------------------+   |
|   |        APP / ADMIN WORKSPACE (AUTHORITATIVE)      |         |        PUBLIC STOREFRONT (ENQUIRY-ONLY v1)        |   |
|   |                                                   |         |                                                   |   |
|   |   • Server Component Session Guard (Layout-level) |         |   • /store (Storefront Home & Featured Products)  |   |
|   |   • /admin (Dashboard & Manufacturing Ledger)     |         |   • /store/products (Published Product Catalog)   |   |
|   |   • /admin/login & /login (Admin Authentication)  |         |   • /store/products/[slug] (Product Detail View)  |   |
|   |   • /admin/filaments (Spool Inventory)            |         |   • /store/quote (Custom CAD / 3D Print RFQ)      |   |
|   |   • /admin/prints (Bambu Historical Logs)         |         |   • /store/contact (Customer Inquiries)           |   |
|   |                                                   |         |   [NO CART • NO CHECKOUT • NO ONLINE PAYMENTS]    |   |
|   |   --- AUTHORITATIVE PROTECTED APIs ---            |         |                                                   |   |
|   |   • /api/data (Ledger Engine: Session + M2M)      |         |   --- PUBLIC SANITIZED APIs ---                   |   |
|   |   • /api/bambu/sync (Cloud Sync: Session + M2M)   |         |   • /api/store/products (Type-safe Whitelist)     |   |
|   |   • /api/admin/auth/* (Authentication Foundation) |         |   • /api/store/enquiries (Customer Inquiries)     |   |
|   |                                                   |         |   • /api/store/quotes (CAD RFQ & Private R2 Meta) |   |
|   +---------------------------------------------------+         +---------------------------------------------------+   |
|                              |                                                             |                            |
+------------------------------|-------------------------------------------------------------|----------------------------+
                               |                                                             |
                               v                                                             v
+-------------------------------------------------------------------------------------------------------------------------+
|                                                  NEON POSTGRESQL 18.7                                                   |
|                                                                                                                         |
|   +--------------------------------------------------+          +--------------------------------------------------+   |
|   |         ENGINE 1: MANUFACTURING DOCUMENT         |          |          ENGINE 2: COMMERCIAL RELATIONAL         |   |
|   |                                                   |          |                                                  |   |
|   |   public.ledger_collections                      |          |   public.store_enquiries                         |   |
|   |   - 371 Production Records (Preserved 100%)      |          |   public.store_quote_requests                    |   |
|   |   - prints (221), products (80), filaments (34), |          |   public.store_quote_files                       |   |
|   |     filament_stock (34), settings (2)            |          |   public.users, sessions, audit_logs             |   |
|   |   - SHA-256: d39c74285d77c00a... (VERIFIED)      |          |   (Additive DDL only; Zero Destructive Migrations|   |
|   +--------------------------------------------------+          +--------------------------------------------------+   |
+-------------------------------------------------------------------------------------------------------------------------+
```

---

## 2. Next.js 16 Proxy Architecture & Runtime Conventions

### 2.1 Next.js Runtime Terminology & Execution Invariants
- **File Convention:** Located at `src/proxy.ts` (Next.js 16 specification replacing `middleware.ts`).
- **Function Export:** `export function proxy(request: NextRequest, event?: NextFetchEvent): NextResponse | Response`.
- **Runtime Environment:** Runs in the **Node.js runtime by default**. In Next.js 16, setting `export const runtime = 'edge'` inside `proxy.ts` is unsupported and will fail at build time.
- **Accurate Architectural Framing:** `src/proxy.ts` is an **Application Ingress Proxy** running inside Next.js Node.js runtime. It must **never** be described as an "Edge Proxy".

### 2.2 Proxy Security Boundary Separation

> [!CRITICAL]
> **ARCHITECTURAL LAW:** `src/proxy.ts` is purely for **Hostname resolution, URL rewriting, and non-authoritative perimeter navigation bouncing**. It must **NEVER** be treated as the sole security control for private manufacturing data.

Security is partitioned into three independent, non-bypassable layers:
1. **Layer 1: Hostname Resolution & Routing (`src/proxy.ts`):** Inspects incoming hostname against a strict allowlist. Rewrites `/` to `/admin` on `app.<domain>` and `/` to `/store` on `www.<domain>`. Performs non-authoritative redirect of unauthenticated browser GET requests to `/login?redirect=...`.
2. **Layer 2: Server-Side Page / Layout Authorization:** Protected layouts (`src/app/admin/layout.tsx`) independently verify session validity using `requireAdminSession()` before rendering Server Components.
3. **Layer 3: Authoritative API Guards:** Every sensitive API route (`/api/data`, `/api/bambu/sync`, `/api/admin/*`) independently enforces session verification, origin CSRF validation, or M2M token validation. Even if `proxy.ts` were disabled or bypassed, private data remains completely secure.

### 2.3 Exact Allowlisted Hostname Matching
The proxy extracts the incoming `host` header, strips any port suffix, and tests against an immutable allowlist:

```typescript
// Conceptual Implementation of Host Allowlist
const ALLOWED_APP_HOSTS = new Set([
  process.env.APP_HOSTNAME || 'app.printstudio.local',
  'app.lvh.me',
]);

const ALLOWED_STORE_HOSTS = new Set([
  process.env.STORE_HOSTNAME || 'www.printstudio.local',
  'www.lvh.me',
]);

const ALLOWED_APEX_HOSTS = new Set([
  process.env.APEX_HOSTNAME || 'printstudio.local',
  'lvh.me',
]);
```

- **No Trust in Forwarded Headers:** Untrusted `x-forwarded-host` headers are ignored unless verified to originate from a configured trusted reverse proxy.
- **Unknown Host Rejection (Default-Deny):** If the extracted hostname is not present in `ALLOWED_APP_HOSTS`, `ALLOWED_STORE_HOSTS`, or `ALLOWED_APEX_HOSTS`, the proxy immediately terminates the request with `HTTP 400 Bad Request` (or `404 Not Found`).
- **Apex Canonicalization:** If the hostname is in `ALLOWED_APEX_HOSTS`, it returns a permanent `HTTP 308 Redirect` to `https://www.<domain>`.
- **Local Development Parity (`lvh.me`):** Developers test realistic multi-host routing locally via `app.lvh.me:3000` and `www.lvh.me:3000` without modifying system `/etc/hosts`. Requests to `localhost:3000` fall back to the app workspace.

---

## 3. Bambu API Authentication Architecture

### 3.1 Dual-Path Authentication Matrix

The existing endpoints (`/api/data` and `/api/bambu/sync`) must support two completely separate, mutually exclusive authentication paths:

| Dimension | Path A: Interactive Browser Sessions | Path B: Trusted Server-Side Automation (M2M) |
|---|---|---|
| **Client Type** | React Dashboard (`ledgerCore.js`) in browser | External Cron Jobs, Webhook Workers, Sync Scripts |
| **Credential Type** | Cryptographic Session Token in HTTP-only Cookie | Dedicated Bearer API Key in `Authorization` Header |
| **Cookie Name** | `__Host-admin_session` (Prod) / `admin_session` (Dev) | **None** (Cookies rejected for M2M) |
| **Header Format** | Standard browser ambient cookie transport | `Authorization: Bearer <M2M_SECRET>` |
| **Browser Exposure** | **Zero Secret Exposure** (Token in HTTP-only cookie) | **STRICTLY FORBIDDEN IN CLIENT JS** (Server-only env) |
| **Verification Gate** | `requireAdminSession(req)` | `validateM2MToken(req)` |
| **Database Check** | Verifies `public.sessions` & `public.users` | Evaluates constant-time SHA-256 hash |
| **CSRF Defense** | `validateOrigin(req)` required on mutations | Origin header not required for Bearer auth |
| **Permissions Scope** | Full Administrator Access | Scoped strictly to `bambu:sync` & `ledger:read_status` |

### 3.2 M2M Key Lifecycle Management

1. **Key Generation:**
   - Generated using cryptographically secure pseudorandom number generators:
     `crypto.randomBytes(32).toString('base64url')` (256-bit entropy).
2. **Key Storage:**
   - The raw secret is stored strictly on the trusted worker or deployment secret manager.
   - The application server stores ONLY the SHA-256 digest in environment variable `BAMBU_M2M_API_KEY_HASH`.
   - **Zero Client Exposure:** The secret is NEVER prefixed with `NEXT_PUBLIC_` and is never included in client JavaScript bundles.
3. **Key Rotation & Revocation:**
   - Dual-hash evaluation supports zero-downtime key rotation (`BAMBU_M2M_API_KEY_HASH_CURRENT` and `BAMBU_M2M_API_KEY_HASH_PREVIOUS`).
   - Revocation is instantaneous by removing or updating the hash environment variable.
4. **Timing-Safe Evaluation:**
   ```typescript
   import crypto from 'crypto';

   export function validateM2MToken(req: Request): boolean {
     const authHeader = req.headers.get('authorization');
     if (!authHeader || !authHeader.startsWith('Bearer ')) return false;

     const token = authHeader.substring(7).trim();
     const configuredHash = process.env.BAMBU_M2M_API_KEY_HASH;
     if (!configuredHash || token.length < 32) return false;

     const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
     const bufA = Buffer.from(tokenHash, 'hex');
     const bufB = Buffer.from(configuredHash, 'hex');

     if (bufA.length !== bufB.length) return false;
     return crypto.timingSafeEqual(bufA, bufB);
   }
   ```
5. **Rate Limiting & Abuse Prevention:**
   - Dedicated bucket: max 1 M2M sync invocation every 60 seconds per IP, preventing runaway cron loops.
6. **Immutable Audit Logging:**
   - Every M2M invocation records `action: 'M2M_BAMBU_SYNC'` in `public.audit_logs`.

---

## 4. Public Storefront Data Safety & Version 1 Scope

### 4.1 Strict Version 1 Scope: Enquiry-Only

> [!IMPORTANT]
> **VERSION 1 STOREFRONT BOUNDARIES:**
> - **NO Shopping Cart.**
> - **NO "Buy Now" Buttons.**
> - **NO Checkout Flows.**
> - **NO Online Payment Processing (No Stripe, PayPal, or card gateways).**
>
> The storefront serves exclusively as a digital showroom allowing customers to:
> 1. Browse published 3D printed products and specifications.
> 2. Submit general inquiries or volume order requests via an enquiry form.
> 3. Request custom 3D printing and CAD quotation (RFQ) with secure file uploads.

### 4.2 Type-Safe JSONB Product Queries

In PostgreSQL, casting `(data->>'published')::boolean` throws a query error if `published` is missing, null, or contains arbitrary text.

**Type-Safe Query Implementation:**
```sql
SELECT record_id, data, updated_at
FROM public.ledger_collections
WHERE collection_name = 'products'
  AND (
    (data->>'published' = 'true') OR
    (jsonb_typeof(data->'published') = 'boolean' AND (data->'published')::boolean = true)
  )
ORDER BY updated_at DESC;
```

### 4.3 Explicit Public Product Projection Whitelist

The storefront API (`GET /api/store/products`) maps internal records through an explicit whitelist mapper. Internal attributes are never exposed:

```typescript
export interface PublicStorefrontProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  images: string[];
  basePrice: number;
  customizable: boolean;
  dimensions?: { x: number; y: number; z: number };
  colorsAvailable: string[];
}

export function sanitizeProductForStorefront(item: any): PublicStorefrontProduct {
  return {
    id: String(item.id),
    name: String(item.title || item.name || 'Custom 3D Print'),
    slug: String(item.slug || item.id),
    description: String(item.description || ''),
    category: String(item.category || 'General'),
    images: Array.isArray(item.images) ? item.images.filter(img => typeof img === 'string') : [],
    basePrice: Number(item.sellingPrice || item.retailPrice || 0),
    customizable: Boolean(item.customizable),
    dimensions: item.dimensions && typeof item.dimensions === 'object' ? {
      x: Number(item.dimensions.x || 0),
      y: Number(item.dimensions.y || 0),
      z: Number(item.dimensions.z || 0),
    } : undefined,
    colorsAvailable: Array.isArray(item.colors) ? item.colors.filter(c => typeof c === 'string') : ['Default'],
  };
}
```

#### Strictly Redacted Internal Attributes:
- `materialCost`, `electricityCost`, `machineHourlyRate`, `laborCost`
- `profitMargin`, `internalCost`, `minSellingPrice`
- `slicerSettings`, `bambuPlateId`, `printerId`, `gcodeFile`
- `supplierName`, `supplierPartNumber`, `filamentSpoolId`
- `totalPrinted`, internal manufacturing notes

### 4.4 Secure CAD Upload Handling & Private R2 Storage
For custom CAD / 3D printing quotation requests:
1. **File Type Whitelist:** Restricted to `.step`, `.stp`, `.stl`, `.3mf`, and `.obj`. Executable, archive, or script types (`.exe`, `.bat`, `.sh`, `.zip`) are rejected.
2. **File Size Limits:** Strictly bounded to **50 MB** per upload.
3. **Pre-Signed Upload URL Pipeline:**
   - Client requests an upload token from `POST /api/store/quotes/presign`.
   - Server issues a pre-signed, time-limited PUT URL (valid for 10 minutes) directly to a **private Cloudflare R2 bucket**.
   - Client uploads directly to R2, avoiding application server memory buffering.
4. **Access Control:** The R2 bucket has **zero public access**. Files can only be downloaded by authenticated administrators via time-limited pre-signed GET URLs (valid for 15 minutes) generated by `requireAdminSession()`.
5. **Retention Policy:**
   - Uploads associated with unquoted or abandoned RFQs are purged automatically after 30 days via R2 lifecycle rules.
   - Quoted and accepted job files are retained for manufacturing and archived after 90 days.

---

## 5. Deployment Architecture Evaluation (Cloudflare vs Vercel)

### 5.1 Trade-Off Matrix

| Criterion | Cloudflare (Workers / OpenNext) | Vercel (Next.js Serverless) | Architectural Assessment |
|---|---|---|---|
| **Next.js 16 Support** | Requires adapter shims (`@opennextjs/cloudflare`). Lags behind breaking framework changes. | First-party, native support for Next.js 16 App Router and Node.js Proxy conventions. | **Vercel** |
| **Proxy Execution** | Workers isolate runtime; cannot run native C++ Node addons without WASM recompilation. | Full Node.js runtime support; executes Argon2id and native crypto seamlessly. | **Vercel** |
| **File / Object Storage** | **Cloudflare R2:** S3-compatible, **zero egress fees**, exceptional pricing for heavy CAD files. | **Vercel Blob:** S3-backed; bandwidth egress charges apply beyond quota. | **Cloudflare R2** |
| **DNS, SSL & WAF** | Authoritative global Anycast DNS, unlimited wildcard SSL certificates, advanced L7 WAF. | Standard DNS and SSL management; wildcard subdomains require paid Pro plans. | **Cloudflare** |

### 5.2 Recommended Hybrid Topology
- **DNS, Edge Protection & Storage:** Cloudflare manages authoritative DNS, wildcard SSL (`*.domain.com`), WAF rate limiting, and **Cloudflare R2** for private CAD models and public product photography.
- **Compute Runtime:** Vercel (or self-hosted Node.js container) hosts the Next.js 16 application runtime, executing `src/proxy.ts` natively in Node.js.

---

## 6. Revised Implementation Boundaries (Phase 2.1 to 2.4)

To prevent risk accumulation and ensure safety, Phase 2 is partitioned into four discrete, sequential steps:

```
[Phase 2.1: Hostname Routing Foundation]
  • src/proxy.ts (Next.js 16 Proxy, Node.js runtime)
  • Exact allowlisted hostname matching (app.<domain>, www.<domain>, lvh.me)
  • Canonical 308 apex redirect & unknown host rejection
  • Internal rewrites to /admin and /store skeletons
  • ZERO auth changes, ZERO database changes, ZERO API changes
  • Verification: tests/verify-phase2-proxy.ts (15 tests)
              │
              ▼
[Phase 2.2: Server-Side Administrator Protection & Manufacturing API Authentication]
  • Authoritative Server Component layout session verification
  • Dual-Gate Auth on /api/data and /api/bambu/sync (Admin Session + M2M Bearer)
  • Timing-safe M2M evaluation, rotation, scopes, and audit logging
  • Verify continuous polling in ledgerCore.js
  • Verification: tests/verify-phase2-guards.ts (18 tests)
              │
              ▼
[Phase 2.3: Additive Storefront Database Migration & Public APIs]
  • Additive DDL: store_enquiries, store_quote_requests, store_quote_files
  • Sanitized public endpoints: /api/store/products, enquiries, quotes
  • Enquiry-only storefront UI (No cart, no checkout, no payments)
  • Secure CAD upload pre-signing and private R2 storage integration
  • Verification: tests/verify-phase2-store.ts (20 tests)
              │
              ▼
[Phase 2.4: Grand Regression Suite & Independent Review Gate]
  • 130 total tests executed (77 prior + 53 Phase 2)
  • Database baseline verified: 371 records, matching SHA-256 hash
  • Multi-subdomain Playwright test across app.lvh.me and www.lvh.me
  • Final review deliverable: docs/PHASE_2_INDEPENDENT_REVIEW.md
```

---

## 7. Approval Gate & Next Steps

This document represents the corrected, finalized architectural blueprint for Phase 2. Implementation will begin with Phase 2.1 upon explicit user authorization.
