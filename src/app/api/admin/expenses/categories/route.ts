import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql, withTransaction } from '@/lib/db';
import { verifyServerSession } from '@/lib/server-auth';
import { logAuditEvent, extractClientIp } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export interface ExpenseCategoryRecord {
  id: string;
  name: string;
  description?: string;
  color?: string;
  isDefault: boolean;
  order?: number;
  expenseCount?: number;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_CATEGORY_DEFINITIONS: Array<{ id: string; name: string; order: number }> = [
  { id: 'cat_default_filament_materials', name: 'Filament & Materials', order: 1 },
  { id: 'cat_default_electricity_utilities', name: 'Electricity & Utilities', order: 2 },
  { id: 'cat_default_printer_maintenance_repairs', name: 'Printer Maintenance & Repairs', order: 3 },
  { id: 'cat_default_spare_parts_accessories', name: 'Spare Parts & Accessories', order: 4 },
  { id: 'cat_default_packaging_delivery', name: 'Packaging & Delivery', order: 5 },
  { id: 'cat_default_marketing_advertising', name: 'Marketing & Advertising', order: 6 },
  { id: 'cat_default_software_subscriptions', name: 'Software & Subscriptions', order: 7 },
  { id: 'cat_default_rent_workspace', name: 'Rent & Workspace', order: 8 },
  { id: 'cat_default_transportation', name: 'Transportation', order: 9 },
  { id: 'cat_default_other_expenses', name: 'Other Expenses', order: 10 },
];

export const DEFAULT_EXPENSE_CATEGORIES = DEFAULT_CATEGORY_DEFINITIONS.map((c) => c.name) as readonly string[];

/**
 * Validates and sanitizes category input with duplicate-name protection.
 */
export function validateCategoryInput(
  payload: any,
  existingCategories: ExpenseCategoryRecord[] = [],
  currentCategoryId?: string
): { valid: boolean; sanitized?: Partial<ExpenseCategoryRecord>; error?: string } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid JSON payload' };
  }

  const rawName = String(payload.name || '').trim();
  if (!rawName) {
    return { valid: false, error: 'Category name is required' };
  }

  if (rawName.length > 100) {
    return { valid: false, error: 'Category name must not exceed 100 characters' };
  }

  // Duplicate check (case-insensitive & whitespace-trimmed)
  const lowerName = rawName.toLowerCase();
  const isDuplicate = existingCategories.some(
    (c) => c.name.trim().toLowerCase() === lowerName && c.id !== currentCategoryId
  );

  if (isDuplicate) {
    return { valid: false, error: `Category "${rawName}" already exists` };
  }

  const description = payload.description ? String(payload.description).trim().slice(0, 500) : undefined;
  const color = payload.color ? String(payload.color).trim().slice(0, 30) : undefined;

  return {
    valid: true,
    sanitized: {
      name: rawName,
      description,
      color,
    },
  };
}

/**
 * Ensures default categories exist in database without creating duplicates.
 */
