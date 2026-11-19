# PHASE 2.0 SECURITY BOUNDARIES & THREAT MODEL (REVISED v2.0.1)
**Multi-Tier Defense-in-Depth, Subdomain Isolation & API Guard Architecture**

- **Document Identifier:** `docs/PHASE_2_SECURITY_BOUNDARIES.md`
- **System Name:** Print Studio Ledger (`print-studio-app`)
- **Version:** 2.0.1-CORRECTED
- **Date:** 2026-11-18
- **Classification:** Principal Software Security Specification (READ-ONLY)
- **Status:** **APPROVED FOR PHASE 2.1 PENDING USER AUTHORIZATION**

---

## 1. Executive Security Architecture

Print Studio Ledger unifies public customer interactions and private manufacturing operations within a single application codebase while establishing absolute architectural boundaries.

```
                                    EXTERNAL THREAT SURFACE
                                               │
+──────────────────────────────────────────────▼──────────────────────────────────────────────+
| TIER 0: PERIMETER EDGE DEFENSE (Cloudflare Anycast Network & WAF)                            |
|                                                                                             |
| • DDoS Mitigation (L3/L4/L7 volumetric attack absorption)                                   |
| • Edge TLS 1.3 Termination & HSTS enforcement                                              |
| • Cloudflare Bot Management & Managed Challenge for automated scrapers                      |
| • Host Header validation (Rejects arbitrary SNI & spoofed host requests)                    |
+─────────────────────────────────────────────────────────────────────────────────────────────+
                                               │
                                               ▼
+─────────────────────────────────────────────────────────────────────────────────────────────+
| TIER 1: INGRESS PROXY GATEWAY (Next.js 16 src/proxy.ts in Node.js Runtime)                  |
|                                                                                             |
| • Exact Allowlisted Hostname Matching: Rejects unmapped virtual hosts with HTTP 400/404    |
| • Perimeter Navigation Bouncing: Redirects unauthenticated browser GET hits on app to /login|
| • Perimeter Boundary Check: Blocks /admin & /api/data on www.<domain>                        |
| • Safe Internal Rewriting: Rewrites to concrete paths (/admin, /store)                      |
| • NON-AUTHORITATIVE: Proxy is NEVER the sole security control for private data             |
+─────────────────────────────────────────────────────────────────────────────────────────────+
                                               │
                                               ▼
+─────────────────────────────────────────────────────────────────────────────────────────────+
| TIER 2: AUTHORITATIVE APPLICATION GUARDS (Server Components & Route Handlers)               |
|                                                                                             |
| • Layout-Level Session Guard: src/app/admin/layout.tsx verifies session before rendering    |
| • Dual-Gate API Auth: requireAdminSession() OR Timing-Safe validateM2MToken()              |
| • Strict CSRF Defense: validateOrigin() rejects state mutations without valid Origin/Referer|
| • Storefront Whitelist Projection: Type-safe JSONB query + zero internal cost leakage       |
| • Dual-Key Rate Limiting: Hard IP limit + progressive account failure delay (No DoS lockout)|
+─────────────────────────────────────────────────────────────────────────────────────────────+
                                               │
                                               ▼
+─────────────────────────────────────────────────────────────────────────────────────────────+
| TIER 3: DATA PERSISTENCE & STORAGE SECURITY (Neon PostgreSQL 18.7 & Private R2)             |
|                                                                                             |
| • Database-Backed Sessions: SHA-256 token digests, database revocation & expiry checks       |
| • Argon2id Passwords: 64MB memory, 3 iterations, 4 parallelism, CSPRNG salts               |
| • Append-Only Audit Logging: Immutable security events recorded in public.audit_logs        |
| • Private Cloudflare R2 Bucket: Zero public bucket access; 15-minute presigned download URLs|
| • Manufacturing Immutability: Engine 1 (ledger_collections) locked against public mutations |
+─────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 2. Comprehensive STRIDE Threat Model

| Threat Category | Specific Attack Vector | Severity | Mitigating Security Control | Verification Protocol |
|---|---|:---:|---|---|
| **S**poofing | **Host Header Poisoning:** Attacker sends `Host: evil.com` to manipulate rewrites or cache keys. | High | `src/proxy.ts` strips ports and strictly validates `Host` against an exact allowlist (`ALLOWED_APP_HOSTS`, `ALLOWED_STORE_HOSTS`, `ALLOWED_APEX_HOSTS`). Unmapped hosts are rejected with HTTP 400. | `tests/verify-phase2-proxy.ts` (Test 1) |
| **S**poofing | **Session Token Forgery:** Attacker attempts to forge or brute-force administrative session cookies. | Critical | Tokens generated with 256 bits of entropy (`crypto.randomBytes(32)`). Stored exclusively as SHA-256 digests in Neon PostgreSQL. | `tests/verify-phase1-auth.ts` (Test 2) |
| **S**poofing | **M2M Secret Forgery & Side-Channel:** Attacker attempts timing attacks on Bearer API keys. | High | Evaluated using constant-time `crypto.timingSafeEqual()`. Raw secrets never stored on server (only SHA-256 digest in environment). | `tests/verify-phase2-guards.ts` (Test 4) |
| **T**ampering | **Cross-Site Request Forgery (CSRF):** Malicious site submits state-mutating requests via admin's ambient cookie. | Critical | `validateOrigin()` checks `Origin`/`Referer` against `Host` and protocol for all non-idempotent methods (`POST`, `PUT`, `DELETE`). Zero Bearer exemptions for session auth. Cookies use `SameSite: Lax`. | `tests/verify-phase1-2-1.ts` (Test 3) |
| **T**ampering | **Subdomain Cookie Tossing:** Malicious script on customer storefront overwrites admin session cookie. | Critical | In production, session cookie uses RFC 6265bis `__Host-admin_session` prefix (`Secure; Path=/; Domain` omitted). Browsers refuse cross-subdomain writes. | Automated Cookie Audit |
| **R**epudiation | **Untracked Ledger Mutations:** Administrator denies deleting prints or modifying Bambu tokens. | Medium | All authentications, logouts, rate limits, and M2M sync invocations write immutable rows to `public.audit_logs` recording user ID, IP, user-agent, and timestamp. | `tests/verify-phase1-auth.ts` (Test 8) |
| **I**nformation Disclosure | **Internal Cost Data Leakage:** Storefront API accidentally exposes manufacturing costs, profit margins, or supplier info. | Critical | Type-safe JSONB query + strict whitelist projection (`sanitizeProductForStorefront`). Sensitive attributes (`materialCost`, `electricityCost`, `bambuPlateId`) are redacted. | `tests/verify-phase2-store.ts` (Test 2) |
| **I**nformation Disclosure | **Bambu Token Leakage:** Bambu Cloud tokens leaked via public API. | Critical | `/api/data` masks Bambu tokens (`••••••••`). `/api/data` is inaccessible from `www.<domain>` (perimeter block + authoritative API session check). | `tests/verify-phase1-3.ts` (Test 17) |
| **I**nformation Disclosure | **CAD File Exfiltration:** Competitor accesses another customer's proprietary CAD models. | Critical | R2 bucket is strictly private (no public URLs). File access requires time-limited pre-signed download URLs generated only for authenticated administrators. | `tests/verify-phase2-store.ts` (Test 8) |
| **D**enial of Service | **Account Lockout DoS:** Attacker repeatedly enters admin email with wrong passwords to lock out legitimate admin. | High | Bounded progressive throttling (0ms–2000ms delay) replaces account lockouts. Legitimate admin can always authenticate concurrently (Remediation A). | `tests/verify-phase1-2-1.ts` (Test 2) |
| **D**enial of Service | **Storefront RFQ / Enquiry Spam:** Bot floods the database with thousands of bogus CAD quote requests. | Medium | Dual-key IP rate limiter allows max 3 quote requests per hour and 5 enquiries per hour per IP. 50 MB upload size limit enforced during pre-signing. | `tests/verify-phase2-store.ts` (Test 5) |
| **E**levation of Privilege | **Unauthenticated Ledger Access:** Attacker queries `/api/data` directly over the internet. | Critical | Authoritative API Guard: `requireAdminSession()` rejects requests lacking a verified session cookie or valid Bearer M2M key with HTTP 401. | `tests/verify-phase2-guards.ts` (Test 1) |

---

## 3. Subdomain Isolation & Cookie Security (RFC 6265bis)

### 3.1 The Vulnerability of Domain Cookies
If a session cookie is configured with `Domain=.example.com`:
- The browser transmits the cookie to `app.example.com`, `www.example.com`, and any untrusted subdomains.
- Any XSS flaw or third-party widget on the public storefront could read or hijack the admin session.

### 3.2 The `__Host-` Prefix Defense
In production, the cookie is set as:
```http
Set-Cookie: __Host-admin_session=5Jz8...; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=604800
```

#### RFC 6265bis Invariants:
1. **No Domain Attribute:** Must not specify a `Domain` attribute (strictly locks cookie to the exact origin `app.<domain>`).
2. **Secure Flag Mandatory:** Must be sent over TLS (HTTPS). Browsers reject insecure `__Host-` cookies.
3. **Subdomain Immunity:**
   - The cookie is **never transmitted** by the browser when visiting `www.<domain>`.
   - A script on `www.<domain>` cannot read, modify, or toss a cookie for `app.<domain>`.

---

## 4. Open Redirect Prevention & Return URL Sanitization

When an unauthenticated user visits a protected URL on `app.<domain>`, they are bounced:
```
https://app.example.com/login?redirect=...
```

### Sanitization Algorithm:
```typescript
export function sanitizeReturnUrl(returnUrl: string | null): string {
  if (!returnUrl) return '/';

  try {
    const trimmed = decodeURIComponent(returnUrl).trim();

    // 1. Must start with a single forward slash
    if (!trimmed.startsWith('/')) return '/';

    // 2. Reject protocol-relative URLs (e.g. //evil.com)
    if (trimmed.startsWith('//')) return '/';

    // 3. Reject Windows-style backslash bypasses (e.g. /\evil.com)
    if (trimmed.startsWith('/\\')) return '/';

    // 4. Reject control characters and newlines (CRLF injection)
    if (/[\r\n\t\0]/.test(trimmed)) return '/';

    // 5. Verify the URL parses as a valid relative pathname
    const parsed = new URL(trimmed, 'https://localhost');
    if (parsed.origin !== 'https://localhost') return '/';

    return parsed.pathname + parsed.search;
  } catch {
    return '/';
  }
}
```

---

## 5. Machine-to-Machine (M2M) Authentication Protocol

### 5.1 Protocol Specification

1. **Header Requirement:** Dedicated Bearer token:
   ```http
   Authorization: Bearer <BAMBU_M2M_SECRET>
   ```
2. **Zero Browser JavaScript Exposure:**
   - The secret is NEVER prefixed with `NEXT_PUBLIC_`.
   - The secret is NEVER included in client bundles.
   - It is provided strictly to external server automation (Vercel Cron, GitHub Actions) via secret vaults.
3. **Cryptographic Storage:**
   - The application stores ONLY the SHA-256 digest in environment variable `BAMBU_M2M_API_KEY_HASH`.
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
5. **Scoped Permissions:**
   - The M2M token is authorized strictly for `bambu:sync` and `ledger:read_status`. It cannot create users, change settings, or access admin session data.
6. **Key Rotation & Revocation:**
   - Evaluates `BAMBU_M2M_API_KEY_HASH_CURRENT` and `BAMBU_M2M_API_KEY_HASH_PREVIOUS` to enable zero-downtime rotation.
   - Instant revocation by clearing the environment variable.
7. **Rate Limiting & Audit:**
   - Max 1 invocation every 60 seconds per IP.
   - Writes immutable log entry with `action: 'M2M_BAMBU_SYNC'` in `public.audit_logs`.

---

## 6. Public Storefront Data Safety & Version 1 Scope

### 6.1 Version 1 Enquiry-Only Boundaries
- **NO Shopping Cart.**
- **NO Buy Now Buttons.**
- **NO Checkout Pages.**
- **NO Online Payment Gateways.**
Customers browse products and submit enquiries or custom print quotation requests.

### 6.2 Type-Safe JSONB Product Queries
To prevent casting errors when `published` is missing or invalid:
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

### 6.3 Explicit Public Product Whitelist

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
```

