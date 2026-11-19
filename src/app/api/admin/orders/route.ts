import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from '@/lib/db';
import { verifyServerSession } from '@/lib/server-auth';
import { logAuditEvent, extractClientIp } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export interface OrderLineItem {
  productId?: string;
  name: string;
  qty: number;
  price: number;
  total: number;
  imageUrl?: string;
}

export interface CommercialOrderRecord {
  id: string;
  type: 'sale';
  no: string;
  number: string;
  invoiceNumber: string;
  date: string;
  client: string;
  clientName: string;
  customerName: string;
  phone: string;
  customerPhone: string;
  email?: string;
  customerEmail?: string;
  lines: OrderLineItem[];
  subtotal: number;
  sub: number;
  discount: number;
  disc: number;
  vatPct: number;
  vat: number;
  total: number;
  amount: number;
  paid: number;
  balance: number;
  bal: number;
  status: string;
  paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING';
  fulfillmentStatus: 'IN_PRODUCTION' | 'READY' | 'DELIVERED';
  paymentMethod: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Helper to fetch configured VAT percentage from settings in ledger_collections.
 * Safe fallback: 5 (standard UAE rate) if setting is absent or unparseable.
 */
export async function getConfiguredVatRate(): Promise<number> {
  try {
    if (!sql) return 5;
    const settingsRows = await sql`
      SELECT record_id, data FROM public.ledger_collections 
      WHERE collection_name = 'settings' 
      ORDER BY CASE WHEN record_id = 'app-settings' THEN 0 ELSE 1 END, updated_at DESC;
    `;
    for (const row of settingsRows) {
      const d = row.data || {};
      if (d.vatPct !== undefined && d.vatPct !== null && d.vatPct !== '') {
        const parsed = Number(d.vatPct);
        if (!isNaN(parsed) && parsed >= 0) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('Could not read VAT rate from settings, falling back to 5%:', err);
  }
  return 5;
}

/**
 * Clean phone number and generate WhatsApp direct link
 */
export function sanitizeWhatsAppPhone(phone: string): { display: string; cleanDigits: string; waLink: string } {
  const display = String(phone || '').trim();
  const digits = display.replace(/\D/g, '');
  let international = digits;
  if (digits.startsWith('05') && digits.length === 10) {
    international = '971' + digits.slice(1);
  } else if (digits.startsWith('5') && digits.length === 9) {
    international = '971' + digits;
  }
  const waLink = international ? `https://wa.me/${international}` : '';
  return { display, cleanDigits: international, waLink };
}

/**
 * GET /api/admin/orders
 * Returns all commercial sales orders, metrics, and summary data.
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
    const paymentFilter = searchParams.get('payment')?.toUpperCase().trim() || 'ALL';
    const fulfillmentFilter = searchParams.get('fulfillment')?.toUpperCase().trim() || 'ALL';

    const configuredVatPct = await getConfiguredVatRate();

    const rows = await sql`
      SELECT record_id, data, updated_at
      FROM public.ledger_collections
      WHERE collection_name = 'invoices'
      ORDER BY updated_at DESC;
    `;

    let totalOrders = 0;
    let pendingPayments = 0;
    let deliveredOrders = 0;
    const orders: CommercialOrderRecord[] = [];

    for (const r of rows) {
      const d = (r.data && typeof r.data === 'object') ? r.data : {};

      // Exclude voided documents
      const statusLower = String(d.status || '').toLowerCase().trim();
      if (statusLower === 'void') continue;

      // Exclude quotations and FOC documents
      const typeLower = String(d.type || '').toLowerCase().trim();
      if (typeLower === 'quote' || typeLower === 'foc') continue;
      if (typeLower !== 'sale' && typeLower !== '') continue;

      // 1. Metric: Total Orders
      totalOrders += 1;

      // Calculate totals
      let orderTotal = 0;
      if (d.total != null && d.total !== '' && !isNaN(Number(d.total))) {
        orderTotal = Number(d.total);
      } else if (d.amount != null && d.amount !== '' && !isNaN(Number(d.amount))) {
        orderTotal = Number(d.amount);
      } else if (Array.isArray(d.lines)) {
        const sub = d.lines.reduce((acc: number, l: any) => acc + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
        const disc = Math.min(sub, Math.max(0, Number(d.discount) || 0));
        const vatPct = (d.vatPct != null && d.vatPct !== '' && !isNaN(Number(d.vatPct)))
          ? Math.max(0, Number(d.vatPct))
          : configuredVatPct;
        orderTotal = sub - disc + ((sub - disc) * vatPct) / 100;
      }
      orderTotal = Number(orderTotal.toFixed(2));

      const paid = Math.max(0, Number(d.paid ?? 0));
      const balance = Math.max(0, Number((orderTotal - paid).toFixed(2)));

      // 2. Metric: Pending Payments (balance > 0.005)
      if (balance > 0.005) {
        pendingPayments += 1;
      }

      // 3. Metric: Delivered Orders
      const fulfillment = String(d.fulfillmentStatus || 'IN_PRODUCTION').toUpperCase().trim();
      const fulfillmentStatus: 'IN_PRODUCTION' | 'READY' | 'DELIVERED' =
        fulfillment === 'DELIVERED' ? 'DELIVERED' : (fulfillment === 'READY' ? 'READY' : 'IN_PRODUCTION');

      if (fulfillmentStatus === 'DELIVERED') {
        deliveredOrders += 1;
      }

      // Determine Payment Status
      let paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING' = 'PENDING';
      if (orderTotal > 0 && paid >= orderTotal - 0.005) {
        paymentStatus = 'PAID';
      } else if (paid > 0 && paid < orderTotal - 0.005) {
        paymentStatus = 'PARTIAL';
      } else {
        paymentStatus = 'PENDING';
      }

      const invNo = String(d.no || d.number || d.invoiceNumber || `INV-${String(r.record_id).slice(-4).toUpperCase()}`).trim();
      const clientName = String(d.client || d.customerName || d.clientName || 'Studio Client').trim();
      const phone = String(d.phone || d.customerPhone || d.clientPhone || '').trim();
      const email = String(d.email || d.customerEmail || d.clientEmail || '').trim();

      const rawLines = Array.isArray(d.lines) ? d.lines : [];
      const lines: OrderLineItem[] = rawLines.map((l: any) => ({
        productId: l.productId ? String(l.productId) : undefined,
        name: String(l.name || 'Custom 3D Print').trim(),
        qty: Math.max(1, parseInt(String(l.qty), 10) || 1),
        price: Math.max(0, Number(l.price) || 0),
        total: Number(((Math.max(1, parseInt(String(l.qty), 10) || 1)) * (Math.max(0, Number(l.price) || 0))).toFixed(2)),
        imageUrl: l.imageUrl ? String(l.imageUrl) : undefined,
      }));

      const subtotal = Number(d.subtotal ?? d.sub ?? lines.reduce((acc, l) => acc + l.total, 0));
      const discount = Number(d.discount ?? d.disc ?? 0);
      const vatPct = (d.vatPct != null && d.vatPct !== '' && !isNaN(Number(d.vatPct)))
        ? Number(d.vatPct)
        : configuredVatPct;
      const vat = Number(d.vat ?? (((subtotal - discount) * vatPct) / 100).toFixed(2));
      const docStatus = statusLower === 'void' ? 'void' : 'issued';

      const orderRecord: CommercialOrderRecord = {
        id: String(r.record_id),
        type: 'sale',
        no: invNo,
        number: invNo,
        invoiceNumber: invNo,
        date: String(d.date || (r.updated_at ? new Date(r.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])),
        client: clientName,
        clientName: clientName,
        customerName: clientName,
        phone,
        customerPhone: phone,
        email: email || undefined,
        customerEmail: email || undefined,
        lines,
        subtotal,
        sub: subtotal,
        discount,
        disc: discount,
        vatPct,
        vat,
        total: orderTotal,
        amount: orderTotal,
        paid,
        balance,
        bal: balance,
        status: docStatus,
        paymentStatus,
        fulfillmentStatus,
        paymentMethod: String(d.paymentMethod || 'Cash'),
        notes: d.notes ? String(d.notes).trim() : '',
        createdAt: d.createdAt ? String(d.createdAt) : (r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      };

      // Apply Search Filter
      if (search) {
        const matchNo = orderRecord.no.toLowerCase().includes(search);
        const matchName = orderRecord.customerName.toLowerCase().includes(search);
        const matchPhone = orderRecord.phone.toLowerCase().includes(search);
        if (!matchNo && !matchName && !matchPhone) {
          continue;
        }
      }

      // Apply Payment Status Filter
      if (paymentFilter !== 'ALL' && orderRecord.paymentStatus !== paymentFilter) {
        continue;
      }

      // Apply Fulfilment Filter
      if (fulfillmentFilter !== 'ALL' && orderRecord.fulfillmentStatus !== fulfillmentFilter) {
        continue;
      }

      orders.push(orderRecord);
    }

    return NextResponse.json({
      success: true,
      count: orders.length,
      metrics: {
        totalOrders,
        pendingPayments,
        deliveredOrders,
      },
      orders,
      configuredVatPct,
    });
  } catch (err: any) {
    console.error('Error in GET /api/admin/orders:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve orders.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/orders
 * Creates a new commercial order and generates its corresponding sales invoice in ledger_collections.
 * One order = one sales invoice.
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

    // 1. Validate Customer Details
    const customerName = String(body.customerName || body.clientName || '').trim();
    if (!customerName) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Customer name is required.' },
        { status: 400 }
      );
    }

    const rawPhone = String(body.whatsappNumber || body.phone || body.customerPhone || '').trim();
    const cleanPhoneDigits = rawPhone.replace(/\D/g, '');
    if (!rawPhone || cleanPhoneDigits.length < 7) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'A valid WhatsApp phone number is required (at least 7 digits).' },
        { status: 400 }
      );
    }

    const email = body.email ? String(body.email).trim().toLowerCase() : undefined;

    // 2. Validate Line Items
    const rawItems: any[] = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'At least one product item is required for the order.' },
        { status: 400 }
      );
    }

    const lines: OrderLineItem[] = [];
    for (const item of rawItems) {
      const name = String(item.name || '').trim();
      const qty = parseInt(String(item.qty), 10);
      const price = Number(item.price);

      if (!name) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', message: 'Each order item must have a product name.' },
          { status: 400 }
        );
      }
      if (isNaN(qty) || qty < 1) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', message: `Invalid quantity for item "${name}". Must be a positive integer.` },
          { status: 400 }
        );
      }
      if (isNaN(price) || price < 0) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', message: `Invalid price for item "${name}". Must be 0 or greater.` },
          { status: 400 }
        );
      }

      lines.push({
        productId: item.productId ? String(item.productId).trim() : undefined,
        name,
        qty,
        price: Number(price.toFixed(2)),
        total: Number((qty * price).toFixed(2)),
        imageUrl: item.imageUrl ? String(item.imageUrl).trim() : undefined,
      });
    }

    // 3. Fetch Configured VAT rate from settings in ledger_collections
    const vatPct = await getConfiguredVatRate();

    // 4. Financial Calculations
    const subtotal = Number(lines.reduce((acc, l) => acc + l.total, 0).toFixed(2));
    const rawDiscount = Number(body.discount || 0);
    const discount = isNaN(rawDiscount) || rawDiscount < 0
      ? 0
      : Number(Math.min(subtotal, rawDiscount).toFixed(2));

    const taxableAmount = Math.max(0, subtotal - discount);
    const vat = Number(((taxableAmount * vatPct) / 100).toFixed(2));
    const grandTotal = Number((taxableAmount + vat).toFixed(2));

    const rawPaid = Number(body.paidAmount ?? body.paid ?? 0);
    const paid = isNaN(rawPaid) || rawPaid < 0
      ? 0
      : Number(Math.min(grandTotal, rawPaid).toFixed(2));

    const balance = Number(Math.max(0, grandTotal - paid).toFixed(2));

    // 5. Payment Status Derivation
    let paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING' = 'PENDING';
    if (grandTotal > 0 && paid >= grandTotal - 0.005) {
      paymentStatus = 'PAID';
    } else if (paid > 0 && paid < grandTotal - 0.005) {
      paymentStatus = 'PARTIAL';
    } else {
      paymentStatus = 'PENDING';
    }

    // 6. Fulfilment Status
    const rawFulfillment = String(body.fulfillmentStatus || 'IN_PRODUCTION').toUpperCase().trim();
    const fulfillmentStatus: 'IN_PRODUCTION' | 'READY' | 'DELIVERED' =
      rawFulfillment === 'DELIVERED' ? 'DELIVERED' : (rawFulfillment === 'READY' ? 'READY' : 'IN_PRODUCTION');

    // 7. Generate Next Unique Invoice Number
    const existingInvoices = await sql`
      SELECT data
      FROM public.ledger_collections
      WHERE collection_name = 'invoices';
    `;

    let maxNum = 0;
    for (const row of existingInvoices) {
      const d = row.data || {};
      const typeLower = String(d.type || '').toLowerCase();
      if (typeLower !== 'quote' && typeLower !== 'foc') {
        const rawNo = String(d.no || d.number || d.invoiceNumber || '');
        const parsed = parseInt(rawNo.replace(/\D/g, ''), 10);
        if (!isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    }
    const invoiceNumber = `INV-${String(maxNum + 1).padStart(4, '0')}`;

    // 8. Build Compatible Invoice Document
    const recordId = `inv_${crypto.randomBytes(8).toString('hex')}`;
    const today = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    const invoiceData: CommercialOrderRecord = {
      id: recordId,
      type: 'sale',
      no: invoiceNumber,
      number: invoiceNumber,
      invoiceNumber,
      date: today,
      client: customerName,
      clientName: customerName,
      customerName,
      phone: rawPhone,
      customerPhone: rawPhone,
      email,
      customerEmail: email,
      lines,
      subtotal,
      sub: subtotal,
      discount,
      disc: discount,
      vatPct,
      vat,
      total: grandTotal,
      amount: grandTotal,
      paid,
      balance,
      bal: balance,
      status: 'issued',
      paymentStatus,
      fulfillmentStatus,
      paymentMethod: String(body.paymentMethod || 'Cash'),
      notes: body.notes ? String(body.notes).trim() : '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 9. Atomic Database Insertion into ledger_collections (invoices)
    await sql`
      INSERT INTO public.ledger_collections (collection_name, record_id, data, updated_at)
      VALUES ('invoices', ${recordId}, ${JSON.stringify(invoiceData)}::jsonb, NOW());
    `;

    // 10. Audit Logging
    const clientIp = extractClientIp(req);
    await logAuditEvent({
      userId: auth.user.id,
      action: 'ORDER_CREATE',
      entityType: 'invoice',
      entityId: recordId,
      ipAddress: clientIp,
      details: {
        invoiceNumber,
        customerName,
        total: grandTotal,
        paymentStatus,
        fulfillmentStatus,
        itemCount: lines.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Order ${invoiceNumber} created successfully.`,
      order: invoiceData,
    });
  } catch (err: any) {
    console.error('Error in POST /api/admin/orders:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to create order and generate invoice.' },
      { status: 500 }
    );
  }
}
