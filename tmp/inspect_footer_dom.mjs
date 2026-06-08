import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

const page = await context.newPage();
await page.goto('https://mulfai.com.ve/chat', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);

const result = await page.evaluate(() => {
  // Find all divs with absolute positioning
  const absolutes = Array.from(document.querySelectorAll('div[class*="absolute"]'));
  return absolutes.map(d => {
    const s = getComputedStyle(d);
    const r = d.getBoundingClientRect();
    return {
      cls: d.className.substring(0, 100),
      position: s.position,
      top: s.top,
      bottom: s.bottom,
      left: s.left,
      right: s.right,
      overflowY: s.overflowY,
      width: r.width,
      height: r.height,
      x: r.x,
      y: r.y,
      childCount: d.children.length,
      firstChildCls: d.children[0]?.className?.substring(0, 60) ?? null,
      firstChildOverflow: d.children[0] ? getComputedStyle(d.children[0]).overflowY : null,
    };
  });
});
console.log(JSON.stringify(result, null, 2));

await browser.close();
