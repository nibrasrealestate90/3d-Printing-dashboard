# PHASE 2.0 ROUTE MAP & APIS (REVISED v2.0.1)
**Complete Endpoint Topology, Hostname Disambiguation & App Router Architecture**

- **Document Identifier:** `docs/PHASE_2_ROUTE_MAP.md`
- **System Name:** Print Studio Ledger (`print-studio-app`)
- **Version:** 2.0.1-CORRECTED
- **Date:** 2026-11-18
- **Classification:** Principal Software Architecture Specification (READ-ONLY)
- **Status:** **APPROVED FOR PHASE 2.1 PENDING USER AUTHORIZATION**

---

## 1. Architectural Route Philosophy & Routing Mechanics

In Next.js 16 App Router, the application serves a unified filesystem route tree. Multi-host experiences (`app.<domain>` vs `www.<domain>`) are achieved through hostname-based internal URL rewriting inside the **Next.js 16 Proxy (`src/proxy.ts`)**, executing in the **Node.js runtime by default**.

### 1.1 Route Collision Prevention: Concrete Routes vs Route Groups

> [!CRITICAL]
> Next.js App Router route groups enclosed in parentheses—such as `(admin)` or `(store)`—are completely omitted from the public URL.
>
> - `src/app/(admin)/page.tsx` resolves to `/`
> - `src/app/(store)/page.tsx` ALSO resolves to `/`
> 
> Having both in the same Next.js project causes a build conflict: *“You cannot have two parallel pages that resolve to the same route”*.
> 
> Furthermore, Next.js rewrite rules must NEVER target route groups (e.g. `NextResponse.rewrite(new URL('/(admin)', req.url))` fails with an HTTP 404).
> 
> **Architectural Standard for Phase 2:**
> We use **concrete, collision-free internal route directories**:
> - All administrative pages and layouts reside in `src/app/admin/*`.
> - All public storefront pages and layouts reside in `src/app/store/*`.
> - The root route `/` on `app.<domain>` is internally rewritten to `/admin`.
> - The root route `/` on `www.<domain>` is internally rewritten to `/store`.

### 1.2 Separation of Ingress Routing from Authoritative Security

- **Next.js 16 Proxy (`src/proxy.ts`):** Handles exact hostname allowlist matching, static asset pass-through, internal path rewriting, and non-authoritative redirection of unauthenticated browser GET requests to `/login?redirect=...`.
- **Authoritative Server Guards:**
  - `src/app/admin/layout.tsx`: Server Component layout that authoritatively verifies active sessions via `requireAdminSession()` before rendering the admin workspace.
  - Route Handlers (`/api/data`, `/api/bambu/sync`): Independently verify credentials (admin session cookie or timing-safe M2M bearer token) and validate CSRF origins.

---

## 2. Master Route Matrix

### 2.1 Public Hostname (`www.<domain>` or `www.lvh.me:3000`)
**Scope: Version 1 Public Storefront (Enquiry-Only — No Cart, No Checkout, No Online Payments)**

| External URL | Internal Target File | HTTP Methods | Auth Level | CSRF Check | Cache Control | Purpose |
|---|---|:---:|:---:|:---:|---|---|
| `/` | `src/app/store/page.tsx` | `GET` | Public | None | `s-maxage=60, stale-while-revalidate=300` | Storefront landing page, workshop showcase, featured 3D prints |
| `/products` | `src/app/store/products/page.tsx` | `GET` | Public | None | `s-maxage=60, stale-while-revalidate=300` | Published product catalog with category & tag filters |
| `/products/[slug]` | `src/app/store/products/[slug]/page.tsx` | `GET` | Public | None | `s-maxage=60, stale-while-revalidate=300` | Product detail view with specs, dimensions, and inquiry button |
| `/quote` | `src/app/store/quote/page.tsx` | `GET` | Public | None | `no-cache` | Interactive custom 3D printing & CAD quote request form |
| `/contact` | `src/app/store/contact/page.tsx` | `GET` | Public | None | `public, max-age=3600` | Business contact, workshop details, customer inquiry form |
| `/api/store/products` | `src/app/api/store/products/route.ts` | `GET` | Public | None | `s-maxage=60, stale-while-revalidate=300` | Type-safe sanitized public product feed (Zero cost/supplier data) |
| `/api/store/products/[id]`| `src/app/api/store/products/[id]/route.ts` | `GET` | Public | None | `s-maxage=60, stale-while-revalidate=300` | Sanitized single product details |
| `/api/store/enquiries` | `src/app/api/store/enquiries/route.ts` | `POST` | Public (Rate-Limited) | Origin Header | `no-store` | Customer general/bulk enquiry submission endpoint |
| `/api/store/quotes/presign`| `src/app/api/store/quotes/presign/route.ts`| `POST` | Public (Rate-Limited) | Origin Header | `no-store` | Generates short-lived pre-signed PUT URL for CAD upload |
| `/api/store/quotes` | `src/app/api/store/quotes/route.ts` | `POST` | Public (Rate-Limited) | Origin Header | `no-store` | CAD / custom print RFQ submission endpoint |
| `/admin/*` | N/A | ALL | **BLOCKED** | N/A | N/A | **HTTP 404:** Admin routes do not exist on storefront |
| `/api/data` | N/A | ALL | **BLOCKED** | N/A | N/A | **HTTP 404:** Private manufacturing ledger blocked at proxy |
| `/api/bambu/*` | N/A | ALL | **BLOCKED** | N/A | N/A | **HTTP 404:** Bambu sync APIs blocked at proxy |

