import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sanitizeImageUrl } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

/**
 * GET /api/store/content
 * Public read-only endpoint returning published website content (Instagram gallery, etc.).
 *
 * Security Invariants:
 * - Exposes ONLY items marked published = true.
 * - Zero internal notes, production metrics, or private CAD paths.
 * - Strict URL sanitization preventing script injection.
 * - Caching headers for edge performance.
 */
export async function GET(req: NextRequest) {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: 'DATABASE_UNAVAILABLE', message: 'Database service is currently unreachable.' },
        { status: 503 }
      );
    }

    const rows = await sql`
      SELECT data
      FROM public.ledger_collections
      WHERE collection_name = 'website_content' AND record_id = 'instagram_gallery'
      LIMIT 1;
    `;

    const rawItems: any[] = Array.isArray(rows[0]?.data?.items) ? rows[0].data.items : [];

    // Filter strictly for published items
    const publishedItems = rawItems
      .filter((item) => item && (item.published === true || item.published === 'true'))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      .map((item) => {
        const sanitizedUrl = sanitizeImageUrl(item.imageUrl) || '/assets/images/hero_creations_dubai_1794842125042.jpg';
        return {
          id: String(item.id || ''),
          imageUrl: sanitizedUrl,
          caption: String(item.caption || '').trim(),
          postUrl: typeof item.postUrl === 'string' && item.postUrl.startsWith('http') ? item.postUrl.trim() : undefined,
          order: Number(item.order) || 0,
        };
      });

    return NextResponse.json(
      {
        success: true,
        count: publishedItems.length,
        instagramGallery: publishedItems,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (err: any) {
    console.error('Error in GET /api/store/content:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve website content.' },
      { status: 500 }
    );
  }
}
