import { chromium } from 'playwright';
import crypto from 'crypto';
import { sql } from '../src/lib/db';

async function capture() {
  console.log('Capturing Phase 2.3 Workspace Screenshots with Playwright...');

  if (!sql) throw new Error('No database connection');
  const [adminUser] = await sql`SELECT id FROM public.users WHERE email = 'admin@printstudio.ae' LIMIT 1;`;
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await sql`
    INSERT INTO public.sessions (user_id, token_hash, expires_at, is_revoked)
    VALUES (${adminUser.id}, ${tokenHash}, NOW() + INTERVAL '1 hour', false);
  `;

  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Unauthenticated Access -> Redirects to /login
    const contextGuest = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const pageGuest = await contextGuest.newPage();
    await pageGuest.goto('http://app.lvh.me:3000/admin', { waitUntil: 'domcontentloaded' });
    await pageGuest.waitForTimeout(1000);
    await pageGuest.screenshot({
      path: 'docs/screenshots/unauthenticated_redirect_login.png',
      fullPage: true,
    });
    console.log('✅ Captured: docs/screenshots/unauthenticated_redirect_login.png');
    await contextGuest.close();

    // Authenticated Context
    const contextAuth = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await contextAuth.addCookies([
      {
        name: 'admin_session',
        value: rawToken,
        domain: '.lvh.me',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    // 2. Desktop Business Management Workspace Overview (/admin)
    const pageAuth = await contextAuth.newPage();
    await pageAuth.goto('http://app.lvh.me:3000/admin', { waitUntil: 'domcontentloaded' });
    await pageAuth.waitForTimeout(1000);
    await pageAuth.screenshot({
      path: 'docs/screenshots/business_workspace_desktop.png',
      fullPage: false,
    });
    console.log('✅ Captured: docs/screenshots/business_workspace_desktop.png');

    // 3. Desktop Subpage Placeholder (/admin/products)
    await pageAuth.goto('http://app.lvh.me:3000/admin/products', { waitUntil: 'domcontentloaded' });
    await pageAuth.waitForTimeout(1000);
    await pageAuth.screenshot({
      path: 'docs/screenshots/module_placeholder_desktop.png',
      fullPage: false,
    });
    console.log('✅ Captured: docs/screenshots/module_placeholder_desktop.png');

    // 4. Desktop Bambu Production Workspace (/admin/production)
    await pageAuth.goto('http://app.lvh.me:3000/admin/production', { waitUntil: 'domcontentloaded' });
    await pageAuth.waitForTimeout(2000);
    await pageAuth.screenshot({
      path: 'docs/screenshots/bambu_production_workspace.png',
      fullPage: false,
    });
    console.log('✅ Captured: docs/screenshots/bambu_production_workspace.png');
    await contextAuth.close();

    // 5. Mobile Business Management Workspace (390x844 iPhone 14)
    const contextMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
    });
    await contextMobile.addCookies([
      {
        name: 'admin_session',
        value: rawToken,
        domain: '.lvh.me',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const pageMobile = await contextMobile.newPage();
    await pageMobile.goto('http://app.lvh.me:3000/admin', { waitUntil: 'domcontentloaded' });
    await pageMobile.waitForTimeout(1000);
    await pageMobile.screenshot({
      path: 'docs/screenshots/business_workspace_mobile.png',
      fullPage: false,
    });
    console.log('✅ Captured: docs/screenshots/business_workspace_mobile.png');
    await contextMobile.close();

  } finally {
    await browser.close();
    await sql`DELETE FROM public.sessions WHERE token_hash = ${tokenHash};`.catch(() => {});
  }
}

capture().catch((err) => {
  console.error('Screenshot capture error:', err);
  process.exit(1);
});
