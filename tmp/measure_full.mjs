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
await page.waitForTimeout(2000);

// Hard reload
const startTime = Date.now();
await page.reload({ waitUntil: 'commit' });
console.log('Page committed, t=0');

// Take screenshots and full measurements over time
for (const target of [50, 200, 500, 800, 1100, 1500, 2000, 3000]) {
  const wait = target - (Date.now() - startTime);
  if (wait > 0) await page.waitForTimeout(wait);
  
  await page.screenshot({ path: `C:/Users/joses/Documents/mente-ai/tmp/full_${target}ms.png`, fullPage: false });
  
  const m = await page.evaluate(() => {
    const allDivs = Array.from(document.querySelectorAll('div'));
    const sidebar = allDivs.find(d => d.className.includes('relative shrink-0 hidden') && d.className.includes('md:flex'));
    const main = document.querySelector('main');
    const hero = document.querySelector('h1');
    const footer = document.querySelectorAll('.absolute.left-0.right-0.px-4')[0];
    const input = document.querySelector('textarea, [contenteditable]');
    const iniciar = document.body.textContent.includes('Iniciar sesión');
    const salvador = document.body.textContent.includes('Salvador');
    
    return {
      sidebarWidth: sidebar ? sidebar.getBoundingClientRect().width : null,
      mainText: main ? main.textContent.substring(0, 200) : null,
      heroText: hero ? hero.textContent : null,
      hasIniciar: iniciar,
      hasSalvador: salvador,
      bodyHasIniciar: iniciar,
      bodyHasSalvador: salvador,
    };
  });
  console.log(`\n=== t=${Date.now() - startTime}ms ===`);
  console.log(`  sidebarWidth: ${m.sidebarWidth}`);
  console.log(`  heroText: ${m.heroText}`);
  console.log(`  hasIniciar: ${m.hasIniciar}, hasSalvador: ${m.hasSalvador}`);
}

await browser.close();
