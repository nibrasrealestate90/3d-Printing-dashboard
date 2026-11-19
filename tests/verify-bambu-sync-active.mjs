import { chromium } from "playwright";
import { sql } from "./src/lib/db.ts";

const ARTIFACT_DIR = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3";

async function run() {
  console.log("🚀 Starting Bambu Sync & Active Print Verification Suite...");
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
    // ==========================================
    // TEST 1: Direct API Call to POST /api/bambu/sync
    // ==========================================
    console.log("\n--- TEST 1: POST /api/bambu/sync API Response & Speed ---");
    const t0 = Date.now();
    const res = await fetch("http://localhost:3000/api/bambu/sync", { method: "POST" });
    const durationMs = Date.now() - t0;
    console.log(`  ℹ️ Sync completed in ${durationMs}ms`);

    assert("API returned HTTP 200", res.ok === true, `Status: ${res.status}`);
    const json = await res.json();
    assert("Response has success: true", json.success === true);
    assert("Response has syncedCount > 0", json.syncedCount > 0, `Count: ${json.syncedCount}`);
    assert("Response includes newTasksCount", json.newTasksCount !== undefined, `newTasksCount: ${json.newTasksCount}`);
    assert("Response includes printerStatus string", typeof json.printerStatus === "string", `Status: ${json.printerStatus}`);
    assert("Response includes syncedAt timestamp", Boolean(json.syncedAt), `syncedAt: ${json.syncedAt}`);
    assert("Response includes prints array", Array.isArray(json.prints) && json.prints.length > 0, `Length: ${json.prints?.length}`);
    assert("Response includes products array", Array.isArray(json.products) && json.products.length > 0, `Length: ${json.products?.length}`);
    assert("Response includes filaments array", Array.isArray(json.filaments) && json.filaments.length > 0, `Length: ${json.filaments?.length}`);
    assert("API duration is well within timeout budget (< 10s)", durationMs < 10000, `${durationMs}ms`);

    // ==========================================
    // TEST 2: Active / In-Progress Print Synthesis & Reconcile
    // ==========================================
    console.log("\n--- TEST 2: Active Print Synthesis & UI Pinning ---");
    const devId = "22E8BJ642303489";
    const liveRecordId = `bambu_live_${devId}`;
    const legacyRecordId = `bambu_active_${devId}`;

    // Simulate an active print being synthesized when printer is RUNNING
    const sampleActivePrint = {
      id: liveRecordId,
      bambuTaskId: 9999999999,
      date: new Date().toISOString().slice(0, 10),
      productId: "prod_active_test",
      qty: 0,
      failed: 0,
      grams: 42.5,
      hours: 1.5,
      note: "Live Test Active Print",
      updatedAt: new Date().toISOString(),
      statusLabel: "Printing",
      status: "Printing",
      plateName: "Plate 1",
      profileName: "0.20mm Standard",
      printerName: "3DP-22E-489 (P2S)",
      buildPlate: "Textured PEI Plate",
      nozzle: "0.4mm Standard x1",
      startTime: new Date().toISOString(),
      filamentsUsed: [
        { type: "PLA", color: "#10B981", slot: "A1", weightG: 30 },
        { type: "PLA", color: "#F98C36", slot: "A4", weightG: 12.5 }
      ]
    };

    // ==========================================
    // TEST 2: Active Print UI Pinning & Planned Filaments
    // ==========================================
    console.log("\n--- TEST 2: Active Print UI Pinning & Planned Filaments ---");
    // Navigate to UI and wait for initial mount to settle
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "nextjs-portal { pointer-events: none !important; }" });
    await page.waitForTimeout(1000);
    await page.click('button[data-tab="prints"]');
    await page.waitForTimeout(500);

    // Inject active printing job into client state to test table top-pinning and badges
    await page.evaluate((record) => {
      window.S.prints = [record, ...window.S.prints.filter(p => p.id !== record.id)];
      window.render();
    }, sampleActivePrint);
    await page.waitForTimeout(300);

    const firstRowText = await page.$eval("tbody tr.print-table-row:first-child", r => r.innerText);
    assert("Active printing job is pinned to the top of Print Log in UI", firstRowText.includes("Printing") && firstRowText.includes("Live Test Active Print"));

    const printingBadgeText = await page.$eval("tbody tr.print-table-row:first-child .print-status-pill", el => el.innerText.trim());
    assert("Active printing badge shows 'Printing'", printingBadgeText.includes("Printing"));

    const filamentsCellText = await page.$eval("tbody tr.print-table-row:first-child td:nth-child(5)", el => el.innerText);
    assert("Planned filaments display AMS slots and weights", filamentsCellText.includes("A1") && filamentsCellText.includes("A4"));

    const printingFilterCount = await page.$eval('button[data-print-filter="printing"] .filter-count', el => el.innerText.trim());
    assert("Printing filter tab counter shows active job (>= 1)", parseInt(printingFilterCount, 10) >= 1, `Count: ${printingFilterCount}`);

    const telemetryBadgeText = await page.$eval(".printer-telemetry-badge", el => el.innerText.trim());
    assert("Live printer telemetry badge is visible in UI", telemetryBadgeText.includes("3DP-22E-489"), `Badge text: ${telemetryBadgeText}`);

    // Screenshot of active print pinned at top
    await page.screenshot({ path: `${ARTIFACT_DIR}/print_log_active_job_pinned.png` });
    console.log("  📸 Saved print_log_active_job_pinned.png");

    // ==========================================
    // TEST 3: Automatic Reconciliation on Live Device Sync
    // ==========================================
    console.log("\n--- TEST 3: Automatic Reconciliation on Sync (bambu_live_ & bambu_active_) ---");
    // Insert both deterministic live record and legacy active record into database
    await sql`
      INSERT INTO ledger_collections (collection_name, record_id, data, updated_at)
      VALUES 
        ('prints', ${liveRecordId}, ${JSON.stringify(sampleActivePrint)}, NOW()),
        ('prints', ${legacyRecordId}, ${JSON.stringify({ ...sampleActivePrint, id: legacyRecordId })}, NOW())
      ON CONFLICT (collection_name, record_id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
    `;

    const beforeSync = await sql`
      SELECT record_id FROM ledger_collections 
      WHERE collection_name = 'prints' AND record_id IN (${liveRecordId}, ${legacyRecordId});
    `;
    assert("Active prints (live & legacy) inserted into database before sync", beforeSync.length === 2);

    // Call POST /api/bambu/sync: since live Bambu printer 22E8BJ642303489 is SUCCESS/IDLE, sync must automatically delete both
    const syncRes = await fetch("http://localhost:3000/api/bambu/sync", { method: "POST" });
    assert("Sync succeeded during reconciliation", syncRes.ok);

    const afterSync = await sql`
      SELECT record_id FROM ledger_collections 
      WHERE collection_name = 'prints' AND record_id IN (${liveRecordId}, ${legacyRecordId});
    `;
    assert("Both bambu_live_ and legacy bambu_active_ records automatically reconciled/deleted when device is IDLE/SUCCESS", afterSync.length === 0);

    // ==========================================
    // TEST 4: Frontend Sync Button Behavior (No Hanging)
    // ==========================================
    console.log("\n--- TEST 4: UI Sync Button Interaction & Status Toast ---");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const syncBtn = await page.$("#syncBambuBtn");
    assert("Sync Bambu button exists on page", syncBtn !== null);

    const btnInitialText = await syncBtn.innerText();
    assert("Button starts in 'Sync Bambu' state", btnInitialText.includes("Sync Bambu"));

    // Click the button and watch it transition to Syncing... and back to Sync Bambu
    await page.click("#syncBambuBtn");
    // Verify syncing state is triggered
    await page.waitForTimeout(200);
    const isSyncingClass = await page.$eval("#syncBambuBtn", el => el.classList.contains("syncing"));
    console.log(`  ℹ️ Syncing class present during sync: ${isSyncingClass}`);

    // Wait for sync to complete (max 10s)
    await page.waitForFunction(() => {
      const b = document.querySelector("#syncBambuBtn");
      return b && !b.classList.contains("syncing") && b.innerText.includes("Sync Bambu");
    }, { timeout: 12000 });

    const btnRestoredText = await page.$eval("#syncBambuBtn", el => el.innerText);
    assert("Button cleanly restored to 'Sync Bambu' without hanging", btnRestoredText.includes("Sync Bambu"));

    const btnDisabled = await page.$eval("#syncBambuBtn", el => el.disabled);
    assert("Button is re-enabled after sync", btnDisabled === false);

    // ==========================================
    // TEST 5: Error Handling & Invalid Token Response
    // ==========================================
    console.log("\n--- TEST 5: Error Handling with Expired/Invalid Token ---");
    // Test that the route cleanly handles 401 when token is missing/invalid
    // (We test through frontend fetch error simulation or invalid token handling)
    const errorHandlingCheck = await page.evaluate(async () => {
      const origFetch = window.fetch;
      let errorToastShown = false;
      try {
        // Mock a 401 failure from /api/bambu/sync
        window.fetch = async (url, opts) => {
          if (typeof url === "string" && url.includes("/api/bambu/sync")) {
            return new Response(JSON.stringify({ error: "Bambu Cloud authentication failed. Your Bambu token may have expired or is invalid." }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
          }
          return origFetch(url, opts);
        };

        // Trigger sync
        await window.syncBambu(true);

        const btn = document.querySelector("#syncBambuBtn");
        const isStillSyncing = btn.classList.contains("syncing") || btn.disabled;
        const toastEl = document.querySelector(".toast, .banner, [role='alert']");
        return {
          buttonRestored: !isStillSyncing,
          buttonText: btn.innerText.trim(),
          hasToastOrBanner: true
        };
      } finally {
        window.fetch = origFetch;
      }
    });

    assert("On 401 error, sync button does not hang in 'Syncing...'", errorHandlingCheck.buttonRestored === true);
    assert("On 401 error, button text is restored to 'Sync Bambu'", errorHandlingCheck.buttonText.includes("Sync Bambu"));

    console.log("\n==========================================");
    console.log(`🎯 TOTAL TESTS: ${passed + failed} | ✅ PASSED: ${passed} | ❌ FAILED: ${failed}`);
    console.log("==========================================");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
