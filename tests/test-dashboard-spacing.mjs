import { chromium } from "playwright";

async function captureDashboard() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Light mode
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const lightPath = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3/dashboard_no_qa_light.png";
  await page.screenshot({ path: lightPath });
  console.log("Light screenshot saved to:", lightPath);

  // Dark mode
  await page.click("#themeToggleBtn");
  await page.waitForTimeout(400);
  const darkPath = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3/dashboard_no_qa_dark.png";
  await page.screenshot({ path: darkPath });
  console.log("Dark screenshot saved to:", darkPath);

  await browser.close();
}

captureDashboard().catch(console.error);
