import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyServerSession } from '@/lib/server-auth';
import { logAuditEvent, extractClientIp } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/products/[id]/publish
 * Authenticated endpoint to toggle publication state of a product.
 */
export async function POST(
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
    const body = await req.json().catch(() => ({}));
    const published = Boolean(body.published);

    const existing = await sql`
      SELECT record_id, data
      FROM public.ledger_collections
      WHERE collection_name = 'products' AND record_id = ${id}
      LIMIT 1;
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Product not found.' },
        { status: 404 }
      );
    }

    const currentData = existing[0].data || {};
    const updatedData = {
      ...currentData,
      published,
      updatedAt: new Date().toISOString(),
    };

    await sql`
      UPDATE public.ledger_collections
      SET
        data = ${JSON.stringify(updatedData)}::jsonb,
        updated_at = NOW()
      WHERE collection_name = 'products' AND record_id = ${id};
    `;

    const clientIp = extractClientIp(req);
    await logAuditEvent({
      userId: auth.user.id,
      action: published ? 'PRODUCT_PUBLISH' : 'PRODUCT_UNPUBLISH',
      entityType: 'product',
      entityId: id,
      ipAddress: clientIp,
      details: {
        published,
        name: currentData.publicName || currentData.name,
      },
    });

    return NextResponse.json({
      success: true,
      id,
      published,
    });
  } catch (err: any) {
    console.error('Error in POST /api/admin/products/[id]/publish:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to update publication status.' },
      { status: 500 }
    );
  }
}
