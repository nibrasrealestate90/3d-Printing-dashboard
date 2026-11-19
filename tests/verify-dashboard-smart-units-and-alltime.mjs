import { chromium } from "playwright";

async function verifyDashboardSmartUnitsAndAllTime() {
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

  // Ensure on Dashboard
  await page.click('button[data-tab="dashboard"]');
  await page.waitForTimeout(300);

  // Helper to read KPI cards
  async function getKpiCardValues() {
    return await page.$$eval(".metric-card", cards => {
      return cards.map(c => ({
        label: c.querySelector(".card-label")?.textContent?.trim() || "",
        value: c.querySelector(".card-value")?.textContent?.trim() || "",
        subtitle: c.querySelector(".card-subtitle")?.textContent?.trim() || ""
      }));
    });
  }

  // Helper to read Chart Header stats
  async function getChartHeaderStats() {
    const timeStat = await page.$eval("#printTimeCard .chart-card-stat", el => el.textContent.trim().replace(/\s+/g, " "));
    const filStat = await page.$eval("#filamentUsageCard .chart-card-stat", el => el.textContent.trim().replace(/\s+/g, " "));
    return { timeStat, filStat };
  }

  // Helper to read Bottom Cards subtitles and row counts
  async function getBottomCardsInfo() {
    const activitySubtitle = await page.$eval(".dash-activity-card .dash-card-subtitle", el => el.textContent.trim());
    const modelsSubtitle = await page.$eval(".dash-models-card .dash-card-subtitle", el => el.textContent.trim());
    const activityRowCount = await page.$$eval(".dash-activity-row", rows => rows.length);
    const modelsRowCount = await page.$$eval(".dash-model-row", rows => rows.length);
    const topModelName = await page.$eval(".dash-model-name", el => el.textContent.trim());
    const topModelCount = await page.$eval(".dash-model-count", el => el.textContent.trim());
    return { activitySubtitle, modelsSubtitle, activityRowCount, modelsRowCount, topModelName, topModelCount };
  }

  // 1. Test 24H timeframe
  console.log("\n--- TEST 1: Timeframe 24H Smart Units ---");
  await page.click('button[data-crange="24h"]');
  await page.waitForTimeout(300);

  const kpis24h = await getKpiCardValues();
  const filCard24h = kpis24h.find(k => k.label === "Filament Used");
  const timeCard24h = kpis24h.find(k => k.label === "Total Print Time");
  console.log("24H Filament KPI:", filCard24h);
  console.log("24H Time KPI:", timeCard24h);

  assert("24H Filament Used displays in grams (<1000g)", filCard24h?.value.endsWith(" g"), `Value: ${filCard24h?.value}`);
  assert("24H Filament Subtitle displays in grams", filCard24h?.subtitle.includes("g"), `Subtitle: ${filCard24h?.subtitle}`);
  assert("24H Filament does NOT display 0.0 kg", !filCard24h?.value.includes("0.0 kg") && !filCard24h?.subtitle.includes("0.0kg"));

  const charts24h = await getChartHeaderStats();
  console.log("24H Chart Stats:", charts24h);
  assert("24H Filament Usage chart header matches KPI card", charts24h.filStat === filCard24h?.value, `Found: ${charts24h.filStat} vs ${filCard24h?.value}`);
  assert("24H Print Time chart header matches KPI card", charts24h.timeStat === timeCard24h?.value, `Found: ${charts24h.timeStat} vs ${timeCard24h?.value}`);

  // Check bottom operational cards in 24H (must be unfiltered / all-time)
  const bottom24h = await getBottomCardsInfo();
  console.log("24H Bottom Cards:", bottom24h);
  assert("24H Recent Activity subtitle is 'Latest 5 print jobs across your studio'", bottom24h.activitySubtitle === "Latest 5 print jobs across your studio");
  assert("24H Top Models subtitle is 'All-time most produced models'", bottom24h.modelsSubtitle === "All-time most produced models");
  assert("24H Recent Activity displays 5 jobs", bottom24h.activityRowCount === 5, `Count: ${bottom24h.activityRowCount}`);
  assert("24H Top Models displays 5 all-time models", bottom24h.modelsRowCount === 5, `Count: ${bottom24h.modelsRowCount}`);
  assert("24H Top Model #1 is 'Lighted LED Clickers' with 27 pcs", bottom24h.topModelName === "Lighted LED Clickers" && bottom24h.topModelCount === "27 pcs");

  await page.screenshot({ path: `${brainDir}/dashboard_smart_units_24h.png` });

  // 2. Test 7D timeframe
  console.log("\n--- TEST 2: Timeframe 7D Smart Units ---");
  await page.click('button[data-crange="7d"]');
  await page.waitForTimeout(300);

  const kpis7d = await getKpiCardValues();
  const filCard7d = kpis7d.find(k => k.label === "Filament Used");
  const charts7d = await getChartHeaderStats();
  console.log("7D Filament KPI:", filCard7d);
  console.log("7D Chart Stats:", charts7d);

  const timeCard7d = kpis7d.find(k => k.label === "Total Print Time");
  assert("7D Filament Used format matches grams/kg rule", filCard7d?.value.endsWith(" kg") || filCard7d?.value.endsWith(" g"), `Value: ${filCard7d?.value}`);
  assert("7D Filament Usage chart header matches KPI card", charts7d.filStat === filCard7d?.value, `Found: ${charts7d.filStat} vs ${filCard7d?.value}`);
  assert("7D Print Time chart header matches KPI card", charts7d.timeStat === timeCard7d?.value, `Found: ${charts7d.timeStat} vs ${timeCard7d?.value}`);

  // Verify bottom cards remain all-time
  const bottom7d = await getBottomCardsInfo();
  assert("7D Bottom cards remain all-time with 5 items each", bottom7d.activityRowCount === 5 && bottom7d.modelsRowCount === 5);

  await page.screenshot({ path: `${brainDir}/dashboard_smart_units_7d.png` });

  // 3. Test 30D timeframe
  console.log("\n--- TEST 3: Timeframe 30D Smart Units ---");
  await page.click('button[data-crange="30d"]');
  await page.waitForTimeout(300);

  const kpis30d = await getKpiCardValues();
  const filCard30d = kpis30d.find(k => k.label === "Filament Used");
  const timeCard30d = kpis30d.find(k => k.label === "Total Print Time");
  const charts30d = await getChartHeaderStats();
  console.log("30D Filament KPI:", filCard30d);
  console.log("30D Chart Stats:", charts30d);

  assert("30D Filament Used displays in kilograms (>=1000g)", filCard30d?.value.endsWith(" kg"), `Value: ${filCard30d?.value}`);
  assert("30D Filament Usage chart header matches KPI card", charts30d.filStat === filCard30d?.value, `Found: ${charts30d.filStat} vs ${filCard30d?.value}`);
  assert("30D Print Time chart header matches KPI card", charts30d.timeStat === timeCard30d?.value, `Found: ${charts30d.timeStat} vs ${timeCard30d?.value}`);

  await page.screenshot({ path: `${brainDir}/dashboard_smart_units_30d.png` });

  // 4. Test ALL timeframe
  console.log("\n--- TEST 4: Timeframe ALL Smart Units ---");
  await page.click('button[data-crange="all"]');
  await page.waitForTimeout(300);

  const kpisAll = await getKpiCardValues();
  const filCardAll = kpisAll.find(k => k.label === "Filament Used");
  const timeCardAll = kpisAll.find(k => k.label === "Total Print Time");
  const chartsAll = await getChartHeaderStats();
  console.log("ALL Filament KPI:", filCardAll);
  console.log("ALL Chart Stats:", chartsAll);

  assert("ALL Filament Used displays in kilograms (>=1000g)", filCardAll?.value.endsWith(" kg"), `Value: ${filCardAll?.value}`);
  assert("ALL Filament Usage chart header matches KPI card", chartsAll.filStat === filCardAll?.value, `Found: ${chartsAll.filStat} vs ${filCardAll?.value}`);
  assert("ALL Print Time chart header matches KPI card", chartsAll.timeStat === timeCardAll?.value, `Found: ${chartsAll.timeStat} vs ${timeCardAll?.value}`);

  await page.screenshot({ path: `${brainDir}/dashboard_smart_units_all.png` });

  // 5. Dark Mode Verification
  console.log("\n--- TEST 5: Dark Mode Verification ---");
  await page.click("#themeToggleBtn");
  await page.waitForTimeout(300);

  await page.click('button[data-crange="24h"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${brainDir}/dashboard_smart_units_24h_dark.png` });

  await page.click('button[data-crange="30d"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${brainDir}/dashboard_smart_units_30d_dark.png` });

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
    console.log("ALL 20 CHECKS PASSED PERFECTLY!");
  }
}

verifyDashboardSmartUnitsAndAllTime().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