async function ensureDefaultCategories(): Promise<ExpenseCategoryRecord[]> {
  if (!sql) return [];

  const rows = await sql`
    SELECT record_id, data, updated_at
    FROM public.ledger_collections
    WHERE collection_name = 'expense_categories'
    ORDER BY (data->>'order')::int ASC NULLS LAST, updated_at ASC;
  `;

  const existing: ExpenseCategoryRecord[] = rows.map((r: any): ExpenseCategoryRecord => {
    const d = r.data || {};
    return {
      id: String(r.record_id),
      name: String(d.name || ''),
      description: d.description ? String(d.description) : undefined,
      color: d.color ? String(d.color) : undefined,
      isDefault: Boolean(d.isDefault),
      order: typeof d.order === 'number' ? d.order : 999,
      createdAt: d.createdAt ? String(d.createdAt) : new Date(r.updated_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    };
  });

  const existingNames = new Set(existing.map((c) => c.name.trim().toLowerCase()));
  const missingDefaults: ExpenseCategoryRecord[] = [];

  DEFAULT_CATEGORY_DEFINITIONS.forEach((def) => {
    if (!existingNames.has(def.name.toLowerCase())) {
      const now = new Date().toISOString();
      missingDefaults.push({
        id: def.id,
        name: def.name,
        isDefault: true,
        order: def.order,
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  if (missingDefaults.length > 0) {
    for (const cat of missingDefaults) {
      await sql`
        INSERT INTO public.ledger_collections (collection_name, record_id, data, updated_at)
        VALUES (
          'expense_categories',
          ${cat.id},
          ${JSON.stringify(cat)}::jsonb,
          NOW()
        )
        ON CONFLICT (collection_name, record_id) DO NOTHING;
      `;
      existing.push(cat);
    }
  }

  existing.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return existing;
}

/**
 * GET /api/admin/expenses/categories
 * Returns all categories (defaults and custom) with live expense counts.
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

    const categories = await ensureDefaultCategories();

    // Query live expense records to count references per category
    const expenseRows = await sql`
      SELECT
        data->>'categoryId' as category_id,
        LOWER(COALESCE(data->>'category', '')) as category_name
      FROM public.ledger_collections
      WHERE collection_name = 'expenses';
    `;

    const categoriesWithCount = categories.map((cat) => {
      const lowerCatName = cat.name.trim().toLowerCase();
      const expenseCount = expenseRows.filter(
        (e: any) =>
          (e.category_id && e.category_id === cat.id) ||
          (e.category_name && e.category_name === lowerCatName)
      ).length;

      return {
        ...cat,
        expenseCount,
      };
    });

    return NextResponse.json({
      success: true,
      count: categoriesWithCount.length,
      categories: categoriesWithCount,
    });
  } catch (err: any) {
    console.error('Error in GET /api/admin/expenses/categories:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve expense categories.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/expenses/categories
 * Creates a custom expense category with duplicate protection.
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

    const existing = await ensureDefaultCategories();
    const validation = validateCategoryInput(body, existing);

    if (!validation.valid || !validation.sanitized) {
      const isDuplicate = validation.error?.includes('already exists');
      return NextResponse.json(
        { error: isDuplicate ? 'DUPLICATE_CATEGORY' : 'VALIDATION_FAILED', message: validation.error },
        { status: isDuplicate ? 409 : 400 }
      );
    }

    const id = `cat_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();
    const newCategory: ExpenseCategoryRecord = {
      id,
      name: validation.sanitized.name!,
      description: validation.sanitized.description,
      color: validation.sanitized.color,
      isDefault: false,
      order: existing.length + 1,
      createdAt: now,
      updatedAt: now,
    };

    await sql`
      INSERT INTO public.ledger_collections (collection_name, record_id, data, updated_at)
      VALUES (
        'expense_categories',
        ${id},
        ${JSON.stringify(newCategory)}::jsonb,
        NOW()
      );
    `;

    await logAuditEvent({
      userId: auth.user.id,
      action: 'EXPENSE_CATEGORY_CREATE',
      entityType: 'EXPENSE_CATEGORY',
      entityId: id,
      ipAddress: extractClientIp(req),
      details: { name: newCategory.name },
    });

    return NextResponse.json(
      { success: true, category: { ...newCategory, expenseCount: 0 } },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Error in POST /api/admin/expenses/categories:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to create expense category.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/expenses/categories
 * Renames an existing category and preserves references across historical expenses.
 */
export async function PUT(req: NextRequest) {
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
    if (!body || typeof body !== 'object' || !body.id) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Category ID and updated payload are required.' },
        { status: 400 }
      );
    }

    const categoryId = String(body.id).trim();
    const existing = await ensureDefaultCategories();
    const target = existing.find((c) => c.id === categoryId);

    if (!target) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Expense category not found.' },
        { status: 404 }
      );
    }

    const validation = validateCategoryInput(body, existing, categoryId);
    if (!validation.valid || !validation.sanitized) {
      const isDuplicate = validation.error?.includes('already exists');
      return NextResponse.json(
        { error: isDuplicate ? 'DUPLICATE_CATEGORY' : 'VALIDATION_FAILED', message: validation.error },
        { status: isDuplicate ? 409 : 400 }
      );
    }

    const oldName = target.name;
    const newName = validation.sanitized.name!;
    const now = new Date().toISOString();

    const updatedCategory: ExpenseCategoryRecord = {
      ...target,
      name: newName,
      description: validation.sanitized.description !== undefined ? validation.sanitized.description : target.description,
      color: validation.sanitized.color !== undefined ? validation.sanitized.color : target.color,
      updatedAt: now,
    };

    // Atomic category rename and referencing expenses update
    if (oldName !== newName) {
      await withTransaction(async (client) => {
        // 1. Update the category record
        await client.query(
          `INSERT INTO public.ledger_collections (collection_name, record_id, data, updated_at)
           VALUES (
             'expense_categories',
             $1,
             $2::jsonb,
             NOW()
           )
           ON CONFLICT (collection_name, record_id)
           DO UPDATE SET
             data = EXCLUDED.data,
             updated_at = NOW();`,
          [categoryId, JSON.stringify(updatedCategory)]
        );

        // 2. Atomically update all referencing expenses in the same transaction
        await client.query(
          `UPDATE public.ledger_collections
           SET data = jsonb_set(
             jsonb_set(data, '{category}', to_jsonb($1::text)),
             '{categoryId}',
             to_jsonb($2::text)
           ),
           updated_at = NOW()
           WHERE collection_name = 'expenses'
             AND (
               (data->>'categoryId' = $2) OR
               (LOWER(COALESCE(data->>'category', '')) = LOWER($3))
             );`,
          [newName, categoryId, oldName]
        );
      });
    } else {
      await sql`
        INSERT INTO public.ledger_collections (collection_name, record_id, data, updated_at)
        VALUES (
          'expense_categories',
          ${categoryId},
          ${JSON.stringify(updatedCategory)}::jsonb,
          NOW()
        )
        ON CONFLICT (collection_name, record_id)
        DO UPDATE SET
          data = EXCLUDED.data,
          updated_at = NOW();
      `;
    }

    await logAuditEvent({
      userId: auth.user.id,
      action: 'EXPENSE_CATEGORY_UPDATE',
      entityType: 'EXPENSE_CATEGORY',
      entityId: categoryId,
      ipAddress: extractClientIp(req),
      details: { oldName, newName },
    });

    return NextResponse.json({
      success: true,
      category: updatedCategory,
    });
  } catch (err: any) {
    console.error('Error in PUT /api/admin/expenses/categories:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to update expense category.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/expenses/categories
 * Deletes an unused category. If referenced by any expense, returns 409 Conflict.
 */
export async function DELETE(req: NextRequest) {
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
    let categoryId = searchParams.get('id');

    if (!categoryId) {
      const body = await req.json().catch(() => null);
      if (body && typeof body === 'object' && body.id) {
        categoryId = String(body.id);
      }
    }

    if (!categoryId) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Category ID is required for deletion.' },
        { status: 400 }
      );
    }

    const existing = await ensureDefaultCategories();
    const target = existing.find((c) => c.id === categoryId);

    if (!target) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Expense category not found.' },
        { status: 404 }
      );
    }

    // Default categories are permanent system records and cannot be deleted
    if (target.isDefault) {
      return NextResponse.json(
        {
          error: 'CANNOT_DELETE_DEFAULT_CATEGORY',
          message: `Category "${target.name}" is a protected system default category and cannot be deleted.`,
        },
        { status: 400 }
      );
    }

    // Check if any expenses reference this category
    const targetLower = target.name.trim().toLowerCase();
    const countRows = await sql`
      SELECT COUNT(*)::int as count
      FROM public.ledger_collections
      WHERE collection_name = 'expenses'
        AND (
          data->>'categoryId' = ${categoryId} OR
          LOWER(COALESCE(data->>'category', '')) = ${targetLower}
        );
    `;

    const affectedExpenses = Number(countRows[0]?.count || 0);

    if (affectedExpenses > 0) {
      return NextResponse.json(
        {
          error: 'CATEGORY_IN_USE',
          message: `Cannot delete category "${target.name}" because it is currently referenced by ${affectedExpenses} expense(s). Reassign or delete these expenses first.`,
          affectedExpenses,
        },
        { status: 409 }
      );
    }

    // Safe to delete from database
    await sql`
      DELETE FROM public.ledger_collections
      WHERE collection_name = 'expense_categories' AND record_id = ${categoryId};
    `;

    await logAuditEvent({
      userId: auth.user.id,
      action: 'EXPENSE_CATEGORY_DELETE',
      entityType: 'EXPENSE_CATEGORY',
      entityId: categoryId,
      ipAddress: extractClientIp(req),
      details: { name: target.name },
    });

    return NextResponse.json({
      success: true,
      deleted: categoryId,
    });
  } catch (err: any) {
    console.error('Error in DELETE /api/admin/expenses/categories:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to delete expense category.' },
      { status: 500 }
    );
  }
}
