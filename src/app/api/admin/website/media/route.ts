import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyServerSession } from '@/lib/server-auth';
import { MediaItem } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

export async function getMediaLibraryItems(): Promise<MediaItem[]> {
  if (!sql) return [];
  const rows = await sql`
    SELECT data
    FROM public.ledger_collections
    WHERE collection_name = 'website_content' AND record_id = 'media_library'
    LIMIT 1;
  `;
  if (rows.length === 0 || !Array.isArray(rows[0].data?.items)) {
    return [];
  }
  return rows[0].data.items;
}

export async function saveMediaLibraryItems(items: MediaItem[]) {
  if (!sql) throw new Error('Database unavailable');
  await sql`
    INSERT INTO public.ledger_collections (collection_name, record_id, data, updated_at)
    VALUES (
      'website_content',
      'media_library',
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
 * GET /api/admin/website/media
 * Authenticated endpoint to list all media library assets with usage references.
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

    if (!sql) {
      return NextResponse.json(
        { error: 'DATABASE_UNAVAILABLE', message: 'Database service is currently unreachable.' },
        { status: 503 }
      );
    }

    const mediaItems = await getMediaLibraryItems();

    // Query published products to annotate usage references
    const productRows = await sql`
      SELECT record_id, data
      FROM public.ledger_collections
      WHERE collection_name = 'products'
        AND (
          (data->>'published' = 'true') OR
          (jsonb_typeof(data->'published') = 'boolean' AND (data->'published')::boolean = true)
        );
    `;

    // Query published instagram items
    const instaRows = await sql`
      SELECT data
      FROM public.ledger_collections
      WHERE collection_name = 'website_content' AND record_id = 'instagram_gallery'
      LIMIT 1;
    `;
    const instaItems: any[] = Array.isArray(instaRows[0]?.data?.items) ? instaRows[0].data.items : [];
    const publishedInsta = instaItems.filter((i) => i.published === true);

    // Query categories (any category, including unpublished)
    const catRows = await sql`
      SELECT data
      FROM public.ledger_collections
      WHERE collection_name = 'website_content' AND record_id = 'categories'
      LIMIT 1;
    `;
    const catItems: any[] = Array.isArray(catRows[0]?.data?.items) ? catRows[0].data.items : [];

    const itemsWithUsage = mediaItems.map((item) => {
      const referencedIn: string[] = [];

      for (const pr of productRows) {
        const pd = pr.data || {};
        const pName = pd.publicName || pd.name || pr.record_id;
        const mainMatch = pd.imageUrl === item.url;
        const galleryMatch = Array.isArray(pd.images) && pd.images.includes(item.url);
        if (mainMatch || galleryMatch) {
          referencedIn.push(`Product: ${pName}`);
        }
      }

      for (const ig of publishedInsta) {
        if (ig.imageUrl === item.url) {
          referencedIn.push(`Instagram: ${ig.caption?.slice(0, 30) || ig.id}`);
        }
      }

      for (const cat of catItems) {
        if (cat.imageUrl === item.url) {
          referencedIn.push(`Category: ${cat.name || cat.id}`);
        }
      }

      return {
        ...item,
        referencedIn,
        isReferenced: referencedIn.length > 0,
      };
    });

    // Sort newest first
    itemsWithUsage.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    return NextResponse.json({
      success: true,
      count: itemsWithUsage.length,
      items: itemsWithUsage,
    });
  } catch (err: any) {
    console.error('Error in GET /api/admin/website/media:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve media library.' },
      { status: 500 }
    );
  }
}
