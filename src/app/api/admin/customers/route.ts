import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyServerSession } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export interface CustomerOrderHistoryItem {
  id: string;
  orderNumber: string;
  date: string;
  total: number;
  paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING';
  fulfillmentStatus: 'IN_PRODUCTION' | 'READY' | 'DELIVERED';
  itemsCount: number;
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  totalOrders: number;
  cumulativeSales: number;
  lastOrderDate: string;
  orders: CustomerOrderHistoryItem[];
}

export interface CustomerMetrics {
  totalCustomers: number;
  repeatCustomers: number;
}

/**
 * Phone normalization helper for WhatsApp links
 */
export function sanitizeWhatsAppPhone(phone: string | null | undefined): { display: string; cleanDigits: string; waLink: string } {
  const display = String(phone || '').trim();
  if (!display) return { display: '', cleanDigits: '', waLink: '' };

  let digits = display.replace(/\D/g, '');
  if (!digits) return { display, cleanDigits: '', waLink: '' };

  if (digits.startsWith('00')) {
    digits = digits.replace(/^00+/, '');
  }

  let international = digits;
  if (digits.startsWith('97105') && digits.length === 13) {
    international = '971' + digits.slice(4);
  } else if (digits.startsWith('05') && digits.length === 10) {
    international = '971' + digits.slice(1);
  } else if (digits.startsWith('5') && digits.length === 9) {
    international = '971' + digits;
  } else if (digits.startsWith('971') && digits.length === 12) {
    international = digits;
  }

  const waLink = international.length >= 7 ? `https://wa.me/${international}` : '';
  return { display, cleanDigits: international, waLink };
}

