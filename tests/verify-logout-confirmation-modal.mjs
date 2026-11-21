import { chromium } from "playwright";
import assert from "assert";

const brainDir = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3";

async function main() {
  console.log("=== RUNNING LOGOUT CONFIRMATION MODAL TESTS ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // ------------------------------------------------------------------------
    // 1. Test Commercial Dashboard (PrintStudioLedger at "/")
    // ------------------------------------------------------------------------
    console.log("--- 1. Testing Commercial Dashboard at http://localhost:3000/ ---");
    await page.goto("http://localhost:3000/", { waitUntil: "load" });
    await page.waitForTimeout(1500);

    // Verify modal is NOT initially visible
    const modalDialog = page.locator('.logout-modal-dialog');
    assert.strictEqual(await modalDialog.count(), 0, "Modal should not be open initially");

    // Click sidebar logout button
    console.log("Clicking sidebar logout button...");
    const sidebarLogoutBtn = page.locator('#sidebarLogoutBtn');
    await sidebarLogoutBtn.click();
    await page.waitForSelector('.logout-modal-dialog', { timeout: 4000 });
    console.log("✓ Modal opened after clicking sidebar logout button");

    // Verify modal elements
    const modalTitle = page.locator('#logout-dialog-title');
    assert.strictEqual(await modalTitle.innerText(), "Sign Out of Session");
    console.log("✓ Modal title verified: 'Sign Out of Session'");

    // Screenshot Commercial Dashboard with open modal
    await page.waitForTimeout(350);
    await page.screenshot({
      path: `${brainDir}/logout_modal_commercial_dashboard.png`,
      fullPage: false
    });
    console.log("✓ Captured screenshot: logout_modal_commercial_dashboard.png");

    // Test Cancel button
    console.log("Testing Cancel button...");
    const cancelBtn = page.locator('#logoutModalCancelBtn');
    await cancelBtn.click();
    await page.waitForTimeout(300);
    assert.strictEqual(await modalDialog.count(), 0, "Modal should close after clicking Cancel");
    console.log("✓ Modal closed cleanly on Cancel");

    // Test Topbar Header Logout Button
    console.log("Clicking topbar header logout button...");
    const headerLogoutBtn = page.locator('#headerLogoutBtn');
    await headerLogoutBtn.click();
    await page.waitForSelector('.logout-modal-dialog', { timeout: 4000 });
    console.log("✓ Modal opened after clicking header logout button");

    // Test Escape key
    console.log("Testing ESC key dismissal...");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    assert.strictEqual(await modalDialog.count(), 0, "Modal should close on ESC key");
    console.log("✓ Modal closed cleanly on ESC key");

    // ------------------------------------------------------------------------
    // 2. Test Business Workspace (BusinessWorkspaceLayout at "/admin")
    // ------------------------------------------------------------------------
    console.log("\n--- 2. Testing Business Workspace at http://localhost:3000/admin ---");
    // Ensure authenticated session
    console.log("Authenticating session for /admin access...");
    await page.goto("http://localhost:3000/login", { waitUntil: "load" });
    await page.waitForTimeout(500);
    const emailInput = page.locator('#admin-email');
    if (await emailInput.isVisible()) {
      await emailInput.fill('admin@printstudio.ae');
      await page.fill('#admin-password', process.env.ADMIN_INITIAL_PASSWORD || 'Admin123!Secure');
      await page.click('button[type="submit"]');
      await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });
      console.log("✓ Authenticated, current URL:", page.url());
    }

    await page.goto("http://localhost:3000/admin", { waitUntil: "load" });
    await page.waitForTimeout(1500);

    // Click Business Workspace header logout button
    console.log("Clicking Business Workspace header logout button...");
    const bmHeaderLogout = page.locator('.bm-header .bm-header-logout-btn');
    await bmHeaderLogout.waitFor({ state: "visible", timeout: 8000 });
    await bmHeaderLogout.click();

    await page.waitForSelector('.logout-modal-dialog', { timeout: 4000 });
    console.log("✓ Modal opened on Business Workspace");

    // Screenshot Business Workspace with open modal
    await page.waitForTimeout(350);
    await page.screenshot({
      path: `${brainDir}/logout_modal_business_workspace.png`,
      fullPage: false
    });
    console.log("✓ Captured screenshot: logout_modal_business_workspace.png");

    // Test Confirm Log Out
    console.log("Testing Confirm Log Out action...");
    const confirmBtn = page.locator('#logoutModalConfirmBtn');
    await confirmBtn.click();

    // Verify navigation to /login
    await page.waitForURL(url => url.pathname.includes('/login'), { timeout: 8000 });
    console.log("✓ Successfully redirected to login page:", page.url());

    console.log("\n========================================================================");
    console.log("  ALL LOGOUT CONFIRMATION MODAL TESTS PASSED! ✅");
    console.log("========================================================================");
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
