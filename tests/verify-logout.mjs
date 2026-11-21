import { chromium } from "playwright";
import assert from "assert";

const brainDir = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3";

async function main() {
  console.log("=== RUNNING LOGOUT & SYNC HISTORY REMOVAL VERIFICATION ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  try {
    await page.goto("http://localhost:3000/", { waitUntil: "load" });
    await page.waitForTimeout(1500);

    // 1. Check Sync History is NOT in the sidebar
    console.log("1. Checking Sync History removal...");
    const syncHistoryNav = page.locator('button[data-tab="automation-history"]');
    const syncHistoryText = page.locator('#mainSidebar :text("Sync History")');
    assert.strictEqual(await syncHistoryNav.count(), 0, "Sync History nav button must be completely removed");
    assert.strictEqual(await syncHistoryText.count(), 0, "Sync History text must not exist in sidebar");
    console.log("✓ Sync History is not in the sidebar.");

    // 2. Check Logout button in sidebar footer
    console.log("2. Checking Logout button in sidebar footer...");
    const sidebarLogout = page.locator('#sidebarLogoutBtn');
    assert.strictEqual(await sidebarLogout.isVisible(), true, "Sidebar logout button must be visible");
    const sidebarLogoutText = await sidebarLogout.innerText();
    assert(sidebarLogoutText.includes("Log Out"), "Sidebar logout button must display 'Log Out'");
    console.log("✓ Sidebar logout button is present in footer with label 'Log Out'.");

    // 3. Check Logout button in topbar header actions
    console.log("3. Checking Logout button in header topbar...");
    const headerLogout = page.locator('#headerLogoutBtn');
    assert.strictEqual(await headerLogout.isVisible(), true, "Header logout button must be visible");
    console.log("✓ Header logout button is present in topbar.");

    // 4. Capture screenshot of the full dashboard showing sidebar and topbar
    await page.screenshot({
      path: `${brainDir}/sidebar_logout_updated.png`,
      fullPage: false
    });
    console.log("✓ Captured screenshot: sidebar_logout_updated.png");

    // 5. Capture isolated sidebar screenshot
    const sidebarEl = page.locator('#mainSidebar');
    await sidebarEl.screenshot({
      path: `${brainDir}/sidebar_only_updated.png`
    });
    console.log("✓ Captured screenshot: sidebar_only_updated.png");

    // 6. Capture isolated topbar header actions screenshot
    const topbarRight = page.locator('.topbar-right.header-actions');
    await topbarRight.screenshot({
      path: `${brainDir}/topbar_actions_logout.png`
    });
    console.log("✓ Captured screenshot: topbar_actions_logout.png");

    console.log("=== ALL LOGOUT & NAVIGATION CHECKS PASSED ===");
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
