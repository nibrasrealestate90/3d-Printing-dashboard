import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyServerSession } from '@/lib/server-auth';
import { logAuditEvent, extractClientIp } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['NEW', 'IN_REVIEW', 'RESPONDED', 'ARCHIVED'] as const;
type ValidStatus = typeof VALID_STATUSES[number];

/**
 * GET /api/admin/enquiries/[id]
 * Retrieves single customer enquiry by id.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyServerSession();
    if (auth.status !== 'authenticated' || !auth.user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Administrator session required.' },
        { status: 401 }
      );
    }

    if (!sql) {
      return NextResponse.json(
        { error: 'DATABASE_UNAVAILABLE', message: 'Database service is currently unreachable.' },
        { status: 503 }
      );
    }

    const { id } = await params;

    const rows = await sql`
      SELECT 
        id, 
        customer_name, 
        customer_email, 
        customer_phone, 
        subject, 
        message, 
        product_id, 
        status, 
        ip_address, 
        created_at
      FROM public.store_enquiries
      WHERE id = ${id}
      LIMIT 1;
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Enquiry not found.' },
        { status: 404 }
      );
    }

    const r = rows[0];
    return NextResponse.json({
      success: true,
      enquiry: {
        id: String(r.id),
        customerName: String(r.customer_name || 'Customer').trim(),
        customerEmail: String(r.customer_email || '').trim().toLowerCase(),
        customerPhone: r.customer_phone ? String(r.customer_phone).trim() : null,
        subject: String(r.subject || 'Store Enquiry').trim(),
        message: String(r.message || '').trim(),
        productId: r.product_id ? String(r.product_id).trim() : null,
        status: String(r.status || 'NEW'),
        ipAddress: r.ip_address ? String(r.ip_address).trim() : null,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('Error in GET /api/admin/enquiries/[id]:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve enquiry.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/enquiries/[id]
 * Updates enquiry status (NEW, IN_REVIEW, RESPONDED, ARCHIVED).
 * Rejects unsupported statuses (e.g. QUOTED).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyServerSession();
    if (auth.status !== 'authenticated' || !auth.user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Administrator session required.' },
        { status: 401 }
      );
    }

    if (!sql) {
      return NextResponse.json(
        { error: 'DATABASE_UNAVAILABLE', message: 'Database service is currently unreachable.' },
        { status: 503 }
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Invalid JSON payload.' },
        { status: 400 }
      );
    }

    const rawStatus = String(body.status || '').toUpperCase().trim();
    if (!VALID_STATUSES.includes(rawStatus as ValidStatus)) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: `Invalid status "${rawStatus}". Must be one of: ${VALID_STATUSES.join(', ')}.`,
        },
        { status: 400 }
      );
    }

    const status = rawStatus as ValidStatus;

    // Check if record exists
    const existingRows = await sql`
      SELECT id, status FROM public.store_enquiries WHERE id = ${id} LIMIT 1;
    `;

    if (existingRows.length === 0) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Enquiry not found.' },
        { status: 404 }
      );
    }

    const previousStatus = existingRows[0].status;

    // Update status in store_enquiries
    const updatedRows = await sql`
      UPDATE public.store_enquiries
      SET status = ${status}
      WHERE id = ${id}
      RETURNING 
        id, 
        customer_name, 
        customer_email, 
        customer_phone, 
        subject, 
        message, 
        product_id, 
        status, 
        ip_address, 
        created_at;
    `;

    const r = updatedRows[0];

    // Audit Log
    const clientIp = extractClientIp(req);
    await logAuditEvent({
      userId: auth.user.id,
      action: 'ENQUIRY_STATUS_UPDATE',
      entityType: 'ENQUIRY',
      entityId: id,
      details: {
        previousStatus,
        newStatus: status,
      },
      ipAddress: clientIp,
    }).catch((err) => console.warn('Could not log audit event:', err));

    return NextResponse.json({
      success: true,
      enquiry: {
        id: String(r.id),
        customerName: String(r.customer_name || 'Customer').trim(),
        customerEmail: String(r.customer_email || '').trim().toLowerCase(),
        customerPhone: r.customer_phone ? String(r.customer_phone).trim() : null,
        subject: String(r.subject || 'Store Enquiry').trim(),
        message: String(r.message || '').trim(),
        productId: r.product_id ? String(r.product_id).trim() : null,
        status: String(r.status || status),
        ipAddress: r.ip_address ? String(r.ip_address).trim() : null,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('Error in PATCH /api/admin/enquiries/[id]:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to update enquiry status.' },
      { status: 500 }
    );
  }
}
