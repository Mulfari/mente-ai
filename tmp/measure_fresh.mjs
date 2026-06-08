import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  bypassCSP: true,
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
// Wait for cookies to be stable
await page.waitForTimeout(2000);

// Hard reload (no cache) — this is what users do
console.log('Doing hard reload...');

// Disable cache for next request
await context.route('**/*', route => route.continue());

// Use reload with bypass cache
const startTime = Date.now();
await page.reload({ waitUntil: 'commit' });
console.log('Page committed, time elapsed:', Date.now() - startTime);

// Take screenshots and measure over time
const measurements = [];
for (let i = 0; i < 40; i++) {
  const m = await page.evaluate(() => {
    const allDivs = Array.from(document.querySelectorAll('div'));
    const sidebar = allDivs.find(d => d.className.includes('relative shrink-0 hidden') && d.className.includes('md:flex'));
    if (!sidebar) return { error: 'no sidebar' };
    const inner = sidebar.firstElementChild;
    const rect = sidebar.getBoundingClientRect();
    return {
      outerWidth: rect.width,
      innerWidth: inner ? inner.getBoundingClientRect().width : 0,
      innerOpacity: inner ? getComputedStyle(inner).opacity : 0,
    };
  });
  measurements.push({ t: Date.now() - startTime, ...m });
  await page.waitForTimeout(50);
}

const uniqueWidths = [...new Set(measurements.map(m => m.outerWidth))];
console.log('\nUnique widths:', uniqueWidths);
console.log('\nFirst 20 measurements:');
measurements.slice(0, 20).forEach(m => {
  console.log(`  t=${m.t}ms: outerWidth=${m.outerWidth}, innerWidth=${m.innerWidth}, innerOpacity=${m.innerOpacity}`);
});

await browser.close();
