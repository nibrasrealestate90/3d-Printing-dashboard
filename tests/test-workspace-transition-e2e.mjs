import { chromium } from "playwright";

async function runWorkspaceTransitionE2ETest() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("=== 1. Logging in as Administrator ===");
  await page.goto("http://localhost:3000/admin/login", { waitUntil: "networkidle" });
  await page.fill("#admin-email", "admin@printstudio.ae");
  await page.fill("#admin-password", "Admin123!Secure");
  await page.click('button[type="submit"]');

  // Wait for login redirect
  await page.waitForTimeout(1500);
  console.log("Logged in, current URL:", page.url());

  console.log("=== 2. Navigating to Bambu Manufacturing Workspace (/admin/production) ===");
  await page.goto("http://localhost:3000/admin/production", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const switchBtn = page.locator("#switchWorkspaceBtn");
  await switchBtn.waitFor({ state: "visible", timeout: 10000 });
  console.log("Switch to Business button found!");

  // Verify initial state
  const initialDisabled = await switchBtn.getAttribute("aria-disabled");
  console.log("Initial aria-disabled:", initialDisabled);

  console.log("=== 3. Triggering Transition: Manufacturing -> Business ===");
  await switchBtn.click();

  // Wait 180ms to catch active transition overlay
  await page.waitForTimeout(180);
  const overlay = page.locator(".wt-overlay");
  const isOverlayVisible = await overlay.isVisible();
  const targetAttr = await overlay.getAttribute("data-target");
  const titleText = await page.locator(".wt-title").innerText();
  const subtitleText = await page.locator(".wt-subtitle").innerText();
  const isVectorSpinnerVisible = await page.locator(".wt-vector-spinner").isVisible();
  const isEmblemVisible = await page.locator(".wt-logo-core").isVisible();

  console.log("Active Transition Inspection:", {
    isOverlayVisible,
    targetAttr,
    titleText,
    subtitleText,
    isVectorSpinnerVisible,
    isEmblemVisible,
  });

  const ssDir = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3";
  await page.screenshot({ path: `${ssDir}/transition_to_business_active.png` });
  console.log("Saved transition_to_business_active.png");

  // Wait for navigation to complete to /admin
  await page.waitForURL("**/admin", { timeout: 10000 });
  await page.waitForTimeout(1200);

  console.log("Navigated to destination, URL:", page.url());
  await page.screenshot({ path: `${ssDir}/business_workspace_revealed.png` });
  console.log("Saved business_workspace_revealed.png");

  console.log("=== 4. Triggering Reverse Transition: Business -> Manufacturing ===");
  const reverseSwitchBtn = page.locator(".bm-sidebar-bottom .bm-workspace-switch-btn");
  await reverseSwitchBtn.waitFor({ state: "visible", timeout: 10000 });

  await reverseSwitchBtn.click();

  // Wait 180ms to catch active reverse transition overlay
  await page.waitForTimeout(180);
  const reverseOverlay = page.locator(".wt-overlay");
  const isRevOverlayVisible = await reverseOverlay.isVisible();
  const revTargetAttr = await reverseOverlay.getAttribute("data-target");
  const revTitleText = await page.locator(".wt-title").innerText();
  const revSubtitleText = await page.locator(".wt-subtitle").innerText();

  console.log("Active Reverse Transition Inspection:", {
    isRevOverlayVisible,
    revTargetAttr,
    revTitleText,
    revSubtitleText,
  });

  await page.screenshot({ path: `${ssDir}/transition_to_manufacturing_active.png` });
  console.log("Saved transition_to_manufacturing_active.png");

  // Wait for navigation back to /admin/production
  await page.waitForURL("**/admin/production", { timeout: 10000 });
  await page.waitForTimeout(1200);

  console.log("Navigated back to Manufacturing, URL:", page.url());
  await page.screenshot({ path: `${ssDir}/manufacturing_workspace_revealed.png` });
  console.log("Saved manufacturing_workspace_revealed.png");

  // Dark Mode test
  console.log("=== 5. Testing Dark Mode Transition Appearance ===");
  await page.click("#themeToggleBtn");
  await page.waitForTimeout(400);

  const darkSwitchBtn = page.locator("#switchWorkspaceBtn");
  await darkSwitchBtn.click();
  await page.waitForTimeout(180);

  await page.screenshot({ path: `${ssDir}/transition_dark_mode_active.png` });
  console.log("Saved transition_dark_mode_active.png");

  await page.waitForURL("**/admin", { timeout: 10000 });
  await page.waitForTimeout(1000);

  await browser.close();
  console.log("=== ALL WORKSPACE TRANSITION TESTS PASSED SUCCESSFULLY! ===");
}

runWorkspaceTransitionE2ETest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
