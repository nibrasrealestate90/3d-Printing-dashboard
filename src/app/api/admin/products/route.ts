import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/db';
import { verifyServerSession } from '@/lib/server-auth';
import { logAuditEvent, extractClientIp } from '@/lib/auth';
import { sanitizeImageUrl, slugify } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/products
 * Authenticated endpoint for administrator to list all commercial and production products.
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

    const rows = await sql`
      SELECT record_id, data, updated_at
      FROM public.ledger_collections
      WHERE collection_name = 'products'
      ORDER BY updated_at DESC;
    `;

    const products = rows.map((r: any) => {
      const d = r.data || {};
      const rawPrice = Number(d.sellingPrice ?? d.directPrice ?? 0);
      const sellingPrice = isNaN(rawPrice) || rawPrice < 0 ? 0 : Number(rawPrice.toFixed(2));

      return {
        id: String(d.id || r.record_id),
        name: String(d.publicName || d.name || 'Untitled Product'),
        internalName: String(d.name || ''),
        sku: String(d.sku || ''),
        category: String(d.publicCategory || d.category || '3D Prints'),
        sellingPrice,
        currency: 'AED',
        description: String(d.publicDescription || d.description || ''),
        internalNotes: String(d.notes || ''),
        imageUrl: sanitizeImageUrl(d.imageUrl) || sanitizeImageUrl(d.photo) || null,
        images: Array.isArray(d.images)
          ? (d.images as unknown[]).map(sanitizeImageUrl).filter((u): u is string => u !== null)
          : [],
        material: d.material ? String(d.material) : undefined,
        dimensions: d.dimensions ? String(d.dimensions) : undefined,
        finish: d.finish ? String(d.finish) : undefined,
        colors: Array.isArray(d.colors) ? d.colors.map(String) : [],
        supportsPersonalization: Boolean(d.supportsPersonalization),
        isFeatured: Boolean(d.isFeatured),
        isBestSeller: Boolean(d.isBestSeller),
        isAvailable: Boolean(d.isAvailable ?? true),
        published: Boolean(d.published),
        grams: typeof d.grams === 'number' ? d.grams : undefined,
        unitCost: typeof d.unitCost === 'number' ? d.unitCost : undefined,
        isBambuImport: Boolean(d.notes?.includes('Bambu') || d.photo?.startsWith('data:')),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (err: any) {
    console.error('Error in GET /api/admin/products:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve products.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/products
 * Authenticated endpoint to create or update commercial products with storefront marketing fields.
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
        { error: 'BAD_REQUEST', message: 'Invalid JSON body.' },
        { status: 400 }
      );
    }

    const name = String(body.name || body.publicName || '').trim();
    if (!name) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Product name is required.' },
        { status: 400 }
      );
    }

    const rawPrice = Number(body.sellingPrice);
    if (isNaN(rawPrice) || rawPrice < 0) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Selling price must be a valid positive number in AED.' },
        { status: 400 }
      );
    }
    const sellingPrice = Number(rawPrice.toFixed(2));

    const id = body.id && typeof body.id === 'string' && body.id.trim()
      ? body.id.trim()
      : `prod_${crypto.randomBytes(8).toString('hex')}`;

    const slug = body.slug && typeof body.slug === 'string' && body.slug.trim()
      ? slugify(body.slug.trim())
      : `${slugify(name)}-${id.replace(/^prod_/, '').slice(0, 8)}`;

    const category = String(body.category || '3D Prints').trim();
    const publicDescription = String(body.publicDescription || body.description || '').trim();
    const imageUrl = sanitizeImageUrl(body.imageUrl) || null;

    const rawImages: unknown[] = Array.isArray(body.images) ? body.images : [];
    const images: string[] = [];
    for (const item of rawImages) {
      const sanitized = sanitizeImageUrl(item);
      if (sanitized && !images.includes(sanitized)) {
        images.push(sanitized);
      }
    }
    if (imageUrl && !images.includes(imageUrl)) {
      images.unshift(imageUrl);
    }

    const material = body.material ? String(body.material).trim() : undefined;
    const dimensions = body.dimensions ? String(body.dimensions).trim() : undefined;
    const finish = body.finish ? String(body.finish).trim() : undefined;
    const colors = Array.isArray(body.colors)
      ? (body.colors as unknown[]).map(c => String(c).trim()).filter(Boolean)
      : [];

    const supportsPersonalization = Boolean(body.supportsPersonalization);
    const isFeatured = Boolean(body.isFeatured);
    const isBestSeller = Boolean(body.isBestSeller);
    const isAvailable = Boolean(body.isAvailable ?? true);
    const published = Boolean(body.published);

    // Fetch existing record if present to preserve manufacturing fields
    const existing = await sql`
      SELECT record_id, data
      FROM public.ledger_collections
      WHERE collection_name = 'products' AND record_id = ${id}
      LIMIT 1;
    `;

    const isNew = existing.length === 0;
    const existingData = isNew ? {} : existing[0].data || {};

    const mergedData = {
      ...existingData,
      id,
      name: existingData.name || name,
      publicName: name,
      slug,
      sku: body.sku ? String(body.sku).trim() : existingData.sku || `PRN-${id.slice(-4).toUpperCase()}`,
      category,
      publicCategory: category,
      sellingPrice,
      directPrice: sellingPrice,
      description: existingData.description || publicDescription,
      publicDescription,
      imageUrl,
      images,
      material,
      dimensions,
      finish,
      colors,
      supportsPersonalization,
      isFeatured,
      isBestSeller,
      isAvailable,
      published,
      updatedAt: new Date().toISOString(),
    };

    await sql`
      INSERT INTO public.ledger_collections (collection_name, record_id, data, updated_at)
      VALUES (
        'products',
        ${id},
        ${JSON.stringify(mergedData)}::jsonb,
        NOW()
      )
      ON CONFLICT (collection_name, record_id)
      DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW();
    `;

    const clientIp = extractClientIp(req);
    await logAuditEvent({
      userId: auth.user.id,
      action: isNew ? 'PRODUCT_CREATE' : (published ? 'PRODUCT_PUBLISH' : 'PRODUCT_UPDATE'),
      entityType: 'product',
      entityId: id,
      ipAddress: clientIp,
      details: {
        name,
        sellingPrice,
        category,
        published,
        isFeatured,
        isBestSeller,
      },
    });

    return NextResponse.json({
      success: true,
      product: {
        id,
        name,
        slug,
        sku: mergedData.sku,
        category,
        sellingPrice,
        imageUrl,
        images,
        published,
        isFeatured,
        isBestSeller,
        supportsPersonalization,
      },
    });
  } catch (err: any) {
    console.error('Error in POST /api/admin/products:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to save product.' },
      { status: 500 }
    );
  }
}
