const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Click on "Call Back Later" outcome button
  await page.click('button:has-text("Call Back Later")');
  await page.waitForTimeout(600);

  // Take screenshot of call back time slot picker
  await page.screenshot({ path: 'C:/Users/DELL/.gemini/antigravity/brain/b58e6961-ce56-4899-91b8-d3726fa0db02/telecaller-callback-picker-open.png' });
  console.log('Call back picker open screenshot saved.');

  // Select "Tomorrow 11 AM"
  await page.click('button:has-text("Tomorrow 11 AM")');
  await page.waitForTimeout(1500);

  // Click on Call Backs top tab
  await page.click('button:has-text("Call Backs")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'C:/Users/DELL/.gemini/antigravity/brain/b58e6961-ce56-4899-91b8-d3726fa0db02/telecaller-callbacks-tab-populated.png' });
  console.log('Call backs tab screenshot saved.');

  await browser.close();
})().catch(console.error);
