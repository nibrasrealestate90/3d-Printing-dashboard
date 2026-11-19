import { chromium } from "playwright";

async function verifyPerPageHeader() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // Disable pointer events on dev overlay
  await page.addStyleTag({ content: "nextjs-portal { pointer-events: none !important; }" });

  const brainDir = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3";

  const tabs = [
    { key: "dashboard", name: "Dashboard" },
    { key: "invoices", name: "Invoices & offers" },
    { key: "products", name: "Printed stock" },
    { key: "filaments", name: "Filament inventory" },
    { key: "calc", name: "Cost calculator" },
    { key: "prints", name: "Print log" },
    { key: "expenses", name: "Expenses" },
    { key: "accounts", name: "Accounts" },
    { key: "settings", name: "Settings" }
  ];

  for (const t of tabs) {
    console.log(`\nTesting tab: ${t.name} (${t.key})...`);
    await page.click(`button[data-tab="${t.key}"]`);
    await page.waitForTimeout(300);

    // Get buttons inside #topbarActions
    const buttons = await page.$$eval("#topbarActions button", btns => btns.map(b => b.textContent.trim()));
    console.log(`Topbar actions for '${t.name}':`, buttons);

    // Take topbar screenshot
    const topbar = await page.$(".page-header");
    if (topbar) {
      await topbar.screenshot({ path: `${brainDir}/header_${t.key}.png` });
    }
  }

  // Full page screenshot of Products tab with its individual buttons and search
  await page.click('button[data-tab="products"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${brainDir}/page_products_header.png` });

  // Full page screenshot of Settings tab with only Save settings in header
  await page.click('button[data-tab="settings"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${brainDir}/page_settings_header.png` });

  // Full page screenshot of Invoices tab
  await page.click('button[data-tab="invoices"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${brainDir}/page_invoices_header.png` });

  await browser.close();
  console.log("\nAll tab header verifications completed successfully!");
}

verifyPerPageHeader().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