#### Strictly Redacted Internal Attributes:
- `materialCost`, `electricityCost`, `machineHourlyRate`, `laborCost`
- `profitMargin`, `internalCost`, `minSellingPrice`
- `slicerSettings`, `bambuPlateId`, `printerId`, `gcodeFile`
- `supplierName`, `supplierPartNumber`, `filamentSpoolId`
- `totalPrinted`, internal manufacturing notes

### 6.4 Secure CAD Upload Pipeline & Private R2 Storage
1. **File Type Whitelist:** Restricted to `.step`, `.stp`, `.stl`, `.3mf`, and `.obj`. Executables and scripts are rejected.
2. **File Size Limit:** Strictly bounded to **50 MB** per upload.
3. **Pre-Signed Upload URL Pipeline:**
   - Client requests pre-signed URL via `POST /api/store/quotes/presign`.
   - Server returns short-lived (10 min) pre-signed PUT URL to private Cloudflare R2 bucket.
   - Client uploads directly to R2, avoiding server memory buffering.
4. **Access Control:** The R2 bucket is strictly private (no public URLs). Download URLs are generated only for authenticated administrators via `requireAdminSession()` (valid for 15 minutes).
5. **Retention Policy:**
   - Abandoned/unquoted files purged after 30 days.
   - Quoted and accepted job files archived after 90 days.

