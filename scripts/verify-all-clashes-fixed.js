const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 1. Initial State: New Calls view
  await page.screenshot({ path: 'C:/Users/DELL/.gemini/antigravity/brain/b58e6961-ce56-4899-91b8-d3726fa0db02/telecaller-fixed-new-calls.png' });
  console.log('1. New Calls screenshot saved.');

  // 2. Click "Interested" on active lead
  await page.click('button:has-text("Interested")');
  await page.waitForTimeout(1500);

  // 3. Switch to "Interested Deals" tab
  await page.click('button:has-text("Interested Deals")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'C:/Users/DELL/.gemini/antigravity/brain/b58e6961-ce56-4899-91b8-d3726fa0db02/telecaller-fixed-interested-tab.png' });
  console.log('2. Interested Deals tab screenshot saved.');

  // 4. Switch to "Call Backs" tab to verify right panel sync
  await page.click('button:has-text("Call Backs")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'C:/Users/DELL/.gemini/antigravity/brain/b58e6961-ce56-4899-91b8-d3726fa0db02/telecaller-fixed-callbacks-sync.png' });
  console.log('3. Call Backs tab sync screenshot saved.');

  await browser.close();
})().catch(console.error);
