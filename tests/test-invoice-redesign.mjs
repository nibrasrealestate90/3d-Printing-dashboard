import { chromium } from "playwright";

async function verifyInvoiceRedesign() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // Disable pointer events on nextjs dev overlay if present
  await page.addStyleTag({ content: "nextjs-portal { pointer-events: none !important; }" });

  const brainDir = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3";

  // Open Invoice Modal
  console.log("Opening New Invoice Modal...");
  await page.click("#topNewInvoiceBtn");
  await page.waitForSelector("#iform", { state: "visible" });
  await page.waitForTimeout(400);

  // Take screenshot in Light Mode
  console.log("Capturing Light Mode Invoice Modal...");
  await page.screenshot({ path: `${brainDir}/invoice_redesign_light.png` });

  // Take dedicated modal element screenshot
  const modalEl = await page.$(".modal.invoice-modal");
  if (modalEl) {
    await modalEl.screenshot({ path: `${brainDir}/invoice_modal_light.png` });
  }

  // Close modal via close button
  await page.click("#modalCloseX");
  await page.waitForSelector("#iform", { state: "hidden" });
  await page.waitForTimeout(300);

  // Toggle Dark Mode
  console.log("Switching to Dark Mode...");
  await page.click("#themeToggleBtn");
  await page.waitForTimeout(400);

  // Re-open Invoice Modal in Dark Mode
  await page.click("#topNewInvoiceBtn");
  await page.waitForSelector("#iform", { state: "visible" });
  await page.waitForTimeout(400);

  // Add a line item and test live calculations
  console.log("Testing live line addition & calculations...");
  await page.click("#iadd");
  await page.waitForTimeout(200);

  // Fill line 1 qty and price
  const qtyInputs = await page.$$(".inv-td-qty input");
  const priceInputs = await page.$$(".inv-td-price input");
  if (qtyInputs[0] && priceInputs[0]) {
    await qtyInputs[0].fill("3");
    await priceInputs[0].fill("45.00");
  }

  // Set discount and payment
  await page.fill("#i_discount", "15.00");
  await page.fill("#i_paid", "100.00");
  await page.waitForTimeout(300);

  // Take screenshot in Dark Mode with filled items
  console.log("Capturing Dark Mode Invoice Modal...");
  await page.screenshot({ path: `${brainDir}/invoice_redesign_dark.png` });
  const modalElDark = await page.$(".modal.invoice-modal");
  if (modalElDark) {
    await modalElDark.screenshot({ path: `${brainDir}/invoice_modal_dark.png` });
  }

  // Cancel modal
  await page.click("#mCancel");
  await page.waitForSelector("#iform", { state: "hidden" });

  await browser.close();
  console.log("Invoice redesign verification completed successfully!");
}

verifyInvoiceRedesign().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
