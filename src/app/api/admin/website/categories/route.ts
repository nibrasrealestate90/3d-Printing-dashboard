import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql, withTransaction } from '@/lib/db';
import { verifyServerSession } from '@/lib/server-auth';
import { logAuditEvent, extractClientIp } from '@/lib/auth';
import { validateCategoryItem, CategoryItem } from '@/lib/storefront';

export const dynamic = 'force-dynamic';

async function getCategoriesDocument(): Promise<CategoryItem[]> {
  if (!sql) return [];
  const rows = await sql`
    SELECT data
    FROM public.ledger_collections
    WHERE collection_name = 'website_content' AND record_id = 'categories'
    LIMIT 1;
  `;
  if (rows.length === 0 || !Array.isArray(rows[0].data?.items)) {
    return [];
  }
  return rows[0].data.items;
}

async function saveCategoriesDocument(items: CategoryItem[]) {
  if (!sql) throw new Error('Database unavailable');
  await sql`
    INSERT INTO public.ledger_collections (collection_name, record_id, data, updated_at)
    VALUES (
      'website_content',
      'categories',
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
 * Counts how many products in public.ledger_collections match a category.
 * Matches by stable categoryId or category name / publicCategory (case-insensitive).
 */
async function countAssignedProducts(category: { id: string; name: string }): Promise<number> {
  if (!sql) return 0;
  const rows = await sql`
    SELECT COUNT(*)::int as count
    FROM public.ledger_collections
    WHERE collection_name = 'products'
      AND (
        (data->>'categoryId' = ${category.id}) OR
        (LOWER(COALESCE(data->>'category', '')) = LOWER(${category.name})) OR
        (LOWER(COALESCE(data->>'publicCategory', '')) = LOWER(${category.name}))
      );
  `;
  return Number(rows[0]?.count || 0);
}

/**
 * GET /api/admin/website/categories
 * Authenticated endpoint to retrieve all categories (both published and hidden)
 * with dynamically calculated product counts from actual product records.
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

    const items = await getCategoriesDocument();

    // Query all product records to calculate live product counts
    const productRows = await sql`
      SELECT
        data->>'categoryId' as category_id,
        LOWER(COALESCE(data->>'category', '')) as category_name,
        LOWER(COALESCE(data->>'publicCategory', '')) as public_category_name
      FROM public.ledger_collections
      WHERE collection_name = 'products';
    `;

    const categoriesWithCount = items.map((cat) => {
      const lowerName = cat.name.trim().toLowerCase();
      const productCount = productRows.filter((p: any) =>
        (p.category_id && p.category_id === cat.id) ||
        (p.category_name && p.category_name === lowerName) ||
        (p.public_category_name && p.public_category_name === lowerName)
      ).length;

      return {
        ...cat,
        productCount,
      };
    });

    // Sort by order ascending
    categoriesWithCount.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return NextResponse.json({
      success: true,
      count: categoriesWithCount.length,
      items: categoriesWithCount,
    });
  } catch (err: any) {
    console.error('Error in GET /api/admin/website/categories:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve categories.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/website/categories
 * Authenticated endpoint to manage categories: create, update, delete, reorder, toggle_publish.
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
    const currentItems = await getCategoriesDocument();
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
      updated.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      await saveCategoriesDocument(updated);
      await logAuditEvent({
        userId: auth.user.id,
        action: 'CATEGORY_REORDER',
        entityType: 'product_category',
        ipAddress: clientIp,
        details: { count: updated.length },
      });

      return NextResponse.json({ success: true, items: updated });
    }

    // 2. Action: TOGGLE PUBLISH
    if (action === 'toggle_publish') {
      const id = String(body.id || '').trim();
      const target = currentItems.find((c) => c.id === id);
      if (!target) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: 'Category not found.' },
          { status: 404 }
        );
      }

      const isPublished = typeof body.isPublished === 'boolean'
        ? body.isPublished
        : typeof body.published === 'boolean'
          ? body.published
          : !target.isPublished;

      target.isPublished = isPublished;
      target.updatedAt = new Date().toISOString();

      await saveCategoriesDocument(currentItems);
      await logAuditEvent({
        userId: auth.user.id,
        action: isPublished ? 'CATEGORY_PUBLISH' : 'CATEGORY_HIDE',
        entityType: 'product_category',
        entityId: id,
        ipAddress: clientIp,
        details: { isPublished },
      });

      return NextResponse.json({ success: true, item: target });
    }

    // 3. Action: DELETE (Guarded: Rejected if any products are assigned)
    if (action === 'delete') {
      const id = String(body.id || '').trim();
      if (!id) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', message: 'Category ID is required for deletion.' },
          { status: 400 }
        );
      }

      const target = currentItems.find((c) => c.id === id);
      if (!target) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: 'Category not found.' },
          { status: 404 }
        );
      }

      // Check if products are currently assigned to this category
      const assignedCount = await countAssignedProducts(target);
      if (assignedCount > 0) {
        return NextResponse.json(
          {
            error: 'CATEGORY_IN_USE',
            message: `Cannot delete category "${target.name}" because ${assignedCount} product(s) are currently assigned to it. Reassign or delete those products first.`,
            assignedProductsCount: assignedCount,
          },
          { status: 400 }
        );
      }

      const filtered = currentItems.filter((c) => c.id !== id);
      await saveCategoriesDocument(filtered);
      await logAuditEvent({
        userId: auth.user.id,
        action: 'CATEGORY_DELETE',
        entityType: 'product_category',
        entityId: id,
        ipAddress: clientIp,
        details: { name: target.name, slug: target.slug },
      });

      return NextResponse.json({
        success: true,
        id,
        remainingCount: filtered.length,
      });
    }

    // 4. Action: UPDATE
    if (action === 'update') {
      const id = String(body.id || '').trim();
      if (!id) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', message: 'Category ID is required for update.' },
          { status: 400 }
        );
      }

      const target = currentItems.find((c) => c.id === id);
      if (!target) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: 'Category not found.' },
          { status: 404 }
        );
      }

      const val = validateCategoryItem(body, currentItems, target.id);
      if (!val.valid || !val.sanitized) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', errors: val.errors },
          { status: 400 }
        );
      }

      const oldName = target.name;
      const newName = val.sanitized.name!;
      const isRenamed = oldName.trim().toLowerCase() !== newName.trim().toLowerCase();

      const updatedTarget: CategoryItem = {
        ...target,
        name: newName,
        slug: val.sanitized.slug || target.slug,
        description: val.sanitized.description !== undefined ? val.sanitized.description : target.description,
        imageUrl: val.sanitized.imageUrl || target.imageUrl,
        isPublished: val.sanitized.isPublished ?? target.isPublished,
        order: typeof val.sanitized.order === 'number' ? val.sanitized.order : target.order,
        updatedAt: new Date().toISOString(),
      };
      const updatedItems = currentItems.map((c) => (c.id === target.id ? updatedTarget : c));

      // If category is renamed, update all assigned products and save categories document inside an atomic transaction!
      if (isRenamed) {
        await withTransaction(async (client) => {
          await client.query(
            `UPDATE public.ledger_collections
             SET data = jsonb_set(
               jsonb_set(
                 jsonb_set(data, '{category}', to_jsonb($1::text)),
                 '{publicCategory}', to_jsonb($1::text)
               ),
               '{categoryId}', to_jsonb($2::text)
             ),
             updated_at = NOW()
             WHERE collection_name = 'products'
               AND (
                 (data->>'categoryId' = $2) OR
                 (LOWER(COALESCE(data->>'category', '')) = LOWER($3)) OR
                 (LOWER(COALESCE(data->>'publicCategory', '')) = LOWER($3))
               );`,
            [newName, target.id, oldName]
          );

          await client.query(
            `INSERT INTO public.ledger_collections (collection_name, record_id, data, updated_at)
             VALUES (
               'website_content',
               'categories',
               $1::jsonb,
               NOW()
             )
             ON CONFLICT (collection_name, record_id)
             DO UPDATE SET
               data = EXCLUDED.data,
               updated_at = NOW();`,
            [JSON.stringify({ items: updatedItems, updatedAt: updatedTarget.updatedAt })]
          );
        });

        await logAuditEvent({
          userId: auth.user.id,
          action: 'CATEGORY_RENAME',
          entityType: 'product_category',
          entityId: target.id,
          ipAddress: clientIp,
          details: { oldName, newName, categoryId: target.id },
        });
      } else {
        await saveCategoriesDocument(updatedItems);
      }

      await logAuditEvent({
        userId: auth.user.id,
        action: 'CATEGORY_UPDATE',
        entityType: 'product_category',
        entityId: target.id,
        ipAddress: clientIp,
        details: { name: updatedTarget.name, slug: updatedTarget.slug, isPublished: updatedTarget.isPublished },
      });

      return NextResponse.json({ success: true, item: updatedTarget });
    }

    // 5. Action: CREATE (default)
    const val = validateCategoryItem(body, currentItems);
    if (!val.valid || !val.sanitized) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', errors: val.errors },
        { status: 400 }
      );
    }

    const proposedId = body.id && typeof body.id === 'string' && body.id.trim()
      ? body.id.trim()
      : `cat-${val.sanitized.slug}`;

    // Ensure ID is unique
    let finalId = proposedId;
    if (currentItems.some((c) => c.id === finalId)) {
      finalId = `cat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    const newItem: CategoryItem = {
      id: finalId,
      name: val.sanitized.name!,
      slug: val.sanitized.slug!,
      description: val.sanitized.description || '',
      imageUrl: val.sanitized.imageUrl!,
      order: typeof val.sanitized.order === 'number' && val.sanitized.order > 0
        ? val.sanitized.order
        : currentItems.length + 1,
      isPublished: val.sanitized.isPublished ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    currentItems.push(newItem);
    await saveCategoriesDocument(currentItems);

    await logAuditEvent({
      userId: auth.user.id,
      action: 'CATEGORY_CREATE',
      entityType: 'product_category',
      entityId: newItem.id,
      ipAddress: clientIp,
      details: { name: newItem.name, slug: newItem.slug, isPublished: newItem.isPublished },
    });

    return NextResponse.json({ success: true, item: newItem }, { status: 201 });
  } catch (err: any) {
    console.error('Error in POST /api/admin/website/categories:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to process category action.' },
      { status: 500 }
    );
  }
}