/**
 * GET /api/admin/customers
 * Returns aggregated customer directory derived from valid sales invoices.
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
    const filter = searchParams.get('filter')?.toUpperCase().trim() || 'ALL'; // ALL | NEW | REPEAT

    // Fetch invoices ordered chronologically
    const rows = await sql`
      SELECT record_id, data, updated_at
      FROM public.ledger_collections
      WHERE collection_name = 'invoices'
      ORDER BY updated_at DESC;
    `;

    const customerMap = new Map<string, CustomerProfile>();

    for (const r of rows) {
      const d = (r.data && typeof r.data === 'object') ? r.data : {};

      // 1. Exclude voided documents
      const statusLower = String(d.status || '').toLowerCase().trim();
      if (statusLower === 'void') continue;

      // 2. Exclude quotations and FOC documents
      const typeLower = String(d.type || '').toLowerCase().trim();
      if (typeLower === 'quote' || typeLower === 'foc') continue;
      if (typeLower !== 'sale' && typeLower !== '') continue;

      // 3. Extract Customer Identity Fields
      const rawName = String(d.client || d.customerName || d.clientName || 'Studio Client').trim();
      const rawEmail = String(d.email || d.customerEmail || d.clientEmail || '').trim();
      const rawPhone = String(d.phone || d.customerPhone || d.clientPhone || '').trim();
      const company = String(d.company || d.customerCompany || '').trim();

      const normalizedEmail = rawEmail.toLowerCase();
      const cleanPhone = rawPhone.replace(/\D/g, '');
      const normalizedName = rawName.toLowerCase();

      // Identity matching key
      let customerKey = '';
      if (normalizedEmail) {
        customerKey = 'email:' + normalizedEmail;
      } else if (cleanPhone && normalizedName) {
        customerKey = 'phone_name:' + cleanPhone + '_' + normalizedName;
      } else if (normalizedName) {
        customerKey = 'name:' + normalizedName;
      } else {
        customerKey = 'record:' + r.record_id;
      }

      // Calculate invoice total amount
      let orderTotal = 0;
      if (d.total != null && d.total !== '' && !isNaN(Number(d.total))) {
        orderTotal = Number(d.total);
      } else if (d.amount != null && d.amount !== '' && !isNaN(Number(d.amount))) {
        orderTotal = Number(d.amount);
      } else if (Array.isArray(d.lines)) {
        const sub = d.lines.reduce((acc: number, l: any) => acc + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
        const disc = Math.min(sub, Math.max(0, Number(d.discount) || 0));
        const vatPct = Number(d.vatPct || 5);
        orderTotal = sub - disc + ((sub - disc) * vatPct) / 100;
      }
      orderTotal = Number(orderTotal.toFixed(2));

      // Order Date calculation
      let orderDate = '';
      if (d.date && typeof d.date === 'string' && d.date.trim()) {
        orderDate = d.date.trim();
      } else if (d.issueDate && typeof d.issueDate === 'string' && d.issueDate.trim()) {
        orderDate = d.issueDate.trim();
      } else if (r.updated_at) {
        orderDate = new Date(r.updated_at).toISOString().split('T')[0];
      } else {
        orderDate = new Date().toISOString().split('T')[0];
      }

      const invNo = String(d.no || d.number || d.invoiceNumber || 'INV-' + String(r.record_id).slice(-4).toUpperCase()).trim();

      // Payment Status
      const paid = Math.max(0, Number(d.paid ?? 0));
      let paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING' = 'PENDING';
      if (orderTotal > 0 && paid >= orderTotal - 0.005) {
        paymentStatus = 'PAID';
      } else if (paid > 0 && paid < orderTotal - 0.005) {
        paymentStatus = 'PARTIAL';
      }

      // Fulfilment Status
      const fulfillment = String(d.fulfillmentStatus || 'IN_PRODUCTION').toUpperCase().trim();
      const fulfillmentStatus: 'IN_PRODUCTION' | 'READY' | 'DELIVERED' =
        fulfillment === 'DELIVERED' ? 'DELIVERED' : (fulfillment === 'READY' ? 'READY' : 'IN_PRODUCTION');

      const orderItem: CustomerOrderHistoryItem = {
        id: String(r.record_id),
        orderNumber: invNo,
        date: orderDate,
        total: orderTotal,
        paymentStatus,
        fulfillmentStatus,
        itemsCount: Array.isArray(d.lines) ? d.lines.length : 1,
      };

      if (customerMap.has(customerKey)) {
        const existing = customerMap.get(customerKey)!;
        existing.totalOrders += 1;
        existing.cumulativeSales = Number((existing.cumulativeSales + orderTotal).toFixed(2));
        existing.orders.push(orderItem);

        // Update with phone or company if existing was missing
        if (rawPhone && !existing.phone) existing.phone = rawPhone;
        if (company && !existing.company) existing.company = company;
        if (rawName && rawName !== 'Studio Client' && existing.name === 'Studio Client') existing.name = rawName;

        // Keep most recent order date
        if (new Date(orderDate).getTime() > new Date(existing.lastOrderDate).getTime()) {
          existing.lastOrderDate = orderDate;
        }
      } else {
        customerMap.set(customerKey, {
          id: customerKey,
          name: rawName,
          email: rawEmail,
          phone: rawPhone,
          company: company || undefined,
          totalOrders: 1,
          cumulativeSales: orderTotal,
          lastOrderDate: orderDate,
          orders: [orderItem],
        });
      }
    }

    const allCustomers = Array.from(customerMap.values());

    // Sort order history inside each customer (most recent first)
    allCustomers.forEach((c) => {
      c.orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    // Default sorting: most recently active customer first
    allCustomers.sort((a, b) => new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime());

    // Calculate metrics
    const totalCustomers = allCustomers.length;
    const repeatCustomers = allCustomers.filter((c) => c.totalOrders >= 2).length;

    // Apply Filters
    const filtered = allCustomers.filter((c) => {
      // 1. Customer Type Filter (ALL | NEW | REPEAT)
      if (filter === 'NEW' && c.totalOrders !== 1) return false;
      if (filter === 'REPEAT' && c.totalOrders < 2) return false;

      // 2. Search Query (name, email, phone)
      if (search) {
        const matchName = c.name.toLowerCase().includes(search);
        const matchEmail = c.email.toLowerCase().includes(search);
        const matchPhone = c.phone ? c.phone.toLowerCase().includes(search) : false;
        const matchCompany = c.company ? c.company.toLowerCase().includes(search) : false;
        if (!matchName && !matchEmail && !matchPhone && !matchCompany) {
          return false;
        }
      }

      return true;
    });

    return NextResponse.json({
      success: true,
      count: filtered.length,
      metrics: {
        totalCustomers,
        repeatCustomers,
      },
      customers: filtered,
    });
  } catch (err: any) {
    console.error('Error in GET /api/admin/customers:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve customers.' },
      { status: 500 }
    );
  }
}