---

### 2.2 Private Workspace Hostname (`app.<domain>` or `app.lvh.me:3000`)
**Scope: Business Management & Manufacturing Operations**

| External URL | Internal Target File | HTTP Methods | Auth Level | CSRF Check | Cache Control | Purpose |
|---|---|:---:|:---:|:---:|---|---|
| `/` | `src/app/admin/page.tsx` | `GET` | Admin Session (Server Component) | None | `no-store, must-revalidate` | Main Manufacturing Dashboard (Print Studio Ledger) |
| `/login` | `src/app/login/page.tsx` | `GET` | Public / Guest | None | `no-store` | Canonical sign-in page (aliases `/admin/login`) |
| `/admin/login` | `src/app/admin/login/page.tsx` | `GET` | Public / Guest | None | `no-store` | Administrative sign-in form & session status |
| `/admin` | `src/app/admin/page.tsx` | `GET` | Admin Session (Server Component) | None | `no-store, must-revalidate` | Direct admin workspace route |
| `/api/admin/auth/login` | `src/app/api/admin/auth/login/route.ts` | `POST` | Public (Rate-Limited) | Origin Header | `no-store` | Administrator credential verification & session cookie |
| `/api/admin/auth/logout`| `src/app/api/admin/auth/logout/route.ts`| `POST` | Session Cookie | Origin Header | `no-store` | Session revocation & cookie destruction |
| `/api/admin/auth/me` | `src/app/api/admin/auth/me/route.ts` | `GET` | Admin Session | None | `no-store` | Client session verification & user profile query |
| `/api/data` | `src/app/api/data/route.ts` | `GET, POST, DELETE`| Dual-Gate: Session OR M2M | Origin on Mutations | `no-store` | **PROTECTED:** Core ledger collection queries & mutations |
| `/api/bambu/sync` | `src/app/api/bambu/sync/route.ts` | `GET, POST` | Dual-Gate: Session OR M2M | Origin on Mutations | `no-store` | **PROTECTED:** Bambu Lab Cloud synchronization engine |
| `/store/*` | N/A | ALL | **REDIRECT** | N/A | N/A | **HTTP 308:** Redirects to `https://www.<domain>/store/*` |

---

### 2.3 Apex Hostname (`<domain>` or `lvh.me:3000`)

| External URL | Proxy Action | Downstream Target | Status Code | Purpose |
|---|---|---|:---:|---|
| `https://<domain>/*` | Canonical Redirect | `https://www.<domain>/*` | **308 Permanent** | Enforces canonical public hostname for SEO & security |

---

### 2.4 Unknown Hostnames / Direct IP Access

| External URL | Proxy Action | Response | Status Code | Purpose |
|---|---|---|:---:|---|
| `http://<unknown_ip>/*` | Default-Deny Gate | JSON / Plain Text Error | **400 Bad Request** (or 404) | Rejects unmapped virtual hosts & Host Header Injection |

---

## 3. Detailed Endpoint Specifications

### 3.1 Protected Manufacturing Endpoints

#### `GET /api/data`
- **Allowed Hostnames:** `app.<domain>`, `app.lvh.me`
- **Authentication Paths:**
  1. *Interactive Session:* Valid `__Host-admin_session` cookie validated via `requireAdminSession(req)`.
  2. *Automated M2M:* Valid `Authorization: Bearer <KEY>` validated via `validateM2MToken(req)`.
