import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
});

const page = await context.newPage();
await page.goto('https://mulfai.com.ve/chat', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

const loginBtn = await page.$('button:has-text("Iniciar sesión")');
if (loginBtn) {
  await loginBtn.click();
  await page.waitForTimeout(1500);
  
  const emailInput = await page.$('input[type="email"]');
  const passwordInput = await page.$('input[type="password"]');
  if (emailInput && passwordInput) {
    await emailInput.fill('josesalvador0102@gmail.com');
    await passwordInput.fill('123456789');
    const submit = await page.$('button[type="submit"]');
    if (submit) {
      await submit.click();
      await page.waitForTimeout(5000);
    }
  }
}

console.log('Logged in, URL:', page.url());

// Now navigate to chat and measure the sidebar over time
console.log('Reloading chat to measure...');

const startTime = Date.now();
await page.goto('https://mulfai.com.ve/chat', { waitUntil: 'commit' });
console.log('Page committed');

// Measure sidebar dimensions over time
const measurements = [];
for (let i = 0; i < 30; i++) {
  const m = await page.evaluate(() => {
    // Find sidebar by specific class
    const allDivs = Array.from(document.querySelectorAll('div'));
    const sidebar = allDivs.find(d => d.className.includes('relative shrink-0 hidden') && d.className.includes('md:flex'));
    if (!sidebar) return { error: 'no sidebar' };
    const inner = sidebar.firstElementChild;
    const rect = sidebar.getBoundingClientRect();
    const innerRect = inner ? inner.getBoundingClientRect() : { width: 0, opacity: 0 };
    const innerStyle = inner ? inner.getAttribute('style') : '';
    return {
      outerWidth: rect.width,
      innerWidth: innerRect.width,
      innerOpacity: inner ? getComputedStyle(inner).opacity : 0,
      innerClasses: inner ? inner.className : '',
      outerStyle: sidebar.getAttribute('style')?.substring(0, 100),
    };
  });
  measurements.push({ t: Date.now() - startTime, ...m });
  await page.waitForTimeout(100);
}

// Print unique widths
const uniqueWidths = [...new Set(measurements.map(m => m.outerWidth))];
console.log('Unique widths:', uniqueWidths);
console.log('Unique inner opacity:', [...new Set(measurements.map(m => m.innerOpacity))]);
console.log('Unique inner classes:', [...new Set(measurements.map(m => m.innerClasses))]);
console.log('\nFirst 15 measurements:');
measurements.slice(0, 15).forEach(m => {
  console.log(`  t=${m.t}ms: outerWidth=${m.outerWidth}, innerWidth=${m.innerWidth}, innerOpacity=${m.innerOpacity}`);
  if (m.innerClasses) console.log(`    classes: ${m.innerClasses.substring(0, 100)}`);
});

await browser.close();
