const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Click on Balas Office Furniture (second card)
  const balasCard = page.locator('text=Balas Office Furniture');
  if (await balasCard.count() > 0) {
    await balasCard.click();
    await page.waitForTimeout(1000);

    // Click "Call Back Later"
    const callbackBtn = page.locator('button:has-text("Call Back Later")');
    await callbackBtn.click();
    await page.waitForTimeout(500);

    // Pick "Tomorrow 11 AM"
    const timeBtn = page.locator('button:has-text("Tomorrow 11 AM")');
    if (await timeBtn.count() > 0) {
      await timeBtn.click();
      await page.waitForTimeout(1500);
    }
  }

  const shotPath = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\b58e6961-ce56-4899-91b8-d3726fa0db02\\telecaller-callback-amber-color-coded.png';
  await page.screenshot({ path: shotPath, fullPage: false });
  console.log('Saved callback amber screenshot to:', shotPath);

  await browser.close();
})();
