import { chromium } from "playwright";
import path from "path";

async function verifyDarkMode() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // Toggle to dark mode
  await page.click("#themeToggleBtn");
  await page.waitForTimeout(500);

  // Check header background
  const headerBg = await page.evaluate(() => {
    const el = document.querySelector(".page-header");
    return window.getComputedStyle(el).backgroundColor;
  });
  console.log("Header background in dark mode:", headerBg);

  // Check header title color
  const titleColor = await page.evaluate(() => {
    const el = document.querySelector("#pageTitleText");
    return window.getComputedStyle(el).color;
  });
  console.log("Title color in dark mode:", titleColor);

  // Check quick action tile background and text
  const tileInfo = await page.evaluate(() => {
    const tile = document.querySelector(".quick-action-tile");
    const title = tile.querySelector(".tile-title");
    const desc = tile.querySelector(".tile-desc");
    const icon = tile.querySelector(".tile-icon-box");
    return {
      tileBg: window.getComputedStyle(tile).backgroundColor,
      titleColor: window.getComputedStyle(title).color,
      descColor: window.getComputedStyle(desc).color,
      iconColor: window.getComputedStyle(icon).color,
      iconBg: window.getComputedStyle(icon).backgroundColor
    };
  });
  console.log("Tile styles:", tileInfo);

  // Check metric card styles
  const metricInfo = await page.evaluate(() => {
    const card = document.querySelector(".metric-card--lime");
    const label = card.querySelector(".card-label");
    const value = card.querySelector(".card-value");
    const pill = card.querySelector(".metric-live-pill");
    const icon = card.querySelector(".card-icon-container");
    return {
      cardBg: window.getComputedStyle(card).backgroundColor,
      labelColor: window.getComputedStyle(label).color,
      valueColor: window.getComputedStyle(value).color,
      pillBg: window.getComputedStyle(pill).backgroundColor,
      pillColor: window.getComputedStyle(pill).color,
      iconBg: window.getComputedStyle(icon).backgroundColor,
      iconColor: window.getComputedStyle(icon).color
    };
  });
  console.log("Metric card styles:", metricInfo);

  const screenshotPath = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3/dark_mode_verified.png";
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log("Screenshot saved to:", screenshotPath);

  await browser.close();
}

verifyDarkMode().catch(console.error);
