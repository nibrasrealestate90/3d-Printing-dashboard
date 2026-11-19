export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import crypto from 'crypto';
import { authenticateBambuSync } from '@/lib/auth';

const CALIBRATION_KEYWORDS = [
  'calib',
  'bed_level',
  'bed level',
  'flow_calib',
  'flow rate',
  'pressure_advance',
  'auto_pa',
  'first_layer',
  'first layer',
  'temp_tower',
  'calibration'
];

function isCalibrationTask(title: string): boolean {
  const lower = title.toLowerCase();
  return CALIBRATION_KEYWORDS.some(kw => lower.includes(kw));
}

export function cleanModelTitle(raw?: string): string {
  if (!raw) return 'Untitled Model';
  let title = raw.trim();
  title = title.replace(/\.gcode\.3mf$/i, '');
  title = title.replace(/\.3mf$/i, '');
  title = title.replace(/\.gcode$/i, '');
  title = title.replace(/\s*[-–—/\\|:]*\s*[\(\[\{]?\s*print[\s-]+in[\s-]+place\s*[\)\]\}]?\s*[-–—/\\|:]*/gi, ' ');
  title = title.replace(/\s*[-–—/\\|:]+\s*$/, '');
  title = title.replace(/^\s*[-–—/\\|:]+\s*/, '');
  title = title.replace(/\s+/g, ' ').trim();
  return title || 'Untitled Model';
}

const cleanTitle = cleanModelTitle;

function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

function getProductId(cleanedTitle: string): string {
  const hash = md5(cleanedTitle.toLowerCase()).slice(0, 16);
  return `prod_${hash}`;
}

function cleanProfileName(name?: string): string {
  if (!name) return '';
  return String(name)
    .replace(/\s*@(BBL|Bambu)[^\n,;]*/gi, '')
    .trim();
}

function formatBedType(bedType?: string): string {
  if (!bedType) return 'Textured PEI Plate';
  const clean = bedType.trim();
  if (/textured/i.test(clean)) return 'Textured PEI Plate';
  if (/smooth|high_temp/i.test(clean)) return 'Smooth PEI Plate';
  if (/cool/i.test(clean)) return 'Cool Plate';
  if (/engineering/i.test(clean)) return 'Engineering Plate';
  return clean.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatNozzle(nozzleInfos?: any[], nozzleDiameter?: number): string {
  if (Array.isArray(nozzleInfos) && nozzleInfos.length > 0) {
    const n = nozzleInfos[0];
    const dia = n.diameter ? `${n.diameter}mm` : '0.4mm';
    let flow = 'Standard';
    if (n.flowSize) {
      flow = n.flowSize.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    }
    return `${dia} ${flow} x1`;
  }
  if (nozzleDiameter) {
    return `${nozzleDiameter}mm Standard x1`;
  }
  return '0.4mm Standard x1';
}

function formatFilaments(amsDetailMapping?: any[]): Array<{ type: string; color?: string; weightG?: number; slot?: string }> {
  if (!Array.isArray(amsDetailMapping) || amsDetailMapping.length === 0) {
    return [];
  }
  return amsDetailMapping.map(m => {
    let slot = '';
    if (m.amsId === 255 || m.amsId === -1 || m.isExternal) {
      slot = 'Ext';
    } else {
      const amsLetter = String.fromCharCode(65 + (Number(m.amsId) || 0));
      const slotNum = (Number(m.slotId) || 0) + 1;
      slot = `${amsLetter}${slotNum}`;
    }
    let color = m.targetColor || m.filamentColor || m.sourceColor || '';
    if (color && !color.startsWith('#')) {
      const hex = color.length >= 6 ? color.slice(0, 6) : color;
      color = `#${hex}`;
    }
    const weightG = Number(m.weight) > 0 ? Number(Number(m.weight).toFixed(1)) : undefined;
    const type = m.targetFilamentType || m.filamentType || 'PLA';

    return {
      type,
      color: color || '#888888',
      weightG,
      slot
    };
  });
}

async function downloadImageAsBase64(url?: string): Promise<string> {
  if (!url) return '';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return '';
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0) return '';
    let mime = 'image/png';
    if (url.includes('.jpg') || url.includes('.jpeg')) {
      mime = 'image/jpeg';
    } else if (url.includes('.webp')) {
      mime = 'image/webp';
    }
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch (_) {
    return '';
  }
}

