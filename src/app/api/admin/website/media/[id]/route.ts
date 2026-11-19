import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyServerSession } from '@/lib/server-auth';
import { logAuditEvent, extractClientIp } from '@/lib/auth';
import { getMediaLibraryItems, saveMediaLibraryItems } from '../route';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/admin/website/media/[id]
 * Deletes a media library asset strictly if no published content references it.
 */
export async function DELETE(
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
    const currentItems = await getMediaLibraryItems();
    const targetItem = currentItems.find((i) => i.id === id);

    if (!targetItem) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Media asset not found.' },
        { status: 404 }
      );
    }

    // 1. Check if referenced by any published commercial product
    const productRows = await sql`
      SELECT record_id, data
      FROM public.ledger_collections
      WHERE collection_name = 'products'
        AND (
          (data->>'published' = 'true') OR
          (jsonb_typeof(data->'published') = 'boolean' AND (data->'published')::boolean = true)
        );
    `;

    const referencingProducts: string[] = [];
    for (const row of productRows) {
      const data = row.data || {};
      const pName = data.publicName || data.name || row.record_id;
      const isMainImage = data.imageUrl === targetItem.url;
      const isInGallery = Array.isArray(data.images) && data.images.includes(targetItem.url);

      if (isMainImage || isInGallery) {
        referencingProducts.push(pName);
      }
    }

    // 2. Check if referenced by any published Instagram gallery post
    const instaRows = await sql`
      SELECT data
      FROM public.ledger_collections
      WHERE collection_name = 'website_content' AND record_id = 'instagram_gallery'
      LIMIT 1;
    `;
    const instaItems: any[] = Array.isArray(instaRows[0]?.data?.items) ? instaRows[0].data.items : [];
    const referencingInstagram: string[] = [];
    for (const post of instaItems) {
      if (post.published === true && post.imageUrl === targetItem.url) {
        referencingInstagram.push(post.caption?.slice(0, 30) || post.id);
      }
    }

    // If any published content references this image, reject deletion
    if (referencingProducts.length > 0 || referencingInstagram.length > 0) {
      const reasons: string[] = [];
      if (referencingProducts.length > 0) {
        reasons.push(`Published products: ${referencingProducts.join(', ')}`);
      }
      if (referencingInstagram.length > 0) {
        reasons.push(`Published Instagram posts: ${referencingInstagram.join(', ')}`);
      }

      return NextResponse.json(
        {
          error: 'MEDIA_IN_USE',
          message: `Cannot delete media asset because it is currently referenced by published content. Unpublish or replace the image in referencing content before deleting.`,
          referencingContent: reasons,
        },
        { status: 409 }
      );
    }

    // Safe to delete
    const remainingItems = currentItems.filter((i) => i.id !== id);
    await saveMediaLibraryItems(remainingItems);

    const clientIp = extractClientIp(req);
    await logAuditEvent({
      userId: auth.user.id,
      action: 'MEDIA_DELETE',
      entityType: 'media_asset',
      entityId: id,
      ipAddress: clientIp,
      details: {
        fileName: targetItem.fileName,
        storageKey: targetItem.storageKey,
      },
    });

    return NextResponse.json({
      success: true,
      id,
      message: 'Media asset deleted successfully.',
    });
  } catch (err: any) {
    console.error('Error in DELETE /api/admin/website/media/[id]:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to delete media asset.' },
      { status: 500 }
    );
  }
}
