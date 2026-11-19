import { chromium } from "playwright";

const ARTIFACT_DIR = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3";

async function run() {
  console.log("🚀 Starting Bambu MQTT Authoritative Live Print Verification Suite...");
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

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // -------------------------------------------------------------
    // TEST 1: API Response from POST /api/bambu/sync
    // -------------------------------------------------------------
    console.log("\n--- TEST 1: Live API Telemetry & Authoritative MQTT State ---");
    // Warmup request to ensure Next.js route has compiled
    await fetch("http://localhost:3000/api/bambu/sync", { method: "POST" });
    await new Promise(r => setTimeout(r, 500));

    const t0 = Date.now();
    const res = await fetch("http://localhost:3000/api/bambu/sync", { method: "POST" });
    const durationMs = Date.now() - t0;
    console.log(`  ℹ️ Sync completed in ${durationMs}ms`);

    assert("API returned HTTP 200", res.ok === true, `Status: ${res.status}`);
    const json = await res.json();
    assert("Response has success: true", json.success === true);
    assert("Response returns printerStatus: RUNNING from MQTT", json.printerStatus === "RUNNING", `Found: ${json.printerStatus}`);
    assert("Active printing count is >= 1", json.activePrintingCount >= 1, `Count: ${json.activePrintingCount}`);

    const activePrint = json.prints?.find(p => p.id === "bambu_live_22E8BJ642303489");
    assert("Authoritative active print record exists with ID 'bambu_live_22E8BJ642303489'", activePrint !== undefined);
    assert("Active print note is cleaned of (print in place) tags", activePrint?.note === "Gear shift fidget", `Note: ${activePrint?.note}`);
    assert("Active print status is 'Printing'", activePrint?.statusLabel === "Printing" && activePrint?.status === "Printing");
    assert("Active print has matched productId", activePrint?.productId === "prod_93dafbaf16549bca", `ProductId: ${activePrint?.productId}`);
    assert("Active print has live AMS filaments mapped", Array.isArray(activePrint?.filamentsUsed) && activePrint.filamentsUsed.length > 0);
    assert("Active print has real-time progress captured from MQTT", typeof activePrint?.progress === "number", `Progress: ${activePrint?.progress}%`);
    assert("Active print has remaining minutes captured from MQTT", typeof activePrint?.remainingMinutes === "number", `Minutes: ${activePrint?.remainingMinutes}m`);

    // -------------------------------------------------------------
    // TEST 2: UI Pinning & Toolbar Telemetry Pill in Print Log
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: UI Pinning & Telemetry Badge in Print Log ---");
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "nextjs-portal { pointer-events: none !important; }" });
    await page.waitForTimeout(1000);

    // Switch to Print Log tab
    await page.click('button[data-tab="prints"]');
    await page.waitForTimeout(500);

    // Check toolbar telemetry badge
    const telemetryBadge = await page.$(".printer-telemetry-badge");
    assert("Telemetry badge exists in toolbar", telemetryBadge !== null);
    const badgeText = await page.$eval(".printer-telemetry-badge", el => el.innerText.trim());
    console.log(`  ℹ️ Telemetry Badge Text: "${badgeText}"`);
    assert("Telemetry badge shows '3DP-22E-489: RUNNING'", badgeText.includes("3DP-22E-489") && badgeText.includes("RUNNING"));

    const badgeIsActive = await page.$eval(".printer-telemetry-badge", el => el.classList.contains("active"));
    assert("Telemetry badge has active class", badgeIsActive === true);

    const pulseDot = await page.$(".printer-telemetry-badge .telemetry-dot.pulse");
    assert("Telemetry badge has animated pulsing dot", pulseDot !== null);

    // Check first row of Print Log table (should be the active job pinned at top)
    const firstRowText = await page.$eval("tbody tr.print-table-row:first-child", r => r.innerText);
    assert("Active job 'Gear shift fidget' is pinned to the top of the table", firstRowText.includes("Gear shift fidget"));
    assert("First row shows 'Printing' status", firstRowText.includes("Printing"));

    const printingPill = await page.$("tbody tr.print-table-row:first-child .print-status-printing");
    assert("First row has animated extruder Printing pill", printingPill !== null);

    // Check product photo in first row
    const firstRowImg = await page.$("tbody tr.print-table-row:first-child td:nth-child(2) img");
    assert("First row displays product photo thumbnail", firstRowImg !== null);

    // Check Printing filter counter
    const printingFilterCount = await page.$eval('button[data-print-filter="printing"] .filter-count', el => el.innerText.trim());
    assert("Printing filter tab counter shows 1 active print", printingFilterCount === "1", `Found: ${printingFilterCount}`);

    // Screenshot of Print Log with active print and telemetry badge
    await page.screenshot({ path: `${ARTIFACT_DIR}/print_log_mqtt_authoritative_active.png` });
    console.log("  📸 Saved print_log_mqtt_authoritative_active.png");

    // -------------------------------------------------------------
    // TEST 3: Overview Dashboard Recent Activity Pinning
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: Overview Dashboard Pinning ---");
    await page.click('button[data-tab="dashboard"]');
    await page.waitForTimeout(500);

    const firstRecentActivityText = await page.$eval(".dash-activity-card .dash-activity-row:first-child", r => r.innerText);
    assert("Dashboard Recent Activity pins 'Gear shift fidget' at the top", firstRecentActivityText.includes("Gear shift fidget"));
    assert("Dashboard Recent Activity row displays 'Printing' badge", firstRecentActivityText.includes("Printing"));

    // Screenshot of Dashboard with active print pinned
    await page.screenshot({ path: `${ARTIFACT_DIR}/dashboard_mqtt_authoritative_active.png` });
    console.log("  📸 Saved dashboard_mqtt_authoritative_active.png");

    // -------------------------------------------------------------
    // TEST 4: Dark Mode UI Check
    // -------------------------------------------------------------
    console.log("\n--- TEST 4: Dark Mode Verification ---");
    await page.click("#themeToggleBtn");
    await page.waitForTimeout(300);

    const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    assert("Dark mode toggled successfully", isDark === true);

    await page.click('button[data-tab="prints"]');
    await page.waitForTimeout(300);

    await page.screenshot({ path: `${ARTIFACT_DIR}/print_log_mqtt_dark.png` });
    console.log("  📸 Saved print_log_mqtt_dark.png");

    await page.click('button[data-tab="dashboard"]');
    await page.waitForTimeout(300);

    await page.screenshot({ path: `${ARTIFACT_DIR}/dashboard_mqtt_dark.png` });
    console.log("  📸 Saved dashboard_mqtt_dark.png");

    // Restore to light mode
    await page.click("#themeToggleBtn");

    console.log("\n==========================================");
    console.log(`🎯 TOTAL TESTS: ${passed + failed} | ✅ PASSED: ${passed} | ❌ FAILED: ${failed}`);
    console.log("==========================================");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
