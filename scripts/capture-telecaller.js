const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Take full desk screenshot
  await page.screenshot({ path: 'C:/Users/DELL/.gemini/antigravity/brain/b58e6961-ce56-4899-91b8-d3726fa0db02/telecaller-desk-live.png' });

  // Locate the leads queue scroll container
  const leadsQueue = page.locator('div.w-\\[380px\\], div.w-\\[400px\\], div[class*="w-"]').first();
  // Print first 8 leads content from DOM
  const leadCards = await page.locator('div[class*="rounded-xl"][class*="cursor-pointer"]').all();
  console.log(`Total lead cards found: ${leadCards.length}`);
  
  for (let i = 0; i < Math.min(8, leadCards.length); i++) {
    const text = await leadCards[i].innerText();
    console.log(`--- LEAD ${i + 1} ---`);
    console.log(text.replace(/\n+/g, ' | '));
  }

  // Clip the left sidebar containing the leads list
  await page.screenshot({
    path: 'C:/Users/DELL/.gemini/antigravity/brain/b58e6961-ce56-4899-91b8-d3726fa0db02/telecaller-leads-queue-clean.png',
    clip: { x: 0, y: 70, width: 440, height: 750 }
  });

  await browser.close();
  console.log('Done capturing live view.');
})().catch(console.error);
