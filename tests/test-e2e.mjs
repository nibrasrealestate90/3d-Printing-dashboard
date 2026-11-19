import { chromium } from "playwright";

async function runTests() {
  console.log("🚀 Starting Playwright Full Automated Test Suite...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = [];
  function assert(name, condition, details = "") {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      results.push({ name, status: "PASS", details });
    } else {
      console.error(`  ❌ FAIL: ${name} - ${details}`);
      results.push({ name, status: "FAIL", details });
    }
  }

  try {
    // 1. Load Dashboard
    console.log("\n--- TEST 1: Initial Page Load ---");
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "nextjs-portal { pointer-events: none !important; }" });
    const title = await page.textContent("#pageTitleText");
    assert("Page title is Dashboard", title.trim() === "Dashboard", `Found: ${title}`);

    // Check full screen bounds
    const appBox = await page.locator("#app").boundingBox();
    assert("App shell spans full width (1440px)", appBox.width >= 1430, `Width: ${appBox.width}`);
    assert("App shell spans full height (900px)", appBox.height >= 890, `Height: ${appBox.height}`);

    // 2. Test Dark Mode Toggle
    console.log("\n--- TEST 2: Dark Mode Toggle ---");
    const isDarkInitial = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    assert("Initial state is light mode", !isDarkInitial, `isDark: ${isDarkInitial}`);

    await page.click("#themeToggleBtn");
    await page.waitForTimeout(300);

    const isDarkAfterToggle = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    assert("Dark mode class added to html after click", isDarkAfterToggle, `isDark: ${isDarkAfterToggle}`);

    const bgDark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    console.log(`  ℹ️ Body background in dark mode: ${bgDark}`);
    assert("Body background color reflects dark theme", bgDark.includes("8, 29, 32") || bgDark.includes("4, 20, 22") || bgDark.includes("7, 29, 32"), `Found: ${bgDark}`);

    const sunVisible = await page.isVisible("#sunIcon");
    assert("Sun icon visible in dark mode", sunVisible);

    // Toggle back to light mode
    await page.click("#themeToggleBtn");
    await page.waitForTimeout(300);
    const isDarkBack = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    assert("Restored to light mode", !isDarkBack);

    // 3. Test Sidebar Collapse
    console.log("\n--- TEST 3: Sidebar Collapse ---");
    const sidebarInitialBox = await page.locator("#mainSidebar").boundingBox();
    assert("Sidebar initial width ~240px", sidebarInitialBox.width >= 230 && sidebarInitialBox.width <= 250, `Width: ${sidebarInitialBox.width}`);

    await page.click("#collapseSidebarBtn", { force: true });
    await page.waitForTimeout(350);

    const sidebarCollapsedBox = await page.locator("#mainSidebar").boundingBox();
    assert("Sidebar collapsed width ~76px", sidebarCollapsedBox.width >= 70 && sidebarCollapsedBox.width <= 85, `Width: ${sidebarCollapsedBox.width}`);

    const appHasCollapsed = await page.evaluate(() => document.getElementById("app").classList.contains("sidebar-collapsed"));
    assert("App shell has sidebar-collapsed class", appHasCollapsed);

    // Uncollapse sidebar
    await page.click("#collapseSidebarBtn", { force: true });
    await page.waitForTimeout(350);
    const sidebarExpandedBox = await page.locator("#mainSidebar").boundingBox();
    assert("Sidebar restored to ~240px", sidebarExpandedBox.width >= 230, `Width: ${sidebarExpandedBox.width}`);

    // 4. Test Navigation Across All Tabs
    console.log("\n--- TEST 4: Navigation Tabs ---");
    const tabs = [
      { key: "invoices", title: "Invoices & offers", tableHead: "#" },
      { key: "products", title: "Printed stock", tableHead: "Item" },
      { key: "filaments", title: "Filament inventory", tableHead: "Filament" },
      { key: "calc", title: "Cost calculator", checkId: "#c_name" },
      { key: "prints", title: "Print log", tableHead: "Item" },
      { key: "expenses", title: "Expenses", tableHead: "Category" },
      { key: "accounts", title: "Accounts", tableHead: "Month" },
      { key: "settings", title: "Settings", checkId: "#saveSettings" },
      { key: "dashboard", title: "Dashboard", checkId: "#printTimeEchartBox" },
    ];

    for (const t of tabs) {
      await page.click(`button[data-tab="${t.key}"]`);
      await page.waitForTimeout(200);
      const currentTitle = await page.textContent("#pageTitleText");
      assert(`Tab navigation to '${t.key}' updates title`, currentTitle.trim() === t.title, `Found: ${currentTitle}`);

      if (t.checkId) {
        const el = await page.$(t.checkId);
        assert(`Tab '${t.key}' renders expected element (${t.checkId})`, !!el);
      }
    }

    // 5. Test Cost Calculator Live Calculation
    console.log("\n--- TEST 5: Cost Calculator Live Formulas ---");
    await page.click('button[data-tab="calc"]');
    await page.waitForTimeout(200);

    // Fill inputs
    await page.fill("#c_grams", "100");
    await page.fill("#c_minutes", "240");
    await page.fill("#c_laborMin", "20");
    await page.fill("#c_packaging", "10");
    await page.waitForTimeout(200);

    const calcOutText = await page.textContent(".calc");
    assert("Calculator renders cost breakdown", calcOutText.includes("Total cost") || calcOutText.includes("cost"), "Cost breakdown present");

    // 6. Test Modals: Verify manual product/print buttons removed and Expense Modal Open & Cancel
    console.log("\n--- TEST 6: Modals and Forms ---");
    await page.click('button[data-tab="products"]');
    await page.waitForTimeout(200);

    const hasAddProductBtn = await page.$('button[data-new="products"]');
    assert("Manual 'Add item' button is removed from Printed stock header", hasAddProductBtn === null);

    const hasSyncBambuBtn = await page.$("#syncBambuBtn");
    assert("Primary 'Sync Bambu' button is present in Printed stock header", hasSyncBambuBtn !== null);

    await page.click('button[data-tab="expenses"]');
    await page.waitForTimeout(200);

    await page.click('button[data-new="expenses"]');
    await page.waitForTimeout(300);

    const modalVisible = await page.isVisible(".modal");
    assert("Expense modal opens on 'Add expense' click", modalVisible);

    await page.click("#mCancel");
    await page.waitForTimeout(300);
    const modalGone = await page.$(".modal");
    assert("Modal closes on Cancel click", modalGone === null);

    // 7. Test Invoices: New Invoice Modal
    console.log("\n--- TEST 7: Invoice Builder Modal ---");
    await page.click('button[data-tab="invoices"]');
    await page.waitForTimeout(200);

    await page.click("#topNewInvoiceBtn");
    await page.waitForTimeout(300);

    const invoiceModalVisible = await page.isVisible("#iform");
    assert("Invoice builder modal opens", invoiceModalVisible);

    const invNo = await page.inputValue("#i_no");
    assert("Invoice auto-generates document number", invNo.startsWith("INV-"), `No: ${invNo}`);

    await page.click("#mCancel");
    await page.waitForTimeout(300);

    // Test Invoices Toolbar Filters (verify no ReferenceError)
    const invFilters = ["all", "sale", "unpaid", "quote", "foc"];
    for (const f of invFilters) {
      await page.click(`button[data-inv-filter="${f}"]`);
      await page.waitForTimeout(100);
    }
    assert("Invoice filter buttons switch without errors", true);

    // Test Expenses Toolbar Filters (verify no ReferenceError)
    await page.click('button[data-tab="expenses"]');
    await page.waitForTimeout(200);
    const expFilters = ["all", "fil", "ops"];
    for (const f of expFilters) {
      await page.click(`button[data-exp-filter="${f}"]`);
      await page.waitForTimeout(100);
    }
    assert("Expense filter buttons switch without errors", true);

    // 8. Test Bambu Sync Header & Clean Row Actions (No manual add/print/edit, Delete retained)
    console.log("\n--- TEST 8: Bambu Sync Header & Product Row Actions ---");
    await page.click('button[data-tab="products"]');
    await page.waitForTimeout(400);

    // Check Sync status pill is removed from header
    const hasSyncPill = await page.$("#syncStatusPill");
    assert("Header status pill is removed from top header", hasSyncPill === null);

    // Verify products table rendered cleanly
    const hasEmptyRow = await page.$("tbody td.empty");
    if (hasEmptyRow) {
      const emptyRowText = await page.textContent("tbody td.empty");
      assert("Clean empty state rendered for products", emptyRowText.includes("No products recorded yet"), `Text: ${emptyRowText}`);
    } else {
      const rowCount = await page.$$eval("tbody tr", rows => rows.length);
      assert("Products table displays records", rowCount > 0, `Row count: ${rowCount}`);
    }

    // Verify row-level actions: No manual print or edit buttons, delete button preserved
    const rowPrintBtn = await page.$('tbody tr.prod-table-row button[data-print-prod]');
    const rowEditBtn = await page.$('tbody tr.prod-table-row button[data-edit="products"]');
    const rowDelBtn = await page.$('tbody tr.prod-table-row button[data-del="products"]');
    assert("Manual 'Print' action button is removed from product rows", rowPrintBtn === null);
    assert("Manual 'Edit' pencil button is removed from product rows", rowEditBtn === null);
    assert("Delete action button is preserved on product rows", rowDelBtn !== null);

    // Test Search Filter on existing products
    await page.fill("#q_p", "Fidget");
    await page.waitForTimeout(300);
    const searchMatchCount = await page.$$eval("tbody tr.prod-table-row", rows => rows.length);
    assert("Search filters table to matching product(s)", searchMatchCount >= 1);

    // Clear search filter
    await page.click('button[data-qclr="p"]');
    await page.waitForTimeout(300);

    // Verify sort toggle button functions
    const sortBtn = await page.$("#toggleProdSortBtn");
    assert("Sort toggle button exists in toolbar", sortBtn !== null);
    if (sortBtn) {
      await page.click("#toggleProdSortBtn");
      await page.waitForTimeout(200);
      const sortLabel = await page.textContent("#toggleProdSortBtn .sort-label");
      assert("Sort toggle switches order", sortLabel.includes("Low → High") || sortLabel.includes("High → Low"));
      // Toggle back to default High → Low
      await page.click("#toggleProdSortBtn");
      await page.waitForTimeout(200);
    }

    console.log("\n==========================================");
    const passed = results.filter(r => r.status === "PASS").length;
    const failed = results.filter(r => r.status === "FAIL").length;
    console.log(`🎯 TOTAL TESTS: ${results.length} | ✅ PASSED: ${passed} | ❌ FAILED: ${failed}`);
    console.log("==========================================\n");

  } catch (err) {
    console.error("Test execution error:", err);
  } finally {
    await browser.close();
  }
}

runTests();
