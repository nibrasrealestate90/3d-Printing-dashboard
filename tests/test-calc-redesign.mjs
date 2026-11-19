import { chromium } from "playwright";

async function verifyCalcRedesign() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // Navigate to calculator tab
  console.log("Switching to Cost Calculator tab...");
  await page.click('button[data-tab="calc"]');
  await page.waitForSelector("#calcOut", { state: "visible" });
  await page.waitForTimeout(400);

  const brainDir = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3";

  // Light mode full page & element screenshot
  console.log("Capturing Light Mode screenshots...");
  await page.screenshot({ path: `${brainDir}/calc_redesign_light.png`, fullPage: false });
  const calcCard = await page.$("#calcOut");
  if (calcCard) {
    await calcCard.screenshot({ path: `${brainDir}/calc_card_light.png` });
  }

  // Toggle Dark Mode
  console.log("Toggling Dark Mode...");
  await page.click("#themeToggleBtn");
  await page.waitForTimeout(500);

  // Dark mode screenshots
  console.log("Capturing Dark Mode screenshots...");
  await page.screenshot({ path: `${brainDir}/calc_redesign_dark.png`, fullPage: false });
  if (calcCard) {
    await calcCard.screenshot({ path: `${brainDir}/calc_card_dark.png` });
  }

  // Test interactivity: update inputs and verify calculations react
  console.log("Testing live input reactivity...");
  await page.fill("#c_grams", "150");
  await page.fill("#c_minutes", "180");
  await page.fill("#c_qty", "10");
  await page.waitForTimeout(300);

  const updatedTotal = await page.$eval(".calc-total-price", el => el.textContent.trim());
  const updatedDirect = await page.$eval(".calc-pricing-card.direct .calc-pricing-val", el => el.textContent.trim());
  const updatedBatchDirect = await page.$eval(".batch-stat.highlight .stat-num", el => el.textContent.trim());

  console.log("Updated Total Unit Cost:", updatedTotal);
  console.log("Updated Direct Retail Price:", updatedDirect);
  console.log("Updated Batch Direct Total:", updatedBatchDirect);

  await page.screenshot({ path: `${brainDir}/calc_card_interactive_dark.png` });

  await browser.close();
  console.log("Verification finished successfully!");
}

verifyCalcRedesign().catch(err => {
  console.error("Error during verification:", err);
  process.exit(1);
});
