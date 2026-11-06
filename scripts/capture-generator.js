const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3001/generator', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'C:/Users/DELL/.gemini/antigravity/brain/b58e6961-ce56-4899-91b8-d3726fa0db02/desktop-generator-leads-loaded.png' });
  const streamText = await page.locator('h3').filter({ hasText: 'Live Candidate Stream' }).innerText();
  console.log('Stream header:', streamText);
  const leadsCards = await page.locator('div:has-text("Score")').count();
  console.log('Cards found:', leadsCards);
  await browser.close();
})().catch(console.error);
