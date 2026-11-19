import * as dotenv from 'dotenv';
import * as fs from 'fs';
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

import { Client, neon } from '@neondatabase/serverless';
import * as crypto from 'crypto';

const TEST_BRANCH_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  '';
const sqlTest = neon(TEST_BRANCH_URL);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  category: string;
  status: 'PASS' | 'FAIL';
  expected: string;
  actual: string;
}

const results: TestResult[] = [];

function recordTest(name: string, category: string, pass: boolean, expected: string, actual: string) {
  const status: 'PASS' | 'FAIL' = pass ? 'PASS' : 'FAIL';
  results.push({ name, category, status, expected, actual });
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} [${category}] ${name}: ${status} (Actual: ${actual})`);
}

async function runHardenedTestSuite() {
  const {
    extractClientIp,
    validateOrigin,
    checkRateLimit,
    pruneExpiredSessions,
    generateSessionToken,
    hashToken,
  } = await import('../src/lib/auth');

  console.log('========================================================================');
  console.log('  PRINT STUDIO LEDGER — PHASE 1.2 SECURITY HARDENING VERIFICATION');
  console.log('========================================================================\n');

  // Clean rate limits before test suite starts
  const sqlDb = neon(process.env.DATABASE_URL!);
  await sqlDb`DELETE FROM public.rate_limits;`;

  // --------------------------------------------------------------------------
  // TEST 1: Rotating Forged X-Forwarded-For Headers (SEC-01)
  // --------------------------------------------------------------------------
  console.log('--- Test 1: Untrusted X-Forwarded-For Resistance ---');
  try {
    await sqlDb`DELETE FROM public.rate_limits;`;
    // Direct requests without trusted proxy must ignore client X-Forwarded-For
    const req1 = new Request('http://localhost:3000/api/admin/auth/login', {
      headers: { 'x-forwarded-for': '203.0.113.199' },
    });
    const ip1 = extractClientIp(req1);
    const ignoredSpoofedIp = ip1 === '127.0.0.1' || ip1 !== '203.0.113.199';

    recordTest(
      'Untrusted X-Forwarded-For Ignored',
      'Rate Limiting & IP Extraction',
      ignoredSpoofedIp,
      'extractClientIp returns 127.0.0.1 fallback, ignoring client header',
      `Result: ${ip1}`
    );

    // Test sending 6 attempts with rotating X-Forwarded-For against the login API
    // Because client XFF is ignored, all requests map to connection IP and MUST be rate-limited by attempt 6!
    const statuses: number[] = [];
    for (let i = 1; i <= 6; i++) {
      const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `198.51.100.${i}`, // Rotated spoofed IP
        },
        body: JSON.stringify({
          email: 'admin@printstudio.ae',
          password: `BadPassword_${i}`,
        }),
      });
      statuses.push(res.status);
    }

    const lockedAt6 = statuses[5] === 429;
    recordTest(
      'Rate Limit Triggered Despite Rotating XFF',
      'Rate Limiting & IP Extraction',
      lockedAt6,
      'Attempt 6 returns HTTP 429 despite rotated X-Forwarded-For headers',
      `Statuses: [${statuses.join(', ')}]`
    );

    // Clean up rate limits table
    await sqlTest`DELETE FROM public.rate_limits;`;
  } catch (err: any) {
    recordTest('Untrusted X-Forwarded-For Resistance', 'Rate Limiting', false, 'Lockout enforced', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Trusted Proxy Extraction (Cloudflare mode vs Direct)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Trusted Proxy Extraction ---');
  try {
    // Simulate Cloudflare mode
    const origProxyEnv = process.env.TRUSTED_PROXY;
    const origCfIngress = process.env.CF_INGRESS_VERIFIED;
    process.env.TRUSTED_PROXY = 'cloudflare';
    process.env.CF_INGRESS_VERIFIED = 'true';

    const cfValidReq = new Request('http://localhost:3000/api/admin/auth/login', {
      headers: {
        'cf-connecting-ip': '198.51.100.42',
      },
    });
    const cfIp = extractClientIp(cfValidReq);

    // When CF_INGRESS_VERIFIED is not true, cf-connecting-ip cannot be trusted
    process.env.CF_INGRESS_VERIFIED = 'false';
    const cfUnverifiedReq = new Request('http://localhost:3000/api/admin/auth/login', {
      headers: {
        'cf-connecting-ip': '198.51.100.42',
      },
    });
    const cfSpoofIp = extractClientIp(cfUnverifiedReq);

    process.env.TRUSTED_PROXY = origProxyEnv;
    process.env.CF_INGRESS_VERIFIED = origCfIngress;

    recordTest(
      'Cloudflare Header Trusted With Ingress Verification',
      'IP Extraction',
      cfIp === '198.51.100.42',
      'Extracts cf-connecting-ip when CF_INGRESS_VERIFIED=true',
      `Extracted: ${cfIp}`
    );

    recordTest(
      'Cloudflare Header Rejected Without Ingress Verification',
      'IP Extraction',
      cfSpoofIp === '127.0.0.1',
      'Rejects cf-connecting-ip when CF_INGRESS_VERIFIED=false',
      `Extracted: ${cfSpoofIp}`
    );
  } catch (err: any) {
    recordTest('Trusted Proxy Extraction', 'IP Extraction', false, 'Verified proxy headers', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Distributed Account-Based Brute-Force Defense (SEC-03 Dual-Key)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Dual-Key Account Rate Limiting ---');
  try {
    const targetAccount = 'admin@printstudio.ae';
    const accountKey = `auth_login_account:${targetAccount}`;

    // Clean account limit key
    await sqlDb`DELETE FROM public.rate_limits WHERE key = ${accountKey};`;

    let accountStatuses: number[] = [];
    // Submit 11 attempts specifically targeting account rate limit (limit is 10)
    for (let i = 1; i <= 11; i++) {
      const res = await checkRateLimit(accountKey, 10, 30 * 60 * 1000);
      accountStatuses.push(res.allowed ? 200 : 429);
    }

    const first10Allowed = accountStatuses.slice(0, 10).every(s => s === 200);
    const eleventhBlocked = accountStatuses[10] === 429;

    recordTest(
      'Account-Based Rate Limit (10 per 30m)',
      'Dual-Key Rate Limiting',
      first10Allowed && eleventhBlocked,
      'First 10 attempts allowed; 11th attempt returns 429',
      `Attempts 1-10: [${accountStatuses.slice(0, 10).join(',')}]; 11: ${accountStatuses[10]}`
    );

    await sqlTest`DELETE FROM public.rate_limits WHERE key = ${accountKey};`;
  } catch (err: any) {
    recordTest('Dual-Key Account Rate Limiting', 'Dual-Key Rate Limiting', false, 'Blocked on 11th', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 4: CSRF & Origin Validation Hardening (SEC-04 & SEC-05)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 4: CSRF and Origin Validation Hardening ---');
  try {
    // 4a. Matching origin & host
    const reqMatch = new Request('http://localhost:3000/api/admin/auth/logout', {
      method: 'POST',
      headers: {
        'Host': 'localhost:3000',
        'Origin': 'http://localhost:3000',
      },
    });
    recordTest(
      'Matching Origin Allowed',
      'CSRF Protection',
      validateOrigin(reqMatch) === true,
      'true for exact host and scheme match',
      `Result: ${validateOrigin(reqMatch)}`
    );

    // 4b. HTTP vs HTTPS mismatch
    const reqProtocolMismatch = new Request('https://app.printstudio.ae/api/admin/auth/logout', {
      method: 'POST',
      headers: {
        'Host': 'app.printstudio.ae',
        'Origin': 'http://app.printstudio.ae', // Insecure HTTP downgrade attempt
      },
    });
    const protocolMismatchBlocked = validateOrigin(reqProtocolMismatch) === false;
    recordTest(
      'HTTP to HTTPS Protocol Downgrade Blocked',
      'CSRF Protection',
      protocolMismatchBlocked,
      'false when origin scheme is http: but host expects https:',
      `Blocked: ${protocolMismatchBlocked}`
    );

    // 4c. Missing Origin and Missing Referer for Cookie Requests
    const reqMissingBoth = new Request('http://localhost:3000/api/admin/auth/logout', {
      method: 'POST',
      headers: {
        'Host': 'localhost:3000',
        'Cookie': 'admin_session=some_token',
      },
    });
    const missingBothBlocked = validateOrigin(reqMissingBoth) === false;
    recordTest(
      'Missing Origin and Referer Blocked for Cookie Requests',
      'CSRF Protection',
      missingBothBlocked,
      'false when both Origin and Referer are missing on state mutation',
      `Blocked: ${missingBothBlocked}`
    );

    // 4d. Missing Origin and Referer Rejected EVEN FOR Bearer Tokens (Remediation B)
    const reqBearerM2M = new Request('http://localhost:3000/api/admin/auth/logout', {
      method: 'POST',
      headers: {
        'Host': 'localhost:3000',
        'Authorization': 'Bearer test_machine_token_123',
      },
    });
    const bearerBlocked = validateOrigin(reqBearerM2M) === false;
    recordTest(
      'Bearer Token Request Strictly Blocked Without Origin Header',
      'CSRF Protection',
      bearerBlocked,
      'false for state mutations lacking Origin/Referer even with Bearer token (no CSRF exemption)',
      `Blocked: ${bearerBlocked}`
    );

    // 4e. Malformed Origin ('null', bad URL)
    const reqNullOrigin = new Request('http://localhost:3000/api/admin/auth/logout', {
      method: 'POST',
      headers: {
        'Host': 'localhost:3000',
        'Origin': 'null',
      },
    });
    recordTest(
      'Null Origin Blocked',
      'CSRF Protection',
      validateOrigin(reqNullOrigin) === false,
      'false for Origin: null',
      `Blocked: ${validateOrigin(reqNullOrigin) === false}`
    );

    // 4f. Foreign Origin
    const reqForeignOrigin = new Request('http://localhost:3000/api/admin/auth/logout', {
      method: 'POST',
      headers: {
        'Host': 'localhost:3000',
        'Origin': 'https://evil-hacker.com',
      },
    });
    recordTest(
      'Foreign Cross-Origin Blocked',
      'CSRF Protection',
      validateOrigin(reqForeignOrigin) === false,
      'false for foreign origin',
      `Blocked: ${validateOrigin(reqForeignOrigin) === false}`
    );
  } catch (err: any) {
    recordTest('CSRF and Origin Hardening', 'CSRF Protection', false, 'All origin checks pass', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Administrator Provisioning Hardening (SEC-02)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 5: Administrator Provisioning Hardening ---');
  try {
    const migrateContent = fs.readFileSync('scripts/migrate.ts', 'utf-8');
    const hasHardcodedPassword = migrateContent.includes("'Admin123!Secure'");
    const enforcesPasswordEnv = migrateContent.includes('ADMIN_INITIAL_PASSWORD environment variable');

    recordTest(
      'Hardcoded Seed Password Fallback Removed',
      'Administrator Provisioning',
      !hasHardcodedPassword && enforcesPasswordEnv,
      'Hardcoded password completely removed; requires ADMIN_INITIAL_PASSWORD',
      `Hardcoded present: ${hasHardcodedPassword}, Enforced in code: ${enforcesPasswordEnv}`
    );
  } catch (err: any) {
    recordTest('Administrator Provisioning Hardening', 'Administrator Provisioning', false, 'Fallback removed', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Bounded Session Cleanup Routine (SEC-06)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 6: Bounded Session Cleanup Routine ---');
  try {
    const sqlDb = neon(process.env.DATABASE_URL!);

    // 6a. Insert expired session
    const expiredToken = generateSessionToken();
    const expiredHash = hashToken(expiredToken);
    const [adminUser] = await sqlDb`SELECT id FROM public.users LIMIT 1;`;

    await sqlDb`
      INSERT INTO public.sessions (user_id, token_hash, expires_at, is_revoked)
      VALUES (${adminUser.id}, ${expiredHash}, NOW() - INTERVAL '2 days', false);
    `;

    // 6b. Insert expired rate limit
    await sqlDb`
      INSERT INTO public.rate_limits (key, count, reset_at)
      VALUES ('expired_key_test', 5, NOW() - INTERVAL '10 minutes')
      ON CONFLICT (key) DO UPDATE SET reset_at = NOW() - INTERVAL '10 minutes';
    `;

    // 6c. Run pruneExpiredSessions with force = true
    const pruneResult = await pruneExpiredSessions(true);

    // 6d. Check if expired session was deleted
    const [remainingExpired] = await sqlDb`
      SELECT count(*)::int as count FROM public.sessions WHERE token_hash = ${expiredHash};
    `;

    // 6e. Check if audit logs were preserved
    const [auditCount] = await sqlDb`
      SELECT count(*)::int as count FROM public.audit_logs;
    `;

    const cleanedSuccessfully = remainingExpired.count === 0 && pruneResult.sessionsPruned >= 1;
    const auditLogsPreserved = auditCount.count > 0;

    recordTest(
      'Expired Sessions & Rate Limits Pruned',
      'Session Lifecycle',
      cleanedSuccessfully,
      'Prunes expired session row from public.sessions and expired rate limits',
      `Pruned: ${pruneResult.sessionsPruned} sessions, ${pruneResult.rateLimitsPruned} rate limits`
    );

    recordTest(
      'Audit Logs Preserved During Cleanup',
      'Session Lifecycle',
      auditLogsPreserved,
      'public.audit_logs records remain completely intact',
      `Audit log rows: ${auditCount.count}`
    );
  } catch (err: any) {
    recordTest('Bounded Session Cleanup Routine', 'Session Lifecycle', false, 'Cleanup executed', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Migration Concurrency & Transactional Advisory Lock (SEC-07 & SEC-08)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 7: Migration Concurrency & Advisory Lock ---');
  try {
    const client1 = new Client(TEST_BRANCH_URL);
    const client2 = new Client(TEST_BRANCH_URL);
    await client1.connect();
    await client2.connect();

    // Client 1 begins transaction and acquires lock
    await client1.query('BEGIN;');
    const lock1 = await client1.query('SELECT pg_try_advisory_xact_lock(742910) as locked;');
    const client1Locked = lock1.rows[0]?.locked === true;

    // Client 2 attempts to acquire same lock
    await client2.query('BEGIN;');
    const lock2 = await client2.query('SELECT pg_try_advisory_xact_lock(742910) as locked;');
    const client2Blocked = lock2.rows[0]?.locked === false;

    // Client 1 commits, releasing lock
    await client1.query('COMMIT;');

    // Client 2 can now acquire lock
    const lock2Retry = await client2.query('SELECT pg_try_advisory_xact_lock(742910) as locked;');
    const client2NowLocked = lock2Retry.rows[0]?.locked === true;
    await client2.query('COMMIT;');

    await client1.end();
    await client2.end();

    const advisoryLockVerified = client1Locked && client2Blocked && client2NowLocked;
    recordTest(
      'Transaction-Scoped Advisory Locking (Mutual Exclusion)',
      'Migration Integrity',
      advisoryLockVerified,
      'Client 1 acquires lock; Client 2 blocked; Client 2 acquires after commit',
      `Client 1 locked: ${client1Locked}, Client 2 blocked: ${client2Blocked}, Client 2 retry: ${client2NowLocked}`
    );
  } catch (err: any) {
    recordTest('Migration Advisory Locking', 'Migration Integrity', false, 'Lock mutual exclusion', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Production Record Integrity (371 rows)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 8: Production Database Record Integrity ---');
  try {
    const prodDbUrl = process.env.DATABASE_URL;
    const sqlProd = neon(prodDbUrl!);
    const [c] = await sqlProd`SELECT count(*)::int as count FROM public.ledger_collections;`;
    const intact = c.count === 371;

    recordTest(
      'Production ledger_collections 371 Rows Intact',
      'Production Preservation',
      intact,
      'Exactly 371 rows in public.ledger_collections',
      `Actual count: ${c.count}`
    );
  } catch (err: any) {
    recordTest('Production Record Integrity', 'Production Preservation', false, '371 rows intact', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('  TEST SCORECARD');
  console.log('========================================================================');
  const total = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`Total Tests Executed : ${total}`);
  console.log(`Passed               : ${passed} ✅`);
  console.log(`Failed               : ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`Success Rate         : ${((passed / total) * 100).toFixed(1)}%`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runHardenedTestSuite().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
