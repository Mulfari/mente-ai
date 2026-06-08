import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
});

const page = await context.newPage();
await page.goto('https://mulfai.com.ve/chat', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
console.log('Initial load URL:', page.url());

const loginBtn = await page.$('button:has-text("Iniciar sesión")');
console.log('Login button found:', !!loginBtn);

const startTime = Date.now();
await page.reload({ waitUntil: 'commit' });
console.log('Page committed, t=0');

// Sample every 100ms for 4 seconds. Capture: main scrollHeight/clientHeight,
// main clientWidth, and whether the scrollbar would be visible.
let maxOverflow = 0;
let maxOverflowAt = 0;
let maxOverflowSnapshot = null;
let samples = 0;
let overflowSamples = 0;

for (let i = 0; i < 40; i++) {
  const target = (i + 1) * 100;
  const wait = target - (Date.now() - startTime);
  if (wait > 0) await page.waitForTimeout(wait);

  const m = await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return null;
    return {
      scrollH: main.scrollHeight,
      clientH: main.clientHeight,
      clientW: main.clientWidth,
      overflowPx: main.scrollHeight - main.clientHeight,
    };
  });
  samples++;
  if (m && m.overflowPx > 0) {
    overflowSamples++;
    if (m.overflowPx > maxOverflow) {
      maxOverflow = m.overflowPx;
      maxOverflowAt = Date.now() - startTime;
      maxOverflowSnapshot = m;
    }
  }
  if (i % 5 === 0) {
    console.log(`t=${Date.now() - startTime}ms: scrollH=${m?.scrollH} clientH=${m?.clientH} clientW=${m?.clientW} overflow=${m?.overflowPx}`);
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Total samples: ${samples}`);
console.log(`Samples with overflow > 0: ${overflowSamples}`);
console.log(`Max overflow: ${maxOverflow}px at t=${maxOverflowAt}ms`);
console.log(`Max overflow snapshot:`, maxOverflowSnapshot);

if (maxOverflow === 0) {
  console.log('\n✓ FIX VERIFIED: main never overflowed during load. No scrollbar flash.');
} else {
  console.log(`\n✗ FIX FAILED: main overflowed by up to ${maxOverflow}px at t=${maxOverflowAt}ms.`);
}

await browser.close();
