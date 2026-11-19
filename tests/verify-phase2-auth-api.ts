import http from 'http';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { neon } from '@neondatabase/serverless';
import { validateM2MToken } from '../src/lib/auth';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Dynamic/ephemeral secret from environment (never hardcoded in source)
const M2M_SECRET_FOR_TEST =
  process.env.TEST_BAMBU_M2M_SECRET || crypto.randomBytes(32).toString('hex');

interface TestResult {
  id: number;
  name: string;
  category: string;
  status: 'PASS' | 'FAIL';
  expected: string;
  actual: string;
}

const results: TestResult[] = [];

function recordTest(
  id: number,
  name: string,
  category: string,
  passed: boolean,
  expected: string,
  actual: string
) {
  const status: 'PASS' | 'FAIL' = passed ? 'PASS' : 'FAIL';
  results.push({ id, name, category, status, expected, actual });
  console.log(` ${passed ? '✅' : '❌'} [Req ${id}] ${name}: ${status} (Actual: ${actual})`);
}

// 1. Primary local mock server for Bambu Cloud API (port 3999, configured via BAMBU_API_BASE_URL)
let mockBambuHitCount = 0;
let mockServer: http.Server;

function startMockBambuServer(): Promise<number> {
  return new Promise((resolve) => {
    mockServer = http.createServer((req, res) => {
      mockBambuHitCount++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hits: [], total: 0 }));
    });
    mockServer.listen(3999, '127.0.0.1', () => {
      resolve(3999);
    });
  });
}

function stopMockBambuServer(): Promise<void> {
  return new Promise((resolve) => {
    if (mockServer) {
      mockServer.close(() => resolve());
    } else {
      resolve();
    }
  });
}

// 2. Secondary attacker probe sink (port 9999) to verify SSRF headers cannot redirect traffic
let attackerSinkHitCount = 0;
let sinkServer: http.Server;

function startAttackerSinkServer(): Promise<number> {
  return new Promise((resolve) => {
    sinkServer = http.createServer((req, res) => {
      attackerSinkHitCount++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ captured: true }));
    });
    sinkServer.listen(9999, '127.0.0.1', () => {
      resolve(9999);
    });
  });
}

function stopAttackerSinkServer(): Promise<void> {
  return new Promise((resolve) => {
    if (sinkServer) {
      sinkServer.close(() => resolve());
    } else {
      resolve();
    }
  });
}

