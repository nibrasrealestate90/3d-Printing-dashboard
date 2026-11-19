# PHASE 2.4.1 — CONSOLIDATED PRODUCTION SECURITY REMEDIATION REPORT

**Role:** Principal Full-Stack Security Engineer  
**Project:** `print-studio-app`  
**Phase:** 2.4.1 (Consolidated Production Security Remediations)  
**Date:** November 18, 2026  
**Status:** COMPLETE — 100% VERIFIED & BUILD PASSED  
**Baseline Verification:** 371 rows preserved, SHA-256 `d39c74285d77c00a33500f02be7595c9e495b999e2956879f2dd134e6232ef62` (100.0% match)

---

## 1. Executive Summary

In accordance with authorization guidelines, **Phase 2.4.1 only** was implemented to remediate all six security findings identified in `docs/PHASE_2_4_INDEPENDENT_REVIEW.md`.

All six remediations have been implemented, verified through an exhaustive test battery, checked with TypeScript (`tsc --noEmit` exited with code 0), and built for production (`next build` compiled all 25 application routes successfully). Zero lines of code were modified in `src/components/ledgerCore.js`, Bambu Cloud synchronization routes and contracts remain completely intact, and the 371 baseline production records in `public.ledger_collections` remain bit-for-bit preserved.

---

## 2. Remediation Compliance Matrix

| Finding ID | Severity | Finding Summary | Remediation Mechanism | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **F-01** | **CRITICAL** | **Unauthenticated Upload & Capability Abuse:** Client-selected `storageKey` allowed arbitrary path association and tokenless linking. | Implemented server-controlled upload intents (`public.store_upload_intents`), unpredictable storage keys, 256-bit ephemeral tokens hashed with SHA-256, and single-use capability verification. Client-supplied `storageKey` is strictly rejected (`CLIENT_STORAGE_KEY_FORBIDDEN`). | **VERIFIED** (Tests 1, 2, 5, 6, 7, 8) |
| **F-02** | **HIGH** | **Token Replay & Cross-Customer Hijacking:** Reusing storage keys or tokens across quote requests. | Single-use token enforcement backed by transactional row-locking (`FOR UPDATE`) in PostgreSQL. Status transitions atomically from `PENDING`/`UPLOADED` to `CONSUMED`. Replays return HTTP 400 `TOKEN_ALREADY_CONSUMED`; race conditions return HTTP 409 `CONCURRENT_TOKEN_CONSUMPTION`. | **VERIFIED** (Tests 5, 6, 7, 11) |
| **F-03** | **HIGH** | **Non-Atomic Persistence & Orphan Attachments:** Quote creation and attachment linking were separate queries prone to partial failure. | Implemented interactive transaction helper `withTransaction()` in `src/lib/db.ts` utilizing `@neondatabase/serverless` `Client` (`BEGIN / COMMIT / ROLLBACK`). Quote insertion, attachment row, and intent consumption execute in a single atomic transaction. | **VERIFIED** (Tests 11, 12) |
| **F-04** | **HIGH** | **Storefront CSRF & Missing Origin Policy:** Mutation endpoints (`/api/store/enquiries`, `/api/store/quotes/presign`, `/api/store/quotes`) lacked Origin checks. | Created reusable `validateStorefrontOrigin(req)` in `src/lib/origin.ts`. Requires exact scheme, host, and port matching against trusted storefront origins. Rejects missing, `null`, malformed, and third-party origins with HTTP 403 `FORBIDDEN_ORIGIN`. | **VERIFIED** (Tests 13, 14, 15, 16) |
| **F-05** | **MEDIUM** | **Product Image Sanitization Defect:** Permitted dangerous schemes and did not restrict HTTP to localhost in development. | Implemented `sanitizeImageUrl(rawUrl)` in `src/lib/storefront.ts`. Enforces HTTPS-only in production, permits HTTP only for `localhost`/`127.0.0.1`/`*.lvh.me` in development, and strictly strips `javascript:`, `data:`, `file:`, protocol-relative `//`, backslashes `\`, and control characters to `null`. | **VERIFIED** (Tests 17, 18) |
| **F-06** | **MEDIUM** | **Fragile Migration SQL Splitter:** Regex split on `;` truncated statements with line comments or quotes. | Replaced regex parser in `scripts/migrate.ts` with state-machine tokenizer `splitSqlStatements(content)`. Safely tokenizes line comments (`--`), nested block comments (`/* ... */`), single-quoted strings (`'...'`), double-quoted identifiers (`"..."`), and PostgreSQL dollar-quoted blocks (`$$...$$`). | **VERIFIED** (Test 19) |

---

## 3. Architecture & Implementation Details

### 3.1. Server-Controlled CAD Upload Intent Lifecycle

The vulnerable client-selected storage key model has been replaced with a secure, server-controlled capability token model:

```
[Browser Client]               [Next.js Server API]                  [PostgreSQL DB]                [Cloudflare R2]
       |                                |                                   |                               |
  1.   |-- POST /quotes/presign ------->|                                   |                               |
       |   { fileName, fileSizeBytes }  |-- validateCadFile()               |                               |
       |                                |-- generateStorageKey()            |                               |
       |                                |-- crypto.randomBytes(32) [token]  |                               |
       |                                |-- INSERT store_upload_intents --->|                               |
       |                                |    (storage_key, token_hash)      |                               |
       |                                |-- generatePresignedPutUrl() ----->|                               |
       |<-- { uploadUrl, uploadToken } -|                                   |                               |
       |                                                                                                    |
  2.   |--------------------------- PUT file bytes to uploadUrl (SigV4) ----------------------------------->|
       |                                                                                                    |
  3.   |-- POST /quotes ---------------->|                                                                  |
       |   { ..., uploadToken }         |-- hash token (SHA-256)                                            |
       |                                |-- SELECT store_upload_intents ---->|                              |
       |                                |-- verifyUploadedObject() ---------------------------------------->|
       |                                |   (HEAD request for size, MIME)                                   |
       |                                |-- BEGIN TRANSACTION ------------->|                              |
       |                                |-- INSERT store_quote_requests ---->|                              |
       |                                |-- INSERT store_quote_files ------>| (scan_status: 'QUARANTINED')  |
       |                                |-- UPDATE store_upload_intents --->| (status: 'CONSUMED')          |
       |                                |-- COMMIT TRANSACTION ------------>|                               |
       |<-- HTTP 201 { rfqReference } --|                                   |                               |
