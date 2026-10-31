// Dev helper: node scripts/screenshot.mjs <outDir> <path> [path...]  (server on http://localhost:3001)
import { chromium } from '@playwright/test';

const [out, ...paths] = process.argv.slice(2);
const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport, colorScheme: theme });
    for (const p of paths) {
      await page.goto(`http://localhost:3001${p}`, { waitUntil: 'load' }); await page.waitForTimeout(400);
      const file = `${out}/${(p.replace(/\W+/g, '_') || 'home')}-${name}-${theme}.png`;
      await page.screenshot({ path: file, fullPage: false });
      console.log(file);
    }
    await page.close();
  }
}
await browser.close();