- **Query Modes:**
  - `status=1`: Returns lightweight collection version hashes for dashboard polling.
  - `collection=<name>`: Returns records for a single collection (`products`, `prints`, `filaments`, `filament_stock`, `settings`).
  - Omitted: Returns all collections grouped.
- **Response Headers:** `Cache-Control: no-store, no-cache, must-revalidate`

#### `POST /api/data`
- **Allowed Hostnames:** `app.<domain>`, `app.lvh.me`
- **Authentication:** `requireAdminSession()` OR Valid Bearer M2M Key
- **CSRF Protection:** Validates `Origin` header matches `app.<domain>` (for session-based mutations)
- **Settings Masking:** Preserves masked Bambu Cloud tokens (`••••••••`).

#### `POST /api/bambu/sync`
- **Allowed Hostnames:** `app.<domain>`, `app.lvh.me`
- **Authentication:** `requireAdminSession()` OR Valid Bearer M2M Key
- **CSRF Protection:** Validates `Origin` header matches `app.<domain>` (for session-based mutations)
- **Execution Limits:** Configured with `export const maxDuration = 30`
- **Payload Modes:**
  - Standard sync: `{}` (fetches latest tasks, logs prints, recalculates `totalPrinted`)
  - Photo backfill: `{ action: 'backfill-photos' }` (downloads missing plate photos)

---

### 3.2 Public Storefront Endpoints (Version 1 Enquiry-Only)

#### `GET /api/store/products`
- **Allowed Hostnames:** `www.<domain>`, `www.lvh.me`, `app.<domain>` (for preview)
- **Authentication:** Public
- **Query Parameters:**
  - `category`: String (filter by category)
  - `limit`: Integer (default 24, max 100)
- **Type-Safe Database Query:**
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
- **Strict Data Redaction:** Output passes through `sanitizeProductForStorefront()`. Never exposes `materialCost`, `electricityCost`, `bambuPlateId`, internal margins, or supplier details.

#### `POST /api/store/enquiries`
- **Allowed Hostnames:** `www.<domain>`, `www.lvh.me`
- **Authentication:** Public (Protected by IP Rate Limiter: max 5 requests per hour)
- **Payload Schema:**
  ```json
  {
    "customerName": "Jane Doe",
    "customerEmail": "jane@example.com",
    "customerPhone": "+1-555-0199",
    "subject": "Bulk Print Inquiry",
    "message": "Looking to order 50 units for a corporate event.",
    "productId": "prod_4a8b1c9d"
  }
  ```
- **Response:** `HTTP 201 Created` with `{ success: true, enquiryId: "uuid" }`

#### `POST /api/store/quotes/presign`
- **Allowed Hostnames:** `www.<domain>`, `www.lvh.me`
- **Authentication:** Public (Rate-limited: 5 / hour / IP)
- **Payload Schema:**
  ```json
  {
    "fileName": "bracket_v2.step",
    "fileSizeBytes": 4518200,
    "mimeType": "application/octet-stream"
  }
  ```
- **File Validation:** Strictly validates extension is `.step`, `.stp`, `.stl`, `.3mf`, or `.obj`. Maximum size: 50 MB.
- **Response:** Returns short-lived (10 min) pre-signed PUT URL to private Cloudflare R2 bucket.

#### `POST /api/store/quotes`
- **Allowed Hostnames:** `www.<domain>`, `www.lvh.me`
- **Authentication:** Public (Rate-limited: 3 / hour / IP)
- **Payload Schema:**
  ```json
  {
    "customerName": "John Smith",
    "customerEmail": "john@engineering.com",
    "customerPhone": "+1-555-0122",
    "projectTitle": "Robotics Bracket Prototype",
    "projectDescription": "Need high-strength functional bracket printed in PETG-CF.",
    "materialPreference": "PETG-CF",
    "colorPreference": "Black",
    "quantity": 4,
    "targetDeadline": "2026-12-01",
    "storageKey": "uploads/rfq/bracket_v2_xyz.step",
    "fileName": "bracket_v2.step",
    "fileSizeBytes": 4518200
  }
  ```
- **Response:** `HTTP 201 Created` with `{ success: true, rfqReference: "RFQ-2026-0042" }`

---

## 4. Internal App Router File Structure

