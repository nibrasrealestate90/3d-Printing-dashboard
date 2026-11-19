import { chromium } from "playwright";

async function checkOtherTabs() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  // Toggle dark mode
  await page.click("#themeToggleBtn");
  await page.waitForTimeout(400);

  // Navigate to invoices tab
  await page.click('button[data-tab="invoices"]');
  await page.waitForTimeout(400);

  const invoicesScreenshot = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3/invoices_dark.png";
  await page.screenshot({ path: invoicesScreenshot });
  console.log("Invoices screenshot saved to:", invoicesScreenshot);

  // Navigate to settings tab
  await page.click('button[data-tab="settings"]');
  await page.waitForTimeout(400);

  const settingsScreenshot = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3/settings_dark.png";
  await page.screenshot({ path: settingsScreenshot });
  console.log("Settings screenshot saved to:", settingsScreenshot);

  await browser.close();
}

checkOtherTabs().catch(console.error);
