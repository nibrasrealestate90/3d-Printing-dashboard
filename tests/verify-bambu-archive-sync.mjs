import { chromium } from "playwright";
import { neon } from "@neondatabase/serverless";

const ARTIFACT_DIR = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3";

async function run() {
  console.log("🚀 Starting Bambu Cloud Archive-Only Sync Verification...\n");
  let passed = 0;
  let failed = 0;

  function assert(title, condition, extra = "") {
    if (condition) {
      console.log(`  ✅ PASS: ${title} ${extra ? `(${extra})` : ""}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${title} ${extra ? `(${extra})` : ""}`);
      failed++;
    }
  }

  // 1. Verify Database State
  console.log("--- 1. Database Inspection ---");
  const sql = neon(process.env.DATABASE_URL);
  const syntheticRows = await sql`
    SELECT record_id, data->>'note' as note, data->>'status' as status 
    FROM ledger_collections 
    WHERE collection_name = 'prints' 
      AND (record_id LIKE 'bambu_live_%' OR record_id LIKE 'bambu_active_%' OR data->>'status' = 'Printing' OR data->>'statusLabel' = 'Printing');
  `;
  assert("Database has 0 synthetic active/live printing rows", syntheticRows.length === 0, `Count: ${syntheticRows.length}`);

  const totalPrintsRows = await sql`
    SELECT count(*)::int as count FROM ledger_collections WHERE collection_name = 'prints';
  `;
  const totalPrintsCount = totalPrintsRows[0].count;
  assert("Database has authoritative prints archived", totalPrintsCount > 0, `Total: ${totalPrintsCount}`);

  // 2. Browser UI Verification
  console.log("\n--- 2. Browser UI Inspection (Print Log & Dashboard) ---");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Navigate to Print Log
    await page.click('button[data-tab="prints"]');
    await page.waitForTimeout(500);

    // Verify filter tabs: All, Success, Canceled / Failed (NO Printing tab)
    const filterTabs = await page.$$eval(".inv-filter-segmented button.inv-filter-btn", btns =>
      btns.map(b => ({
        filter: b.getAttribute("data-print-filter"),
        text: b.textContent.replace(/\s+/g, " ").trim()
      }))
    );
    console.log("  Filter tabs detected:", filterTabs);
    const hasAll = filterTabs.some(t => t.filter === "all");
    const hasClean = filterTabs.some(t => t.filter === "clean");
    const hasFailed = filterTabs.some(t => t.filter === "failed");
    const hasPrinting = filterTabs.some(t => t.filter === "printing");

    assert("Print Log has 'All' filter tab", hasAll);
    assert("Print Log has 'Success' filter tab", hasClean);
    assert("Print Log has 'Canceled / Failed' filter tab", hasFailed);
    assert("Print Log has NO 'Printing' filter tab", !hasPrinting);

    // Verify .printer-telemetry-badge is gone
    const telemetryBadge = await page.$(".printer-telemetry-badge");
    assert("Printer telemetry badge (3DP-22E-489: ...) is removed from toolbar", telemetryBadge === null);

    // Take screenshot of Print Log (Light)
    await page.screenshot({ path: `${ARTIFACT_DIR}/print_log_archive_light.png` });
    console.log("  📸 Saved print_log_archive_light.png");

    // Click Sync Bambu and verify toast
    console.log("\n--- 3. Testing Sync Bambu Interaction ---");
    await page.click("#syncBambuBtn");
    // Wait for smart-toast notification
    await page.waitForSelector(".smart-toast", { timeout: 15000 });
    await page.waitForTimeout(500);

    const toastText = await page.$$eval(".smart-toast", els => els.map(e => e.textContent).join(" "));
    console.log("  Detected toast/notify text:", toastText);
    assert("Sync toast indicates tasks verified", toastText.includes("tasks verified") || toastText.includes("Synced"));

    // Verify Dark Mode
    console.log("\n--- 4. Dark Mode Visual Verification ---");
    await page.click("#themeToggleBtn");
    await page.waitForTimeout(500);

    await page.screenshot({ path: `${ARTIFACT_DIR}/print_log_archive_dark.png` });
    console.log("  📸 Saved print_log_archive_dark.png");

    // Navigate to Dashboard in Dark Mode
    await page.click('button[data-tab="dashboard"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${ARTIFACT_DIR}/dashboard_archive_dark.png` });
    console.log("  📸 Saved dashboard_archive_dark.png");

    // Return to Light Mode
    await page.click("#themeToggleBtn");
    await page.waitForTimeout(400);

  } finally {
    await browser.close();
  }

  console.log("\n==========================================");
  console.log(`🎯 TOTAL TESTS: ${passed + failed} | ✅ PASSED: ${passed} | ❌ FAILED: ${failed}`);
  console.log("==========================================");

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error("Fatal error during verification:", err);
  process.exit(1);
});
