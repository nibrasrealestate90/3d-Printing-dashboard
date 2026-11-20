import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/db';
import { verifyServerSession } from '@/lib/server-auth';
import { logAuditEvent, extractClientIp } from '@/lib/auth';
import { sanitizeImageUrl, slugify, CategoryItem } from '@/lib/storefront';

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

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope')?.toLowerCase().trim();

    const rows = await sql`
      SELECT record_id, data, updated_at
      FROM public.ledger_collections
      WHERE collection_name = 'products'
      ORDER BY updated_at DESC;
    `;

    let products = rows.map((r: any) => {
      const d = r.data || {};
      const rawPrice = Number(d.sellingPrice ?? d.directPrice ?? 0);
      const sellingPrice = isNaN(rawPrice) || rawPrice < 0 ? 0 : Number(rawPrice.toFixed(2));
      const isCommercial = Boolean(d.isCommercial || d.publicName || (d.published !== undefined && d.published !== null));

      const rawGallery: string[] = Array.isArray(d.images)
        ? (d.images as unknown[]).map(sanitizeImageUrl).filter((u): u is string => u !== null)
        : [];
      const singleImg = sanitizeImageUrl(d.imageUrl) || sanitizeImageUrl(d.photo) || null;
      if (singleImg && !rawGallery.includes(singleImg)) {
        if (rawGallery.length === 0) {
          rawGallery.push(singleImg);
        }
      }
      const images = rawGallery.slice(0, 6);
      const imageUrl = images[0] || singleImg || null;

      return {
        id: String(d.id || r.record_id),
        name: String(d.publicName || d.name || 'Untitled Product'),
        internalName: String(d.name || ''),
        sku: String(d.sku || ''),
        categoryId: d.categoryId ? String(d.categoryId) : undefined,
        category: String(d.publicCategory || d.category || '3D Prints'),
        sellingPrice,
        currency: 'AED',
        description: String(d.publicDescription || d.description || ''),
        internalNotes: String(d.notes || ''),
        imageUrl,
        images,
        material: d.material ? String(d.material) : undefined,
        dimensions: d.dimensions ? String(d.dimensions) : undefined,
        finish: d.finish ? String(d.finish) : undefined,
        colors: Array.isArray(d.colors) ? d.colors.map(String) : [],
        supportsPersonalization: Boolean(d.supportsPersonalization),
        isFeatured: Boolean(d.isFeatured),
        isBestSeller: Boolean(d.isBestSeller),
        isAvailable: Boolean(d.isAvailable ?? true),
        published: Boolean(d.published),
        isCommercial,
        grams: typeof d.grams === 'number' ? d.grams : undefined,
        minutes: typeof d.minutes === 'number' ? d.minutes : undefined,
        unitCost: typeof d.unitCost === 'number' ? d.unitCost : undefined,
        directPrice: typeof d.directPrice === 'number' ? d.directPrice : undefined,
        isBambuImport: Boolean(d.notes?.includes('Bambu') || d.photo?.startsWith('data:')),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      };
    });

    if (scope === 'commercial') {
      products = products.filter((p) => p.isCommercial);
    } else if (scope === 'production') {
      // Return all manufacturing products from ledger_collections
    }

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

    const rawName = String(body.name || body.publicName || '').trim();
    const rawPrice = Number(body.sellingPrice);
    const sellingPrice = isNaN(rawPrice) || rawPrice < 0 ? 0 : Number(rawPrice.toFixed(2));
    const isAttemptingPublish = Boolean(body.published);

    // Publication Validation (Requirement 3):
    // Requires non-empty name, selling price > 0, category, and at least one image.
    // Incomplete products are allowed to remain drafts; never automatically publish incomplete products.
    if (isAttemptingPublish) {
      if (!rawName) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', message: 'Product display name is required to publish.' },
          { status: 400 }
        );
      }
      if (sellingPrice <= 0) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', message: 'Selling price must be greater than 0 AED to publish.' },
          { status: 400 }
        );
      }
      const catCheck = String(body.category || body.publicCategory || body.categoryId || '').trim();
      if (!catCheck) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', message: 'Product category is required to publish.' },
          { status: 400 }
        );
      }
      const rawImgs = Array.isArray(body.images) ? body.images : [];
      const hasImage = Boolean(sanitizeImageUrl(body.imageUrl) || rawImgs.some((img: any) => Boolean(sanitizeImageUrl(img))));
      if (!hasImage) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', message: 'At least one valid product image is required to publish.' },
          { status: 400 }
        );
      }
    }

    const name = rawName || 'Draft Product';
    const published = isAttemptingPublish;

    const id = body.id && typeof body.id === 'string' && body.id.trim()
      ? body.id.trim()
      : `prod_${crypto.randomBytes(8).toString('hex')}`;

    const slug = body.slug && typeof body.slug === 'string' && body.slug.trim()
      ? slugify(body.slug.trim())
      : `${slugify(name)}-${id.replace(/^prod_/, '').slice(0, 8)}`;

    const publicDescription = String(body.publicDescription || body.description || '').trim();

    // Multi-Image Gallery Processing (Authoritative max 6 images)
    // The first image in body.images is authoritative as the primary image
    const rawImages: unknown[] = Array.isArray(body.images)
      ? body.images
      : (body.imageUrl ? [body.imageUrl] : []);

    const validatedImages: string[] = [];
    for (const item of rawImages) {
      const sanitized = sanitizeImageUrl(item);
      if (sanitized && !validatedImages.includes(sanitized)) {
        validatedImages.push(sanitized);
      }
    }

    // In case legacy single-image payload didn't supply images array
    const singleImageUrl = sanitizeImageUrl(body.imageUrl);
    if (singleImageUrl && !validatedImages.includes(singleImageUrl)) {
      if (validatedImages.length === 0) {
        validatedImages.push(singleImageUrl);
      }
    }

    // Enforce maximum 6 images (1 primary + up to 5 secondary)
    const images = validatedImages.slice(0, 6);
    // Primary image is strictly synchronized to images[0]
    const imageUrl = images[0] || null;

    if (published && !imageUrl) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'At least one valid product image is required to publish.' },
        { status: 400 }
      );
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

    // Fetch existing record if present to preserve manufacturing fields
    const existing = await sql`
      SELECT record_id, data
      FROM public.ledger_collections
      WHERE collection_name = 'products' AND record_id = ${id}
      LIMIT 1;
    `;

    const isNew = existing.length === 0;
    const existingData = isNew ? {} : existing[0].data || {};

    // -------------------------------------------------------------------------
    // Dynamic Category Validation & Resolution (Phase 3)
    // -------------------------------------------------------------------------
    let availableCategories: CategoryItem[] = [];
    const catRows = await sql`
      SELECT data
      FROM public.ledger_collections
      WHERE collection_name = 'website_content' AND record_id = 'categories'
      LIMIT 1;
    `;
    if (catRows.length > 0 && Array.isArray(catRows[0].data?.items)) {
      availableCategories = catRows[0].data.items;
    }

    let resolvedCategoryId: string | undefined = undefined;
    let resolvedCategoryName: string = '';

    const inputCategoryId = typeof body.categoryId === 'string' && body.categoryId.trim()
      ? body.categoryId.trim()
      : undefined;
    const inputCategoryName = typeof body.category === 'string' && body.category.trim()
      ? body.category.trim()
      : typeof body.publicCategory === 'string' && body.publicCategory.trim()
        ? body.publicCategory.trim()
        : '';

    if (inputCategoryId) {
      const targetCategory = availableCategories.find((c) => c.id === inputCategoryId);
      if (!targetCategory) {
        if (availableCategories.length > 0) {
          return NextResponse.json(
            { error: 'VALIDATION_ERROR', message: `Invalid category ID "${inputCategoryId}". Category does not exist.` },
            { status: 400 }
          );
        } else {
          resolvedCategoryId = inputCategoryId;
          resolvedCategoryName = inputCategoryName || '3D Prints';
        }
      } else {
        if (!targetCategory.isPublished) {
          const isExistingAssignment = !isNew && (
            existingData.categoryId === targetCategory.id ||
            existingData.category?.toLowerCase() === targetCategory.name.toLowerCase() ||
            existingData.publicCategory?.toLowerCase() === targetCategory.name.toLowerCase()
          );
          if (!isExistingAssignment) {
            return NextResponse.json(
              { error: 'VALIDATION_ERROR', message: `Category "${targetCategory.name}" is unpublished and cannot be assigned to products.` },
              { status: 400 }
            );
          }
        }
        resolvedCategoryId = targetCategory.id;
        resolvedCategoryName = targetCategory.name;
      }
    } else if (inputCategoryName) {
      const matched = availableCategories.find(
        (c) => c.name.toLowerCase() === inputCategoryName.toLowerCase()
      );
      if (matched) {
        if (!matched.isPublished) {
          const isExistingAssignment = !isNew && (
            existingData.categoryId === matched.id ||
            existingData.category?.toLowerCase() === matched.name.toLowerCase() ||
            existingData.publicCategory?.toLowerCase() === matched.name.toLowerCase()
          );
          if (!isExistingAssignment) {
            return NextResponse.json(
              { error: 'VALIDATION_ERROR', message: `Category "${matched.name}" is unpublished and cannot be assigned to products.` },
              { status: 400 }
            );
          }
        }
        resolvedCategoryId = matched.id;
        resolvedCategoryName = matched.name;
      } else {
        if (availableCategories.length > 0) {
          const isExistingLegacy = !isNew && (
            existingData.category?.toLowerCase() === inputCategoryName.toLowerCase() ||
            existingData.publicCategory?.toLowerCase() === inputCategoryName.toLowerCase()
          );
          if (isExistingLegacy) {
            resolvedCategoryId = existingData.categoryId || undefined;
            resolvedCategoryName = inputCategoryName;
          } else {
            return NextResponse.json(
              { error: 'VALIDATION_ERROR', message: `Category "${inputCategoryName}" does not exist in product categories.` },
              { status: 400 }
            );
          }
        } else {
          resolvedCategoryId = undefined;
          resolvedCategoryName = inputCategoryName;
        }
      }
    } else {
      if (isNew) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', message: 'Product category is required.' },
          { status: 400 }
        );
      } else {
        resolvedCategoryId = existingData.categoryId;
        resolvedCategoryName = existingData.publicCategory || existingData.category || '3D Prints';
      }
    }

    const mergedData = {
      ...existingData,
      id,
      name: existingData.name || name,
      publicName: name,
      slug,
      sku: body.sku ? String(body.sku).trim() : existingData.sku || `PRN-${id.slice(-4).toUpperCase()}`,
      categoryId: resolvedCategoryId,
      category: resolvedCategoryName,
      publicCategory: resolvedCategoryName,
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
      isCommercial: true,
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
        categoryId: resolvedCategoryId,
        category: resolvedCategoryName,
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
        categoryId: resolvedCategoryId,
        category: resolvedCategoryName,
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
