import { chromium } from "playwright";

const ARTIFACT_DIR = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3";

async function run() {
  console.log("🚀 Starting Comprehensive Pagination Test Suite...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

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

  try {
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // ==========================================
    // SECTION 1: PRINTED STOCK PAGINATION
    // ==========================================
    console.log("\n--- SECTION 1: Printed Stock Pagination ---");
    await page.click('button[data-tab="products"]');
    await page.waitForTimeout(500);

    // 1.1 Verify Page 1 initial state (30 items)
    const prodRowsP1 = await page.$$eval("tbody tr.prod-table-row", rows => rows.length);
    assert("Printed stock page 1 renders exactly 30 items", prodRowsP1 === 30, `Count: ${prodRowsP1}`);

    const prodPagingInfo = await page.textContent(".prod-page-wrapper .table-pagination-footer .pagination-info");
    assert("Pagination info shows 1–30 range", /Showing 1–30 of \d+ models/.test(prodPagingInfo), `Info: ${prodPagingInfo.trim()}`);

    const prodPrevDisabled = await page.$eval(".prod-page-wrapper .pagination-prev", b => b.disabled);
    assert("Previous button is disabled on page 1", prodPrevDisabled === true);

    const prodP1Active = await page.$eval('.prod-page-wrapper .pagination-num[aria-current="page"]', b => b.textContent.trim());
    assert("Page 1 button is active", prodP1Active === "1");

    // 1.2 Navigate to Page 2
    await page.click('.prod-page-wrapper button[data-prod-page="2"]');
    await page.waitForTimeout(400);

    const prodRowsP2 = await page.$$eval("tbody tr.prod-table-row", rows => rows.length);
    assert("Printed stock page 2 renders exactly 30 items", prodRowsP2 === 30, `Count: ${prodRowsP2}`);

    const prodPagingInfoP2 = await page.textContent(".prod-page-wrapper .table-pagination-footer .pagination-info");
    assert("Pagination info shows 31–60 range", /Showing 31–60 of \d+ models/.test(prodPagingInfoP2), `Info: ${prodPagingInfoP2.trim()}`);

    const prodP2Active = await page.$eval('.prod-page-wrapper .pagination-num[aria-current="page"]', b => b.textContent.trim());
    assert("Page 2 button is active", prodP2Active === "2");

    // 1.3 Click Next button to go to Page 3
    await page.click('.prod-page-wrapper .pagination-next');
    await page.waitForTimeout(400);

    const prodRowsP3 = await page.$$eval("tbody tr.prod-table-row", rows => rows.length);
    assert("Printed stock page 3 renders remaining items", prodRowsP3 > 0 && prodRowsP3 <= 30, `Count: ${prodRowsP3}`);

    const prodPagingInfoP3 = await page.textContent(".prod-page-wrapper .table-pagination-footer .pagination-info");
    assert("Pagination info shows page 3 range", /Showing 61–\d+ of \d+ models/.test(prodPagingInfoP3), `Info: ${prodPagingInfoP3.trim()}`);

    const prodNextDisabledP3 = await page.$eval(".prod-page-wrapper .pagination-next", b => b.disabled);
    assert("Next button is disabled on last page", prodNextDisabledP3 === true);

    // 1.4 Test Reset on Search Input
    await page.fill("#q_p", "fidget");
    await page.waitForTimeout(400);
    const prodSearchInfo = await page.textContent(".prod-page-wrapper .table-pagination-footer .pagination-info");
    assert("Search resets page to 1", prodSearchInfo.includes("Showing 1–"), `Info: ${prodSearchInfo.trim()}`);

    // Clear search
    await page.click('button[data-qclr="p"]');
    await page.waitForTimeout(400);
    const prodAfterClearInfo = await page.textContent(".prod-page-wrapper .table-pagination-footer .pagination-info");
    assert("Clear search keeps page 1", /Showing 1–30 of \d+ models/.test(prodAfterClearInfo), `Info: ${prodAfterClearInfo.trim()}`);

    // 1.5 Test Reset on Sort Toggle
    // Go to page 2 first
    await page.click('.prod-page-wrapper button[data-prod-page="2"]');
    await page.waitForTimeout(400);
    assert("Moved back to page 2 for sort test", (await page.textContent(".prod-page-wrapper .pagination-info")).includes("31–60"));

    // Toggle sort
    await page.click("#toggleProdSortBtn");
    await page.waitForTimeout(400);
    const prodSortResetInfo = await page.textContent(".prod-page-wrapper .table-pagination-footer .pagination-info");
    assert("Sort toggle resets page back to 1", /Showing 1–30 of \d+ models/.test(prodSortResetInfo), `Info: ${prodSortResetInfo.trim()}`);

    // Toggle sort back to desc
    await page.click("#toggleProdSortBtn");
    await page.waitForTimeout(400);

    // 1.6 Test Reset on Filter Tabs
    // Go to page 2
    await page.click('.prod-page-wrapper button[data-prod-page="2"]');
    await page.waitForTimeout(400);
    // Click 'Printed (1+)' filter
    await page.click('button[data-prod-filter="printed"]');
    await page.waitForTimeout(400);
    const prodFilterResetInfo = await page.textContent(".prod-page-wrapper .table-pagination-footer .pagination-info");
    assert("Filter tab change resets page back to 1", prodFilterResetInfo.includes("Showing 1–"), `Info: ${prodFilterResetInfo.trim()}`);

    // Restore to 'All'
    await page.click('button[data-prod-filter="all"]');
    await page.waitForTimeout(400);

    // Screenshot of Printed Stock Pagination (Light)
    await page.screenshot({ path: `${ARTIFACT_DIR}/printed_stock_pagination_light.png` });
    console.log("  📸 Saved printed_stock_pagination_light.png");

    // ==========================================
    // SECTION 2: PRINT LOG PAGINATION
    // ==========================================
    console.log("\n--- SECTION 2: Print Log Pagination ---");
    await page.click('button[data-tab="prints"]');
    await page.waitForTimeout(500);

    // 2.1 Verify Page 1 initial state (30 items)
    const printRowsP1 = await page.$$eval("tbody tr.print-table-row", rows => rows.length);
    assert("Print log page 1 renders exactly 30 items", printRowsP1 === 30, `Count: ${printRowsP1}`);

    const printPagingInfo = await page.textContent(".print-page-wrapper .table-pagination-footer .pagination-info");
    assert("Pagination info shows 1–30 range of prints", printPagingInfo.includes("Showing 1–30 of") && printPagingInfo.includes("prints"), `Info: ${printPagingInfo.trim()}`);

    const printPrevDisabled = await page.$eval(".print-page-wrapper .pagination-prev", b => b.disabled);
    assert("Previous button is disabled on page 1", printPrevDisabled === true);

    const printEllipsisExists = await page.$(".print-page-wrapper .pagination-ellipsis");
    assert("Ellipsis rendered for >5 pages", printEllipsisExists !== null);

    // Verify Printing filter tab is removed and latest print is at top
    const printingFilterBtn = await page.$('button[data-print-filter="printing"]');
    assert("Printing filter tab is removed from toolbar", printingFilterBtn === null);

    const firstRowStatus = await page.$eval("tbody tr.print-table-row:first-child", row => row.innerText);
    assert("Latest completed/archive print is at top of Page 1", firstRowStatus.includes("Success") || firstRowStatus.includes("2026") || firstRowStatus.includes("Canceled"));

    // 2.2 Navigate to Page 2
    await page.click('.print-page-wrapper button[data-print-page="2"]');
    await page.waitForTimeout(400);

    const printRowsP2 = await page.$$eval("tbody tr.print-table-row", rows => rows.length);
    assert("Print log page 2 renders exactly 30 items", printRowsP2 === 30, `Count: ${printRowsP2}`);

    const printPagingInfoP2 = await page.textContent(".print-page-wrapper .table-pagination-footer .pagination-info");
    assert("Pagination info shows 31–60 range", printPagingInfoP2.includes("Showing 31–60 of") && printPagingInfoP2.includes("prints"), `Info: ${printPagingInfoP2.trim()}`);

    // 2.3 Navigate to Last Page
    const pageNumberButtons = await page.$$eval('.print-page-wrapper .pagination-pages button[data-print-page]', btns => btns.map(b => b.getAttribute('data-print-page')));
    const lastPageNum = pageNumberButtons[pageNumberButtons.length - 1];
    await page.click(`.print-page-wrapper .pagination-pages button[data-print-page="${lastPageNum}"]`);
    await page.waitForTimeout(400);

    const printPagingInfoLast = await page.textContent(".print-page-wrapper .table-pagination-footer .pagination-info");
    assert("Pagination info shows last page range", printPagingInfoLast.includes("prints") && !printPagingInfoLast.includes("Showing 1–30"), `Info: ${printPagingInfoLast.trim()}`);

    const printNextDisabledLast = await page.$eval(".print-page-wrapper .pagination-next", b => b.disabled);
    assert("Next button is disabled on last page", printNextDisabledLast === true);

    // 2.4 Test Reset on Search in Print Log
    await page.fill("#q_pr", "P2S");
    await page.waitForTimeout(400);
    const printSearchInfo = await page.textContent(".print-page-wrapper .table-pagination-footer .pagination-info");
    assert("Print log search resets page back to 1", printSearchInfo.includes("Showing 1–"), `Info: ${printSearchInfo.trim()}`);

    // Clear search
    await page.click('button[data-qclr="pr"]');
    await page.waitForTimeout(400);
    const printAfterClearInfo = await page.textContent(".print-page-wrapper .table-pagination-footer .pagination-info");
    assert("Clear search keeps page 1", printAfterClearInfo.includes("Showing 1–30 of") && printAfterClearInfo.includes("prints"), `Info: ${printAfterClearInfo.trim()}`);

    // 2.5 Test Reset on Filter Tabs in Print Log
    // Go to page 3
    await page.click('.print-page-wrapper button[data-print-page="3"]');
    await page.waitForTimeout(400);
    // Click 'Success' tab
    await page.click('button[data-print-filter="clean"]');
    await page.waitForTimeout(400);
    const printFilterResetInfo = await page.textContent(".print-page-wrapper .table-pagination-footer .pagination-info");
    assert("Filter tab change resets page back to 1", printFilterResetInfo.includes("Showing 1–"), `Info: ${printFilterResetInfo.trim()}`);

    // Reset back to 'all'
    await page.click('button[data-print-filter="all"]');
    await page.waitForTimeout(400);

    // Screenshot of Print Log Pagination (Light)
    await page.screenshot({ path: `${ARTIFACT_DIR}/print_log_pagination_light.png` });
    console.log("  📸 Saved print_log_pagination_light.png");

    // ==========================================
    // SECTION 3: DARK MODE PAGINATION
    // ==========================================
    console.log("\n--- SECTION 3: Dark Mode Pagination Styling ---");
    await page.click("#themeToggleBtn");
    await page.waitForTimeout(400);

    const isDarkMode = await page.$eval("html", el => el.classList.contains("dark"));
    assert("Dark mode toggled successfully", isDarkMode === true);

    // Screenshot of Print Log in Dark Mode
    await page.screenshot({ path: `${ARTIFACT_DIR}/print_log_pagination_dark.png` });
    console.log("  📸 Saved print_log_pagination_dark.png");

    // Switch to Printed Stock in Dark Mode
    await page.click('button[data-tab="products"]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${ARTIFACT_DIR}/printed_stock_pagination_dark.png` });
    console.log("  📸 Saved printed_stock_pagination_dark.png");

    // Check Dark Mode Active Pill Color
    const activeBtnBg = await page.$eval('.prod-page-wrapper .pagination-btn.active', el => window.getComputedStyle(el).backgroundColor);
    console.log(`  ℹ️ Dark mode active button background: ${activeBtnBg}`);
    assert("Dark mode active button has emerald background", activeBtnBg.includes("27, 101, 107") || activeBtnBg.includes("11, 43, 38"));

    // Switch back to light mode
    await page.click("#themeToggleBtn");
    await page.waitForTimeout(300);

    console.log("\n==========================================");
    console.log(`🎯 TOTAL TESTS: ${passed + failed} | ✅ PASSED: ${passed} | ❌ FAILED: ${failed}`);
    console.log("==========================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
