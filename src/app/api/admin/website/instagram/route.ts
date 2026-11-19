import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/db';
import { verifyServerSession } from '@/lib/server-auth';
import { logAuditEvent, extractClientIp } from '@/lib/auth';
import { validateInstagramItem, InstagramGalleryItem } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

async function getGalleryDocument(): Promise<InstagramGalleryItem[]> {
  if (!sql) return [];
  const rows = await sql`
    SELECT data
    FROM public.ledger_collections
    WHERE collection_name = 'website_content' AND record_id = 'instagram_gallery'
    LIMIT 1;
  `;
  if (rows.length === 0 || !Array.isArray(rows[0].data?.items)) {
    return [];
  }
  return rows[0].data.items;
}

async function saveGalleryDocument(items: InstagramGalleryItem[]) {
  if (!sql) throw new Error('Database unavailable');
  await sql`
    INSERT INTO public.ledger_collections (collection_name, record_id, data, updated_at)
    VALUES (
      'website_content',
      'instagram_gallery',
      ${JSON.stringify({ items, updatedAt: new Date().toISOString() })}::jsonb,
      NOW()
    )
    ON CONFLICT (collection_name, record_id)
    DO UPDATE SET
      data = EXCLUDED.data,
      updated_at = NOW();
  `;
}

/**
 * GET /api/admin/website/instagram
 * Authenticated endpoint to retrieve all Instagram gallery entries (both published and hidden).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyServerSession();
    if (auth.status !== 'authenticated' || !auth.user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Administrator session required.' },
        { status: 401 }
      );
    }

    const items = await getGalleryDocument();
    // Sort by order ascending
    items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return NextResponse.json({
      success: true,
      count: items.length,
      items,
    });
  } catch (err: any) {
    console.error('Error in GET /api/admin/website/instagram:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve Instagram gallery.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/website/instagram
 * Authenticated endpoint to manage Instagram gallery entries: create, update, reorder, toggle, delete.
 */
export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Invalid JSON payload.' },
        { status: 400 }
      );
    }

    const action = String(body.action || 'create').toLowerCase();
    const currentItems = await getGalleryDocument();
    const clientIp = extractClientIp(req);

    // 1. Action: REORDER
    if (action === 'reorder') {
      if (!Array.isArray(body.orderedIds)) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', message: 'orderedIds array required for reorder.' },
          { status: 400 }
        );
      }
      const orderMap = new Map<string, number>();
      body.orderedIds.forEach((id: string, idx: number) => {
        orderMap.set(String(id), idx + 1);
      });

      const updated = currentItems.map((item) => ({
        ...item,
        order: orderMap.has(item.id) ? orderMap.get(item.id)! : item.order,
        updatedAt: new Date().toISOString(),
      }));
      updated.sort((a, b) => a.order - b.order);

      await saveGalleryDocument(updated);
      await logAuditEvent({
        userId: auth.user.id,
        action: 'INSTAGRAM_GALLERY_REORDER',
        entityType: 'instagram_gallery',
        ipAddress: clientIp,
        details: { count: updated.length },
      });

      return NextResponse.json({ success: true, items: updated });
    }

    // 2. Action: DELETE
    if (action === 'delete') {
      const id = String(body.id || '').trim();
      if (!id) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', message: 'Item ID is required for deletion.' },
          { status: 400 }
        );
      }
      const filtered = currentItems.filter((i) => i.id !== id);
      if (filtered.length === currentItems.length) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: 'Gallery entry not found.' },
          { status: 404 }
        );
      }

      await saveGalleryDocument(filtered);
      await logAuditEvent({
        userId: auth.user.id,
        action: 'INSTAGRAM_GALLERY_DELETE',
        entityType: 'instagram_gallery',
        entityId: id,
        ipAddress: clientIp,
      });

      return NextResponse.json({ success: true, id, remainingCount: filtered.length });
    }

    // 3. Action: TOGGLE PUBLISH
    if (action === 'toggle_publish') {
      const id = String(body.id || '').trim();
      const target = currentItems.find((i) => i.id === id);
      if (!target) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: 'Gallery entry not found.' },
          { status: 404 }
        );
      }

      const published = typeof body.published === 'boolean' ? body.published : !target.published;
      target.published = published;
      target.updatedAt = new Date().toISOString();

      await saveGalleryDocument(currentItems);
      await logAuditEvent({
        userId: auth.user.id,
        action: published ? 'INSTAGRAM_GALLERY_PUBLISH' : 'INSTAGRAM_GALLERY_HIDE',
        entityType: 'instagram_gallery',
        entityId: id,
        ipAddress: clientIp,
        details: { published },
      });

      return NextResponse.json({ success: true, item: target });
    }

    // 4. Action: UPDATE
    if (action === 'update') {
      const id = String(body.id || '').trim();
      const target = currentItems.find((i) => i.id === id);
      if (!target) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: 'Gallery entry not found.' },
          { status: 404 }
        );
      }

      const val = validateInstagramItem(body);
      if (!val.valid || !val.sanitized) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', errors: val.errors },
          { status: 400 }
        );
      }

      target.imageUrl = val.sanitized.imageUrl || target.imageUrl;
      target.caption = val.sanitized.caption || target.caption;
      target.postUrl = val.sanitized.postUrl;
      target.published = val.sanitized.published ?? target.published;
      if (typeof val.sanitized.order === 'number') {
        target.order = val.sanitized.order;
      }
      target.updatedAt = new Date().toISOString();

      await saveGalleryDocument(currentItems);
      await logAuditEvent({
        userId: auth.user.id,
        action: 'INSTAGRAM_GALLERY_UPDATE',
        entityType: 'instagram_gallery',
        entityId: id,
        ipAddress: clientIp,
        details: { caption: target.caption, published: target.published },
      });

      return NextResponse.json({ success: true, item: target });
    }

    // 5. Action: CREATE (default)
    const val = validateInstagramItem(body);
    if (!val.valid || !val.sanitized) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', errors: val.errors },
        { status: 400 }
      );
    }

    const newItem: InstagramGalleryItem = {
      id: `ig_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      imageUrl: val.sanitized.imageUrl!,
      caption: val.sanitized.caption!,
      postUrl: val.sanitized.postUrl,
      published: val.sanitized.published ?? true,
      order: currentItems.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    currentItems.push(newItem);
    await saveGalleryDocument(currentItems);

    await logAuditEvent({
      userId: auth.user.id,
      action: 'INSTAGRAM_GALLERY_CREATE',
      entityType: 'instagram_gallery',
      entityId: newItem.id,
      ipAddress: clientIp,
      details: { caption: newItem.caption, published: newItem.published },
    });

    return NextResponse.json({ success: true, item: newItem }, { status: 201 });
  } catch (err: any) {
    console.error('Error in POST /api/admin/website/instagram:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to process Instagram gallery action.' },
      { status: 500 }
    );
  }
}
