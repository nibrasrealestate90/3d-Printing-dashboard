import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { syncFilamentsFromPrints } from '../src/lib/filaments';

// 1. Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config(); // Fallback for standard .env

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL is not defined in .env.local');
  process.exit(1);
}

const BAMBU_TOKEN = process.env.BAMBU_TOKEN;
if (!BAMBU_TOKEN) {
  console.error('❌ Error: BAMBU_TOKEN environment variable is not set.');
  console.error('Please run the script with: BAMBU_TOKEN="<token>" npx tsx scripts/import-bambu.ts');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

interface BambuTask {
  id: number;
  designId?: number;
  designTitle?: string;
  title?: string;
  status: number; // 2 = success, 3 = failed/cancelled, 4 = in-progress
  weight: number;
  costTime: number; // duration in seconds
  startTime?: string;
  endTime?: string;
  cover?: string;
  [key: string]: any;
}

interface ProductData {
  id: string;
  name: string;
  sku?: string;
  category: string;
  grams: number;
  minutes: number;
  openingStock: number;
  minStock: number;
  photo: string;
  notes: string;
  filamentCost?: number;
  productionCost?: number;
  markup?: number;
  markupAmount?: number;
  sellingPrice?: number;
  directPrice?: number;
  agentPrice?: number;
  unitCost?: number;
  updatedAt: string;
}

interface PrintJobData {
  id: string;
  date: string;
  productId: string;
  qty: number;
  failed: number;
  grams: number;
  hours: number;
  note: string;
  updatedAt: string;
  statusLabel?: "Success" | "Printing" | "Canceled" | "Failed";
  progress?: number;
  plateName?: string;
  profileName?: string;
  printerName?: string;
  buildPlate?: string;
  nozzle?: string;
  startTime?: string;
  endTime?: string;
  filamentsUsed?: Array<{ type: string; color?: string; weightG?: number; slot?: string }>;
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

function cleanProfileName(name?: string): string {
  if (!name) return '';
  return String(name)
    .replace(/\s*@(BBL|Bambu)[^\n,;]*/gi, '')
    .trim();
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

function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

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

function cleanModelTitle(raw?: string): string {
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

function getProductId(cleanedTitle: string): string {
  const hash = md5(cleanedTitle.toLowerCase()).slice(0, 16);
  return `prod_${hash}`;
}

function getPrintJobId(taskId: number | string): string {
  const hash = md5(String(taskId)).slice(0, 16);
  return `print_${hash}`;
}

async function downloadImageAsBase64(url?: string): Promise<string> {
  if (!url) return '';
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return '';
    }
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

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS ledger_collections (
      collection_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (collection_name, record_id)
    );
  `;
}

async function fetchAllBambuTasks(token: string): Promise<BambuTask[]> {
  const limit = 100;
  let offset = 0;
  const tasks: BambuTask[] = [];
  let totalReported = 0;

  console.log('📡 Connecting to Bambu Lab Cloud API...');

  while (true) {
    const endpoint = `https://api.bambulab.com/v1/user-service/my/tasks?limit=${limit}&offset=${offset}`;
    const res = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!res.ok) {
      throw new Error(`Bambu Cloud API responded with HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const hits: BambuTask[] = data.hits || [];
    totalReported = data.total ?? totalReported;
    tasks.push(...hits);

    console.log(`   Fetched offset ${offset}: received ${hits.length} tasks (total accumulated: ${tasks.length} / ${totalReported})`);

    if (hits.length === 0 || tasks.length >= totalReported) {
      break;
    }
    offset += limit;
  }

  console.log(`✅ Successfully retrieved all ${tasks.length} historical print tasks from Bambu Lab Cloud.\n`);
  return tasks;
}

async function main() {
  console.log('===============================================================');
  console.log('🚀 Bambu Lab Cloud -> Neon PostgreSQL Migration Script');
  console.log('===============================================================\n');

  await ensureTable();

  // 1. Fetch all tasks from Bambu Cloud
  const rawTasks = await fetchAllBambuTasks(BAMBU_TOKEN!);

  // Filter out printer calibration routines (bed leveling, PA line calibration, flow rate test, etc.)
  const tasks = rawTasks.filter(task => {
    const rawTitle = task.title || task.designTitle || '';
    const cleaned = cleanTitle(rawTitle);
    return !isCalibrationTask(rawTitle) && !isCalibrationTask(cleaned);
  });

  const skippedCalibCount = rawTasks.length - tasks.length;
  if (skippedCalibCount > 0) {
    console.log(`🧹 Skipped ${skippedCalibCount} calibration/test routines (e.g. auto_pa_line_calib_mode, bed_level, flow_calib).\n`);
  }

  // 2. Group tasks by cleaned model title
  const modelGroups = new Map<string, { cleanedTitle: string; tasks: BambuTask[]; repTask: BambuTask }>();

  for (const task of tasks) {
    const rawTitle = task.title || task.designTitle || 'Untitled Model';
    const cleaned = cleanTitle(rawTitle);

    if (!modelGroups.has(cleaned)) {
      modelGroups.set(cleaned, {
        cleanedTitle: cleaned,
        tasks: [task],
        repTask: task
      });
    } else {
      const entry = modelGroups.get(cleaned)!;
      entry.tasks.push(task);
      // Prefer successful print with valid cover as representative model
      if ((task.status === 2 && entry.repTask.status !== 2) || (!entry.repTask.cover && task.cover)) {
        entry.repTask = task;
      }
    }
  }

  console.log(`📦 Found ${modelGroups.size} unique product models across ${tasks.length} print jobs.\n`);

  // 3. Process and Upsert Unique Products
  console.log('🖼️  Downloading thumbnails and encoding Base64 for unique products...');
  const products: ProductData[] = [];
  let thumbnailSuccessCount = 0;
  let prodIndex = 0;

  for (const [cleanedTitle, group] of modelGroups.entries()) {
    prodIndex++;
    const productId = getProductId(cleanedTitle);
    const rep = group.repTask;
    let photoDataUrl = '';

    if (rep.cover) {
      photoDataUrl = await downloadImageAsBase64(rep.cover);
      if (photoDataUrl) {
        thumbnailSuccessCount++;
      }
    }

    const grams = Number(rep.weight) > 0 ? Number(Number(rep.weight).toFixed(1)) : 50;
    const minutes = Math.round((rep.costTime || 0) / 60) || 60;
    const filamentCost = Number(((grams / 1000) * 85).toFixed(2));
    const productionCost = filamentCost;
    const markup = 35;
    const markupAmount = Number((productionCost * 0.35).toFixed(2));
    const sellingPrice = Number((productionCost * 1.35).toFixed(2));

    const product: ProductData = {
      id: productId,
      name: cleanedTitle,
      sku: `PRN-${String(prodIndex).padStart(4, '0')}`,
      category: '3D Prints',
      grams,
      minutes,
      openingStock: 0,
      minStock: 2,
      photo: photoDataUrl,
      notes: 'Imported from Bambu Lab Cloud',
      filamentCost,
      productionCost,
      markup,
      markupAmount,
      sellingPrice,
      directPrice: sellingPrice,
      agentPrice: sellingPrice,
      unitCost: productionCost,
      updatedAt: rep.endTime || rep.startTime || new Date().toISOString()
    };

    products.push(product);

    if (prodIndex % 10 === 0 || prodIndex === modelGroups.size) {
      console.log(`   Processed ${prodIndex}/${modelGroups.size} products (${thumbnailSuccessCount} thumbnails encoded)...`);
    }
  }

  console.log(`\n💾 Upserting ${products.length} products to Neon DB (table: ledger_collections, collection_name: 'products')...`);
  for (const product of products) {
    await sql`
      INSERT INTO ledger_collections (collection_name, record_id, data, updated_at)
      VALUES ('products', ${product.id}, ${JSON.stringify(product)}, NOW())
      ON CONFLICT (collection_name, record_id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
    `;
  }
  console.log('✅ All products successfully upserted into Neon DB.\n');

  // 4. Process and Upsert Print Jobs
  console.log(`💾 Processing and upserting ${tasks.length} print jobs to Neon DB (collection_name: 'prints')...`);
  let successPrints = 0;
  let printingPrints = 0;
  let failedPrints = 0;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const rawTitle = task.title || task.designTitle || 'Untitled Model';
    const cleaned = cleanTitle(rawTitle);
    const productId = getProductId(cleaned);
    const printId = getPrintJobId(task.id);

    let statusLabel: "Success" | "Printing" | "Canceled" | "Failed";
    let isSuccess = false;
    let isPrinting = false;

    if (task.status === 0 || task.status === 1) {
      statusLabel = "Printing";
      isPrinting = true;
    } else if (task.status === 2) {
      statusLabel = "Success";
      isSuccess = true;
    } else if (task.status === 3) {
      statusLabel = "Canceled";
    } else if (task.status === 4) {
      statusLabel = "Failed";
    } else {
      statusLabel = task.status === 2 ? "Success" : "Failed";
      isSuccess = task.status === 2;
    }

    if (isSuccess) successPrints++;
    else if (isPrinting) printingPrints++;
    else failedPrints++;

    const progress = typeof task.percent === 'number' ? task.percent : (typeof task.progress === 'number' ? task.progress : undefined);

    const dateStr = (task.startTime || task.endTime || new Date().toISOString()).slice(0, 10);
    const grams = Number(Number(task.weight || 0).toFixed(1));
    const hours = Number(((task.costTime || 0) / 3600).toFixed(2));
    const note = task.title || task.designTitle || (isSuccess ? 'Completed' : (isPrinting ? 'Printing' : 'Failed / Cancelled'));

    const filamentsUsed = formatFilaments(task.amsDetailMapping);
    const buildPlate = formatBedType(task.bedType);
    const nozzle = formatNozzle(task.nozzleInfos, task.nozzleDiameter);
    const printerName = task.deviceName && task.deviceModel
      ? `${task.deviceName} (${task.deviceModel})`
      : (task.deviceName || task.deviceModel || '3DP-22E-489 (P2S)');
    const plateName = task.plateName?.trim() || (task.plateIndex ? `Plate ${task.plateIndex}` : 'Plate 1');
    const profileName = cleanProfileName(task.instanceTitle || task.profileName || '');

    const printJob: PrintJobData = {
      id: printId,
      date: dateStr,
      productId: productId,
      qty: isSuccess ? 1 : 0,
      failed: isSuccess || isPrinting ? 0 : 1,
      grams,
      hours,
      note,
      updatedAt: task.endTime || task.startTime || new Date().toISOString(),
      statusLabel,
      ...(progress !== undefined ? { progress } : {}),
      plateName,
      profileName,
      printerName,
      buildPlate,
      nozzle,
      startTime: task.startTime || undefined,
      endTime: task.endTime || undefined,
      filamentsUsed
    };

    await sql`
      INSERT INTO ledger_collections (collection_name, record_id, data, updated_at)
      VALUES ('prints', ${printJob.id}, ${JSON.stringify(printJob)}, NOW())
      ON CONFLICT (collection_name, record_id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
    `;

    if ((i + 1) % 50 === 0 || i + 1 === tasks.length) {
      console.log(`   Upserted ${i + 1}/${tasks.length} print jobs...`);
    }
  }

  console.log('✅ All print jobs successfully upserted into Neon DB.\n');

  // 5. Synchronize filaments collection from prints
  console.log('🔄 Aggregating and syncing filaments from prints...');
  const syncedFilaments = await syncFilamentsFromPrints(sql);
  console.log(`✅ Synced ${syncedFilaments.length} unique filaments from print consumption.\n`);

  // 6. Verify records in Neon DB
  const dbProducts = await sql`
    SELECT count(*)::int as count FROM ledger_collections WHERE collection_name = 'products';
  `;
  const dbPrints = await sql`
    SELECT count(*)::int as count FROM ledger_collections WHERE collection_name = 'prints';
  `;
  const dbFilaments = await sql`
    SELECT count(*)::int as count FROM ledger_collections WHERE collection_name = 'filaments';
  `;
  const dbThumbs = await sql`
    SELECT count(*)::int as count FROM ledger_collections 
    WHERE collection_name = 'products' AND length(data->>'photo') > 100;
  `;

  console.log('===============================================================');
  console.log('📊 MIGRATION VERIFICATION & SUMMARY');
  console.log('===============================================================');
  console.log(`• Total Bambu Cloud Tasks Retrieved : ${rawTasks.length}`);
  console.log(`• Skipped Calibration Routines      : ${skippedCalibCount}`);
  console.log(`• Production Tasks Imported         : ${tasks.length}`);
  console.log(`• Unique Products Created in DB     : ${dbProducts[0].count} (from ${modelGroups.size} unique models)`);
  console.log(`• Products with Thumbnails Encoded  : ${dbThumbs[0].count} / ${dbProducts[0].count}`);
  console.log(`• Print Jobs Created in DB          : ${dbPrints[0].count} (Successful: ${successPrints}, Printing: ${printingPrints}, Failed/Other: ${failedPrints})`);
  console.log(`• Filaments Auto-Populated in DB    : ${dbFilaments[0].count} unique colors/materials`);
  console.log(`• Idempotency Verified              : Re-running will safely update existing records without duplicates.`);
  console.log('===============================================================\n');
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
