import { chromium } from "playwright";

async function captureHugeIcons() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const brainDir = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3";

  // Light mode dashboard screenshot
  await page.screenshot({ path: `${brainDir}/hugeicons_dashboard_light.png` });

  // Sidebar closeup screenshot
  const sidebar = await page.$("#mainSidebar");
  if (sidebar) {
    await sidebar.screenshot({ path: `${brainDir}/hugeicons_sidebar_light.png` });
  }

  // Cost calculator tab
  await page.click('button[data-tab="calc"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${brainDir}/hugeicons_calc_light.png` });

  // Switch to dark mode
  await page.click("#themeToggleBtn");
  await page.waitForTimeout(500);

  // Dark mode calc
  await page.screenshot({ path: `${brainDir}/hugeicons_calc_dark.png` });

  // Switch back to dashboard in dark mode
  await page.click('button[data-tab="dashboard"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${brainDir}/hugeicons_dashboard_dark.png` });

  if (sidebar) {
    await sidebar.screenshot({ path: `${brainDir}/hugeicons_sidebar_dark.png` });
  }

  await browser.close();
  console.log("Captured all visual screenshots with HugeIcons!");
}

captureHugeIcons().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
