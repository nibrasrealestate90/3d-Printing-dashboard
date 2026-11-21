import { chromium } from "playwright";

async function verifyExpensesSidebar() {
  const brainDir = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3";
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("=== 1. Navigating to Manufacturing Workspace (http://localhost:3000/) ===");
  await page.goto("http://localhost:3000/", { waitUntil: "load" });
  await page.waitForTimeout(1500);

  // Check sidebar exists
  const sidebar = page.locator("#mainSidebar");
  await sidebar.waitFor({ state: "visible", timeout: 10000 });
  console.log("Sidebar visible!");

  // Verify Manufacturing Navigation Items
  const navItems = await page.$$eval(".nav-group:first-child .nav-item", els =>
    els.map(el => ({
      tab: el.getAttribute("data-tab"),
      text: el.querySelector(".nav-text")?.innerText?.trim(),
      isActive: el.classList.contains("active")
    }))
  );
  console.log("Manufacturing Navigation Items in DOM:", navItems);

  // Click on Expenses tab
  console.log("=== 2. Clicking on Expenses nav tab ===");
  const expensesBtn = page.locator('button[data-tab="expenses"]');
  await expensesBtn.waitFor({ state: "visible", timeout: 8000 });
  await expensesBtn.click();
  await page.waitForTimeout(600);

  // Verify active state
  const isActive = await expensesBtn.evaluate(el => el.classList.contains("active"));
  const ariaSelected = await expensesBtn.getAttribute("aria-selected");
  const pageTitle = await page.locator("#pageTitleText").innerText();
  const crumbText = await page.locator("#crumbText").innerText();

  console.log("Expenses Tab State:", {
    isActive,
    ariaSelected,
    pageTitle,
    crumbText
  });

  // Capture Screenshot 1: Desktop light mode with Expenses active
  await page.screenshot({ path: `${brainDir}/sidebar_expenses_light_active.png` });
  await sidebar.screenshot({ path: `${brainDir}/sidebar_expenses_desktop_zoom.png` });
  console.log("Captured light mode screenshots!");

  // Switch to dark mode
  console.log("=== 3. Toggling Dark Mode ===");
  const themeToggle = page.locator("#themeToggleBtn");
  if (await themeToggle.isVisible()) {
    await themeToggle.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${brainDir}/sidebar_expenses_dark_active.png` });
    await sidebar.screenshot({ path: `${brainDir}/sidebar_expenses_dark_zoom.png` });
    console.log("Captured dark mode screenshots!");

    // Switch back to light
    await themeToggle.click();
    await page.waitForTimeout(400);
  }

  // Test responsive mobile layout
  console.log("=== 4. Testing Responsive Mobile Layout ===");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const mobileMenuBtn = page.locator("#menuToggleBtn");
  if (await mobileMenuBtn.isVisible()) {
    await mobileMenuBtn.click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: `${brainDir}/sidebar_expenses_responsive_mobile.png` });
  console.log("Captured mobile screenshots!");

  // Test Legacy stock alias
  console.log("=== 5. Testing Legacy 'stock' tab redirection ===");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    localStorage.setItem("ps_tab", "stock");
    window.location.reload();
  });
  await page.waitForTimeout(1500);

  const redirectedTab = await page.evaluate(() => localStorage.getItem("ps_tab"));
  const redirectedPageTitle = await page.locator("#pageTitleText").innerText();
  const redirectedCrumb = await page.locator("#crumbText").innerText();
  const isExpensesActiveAfterRedirect = await page.locator('button[data-tab="expenses"]').evaluate(el => el.classList.contains("active"));

  console.log("Legacy Stock Redirection Verification:", {
    persistedTab: redirectedTab,
    pageTitle: redirectedPageTitle,
    crumb: redirectedCrumb,
    isExpensesActive: isExpensesActiveAfterRedirect
  });

  await browser.close();
  console.log("=== ALL VISUAL VERIFICATIONS COMPLETE ===");
}

verifyExpensesSidebar().catch(err => {
  console.error("Visual verification failed:", err);
  process.exit(1);
});
