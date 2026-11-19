import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { checkRateLimit, extractClientIp } from '@/lib/auth';
import { validateStorefrontOrigin } from '@/lib/origin';
import { validateEnquiryInput } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

/**
 * Public Customer Enquiry Submission API
 *
 * Security Invariants:
 * - Browser mutations strictly enforce Storefront Origin validation
 * - Public submission protected by IP rate limiting (5 / hour)
 * - Strict schema validation and input sanitization
 * - Stored in normalized public.store_enquiries table
 * - Audit-friendly IP tracking
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
        { status: 503 }
      );
    }

    const clientIp = extractClientIp(req);

    // 2. Sliding Window Rate Limiting (5 requests per hour per IP)
    const rateLimit = await checkRateLimit(`store_enquiry:${clientIp}`, 5, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000));
      return NextResponse.json(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many enquiry submissions from this IP address. Please try again later.',
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

    const validation = validateEnquiryInput(body);
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

    // 4. Persist into normalized store_enquiries table
    const result = await sql`
      INSERT INTO public.store_enquiries (
        customer_name,
        customer_email,
        customer_phone,
        subject,
        message,
        product_id,
        status,
        ip_address
      ) VALUES (
        ${data.customerName},
        ${data.customerEmail},
        ${data.customerPhone || null},
        ${data.subject},
        ${data.message},
        ${data.productId || null},
        'NEW',
        ${clientIp}
      )
      RETURNING id, created_at;
    `;

    const enquiryId = result[0]?.id;

    return NextResponse.json(
      {
        success: true,
        enquiryId,
        message: 'Your enquiry has been received. Our studio team will review and respond promptly.',
      },
      {
        status: 201,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    console.error('Error in POST /api/store/enquiries:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to process customer enquiry.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
