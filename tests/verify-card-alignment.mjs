import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Wait for dashboard elements to load
  await page.waitForSelector('.production-charts-grid');
  await page.waitForSelector('.dash-bottom-grid');

  const measurements = await page.evaluate(() => {
    const chartsGrid = document.querySelector('.production-charts-grid');
    const bottomGrid = document.querySelector('.dash-bottom-grid');

    const chartCards = document.querySelectorAll('.production-chart-card');
    const activityCard = document.querySelector('.dash-activity-card');
    const modelsCard = document.querySelector('.dash-models-card');

    const chartsGridRect = chartsGrid.getBoundingClientRect();
    const bottomGridRect = bottomGrid.getBoundingClientRect();

    const chartCardLeftRect = chartCards[0].getBoundingClientRect();
    const chartCardRightRect = chartCards[1].getBoundingClientRect();

    const activityCardRect = activityCard.getBoundingClientRect();
    const modelsCardRect = modelsCard.getBoundingClientRect();

    return {
      chartsGrid: { width: chartsGridRect.width, left: chartsGridRect.left, right: chartsGridRect.right },
      bottomGrid: { width: bottomGridRect.width, left: bottomGridRect.left, right: bottomGridRect.right },
      upperLeftCard: { width: chartCardLeftRect.width, left: chartCardLeftRect.left, right: chartCardLeftRect.right },
      upperRightCard: { width: chartCardRightRect.width, left: chartCardRightRect.left, right: chartCardRightRect.right },
      lowerLeftCard: { width: activityCardRect.width, left: activityCardRect.left, right: activityCardRect.right },
      lowerRightCard: { width: modelsCardRect.width, left: modelsCardRect.left, right: modelsCardRect.right },
      gapCharts: chartCardRightRect.left - chartCardLeftRect.right,
      gapBottom: modelsCardRect.left - activityCardRect.right,
    };
  });

  console.log('Measurements:', JSON.stringify(measurements, null, 2));

  const widthDiffLeft = Math.abs(measurements.upperLeftCard.width - measurements.lowerLeftCard.width);
  const widthDiffRight = Math.abs(measurements.upperRightCard.width - measurements.lowerRightCard.width);
  const leftAlignDiff = Math.abs(measurements.upperLeftCard.left - measurements.lowerLeftCard.left);
  const rightAlignDiff = Math.abs(measurements.upperRightCard.right - measurements.lowerRightCard.right);
  const centerSeamDiff = Math.abs(measurements.upperLeftCard.right - measurements.lowerLeftCard.right);

  console.log(`Left card width difference: ${widthDiffLeft.toFixed(2)}px`);
  console.log(`Right card width difference: ${widthDiffRight.toFixed(2)}px`);
  console.log(`Left edge alignment diff: ${leftAlignDiff.toFixed(2)}px`);
  console.log(`Right edge alignment diff: ${rightAlignDiff.toFixed(2)}px`);
  console.log(`Center seam alignment diff: ${centerSeamDiff.toFixed(2)}px`);

  if (widthDiffLeft < 1 && widthDiffRight < 1 && centerSeamDiff < 1) {
    console.log('✅ SUCCESS: Upper and bottom cards are perfectly aligned in size and position!');
  } else {
    console.error('❌ FAILURE: Cards are not aligned properly.');
    process.exit(1);
  }

  // Take screenshot in light mode
  const lightPath = '/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3/dashboard_aligned_cards_light.png';
  await page.screenshot({ path: lightPath });
  console.log('Saved screenshot:', lightPath);

  // Toggle dark mode and take screenshot
  await page.click('#themeToggleBtn');
  await page.waitForTimeout(500);
  const darkPath = '/Users/subhamsantra/.gemini/antigravity/brain/b55c1081-e4ef-49c4-a58e-dc6638c605c3/dashboard_aligned_cards_dark.png';
  await page.screenshot({ path: darkPath });
  console.log('Saved screenshot:', darkPath);

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
