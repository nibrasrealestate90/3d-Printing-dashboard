import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyServerSession } from '@/lib/server-auth';
import { logAuditEvent, extractClientIp } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/orders/[id]
 * Retrieves single commercial order/invoice by record_id.
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
      SELECT record_id, data, updated_at
      FROM public.ledger_collections
      WHERE collection_name = 'invoices' AND record_id = ${id}
      LIMIT 1;
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Order not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order: {
        id: rows[0].record_id,
        ...rows[0].data,
        updatedAt: rows[0].updated_at,
      },
    });
  } catch (err: any) {
    console.error('Error in GET /api/admin/orders/[id]:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve order details.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/orders/[id]
 * Safely updates fulfilment status, payment amount/method, contact details, or notes.
 * Preserves historical line-item snapshot prices.
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

    const rows = await sql`
      SELECT record_id, data
      FROM public.ledger_collections
      WHERE collection_name = 'invoices' AND record_id = ${id}
      LIMIT 1;
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Order not found.' },
        { status: 404 }
      );
    }

    const existingData = rows[0].data || {};
    const updatedData = { ...existingData };

    // 1. Safe Fulfilment Status Update
    if (body.fulfillmentStatus !== undefined) {
      const rawFulfillment = String(body.fulfillmentStatus).toUpperCase().trim();
      if (!['IN_PRODUCTION', 'READY', 'DELIVERED'].includes(rawFulfillment)) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', message: 'Invalid fulfilment status. Must be IN_PRODUCTION, READY, or DELIVERED.' },
          { status: 400 }
        );
      }
      updatedData.fulfillmentStatus = rawFulfillment;
    }

    // 2. Safe Payment Update (recalculates paid, balance, and paymentStatus without altering line prices)
    if (body.paidAmount !== undefined || body.paid !== undefined) {
      const grandTotal = Number(existingData.total ?? existingData.amount ?? 0);
      const rawPaid = Number(body.paidAmount ?? body.paid);

      if (isNaN(rawPaid) || rawPaid < 0) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', message: 'Payment amount must be 0 or greater.' },
          { status: 400 }
        );
      }

      const paid = Number(Math.min(grandTotal, rawPaid).toFixed(2));
      const balance = Number(Math.max(0, grandTotal - paid).toFixed(2));

      let paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING' = 'PENDING';
      if (grandTotal > 0 && paid >= grandTotal - 0.005) {
        paymentStatus = 'PAID';
      } else if (paid > 0 && paid < grandTotal - 0.005) {
        paymentStatus = 'PARTIAL';
      } else {
        paymentStatus = 'PENDING';
      }

      updatedData.paid = paid;
      updatedData.balance = balance;
      updatedData.bal = balance;
      updatedData.paymentStatus = paymentStatus;
      // Do not overwrite document lifecycle status with paymentStatus
    }

    // 3. Safe Invoice Document Lifecycle Status (e.g. voiding or issuing)
    if (body.status !== undefined) {
      const rawStatus = String(body.status).toLowerCase().trim();
      if (rawStatus === 'void') {
        updatedData.status = 'void';
      } else if (rawStatus === 'issued') {
        updatedData.status = 'issued';
      }
    }

    // 4. Payment Method
    if (body.paymentMethod !== undefined) {
      updatedData.paymentMethod = String(body.paymentMethod).trim();
    }

    // 4. Customer Contact Details
    if (body.customerName !== undefined || body.clientName !== undefined) {
      const name = String(body.customerName || body.clientName || '').trim();
      if (name) {
        updatedData.client = name;
        updatedData.clientName = name;
        updatedData.customerName = name;
      }
    }

    if (body.whatsappNumber !== undefined || body.phone !== undefined || body.customerPhone !== undefined) {
      const phone = String(body.whatsappNumber || body.phone || body.customerPhone || '').trim();
      if (phone) {
        updatedData.phone = phone;
        updatedData.customerPhone = phone;
      }
    }

    if (body.email !== undefined || body.customerEmail !== undefined) {
      const email = String(body.email || body.customerEmail || '').trim().toLowerCase();
      updatedData.email = email || undefined;
      updatedData.customerEmail = email || undefined;
    }

    // 5. Notes
    if (body.notes !== undefined) {
      updatedData.notes = String(body.notes).trim();
    }

    updatedData.updatedAt = new Date().toISOString();

    await sql`
      UPDATE public.ledger_collections
      SET
        data = ${JSON.stringify(updatedData)}::jsonb,
        updated_at = NOW()
      WHERE collection_name = 'invoices' AND record_id = ${id};
    `;

    const clientIp = extractClientIp(req);
    await logAuditEvent({
      userId: auth.user.id,
      action: 'ORDER_UPDATE',
      entityType: 'invoice',
      entityId: id,
      ipAddress: clientIp,
      details: {
        invoiceNumber: updatedData.no || updatedData.invoiceNumber,
        fulfillmentStatus: updatedData.fulfillmentStatus,
        paymentStatus: updatedData.paymentStatus,
        paid: updatedData.paid,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Order updated successfully.',
      order: updatedData,
    });
  } catch (err: any) {
    console.error('Error in PATCH /api/admin/orders/[id]:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to update order.' },
      { status: 500 }
    );
  }
}
