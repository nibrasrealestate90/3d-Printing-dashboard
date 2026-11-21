import { chromium } from "playwright";
import path from "path";

const brainDir = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3";

async function takeScreenshots() {
  console.log("=== CONNECTING TO http://localhost:3000 FOR EXPENSES PAGE VISUAL VERIFICATION ===");
  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Desktop Light Mode
    const contextDesktop = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const page = await contextDesktop.newPage();

    await page.goto("http://localhost:3000/", { waitUntil: "load" });
    await page.waitForTimeout(1000);

    // Click on Expenses tab in sidebar
    console.log("Clicking Expenses nav button...");
    const expensesBtn = page.locator('button[data-tab="expenses"]');
    await expensesBtn.waitFor({ state: "visible", timeout: 8000 });
    await expensesBtn.click();
    await page.waitForTimeout(1500);

    // Verify Expenses Page header is visible
    const pageTitle = await page.locator("h2").filter({ hasText: "Expenses" }).first();
    await pageTitle.waitFor({ state: "visible", timeout: 5000 });
    console.log("Expenses page mounted and visible!");

    // Screenshot 1: Desktop Light Mode
    const s1 = path.join(brainDir, "task5_expenses_page_desktop_light.png");
    await page.screenshot({ path: s1, fullPage: true });
    console.log(`✓ Saved ${s1}`);

    // Click "Add Expense" button
    console.log("Opening Add Expense modal...");
    const addExpenseBtn = page.locator('button:has-text("Add Expense")').first();
    await addExpenseBtn.click();
    await page.waitForTimeout(600);

    // Screenshot 2: Add Expense Modal
    const s2 = path.join(brainDir, "task5_expense_add_modal.png");
    await page.screenshot({ path: s2 });
    console.log(`✓ Saved ${s2}`);

    // Close Add Expense modal
    await page.locator('button:has-text("Cancel")').first().click();
    await page.waitForTimeout(400);

    // Click "Categories" button
    console.log("Opening Categories modal...");
    const catBtn = page.locator('button:has-text("Categories")').first();
    await catBtn.click();
    await page.waitForTimeout(600);

    // Screenshot 3: Categories Modal
    const s3 = path.join(brainDir, "task5_expense_categories_modal.png");
    await page.screenshot({ path: s3 });
    console.log(`✓ Saved ${s3}`);

    // Close Categories modal
    await page.locator('button:has-text("Done")').first().click();
    await page.waitForTimeout(400);

    // 2. Dark Mode Desktop
    console.log("Switching to Dark Mode...");
    const themeToggleBtn = page.locator("#themeToggleBtn");
    await themeToggleBtn.click();
    await page.waitForTimeout(800);

    // Screenshot 4: Desktop Dark Mode
    const s4 = path.join(brainDir, "task5_expenses_page_desktop_dark.png");
    await page.screenshot({ path: s4, fullPage: true });
    console.log(`✓ Saved ${s4}`);

    // 3. Mobile Viewport (390px iPhone width)
    console.log("Testing mobile responsive layout (390x844)...");
    const contextMobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pageMobile = await contextMobile.newPage();
    await pageMobile.addInitScript(() => {
      localStorage.setItem("ps_tab", "expenses");
    });
    await pageMobile.goto("http://localhost:3000/", { waitUntil: "load" });
    await pageMobile.waitForTimeout(1500);

    // Screenshot 5: Mobile Responsive View
    const s5 = path.join(brainDir, "task5_expenses_page_mobile.png");
    await pageMobile.screenshot({ path: s5, fullPage: true });
    console.log(`✓ Saved ${s5}`);

    console.log("=== ALL VISUAL SCREENSHOTS SUCCESSFULLY CAPTURED! ===");
  } catch (err) {
    console.error("Screenshot error:", err);
  } finally {
    await browser.close();
  }
}

takeScreenshots();
