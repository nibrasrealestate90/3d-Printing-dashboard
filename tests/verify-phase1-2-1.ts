import * as dotenv from 'dotenv';
import * as fs from 'fs';
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

import { neon } from '@neondatabase/serverless';
import * as crypto from 'crypto';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const sqlDb = neon(process.env.DATABASE_URL!);

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

async function runRemediationTestSuite() {
  const {
    extractClientIp,
    parseForwardedHeader,
    validateOrigin,
    checkRateLimit,
    resetRateLimit,
    getAccountThrottleDelay,
    recordAccountFailure,
    requireAdminSession,
    createAdminSession,
  } = await import('../src/lib/auth');

  console.log('========================================================================');
  console.log('  PRINT STUDIO LEDGER — PHASE 1.2.1 REMEDIATION VERIFICATION SUITE');
  console.log('========================================================================\n');

  // Clean rate limits before test suite starts
  await sqlDb`DELETE FROM public.rate_limits;`;

  // --------------------------------------------------------------------------
  // TEST 1: Progressive Throttle Schedule Bounded Verification
  // --------------------------------------------------------------------------
  console.log('--- Test 1: Progressive Throttle Schedule & Bounded Delay ---');
  try {
    const testEmail = `throttle_test_${Date.now()}@printstudio.ae`;
    const throttleKey = `auth_login_account:${testEmail}`;

    // Test 0 failures
    const delay0 = await getAccountThrottleDelay(throttleKey);
    recordTest(
      'Initial Throttle Delay is 0ms',
      'Remediation A',
      delay0.delayMs === 0 && delay0.failureCount === 0,
      '0ms delay for 0 failures',
      `${delay0.delayMs}ms (count: ${delay0.failureCount})`
    );

    // Record 3 failures
    await recordAccountFailure(throttleKey);
    await recordAccountFailure(throttleKey);
    await recordAccountFailure(throttleKey);
    const delay3 = await getAccountThrottleDelay(throttleKey);
    recordTest(
      '3rd Failure Throttle Delay is 100ms',
      'Remediation A',
      delay3.delayMs === 100 && delay3.failureCount === 3,
      '100ms delay for 3 failures',
      `${delay3.delayMs}ms (count: ${delay3.failureCount})`
    );

    // Record up to 5 failures
    await recordAccountFailure(throttleKey);
    await recordAccountFailure(throttleKey);
    const delay5 = await getAccountThrottleDelay(throttleKey);
    recordTest(
      '5th Failure Throttle Delay is 500ms',
      'Remediation A',
      delay5.delayMs === 500 && delay5.failureCount === 5,
      '500ms delay for 5 failures',
      `${delay5.delayMs}ms (count: ${delay5.failureCount})`
    );

    // Record up to 8 failures (cap at 2000ms)
    await recordAccountFailure(throttleKey);
    await recordAccountFailure(throttleKey);
    await recordAccountFailure(throttleKey);
    const delay8 = await getAccountThrottleDelay(throttleKey);
    recordTest(
      '8th Failure Throttle Strictly Bounded at 2000ms',
      'Remediation A',
      delay8.delayMs === 2000 && delay8.failureCount === 8,
      '2000ms delay capped (prevents gateway timeouts)',
      `${delay8.delayMs}ms (count: ${delay8.failureCount})`
    );

    // Clean up
    await resetRateLimit(throttleKey);
  } catch (err: any) {
    recordTest('Progressive Throttle Schedule', 'Remediation A', false, 'Valid backoff schedule', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Account-Lockout Resistance (10+ Failed Attempts Followed by Valid Login)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Account-Lockout Resistance (No DoS) ---');
  try {
    const adminEmail = 'admin@printstudio.ae';
    const accountThrottleKey = `auth_login_account:${adminEmail}`;

    // Clean rate limits
    await sqlDb`DELETE FROM public.rate_limits;`;

    // Attacker simulates 12 consecutive failed login attempts on the admin account
    // We record 12 failures directly to simulate attacker using distributed IPs
    for (let i = 1; i <= 12; i++) {
      await recordAccountFailure(accountThrottleKey);
    }

    const preState = await getAccountThrottleDelay(accountThrottleKey);
    recordTest(
      'Attacker Saturated Account Failures (12 failures)',
      'Remediation A',
      preState.failureCount === 12,
      'Account has 12 recorded failures',
      `Failures: ${preState.failureCount}`
    );

    // Now, legitimate administrator logs in from clean IP with valid credentials
    const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: adminEmail,
        password: process.env.ADMIN_INITIAL_PASSWORD || 'Admin123!Secure',
      }),
    });

    const loginData = await loginRes.json();
    const loginSuccess = loginRes.status === 200 && loginData.success === true;

    recordTest(
      'Legitimate Admin Succeeds After 12 Failed Attacker Attempts (No 429)',
      'Remediation A',
      loginSuccess,
      'HTTP 200 with session issued despite 12 previous failures',
      `Status: ${loginRes.status}, Success: ${loginData.success}`
    );

    // Verify account throttle counter was reset upon successful authentication
    const postState = await getAccountThrottleDelay(accountThrottleKey);
    recordTest(
      'Account Throttle Counter Reset on Admin Login',
      'Remediation A',
      postState.failureCount === 0 && postState.delayMs === 0,
      'Counter reset to 0 upon successful password verification',
      `Failures: ${postState.failureCount}, Delay: ${postState.delayMs}ms`
    );

    // Clean up
    await sqlDb`DELETE FROM public.rate_limits;`;
  } catch (err: any) {
    recordTest('Account-Lockout Resistance', 'Remediation A', false, 'Admin logs in successfully', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Strict CSRF Enforcement (Remediation B)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Strict CSRF Protection (Zero Bearer Exemptions) ---');
  try {
    // 3a: State mutation (POST) with Authorization: Bearer but NO Origin/Referer
    const reqBearerNoOrigin = new Request('http://localhost:3000/api/admin/auth/logout', {
      method: 'POST',
      headers: {
        'Host': 'localhost:3000',
        'Authorization': 'Bearer test_token_xyz',
      },
    });
    const bearerNoOriginBlocked = validateOrigin(reqBearerNoOrigin) === false;
    recordTest(
      'Bearer Token Request Blocked When Origin Absent (No CSRF Bypass)',
      'Remediation B',
      bearerNoOriginBlocked,
      'validateOrigin returns false (HTTP 403) for state mutation',
      `Blocked: ${bearerNoOriginBlocked}`
    );

    // 3b: State mutation (POST) with Authorization: Bearer and Foreign Origin
    const reqBearerEvilOrigin = new Request('http://localhost:3000/api/admin/auth/logout', {
      method: 'POST',
      headers: {
        'Host': 'localhost:3000',
        'Origin': 'https://evil-attacker.example.com',
        'Authorization': 'Bearer test_token_xyz',
      },
    });
    const bearerEvilBlocked = validateOrigin(reqBearerEvilOrigin) === false;
    recordTest(
      'Bearer Token Request Blocked With Foreign Cross-Origin',
      'Remediation B',
      bearerEvilBlocked,
      'validateOrigin returns false for evil-attacker.example.com',
      `Blocked: ${bearerEvilBlocked}`
    );

    // 3c: requireAdminSession integration test with Bearer and missing Origin
    const res = await requireAdminSession(reqBearerNoOrigin);
    const isForbiddenResponse = res instanceof Response && res.status === 403;
    recordTest(
      'requireAdminSession Returns HTTP 403 on Missing Origin',
      'Remediation B',
      isForbiddenResponse,
      'HTTP 403 response returned from guard',
      `Status: ${res instanceof Response ? res.status : 'Non-response'}`
    );

    // 3d: Safe method (GET) with Bearer token allowed without Origin
    const reqSafeGet = new Request('http://localhost:3000/api/admin/auth/me', {
      method: 'GET',
      headers: {
        'Host': 'localhost:3000',
        'Authorization': 'Bearer test_token_xyz',
      },
    });
    const getAllowed = validateOrigin(reqSafeGet) === true;
    recordTest(
      'Safe Idempotent GET Allowed Without Origin Header',
      'Remediation B',
      getAllowed,
      'validateOrigin returns true for GET requests',
      `Allowed: ${getAllowed}`
    );
  } catch (err: any) {
    recordTest('CSRF Strictness', 'Remediation B', false, 'Strict origin verification', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Trusted Reverse Proxy Right-to-Left Chain Walk (Remediation C)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 4: Right-to-Left Proxy Chain Walking ---');
  try {
    const trustedProxies = new Set(['10.0.0.1', '10.0.0.2', '127.0.0.1']);

    // Case 1: Simple single proxy hop
    const chain1 = '203.0.113.195, 10.0.0.1';
    const client1 = parseForwardedHeader(chain1, trustedProxies);
    recordTest(
      'Single Trusted Proxy Hop Extracts Untrusted Client',
      'Remediation C',
      client1 === '203.0.113.195',
      '203.0.113.195',
      `Parsed: ${client1}`
    );

    // Case 2: Multi-hop trusted proxies with spoofed prefix
    // Attacker sends: X-Forwarded-For: 1.1.1.1, 203.0.113.195
    // Proxy adds: 10.0.0.2, then edge proxy adds: 10.0.0.1
    // Full header seen by app: '1.1.1.1, 203.0.113.195, 10.0.0.2, 10.0.0.1'
    const chain2 = '1.1.1.1, 203.0.113.195, 10.0.0.2, 10.0.0.1';
    const client2 = parseForwardedHeader(chain2, trustedProxies);
    recordTest(
      'Multi-Hop Chain Walking Strips Trusted Proxies and Stops at Real Client',
      'Remediation C',
      client2 === '203.0.113.195',
      '203.0.113.195 (not spoofed 1.1.1.1)',
      `Parsed: ${client2}`
    );

    // Case 3: Malformed IP in chain
    const chainMalformed = '1.1.1.1, evil-host-injection, 10.0.0.1';
    const clientMalformed = parseForwardedHeader(chainMalformed, trustedProxies);
    recordTest(
      'Malformed Non-IP Token in Forwarded Chain Rejected',
      'Remediation C',
      clientMalformed === null,
      'null (rejected)',
      `Parsed: ${clientMalformed}`
    );
  } catch (err: any) {
    recordTest('Proxy Chain Walk', 'Remediation C', false, 'Valid chain walk', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Production Fail-Secure vs Local Development Fallback (Remediation C)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 5: Production Fail-Secure & Local Fallback ---');
  try {
    const origNodeEnv = process.env.NODE_ENV;
    const origTrustedProxy = process.env.TRUSTED_PROXY;
    const origCfIngress = process.env.CF_INGRESS_VERIFIED;

    // 5a: Production direct connection without proxy configuration throws
    (process.env as any).NODE_ENV = 'production';
    delete process.env.TRUSTED_PROXY;

    const reqProdDirect = new Request('https://app.printstudio.ae/api/admin/auth/login');
    let prodDirectThrew = false;
    let prodDirectMsg = '';
    try {
      extractClientIp(reqProdDirect);
    } catch (e: any) {
      prodDirectThrew = true;
      prodDirectMsg = e.message;
    }

    recordTest(
      'Production Without Verified Client IP Fails Securely',
      'Remediation C',
      prodDirectThrew && prodDirectMsg.includes('UNVERIFIED_CLIENT_IP'),
      'Throws UNVERIFIED_CLIENT_IP error (refuses shared 127.0.0.1 fallback)',
      `Threw: ${prodDirectThrew} (${prodDirectMsg.split(':')[0]})`
    );

    // 5b: Production Cloudflare mode without CF_INGRESS_VERIFIED throws
    process.env.TRUSTED_PROXY = 'cloudflare';
    process.env.CF_INGRESS_VERIFIED = 'false';

    let cfUnverifiedThrew = false;
    let cfUnverifiedMsg = '';
    try {
      extractClientIp(reqProdDirect);
    } catch (e: any) {
      cfUnverifiedThrew = true;
      cfUnverifiedMsg = e.message;
    }

    recordTest(
      'Production Cloudflare Mode Without Ingress Verification Fails Securely',
      'Remediation C',
      cfUnverifiedThrew && cfUnverifiedMsg.includes('CRITICAL_INGRESS_CONFIGURATION_ERROR'),
      'Throws CRITICAL_INGRESS_CONFIGURATION_ERROR',
      `Threw: ${cfUnverifiedThrew} (${cfUnverifiedMsg.split(':')[0]})`
    );

    // 5c: Local development direct connection safely returns loopback 127.0.0.1
    (process.env as any).NODE_ENV = 'development';
    delete process.env.TRUSTED_PROXY;
    delete process.env.CF_INGRESS_VERIFIED;

    const reqDevDirect = new Request('http://localhost:3000/api/admin/auth/login');
    const devIp = extractClientIp(reqDevDirect);
    recordTest(
      'Development Direct Connection Retains Safe 127.0.0.1 Loopback',
      'Remediation C',
      devIp === '127.0.0.1',
      '127.0.0.1',
      `Extracted: ${devIp}`
    );

    // Restore environment
    (process.env as any).NODE_ENV = origNodeEnv;
    if (origTrustedProxy !== undefined) process.env.TRUSTED_PROXY = origTrustedProxy;
    if (origCfIngress !== undefined) process.env.CF_INGRESS_VERIFIED = origCfIngress;
  } catch (err: any) {
    recordTest('Fail-Secure Behavior', 'Remediation C', false, 'Fails securely in prod', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Rate Limiting Isolation Between Distinct Client IPs
  // --------------------------------------------------------------------------
  console.log('\n--- Test 6: Rate Limiting Client IP Isolation ---');
  try {
    const origProxy = process.env.TRUSTED_PROXY;
    const origTrustedIps = process.env.TRUSTED_PROXY_IPS;
    process.env.TRUSTED_PROXY = 'true';
    process.env.TRUSTED_PROXY_IPS = '10.0.0.1';

    await sqlDb`DELETE FROM public.rate_limits;`;

    const ipA = '198.51.100.10';
    const ipB = '198.51.100.20';

    // Simulate 5 attempts from Client A
    for (let i = 1; i <= 5; i++) {
      await checkRateLimit(`auth_login_ip:${ipA}`, 5, 15 * 60 * 1000);
    }

    // 6th attempt for Client A is blocked
    const checkA = await checkRateLimit(`auth_login_ip:${ipA}`, 5, 15 * 60 * 1000);
    recordTest(
      'Client A Saturated IP Rate Limit Returns Blocked (HTTP 429 condition)',
      'Rate Limit Isolation',
      checkA.allowed === false && checkA.count === 6,
      'allowed: false on attempt 6',
      `allowed: ${checkA.allowed}, count: ${checkA.count}`
    );

    // 1st attempt for Client B from distinct IP is allowed
    const checkB = await checkRateLimit(`auth_login_ip:${ipB}`, 5, 15 * 60 * 1000);
    recordTest(
      'Client B Independent Quota Unaffected by Client A Lockout',
      'Rate Limit Isolation',
      checkB.allowed === true && checkB.count === 1,
      'allowed: true, count: 1',
      `allowed: ${checkB.allowed}, count: ${checkB.count}`
    );

    process.env.TRUSTED_PROXY = origProxy;
    process.env.TRUSTED_PROXY_IPS = origTrustedIps;
    await sqlDb`DELETE FROM public.rate_limits;`;
  } catch (err: any) {
    recordTest('Rate Limit Isolation', 'Rate Limit Isolation', false, 'Independent IP quotas', `Error: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // TEST SCORECARD
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('  PHASE 1.2.1 TEST SCORECARD');
  console.log('========================================================================');
  const total = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const rate = ((passed / total) * 100).toFixed(1);

  console.log(`Total Tests Executed : ${total}`);
  console.log(`Passed               : ${passed} ✅`);
  console.log(`Failed               : ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`Success Rate         : ${rate}%`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRemediationTestSuite().catch(err => {
  console.error('Fatal test suite failure:', err);
  process.exit(1);
});
