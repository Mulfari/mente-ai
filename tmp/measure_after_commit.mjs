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
await page.reload({ waitUntil: 'load' });
console.log('Page loaded');

// Now take measurements from THIS point
const startTime = Date.now();

// Capture screenshots AND measure
const targets = [50, 150, 300, 500, 800, 1200, 1800, 2500];
for (const target of targets) {
  const wait = target - (Date.now() - startTime);
  if (wait > 0) await page.waitForTimeout(wait);
  
  await page.screenshot({ path: `C:/Users/joses/Documents/mente-ai/tmp/aftercommit_${target}ms.png`, fullPage: false });
  
  const info = await page.evaluate(() => {
    const hero = document.querySelector('h1');
    const allDivs = Array.from(document.querySelectorAll('div'));
    const sidebar = allDivs.find(d => d.className.includes('relative shrink-0 hidden') && d.className.includes('md:flex'));
    const allButtons = Array.from(document.querySelectorAll('button'));
    const iniciarBtn = allButtons.find(b => b.textContent.includes('Iniciar'));
    
    return {
      heroText: hero ? hero.textContent : null,
      heroOpacity: hero ? getComputedStyle(hero).opacity : null,
      sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null,
      hasIniciar: !!iniciarBtn,
    };
  });
  console.log(`t=${Date.now() - startTime}ms: hero="${info.heroText}", heroOpacity=${info.heroOpacity}, sidebarWidth=${info.sidebarWidth}, hasIniciar=${info.hasIniciar}`);
}

await browser.close();