```
src/app/
├── admin/                           # Concrete Administrative Workspace Routes
│   ├── login/
│   │   └── page.tsx                 # Admin Sign In Page (Existing)
│   ├── layout.tsx                   # Authoritative Server Component Session Layout
│   └── page.tsx                     # Admin Dashboard (Print Studio Ledger)
│
├── store/                           # Concrete Public Storefront Routes (Enquiry-Only)
│   ├── products/
│   │   ├── [slug]/
│   │   │   └── page.tsx             # Product Details View & Inquiry Trigger
│   │   └── page.tsx                 # Product Catalog Listing
│   ├── quote/
│   │   └── page.tsx                 # Custom 3D Printing / CAD RFQ Form
│   ├── contact/
│   │   └── page.tsx                 # Contact & General Inquiries
│   ├── layout.tsx                   # Storefront Shell Layout (Header, Navigation, Footer)
│   └── page.tsx                     # Storefront Landing Page
│
├── api/                             # API Route Handlers
│   ├── admin/
│   │   └── auth/                    # Auth Endpoints (login, logout, me)
│   ├── bambu/
│   │   └── sync/                    # Bambu Cloud Sync (GET, POST - Dual Gate)
│   ├── data/                        # Ledger Engine API (GET, POST, DELETE - Dual Gate)
│   ├── store/
│   │   ├── products/                # Public Sanitized Catalog (GET)
│   │   ├── enquiries/               # Customer Inquiries (POST)
│   │   └── quotes/                  # CAD RFQ & Pre-signing (POST)
│   └── health/
│       └── route.ts                 # Health Check Endpoint
│
├── login/
│   └── page.tsx                     # Canonical /login Alias to admin/login
├── favicon.ico
├── globals.css
├── admin-login.css
├── ledger.css
├── store.css                        # Storefront Theme Tokens & Styles
└── layout.tsx                       # Root Layout (Fonts, Global Metadata)
```

---

## 5. Proxy Routing Decision Table

| # | Incoming Hostname | Incoming Path | Cookie Present? | M2M Token? | Proxy Action | Rewritten Destination | Status Code |
|---|---|---|:---:|:---:|---|---|:---:|
| 1 | `app.<domain>` | `/` | YES | N/A | Rewrite | `/admin` | `200` |
| 2 | `app.<domain>` | `/` | NO | N/A | Redirect | `/admin/login?redirect=%2F` | `307` |
| 3 | `app.<domain>` | `/admin` | NO | N/A | Redirect | `/admin/login?redirect=%2Fadmin` | `307` |
| 4 | `app.<domain>` | `/admin/login` | ANY | N/A | Pass-through | `/admin/login` | `200` |
| 5 | `app.<domain>` | `/login` | ANY | N/A | Pass-through | `/login` | `200` |
| 6 | `app.<domain>` | `/api/data` | ANY | ANY | Pass-through (Auth evaluated in API) | `/api/data` | `200` |
| 7 | `app.<domain>` | `/api/bambu/sync`| ANY | ANY | Pass-through (Auth evaluated in API) | `/api/bambu/sync` | `200` |
| 8 | `app.<domain>` | `/store/*` | ANY | N/A | Redirect | `https://www.<domain>/store/*` | `308` |
| 9 | `www.<domain>` | `/` | ANY | N/A | Rewrite | `/store` | `200` |
| 10| `www.<domain>` | `/products` | ANY | N/A | Rewrite | `/store/products` | `200` |
| 11| `www.<domain>` | `/products/:slug`| ANY | N/A | Rewrite | `/store/products/:slug` | `200` |
| 12| `www.<domain>` | `/quote` | ANY | N/A | Rewrite | `/store/quote` | `200` |
| 13| `www.<domain>` | `/api/store/*` | ANY | N/A | Pass-through | `/api/store/*` | `200` |
| 14| `www.<domain>` | `/admin/*` | ANY | N/A | Block (Perimeter reject) | N/A | `404` |
| 15| `www.<domain>` | `/api/data` | ANY | ANY | Block (Perimeter reject) | N/A | `404` |
| 16| `www.<domain>` | `/api/bambu/*` | ANY | ANY | Block (Perimeter reject) | N/A | `404` |
| 17| `<domain>` (Apex) | `/*` | ANY | N/A | Redirect | `https://www.<domain>/*` | `308` |
| 18| Unknown Host | `/*` | ANY | N/A | Block (Default-deny) | N/A | `400` |

---

## 6. Approval Gate & Next Steps

This route map defines the exact request paths, parameters, authentication rules, and file mappings for Phase 2. Implementation will begin with Phase 2.1 upon explicit user authorization.