```

1. **Storage Key Isolation:** The client never dictates the storage path. The server generates an unpredictable key prefixed with `uploads/rfq/` followed by timestamp, 16 cryptographically random bytes, and a sanitized filename.
2. **Capability Token:** The server issues an ephemeral 256-bit random hex string (`uploadToken`). Only its SHA-256 hash is persisted in `public.store_upload_intents`.
3. **Pre-Signed PUT URL Binding:** AWS SigV4 URL generation binds both `content-type` and `host` into `X-Amz-SignedHeaders`. Any tampering with the Content-Type header invalidates the signature at Cloudflare R2 edge.
4. **Honest Storage Fallback:** When R2 credentials are not configured (local dev/staging), the presign endpoint returns an honest HTTP 503 (`STORAGE_UNAVAILABLE`, `storageConfigured: false`, and `requiredPrerequisites` list). Faked URLs are strictly prohibited.
5. **Independent Server-Side Object Verification:** Before database association, `verifyUploadedObject` inspects the object via an authenticated SigV4 `HEAD` request to Cloudflare R2, ensuring the object exists, does not exceed 50 MB, and matches the declared size.
6. **Quarantine Classification:** Files attached to quotes are inserted with `scan_status = 'QUARANTINED'`, preventing operator download until an external antivirus/malware scanner inspects the payload.

### 3.2. S3 SigV4 Pre-Signed PUT Limitations Analysis

An important technical finding during implementation concerns AWS S3 SigV4 query-string presigning limitations:
- **SigV4 Query-String Presigning:** Signs request headers that will be transmitted by the client. In browser environments uploading directly via `fetch()` or `XMLHttpRequest`, browsers do not permit setting arbitrary custom headers without triggering complex CORS preflight negotiations.
- **Content-Length Header Limitation:** The S3 API signs `Content-Type` and `host`. It does not sign `Content-Length` as a mandatory signature header on pre-signed query strings because client browsers compute Content-Length at transit time.
- **Architectural Defense:** Because a malicious client could theoretically upload a file larger than declared in the presign step, client-side or presign-time checks alone are insufficient. The server-side `HEAD` inspection (`verifyUploadedObject`) before database association is the authoritative defense against oversized or phantom uploads.

### 3.3. Database Migration 0003: `store_upload_intents`

Migration `migrations/0003_phase2_upload_intents.sql` was executed within transactional advisory lock `742910` in 790ms:

```sql
CREATE TABLE IF NOT EXISTS public.store_upload_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_key VARCHAR(500) UNIQUE NOT NULL,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    mime_type VARCHAR(100) NOT NULL,
    file_extension VARCHAR(10) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'UPLOADED', 'CONSUMED', 'EXPIRED', 'REJECTED')),
    quote_id UUID REFERENCES public.store_quote_requests(id) ON DELETE SET NULL,
    client_ip VARCHAR(45),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_upload_intents_token_hash ON public.store_upload_intents(token_hash);
