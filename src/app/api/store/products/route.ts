import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sanitizeProductForStorefront } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

/**
 * Public Sanitized Storefront Products Catalog API
 *
 * Security Invariants:
 * - Read-only public catalog
 * - Only products with published = true are returned
 * - Zero internal manufacturing costs, margins, printer tokens, or base64 Bambu thumbnails
 * - Strict caching headers
 */
export async function GET(req: NextRequest) {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: 'DATABASE_UNAVAILABLE', message: 'Database service is currently unreachable.' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category')?.trim();
    const rawLimit = Number(searchParams.get('limit') || '24');
    const limit = Math.max(1, Math.min(100, isNaN(rawLimit) ? 24 : rawLimit));

    let rows;
    if (category) {
      rows = await sql`
        SELECT record_id, data, updated_at
        FROM public.ledger_collections
        WHERE collection_name = 'products'
          AND (
            (data->>'published' = 'true') OR
            (jsonb_typeof(data->'published') = 'boolean' AND (data->'published')::boolean = true)
          )
          AND LOWER(COALESCE(data->>'category', '')) = LOWER(${category})
        ORDER BY updated_at DESC
        LIMIT ${limit};
      `;
    } else {
      rows = await sql`
        SELECT record_id, data, updated_at
        FROM public.ledger_collections
        WHERE collection_name = 'products'
          AND (
            (data->>'published' = 'true') OR
            (jsonb_typeof(data->'published') = 'boolean' AND (data->'published')::boolean = true)
          )
        ORDER BY updated_at DESC
        LIMIT ${limit};
      `;
    }

    const products = rows.map((r: any) =>
      sanitizeProductForStorefront({
        record_id: r.record_id,
        data: r.data,
        updated_at: r.updated_at,
      })
    );

    return NextResponse.json(
      {
        success: true,
        count: products.length,
        products,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (err: any) {
    console.error('Error in GET /api/store/products:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve storefront product catalog.' },
      { status: 500 }
    );
  }
}
