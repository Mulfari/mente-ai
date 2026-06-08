import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();

const page = await context.newPage();
await page.goto('https://mulfai.com.ve/chat', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

// Test at user's typical viewport (1440x900 is common for laptops)
const viewports = [
  { name: '1920x1080', w: 1920, h: 1080 },
  { name: '1440x900', w: 1440, h: 900 },
  { name: '1366x768', w: 1366, h: 768 },
];

for (const vp of viewports) {
  await page.setViewportSize({ width: vp.w, height: vp.h });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `C:/Users/joses/Documents/mente-ai/tmp/sb_${vp.name}.png`, fullPage: false });

  const result = await page.evaluate(() => {
    const main = document.querySelector('main');
    // The footer is the absolute div with the bottom-0
    const footers = Array.from(document.querySelectorAll('div.absolute.left-0.right-0'));
    const footer = footers.find(d => {
      const s = getComputedStyle(d);
      return s.overflowY === 'auto' && s.bottom === '0px';
    });
    // Check if main has visible scrollbar
    const mainHasScrollbar = main && main.scrollHeight > main.clientHeight;
    // Check if footer has visible scrollbar
    const footerHasScrollbar = footer && footer.scrollHeight > footer.clientHeight;

    // Also check the input wrapper and hero
    const input = document.querySelector('div.absolute.inset-x-0.top-1\\/2');
    return {
      mainScrollH: main?.scrollHeight,
      mainClientH: main?.clientHeight,
      mainOverflow: main ? main.scrollHeight - main.clientHeight : null,
      mainHasScrollbar,
      footerScrollH: footer?.scrollHeight,
      footerClientH: footer?.clientHeight,
      footerOverflow: footer ? footer.scrollHeight - footer.clientHeight : null,
      footerHasScrollbar,
      footerY: footer ? footer.getBoundingClientRect().y : null,
      footerH: footer ? footer.getBoundingClientRect().height : null,
    };
  });
  console.log(`\n=== ${vp.name} ===`);
  console.log(JSON.stringify(result, null, 2));
}

await browser.close();