CREATE INDEX IF NOT EXISTS idx_store_upload_intents_status ON public.store_upload_intents(status);
CREATE INDEX IF NOT EXISTS idx_store_upload_intents_expires_at ON public.store_upload_intents(expires_at);
CREATE INDEX IF NOT EXISTS idx_store_upload_intents_quote_id ON public.store_upload_intents(quote_id);

ALTER TABLE public.store_quote_files
    ADD COLUMN IF NOT EXISTS upload_intent_id UUID REFERENCES public.store_upload_intents(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS scan_status VARCHAR(30) NOT NULL DEFAULT 'UNSCANNED';
```

### 3.4. Interactive Database Transactions via `withTransaction()`

Neon's HTTP client (`neon(DATABASE_URL)`) executes each query in an auto-commit HTTP transaction. Interactive multi-statement transactions requiring `BEGIN / COMMIT / ROLLBACK` must use `Client` from `@neondatabase/serverless`:

```typescript
export async function withTransaction<T>(
  callback: (client: Client) => Promise<T>
): Promise<T> {
  const connectionString = getDatabaseUrl();
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('BEGIN;');
    const result = await callback(client);
    await client.query('COMMIT;');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK;');
    } catch {
      // rollback error suppressed to rethrow original error
    }
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}
```

This guarantees that RFQ insertion, file attachment, and upload intent consumption succeed or fail together.

### 3.5. Storefront Origin Policy Enforcement

`validateStorefrontOrigin(req)` in `src/lib/origin.ts`:
- Extracts and validates the `Origin` header.
- Rejects missing `Origin` headers on mutation endpoints (`POST`).
- Rejects `null` origins (sandboxed iframes / data URIs).
- In production, enforces HTTPS and exact domain matching against configured storefront domains (`printstudio.ae`, `www.printstudio.ae`).
- In development, permits exact local dev origins (`http://localhost:3000`, `http://127.0.0.1:3000`, `http://*.lvh.me:3000`).
- Rejects third-party origins (`https://evil-attacker.com`) with HTTP 403 `FORBIDDEN_ORIGIN`.

### 3.6. Product Image URL Sanitization