async function runPhase221Tests() {
  console.log('========================================================================');
  console.log('  PRINT STUDIO LEDGER — PHASE 2.2.1 SECURITY REMEDIATION VERIFICATION');
  console.log('========================================================================\n');

  await startMockBambuServer();
  await startAttackerSinkServer();

  try {
    // ------------------------------------------------------------------------
    // SETUP: Create an active admin user and obtain valid session
    // ------------------------------------------------------------------------
    const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE_URL,
      },
      body: JSON.stringify({
        email: 'admin@printstudio.ae',
        password: process.env.ADMIN_SEED_PASSWORD || 'Admin123!Secure',
      }),
    });

    const setCookie = loginRes.headers.get('set-cookie') || '';
    const sessionMatch = setCookie.match(/(?:__Host-admin_session|admin_session)=([^;]+)/);
    const validCookie = sessionMatch ? sessionMatch[0] : '';
    const validToken = sessionMatch ? sessionMatch[1] : '';

    if (!validCookie || !validToken) {
      throw new Error(`Failed to obtain administrator session in test setup: HTTP ${loginRes.status}`);
    }

    // ------------------------------------------------------------------------
    // Req 1: GET /api/bambu/sync returns read-only status (no cloud sync, no mutations)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 1: GET /api/bambu/sync Returns Read-Only Status ---');
    const getRes = await fetch(`${BASE_URL}/api/bambu/sync`, {
      method: 'GET',
      headers: { Cookie: validCookie },
    });
    const getJson = await getRes.json();

    const req1Pass =
      getRes.status === 200 &&
      getJson.status === 'ready' &&
      getJson.service === 'bambu-sync' &&
      typeof getJson.timestamp === 'number';

    recordTest(
      1,
      'GET /api/bambu/sync Returns Read-Only Status',
      'HTTP Semantics',
      req1Pass,
      'HTTP 200 with { status: "ready", service: "bambu-sync" }',
      `Status: ${getRes.status}, body: ${JSON.stringify(getJson)}`
    );

    // ------------------------------------------------------------------------
    // Req 2: GET /api/bambu/sync makes ZERO Bambu mock calls
    // ------------------------------------------------------------------------
    console.log('\n--- Test 2: GET /api/bambu/sync Makes Zero Outbound Cloud Calls ---');
    const mockHitsBeforeGet = mockBambuHitCount;
    await fetch(`${BASE_URL}/api/bambu/sync`, {
      method: 'GET',
      headers: { Cookie: validCookie },
    });
    const mockHitsAfterGet = mockBambuHitCount;
    const req2Pass = mockHitsAfterGet === mockHitsBeforeGet;

    recordTest(
      2,
      'GET /api/bambu/sync Zero Outbound Cloud Calls',
      'Safe GET Semantics',
      req2Pass,
      'Zero new requests to Bambu Cloud mock server',
      `Hits before: ${mockHitsBeforeGet}, Hits after: ${mockHitsAfterGet}`
    );

    // ------------------------------------------------------------------------
    // Req 3: GET /api/bambu/sync causes ZERO database mutations
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3: GET /api/bambu/sync Causes Zero Database Mutations ---');
    const [printsBeforeGet] = await sql`SELECT count(*)::int as count FROM public.ledger_collections WHERE collection_name = 'prints';`;
    const [productsBeforeGet] = await sql`SELECT count(*)::int as count FROM public.ledger_collections WHERE collection_name = 'products';`;

    await fetch(`${BASE_URL}/api/bambu/sync`, {
      method: 'GET',
      headers: { Cookie: validCookie },
    });

    const [printsAfterGet] = await sql`SELECT count(*)::int as count FROM public.ledger_collections WHERE collection_name = 'prints';`;
    const [productsAfterGet] = await sql`SELECT count(*)::int as count FROM public.ledger_collections WHERE collection_name = 'products';`;

    const req3Pass =
      printsBeforeGet.count === printsAfterGet.count &&
      productsBeforeGet.count === productsAfterGet.count;

    recordTest(
      3,
      'GET /api/bambu/sync Causes Zero Database Mutations',
      'Database Preservation',
      req3Pass,
      'Prints and products counts 100% unchanged',
      `Prints: ${printsBeforeGet.count}->${printsAfterGet.count}, Products: ${productsBeforeGet.count}->${productsAfterGet.count}`
    );

    // ------------------------------------------------------------------------
    // Req 4: Unauthenticated POST /api/bambu/sync is rejected before side effects
    // ------------------------------------------------------------------------
    console.log('\n--- Test 4: Unauthenticated POST /api/bambu/sync Blocked Before Side Effects ---');
    const hitsBeforeUnauthPost = mockBambuHitCount;
    const unauthPostRes = await fetch(`${BASE_URL}/api/bambu/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE_URL,
      },
    });
    const hitsAfterUnauthPost = mockBambuHitCount;
    const req4Pass =
      unauthPostRes.status === 401 &&
      hitsBeforeUnauthPost === hitsAfterUnauthPost;

    recordTest(
      4,
      'Unauthenticated POST /api/bambu/sync Blocked Before Side Effects',
      'Perimeter Defense',
      req4Pass,
      'HTTP 401 with zero Bambu Cloud network calls',
      `Status: ${unauthPostRes.status}, Cloud Hits: ${hitsAfterUnauthPost - hitsBeforeUnauthPost}`
    );

    // ------------------------------------------------------------------------
    // Req 5: Valid administrator POST /api/bambu/sync still works
    // ------------------------------------------------------------------------
    console.log('\n--- Test 5: Valid Administrator POST /api/bambu/sync Operational ---');
    const adminPostRes = await fetch(`${BASE_URL}/api/bambu/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: validCookie,
        Origin: BASE_URL,
      },
    });
    const adminPostJson = await adminPostRes.json();

    const [adminAudit] = await sql`
      SELECT action, entity_type FROM public.audit_logs
      WHERE action = 'ADMIN_BAMBU_SYNC'
      ORDER BY created_at DESC LIMIT 1;
    `;

    const req5Pass =
      adminPostRes.status === 200 &&
      adminPostJson.success === true &&
      adminAudit?.action === 'ADMIN_BAMBU_SYNC';

    recordTest(
      5,
      'Administrator POST /api/bambu/sync Operational',
      'Interactive Synchronization',
      req5Pass,
      'HTTP 200 with success: true and ADMIN_BAMBU_SYNC audit record',
      `Status: ${adminPostRes.status}, success: ${adminPostJson.success}, audit: ${adminAudit?.action}`
    );

    // ------------------------------------------------------------------------
    // Req 6: Valid scoped M2M POST /api/bambu/sync still works
    // ------------------------------------------------------------------------
    console.log('\n--- Test 6: Valid Scoped M2M POST /api/bambu/sync Operational ---');
    const m2mPostRes = await fetch(`${BASE_URL}/api/bambu/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${M2M_SECRET_FOR_TEST}`,
      },
    });
    const m2mPostJson = await m2mPostRes.json();

    const [m2mAudit] = await sql`
      SELECT action, entity_type, details FROM public.audit_logs
      WHERE action = 'M2M_BAMBU_SYNC'
      ORDER BY created_at DESC LIMIT 1;
    `;

    const req6Pass =
      m2mPostRes.status === 200 &&
      m2mPostJson.success === true &&
      m2mAudit?.action === 'M2M_BAMBU_SYNC' &&
      m2mAudit?.details?.scope === 'bambu:sync';

    recordTest(
      6,
      'Scoped M2M POST /api/bambu/sync Operational',
      'Machine Automation',
      req6Pass,
      'HTTP 200 with success: true and M2M_BAMBU_SYNC audit record',
      `Status: ${m2mPostRes.status}, success: ${m2mPostJson.success}, audit: ${m2mAudit?.action}, scope: ${m2mAudit?.details?.scope}`
    );

    // ------------------------------------------------------------------------
    // Req 7: Cookie-authenticated POST with foreign or missing origin is rejected
    // ------------------------------------------------------------------------
    console.log('\n--- Test 7: Cookie-Authenticated POST With Foreign/Missing Origin Rejected ---');
    const foreignOriginRes = await fetch(`${BASE_URL}/api/bambu/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: validCookie,
        Origin: 'https://malicious-attacker.com',
      },
    });

    const missingOriginRes = await fetch(`${BASE_URL}/api/bambu/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: validCookie,
        // No Origin or Referer header
      },
    });

    const req7Pass =
      foreignOriginRes.status === 403 &&
      missingOriginRes.status === 403;

    recordTest(
      7,
      'Cookie-Authenticated POST CSRF Defense',
      'CSRF Protection',
      req7Pass,
      'HTTP 403 Forbidden on foreign origin and missing origin',
      `Foreign origin: ${foreignOriginRes.status}, Missing origin: ${missingOriginRes.status}`
    );

    // ------------------------------------------------------------------------
    // Req 8: Request-supplied x-bambu-mock-url cannot influence outbound destinations
    // ------------------------------------------------------------------------
    console.log('\n--- Test 8: Request Header x-bambu-mock-url Cannot Control Destination (SSRF Defense) ---');
    const attackerHitsBefore = attackerSinkHitCount;
    await fetch(`${BASE_URL}/api/bambu/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: validCookie,
        Origin: BASE_URL,
        'x-bambu-mock-url': 'http://127.0.0.1:9999/attacker-sink',
      },
    });
    const attackerHitsAfter = attackerSinkHitCount;
    const req8Pass = attackerHitsAfter === attackerHitsBefore;

    recordTest(
      8,
      'x-bambu-mock-url Request Header Completely Ignored (SSRF Immunity)',
      'SSRF Defense',
      req8Pass,
      'Zero requests received at attacker sink (port 9999)',
      `Attacker sink hits before: ${attackerHitsBefore}, after: ${attackerHitsAfter}`
    );

    // ------------------------------------------------------------------------
    // Req 9: No hardcoded M2M secret or hash remains in test source or documentation
    // ------------------------------------------------------------------------
    console.log('\n--- Test 9: No Hardcoded M2M Secret or Hash in Source/Docs ---');
    // Check known compromised substrings dynamically
    const badSecretPattern = Buffer.from('YmFtYnVfbTJtX3NlY185Zjhh', 'base64').toString('utf8');
    const badHashPattern = Buffer.from('MmNlYzViMzYxMmQwYWY=', 'base64').toString('utf8');

    const filesToScan = [
      'tests/verify-phase2-auth-api.ts',
      'docs/PHASE_2_2_IMPLEMENTATION_REPORT.md',
      'docs/PHASE_2_2_INDEPENDENT_SECURITY_REVIEW.md',
    ];

    let foundExposed = 0;
    for (const f of filesToScan) {
      if (fs.existsSync(f)) {
        const content = fs.readFileSync(f, 'utf8');
        if (content.includes(badSecretPattern) || content.includes(badHashPattern)) {
          foundExposed++;
        }
      }
    }

    const req9Pass = foundExposed === 0;

    recordTest(
      9,
      'No Hardcoded M2M Credentials in Source or Documentation',
      'Credential Sanitization',
      req9Pass,
      'Zero occurrences of compromised secret or hash in scanned files',
      `Exposures detected: ${foundExposed}`
    );

    // ------------------------------------------------------------------------
    // Req 10: Production mode refuses plaintext-secret fallback
    // ------------------------------------------------------------------------
    console.log('\n--- Test 10: Production Mode Refuses Plaintext Secret Fallback ---');
    const origEnv = { ...process.env };
    let prodRefused = false;

    try {
      // Emulate production environment without precomputed hash
      (process.env as any).NODE_ENV = 'production';
      delete process.env.BAMBU_M2M_SECRET_HASH;
      delete process.env.BAMBU_M2M_SECRET_HASH_PREVIOUS;
      delete process.env.BAMBU_M2M_API_KEY_HASH;
      process.env.BAMBU_M2M_SECRET = 'plain_secret_at_least_32_characters_long_for_test';

      const mockReq = new Request('http://localhost:3000/api/bambu/sync', {
        headers: {
          authorization: 'Bearer plain_secret_at_least_32_characters_long_for_test',
        },
      });

      const isValidInProd = validateM2MToken(mockReq, 'bambu:sync');
      prodRefused = isValidInProd === false;
    } finally {
      process.env = origEnv;
    }

    recordTest(
      10,
      'Production Mode Refuses Plaintext Secret Fallback',
      'Fail-Closed Defense',
      prodRefused,
      'validateM2MToken returns false in production when only plaintext secret is set',
      `Refused in production: ${prodRefused}`
    );

    // ------------------------------------------------------------------------
    // Req 11: Existing /api/data and dashboard operations remain compatible
    // ------------------------------------------------------------------------
    console.log('\n--- Test 11: Existing /api/data and Dashboard Compatibility ---');
    const dataStatusRes = await fetch(`${BASE_URL}/api/data?status=1`, {
      headers: { Cookie: validCookie },
    });
    const dataStatusJson = await dataStatusRes.json();

    const dataProdsRes = await fetch(`${BASE_URL}/api/data?collection=products`, {
      headers: { Cookie: validCookie },
    });
    const dataProdsJson = await dataProdsRes.json();

    const dataAllRes = await fetch(`${BASE_URL}/api/data`, {
      headers: { Cookie: validCookie },
    });
    const dataAllJson = await dataAllRes.json();

    const settingsItem = dataAllJson.collections?.settings?.[0];
    const isTokenMasked = settingsItem?.bambuToken === '••••••••';

    const req11Pass =
      dataStatusRes.status === 200 &&
      dataStatusJson.version?.includes('products:80') &&
      dataProdsRes.status === 200 &&
      dataProdsJson.items?.length === 80 &&
      dataAllRes.status === 200 &&
      isTokenMasked === true;

    recordTest(
      11,
      'Existing /api/data Operations Retain Full Compatibility',
      'System Preservation',
      req11Pass,
      'HTTP 200 for ?status=1, products:80, and masked bambuToken (••••••••)',
      `Status: ${dataStatusRes.status}, prods: ${dataProdsJson.items?.length}, tokenMasked: ${isTokenMasked}`
    );

    // ------------------------------------------------------------------------
    // Scorecard
    // ------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log('  PHASE 2.2.1 TEST SCORECARD');
    console.log('========================================================================');
    const total = results.length;
    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    const rate = ((passed / total) * 100).toFixed(1);

    console.log(`Total Requirements Tested : ${total}`);
    console.log(`Passed                    : ${passed} ✅`);
    console.log(`Failed                    : ${failed} ${failed > 0 ? '❌' : ''}`);
    console.log(`Success Rate              : ${rate}%`);
    console.log('========================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal test error in verify-phase2-auth-api:', err);
    process.exit(1);
  } finally {
    await stopMockBambuServer();
    await stopAttackerSinkServer();
  }
}

runPhase221Tests().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
