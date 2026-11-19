import http from 'http';
import crypto from 'crypto';
import { sql } from '../src/lib/db';

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
  console.log(
    ` ${passed ? '✅' : '❌'} [Req ${id}] ${name}: ${status} (Actual: ${actual})`
  );
}

function makeRequest(options: {
  hostname?: string;
  port?: number;
  path?: string;
  headers?: Record<string, string>;
  method?: string;
}): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: options.hostname || '127.0.0.1',
        port: options.port || 3000,
        path: options.path || '/',
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body,
          });
        });
      }
    );

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

async function runPhase21Verification() {
  console.log('========================================================================');
  console.log('  PRINT STUDIO LEDGER — PHASE 2.1 PROXY ROUTING VERIFICATION SUITE');
  console.log('========================================================================');

  let testSessionToken: string | null = null;
  let testTokenHash: string | null = null;

  try {
    if (sql) {
      try {
        const [adminUser] = await sql`SELECT id FROM public.users WHERE email = 'admin@printstudio.ae' LIMIT 1;`;
        if (adminUser) {
          testSessionToken = crypto.randomBytes(32).toString('base64url');
          testTokenHash = crypto.createHash('sha256').update(testSessionToken).digest('hex');
          await sql`
            INSERT INTO public.sessions (user_id, token_hash, expires_at, is_revoked)
            VALUES (${adminUser.id}, ${testTokenHash}, NOW() + INTERVAL '1 hour', false);
          `;
        }
      } catch (err: any) {
        console.warn('Could not provision test session for proxy suite:', err.message);
      }
    }

    const authHeaders: Record<string, string> = testSessionToken ? { Cookie: `admin_session=${testSessionToken}` } : {};

    // ------------------------------------------------------------------------
    // Test 1: Admin Hostname Resolves Correctly
    // ------------------------------------------------------------------------
    console.log('\n--- Test 1: Admin Hostname Routing ---');
    const resAdmin = await makeRequest({
      hostname: 'app.lvh.me',
      path: '/',
      headers: { Host: 'app.lvh.me:3000', ...authHeaders },
    });
    const isAdminSuccess =
      resAdmin.statusCode === 200 &&
      (resAdmin.headers['x-middleware-rewrite'] === '/admin' || resAdmin.body.includes('PrintStudioLedger') || resAdmin.body.includes('Print Studio Ledger'));
    recordTest(
      1,
      'Admin Hostname Resolves Correctly',
      'Hostname Routing',
      isAdminSuccess,
      'Status 200, rewrites to /admin',
      `Status: ${resAdmin.statusCode}, rewrite: ${resAdmin.headers['x-middleware-rewrite'] || 'N/A'}`
    );

    // ------------------------------------------------------------------------
    // Test 2: Store Hostname Resolves Correctly
    // ------------------------------------------------------------------------
    console.log('\n--- Test 2: Store Hostname Routing ---');
    const resStore = await makeRequest({
      hostname: 'www.lvh.me',
      path: '/',
      headers: { Host: 'www.lvh.me:3000' },
    });
    const isStoreSuccess =
      resStore.statusCode === 200 &&
      (resStore.headers['x-middleware-rewrite'] === '/store' || resStore.body.includes('Storefront'));
    recordTest(
      2,
      'Store Hostname Resolves Correctly',
      'Hostname Routing',
      isStoreSuccess,
      'Status 200, rewrites to /store',
      `Status: ${resStore.statusCode}, rewrite: ${resStore.headers['x-middleware-rewrite'] || 'N/A'}`
    );

    // ------------------------------------------------------------------------
    // Test 3: Localhost Retains Existing Behavior
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3: Localhost Behavior Preservation ---');
    const resLocalhost = await makeRequest({
      hostname: 'localhost',
      path: '/',
      headers: { Host: 'localhost:3000' },
    });
    const isLocalhostSuccess =
      resLocalhost.statusCode === 200 &&
      !resLocalhost.headers['x-middleware-rewrite'];
    recordTest(
      3,
      'Localhost Retains Existing Behavior',
      'Preservation',
      isLocalhostSuccess,
      'Status 200, direct pass-through (no rewrite)',
      `Status: ${resLocalhost.statusCode}, rewrite: ${resLocalhost.headers['x-middleware-rewrite'] || 'None'}`
    );

    // ------------------------------------------------------------------------
    // Test 4: Apex Redirects Correctly
    // ------------------------------------------------------------------------
    console.log('\n--- Test 4: Apex Hostname Canonical 308 Redirect ---');
    const resApex = await makeRequest({
      hostname: 'lvh.me',
      path: '/catalog?sort=price',
      headers: { Host: 'lvh.me:3000' },
    });
    const isApexSuccess =
      resApex.statusCode === 308 &&
      resApex.headers.location === 'http://www.lvh.me:3000/catalog?sort=price';
    recordTest(
      4,
      'Apex Redirects to Canonical Store Host',
      'Canonical Redirect',
      isApexSuccess,
      'Status 308, location: http://www.lvh.me:3000/catalog?sort=price',
      `Status: ${resApex.statusCode}, location: ${resApex.headers.location}`
    );

    // ------------------------------------------------------------------------
    // Test 5: Unknown Hostname is Rejected
    // ------------------------------------------------------------------------
    console.log('\n--- Test 5: Unknown Hostname Rejection (Default-Deny) ---');
    const resUnknown = await makeRequest({
      hostname: '127.0.0.1',
      path: '/',
      headers: { Host: 'evil-phishing.com' },
    });
    const isUnknownSuccess = resUnknown.statusCode === 400;
    recordTest(
      5,
      'Unknown Hostname is Rejected',
      'Perimeter Security',
      isUnknownSuccess,
      'Status 400 Bad Request',
      `Status: ${resUnknown.statusCode}, body: "${resUnknown.body.trim()}"`
    );

    // ------------------------------------------------------------------------
    // Test 6: Direct IP Access is Rejected
    // ------------------------------------------------------------------------
    console.log('\n--- Test 6: Direct IP Access Rejection ---');
    const resIp = await makeRequest({
      hostname: '127.0.0.1',
      path: '/',
      headers: { Host: '127.0.0.1:3000' },
    });
    const isIpSuccess = resIp.statusCode === 400;
    recordTest(
      6,
      'Direct IP Access is Rejected',
      'Perimeter Security',
      isIpSuccess,
      'Status 400 Bad Request',
      `Status: ${resIp.statusCode}, body: "${resIp.body.trim()}"`
    );

    // ------------------------------------------------------------------------
    // Test 7: Ports Handled Correctly
    // ------------------------------------------------------------------------
    console.log('\n--- Test 7: Port Parsing Resilience ---');
    const resWithPort = await makeRequest({
      hostname: 'app.lvh.me',
      path: '/',
      headers: { Host: 'app.lvh.me:3000', ...authHeaders },
    });
    const resWithoutPort = await makeRequest({
      hostname: 'app.lvh.me',
      path: '/',
      headers: { Host: 'app.lvh.me', ...authHeaders },
    });
    const isPortSuccess =
      resWithPort.statusCode === 200 && resWithoutPort.statusCode === 200;
    recordTest(
      7,
      'Ports Handled Correctly (With and Without Port)',
      'Hostname Parsing',
      isPortSuccess,
      'Both resolve with status 200',
      `With port: ${resWithPort.statusCode}, Without port: ${resWithoutPort.statusCode}`
    );

    // ------------------------------------------------------------------------
    // Test 8: Untrusted Forwarded-Host Headers Ignored
    // ------------------------------------------------------------------------
    console.log('\n--- Test 8: Forwarded-Host Spoofing Defense ---');
    const resSpoofed = await makeRequest({
      hostname: '127.0.0.1',
      path: '/',
      headers: {
        Host: 'unauthorized-domain.com',
        'X-Forwarded-Host': 'app.lvh.me:3000',
        'X-Forwarded-Proto': 'https',
      },
    });
    const isSpoofedSuccess = resSpoofed.statusCode === 400;
    recordTest(
      8,
      'Untrusted Forwarded-Host Headers Ignored',
      'Host Header Security',
      isSpoofedSuccess,
      'Status 400 Bad Request (evaluated raw Host header only)',
      `Status: ${resSpoofed.statusCode}, body: "${resSpoofed.body.trim()}"`
    );

    // ------------------------------------------------------------------------
    // Test 9: Login Routes Remain Accessible
    // ------------------------------------------------------------------------
    console.log('\n--- Test 9: Login Route Availability ---');
    const resLoginApp = await makeRequest({
      hostname: 'app.lvh.me',
      path: '/login',
      headers: { Host: 'app.lvh.me:3000' },
    });
    const resAdminLoginApp = await makeRequest({
      hostname: 'app.lvh.me',
      path: '/admin/login',
      headers: { Host: 'app.lvh.me:3000' },
    });
    const resLoginLocal = await makeRequest({
      hostname: 'localhost',
      path: '/login',
      headers: { Host: 'localhost:3000' },
    });
    const isLoginSuccess =
      resLoginApp.statusCode === 200 &&
      resAdminLoginApp.statusCode === 200 &&
      resLoginLocal.statusCode === 200;
    recordTest(
      9,
      'Login Routes Remain Accessible',
      'Functional Routing',
      isLoginSuccess,
      'All login routes return status 200',
      `/login on app: ${resLoginApp.statusCode}, /admin/login on app: ${resAdminLoginApp.statusCode}, /login on local: ${resLoginLocal.statusCode}`
    );

    // ------------------------------------------------------------------------
    // Test 10: Auth API Routes Remain Reachable
    // ------------------------------------------------------------------------
    console.log('\n--- Test 10: Auth API Route Reachability ---');
    const resAuthMe = await makeRequest({
      hostname: 'app.lvh.me',
      path: '/api/admin/auth/me',
      headers: { Host: 'app.lvh.me:3000' },
    });
    const isAuthSuccess = resAuthMe.statusCode === 401; // Expected 401 Unauthorized for unauthenticated request
    recordTest(
      10,
      'Auth API Routes Remain Reachable',
      'API Routing',
      isAuthSuccess,
      'Status 401 Unauthorized (API reached and responded with valid auth rejection)',
      `Status: ${resAuthMe.statusCode}, content-type: ${resAuthMe.headers['content-type']}`
    );

    // ------------------------------------------------------------------------
    // Test 11: No Redirect Loops
    // ------------------------------------------------------------------------
    console.log('\n--- Test 11: Redirect Loop Prevention ---');
    const resApexHop1 = await makeRequest({
      hostname: 'lvh.me',
      path: '/',
      headers: { Host: 'lvh.me:3000' },
    });
    const resStoreHop2 = await makeRequest({
      hostname: 'www.lvh.me',
      path: '/',
      headers: { Host: 'www.lvh.me:3000' },
    });
    const isLoopFree =
      resApexHop1.statusCode === 308 && resStoreHop2.statusCode === 200;
    recordTest(
      11,
      'No Redirect Loops (Apex Settles in 1 Hop)',
      'Routing Safety',
      isLoopFree,
      'Hop 1 is 308 -> Hop 2 is 200 (terminal)',
      `Hop 1: ${resApexHop1.statusCode} -> Hop 2: ${resStoreHop2.statusCode}`
    );

    // ------------------------------------------------------------------------
    // Test 12: No Open Redirects
    // ------------------------------------------------------------------------
    console.log('\n--- Test 12: Open Redirect Defense ---');
    const resOpenRedirect = await makeRequest({
      hostname: 'lvh.me',
      path: '/?redirect=https://evil.com&url=https://attacker.com',
      headers: { Host: 'lvh.me:3000' },
    });
    const locationHeader = resOpenRedirect.headers.location || '';
    const isOpenRedirectSafe =
      locationHeader.startsWith('http://www.lvh.me:3000/') &&
      !locationHeader.startsWith('https://evil.com') &&
      !locationHeader.startsWith('//evil.com');
    recordTest(
      12,
      'No Open Redirects via Query Parameters',
      'Security Boundary',
      isOpenRedirectSafe,
      'Redirect location bound strictly to canonical domain',
      `Location: ${locationHeader}`
    );

    // ------------------------------------------------------------------------
    // Test 13: Private Pages Not Exposed on Store Hostname
    // ------------------------------------------------------------------------
    console.log('\n--- Test 13: Store Hostname Perimeter Isolation ---');
    const resStoreAdmin = await makeRequest({
      hostname: 'www.lvh.me',
      path: '/admin',
      headers: { Host: 'www.lvh.me:3000' },
    });
    const resStoreData = await makeRequest({
      hostname: 'www.lvh.me',
      path: '/api/data',
      headers: { Host: 'www.lvh.me:3000' },
    });
    const resStoreBambu = await makeRequest({
      hostname: 'www.lvh.me',
      path: '/api/bambu/sync',
      headers: { Host: 'www.lvh.me:3000' },
    });
    const isStoreIsolated =
      resStoreAdmin.statusCode === 404 &&
      resStoreData.statusCode === 404 &&
      resStoreBambu.statusCode === 404;
    recordTest(
      13,
      'Private Pages & APIs Not Exposed on Store Hostname',
      'Subdomain Isolation',
      isStoreIsolated,
      'All return HTTP 404 Not Found on www.lvh.me:3000',
      `/admin: ${resStoreAdmin.statusCode}, /api/data: ${resStoreData.statusCode}, /api/bambu: ${resStoreBambu.statusCode}`
    );

    // ------------------------------------------------------------------------
    // Test 14: Manufacturing Dashboard Loads on App Hostname
    // ------------------------------------------------------------------------
    console.log('\n--- Test 14: Manufacturing Dashboard on App Hostname ---');
    const resAppDashboard = await makeRequest({
      hostname: 'app.lvh.me',
      path: '/',
      headers: { Host: 'app.lvh.me:3000', ...authHeaders },
    });
    const hasDashboardContent =
      resAppDashboard.statusCode === 200 &&
      (resAppDashboard.body.includes('PrintStudioLedger') ||
       resAppDashboard.body.includes('Print Studio Ledger') ||
       resAppDashboard.body.includes('admin/page.tsx'));
    recordTest(
      14,
      'Manufacturing Dashboard Loads on App Hostname',
      'System Preservation',
      hasDashboardContent,
      'Status 200 with dashboard artifacts present in HTML stream',
      `Status: ${resAppDashboard.statusCode}, HTML bytes: ${resAppDashboard.body.length}`
    );

    // ------------------------------------------------------------------------
    // Test 15: Bambu Sync Endpoint Remains Unchanged
    // ------------------------------------------------------------------------
    console.log('\n--- Test 15: Bambu Sync Endpoint Behavioral Invariant ---');
    const resBambuSync = await makeRequest({
      hostname: 'app.lvh.me',
      path: '/api/bambu/sync',
      headers: { Host: 'app.lvh.me:3000' },
    });
    const isBambuUnchanged =
      (resBambuSync.statusCode === 401 || resBambuSync.statusCode === 200) &&
      resBambuSync.headers['content-type']?.includes('application/json');
    recordTest(
      15,
      'Bambu Sync Endpoint Behaviorally Unchanged (Reachable & Protected)',
      'System Preservation',
      Boolean(isBambuUnchanged),
      'Status 401 (Protected) or 200 with application/json response',
      `Status: ${resBambuSync.statusCode}, Content-Type: ${resBambuSync.headers['content-type']}`
    );

    // ------------------------------------------------------------------------
    // Scorecard
    // ------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log('  PHASE 2.1 TEST SCORECARD');
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
    console.error('Fatal test error in verify-phase2-proxy:', err);
    process.exit(1);
  } finally {
    if (sql && testTokenHash) {
      await sql`DELETE FROM public.sessions WHERE token_hash = ${testTokenHash};`.catch(() => {});
    }
  }
}

runPhase21Verification().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
