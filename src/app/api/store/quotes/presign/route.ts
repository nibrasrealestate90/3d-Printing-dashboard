import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/db';
import { checkRateLimit, extractClientIp } from '@/lib/auth';
import { validateStorefrontOrigin } from '@/lib/origin';
import {
  getR2Config,
  validateCadFile,
  generateStorageKey,
  generatePresignedPutUrl,
} from '@/lib/r2';

export const dynamic = 'force-dynamic';

/**
 * Public CAD File Upload Pre-Signing & Upload-Intent API
 *
 * Security Invariants:
 * - Enforces Storefront Origin validation on all browser mutations
 * - Protected by IP rate limiting (5 / hour)
 * - Strict CAD file extension whitelist: .step, .stp, .stl, .3mf, .obj
 * - Strict file size boundary: max 50 MB
 * - Generates server-controlled storage key (never accepts client-supplied keys)
 * - Creates atomic upload intent in public.store_upload_intents bound to token hash
 * - Issues cryptographically random 256-bit upload token (never stores plaintext token)
 * - Cryptographically binds Content-Type into SigV4 signed headers
 * - Honest unconfigured state: Returns HTTP 503 without faking upload when R2 credentials are absent
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Enforce Storefront Origin Policy (Cross-Site Request Forgery Defense)
    const originCheck = validateStorefrontOrigin(req);
    if (!originCheck.valid) {
      return NextResponse.json(
        {
          error: 'FORBIDDEN_ORIGIN',
          message: originCheck.reason || 'Cross-origin submission rejected.',
        },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (!sql) {
      return NextResponse.json(
        { error: 'DATABASE_UNAVAILABLE', message: 'Database service is currently unreachable.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const clientIp = extractClientIp(req);

    // 2. Sliding Window Rate Limiting (5 requests per hour per IP)
    const rateLimit = await checkRateLimit(`quote_presign:${clientIp}`, 5, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000));
      return NextResponse.json(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many upload pre-sign requests from this IP address. Please try again later.',
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds),
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 3. Parse & Validate Payload
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'INVALID_JSON', message: 'Malformed JSON payload.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const fileName = body?.fileName;
    const fileSizeBytes = Number(body?.fileSizeBytes);
    const mimeType = body?.mimeType;

    const validation = validateCadFile(fileName, fileSizeBytes, mimeType);
    if (!validation.valid || !validation.extension || !validation.canonicalMime) {
      return NextResponse.json(
        {
          error: 'INVALID_FILE',
          message: validation.error || 'CAD file validation failed.',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 4. Inspect Private Storage Backend Configuration (Cloudflare R2)
    const r2Config = getR2Config();
    if (!r2Config) {
      // Honest unconfigured state: Never fake uploads when infrastructure credentials are not present
      return NextResponse.json(
        {
          error: 'STORAGE_UNAVAILABLE',
          message:
            'Direct CAD upload storage (Cloudflare R2) is not configured on this environment. Direct CAD file upload is currently disabled.',
          storageConfigured: false,
          requiredPrerequisites: [
            'R2_ACCOUNT_ID',
            'R2_ACCESS_KEY_ID',
            'R2_SECRET_ACCESS_KEY',
            'R2_BUCKET_NAME',
          ],
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 5. Generate Server-Controlled Storage Key & 256-Bit Upload Token
    const storageKey = generateStorageKey(fileName);
    const uploadToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(uploadToken).digest('hex');

    const expiresInSeconds = 600; // 10 minutes
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // 6. Persist Server-Controlled Upload Intent in PostgreSQL
    await sql`
      INSERT INTO public.store_upload_intents (
        storage_key,
        token_hash,
        file_name,
        file_size_bytes,
        mime_type,
        file_extension,
        status,
        client_ip,
        expires_at
      ) VALUES (
        ${storageKey},
        ${tokenHash},
        ${fileName.trim()},
        ${fileSizeBytes},
        ${validation.canonicalMime},
        ${validation.extension},
        'PENDING',
        ${clientIp},
        ${expiresAt.toISOString()}
      );
    `;

    // 7. Generate Pre-Signed S3/R2 PUT URL with Content-Type Cryptographically Bound
    const uploadUrl = generatePresignedPutUrl(
      r2Config,
      storageKey,
      validation.canonicalMime,
      expiresInSeconds
    );

    return NextResponse.json(
      {
        success: true,
        uploadUrl,
        uploadToken,
        expiresInSeconds,
        fileName: fileName.trim(),
        fileSizeBytes,
        mimeType: validation.canonicalMime,
        requiredHeaders: {
          'Content-Type': validation.canonicalMime,
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    console.error('Error in POST /api/store/quotes/presign:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to generate CAD upload pre-signed URL.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
