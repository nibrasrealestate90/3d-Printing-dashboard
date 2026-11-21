import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdminSession, logAuditEvent, extractClientIp } from '@/lib/auth';

export const ALLOWED_DATA_COLLECTIONS = new Set([
  'products',
  'filaments',
  'filament_stock',
  'invoices',
  'prints',
  'expenses',
  'expense_categories',
  'settings',
]);

let tableEnsured = false;
async function ensureTable() {
  if (!sql || tableEnsured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS ledger_collections (
      collection_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (collection_name, record_id)
    );
  `;
  tableEnsured = true;
}

const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

// GET /api/data?collection=products OR all collections OR ?status=1
export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (auth instanceof Response) {
    return auth;
  }

  if (!sql) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  }

  try {
    await ensureTable();
    const url = new URL(req.url);
    const statusParam = url.searchParams.get('status');

    // Lightweight status / version check for real-time polling
    if (statusParam === '1') {
      const rows = await sql`
        SELECT 
          collection_name, 
          count(*)::int as count, 
          COALESCE(to_char(max(updated_at), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), '') as latest
        FROM ledger_collections 
        GROUP BY collection_name;
      `;
      const summary: Record<string, { count: number; latest: string }> = {};
      rows.forEach(r => {
        summary[r.collection_name] = { count: Number(r.count), latest: String(r.latest) };
      });
      const version = rows
        .map(r => `${r.collection_name}:${r.count}:${r.latest}`)
        .sort()
        .join('|');

      return NextResponse.json(
        { status: summary, version, timestamp: Date.now() },
        { headers: noCacheHeaders }
      );
    }

    const collection = url.searchParams.get('collection');

    if (collection) {
      if (!ALLOWED_DATA_COLLECTIONS.has(collection)) {
        return NextResponse.json({ error: 'Collection not accessible or forbidden' }, { status: 403 });
      }

      const rows = await sql`
        SELECT record_id as id, data, updated_at 
        FROM ledger_collections 
        WHERE collection_name = ${collection}
        ORDER BY updated_at DESC;
      `;
      const items = rows.map(r => {
        let itemData = r.data as any;
        if (collection === 'settings' && itemData) {
          itemData = { ...itemData };
          if (itemData.bambuToken) {
            itemData.hasBambuToken = true;
            itemData.bambuToken = '••••••••';
          }
        }
        return itemData;
      });
      return NextResponse.json({ items }, { headers: noCacheHeaders });
    }

    // Return all collections grouped
    const rows = await sql`
      SELECT collection_name, data 
      FROM ledger_collections 
      ORDER BY updated_at ASC;
    `;
    const grouped: Record<string, any[]> = {
      products: [],
      filaments: [],
      filament_stock: [],
      invoices: [],
      prints: [],
      expenses: [],
      expense_categories: [],
      settings: []
    };

    rows.forEach(r => {
      if (ALLOWED_DATA_COLLECTIONS.has(r.collection_name)) {
        if (!grouped[r.collection_name]) {
          grouped[r.collection_name] = [];
        }
        let itemData = r.data as any;
        if (r.collection_name === 'settings' && itemData) {
          itemData = { ...itemData };
          if (itemData.bambuToken) {
            itemData.hasBambuToken = true;
            itemData.bambuToken = '••••••••';
          }
        }
        grouped[r.collection_name].push(itemData);
      }
    });

    return NextResponse.json({ collections: grouped }, { headers: noCacheHeaders });
  } catch (err: any) {
    console.error('Error in GET /api/data:', err.message);
    return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
  }
}

// POST /api/data (upsert a record or batch sync)
export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (auth instanceof Response) {
    return auth;
  }

  if (!sql) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  }

  try {
    await ensureTable();
    const body = await req.json();

    // Batch seed/sync all collections
    if (body.syncAll && body.collections) {
      for (const [coll, items] of Object.entries(body.collections as Record<string, any[]>)) {
        if (!ALLOWED_DATA_COLLECTIONS.has(coll)) continue;
        for (const item of items) {
          if (!item.id) continue;
          let itemData = item;
          if (coll === 'settings') {
            const existingSettingsRows = await sql`
              SELECT data FROM ledger_collections 
              WHERE collection_name = 'settings' AND record_id = ${item.id}
              LIMIT 1;
            `;
            if (existingSettingsRows.length > 0 && existingSettingsRows[0].data) {
              const existingData = existingSettingsRows[0].data as any;
              if ((!itemData.bambuToken || itemData.bambuToken === '••••••••') && existingData.bambuToken) {
                itemData = { ...itemData, bambuToken: existingData.bambuToken };
              }
            }
            itemData = { ...itemData };
            delete itemData.hasBambuToken;
          }
          await sql`
            INSERT INTO ledger_collections (collection_name, record_id, data, updated_at)
            VALUES (${coll}, ${item.id}, ${JSON.stringify(itemData)}, NOW())
            ON CONFLICT (collection_name, record_id)
            DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
          `;
        }
      }

      await logAuditEvent({
        userId: auth.user.id,
        action: 'DATA_BATCH_SYNC',
        entityType: 'LEDGER_COLLECTIONS',
        ipAddress: extractClientIp(req),
        details: { collections: Object.keys(body.collections || {}) }
      });

      return NextResponse.json({ success: true, message: 'All collections synced with Neon Postgres' });
    }

    // Single item upsert
    const { collection, id, data } = body;
    if (!collection || !id || !data) {
      return NextResponse.json({ error: 'Missing collection, id, or data' }, { status: 400 });
    }

    if (!ALLOWED_DATA_COLLECTIONS.has(collection)) {
      return NextResponse.json({ error: 'Collection not accessible or forbidden' }, { status: 403 });
    }

    let finalData = data;
    if (collection === 'settings') {
      const existingSettingsRows = await sql`
        SELECT data FROM ledger_collections 
        WHERE collection_name = 'settings' AND record_id = ${id}
        LIMIT 1;
      `;
      if (existingSettingsRows.length > 0 && existingSettingsRows[0].data) {
        const existingData = existingSettingsRows[0].data as any;
        if ((!data.bambuToken || data.bambuToken === '••••••••') && existingData.bambuToken) {
          finalData = { ...data, bambuToken: existingData.bambuToken };
        }
      }
      finalData = { ...finalData };
      delete finalData.hasBambuToken;
    }

    await sql`
      INSERT INTO ledger_collections (collection_name, record_id, data, updated_at)
      VALUES (${collection}, ${id}, ${JSON.stringify(finalData)}, NOW())
      ON CONFLICT (collection_name, record_id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
    `;

    if (collection === 'settings') {
      await logAuditEvent({
        userId: auth.user.id,
        action: 'DATA_SETTINGS_UPDATE',
        entityType: 'SETTINGS',
        entityId: id,
        ipAddress: extractClientIp(req)
      });
    }

    return NextResponse.json({ success: true, id, collection });
  } catch (err: any) {
    console.error('Error in POST /api/data:', err.message);
    return NextResponse.json({ error: 'Failed to write to database' }, { status: 500 });
  }
}

// DELETE /api/data (delete a record)
export async function DELETE(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (auth instanceof Response) {
    return auth;
  }

  if (!sql) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  }

  try {
    await ensureTable();
    const { collection, id } = await req.json();

    if (!collection || !id) {
      return NextResponse.json({ error: 'Missing collection or id' }, { status: 400 });
    }

    if (!ALLOWED_DATA_COLLECTIONS.has(collection)) {
      return NextResponse.json({ error: 'Collection not accessible or forbidden' }, { status: 403 });
    }

    await sql`
      DELETE FROM ledger_collections 
      WHERE collection_name = ${collection} AND record_id = ${id};
    `;

    await logAuditEvent({
      userId: auth.user.id,
      action: 'DATA_RECORD_DELETE',
      entityType: collection,
      entityId: id,
      ipAddress: extractClientIp(req)
    });

    return NextResponse.json({ success: true, deleted: id, collection });
  } catch (err: any) {
    console.error('Error in DELETE /api/data:', err.message);
    return NextResponse.json({ error: 'Failed to delete from database' }, { status: 500 });
  }
}