---

## 7. Rate Limiting & Abuse Prevention Policies

| Endpoint | Target Host | Rate Limit Policy | Key Scheme | Action on Limit |
|---|---|---|---|---|
| `POST /api/admin/auth/login` | `app.<domain>` | 5 attempts per 15 minutes | `auth_ip:${clientIp}` | HTTP 429 with `Retry-After: 900` |
| `POST /api/admin/auth/login` | `app.<domain>` | Progressive delay (0–2000ms) | `auth_acct:${email}` | Bounded artificial latency (No DoS) |
| `POST /api/store/enquiries` | `www.<domain>` | 5 submissions per hour | `store_enquiry_ip:${clientIp}` | HTTP 429 with `Retry-After: 3600` |
| `POST /api/store/quotes` | `www.<domain>` | 3 RFQs per hour | `store_quote_ip:${clientIp}` | HTTP 429 with `Retry-After: 3600` |
| `GET /api/store/products` | `www.<domain>` | 120 requests per minute | `store_catalog_ip:${clientIp}` | Cloudflare Edge Caching |
| `GET /api/data?status=1` | `app.<domain>` | 30 requests per minute | `session:${sessionId}` | Internal polling allowance |

---

## 8. Approval Gate & Next Steps

This security specification establishes the authoritative security boundaries, STRIDE mitigations, and data sanitization rules for Phase 2. Implementation will begin with Phase 2.1 upon explicit user authorization.
