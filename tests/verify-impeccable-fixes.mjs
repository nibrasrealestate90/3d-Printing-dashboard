import { chromium } from "playwright";

const ARTIFACT_DIR = "/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3";

async function run() {
  console.log("🚀 Starting Impeccable UI Defect Fixes Verification...\n");
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
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // ==========================================
    // 1. LAYOUT PROPERTY ANIMATION VERIFICATION
    // ==========================================
    console.log("--- 1. Verifying Layout Property Animations (Zero Reflows) ---");

    const logoTransition = await page.$eval(".sidebar-logo-img", el => window.getComputedStyle(el).transition);
    assert("Logo has NO transition on width or height", !logoTransition.includes("width") && !logoTransition.includes("height"), `Transition: ${logoTransition}`);

    const progressTransition = await page.$eval(".dash-progress-bar", el => window.getComputedStyle(el).transition);
    assert("Progress bar has NO transition on width", !progressTransition.includes("width"), `Transition: ${progressTransition}`);

    const progressBarTransform = await page.$eval(".dash-progress-bar", el => el.style.transform || window.getComputedStyle(el).transform);
    assert("Progress bar uses scaleX transform", progressBarTransform.includes("scaleX") || progressBarTransform.includes("matrix"), `Transform: ${progressBarTransform}`);

    const barVizSpan = await page.$eval(".card-bar-viz span", el => ({
      transition: window.getComputedStyle(el).transition,
      style: el.style.transform || window.getComputedStyle(el).transform
    }));
    assert("Card bar viz span has NO transition on height", !barVizSpan.transition.includes("height"), `Transition: ${barVizSpan.transition}`);
    assert("Card bar viz span uses scaleY transform", barVizSpan.style.includes("scaleY") || barVizSpan.style.includes("matrix"), `Transform: ${barVizSpan.style}`);

    // ==========================================
    // 2. UNDERSIZED FUNCTIONAL TEXT VERIFICATION
    // ==========================================
    console.log("\n--- 2. Verifying Undersized Functional Text (Live Badges) ---");

    const livePillStyles = await page.$eval(".metric-live-pill", el => {
      const cs = window.getComputedStyle(el);
      return {
        fontSize: parseFloat(cs.fontSize),
        fontWeight: parseInt(cs.fontWeight, 10),
        padding: cs.padding
      };
    });
    assert("Live badge font-size is >= 11.5px", livePillStyles.fontSize >= 11.5, `Size: ${livePillStyles.fontSize}px`);
    assert("Live badge font-weight is >= 600", livePillStyles.fontWeight >= 600, `Weight: ${livePillStyles.fontWeight}`);

    // ==========================================
    // 3. LOW CONTRAST & TINY TEXT VERIFICATION
    // ==========================================
    console.log("\n--- 3. Verifying Contrast & Sizing ---");

    // 3.1 Sidebar nav group labels
    const navLabelStyles = await page.$eval(".nav-group-label", el => {
      const cs = window.getComputedStyle(el);
      return {
        fontSize: parseFloat(cs.fontSize),
        fontWeight: parseInt(cs.fontWeight, 10),
        color: cs.color
      };
    });
    assert("Sidebar category label font-size is >= 11px", navLabelStyles.fontSize >= 11, `Size: ${navLabelStyles.fontSize}px`);
    assert("Sidebar category label font-weight is >= 700", navLabelStyles.fontWeight >= 700, `Weight: ${navLabelStyles.fontWeight}`);

    // 3.2 KPI card subtitles
    const kpiSubStyles = await page.$eval(".card-subtitle", el => {
      const cs = window.getComputedStyle(el);
      return {
        fontSize: parseFloat(cs.fontSize),
        fontWeight: parseInt(cs.fontWeight, 10),
        color: cs.color
      };
    });
    assert("KPI card subtitle font-size is >= 12px", kpiSubStyles.fontSize >= 12, `Size: ${kpiSubStyles.fontSize}px`);

    // 3.3 Chart card subtitles
    const chartSubStyles = await page.$eval(".chart-card-subtitle", el => {
      const cs = window.getComputedStyle(el);
      return {
        fontSize: parseFloat(cs.fontSize),
        lineHeight: cs.lineHeight,
        color: cs.color
      };
    });
    assert("Chart card subtitle font-size is >= 12.5px", chartSubStyles.fontSize >= 12.5, `Size: ${chartSubStyles.fontSize}px`);

    // 3.4 Operational section subtitles
    const dashCardSubStyles = await page.$eval(".dash-card-subtitle", el => {
      const cs = window.getComputedStyle(el);
      return {
        fontSize: parseFloat(cs.fontSize),
        color: cs.color
      };
    });
    assert("Operational card subtitle font-size is >= 12.5px", dashCardSubStyles.fontSize >= 12.5, `Size: ${dashCardSubStyles.fontSize}px`);

    // 3.5 Recent print row subtitles
    const rowSubStyles = await page.$eval(".dash-row-subtitle", el => {
      const cs = window.getComputedStyle(el);
      return {
        fontSize: parseFloat(cs.fontSize),
        fontWeight: parseInt(cs.fontWeight, 10),
        color: cs.color
      };
    });
    assert("Recent print row subtitle font-size is >= 12px", rowSubStyles.fontSize >= 12, `Size: ${rowSubStyles.fontSize}px`);

    // 3.6 Top model metadata
    const modelMetaStyles = await page.$eval(".dash-model-meta", el => {
      const cs = window.getComputedStyle(el);
      return {
        fontSize: parseFloat(cs.fontSize),
        fontWeight: parseInt(cs.fontWeight, 10),
        color: cs.color
      };
    });
    assert("Top model metadata font-size is >= 12px", modelMetaStyles.fontSize >= 12, `Size: ${modelMetaStyles.fontSize}px`);

    // ==========================================
    // 4. TYPOGRAPHY PAIRING (MONO ACCENTS)
    // ==========================================
    console.log("\n--- 4. Verifying Typography Pairing & Tabular Numerics ---");

    const durationFont = await page.$eval(".dash-row-duration", el => window.getComputedStyle(el).fontFamily.toLowerCase());
    assert("Recent print duration uses monospace font", durationFont.includes("mono") || durationFont.includes("geist"), `Font: ${durationFont}`);

    const modelCountFont = await page.$eval(".dash-model-count", el => window.getComputedStyle(el).fontFamily.toLowerCase());
    assert("Top model count uses monospace font", modelCountFont.includes("mono") || modelCountFont.includes("geist"), `Font: ${modelCountFont}`);

    const statNumberFont = await page.$eval(".stat-number", el => window.getComputedStyle(el).fontFamily.toLowerCase());
    assert("Chart stat number uses monospace font", statNumberFont.includes("mono") || statNumberFont.includes("geist"), `Font: ${statNumberFont}`);

    // Take Light Mode Screenshot
    await page.screenshot({ path: `${ARTIFACT_DIR}/dashboard_impeccable_fixes_light.png` });
    console.log("\n  📸 Saved dashboard_impeccable_fixes_light.png");

    // ==========================================
    // 5. DARK MODE CONTRAST VERIFICATION
    // ==========================================
    console.log("\n--- 5. Verifying Dark Mode Contrast & Sizing ---");
    await page.click("#themeToggleBtn");
    await page.waitForTimeout(500);

    const darkNavLabelColor = await page.$eval(".nav-group-label", el => window.getComputedStyle(el).color);
    assert("Dark mode nav label has bright readable color", darkNavLabelColor !== "rgb(98, 139, 138)", `Color: ${darkNavLabelColor}`);

    const darkLivePillColor = await page.$eval(".metric-live-pill", el => window.getComputedStyle(el).color);
    assert("Dark mode live pill has crisp text", darkLivePillColor.includes("255, 255, 255") || darkLivePillColor.includes("233, 246, 246"), `Color: ${darkLivePillColor}`);

    await page.screenshot({ path: `${ARTIFACT_DIR}/dashboard_impeccable_fixes_dark.png` });
    console.log("  📸 Saved dashboard_impeccable_fixes_dark.png");

    // Revert to light mode
    await page.click("#themeToggleBtn");
    await page.waitForTimeout(300);

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
