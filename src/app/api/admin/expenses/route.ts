import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/db';
import { verifyServerSession } from '@/lib/server-auth';
import { logAuditEvent, extractClientIp } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Maximum supported single expense amount in AED (10 Million AED).
 * Standardized across create and update validations.
 */
export const MAX_EXPENSE_AMOUNT = 10_000_000.00;

export const SUPPORTED_PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer', 'Other'] as const;
export type PaymentMethodType = (typeof SUPPORTED_PAYMENT_METHODS)[number];

export interface ExpenseRecord {
  id: string;
  title: string;
  amount: number;
  category: string;
  categoryId?: string;
  expenseDate: string;
  vendor?: string;
  paymentMethod: PaymentMethodType;
  description?: string;
  receipt?: string;
  receiptUrl?: string;
  currency: 'AED';
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSummaryMetrics {
  totalExpenses: number;
  thisMonthExpenses: number;
  transactionsCount: number;
  highestCategory: {
    name: string;
    amount: number;
  } | null;
}

/**
 * Converts a monetary input (string or number) into integer cents using string parsing.
 * Eliminates floating point inaccuracy, rejects zero/negative values,
 * and strictly prevents more than two decimal places without silent rounding.
 */
export function parseAmountToCents(raw: any): {
  valid: boolean;
  cents?: bigint;
  amount?: number;
  formatted?: string;
  error?: string;
} {
  if (raw === undefined || raw === null || raw === '') {
    return { valid: false, error: 'Amount is required' };
  }

  const str = String(raw).trim();
  if (!str) {
    return { valid: false, error: 'Amount is required' };
  }

  // Reject non-numeric format: digits, optional decimal point with digits
  if (!/^\d+(\.\d+)?$/.test(str)) {
    return { valid: false, error: 'Amount must be a valid positive numeric monetary value' };
  }

  const parts = str.split('.');
  if (parts.length > 1 && parts[1].length > 2) {
    return {
      valid: false,
      error: 'Amount cannot have more than two decimal places. Do not provide fractional cents.',
    };
  }

  const wholeStr = parts[0].replace(/^0+/, '') || '0';
  const fracStr = (parts[1] || '').padEnd(2, '0').slice(0, 2);

  const cents = BigInt(wholeStr) * BigInt(100) + BigInt(fracStr);

  if (cents <= BigInt(0)) {
    return { valid: false, error: 'Amount must be greater than zero' };
  }

  const maxCents = BigInt(Math.round(MAX_EXPENSE_AMOUNT * 100));
  if (cents > maxCents) {
    return {
      valid: false,
      error: `Amount cannot exceed the maximum supported limit of ${MAX_EXPENSE_AMOUNT.toLocaleString('en-US', { minimumFractionDigits: 2 })} AED`,
    };
  }

  const amount = Number(cents) / 100;
  const formatted = `${wholeStr}.${fracStr}`;

  return {
    valid: true,
    cents,
    amount,
    formatted,
  };
}

export function centsToAmount(cents: bigint): number {
  return Number(cents) / 100;
}

/**
 * Normalizes and validates financial monetary amounts.
 * Prevents floating point inaccuracy, rejects zero/negative values,
 * and strictly prevents more than two decimal places without silent rounding.
 */
export function normalizeMonetaryAmount(raw: any): {
  valid: boolean;
  amount?: number;
  formatted?: string;
  error?: string;
} {
  const res = parseAmountToCents(raw);
  if (!res.valid) {
    return { valid: false, error: res.error };
  }
  return {
    valid: true,
    amount: res.amount,
    formatted: res.formatted,
  };
}

/**
 * Validates and sanitizes expense creation/update input.
 */
export function validateExpenseInput(payload: any): {
  valid: boolean;
  sanitized?: Partial<ExpenseRecord>;
  errors?: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: { payload: 'Invalid JSON body' } };
  }

  // Title
  const title = String(payload.title || '').trim();
  if (!title) {
    errors.title = 'Expense title is required';
  } else if (title.length > 200) {
    errors.title = 'Title must not exceed 200 characters';
  }

  // Amount
  const normAmount = normalizeMonetaryAmount(payload.amount);
  if (!normAmount.valid) {
    errors.amount = normAmount.error || 'Invalid amount';
  }

  // Category
  const category = String(payload.category || '').trim();
  if (!category) {
    errors.category = 'Expense category is required';
  } else if (category.length > 100) {
    errors.category = 'Category must not exceed 100 characters';
  }

  // CategoryId
  const categoryId = payload.categoryId ? String(payload.categoryId).trim() : undefined;

  // Expense Date
  const expenseDateRaw = String(payload.expenseDate || payload.date || '').trim();
  if (!expenseDateRaw) {
    errors.expenseDate = 'Expense date is required';
  } else {
    const parsedDate = new Date(expenseDateRaw);
    if (isNaN(parsedDate.getTime())) {
      errors.expenseDate = 'Invalid expense date format';
    }
  }

  // Payment Method
  const rawPayMethod = String(payload.paymentMethod || 'Card').trim().toLowerCase();
  const matchedMethod = SUPPORTED_PAYMENT_METHODS.find(
    (m) => m.toLowerCase() === rawPayMethod
  );

  if (!matchedMethod) {
    errors.paymentMethod = `Payment method must be one of: ${SUPPORTED_PAYMENT_METHODS.join(', ')}`;
  }

  // Vendor (optional)
  const vendor = payload.vendor ? String(payload.vendor).trim().slice(0, 200) : undefined;

  // Description / Notes (optional)
  const description = payload.description || payload.desc || payload.notes
    ? String(payload.description || payload.desc || payload.notes).trim().slice(0, 2000)
    : undefined;

  // Receipt URL / Reference (optional)
  const receiptUrl = payload.receiptUrl || payload.receipt
    ? String(payload.receiptUrl || payload.receipt).trim().slice(0, 1000)
    : undefined;

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  // Normalized date string (YYYY-MM-DD or ISO)
  let cleanDate = expenseDateRaw;
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(expenseDateRaw)) {
      cleanDate = expenseDateRaw;
    } else {
      const d = new Date(expenseDateRaw);
      cleanDate = d.toISOString().split('T')[0];
    }
  } catch {}

  return {
    valid: true,
    sanitized: {
      title,
      amount: normAmount.amount,
      category,
      categoryId,
      expenseDate: cleanDate,
      vendor,
      paymentMethod: matchedMethod,
      description,
      receipt: receiptUrl,
      receiptUrl,
      currency: 'AED',
    },
  };
}