function parseTimestamp(raw?: string | number): number | null {
  if (!raw) return null;
  if (typeof raw === 'number') {
    return raw < 1e11 ? raw * 1000 : raw;
  }
  const str = String(raw).trim();
  if (!str) return null;
  const num = Number(str);
  if (!isNaN(num) && num > 0) {
    return num < 1e11 ? num * 1000 : num;
  }
  const parsed = new Date(str).getTime();
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
}

export function calculatePrintHours(task: any, statusLabel: string): { hours: number; estimatedHours: number } {
  const estimatedHours = Number(((Number(task.costTime || 0)) / 3600).toFixed(1));
  const isFinalized = statusLabel === 'Success' || statusLabel === 'Canceled' || statusLabel === 'Failed';

  if (isFinalized) {
    const startMs = parseTimestamp(task.startTime);
    const endMs = parseTimestamp(task.endTime);
    if (startMs != null && endMs != null && endMs > startMs) {
      const elapsedSeconds = Math.round((endMs - startMs) / 1000);
      if (elapsedSeconds > 0) {
        const hours = Number((elapsedSeconds / 3600).toFixed(2));
        return { hours, estimatedHours };
      }
    }
  }

  // Fallback to static slicer estimate
  const hours = Number(((Number(task.costTime || 0)) / 3600).toFixed(2));
  return { hours, estimatedHours };
}

export async function getBambuToken(db: any): Promise<string> {
  let token = process.env.BAMBU_TOKEN || '';
  try {
    const settingsRows = await db`
      SELECT data 
      FROM ledger_collections 
      WHERE collection_name = 'settings' 
      LIMIT 1;
    `;
    if (settingsRows.length > 0 && settingsRows[0].data) {
      const s = settingsRows[0].data as any;
      if (s.bambuToken && typeof s.bambuToken === 'string' && s.bambuToken.trim()) {
        token = s.bambuToken.trim();
      } else if (s.token && typeof s.token === 'string' && s.token.trim()) {
        token = s.token.trim();
      }
    }
  } catch (err: any) {
    console.warn('Could not read settings from DB:', err.message);
  }
  return token;
}

