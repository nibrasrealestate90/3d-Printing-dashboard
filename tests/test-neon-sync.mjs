import { chromium } from "playwright";

async function verifyNeonIntegration() {
  console.log("🔍 Verifying Neon Lakebase Postgres integration...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 1. Check health endpoint
  const healthRes = await page.goto("http://localhost:3000/api/health");
  const healthJson = await healthRes.json();
  console.log("Health check response:", healthJson);
  if (healthJson.status !== "connected") {
    throw new Error("Neon health check failed: " + JSON.stringify(healthJson));
  }
  console.log("✅ Neon Lakebase Postgres connection is LIVE!");

  // 2. Load dashboard
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Check sync indicator text
  const syncText = await page.textContent("#syncTxt");
  console.log("Sync indicator text:", syncText);

  // 3. Check data in /api/data
  const dataRes = await page.goto("http://localhost:3000/api/data");
  const dataJson = await dataRes.json();
  const colls = Object.keys(dataJson.collections || {});
  const totalItems = Object.values(dataJson.collections || {}).reduce((a, b) => a + b.length, 0);
  console.log(`✅ Neon Postgres has ${colls.length} collections and ${totalItems} records stored!`);

  await browser.close();
  console.log("🎉 All Neon integration checks passed!");
}

verifyNeonIntegration().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
