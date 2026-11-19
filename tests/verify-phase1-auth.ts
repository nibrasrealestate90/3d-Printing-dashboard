import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as crypto from 'crypto';

if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is not set!');
  process.exit(1);
}
const sql = neon(dbUrl);

interface TestResult {
  name: string;
  category: string;
  status: 'PASS' | 'FAIL';
  expected: string;
  actual: string;
  details?: any;
}

const results: TestResult[] = [];

function recordTest(name: string, category: string, pass: boolean, expected: string, actual: string, details?: any) {
  const status: 'PASS' | 'FAIL' = pass ? 'PASS' : 'FAIL';
  results.push({ name, category, status, expected, actual, details });
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} [${category}] ${name}: ${status} (Actual: ${actual})`);
}

async function runSecurityTestSuite() {
  console.log('===============================================================');
  console.log('  PRINT STUDIO LEDGER — PHASE 1 SECURITY & AUTH TEST SUITE');
  console.log('===============================================================');
  console.log(`Target URL: ${BASE_URL}`);

  // Clean rate limits table before test suite to have a pristine state
  await sql`DELETE FROM public.rate_limits;`;

  // --------------------------------------------------------------------------
  // TEST 1: Successful Admin Login with Valid Credentials
  // --------------------------------------------------------------------------
  console.log('\n--- Test 1: Admin Login (Valid Credentials) ---');
  let sessionCookie = '';
  let rawSessionToken = '';
  try {
    const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@printstudio.ae',
        password: 'Admin123!Secure',
      }),
    });

    const setCookie = res.headers.get('set-cookie') || '';
    const data = await res.json();

    const is200 = res.status === 200;
    const hasUser = data.success === true && data.user?.email === 'admin@printstudio.ae';
    const hasCookie = setCookie.includes('admin_session=');

    if (hasCookie) {
      sessionCookie = setCookie.split(';')[0];
      rawSessionToken = sessionCookie.split('=')[1];
    }

    recordTest(
      'Valid Admin Login',
      'Authentication',
      is200 && hasUser && hasCookie,
      'HTTP 200 with user profile and session cookie',
      `HTTP ${res.status}, cookie: ${hasCookie ? 'present' : 'missing'}, role: ${data.user?.role}`
    );

    // Verify session in database
    if (rawSessionToken) {
      const tokenHash = crypto.createHash('sha256').update(rawSessionToken).digest('hex');
      const dbSessions = await sql`
        SELECT * FROM public.sessions WHERE token_hash = ${tokenHash};
      `;
      const sessionInDb = dbSessions.length === 1 && !dbSessions[0].is_revoked;
      recordTest(
        'Database Session Record Created',
        'Authentication',
        sessionInDb,
        'Active session row in public.sessions with SHA-256 token hash',
        sessionInDb ? `Found session ID: ${dbSessions[0].id}` : 'Session not found in DB'
      );
    }
  } catch (err: any) {
    recordTest('Valid Admin Login', 'Authentication', false, 'HTTP 200', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Rejection of Invalid Password
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Admin Login (Invalid Password) ---');
  try {
    const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@printstudio.ae',
        password: 'WrongPassword999!',
      }),
    });
    const data = await res.json();
    const is401 = res.status === 401;
    recordTest(
      'Invalid Password Rejection',
      'Security',
      is401 && data.error === 'Invalid email or password',
      'HTTP 401 Unauthorized with generic error message',
      `HTTP ${res.status}: "${data.error}"`
    );
  } catch (err: any) {
    recordTest('Invalid Password Rejection', 'Security', false, 'HTTP 401', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Rejection of Non-Existent User
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Admin Login (Non-existent User) ---');
  try {
    const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ghost@printstudio.ae',
        password: 'SomeRandomPassword123!',
      }),
    });
    const data = await res.json();
    const is401 = res.status === 401;
    recordTest(
      'Unknown User Rejection',
      'Security',
      is401 && data.error === 'Invalid email or password',
      'HTTP 401 Unauthorized with generic error message (no account enumeration)',
      `HTTP ${res.status}: "${data.error}"`
    );
  } catch (err: any) {
    recordTest('Unknown User Rejection', 'Security', false, 'HTTP 401', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Rate Limiting Enforcement (5 attempts allowed, 6th returns 429)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 4: Rate Limiter Enforcement ---');
  try {
    // Reset rate limits table before Test 4
    await sql`DELETE FROM public.rate_limits;`;

    let statuses: number[] = [];
    let retryAfterHeader: string | null = null;

    for (let i = 1; i <= 6; i++) {
      const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@printstudio.ae',
          password: `BadAttempt_${i}`,
        }),
      });
      statuses.push(res.status);
      if (res.status === 429) {
        retryAfterHeader = res.headers.get('retry-after');
      }
    }

    const first5Are401 = statuses.slice(0, 5).every(s => s === 401);
    const sixthIs429 = statuses[5] === 429;
    const hasRetryAfter = !!retryAfterHeader;

    recordTest(
      'Sliding Window Rate Limit (T-07)',
      'Security',
      first5Are401 && sixthIs429 && hasRetryAfter,
      'Attempts 1-5: HTTP 401; Attempt 6: HTTP 429 with Retry-After header',
      `Statuses: [${statuses.join(', ')}], Retry-After: ${retryAfterHeader}s`
    );

    // Clean up rate limits so subsequent tests can proceed
    await sql`DELETE FROM public.rate_limits;`;
  } catch (err: any) {
    recordTest('Sliding Window Rate Limit (T-07)', 'Security', false, 'HTTP 429 on 6th attempt', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Session Verification via /api/admin/auth/me
  // --------------------------------------------------------------------------
  console.log('\n--- Test 5: Session Verification (/api/admin/auth/me) ---');
  // 5a. Login fresh to get a valid token
  let validCookie = '';
  let validToken = '';
  try {
    const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@printstudio.ae',
        password: 'Admin123!Secure',
      }),
    });
    const setCookie = loginRes.headers.get('set-cookie') || '';
    validCookie = setCookie.split(';')[0];
    validToken = validCookie.split('=')[1];

    // Call /api/admin/auth/me with Cookie
    const meRes = await fetch(`${BASE_URL}/api/admin/auth/me`, {
      headers: { Cookie: validCookie },
    });
    const meData = await meRes.json();
    const is200 = meRes.status === 200 && meData.user?.email === 'admin@printstudio.ae';

    recordTest(
      'Authenticated Session Access (/api/admin/auth/me)',
      'Session Management',
      is200,
      'HTTP 200 with user profile and session timestamps',
      `HTTP ${meRes.status}, user: ${meData.user?.email}, role: ${meData.user?.role}`
    );

    // Call /api/admin/auth/me with Authorization Bearer header
    const bearerRes = await fetch(`${BASE_URL}/api/admin/auth/me`, {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    const bearerData = await bearerRes.json();
    const bearerIs200 = bearerRes.status === 200 && bearerData.user?.email === 'admin@printstudio.ae';

    recordTest(
      'Bearer Token Authentication',
      'Session Management',
      bearerIs200,
      'HTTP 200 with Bearer authorization header',
      `HTTP ${bearerRes.status}, user: ${bearerData.user?.email}`
    );

    // Call /api/admin/auth/me without credentials
    const unauthRes = await fetch(`${BASE_URL}/api/admin/auth/me`);
    recordTest(
      'Unauthenticated Access Rejection',
      'Security',
      unauthRes.status === 401,
      'HTTP 401 Unauthorized',
      `HTTP ${unauthRes.status}`
    );

    // Call with invalid/forged token
    const forgedRes = await fetch(`${BASE_URL}/api/admin/auth/me`, {
      headers: { Cookie: 'admin_session=forged_fake_token_1234567890' },
    });
    recordTest(
      'Forged Session Token Rejection',
      'Security',
      forgedRes.status === 401,
      'HTTP 401 Unauthorized',
      `HTTP ${forgedRes.status}`
    );
  } catch (err: any) {
    recordTest('Authenticated Session Access', 'Session Management', false, 'HTTP 200', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Session Revocation / Logout
  // --------------------------------------------------------------------------
  console.log('\n--- Test 6: Session Revocation & Logout ---');
  try {
    const logoutRes = await fetch(`${BASE_URL}/api/admin/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: validCookie,
        Origin: BASE_URL,
      },
    });

    const logoutData = await logoutRes.json();
    const logoutCookie = logoutRes.headers.get('set-cookie') || '';
    const isLogout200 = logoutRes.status === 200 && logoutData.success === true;
    const cookieCleared = logoutCookie.includes('Max-Age=0') || logoutCookie.includes('expires=');

    recordTest(
      'Logout Endpoint Execution',
      'Session Lifecycle',
      isLogout200 && cookieCleared,
      'HTTP 200 with cookie Max-Age=0',
      `HTTP ${logoutRes.status}, cookie cleared: ${cookieCleared}`
    );

    // Verify session revoked in database
    const tokenHash = crypto.createHash('sha256').update(validToken).digest('hex');
    const [revokedSession] = await sql`
      SELECT is_revoked FROM public.sessions WHERE token_hash = ${tokenHash};
    `;
    recordTest(
      'Database Session Status Revoked',
      'Session Lifecycle',
      revokedSession?.is_revoked === true,
      'public.sessions.is_revoked = TRUE',
      `is_revoked: ${revokedSession?.is_revoked}`
    );

    // Subsequent access with revoked session must be 401
    const postLogoutMe = await fetch(`${BASE_URL}/api/admin/auth/me`, {
      headers: { Cookie: validCookie },
    });
    recordTest(
      'Revoked Session Rejected on Reuse',
      'Security',
      postLogoutMe.status === 401,
      'HTTP 401 Unauthorized when presenting revoked token',
      `HTTP ${postLogoutMe.status}`
    );
  } catch (err: any) {
    recordTest('Session Revocation & Logout', 'Session Lifecycle', false, 'HTTP 200', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Audit Logging Verification
  // --------------------------------------------------------------------------
  console.log('\n--- Test 7: Audit Trail Verification ---');
  try {
    const auditEvents = await sql`
      SELECT action, entity_type, ip_address, details
      FROM public.audit_logs
      ORDER BY created_at DESC
      LIMIT 10;
    `;

    const actions = auditEvents.map(e => e.action);
    const hasLoginSuccess = actions.includes('LOGIN_SUCCESS');
    const hasLoginFailed = actions.includes('LOGIN_FAILED');
    const hasRateLimited = actions.includes('LOGIN_RATE_LIMITED');
    const hasLogout = actions.includes('LOGOUT');

    recordTest(
      'Audit Trail Logging',
      'Audit & Compliance',
      hasLoginSuccess && hasLoginFailed && hasRateLimited && hasLogout,
      'All security lifecycle events recorded in public.audit_logs',
      `Recorded events: ${Array.from(new Set(actions)).join(', ')}`
    );
  } catch (err: any) {
    recordTest('Audit Trail Logging', 'Audit & Compliance', false, 'Audit events in DB', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Existing Bambu & Production Endpoints Preservation (371 records)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 8: Existing Production System Preservation ---');
  let test8TokenHash = '';
  try {
    // Authenticate with valid administrator session for data verification
    const [adminUser] = await sql`SELECT id FROM public.users WHERE email = 'admin@printstudio.ae' LIMIT 1;`;
    const testRawToken = crypto.randomBytes(32).toString('base64url');
    test8TokenHash = crypto.createHash('sha256').update(testRawToken).digest('hex');
    await sql`
      INSERT INTO public.sessions (user_id, token_hash, expires_at)
      VALUES (${adminUser.id}, ${test8TokenHash}, NOW() + INTERVAL '1 hour');
    `;
    const authHeaders = { Cookie: `admin_session=${testRawToken}` };

    // 8a. GET /api/data?status=1
    const statusRes = await fetch(`${BASE_URL}/api/data?status=1`, { headers: authHeaders });
    const statusData = await statusRes.json();
    const status200 = statusRes.status === 200;
    const hasVersion = !!statusData.version;

    recordTest(
      'Existing /api/data?status=1 Unaltered',
      'Production Preservation',
      status200 && hasVersion,
      'HTTP 200 with collection summary and version timestamp',
      `HTTP ${statusRes.status}, version: ${statusData.version}`
    );

    // 8b. GET /api/data?collection=products
    const prodRes = await fetch(`${BASE_URL}/api/data?collection=products`, { headers: authHeaders });
    const prodData = await prodRes.json();
    const prodCount = prodData.items ? prodData.items.length : 0;
    recordTest(
      'Existing /api/data?collection=products Unaltered',
      'Production Preservation',
      prodRes.status === 200 && prodCount === 80,
      'HTTP 200 with exactly 80 products',
      `HTTP ${prodRes.status}, products: ${prodCount}`
    );

    // 8c. GET /api/data?collection=prints
    const printsRes = await fetch(`${BASE_URL}/api/data?collection=prints`, { headers: authHeaders });
    const printsData = await printsRes.json();
    const printsCount = printsData.items ? printsData.items.length : 0;
    recordTest(
      'Existing /api/data?collection=prints Unaltered',
      'Production Preservation',
      printsRes.status === 200 && printsCount === 221,
      'HTTP 200 with exactly 221 prints',
      `HTTP ${printsRes.status}, prints: ${printsCount}`
    );

    // 8d. GET /api/data?collection=filaments
    const filRes = await fetch(`${BASE_URL}/api/data?collection=filaments`, { headers: authHeaders });
    const filData = await filRes.json();
    const filCount = filData.items ? filData.items.length : 0;
    recordTest(
      'Existing /api/data?collection=filaments Unaltered',
      'Production Preservation',
      filRes.status === 200 && filCount === 34,
      'HTTP 200 with exactly 34 filaments',
      `HTTP ${filRes.status}, filaments: ${filCount}`
    );

    // 8e. GET /api/data (All collections grouped)
    const allRes = await fetch(`${BASE_URL}/api/data`, { headers: authHeaders });
    const allData = await allRes.json();
    const cols = allData.collections || {};
    const totalGrouped = (cols.products?.length || 0) +
                         (cols.prints?.length || 0) +
                         (cols.filaments?.length || 0) +
                         (cols.filament_stock?.length || 0) +
                         (cols.settings?.length || 0);

    recordTest(
      'Existing /api/data (All Grouped Collections)',
      'Production Preservation',
      allRes.status === 200 && totalGrouped === 371,
      'HTTP 200 with 371 total grouped records',
      `HTTP ${allRes.status}, total items across collections: ${totalGrouped}`
    );

    // 8f. Direct DB count verification for ledger_collections
    const [c] = await sql`SELECT count(*)::int as count FROM public.ledger_collections;`;
    if (test8TokenHash) {
      await sql`DELETE FROM public.sessions WHERE token_hash = ${test8TokenHash};`;
    }
    recordTest(
      'Database ledger_collections Record Integrity',
      'Production Preservation',
      c.count === 371,
      'Exactly 371 records in public.ledger_collections',
      `Actual count: ${c.count}`
    );
  } catch (err: any) {
    recordTest('Existing Production System Preservation', 'Production Preservation', false, 'All endpoints 200', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 9: CSRF & Origin Validation Security (T-06)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 9: CSRF & Origin Validation ---');
  try {
    const { validateOrigin } = await import('../src/lib/auth');

    // 9a. Matching host & origin
    const validReq = new Request('http://localhost:3000/api/data', {
      method: 'POST',
      headers: {
        'Host': 'localhost:3000',
        'Origin': 'http://localhost:3000',
      },
    });
    const validOriginPass = validateOrigin(validReq);
    recordTest(
      'Matching Origin Allowed',
      'CSRF Protection',
      validOriginPass === true,
      'validateOrigin returns true for identical host & origin',
      `Result: ${validOriginPass}`
    );

    // 9b. Mismatched origin (Cross-site attack)
    const attackReq = new Request('http://localhost:3000/api/data', {
      method: 'POST',
      headers: {
        'Host': 'localhost:3000',
        'Origin': 'https://attacker.evil.com',
      },
    });
    const attackBlocked = validateOrigin(attackReq) === false;
    recordTest(
      'Mismatched Origin Blocked (T-06)',
      'CSRF Protection',
      attackBlocked,
      'validateOrigin returns false for cross-origin mutation',
      `Blocked: ${attackBlocked}`
    );

    // 9c. Mismatched referer
    const badRefererReq = new Request('http://localhost:3000/api/data', {
      method: 'POST',
      headers: {
        'Host': 'localhost:3000',
        'Referer': 'https://phishing-site.org/malicious-link',
      },
    });
    const badRefererBlocked = validateOrigin(badRefererReq) === false;
    recordTest(
      'Mismatched Referer Blocked',
      'CSRF Protection',
      badRefererBlocked,
      'validateOrigin returns false for mismatched referer header',
      `Blocked: ${badRefererBlocked}`
    );
  } catch (err: any) {
    recordTest('CSRF & Origin Validation', 'CSRF Protection', false, 'Origin validation checks', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // Summary & Scorecard
  // --------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('  TEST EXECUTION SCORECARD');
  console.log('===============================================================');
  const total = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`Total Tests : ${total}`);
  console.log(`Passed      : ${passed} ✅`);
  console.log(`Failed      : ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log('===============================================================\n');

  if (failed > 0) {
    console.error('CRITICAL: Some security tests failed! See details above.');
    process.exit(1);
  } else {
    console.log('ALL PHASE 1 SECURITY TESTS PASSED PERFECTLY!');
  }
}

runSecurityTestSuite().catch(err => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
