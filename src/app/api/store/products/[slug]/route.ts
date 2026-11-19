import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sanitizeProductForStorefront } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

/**
 * Public Sanitized Single Product Detail API
 * Supports lookup by record_id (prod_...) or SEO slug.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: 'DATABASE_UNAVAILABLE', message: 'Database service is currently unreachable.' },
        { status: 503 }
      );
    }

    const { slug } = await params;
    const identifier = decodeURIComponent(slug || '').trim();

    if (!identifier) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Product identifier is required.' },
        { status: 400 }
      );
    }

    const rows = await sql`
      SELECT record_id, data, updated_at
      FROM public.ledger_collections
      WHERE collection_name = 'products'
        AND (
          (data->>'published' = 'true') OR
          (jsonb_typeof(data->'published') = 'boolean' AND (data->'published')::boolean = true)
        )
        AND (
          record_id = ${identifier} OR
          COALESCE(data->>'slug', '') = ${identifier}
        )
      LIMIT 1;
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'PRODUCT_NOT_FOUND', message: 'The requested product could not be found or is not currently published.' },
        { status: 404 }
      );
    }

    const product = sanitizeProductForStorefront({
      record_id: rows[0].record_id,
      data: rows[0].data,
      updated_at: rows[0].updated_at,
    });

    return NextResponse.json(
      {
        success: true,
        product,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (err: any) {
    console.error('Error in GET /api/store/products/[slug]:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve product.' },
      { status: 500 }
    );
  }
}
