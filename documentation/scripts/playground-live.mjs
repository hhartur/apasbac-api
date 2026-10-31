// Dev helper: drives the playground against a running API and saves a screenshot.
// node scripts/playground-live.mjs <docsUrl> <screenshot.png>
import { chromium } from '@playwright/test';

const [docs, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
await page.goto(`${docs}/playground`);
await page.getByLabel('Endpoint').selectOption({ label: 'GET /events/categories — Lista categorias de eventos' });
await page.getByTestId('playground-send').click();
const status = page.getByTestId('playground').locator('[aria-live="polite"] span').first();
await status.waitFor({ timeout: 15000 });
console.log('status:', await status.textContent());
console.log('body has Adoção:', (await page.getByTestId('playground').locator('pre').textContent()).includes('Adoção'));
await page.screenshot({ path: out, fullPage: false });
await browser.close();
