const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3001...');
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Take screenshot of All Leads list with color-coding
  const shotPath = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\b58e6961-ce56-4899-91b8-d3726fa0db02\\telecaller-color-coded-all-leads.png';
  await page.screenshot({ path: shotPath, fullPage: false });
  console.log('Screenshot saved to:', shotPath);

  // Click on "Interested" button in right panel to verify it turns green in-place without disappearing
  const interestedBtn = page.locator('button:has-text("Interested")').filter({ hasText: 'Wants quotation' });
  if (await interestedBtn.count() > 0) {
    console.log('Clicking Interested button...');
    await interestedBtn.click();
    await page.waitForTimeout(1500);

    const shotAfterInterested = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\b58e6961-ce56-4899-91b8-d3726fa0db02\\telecaller-after-interested-color-coded.png';
    await page.screenshot({ path: shotAfterInterested, fullPage: false });
    console.log('Screenshot after Interested saved to:', shotAfterInterested);
  }

  await browser.close();
})();
