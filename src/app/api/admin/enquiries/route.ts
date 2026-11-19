import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyServerSession } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export interface AdminEnquiryRecord {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  subject: string;
  message: string;
  productId?: string | null;
  status: 'NEW' | 'IN_REVIEW' | 'RESPONDED' | 'ARCHIVED';
  ipAddress?: string | null;
  createdAt: string;
}

export interface EnquiryMetrics {
  total: number;
  newCount: number;
  inReviewCount: number;
  respondedCount: number;
  archivedCount: number;
  allCount: number;
}

/**
 * Phone normalization helper for WhatsApp direct links
 */
export function sanitizeWhatsAppPhone(phone: string | null | undefined): { display: string; cleanDigits: string; waLink: string } {
  const display = String(phone || '').trim();
  if (!display) return { display: '', cleanDigits: '', waLink: '' };
  
  let digits = display.replace(/\D/g, '');
  if (!digits) return { display, cleanDigits: '', waLink: '' };

  // Strip international exit prefix (00)
  if (digits.startsWith('00')) {
    digits = digits.replace(/^00+/, '');
  }

  let international = digits;

  // Case 1: UAE number entered with country code + leading zero e.g. +971 050 123 4567 -> 9710501234567
  if (digits.startsWith('97105') && digits.length === 13) {
    international = '971' + digits.slice(4);
  }
  // Case 2: Standard local 10-digit format starting with 05 (e.g. 050, 052, 054, 055, 056, 058)
  else if (digits.startsWith('05') && digits.length === 10) {
    international = '971' + digits.slice(1);
  }
  // Case 3: 9-digit format starting with 5 (e.g. 50, 52, 54, 55, 56, 58)
  else if (digits.startsWith('5') && digits.length === 9) {
    international = '971' + digits;
  }
  // Case 4: Already international 971 format e.g. 971501234567 (12 digits)
  else if (digits.startsWith('971') && digits.length === 12) {
    international = digits;
  }

  const waLink = international.length >= 7 ? `https://wa.me/${international}` : '';
  return { display, cleanDigits: international, waLink };
}

/**
 * GET /api/admin/enquiries
 * Returns filtered enquiries and database-derived metrics.
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
    const statusFilter = searchParams.get('status')?.toUpperCase().trim() || 'ALL';
    const dateRange = searchParams.get('dateRange')?.toUpperCase().trim() || 'ALL';

    const rows = await sql`
      SELECT 
        id, 
        customer_name, 
        customer_email, 
        customer_phone, 
        subject, 
        message, 
        product_id, 
        status, 
        ip_address, 
        created_at
      FROM public.store_enquiries
      ORDER BY created_at DESC;
    `;

    let total = 0;
    let newCount = 0;
    let inReviewCount = 0;
    let respondedCount = 0;
    let archivedCount = 0;

    const allEnquiries: AdminEnquiryRecord[] = [];

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;
    const thirtyDaysMs = 30 * oneDayMs;

    for (const r of rows) {
      const rawStatus = String(r.status || 'NEW').toUpperCase().trim();
      let status: 'NEW' | 'IN_REVIEW' | 'RESPONDED' | 'ARCHIVED' = 'NEW';
      if (rawStatus === 'IN_REVIEW') status = 'IN_REVIEW';
      else if (rawStatus === 'RESPONDED') status = 'RESPONDED';
      else if (rawStatus === 'ARCHIVED') status = 'ARCHIVED';

      // Compute status-specific metrics
      if (status === 'NEW') newCount += 1;
      else if (status === 'IN_REVIEW') inReviewCount += 1;
      else if (status === 'RESPONDED') respondedCount += 1;
      else if (status === 'ARCHIVED') archivedCount += 1;

      // Total enquiries counts ALL enquiry records (including archived)
      total += 1;

      const enquiryItem: AdminEnquiryRecord = {
        id: String(r.id),
        customerName: String(r.customer_name || 'Customer').trim(),
        customerEmail: String(r.customer_email || '').trim().toLowerCase(),
        customerPhone: r.customer_phone ? String(r.customer_phone).trim() : null,
        subject: String(r.subject || 'Store Enquiry').trim(),
        message: String(r.message || '').trim(),
        productId: r.product_id ? String(r.product_id).trim() : null,
        status,
        ipAddress: r.ip_address ? String(r.ip_address).trim() : null,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      };

      allEnquiries.push(enquiryItem);
    }

    // Apply Filters
    const filtered = allEnquiries.filter((enq) => {
      // 1. Status Filter
      if (statusFilter === 'ACTIVE') {
        if (enq.status === 'ARCHIVED') return false;
      } else if (statusFilter !== 'ALL' && enq.status !== statusFilter) {
        return false;
      }

      // 2. Search Filter (customer name, email, phone, subject, message)
      if (search) {
        const matchName = enq.customerName.toLowerCase().includes(search);
        const matchEmail = enq.customerEmail.toLowerCase().includes(search);
        const matchPhone = enq.customerPhone ? enq.customerPhone.toLowerCase().includes(search) : false;
        const matchSubject = enq.subject.toLowerCase().includes(search);
        const matchMessage = enq.message.toLowerCase().includes(search);
        if (!matchName && !matchEmail && !matchPhone && !matchSubject && !matchMessage) {
          return false;
        }
      }

      // 3. Date Range Filter
      if (dateRange !== 'ALL') {
        const itemTime = new Date(enq.createdAt).getTime();
        const diff = now - itemTime;
        if (dateRange === 'TODAY' && diff > oneDayMs) return false;
        if (dateRange === '7D' && diff > sevenDaysMs) return false;
        if (dateRange === '30D' && diff > thirtyDaysMs) return false;
      }

      return true;
    });

    const metrics: EnquiryMetrics = {
      total,
      newCount,
      inReviewCount,
      respondedCount,
      archivedCount,
      allCount: rows.length,
    };

    return NextResponse.json({
      success: true,
      count: filtered.length,
      metrics,
      enquiries: filtered,
    });
  } catch (err: any) {
    console.error('Error in GET /api/admin/enquiries:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve enquiries.' },
      { status: 500 }
    );
  }
}
