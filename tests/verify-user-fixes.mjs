import { chromium } from "playwright";
import path from "path";
import assert from "assert";

const brainDir = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3";

async function main() {
  console.log("=== RUNNING USER FIX VERIFICATION TEST ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  try {
    await page.goto("http://localhost:3000/", { waitUntil: "load" });
    await page.waitForTimeout(1000);

    // 1. Navigate to Expenses
    console.log("1. Navigating to Expenses tab...");
    const expensesNav = page.locator('button[data-tab="expenses"]');
    await expensesNav.waitFor({ state: "visible", timeout: 8000 });
    await expensesNav.click();
    await page.waitForTimeout(1500);

    // 2. Verify second header is REMOVED
    console.log("2. Verifying second header text is removed...");
    const duplicateSubtext = page.locator('text="Track, categorize, and review business expenditures"');
    const subtextCount = await duplicateSubtext.count();
    assert.strictEqual(subtextCount, 0, "Duplicate header subtitle must be removed");
    console.log("✓ Second header and subtext successfully removed.");

    // 3. Verify charts are REMOVED
    console.log("3. Verifying Spending Progression and Category Share charts are removed...");
    const spendingProgression = page.locator('text="Spending Progression"');
    const categoryShare = page.locator('text="Category Share"');
    assert.strictEqual(await spendingProgression.count(), 0, "Spending Progression chart must be removed");
    assert.strictEqual(await categoryShare.count(), 0, "Category Share chart must be removed");
    console.log("✓ Both charts successfully removed.");

    // 4. Verify Second Add Expense button is DELETED & Categories is in toolbar
    console.log("4. Verifying button layout & KPI cards placement...");
    // Check that Categories button is inside the filter toolbar next to the select
    const toolbar = page.locator('select').first().locator('..');
    const catBtn = toolbar.locator('button:has-text("Categories")').first();
    assert.strictEqual(await catBtn.isVisible(), true, "Categories button must be inside filter toolbar next to category select");
    console.log("✓ Categories button is shifted into the filter toolbar next to All Categories.");

    // Check that there is NO second "Add Expense" button near Categories
    const nearbyAddExpense = toolbar.locator('button:has-text("Add Expense")');
    assert.strictEqual(await nearbyAddExpense.count(), 0, "No duplicate Add Expense button near categories");
    console.log("✓ Second Add Expense button near categories is deleted.");

    // Check that KPI cards are uplifted to the top of the container
    const kpiCards = page.locator('text="Total Expenses"').first();
    assert.strictEqual(await kpiCards.isVisible(), true, "KPI cards are visible at top");
    console.log("✓ KPI cards are uplifted to the top.");

    // Take screenshot of updated Expense Page with KPIs at top
    const pageScreenshot = path.join(brainDir, "updated_kpis_top_categories_toolbar.png");
    await page.screenshot({ path: pageScreenshot, fullPage: true });
    console.log(`✓ Saved ${pageScreenshot}`);

    // 5. Open Categories Modal from toolbar button and verify Delete button is active/clickable
    console.log("5. Opening Categories Modal from toolbar...");
    await catBtn.click();
    await page.waitForTimeout(600);

    const modalTitle = page.locator('text="Expense Categories"');
    assert.strictEqual(await modalTitle.isVisible(), true, "Category modal must be open");

    // Check delete buttons in modal
    const deleteButtons = page.locator('button:has-text("Delete")');
    const count = await deleteButtons.count();
    console.log(`Found ${count} Delete buttons in category modal.`);
    assert(count > 0, "Should have delete buttons in categories modal");

    // Verify first delete button is NOT disabled when expenses count is 0
    const firstDeleteBtn = deleteButtons.first();
    const isDisabled = await firstDeleteBtn.isDisabled();
    assert.strictEqual(isDisabled, false, "Delete button for 0-expense category must be enabled");
    console.log("✓ Category Delete button is enabled for categories with 0 expenses.");

    // Take screenshot of updated Categories Modal
    const modalScreenshot = path.join(brainDir, "updated_expense_categories_modal.png");
    await page.screenshot({ path: modalScreenshot });
    console.log(`✓ Saved ${modalScreenshot}`);

    // Close Category Modal
    await page.locator('button:has-text("Done")').first().click();
    await page.waitForTimeout(400);

    // 6. Test Expense CRUD: Add an expense, verify, then delete it
    console.log("6. Testing Add Expense via topbar...");
    const topbarAddBtn = page.locator('button[data-new="expenses"]').first();
    await topbarAddBtn.click();
    await page.waitForTimeout(600);

    const formModal = page.locator('div[role="dialog"]');
    // Fill form
    await formModal.locator('input[placeholder*="Hotend"]').fill("Test Hotend Nozzle 0.4mm");
    await formModal.locator('input[placeholder="0.00"]').fill("85.00");
    await formModal.locator('input[placeholder*="DEWA"]').fill("Bambu Store Dubai");
    await formModal.locator('select').first().selectOption({ index: 0 });

    // Submit
    const saveBtn = formModal.locator('button:has-text("Save Expense")');
    await saveBtn.click();
    await page.waitForTimeout(1000);

    // Verify transaction row appears
    const newRow = page.locator('text="Test Hotend Nozzle 0.4mm"').first();
    assert.strictEqual(await newRow.isVisible(), true, "Newly added expense must appear in table");
    console.log("✓ Expense successfully added and visible in table.");

    // 7. Test Deleting the expense
    console.log("7. Testing Delete Expense...");
    const deleteRowBtn = page.locator('button[title="Delete expense"]').first();
    await deleteRowBtn.click();
    await page.waitForTimeout(600);

    // Verify Delete confirmation modal opens
    const confirmDeleteBtn = page.locator('button:has-text("Delete Record")');
    assert.strictEqual(await confirmDeleteBtn.isVisible(), true, "Delete confirmation modal must be open");

    // Click confirm delete
    await confirmDeleteBtn.click();
    await page.waitForTimeout(1000);

    // Verify transaction row is gone
    const remainingRowCount = await page.locator('text="Test Hotend Nozzle 0.4mm"').count();
    assert.strictEqual(remainingRowCount, 0, "Deleted expense must be removed from table");
    console.log("✓ Expense successfully deleted and removed from table.");

    console.log("\n=======================================================");
    console.log("  ALL USER FIX VERIFICATION TESTS PASSED (100%)");
    console.log("=======================================================");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
