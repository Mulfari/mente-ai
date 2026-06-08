import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();

const page = await context.newPage();
await page.goto('https://mulfai.com.ve/chat', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

const viewports = [
  { name: '1920x1080', w: 1920, h: 1080 },
  { name: '1440x900', w: 1440, h: 900 },
  { name: '1366x768', w: 1366, h: 768 },
];

for (const vp of viewports) {
  await page.setViewportSize({ width: vp.w, height: vp.h });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `C:/Users/joses/Documents/mente-ai/tmp/scrollpos_${vp.name}.png`, fullPage: false });

  const result = await page.evaluate(() => {
    const main = document.querySelector('main');

    // Find the outer footer wrapper (absolute, left-0 right-0)
    const outerFooter = Array.from(document.querySelectorAll('div.absolute.left-0.right-0')).find(d => {
      const s = getComputedStyle(d);
      return s.top.includes('calc(50%') && s.bottom === '0px';
    });
    // The inner scrollable div is the first child of the outer footer
    const innerScroll = outerFooter?.querySelector(':scope > div');

    return {
      mainScrollH: main?.scrollHeight,
      mainClientH: main?.clientHeight,
      mainOverflow: main ? main.scrollHeight - main.clientHeight : null,
      outerScrollH: outerFooter?.scrollHeight,
      outerClientH: outerFooter?.clientHeight,
      outerOverflow: outerFooter ? outerFooter.scrollHeight - outerFooter.clientHeight : null,
      innerScrollH: innerScroll?.scrollHeight,
      innerClientH: innerScroll?.clientHeight,
      innerOverflow: innerScroll ? innerScroll.scrollHeight - innerScroll.clientHeight : null,
      innerWidth: innerScroll?.getBoundingClientRect().width,
      innerX: innerScroll?.getBoundingClientRect().x,
      innerHasScrollbar: innerScroll && innerScroll.scrollHeight > innerScroll.clientHeight,
    };
  });
  console.log(`\n=== ${vp.name} ===`);
  console.log(JSON.stringify(result, null, 2));
}

await browser.close();
