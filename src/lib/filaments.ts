import crypto from 'crypto';

export const BAMBU_COLOR_MAP: Record<string, string> = {
  '#C1C1C1': 'Basic Gray',
  '#F98C36': 'Orange',
  '#F95D73': 'Coral Pink',
  '#A03CF7': 'Purple',
  '#161616': 'Basic Black',
  '#0ACC38': 'Bambu Green',
  '#76D9F4': 'Light Blue',
  '#46A8F9': 'Sky Blue',
  '#FFFFFF': 'Jade White',
  '#0A2989': 'Dark Blue',
  '#000000': 'Matte Black',
  '#0033CC': 'Cobalt Blue',
};

export function getFilamentColorName(hex: string): string {
  const norm = hex.trim().toUpperCase();
  return BAMBU_COLOR_MAP[norm] || norm;
}

export interface FilamentRecord {
  id: string;
  name: string;
  brand: string;
  material: string;
  color: string;
  colorName: string;
  totalUsedGrams: number;
  jobCount: number;
  lastAmsSlot: string;
  lastUsedAt: string;
  allocatedGrams: number;
  restockedGrams: number;
  weightG: number;
  price: number;
  location: string;
  updatedAt: string;
}

export async function syncFilamentsFromPrints(sql: any): Promise<FilamentRecord[]> {
  if (!sql) return [];

  // 1. Fetch all prints
  const printRows = await sql`
    SELECT record_id, data 
    FROM ledger_collections 
    WHERE collection_name = 'prints';
  `;

  // Sort prints by date descending so the first encounter has the latest status/slot
  const prints = [...printRows].sort((a: any, b: any) => {
    const tA = new Date(a.data?.endTime || a.data?.startTime || a.data?.date).getTime() || 0;
    const tB = new Date(b.data?.endTime || b.data?.startTime || b.data?.date).getTime() || 0;
    return tB - tA;
  });

  // 2. Fetch existing filaments to preserve any user custom adjustments or restocks
  const existingFilRows = await sql`
    SELECT record_id, data 
    FROM ledger_collections 
    WHERE collection_name = 'filaments';
  `;
  const existingMap = new Map<string, any>();
  for (const row of existingFilRows) {
    if (row.data) {
      existingMap.set(row.record_id, row.data);
    }
  }

  // 3. Aggregate filaments from prints
  const filMap = new Map<string, any>();

  for (const p of prints) {
    const d = p.data;
    if (d && Array.isArray(d.filamentsUsed) && d.filamentsUsed.length > 0) {
      for (const f of d.filamentsUsed) {
        const mat = (f.type || 'PLA').trim().toUpperCase();
        let col = (f.color || '#888888').trim().toUpperCase();
        if (!col.startsWith('#')) col = '#' + col;
        if (col.length === 4) col = '#' + col[1] + col[1] + col[2] + col[2] + col[3] + col[3];

        const key = `${mat}_${col}`;
        const filId = `fil_${mat.toLowerCase()}_${col.replace('#', '').toLowerCase()}`;
        const w = Number(f.weightG || 0);
        const printDate = d.endTime || d.startTime || d.date || '';

        if (!filMap.has(key)) {
          const colorName = BAMBU_COLOR_MAP[col] || col;
          filMap.set(key, {
            id: filId,
            material: mat,
            color: col,
            colorName,
            name: `${mat} ${colorName}`,
            brand: 'Bambu Lab',
            totalUsedGrams: 0,
            jobCount: 0,
            lastAmsSlot: f.slot || 'Shelf',
            lastUsedAt: printDate,
            weightG: 1000,
            price: 85
          });
        }

        const item = filMap.get(key);
        item.totalUsedGrams += w;
        item.jobCount++;

        // Track newest print date and last used slot
        if (!item.lastUsedAt || printDate > item.lastUsedAt) {
          item.lastUsedAt = printDate;
          if (f.slot) item.lastAmsSlot = f.slot;
        }
      }
    }
  }

  const results: FilamentRecord[] = [];

  for (const item of filMap.values()) {
    item.totalUsedGrams = Number(item.totalUsedGrams.toFixed(1));
    const existing = existingMap.get(item.id);

    const restockedGrams = Number(existing?.restockedGrams || 0);
    const defaultAllocated = Math.max(1000, Math.ceil(item.totalUsedGrams / 1000) * 1000);
    const allocatedGrams = (existing?.allocatedGrams && existing.allocatedGrams >= defaultAllocated)
      ? existing.allocatedGrams
      : (defaultAllocated + restockedGrams);

    const location = item.lastAmsSlot && ['A1', 'A2', 'A3', 'A4'].includes(item.lastAmsSlot)
      ? `${item.lastAmsSlot} • P2S`
      : (item.lastAmsSlot === 'Ext' ? 'Ext Spool' : (existing?.location || 'Shelf'));

    const filRecord: FilamentRecord = {
      ...item,
      name: existing?.name || item.name,
      brand: existing?.brand || item.brand,
      location,
      allocatedGrams,
      restockedGrams,
      price: existing?.price !== undefined ? existing.price : 85,
      weightG: 1000,
      updatedAt: item.lastUsedAt || new Date().toISOString()
    };

    // Upsert into Neon PostgreSQL
    await sql`
      INSERT INTO ledger_collections (collection_name, record_id, data, updated_at)
      VALUES ('filaments', ${filRecord.id}, ${JSON.stringify(filRecord)}, NOW())
      ON CONFLICT (collection_name, record_id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
    `;

    results.push(filRecord);
  }

  // Sort by totalUsedGrams DESC for consistent presentation
  results.sort((a, b) => b.totalUsedGrams - a.totalUsedGrams);

  return results;
}