`sanitizeImageUrl(rawUrl)` in `src/lib/storefront.ts`:
- Rejects non-string inputs, empty values, control characters (`\u0000-\u001f`, `\u007f-\u009f`), and backslashes (`\`).
- Permits safe local relative paths starting with `/` (excluding protocol-relative `//` and traversal `..`).
- Enforces HTTPS-only in production.
- Permits HTTP in development strictly for `localhost`, `127.0.0.1`, and `*.lvh.me`.
- Neutralizes `javascript:`, `data:`, `file:`, `blob:`, and unapproved cross-origin HTTP URLs to `null`.

### 3.7. SQL Migration Statement Tokenizer

`splitSqlStatements(content)` in `scripts/migrate.ts`:
- Tokenizes SQL character by character using a finite state machine.
- Accurately tracks:
  - Single-line comments (`-- ... \n`)
  - Multi-line and nested block comments (`/* ... /* ... */ ... */`)
  - Single-quoted strings with escaped quotes (`'don''t; split'`)
  - Double-quoted identifiers (`"column;name"`)
  - PostgreSQL dollar-quoted blocks (`$$ BEGIN ...; END; $$` or `$tag$ ...; $tag$`)
- Statements are split strictly on unquoted, uncommented semicolons.

---

## 4. Comprehensive Verification Results

### 4.1. Automated Verification Scorecard

Every test across all phases was executed against the running dev server and PostgreSQL database:

| Suite Name | Scope | Total Tests | Passed | Failed | Success Rate |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `tests/verify-phase2-4-1-remediation.ts` | Phase 2.4.1 Security Remediations | 20 | 20 | 0 | **100.0%** |
| `tests/verify-phase2-4-store.ts` | Phase 2.4 Storefront Foundation | 20 | 20 | 0 | **100.0%** |
| `tests/verify-phase2-3-workspace.ts` | Phase 2.3 Workspace & Route Protection | 11 | 11 | 0 | **100.0%** |
| `tests/verify-phase2-auth-api.ts` | Phase 2.2.1 Auth API & M2M Protection | 11 | 11 | 0 | **100.0%** |
| `tests/verify-phase2-proxy.ts` | Phase 2.1 Perimeter Proxy Routing | 15 | 15 | 0 | **100.0%** |
| `tests/verify-phase1-3.ts` | Phase 1.3 Administrator Login UI | 20 | 20 | 0 | **100.0%** |
| `tests/verify-phase1-2-1.ts` | Phase 1.2.1 Remediation Hardening | 19 | 19 | 0 | **100.0%** |
| `tests/verify-phase1-hardened.ts` | Phase 1.2 Security Hardening | 16 | 16 | 0 | **100.0%** |
| `tests/verify-phase1-auth.ts` | Phase 1 Authentication Foundation | 22 | 22 | 0 | **100.0%** |
| **TOTAL** | **Entire Test Suite Battery** | **154** | **154** | **0** | **100.0%** |

### 4.2. Phase 2.4.1 Detailed Test Log (`verify-phase2-4-1-remediation.ts`)

```
========================================================================
  PHASE 2.4.1 — PRODUCTION SECURITY REMEDIATIONS VERIFICATION
========================================================================

--- Section 1: Secure CAD Upload Lifecycle & Capability Tokens ---
 ✅ [Req 1] Capability Model: Client-Specified storageKey Strictly Rejected (HTTP 400): PASS
 ✅ [Req 2] Server Storage Keys: Unpredictable, Cryptographically Random, and Path-Sanitized: PASS
 ✅ [Req 3] SigV4 URL Integrity: Content-Type and Host Bound into X-Amz-SignedHeaders: PASS
 ✅ [Req 4] Honest Fallback: Presign API Returns HTTP 503 STORAGE_UNAVAILABLE When R2 Is Unconfigured: PASS
 ✅ [Req 5] Token Lifecycle: Single-Use Token Consumed and File Marked QUARANTINED in Database: PASS
 ✅ [Req 6] Anti-Replay Defense: Re-submitting Consumed Token Strictly Rejected (HTTP 400): PASS
 ✅ [Req 7] Session Expiration Defense: Expired Upload Intent Rejected (HTTP 400 EXPIRED_UPLOAD_TOKEN): PASS
 ✅ [Req 8] Token Authenticity: Unrecognized Random Token Rejected (HTTP 400 INVALID_UPLOAD_TOKEN): PASS

--- Section 2: Independent Server-Side Object Verification ---
 ✅ [Req 9] Storage Verification: Phantom/Missing Object in Storage Fails Association (HTTP 400): PASS
 ✅ [Req 10] Storage Verification: Oversized Object Detected by Server HEAD Inspection Fails Association: PASS

--- Section 3: Atomic PostgreSQL Transaction Guarantees ---
 ✅ [Req 11] Atomicity: Failed Quote Request Leaves Intent Unconsumed (PENDING) and Zero Orphan Records: PASS
 ✅ [Req 12] Database Transactions: withTransaction() Rolls Back Cleanly on Thrown Exception: PASS

--- Section 4: Storefront Origin Policy Enforcement ---
 ✅ [Req 13] Origin Policy: Missing Origin Header on Mutation Endpoints Returns HTTP 403 FORBIDDEN_ORIGIN: PASS
 ✅ [Req 14] Origin Policy: Untrusted Third-Party Origin (https://evil-attacker.com) Rejected (HTTP 403): PASS
 ✅ [Req 15] Origin Policy: Sandboxed / null Origin Rejected (HTTP 403 FORBIDDEN_ORIGIN): PASS
 ✅ [Req 16] Origin Policy: Exact Storefront Domain (http://www.lvh.me:3000) Allowed Mutation Access: PASS

--- Section 5: Product Image URL Sanitization ---
 ✅ [Req 17] Image Sanitization: Valid https:// and Safe Local Relative / Paths Preserved: PASS
 ✅ [Req 18] Image Sanitization: javascript:, data:, file:, protocol-relative //, and Backslashes Stripped: PASS

--- Section 6: Migration SQL Parser Tokenizer ---
 ✅ [Req 19] SQL Migration Parser: splitSqlStatements Correctly Tokenizes Nested Comments, Quotes, and Dollar Blocks: PASS

--- Section 7: Manufacturing Baseline Integrity ---
 ✅ [Req 20] Baseline Preservation: Exactly 371 Records & Canonical SHA-256 Digest Unchanged: PASS

Total Remediation Tests: 20
Passed:                  20
Failed:                  0
Success Rate:            100.0%
🎉 Phase 2.4.1 Remediation PASSED with 100% success rate.
```

### 4.3. TypeScript Compilation & Next.js Production Build

1. **TypeScript Type Check (`npx tsc --noEmit`):**
   - Result: Code 0 (Zero errors found across 100% of source and test files).
2. **Next.js Production Build (`next build`):**
   - Turbopack compiler: `✓ Compiled successfully in 99s`
   - TypeScript checking: `✓ Finished TypeScript in 12.3s`
   - Page data collection: `✓ Collecting page data using 7 workers in 31.7s`
   - Static page generation: `✓ Generating static pages using 7 workers (25/25) in 321ms`
   - Finalizing optimization: `✓ Finalizing page optimization in 22ms`
   - All 25 routes compiled and operational.

---

## 5. Preservation & Baseline Invariant Verification

```
Database Invariant Verification:
- Total rows in public.ledger_collections: 371
  - prints: 221
  - products: 80
  - filaments: 34
  - filament_stock: 34
  - settings: 2
- Canonical SHA-256 Digest: d39c74285d77c00a33500f02be7595c9e495b999e2956879f2dd134e6232ef62
- Digest Match: 100.0% (BIT-FOR-BIT IDENTICAL)
- src/components/ledgerCore.js: 0 bytes modified
- Live Bambu Cloud Sync: Zero unauthorized POST requests triggered; GET status endpoint intact.
```

---

## 6. Stop Gate & Conclusion

All six security findings from `PHASE_2_4_INDEPENDENT_REVIEW.md` have been fully remediated and verified. The application is completely functional, strictly secured, and ready for release verification.

**STOP GATE:** In accordance with instructions, work halts immediately upon completion of this report. No Phase 2.5 activities have been started.
