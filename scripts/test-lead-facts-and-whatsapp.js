const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Take screenshot with default Office Catalog template
  await page.screenshot({ path: 'C:/Users/DELL/.gemini/antigravity/brain/b58e6961-ce56-4899-91b8-d3726fa0db02/telecaller-lead-facts-and-catalog.png' });
  console.log('Lead facts and catalog screenshot saved.');

  // Click on "Tried Calling You" template pill
  await page.click('button:has-text("Tried Calling You")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/DELL/.gemini/antigravity/brain/b58e6961-ce56-4899-91b8-d3726fa0db02/telecaller-tried-calling-template.png' });
  console.log('Tried calling template screenshot saved.');

  // Click on "Factory Pricing" template pill
  await page.click('button:has-text("Factory Pricing")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/DELL/.gemini/antigravity/brain/b58e6961-ce56-4899-91b8-d3726fa0db02/telecaller-factory-pricing-template.png' });
  console.log('Factory pricing template screenshot saved.');

  await browser.close();
})().catch(console.error);
