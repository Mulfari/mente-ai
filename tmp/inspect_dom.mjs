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

const startTime = Date.now();
await page.reload({ waitUntil: 'commit' });

for (const target of [50, 200, 500, 1000, 2000]) {
  const wait = target - (Date.now() - startTime);
  if (wait > 0) await page.waitForTimeout(wait);
  
  const info = await page.evaluate(() => {
    const hero = document.querySelector('h1');
    const allDivs = Array.from(document.querySelectorAll('div'));
    const sidebar = allDivs.find(d => d.className.includes('relative shrink-0 hidden') && d.className.includes('md:flex'));
    
    // Find Iniciar sesion button
    const allButtons = Array.from(document.querySelectorAll('button'));
    const iniciarBtn = allButtons.find(b => b.textContent.includes('Iniciar'));
    
    // Check what's in the footer area
    const footerDivs = Array.from(document.querySelectorAll('div[style*="top: calc(50% + 56px)"]'));
    const footerContent = footerDivs[0] ? footerDivs[0].textContent.substring(0, 100) : null;
    const footerOpacity = footerDivs[0] ? getComputedStyle(footerDivs[0]).opacity : null;
    
    return {
      heroText: hero ? hero.textContent : null,
      heroOpacity: hero ? getComputedStyle(hero).opacity : null,
      sidebarWidth: sidebar ? sidebar.getBoundingClientRect().width : null,
      hasIniciar: !!iniciarBtn,
      footerContent: footerContent,
      footerOpacity: footerOpacity,
    };
  });
  console.log(`\n=== t=${Date.now() - startTime}ms ===`);
  console.log(`  heroText: "${info.heroText}", heroOpacity: ${info.heroOpacity}`);
  console.log(`  sidebarWidth: ${info.sidebarWidth}`);
  console.log(`  hasIniciar: ${info.hasIniciar}`);
  console.log(`  footerContent: "${info.footerContent}", footerOpacity: ${info.footerOpacity}`);
}

await browser.close();
