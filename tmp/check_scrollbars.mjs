import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
});

const page = await context.newPage();
await page.goto('https://mulfai.com.ve/chat', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

await page.screenshot({ path: 'C:/Users/joses/Documents/mente-ai/tmp/scrollbars_desktop.png', fullPage: false });

// Check all scrollable elements and their overflow
const result = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('*'));
  const scrollables = all.filter(el => {
    const style = getComputedStyle(el);
    return (style.overflowY === 'auto' || style.overflowY === 'scroll');
  }).map(el => {
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      cls: el.className?.toString().substring(0, 80) ?? '',
      overflow: getComputedStyle(el).overflowY,
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
      overflowPx: el.scrollHeight - el.clientHeight,
      width: rect.width,
      height: rect.height,
      x: rect.x,
      y: rect.y,
    };
  });
  return scrollables;
});

console.log('Scrollable elements:');
result.forEach((s, i) => {
  console.log(`\n[${i}] ${s.tag} .${s.cls}`);
  console.log(`  pos: x=${s.x.toFixed(0)} y=${s.y.toFixed(0)} w=${s.width.toFixed(0)} h=${s.height.toFixed(0)}`);
  console.log(`  overflowY: ${s.overflow}`);
  console.log(`  scrollH=${s.scrollH} clientH=${s.clientH} overflow=${s.overflowPx}px`);
});

// Test at a smaller viewport where the footer might overflow
await page.setViewportSize({ width: 1366, height: 768 });
await page.waitForTimeout(1000);
await page.screenshot({ path: 'C:/Users/joses/Documents/mente-ai/tmp/scrollbars_medium.png', fullPage: false });

const resultMedium = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('*'));
  return all.filter(el => {
    const style = getComputedStyle(el);
    return (style.overflowY === 'auto' || style.overflowY === 'scroll');
  }).map(el => {
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      cls: el.className?.toString().substring(0, 80) ?? '',
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
      overflowPx: el.scrollHeight - el.clientHeight,
    };
  });
});
console.log('\n\n=== 1366x768 ===');
resultMedium.forEach((s, i) => {
  console.log(`[${i}] ${s.tag} .${s.cls}`);
  console.log(`  scrollH=${s.scrollH} clientH=${s.clientH} overflow=${s.overflowPx}px`);
});

// Short viewport
await page.setViewportSize({ width: 1280, height: 600 });
await page.waitForTimeout(1000);
await page.screenshot({ path: 'C:/Users/joses/Documents/mente-ai/tmp/scrollbars_short.png', fullPage: false });

const resultShort = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('*'));
  return all.filter(el => {
    const style = getComputedStyle(el);
    return (style.overflowY === 'auto' || style.overflowY === 'scroll');
  }).map(el => {
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      cls: el.className?.toString().substring(0, 80) ?? '',
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
      overflowPx: el.scrollHeight - el.clientHeight,
    };
  });
});
console.log('\n\n=== 1280x600 ===');
resultShort.forEach((s, i) => {
  console.log(`[${i}] ${s.tag} .${s.cls}`);
  console.log(`  scrollH=${s.scrollH} clientH=${s.clientH} overflow=${s.overflowPx}px`);
});

await browser.close();
