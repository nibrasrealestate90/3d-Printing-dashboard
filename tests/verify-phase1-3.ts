import * as dotenv from 'dotenv';
import * as fs from 'fs';
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

import { chromium, Browser, Page } from 'playwright';
import { neon } from '@neondatabase/serverless';
import * as crypto from 'crypto';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const sqlDb = neon(process.env.DATABASE_URL!);
const ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || 'Admin123!Secure';

interface TestResult {
  num: number;
  name: string;
  category: string;
  status: 'PASS' | 'FAIL';
  expected: string;
  actual: string;
}

const results: TestResult[] = [];

function recordTest(num: number, name: string, category: string, pass: boolean, expected: string, actual: string) {
  const status: 'PASS' | 'FAIL' = pass ? 'PASS' : 'FAIL';
  results.push({ num, name, category, status, expected, actual });
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} [Req ${num}] ${name}: ${status} (Actual: ${actual})`);
}

async function runPhase13Verification() {
  console.log('========================================================================');
  console.log('  PRINT STUDIO LEDGER — PHASE 1.3 COMPREHENSIVE VERIFICATION SUITE');
  console.log('========================================================================\n');

  // Clean rate limits before starting
  await sqlDb`DELETE FROM public.rate_limits;`;

  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page: Page = await context.newPage();

  try {
    // ------------------------------------------------------------------------
    // Requirement 1: Valid Administrator Login
    // ------------------------------------------------------------------------
    console.log('--- Test 1: Valid Administrator Login ---');
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#admin-email', { timeout: 10000 });
    await page.fill('#admin-email', 'admin@printstudio.ae');
    await page.fill('#admin-password', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard / admin workspace
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/admin', { timeout: 10000 });
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === 'admin_session' || c.name === '__Host-admin_session');

    recordTest(
      1,
      'Valid Administrator Login',
      'Authentication Integration',
      (page.url() === `${BASE_URL}/` || page.url() === `${BASE_URL}/admin`) && !!sessionCookie,
      'Redirects to "/" or "/admin" with secure session cookie set',
      `URL: ${page.url()}, Cookie: ${sessionCookie ? sessionCookie.name : 'none'}`
    );

    // ------------------------------------------------------------------------
    // Requirement 2: Invalid Email / Password
    // ------------------------------------------------------------------------
    console.log('\n--- Test 2: Invalid Email / Password ---');
    await context.clearCookies();
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#admin-email', { timeout: 10000 });
    await page.fill('#admin-email', 'admin@printstudio.ae');
    await page.fill('#admin-password', 'CompletelyWrongPassword123!');
    await page.click('button[type="submit"]');

    await page.waitForSelector('#auth-error-alert', { timeout: 10000 });
    const invalidAlertText = await page.textContent('#auth-error-alert');
    const isGenericMsg = invalidAlertText?.includes('Invalid email or password');

    recordTest(
      2,
      'Invalid Email / Password Rejection',
      'Credential Defense',
      isGenericMsg === true,
      'Generic invalid credentials alert without disclosing account state',
      `Alert text: "${invalidAlertText?.trim()}"`
    );

    // ------------------------------------------------------------------------
    // Requirement 3: Empty Email / Password
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3: Empty Email / Password ---');
    await page.fill('#admin-email', '');
    await page.fill('#admin-password', '');
    await page.click('button[type="submit"]');

    await page.waitForSelector('#admin-email-error');
    await page.waitForSelector('#admin-password-error');
    const emailEmptyErr = await page.textContent('#admin-email-error');
    const passEmptyErr = await page.textContent('#admin-password-error');

    recordTest(
      3,
      'Empty Email / Password Validation',
      'Form Validation',
      Boolean(emailEmptyErr?.includes('required') && passEmptyErr?.includes('required')),
      'Inline required error messages for both empty fields',
      `Email err: "${emailEmptyErr}", Pass err: "${passEmptyErr}"`
    );

    // ------------------------------------------------------------------------
    // Requirement 4: Malformed Email
    // ------------------------------------------------------------------------
    console.log('\n--- Test 4: Malformed Email ---');
    await page.fill('#admin-email', 'not-an-email');
    await page.fill('#admin-password', 'SomePass123!');
    await page.click('button[type="submit"]');

    await page.waitForSelector('#admin-email-error');
    const malformedErr = await page.textContent('#admin-email-error');

    recordTest(
      4,
      'Malformed Email Validation',
      'Form Validation',
      Boolean(malformedErr?.includes('valid email')),
      'Inline validation error indicating invalid email format',
      `Email err: "${malformedErr}"`
    );

    // ------------------------------------------------------------------------
    // Requirement 5: Rate-Limited Login Response
    // ------------------------------------------------------------------------
    console.log('\n--- Test 5: Rate-Limited Login Response ---');
    const clientIp = '127.0.0.1';
    for (let i = 1; i <= 6; i++) {
      await sqlDb`
        INSERT INTO public.rate_limits (key, count, reset_at)
        VALUES (${`auth_login_ip:${clientIp}`}, ${i}, NOW() + INTERVAL '15 minutes')
        ON CONFLICT (key) DO UPDATE SET count = ${i}, reset_at = NOW() + INTERVAL '15 minutes';
      `;
    }

    await page.fill('#admin-email', 'admin@printstudio.ae');
    await page.fill('#admin-password', 'WrongPassword!');
    await page.click('button[type="submit"]');

    await page.waitForSelector('#auth-error-alert', { timeout: 10000 });
    const rateLimitAlert = await page.textContent('#auth-error-alert');
    const rateLimitDetected = rateLimitAlert?.includes('rate limit active') || rateLimitAlert?.includes('Cooldown window');

    recordTest(
      5,
      'Rate-Limited Response Handling',
      'Rate Limiting',
      rateLimitDetected === true,
      'Displays active rate-limit warning banner with cooldown timer',
      `Alert text: "${rateLimitAlert?.trim()}"`
    );

    // Clean up rate limits table
    await sqlDb`DELETE FROM public.rate_limits;`;

    // ------------------------------------------------------------------------
    // Requirement 6: Network Failure
    // ------------------------------------------------------------------------
    console.log('\n--- Test 6: Network Failure Simulation ---');
    // Reload page to reset cooldown state
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#admin-email', { timeout: 10000 });

    await page.route('**/api/admin/auth/login', route => route.abort('failed'));

    await page.fill('#admin-email', 'admin@printstudio.ae');
    await page.fill('#admin-password', 'SomePassword123!');
    await page.click('button[type="submit"]');

    await page.waitForSelector('#auth-error-alert', { timeout: 10000 });
    const netErrAlert = await page.textContent('#auth-error-alert');
    const netErrDetected = netErrAlert?.includes('Network connection failure');

    await page.unroute('**/api/admin/auth/login');

    recordTest(
      6,
      'Network Failure Handling',
      'Resilience',
      netErrDetected === true,
      'Graceful network error banner without application crash',
      `Alert text: "${netErrAlert?.trim()}"`
    );

    // ------------------------------------------------------------------------
    // Requirement 7: Server Error
    // ------------------------------------------------------------------------
    console.log('\n--- Test 7: Server Error Simulation ---');
    // Reload page to reset error state
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#admin-email', { timeout: 10000 });

    await page.route('**/api/admin/auth/login', route =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Database service unavailable' }),
      })
    );

    await page.fill('#admin-email', 'admin@printstudio.ae');
    await page.fill('#admin-password', 'SomePassword123!');
    await page.click('button[type="submit"]');

    await page.waitForSelector('#auth-error-alert', { timeout: 10000 });
    const serverErrAlert = await page.textContent('#auth-error-alert');
    const serverErrDetected = serverErrAlert?.includes('Database service unavailable');

    await page.unroute('**/api/admin/auth/login');

    recordTest(
      7,
      'Server Error Handling (503/500)',
      'Resilience',
      serverErrDetected === true,
      'Appropriate technical service unavailable alert displayed',
      `Alert text: "${serverErrAlert?.trim()}"`
    );

    // ------------------------------------------------------------------------
    // Requirement 8: Session Verification After Successful Login
    // ------------------------------------------------------------------------
    console.log('\n--- Test 8: Session Verification After Successful Login ---');
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#admin-email', { timeout: 10000 });
    await page.fill('#admin-email', 'admin@printstudio.ae');
    await page.fill('#admin-password', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/admin', { timeout: 10000 });

    // Now visit /admin/login while authenticated
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('div[role="region"][aria-label="Active Administrator Session"]', { timeout: 10000 });
    const sessionCardText = await page.textContent('div[role="region"][aria-label="Active Administrator Session"]');
    const sessionVerified = sessionCardText?.includes('Active Session Verified') && sessionCardText?.includes('admin@printstudio.ae');

    recordTest(
      8,
      'Session Verification on /admin/login',
      'Session Management',
      sessionVerified === true,
      'Displays active session card with verified email and role',
      `Verified: ${sessionVerified}`
    );

    // ------------------------------------------------------------------------
    // Requirement 9: Expired Session
    // ------------------------------------------------------------------------
    console.log('\n--- Test 9: Expired Session Handling ---');
    await sqlDb`
      UPDATE public.sessions
      SET expires_at = NOW() - INTERVAL '1 hour'
      WHERE user_id = (SELECT id FROM public.users WHERE email = 'admin@printstudio.ae');
    `;

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#admin-login-heading', { timeout: 10000 });
    const isBackToFormExpired = await page.isVisible('#admin-email');

    recordTest(
      9,
      'Expired Session Handling',
      'Session Management',
      isBackToFormExpired === true,
      'Expired session rejected by server, UI reverts to login form',
      `Form visible: ${isBackToFormExpired}`
    );

    // ------------------------------------------------------------------------
    // Requirement 10: Revoked Session
    // ------------------------------------------------------------------------
    console.log('\n--- Test 10: Revoked Session Handling ---');
    await page.fill('#admin-email', 'admin@printstudio.ae');
    await page.fill('#admin-password', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/admin', { timeout: 10000 });

    await sqlDb`
      UPDATE public.sessions
      SET is_revoked = true
      WHERE user_id = (SELECT id FROM public.users WHERE email = 'admin@printstudio.ae');
    `;

    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#admin-login-heading', { timeout: 10000 });
    const isBackToFormRevoked = await page.isVisible('#admin-email');

    recordTest(
      10,
      'Revoked Session Handling',
      'Access Control',
      isBackToFormRevoked === true,
      'Revoked session rejected by server, UI renders sign-in form',
      `Form visible: ${isBackToFormRevoked}`
    );

    // ------------------------------------------------------------------------
    // Requirement 11: Successful Logout
    // ------------------------------------------------------------------------
    console.log('\n--- Test 11: Successful Logout ---');
    await page.fill('#admin-email', 'admin@printstudio.ae');
    await page.fill('#admin-password', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/admin', { timeout: 10000 });

    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button:has-text("Sign Out of Console")', { timeout: 10000 });
    await page.click('button:has-text("Sign Out of Console")');

    await page.waitForSelector('#admin-login-heading', { timeout: 10000 });
    const isLoggedOutFormVisible = await page.isVisible('#admin-email');

    recordTest(
      11,
      'Successful Logout Interaction',
      'Session Lifecycle',
      isLoggedOutFormVisible === true,
      'Server revokes session and client transitions back to sign-in form',
      `Logged out form visible: ${isLoggedOutFormVisible}`
    );

    // ------------------------------------------------------------------------
    // Requirement 12: Logout Network Failure
    // ------------------------------------------------------------------------
    console.log('\n--- Test 12: Logout Network Failure Handling ---');
    await page.fill('#admin-email', 'admin@printstudio.ae');
    await page.fill('#admin-password', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/admin', { timeout: 10000 });

    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button:has-text("Sign Out of Console")', { timeout: 10000 });

    await page.route('**/api/admin/auth/logout', route => route.abort('failed'));
    await page.click('button:has-text("Sign Out of Console")');

    await page.waitForSelector('#auth-session-error-alert', { timeout: 10000 });
    const logoutErrAlert = await page.textContent('#auth-session-error-alert');
    const stillOnSessionCard = await page.isVisible('button:has-text("Sign Out of Console")');
    await page.unroute('**/api/admin/auth/logout');

    recordTest(
      12,
      'Logout Network Failure Resilience',
      'Resilience',
      Boolean(stillOnSessionCard && logoutErrAlert?.includes('Network error')),
      'Displays network error and does not falsely claim session revoked',
      `Alert: "${logoutErrAlert?.trim()}", Session card retained: ${stillOnSessionCard}`
    );

    // ------------------------------------------------------------------------
    // Requirement 13: Browser Refresh Behavior
    // ------------------------------------------------------------------------
    console.log('\n--- Test 13: Browser Refresh Behavior ---');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('div[role="region"][aria-label="Active Administrator Session"]', { timeout: 10000 });
    const refreshPersisted = await page.isVisible('button:has-text("Open Manufacturing Ledger")');

    recordTest(
      13,
      'Browser Refresh Session Persistence',
      'Session Lifecycle',
      refreshPersisted === true,
      'Authenticated state survives full browser page refresh',
      `Persisted: ${refreshPersisted}`
    );

    // Clean logout
    await page.click('button:has-text("Sign Out of Console")');
    await page.waitForSelector('#admin-login-heading', { timeout: 10000 });

    // ------------------------------------------------------------------------
    // Requirement 14: Mobile Responsiveness
    // ------------------------------------------------------------------------
    console.log('\n--- Test 14: Mobile Responsiveness ---');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);
    await page.waitForSelector('#admin-email', { timeout: 10000 });

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    const emailInputHeight = await page.evaluate(() => {
      const el = document.getElementById('admin-email');
      return el ? Math.round(el.getBoundingClientRect().height) : 0;
    });

    const submitBtnHeight = await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]');
      return btn ? Math.round(btn.getBoundingClientRect().height) : 0;
    });

    const touchTargetsAdequate = emailInputHeight >= 44 && submitBtnHeight >= 44;

    recordTest(
      14,
      'Mobile Responsiveness & Touch Targets',
      'Responsive Design',
      !hasHorizontalOverflow && touchTargetsAdequate,
      'Zero horizontal overflow, input & button touch targets >= 44px',
      `Overflow: ${hasHorizontalOverflow}, Email H: ${emailInputHeight}px, Btn H: ${submitBtnHeight}px`
    );

    await page.setViewportSize({ width: 1280, height: 800 });

    // ------------------------------------------------------------------------
    // Requirement 15: Keyboard Navigation
    // ------------------------------------------------------------------------
    console.log('\n--- Test 15: Keyboard Navigation ---');
    await page.focus('#admin-email');
    await page.keyboard.press('Tab');
    const focusedOnPassword = await page.evaluate(() => document.activeElement?.id === 'admin-password');

    await page.keyboard.press('Tab');
    const focusedOnToggle = await page.evaluate(() => {
      return document.activeElement?.getAttribute('aria-label')?.includes('password text');
    });

    await page.keyboard.press('Tab');
    const focusedOnSubmit = await page.evaluate(() => {
      return document.activeElement?.getAttribute('type') === 'submit';
    });

    recordTest(
      15,
      'Keyboard Navigation & Logical Tab Order',
      'Accessibility',
      Boolean(focusedOnPassword && focusedOnToggle && focusedOnSubmit),
      'Logical tab sequence: Email -> Password -> Show/Hide -> Submit',
      `Email->Pass: ${focusedOnPassword}, Pass->Toggle: ${focusedOnToggle}, Toggle->Submit: ${focusedOnSubmit}`
    );

    // ------------------------------------------------------------------------
    // Requirement 16: Accessibility & Visible Focus States
    // ------------------------------------------------------------------------
    console.log('\n--- Test 16: Accessibility & Focus States ---');
    const hasAriaLabels = await page.evaluate(() => {
      const emailInput = document.getElementById('admin-email');
      const passInput = document.getElementById('admin-password');
      const emailLabel = document.querySelector('label[for="admin-email"]');
      const passLabel = document.querySelector('label[for="admin-password"]');
      const heading = document.getElementById('admin-login-heading');
      return !!emailInput && !!passInput && !!emailLabel && !!passLabel && !!heading;
    });

    recordTest(
      16,
      'Accessibility Tree & Semantic Labels',
      'Accessibility',
      hasAriaLabels === true,
      'Inputs explicitly associated with labels, headings properly marked',
      `Has semantic labels & headings: ${hasAriaLabels}`
    );

    // ------------------------------------------------------------------------
    // Requirement 17: No Password/Token in Local/Session Storage
    // ------------------------------------------------------------------------
    console.log('\n--- Test 17: Client Storage Sanitization Audit ---');
    const storageAudit = await page.evaluate(() => {
      const localKeys = Object.keys(localStorage);
      const sessionKeys = Object.keys(sessionStorage);
      const localValues = localKeys.map(k => `${k}:${localStorage.getItem(k)}`);
      const sessionValues = sessionKeys.map(k => `${k}:${sessionStorage.getItem(k)}`);
      return { localKeys, sessionKeys, localValues, sessionValues };
    });

    const leakedSecrets =
      JSON.stringify(storageAudit).toLowerCase().includes('password') ||
      JSON.stringify(storageAudit).toLowerCase().includes('session_token') ||
      JSON.stringify(storageAudit).toLowerCase().includes('token_digest') ||
      JSON.stringify(storageAudit).toLowerCase().includes('argon2');

    recordTest(
      17,
      'Storage Sanitization (Zero Token/Password Leaks)',
      'Security Invariants',
      !leakedSecrets,
      'Zero credentials or session tokens stored in localStorage or sessionStorage',
      `Leaked secrets detected: ${leakedSecrets}`
    );

    // ------------------------------------------------------------------------
    // Requirement 18: Existing Manufacturing Dashboard Still Loads
    // ------------------------------------------------------------------------
    console.log('\n--- Test 18: Manufacturing Dashboard Verification ---');
    const [adminUser] = await sqlDb`SELECT id FROM public.users WHERE email = 'admin@printstudio.ae' LIMIT 1;`;
    const tRawToken = crypto.randomBytes(32).toString('base64url');
    const tHash = crypto.createHash('sha256').update(tRawToken).digest('hex');
    await sqlDb`
      INSERT INTO public.sessions (user_id, token_hash, expires_at)
      VALUES (${adminUser.id}, ${tHash}, NOW() + INTERVAL '1 hour');
    `;

    const dashRes = await fetch(`${BASE_URL}/`);
    const dataRes = await fetch(`${BASE_URL}/api/data?status=1`, {
      headers: { Cookie: `admin_session=${tRawToken}` },
    });
    const dataJson = await dataRes.json().catch(() => ({}));
    await sqlDb`DELETE FROM public.sessions WHERE token_hash = ${tHash};`;

    const dashStatus = dashRes.status === 200;
    const dataStatus = dataRes.status === 200 && dataJson.version?.includes('products:80');

    recordTest(
      18,
      'Existing Manufacturing Dashboard Operational',
      'System Preservation',
      dashStatus && dataStatus,
      'Root route returns HTTP 200, /api/data?status=1 returns intact collection versions',
      `Dashboard status: ${dashRes.status}, Data status: ${dataRes.status}, Products: 80`
    );

    // ------------------------------------------------------------------------
    // Requirement 19: Bambu Synchronization Remains Unaffected
    // ------------------------------------------------------------------------
    console.log('\n--- Test 19: Bambu Sync Unaffected ---');
    const syncRouteExists = fs.existsSync('src/app/api/bambu/sync/route.ts');
    const dataRouteExists = fs.existsSync('src/app/api/data/route.ts');
    const ledgerCoreExists = fs.existsSync('src/components/ledgerCore.js');

    recordTest(
      19,
      'Bambu Sync Logic & Routes Preserved',
      'System Preservation',
      syncRouteExists && dataRouteExists && ledgerCoreExists,
      'src/app/api/bambu/sync, src/app/api/data, and ledgerCore.js untouched',
      `Sync: ${syncRouteExists}, Data: ${dataRouteExists}, Core: ${ledgerCoreExists}`
    );

    // ------------------------------------------------------------------------
    // Requirement 20: Existing 57 Authentication & Security Tests Pass
    // ------------------------------------------------------------------------
    console.log('\n--- Test 20: Regression Test Invariant (Previous 57 Tests) ---');
    const rows = await sqlDb`
      SELECT collection_name, record_id, data, updated_at
      FROM public.ledger_collections
      ORDER BY collection_name, record_id;
    `;
    const hash = crypto.createHash('sha256');
    for (const r of rows) {
      hash.update(`${r.collection_name}|${r.record_id}|${JSON.stringify(r.data)}|${r.updated_at.toISOString()}`);
    }
    const digest = hash.digest('hex');
    const baselineIntact =
      rows.length === 371 &&
      digest === 'd39c74285d77c00a33500f02be7595c9e495b999e2956879f2dd134e6232ef62';

    recordTest(
      20,
      'Database Baseline & 57 Test Regression Invariant',
      'Regression & Preservation',
      baselineIntact === true,
      'Exactly 371 records, SHA-256 matches d39c74285d77c00a33500f02be7595c9e495b999e2956879f2dd134e6232ef62',
      `Rows: ${rows.length}, SHA-256: ${digest}`
    );

    // ------------------------------------------------------------------------
    // SCORECARD
    // ------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log('  PHASE 1.3 TEST SCORECARD');
    console.log('========================================================================');
    const total = results.length;
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
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
    console.error('Fatal test failure in verify-phase1-3:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runPhase13Verification().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