export async function handleBackfillPhotos(db: any, token: string) {
  // 1. Identify products currently lacking valid photo
  const missingRows = await db`
    SELECT record_id, data 
    FROM ledger_collections 
    WHERE collection_name = 'products' 
      AND (data->>'photo' IS NULL OR length(data->>'photo') < 100);
  `;

  if (missingRows.length === 0) {
    return NextResponse.json({
      success: true,
      backfilledCount: 0,
      remainingMissingCount: 0,
      message: 'All products already have photos.'
    });
  }

  const missingMap = new Map<string, any>();
  for (const r of missingRows) {
    missingMap.set(r.record_id, r.data);
  }

  // 2. Paginate Bambu Cloud tasks in chunks of 100 to discover covers
  const candidateCovers = new Map<string, string>(); // prodId -> coverUrl
  let offset = 0;
  const limit = 100;
  let totalTasksChecked = 0;

  while (candidateCovers.size < missingMap.size) {
    let res: Response;
    try {
      res = await fetch(`https://api.bambulab.com/v1/user-service/my/tasks?limit=${limit}&offset=${offset}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'bambu-connect/1.0'
        },
        redirect: 'error',
        signal: AbortSignal.timeout(15000)
      });
    } catch (e: any) {
      console.warn('Backfill task fetch failed:', e.message);
      break;
    }

    if (!res.ok) break;

    let data: any = {};
    try {
      data = await res.json();
    } catch (_) {
      break;
    }

    const hits = data.hits || [];
    if (hits.length === 0) break;
    totalTasksChecked += hits.length;

    for (const task of hits) {
      if (!task || !task.cover) continue;
      const rawTitle = task.title || task.designTitle || '';
      const cleaned = cleanTitle(rawTitle);
      const prodId = getProductId(cleaned);

      if (missingMap.has(prodId)) {
        // Prefer successful tasks (status === 2)
        if (!candidateCovers.has(prodId) || task.status === 2) {
          candidateCovers.set(prodId, task.cover);
        }
      }
    }

    offset += limit;
    if (offset >= (data.total || 0) || offset >= 600) break;
  }

  // 3. Batch download candidate images with safe concurrency (CHUNK = 5)
  let backfilledCount = 0;
  const entries = Array.from(candidateCovers.entries());
  const CHUNK = 5;

  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    await Promise.all(chunk.map(async ([prodId, coverUrl]) => {
      try {
        const base64 = await downloadImageAsBase64(coverUrl);
        if (base64 && base64.length > 100) {
          await db`
            UPDATE ledger_collections 
            SET data = jsonb_set(data, '{photo}', to_jsonb(${base64}::text)),
                updated_at = NOW()
            WHERE collection_name = 'products' 
              AND record_id = ${prodId}
              AND (data->>'photo' IS NULL OR length(data->>'photo') < 100);
          `;
          backfilledCount++;
        }
      } catch (err: any) {
        console.warn(`Backfill image download failed for ${prodId}:`, err.message);
      }
    }));
  }

  return NextResponse.json({
    success: true,
    backfilledCount,
    remainingMissingCount: Math.max(0, missingRows.length - backfilledCount),
    totalTasksChecked,
    message: `Recovered ${backfilledCount} product thumbnail${backfilledCount === 1 ? '' : 's'} from Bambu Lab Cloud.`
  });
}

export async function handleSync(req?: NextRequest) {
  if (!sql) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  }
  const db = sql;

  // 1. Retrieve Bambu Token from Settings collection or fallback to environment variable
  const token = await getBambuToken(db);

  if (!token) {
    return NextResponse.json(
      { error: 'Bambu Cloud token not configured. Please set your Bambu token in Settings or environment variable BAMBU_TOKEN.' },
      { status: 401 }
    );
  }

  // 2. Fetch authoritative task archive (limit=20) directly from Bambu Cloud
  const fetchHeaders = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'bambu-connect/1.0'
  };

  const bambuApiUrl =
    process.env.BAMBU_API_BASE_URL ||
    'https://api.bambulab.com/v1/user-service/my/tasks?limit=20';

  let tasksRes: Response;
  try {
    tasksRes = await fetch(bambuApiUrl, {
      headers: fetchHeaders,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15000)
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: `Failed to connect to Bambu Cloud API: ${err.message}` },
      { status: 502 }
    );
  }

  if (tasksRes.status === 401 || tasksRes.status === 403) {
    return NextResponse.json(
      {
        success: false,
        error: 'Bambu Cloud authentication failed. Your Bambu token may have expired or is invalid. Please update your token in Settings.',
        status: 401
      },
      { status: 401 }
    );
  }

  if (tasksRes.status === 429) {
    return NextResponse.json(
      {
        success: false,
        error: 'Bambu Cloud rate limit reached. Please wait a minute before syncing again.',
        status: 429
      },
      { status: 429 }
    );
  }

  if (!tasksRes.ok) {
    return NextResponse.json(
      { success: false, error: `Bambu Cloud API returned HTTP ${tasksRes.status}` },
      { status: 502 }
    );
  }

  let taskHits: any[] = [];
  try {
    const data = await tasksRes.json();
    if (Array.isArray(data.hits)) {
      taskHits = data.hits;
    }
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: `Failed to parse Bambu tasks response: ${e.message}` },
      { status: 502 }
    );
  }

  // 3. Filter out calibration tasks while retaining all real prints (including active 'Printing' ones)
  const realTasks = taskHits.filter(task => {
    if (!task || !task.id) return false;
    const rawTitle = task.title || task.designTitle || '';
    const cleaned = cleanTitle(rawTitle);
    if (isCalibrationTask(rawTitle) || isCalibrationTask(cleaned)) return false;
    return true;
  });

  const totalChecked = realTasks.length;

  // 4. Query only these specific recent print task IDs to detect new/updated status
  const taskRecordIds = realTasks.map(t => `bambu_${t.id}`);
  const existingPrintsRows = taskRecordIds.length > 0
    ? await db`
        SELECT 
          record_id, 
          COALESCE(data->>'statusLabel', data->>'status') AS status,
          (data->>'grams')::numeric AS grams,
          (data->>'hours')::numeric AS hours
        FROM ledger_collections 
        WHERE collection_name = 'prints' AND record_id = ANY(${taskRecordIds});
      `
    : [];
  const existingPrintsMap = new Map<string, { status: string; grams: number; hours: number }>();
  for (const row of existingPrintsRows) {
    if (row.record_id) {
      existingPrintsMap.set(String(row.record_id), {
        status: String(row.status || '').toLowerCase(),
        grams: Number(row.grams || 0),
        hours: Number(row.hours || 0)
      });
    }
  }

  // Determine tasks to upsert with exact 1-to-1 Bambu Handy status mapping
  const tasksToUpsert = realTasks.filter(task => {
    const recordId = `bambu_${task.id}`;
    const statusStr = String(task.status ?? '').toLowerCase();
    let statusLabel: 'Printing' | 'Success' | 'Canceled' | 'Failed';

    if (task.status === 2 || statusStr === 'finish' || statusStr === 'success') {
      statusLabel = 'Success';
    } else if (task.status === 3 || statusStr === 'cancel' || statusStr === 'canceled') {
      statusLabel = 'Canceled';
    } else if (task.status === 0 || task.status === 1 || statusStr === 'running' || statusStr === 'printing' || statusStr === 'prepare' || statusStr === 'busy' || statusStr === 'pause') {
      statusLabel = 'Printing';
    } else if (task.status === 4 || statusStr === 'failed' || (task.failedType != null && task.failedType !== 0)) {
      statusLabel = 'Failed';
    } else {
      statusLabel = 'Failed';
    }

    const grams = Number(Number(task.weight || 0).toFixed(1));
    const { hours } = calculatePrintHours(task, statusLabel);
    const existing = existingPrintsMap.get(recordId);

    // If new task, status changed, weight/duration updated, or actively printing -> upsert!
    if (!existing) return true;
    if (existing.status !== statusLabel.toLowerCase()) return true;
    if (statusLabel === 'Printing') return true;
    if (Math.abs(existing.grams - grams) >= 0.1) return true;
    if (Math.abs(existing.hours - hours) >= 0.05) return true;

    return false;
  });

  // Fast path: if all 20 tasks are already up-to-date in Neon with identical status, return immediately
  if (tasksToUpsert.length === 0) {
    return NextResponse.json({
      success: true,
      newTasksCount: 0,
      totalChecked,
      syncedAt: new Date().toISOString(),
      message: `All ${totalChecked} tasks already up to date.`
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
  }

  // 6. Incremental upsert: load existing products only when tasks actually need to be upserted
  const existingProductsRows = await db`
    SELECT record_id, data 
    FROM ledger_collections 
    WHERE collection_name = 'products';
  `;
  const existingProductsMap = new Map<string, any>();
  for (const row of existingProductsRows) {
    existingProductsMap.set(row.record_id, row.data);
  }

  // 6. Pre-deduplicate and ensure unique products exist before inserting prints
  const uniqueProductsToCreate = new Map<string, { task: any; cleaned: string; productId: string }>();
  for (const task of tasksToUpsert) {
    const rawTitle = task.title || task.designTitle || 'Untitled Model';
    const cleaned = cleanTitle(rawTitle);
    const productId = getProductId(cleaned);
    const existing = existingProductsMap.get(productId);
    const hasPhoto = Boolean(existing?.photo && existing.photo.length > 100);

    if ((!existing || !hasPhoto) && !uniqueProductsToCreate.has(productId)) {
      uniqueProductsToCreate.set(productId, { task, cleaned, productId });
    }
  }

  for (const { task, cleaned, productId } of uniqueProductsToCreate.values()) {
    let photoDataUrl = '';
    if (task.cover) {
      photoDataUrl = await downloadImageAsBase64(task.cover);
    }
    const grams = Number(Number(task.weight || 0).toFixed(1));
    const prodGrams = grams > 0 ? grams : 50;
    const minutes = Math.round((task.costTime || 0) / 60) || 60;
    const filamentCost = Number(((prodGrams / 1000) * 85).toFixed(2));
    const productionCost = filamentCost;
    const markup = 35;
    const markupAmount = Number((productionCost * 0.35).toFixed(2));
    const sellingPrice = Number((productionCost * 1.35).toFixed(2));

    const existing = existingProductsMap.get(productId);
    const photoToKeep = (existing?.photo && existing.photo.length > 100) ? existing.photo : photoDataUrl;

    const newProd = {
      ...existing,
      id: productId,
      name: existing?.name || cleaned,
      category: existing?.category || '3D Prints',
      grams: existing?.grams || prodGrams,
      minutes: existing?.minutes || minutes,
      openingStock: existing?.openingStock ?? 0,
      minStock: existing?.minStock ?? 2,
      photo: photoToKeep,
      notes: existing?.notes || 'Imported from Bambu Lab Cloud',
      filamentCost: existing?.filamentCost ?? filamentCost,
      productionCost: existing?.productionCost ?? productionCost,
      markup: existing?.markup ?? markup,
      markupAmount: existing?.markupAmount ?? markupAmount,
      sellingPrice: existing?.sellingPrice ?? sellingPrice,
      directPrice: existing?.directPrice ?? sellingPrice,
      agentPrice: existing?.agentPrice ?? sellingPrice,
      unitCost: existing?.unitCost ?? productionCost,
      updatedAt: task.endTime || task.startTime || new Date().toISOString()
    };

    await db`
      INSERT INTO ledger_collections (collection_name, record_id, data, updated_at)
      VALUES ('products', ${productId}, ${JSON.stringify(newProd)}, NOW())
      ON CONFLICT (collection_name, record_id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
    `;
    existingProductsMap.set(productId, newProd);
  }

  let syncedCount = 0;
  const CHUNK_SIZE = 5;
  for (let i = 0; i < tasksToUpsert.length; i += CHUNK_SIZE) {
    const chunk = tasksToUpsert.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(async task => {
      const rawTitle = task.title || task.designTitle || 'Untitled Model';
      const cleaned = cleanTitle(rawTitle);
      const productId = getProductId(cleaned);
      const recordId = `bambu_${task.id}`;
      const legacyId = `print_${md5(String(task.id)).slice(0, 16)}`;

      const statusStr = String(task.status ?? '').toLowerCase();
      let statusLabel: 'Printing' | 'Success' | 'Canceled' | 'Failed';
      let isSuccess = false;

      if (task.status === 2 || statusStr === 'finish' || statusStr === 'success') {
        statusLabel = 'Success';
        isSuccess = true;
      } else if (task.status === 3 || statusStr === 'cancel' || statusStr === 'canceled') {
        statusLabel = 'Canceled';
      } else if (task.status === 0 || task.status === 1 || statusStr === 'running' || statusStr === 'printing' || statusStr === 'prepare' || statusStr === 'busy' || statusStr === 'pause') {
        statusLabel = 'Printing';
      } else if (task.status === 4 || statusStr === 'failed' || (task.failedType != null && task.failedType !== 0)) {
        statusLabel = 'Failed';
      } else {
        statusLabel = 'Failed';
      }

      const dateStr = (task.startTime || task.endTime || new Date().toISOString()).slice(0, 10);
      const grams = Number(Number(task.weight || 0).toFixed(1));
      const { hours, estimatedHours } = calculatePrintHours(task, statusLabel);
      const note = task.title || task.designTitle || (isSuccess ? 'Completed' : (statusLabel === 'Printing' ? 'Printing' : 'Failed / Cancelled'));

      const filamentsUsed = formatFilaments(task.amsDetailMapping);
      const buildPlate = formatBedType(task.bedType);
      const nozzle = formatNozzle(task.nozzleInfos, task.nozzleDiameter);
      const printerName = task.deviceName && task.deviceModel
        ? `${task.deviceName} (${task.deviceModel})`
        : (task.deviceName || task.deviceModel || '3DP-22E-489 (P2S)');
      const plateName = task.plateName?.trim() || (task.plateIndex ? `Plate ${task.plateIndex}` : 'Plate 1');
      const profileName = cleanProfileName(task.instanceTitle || task.profileName || '');

      if (legacyId !== recordId && existingPrintsMap.has(legacyId)) {
        await db`
          DELETE FROM ledger_collections 
          WHERE collection_name = 'prints' AND record_id = ${legacyId};
        `;
      }

      const printJob = {
        id: recordId,
        bambuTaskId: task.id,
        date: dateStr,
        productId: productId,
        qty: isSuccess ? 1 : 0,
        failed: statusLabel === 'Failed' ? 1 : 0,
        grams,
        hours,
        estimatedHours,
        note,
        updatedAt: task.endTime || task.startTime || new Date().toISOString(),
        statusLabel,
        status: statusLabel,
        rawStatus: task.status,
        failedType: task.failedType,
        plateName,
        plate: plateName,
        profileName,
        printerName,
        printer: printerName,
        buildPlate,
        nozzle,
        startTime: task.startTime || undefined,
        endTime: task.endTime || undefined,
        filamentsUsed
      };

      await db`
        INSERT INTO ledger_collections (collection_name, record_id, data, updated_at)
        VALUES ('prints', ${recordId}, ${JSON.stringify(printJob)}, NOW())
        ON CONFLICT (collection_name, record_id)
        DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
      `;
      syncedCount++;
    }));
  }

  // 7. Recalculate totalPrinted count on products strictly from successful prints
  if (syncedCount > 0) {
    await db`
      UPDATE ledger_collections p
      SET data = jsonb_set(
        p.data,
        '{totalPrinted}',
        to_jsonb(COALESCE(sub.count, 0))
      ),
      updated_at = NOW()
      FROM (
        SELECT data->>'productId' as product_id, sum((data->>'qty')::numeric)::int as count
        FROM ledger_collections
        WHERE collection_name = 'prints' 
          AND (data->>'statusLabel' = 'Success' OR data->>'status' = 'Success' OR ((data->>'statusLabel') IS NULL AND (data->>'qty')::numeric > 0))
        GROUP BY data->>'productId'
      ) sub
      WHERE p.collection_name = 'products' AND p.record_id = sub.product_id;
    `;
  }

  const syncedAt = new Date().toISOString();

  return NextResponse.json({
    success: true,
    newTasksCount: syncedCount,
    totalChecked,
    syncedAt,
    message: `Synced ${syncedCount} task${syncedCount === 1 ? '' : 's'} from Bambu Lab Cloud.`
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    }
  });
}

export async function POST(req: NextRequest) {
  // 1. Authoritative Dual-Gate Authentication (Admin Session OR Scoped M2M Credential)
  const auth = await authenticateBambuSync(req);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {}

    const action = req.nextUrl.searchParams.get('action') || body?.action;
    if (action === 'backfill-photos' || body?.backfillPhotos) {
      if (!sql) {
        return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
      }
      const token = await getBambuToken(sql);
      if (!token) {
        return NextResponse.json({ error: 'Bambu Cloud token not configured.' }, { status: 401 });
      }
      return await handleBackfillPhotos(sql, token);
    }

    return await handleSync(req);
  } catch (err: any) {
    console.error('Error in POST /api/bambu/sync:', err);
    return NextResponse.json({ error: err.message || 'Sync failed.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // 1. Authoritative Dual-Gate Authentication (Admin Session OR Scoped M2M Credential)
  const auth = await authenticateBambuSync(req);
  if (auth instanceof Response) {
    return auth;
  }

  // Safe read-only status endpoint — zero external cloud calls, zero database mutations
  return NextResponse.json(
    {
      status: 'ready',
      service: 'bambu-sync',
      message: 'Bambu synchronization service operational. Live sync triggers require POST.',
      timestamp: Date.now()
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    }
  );
}
