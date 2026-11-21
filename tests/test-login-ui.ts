import { chromium, Browser, Page } from 'playwright';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

const ARTIFACT_DIR = '/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3';
const DOCS_SCREENSHOTS_DIR = path.join(process.cwd(), 'docs', 'screenshots');
if (!fs.existsSync(DOCS_SCREENSHOTS_DIR)) {
  fs.mkdirSync(DOCS_SCREENSHOTS_DIR, { recursive: true });
}

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function saveScreenshot(page: Page, filename: string) {
  const artifactPath = path.join(ARTIFACT_DIR, filename);
  const docsPath = path.join(DOCS_SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: artifactPath, fullPage: true });
  fs.copyFileSync(artifactPath, docsPath);
  console.log(`📸 Screenshot saved: ${filename}`);
}

async function runUITests() {
  console.log('========================================================================');
  console.log('  PRINT STUDIO LEDGER — PHASE 1.3 UI & PLAYWRIGHT INTEGRATION TESTS');
  console.log('========================================================================\n');

  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  try {
    // ------------------------------------------------------------------------
    // Scenario 1: Initial Desktop View (Unauthenticated)
    // ------------------------------------------------------------------------
    console.log('--- 1. Testing Desktop Unauthenticated Sign-In View ---');
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#admin-email', { timeout: 10000 });
    await saveScreenshot(page, 'login_desktop_light.png');

    // ------------------------------------------------------------------------
    // Scenario 2: Dark Mode View
    // ------------------------------------------------------------------------
    console.log('--- 2. Testing Dark Mode View ---');
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(300);
    await saveScreenshot(page, 'login_desktop_dark.png');
    // Revert dark mode
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
    });

    // ------------------------------------------------------------------------
    // Scenario 3: Mobile Viewport (375x812)
    // ------------------------------------------------------------------------
    console.log('--- 3. Testing Mobile Responsiveness (iPhone Viewport) ---');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);
    await saveScreenshot(page, 'login_mobile_light.png');
    // Restore desktop
    await page.setViewportSize({ width: 1280, height: 800 });

    // ------------------------------------------------------------------------
    // Scenario 4: Validation - Empty Inputs
    // ------------------------------------------------------------------------
    console.log('--- 4. Testing Empty Input Validation ---');
    await page.click('button[type="submit"]');
    await page.waitForSelector('#admin-email-error');
    await page.waitForSelector('#admin-password-error');
    await saveScreenshot(page, 'login_validation_errors.png');

    // ------------------------------------------------------------------------
    // Scenario 5: Validation - Malformed Email
    // ------------------------------------------------------------------------
    console.log('--- 5. Testing Malformed Email Validation ---');
    await page.fill('#admin-email', 'invalid-email-address');
    await page.fill('#admin-password', 'SecretPassword123');
    await page.click('button[type="submit"]');
    await page.waitForSelector('#admin-email-error');
    const emailErrorText = await page.textContent('#admin-email-error');
    console.log('Email error message:', emailErrorText);

    // ------------------------------------------------------------------------
    // Scenario 6: Password Show/Hide Toggle
    // ------------------------------------------------------------------------
    console.log('--- 6. Testing Show/Hide Password Toggle ---');
    const inputTypeInitial = await page.getAttribute('#admin-password', 'type');
    await page.click('button[aria-label="Show password text"]');
    const inputTypeToggled = await page.getAttribute('#admin-password', 'type');
    await page.click('button[aria-label="Hide password text"]');
    const inputTypeReverted = await page.getAttribute('#admin-password', 'type');
    console.log(
      `Password input types: Initial=${inputTypeInitial}, Toggled=${inputTypeToggled}, Reverted=${inputTypeReverted}`
    );

    // ------------------------------------------------------------------------
    // Scenario 7: Invalid Credentials Error Banner (HTTP 401)
    // ------------------------------------------------------------------------
    console.log('--- 7. Testing Invalid Credentials Error Banner ---');
    await page.fill('#admin-email', 'admin@printstudio.ae');
    await page.fill('#admin-password', 'WrongPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForSelector('div[role="alert"]', { timeout: 5000 });
    await saveScreenshot(page, 'login_invalid_credentials_alert.png');

    // ------------------------------------------------------------------------
    // Scenario 8: Successful Administrator Login (HTTP 200)
    // ------------------------------------------------------------------------
    console.log('--- 8. Testing Valid Administrator Login ---');
    await page.fill('#admin-email', 'admin@printstudio.ae');
    await page.fill('#admin-password', process.env.ADMIN_INITIAL_PASSWORD || 'Admin123!Secure');
    await page.click('button[type="submit"]');

    // The successful login triggers navigation to "/" or shows authenticated state
    await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
    console.log('Navigated to dashboard root after successful login:', page.url());

    // ------------------------------------------------------------------------
    // Scenario 9: Visiting /admin/login While Authenticated (Session Verification)
    // ------------------------------------------------------------------------
    console.log('--- 9. Testing Session Verification on /admin/login ---');
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('div[role="region"][aria-label="Active Administrator Session"]', {
      timeout: 5000,
    });
    await saveScreenshot(page, 'login_authenticated_session_verified.png');

    // ------------------------------------------------------------------------
    // Scenario 10: Storage Inspection (No passwords or tokens in localStorage/sessionStorage)
    // ------------------------------------------------------------------------
    console.log('--- 10. Inspecting Client Storage for Credential Leaks ---');
    const storageAudit = await page.evaluate(() => {
      const localKeys = Object.keys(localStorage);
      const sessionKeys = Object.keys(sessionStorage);
      const localValues = localKeys.map(k => `${k}:${localStorage.getItem(k)}`);
      const sessionValues = sessionKeys.map(k => `${k}:${sessionStorage.getItem(k)}`);
      return { localKeys, sessionKeys, localValues, sessionValues };
    });
    console.log('localStorage keys found:', storageAudit.localKeys);
    console.log('sessionStorage keys found:', storageAudit.sessionKeys);
    const hasPasswordOrToken =
      JSON.stringify(storageAudit).toLowerCase().includes('password') ||
      JSON.stringify(storageAudit).toLowerCase().includes('session_token') ||
      JSON.stringify(storageAudit).toLowerCase().includes('token_digest');
    console.log('No credential or session token in client storage:', !hasPasswordOrToken);

    // ------------------------------------------------------------------------
    // Scenario 11: Logout Interaction
    // ------------------------------------------------------------------------
    console.log('--- 11. Testing Logout Interaction ---');
    await page.click('button:has-text("Sign Out of Console")');
    await page.waitForSelector('#admin-login-heading', { timeout: 5000 });
    await saveScreenshot(page, 'login_logged_out_form.png');

    console.log('\n========================================================================');
    console.log('  ALL PLAYWRIGHT UI INTEGRATION SCENARIOS COMPLETED SUCCESSFULLY! ✅');
    console.log('========================================================================\n');
  } catch (err: any) {
    console.error('Playwright UI test error:', err);
    await saveScreenshot(page, 'login_error_state.png');
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runUITests().catch(err => {
  console.error('Fatal UI test run failure:', err);
  process.exit(1);
});
