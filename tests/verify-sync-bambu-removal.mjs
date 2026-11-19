import { chromium } from "playwright";

async function verifySyncBambuRemoval() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const brainDir = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3";

  console.log("Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // Disable pointer events on nextjs-portal if present
  await page.addStyleTag({ content: "nextjs-portal { pointer-events: none !important; }" });

  const assertions = [];
  function assert(title, condition, extra = "") {
    if (condition) {
      console.log(`  ✅ PASS: ${title} ${extra ? `(${extra})` : ""}`);
      assertions.push({ title, status: "PASS", extra });
    } else {
      console.error(`  ❌ FAIL: ${title} ${extra ? `(${extra})` : ""}`);
      assertions.push({ title, status: "FAIL", extra });
    }
  }

  // 1. Dashboard Tab
  console.log("\n1. Verifying Overview Dashboard Header...");
  await page.click('button[data-tab="dashboard"]');
  await page.waitForTimeout(400);

  const dashAddProd = await page.$("#topAddProductBtn");
  assert("Dashboard has NO '#topAddProductBtn' button", dashAddProd === null);

  const dashDataNewProd = await page.$('#topbarActions button[data-new="products"]');
  assert("Dashboard has NO 'data-new=\"products\"' button", dashDataNewProd === null);

  const dashSyncBtn = await page.$("#syncBambuBtn");
  assert("Dashboard has '#syncBambuBtn' in topbar", dashSyncBtn !== null);

  const dashSyncIsPri = await page.$eval("#syncBambuBtn", el => el.classList.contains("btn-pill-primary"));
  assert("Dashboard '#syncBambuBtn' has primary emerald pill class", dashSyncIsPri);

  await page.screenshot({ path: `${brainDir}/dashboard_sync_bambu_light.png` });

  // 2. Printed Stock Tab
  console.log("\n2. Verifying Printed Stock Page...");
  await page.click('button[data-tab="products"]');
  await page.waitForTimeout(400);

  const prodAddItem = await page.$('#topbarActions button[data-new="products"]');
  assert("Printed Stock has NO 'Add item' button", prodAddItem === null);

  const prodSyncBtn = await page.$("#syncBambuBtn");
  assert("Printed Stock has '#syncBambuBtn' in topbar", prodSyncBtn !== null);

  const prodSyncIsPri = await page.$eval("#syncBambuBtn", el => el.classList.contains("btn-pill-primary"));
  assert("Printed Stock '#syncBambuBtn' has primary emerald pill class", prodSyncIsPri);

  const rowPrintBtn = await page.$('tbody tr.prod-table-row button[data-print-prod]');
  assert("Product rows have NO row-level 'Print' button", rowPrintBtn === null);

  const rowEditBtn = await page.$('tbody tr.prod-table-row button[data-edit="products"]');
  assert("Product rows have NO row-level 'Edit' pencil button", rowEditBtn === null);

  const rowDelBtn = await page.$('tbody tr.prod-table-row button[data-del="products"]');
  assert("Product rows retain delete button", rowDelBtn !== null);

  await page.screenshot({ path: `${brainDir}/printed_stock_sync_bambu_light.png` });

  // 3. Print Log Tab
  console.log("\n3. Verifying Print Log Page...");
  await page.click('button[data-tab="prints"]');
  await page.waitForTimeout(400);

  const printLogAdd = await page.$('#topbarActions button[data-new="prints"]');
  assert("Print Log has NO 'Log a print' button", printLogAdd === null);

  const printSyncBtn = await page.$("#syncBambuBtn");
  assert("Print Log has '#syncBambuBtn' in topbar", printSyncBtn !== null);

  const printSyncIsPri = await page.$eval("#syncBambuBtn", el => el.classList.contains("btn-pill-primary"));
  assert("Print Log '#syncBambuBtn' has primary emerald pill class", printSyncIsPri);

  await page.screenshot({ path: `${brainDir}/print_log_sync_bambu_light.png` });

  // 4. Filament Inventory Tab
  console.log("\n4. Verifying Filament Inventory Page...");
  await page.click('button[data-tab="filaments"]');
  await page.waitForTimeout(400);

  const filSyncBtn = await page.$("#syncBambuBtn");
  assert("Filament Inventory has '#syncBambuBtn' in topbar", filSyncBtn !== null);

  const filSyncIsPri = await page.$eval("#syncBambuBtn", el => el.classList.contains("btn-pill-primary"));
  assert("Filament Inventory '#syncBambuBtn' has primary emerald pill class", filSyncIsPri);

  await page.screenshot({ path: `${brainDir}/filaments_sync_bambu_light.png` });

  // 5. Dark Mode Verification across pages
  console.log("\n5. Verifying Dark Mode...");
  await page.click("#themeToggleBtn");
  await page.waitForTimeout(400);

  // Dark Dashboard
  await page.click('button[data-tab="dashboard"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${brainDir}/dashboard_sync_bambu_dark.png` });

  // Dark Printed Stock
  await page.click('button[data-tab="products"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${brainDir}/printed_stock_sync_bambu_dark.png` });

  // Dark Print Log
  await page.click('button[data-tab="prints"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${brainDir}/print_log_sync_bambu_dark.png` });

  // Dark Filament Inventory
  await page.click('button[data-tab="filaments"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${brainDir}/filaments_sync_bambu_dark.png` });

  // 6. Test Live Sync Bambu click interaction
  console.log("\n6. Testing Sync Bambu click interaction...");
  const syncBtn = await page.$("#syncBambuBtn");
  if (syncBtn) {
    await syncBtn.click();
    await page.waitForTimeout(100);
    const isSyncing = await page.$eval("#syncBambuBtn", el => el.classList.contains("syncing") || el.disabled);
    assert("Sync Bambu button transitions to syncing / disabled on click", isSyncing);
    await page.waitForTimeout(2000); // Wait for sync API roundtrip
  }

  // Restore light mode
  await page.click("#themeToggleBtn");
  await page.waitForTimeout(200);

  await browser.close();

  const failed = assertions.filter(a => a.status === "FAIL");
  console.log("\n==========================================");
  console.log(`VERIFICATION SUMMARY: ${assertions.length - failed.length}/${assertions.length} passed`);
  if (failed.length > 0) {
    console.error(`FAILED CHECKS: ${failed.map(f => f.title).join(", ")}`);
    process.exit(1);
  } else {
    console.log("ALL CHECKS PASSED PERFECTLY!");
  }
}

verifySyncBambuRemoval().catch(err => {
  console.error("Verification script failed:", err);
  process.exit(1);
});
