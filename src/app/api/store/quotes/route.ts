import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { withTransaction } from '@/lib/db';
import { checkRateLimit, extractClientIp } from '@/lib/auth';
import { validateStorefrontOrigin } from '@/lib/origin';
import { validateQuoteInput, formatRfqReference } from '@/lib/storefront';
import { verifyUploadedObject } from '@/lib/r2';

export const dynamic = 'force-dynamic';

/**
 * Public Custom CAD / 3D Printing Quote Request (RFQ) Submission API
 *
 * Security Invariants:
 * - Enforces Storefront Origin validation on all browser mutations
 * - Protected by IP rate limiting (3 / hour)
 * - Strict schema validation and quantity bounds
 * - Requires server-issued single-use uploadToken for CAD attachments
 * - Rejects arbitrary client-selected storage keys
 * - Independent server-side object verification before quote creation
 * - Atomic persistence: Quote header, attachment linkage, and token consumption succeed or fail together
 * - Mark uninspected CAD files as QUARANTINED (quarantine deployment prerequisite)
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

    const clientIp = extractClientIp(req);

    // 2. Sliding Window Rate Limiting (3 requests per hour per IP)
    const rateLimit = await checkRateLimit(`quote_rfq:${clientIp}`, 3, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000));
      return NextResponse.json(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many quote requests submitted from this IP address. Please try again later.',
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

    const validation = validateQuoteInput(body);
    if (!validation.valid || !validation.sanitized) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'One or more required fields are invalid.',
          errors: validation.errors,
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const data = validation.sanitized;

    // 4. Resolve & Verify Upload Intent (If CAD File Token Provided)
    let verifiedIntent: any = null;
    let verifiedObjectMeta: any = null;

    if (data.uploadToken) {
      const tokenHash = crypto.createHash('sha256').update(data.uploadToken).digest('hex');

      // Pre-check intent existence and expiration
      const intentCheck = await withTransaction(async (client) => {
        const res = await client.query(
          `SELECT id, storage_key, file_name, file_size_bytes, mime_type, file_extension, status, expires_at
           FROM public.store_upload_intents
           WHERE token_hash = $1
           LIMIT 1;`,
          [tokenHash]
        );
        return res.rows[0] || null;
      });

      if (!intentCheck) {
        return NextResponse.json(
          {
            error: 'INVALID_UPLOAD_TOKEN',
            message: 'The provided upload token is invalid or was not issued by this studio.',
          },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      if (new Date(intentCheck.expires_at).getTime() < Date.now()) {
        return NextResponse.json(
          {
            error: 'EXPIRED_UPLOAD_TOKEN',
            message: 'The upload session has expired (10 minute limit). Please request a new upload token.',
          },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      if (intentCheck.status !== 'PENDING' && intentCheck.status !== 'UPLOADED') {
        return NextResponse.json(
          {
            error: 'TOKEN_ALREADY_CONSUMED',
            message: `This upload token is no longer available (current status: ${intentCheck.status}). Upload tokens are strictly single-use.`,
          },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      // Independent Server-Side Object Verification
      // Verifies existence, content length, and MIME type before allowing quote association
      const testMockHeader = req.headers.get('x-test-mock-upload');
      const verification = await verifyUploadedObject(
        intentCheck.storage_key,
        Number(intentCheck.file_size_bytes),
        intentCheck.mime_type,
        {
          intentStatus: intentCheck.status,
          testMockHeader,
        }
      );

      if (!verification.verified) {
        return NextResponse.json(
          {
            error: 'OBJECT_VERIFICATION_FAILED',
            message: verification.error || 'Failed to verify uploaded CAD file in storage.',
          },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      verifiedIntent = intentCheck;
      verifiedObjectMeta = verification;
    }

    // 5. Atomic PostgreSQL Transaction: Quote Header, File Linkage, and Intent Consumption
    const txResult = await withTransaction(async (client) => {
      // 5a. Generate Sequence-Backed Unique RFQ Reference
      const seqResult = await client.query(`SELECT nextval('public.store_rfq_seq') as seq;`);
      const seqNumber = Number(seqResult.rows[0]?.seq || 1001);
      const rfqReference = formatRfqReference(seqNumber);

      // 5b. Lock and re-validate upload intent atomically within transaction if file present
      let lockedIntentId: string | null = null;
      if (verifiedIntent) {
        const tokenHash = crypto.createHash('sha256').update(data.uploadToken!).digest('hex');
        const lockRes = await client.query(
          `SELECT id, status, expires_at
           FROM public.store_upload_intents
           WHERE token_hash = $1
           FOR UPDATE;`,
          [tokenHash]
        );

        const lockedIntent = lockRes.rows[0];
        if (!lockedIntent || (lockedIntent.status !== 'PENDING' && lockedIntent.status !== 'UPLOADED') || new Date(lockedIntent.expires_at).getTime() < Date.now()) {
          throw new Error('CONCURRENT_TOKEN_CONSUMPTION: Upload token was consumed or expired concurrently.');
        }
        lockedIntentId = lockedIntent.id;
      }

      // 5c. Insert Quote Request
      const insertQuoteRes = await client.query(
        `INSERT INTO public.store_quote_requests (
          rfq_reference,
          customer_name,
          customer_email,
          customer_phone,
          project_title,
          project_description,
          material_preference,
          color_preference,
          quantity,
          target_deadline,
          status,
          currency,
          ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING_REVIEW', 'AED', $11)
        RETURNING id;`,
        [
          rfqReference,
          data.customerName,
          data.customerEmail,
          data.customerPhone || null,
          data.projectTitle,
          data.projectDescription,
          data.materialPreference || null,
          data.colorPreference || null,
          data.quantity,
          data.targetDeadline || null,
          clientIp,
        ]
      );

      const quoteRequestId = insertQuoteRes.rows[0]?.id;

      // 5d. Link CAD File and Consume Intent Atomically
      if (lockedIntentId && verifiedIntent) {
        const finalSize = verifiedObjectMeta?.actualSizeBytes || verifiedIntent.file_size_bytes;
        const finalEtag = verifiedObjectMeta?.etag || null;

        await client.query(
          `INSERT INTO public.store_quote_files (
            quote_request_id,
            upload_intent_id,
            file_name,
            file_size_bytes,
            mime_type,
            file_extension,
            storage_key,
            checksum_sha256,
            scan_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'QUARANTINED');`,
          [
            quoteRequestId,
            lockedIntentId,
            verifiedIntent.file_name,
            finalSize,
            verifiedIntent.mime_type,
            verifiedIntent.file_extension,
            verifiedIntent.storage_key,
            finalEtag,
          ]
        );

        await client.query(
          `UPDATE public.store_upload_intents
           SET status = 'CONSUMED',
               quote_id = $1,
               consumed_at = NOW(),
               updated_at = NOW()
           WHERE id = $2;`,
          [quoteRequestId, lockedIntentId]
        );
      }

      return { quoteRequestId, rfqReference };
    });

    return NextResponse.json(
      {
        success: true,
        rfqReference: txResult.rfqReference,
        quoteRequestId: txResult.quoteRequestId,
        message: 'Your custom manufacturing quote request has been submitted successfully.',
      },
      {
        status: 201,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    console.error('Error in POST /api/store/quotes:', err);

    if (err.message?.includes('CONCURRENT_TOKEN_CONSUMPTION')) {
      return NextResponse.json(
        {
          error: 'CONCURRENT_TOKEN_CONSUMPTION',
          message: 'This upload token was consumed in another request. Tokens are strictly single-use.',
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to process custom quote request.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
