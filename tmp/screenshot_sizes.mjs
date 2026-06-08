import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

const page = await context.newPage();
await page.goto('https://mulfai.com.ve/chat', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await page.screenshot({ path: 'C:/Users/joses/Documents/mente-ai/tmp/sizes_desktop.png', fullPage: false });

await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'C:/Users/joses/Documents/mente-ai/tmp/sizes_1440.png', fullPage: false });

await browser.close();
console.log('Screenshots saved.');