/**
 * GET /api/admin/expenses
 * Returns expense records, categories, and period summary metrics.
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
    const search = searchParams.get('search')?.toLowerCase().trim() || '';
    const categoryFilter = searchParams.get('category')?.trim() || '';
    const startDateParam = searchParams.get('startDate')?.trim() || '';
    const endDateParam = searchParams.get('endDate')?.trim() || '';
    const rangeParam = searchParams.get('range')?.toLowerCase().trim() || '';

    // Fetch all expenses from ledger_collections
    const rows = await sql`
      SELECT record_id, data, updated_at
      FROM public.ledger_collections
      WHERE collection_name = 'expenses'
      ORDER BY COALESCE(data->>'expenseDate', data->>'date', '') DESC, updated_at DESC;
    `;

    // Fetch categories
    const catRows = await sql`
      SELECT record_id, data, updated_at
      FROM public.ledger_collections
      WHERE collection_name = 'expense_categories'
      ORDER BY (data->>'order')::int ASC NULLS LAST, updated_at ASC;
    `;

    const categories = catRows.map((r: any) => ({
      id: String(r.record_id),
      name: String(r.data?.name || ''),
      description: r.data?.description,
      color: r.data?.color,
      isDefault: Boolean(r.data?.isDefault),
      order: r.data?.order ?? 999,
      createdAt: r.data?.createdAt || r.updated_at,
      updatedAt: r.updated_at,
    }));

    // Date boundary helpers
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let computedStart = startDateParam;
    let computedEnd = endDateParam;

    if (rangeParam === 'today') {
      computedStart = todayStr;
      computedEnd = todayStr;
    } else if (rangeParam === '7d') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      computedStart = d.toISOString().split('T')[0];
      computedEnd = todayStr;
    } else if (rangeParam === '30d') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      computedStart = d.toISOString().split('T')[0];
      computedEnd = todayStr;
    } else if (rangeParam === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      computedStart = startOfMonth.toISOString().split('T')[0];
      computedEnd = todayStr;
    } else if (rangeParam === 'last_month') {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      computedStart = startOfLastMonth.toISOString().split('T')[0];
      computedEnd = endOfLastMonth.toISOString().split('T')[0];
    }

    let thisMonthCents = BigInt(0);
    const allParsedExpenses: ExpenseRecord[] = [];

    for (const r of rows) {
      const d = r.data || {};
      const parsedAmt = parseAmountToCents(d.amount ?? 0);
      const amount = parsedAmt.valid && parsedAmt.amount !== undefined ? parsedAmt.amount : 0;
      const cents = parsedAmt.valid && parsedAmt.cents !== undefined ? parsedAmt.cents : BigInt(0);
      const expDate = String(d.expenseDate || d.date || todayStr).slice(0, 10);

      const record: ExpenseRecord = {
        id: String(d.id || r.record_id),
        title: String(d.title || d.desc || 'Expense'),
        amount,
        category: String(d.category || 'Other Expenses'),
        categoryId: d.categoryId ? String(d.categoryId) : undefined,
        expenseDate: expDate,
        vendor: d.vendor ? String(d.vendor) : undefined,
        paymentMethod: (d.paymentMethod as PaymentMethodType) || 'Card',
        description: d.description || d.desc || d.notes ? String(d.description || d.desc || d.notes) : undefined,
        receipt: d.receipt || d.receiptUrl ? String(d.receipt || d.receiptUrl) : undefined,
        receiptUrl: d.receiptUrl || d.receipt ? String(d.receiptUrl || d.receipt) : undefined,
        currency: 'AED',
        createdAt: d.createdAt ? String(d.createdAt) : new Date(r.updated_at).toISOString(),
        updatedAt: new Date(r.updated_at).toISOString(),
      };

      allParsedExpenses.push(record);

      // Current calendar month aggregation using integer cents
      if (expDate.startsWith(currentMonthPrefix)) {
        thisMonthCents += cents;
      }
    }

    // Filter expenses according to parameters
    const filtered = allParsedExpenses.filter((e) => {
      // 1. Search filter
      if (search) {
        const matchesTitle = e.title.toLowerCase().includes(search);
        const matchesVendor = e.vendor?.toLowerCase().includes(search);
        const matchesCat = e.category.toLowerCase().includes(search);
        const matchesDesc = e.description?.toLowerCase().includes(search);
        if (!matchesTitle && !matchesVendor && !matchesCat && !matchesDesc) {
          return false;
        }
      }

      // 2. Category filter
      if (categoryFilter && categoryFilter !== 'ALL') {
        const matchesName = e.category.toLowerCase() === categoryFilter.toLowerCase();
        const matchesId = e.categoryId === categoryFilter;
        if (!matchesName && !matchesId) return false;
      }

      // 3. Date range filter
      if (computedStart && e.expenseDate < computedStart) return false;
      if (computedEnd && e.expenseDate > computedEnd) return false;

      return true;
    });

    // Summary calculations on filtered set using integer cents (zero floating point drift)
    let totalFilteredCents = BigInt(0);
    const categoryCents: Record<string, bigint> = {};

    filtered.forEach((e) => {
      const parsed = parseAmountToCents(e.amount);
      const c = parsed.valid && parsed.cents !== undefined ? parsed.cents : BigInt(0);
      totalFilteredCents += c;
      const catKey = e.category || 'Other Expenses';
      categoryCents[catKey] = (categoryCents[catKey] || BigInt(0)) + c;
    });

    let highestCategory: { name: string; amount: number } | null = null;
    let maxCatCents = BigInt(-1);
    for (const [catName, catAmtCents] of Object.entries(categoryCents)) {
      if (catAmtCents > maxCatCents) {
        maxCatCents = catAmtCents;
        highestCategory = { name: catName, amount: centsToAmount(catAmtCents) };
      }
    }

    const metrics: ExpenseSummaryMetrics = {
      totalExpenses: centsToAmount(totalFilteredCents),
      thisMonthExpenses: centsToAmount(thisMonthCents),
      transactionsCount: filtered.length,
      highestCategory,
    };

    return NextResponse.json({
      success: true,
      count: filtered.length,
      total: allParsedExpenses.length,
      metrics,
      categories,
      expenses: filtered,
    });
  } catch (err: any) {
    console.error('Error in GET /api/admin/expenses:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve expenses.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/expenses
 * Creates a new expense record in public.ledger_collections.
 * Strictly financial accounting: does not modify filament or product stock.
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
    const validation = validateExpenseInput(body);

    if (!validation.valid || !validation.sanitized) {
      return NextResponse.json(
        {
          error: 'VALIDATION_FAILED',
          message: 'Expense data validation failed',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const id = body.id && String(body.id).trim().length > 3
      ? String(body.id).trim()
      : `exp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    const now = new Date().toISOString();
    const newExpense: ExpenseRecord = {
      id,
      title: validation.sanitized.title!,
      amount: validation.sanitized.amount!,
      category: validation.sanitized.category!,
      categoryId: validation.sanitized.categoryId,
      expenseDate: validation.sanitized.expenseDate!,
      vendor: validation.sanitized.vendor,
      paymentMethod: validation.sanitized.paymentMethod!,
      description: validation.sanitized.description,
      receipt: validation.sanitized.receipt,
      receiptUrl: validation.sanitized.receiptUrl,
      currency: 'AED',
      createdAt: now,
      updatedAt: now,
    };

    // Stored solely in collection_name = 'expenses'
    await sql`
      INSERT INTO public.ledger_collections (collection_name, record_id, data, updated_at)
      VALUES (
        'expenses',
        ${id},
        ${JSON.stringify(newExpense)}::jsonb,
        NOW()
      )
      ON CONFLICT (collection_name, record_id)
      DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW();
    `;

    await logAuditEvent({
      userId: auth.user.id,
      action: 'EXPENSE_CREATE',
      entityType: 'EXPENSE',
      entityId: id,
      ipAddress: extractClientIp(req),
      details: {
        title: newExpense.title,
        amount: newExpense.amount,
        category: newExpense.category,
      },
    });

    return NextResponse.json({ success: true, expense: newExpense }, { status: 201 });
  } catch (err: any) {
    console.error('Error in POST /api/admin/expenses:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to record expense.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/expenses
 * Safely updates an existing expense record.
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
        { error: 'BAD_REQUEST', message: 'Expense ID and updated payload are required.' },
        { status: 400 }
      );
    }

    const expenseId = String(body.id).trim();

    // Verify record exists
    const existingRows = await sql`
      SELECT record_id, data, updated_at
      FROM public.ledger_collections
      WHERE collection_name = 'expenses' AND record_id = ${expenseId}
      LIMIT 1;
    `;

    if (existingRows.length === 0) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Expense record not found.' },
        { status: 404 }
      );
    }

    const existingData = existingRows[0].data || {};
    const merged = { ...existingData, ...body };
    const validation = validateExpenseInput(merged);

    if (!validation.valid || !validation.sanitized) {
      return NextResponse.json(
        {
          error: 'VALIDATION_FAILED',
          message: 'Expense update validation failed',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const updatedExpense: ExpenseRecord = {
      id: expenseId,
      title: validation.sanitized.title!,
      amount: validation.sanitized.amount!,
      category: validation.sanitized.category!,
      categoryId: validation.sanitized.categoryId || existingData.categoryId,
      expenseDate: validation.sanitized.expenseDate!,
      vendor: validation.sanitized.vendor,
      paymentMethod: validation.sanitized.paymentMethod!,
      description: validation.sanitized.description,
      receipt: validation.sanitized.receipt,
      receiptUrl: validation.sanitized.receiptUrl,
      currency: 'AED',
      createdAt: existingData.createdAt || existingRows[0].updated_at,
      updatedAt: now,
    };

    await sql`
      UPDATE public.ledger_collections
      SET data = ${JSON.stringify(updatedExpense)}::jsonb, updated_at = NOW()
      WHERE collection_name = 'expenses' AND record_id = ${expenseId};
    `;

    await logAuditEvent({
      userId: auth.user.id,
      action: 'EXPENSE_UPDATE',
      entityType: 'EXPENSE',
      entityId: expenseId,
      ipAddress: extractClientIp(req),
      details: {
        title: updatedExpense.title,
        amount: updatedExpense.amount,
        category: updatedExpense.category,
      },
    });

    return NextResponse.json({ success: true, expense: updatedExpense });
  } catch (err: any) {
    console.error('Error in PUT /api/admin/expenses:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to update expense.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/expenses
 * Deletes an expense record after authentication and validation.
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
    let expenseId = searchParams.get('id');

    if (!expenseId) {
      const body = await req.json().catch(() => null);
      if (body && typeof body === 'object' && body.id) {
        expenseId = String(body.id);
      }
    }

    if (!expenseId) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Expense ID is required for deletion.' },
        { status: 400 }
      );
    }

    // Verify existence
    const existing = await sql`
      SELECT record_id, data
      FROM public.ledger_collections
      WHERE collection_name = 'expenses' AND record_id = ${expenseId}
      LIMIT 1;
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Expense record not found.' },
        { status: 404 }
      );
    }

    await sql`
      DELETE FROM public.ledger_collections
      WHERE collection_name = 'expenses' AND record_id = ${expenseId};
    `;

    await logAuditEvent({
      userId: auth.user.id,
      action: 'EXPENSE_DELETE',
      entityType: 'EXPENSE',
      entityId: expenseId,
      ipAddress: extractClientIp(req),
      details: { title: existing[0].data?.title },
    });

    return NextResponse.json({ success: true, deleted: expenseId });
  } catch (err: any) {
    console.error('Error in DELETE /api/admin/expenses:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to delete expense.' },
      { status: 500 }
    );
  }
}
