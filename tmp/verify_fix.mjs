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

// Hard reload to test the fix
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(50);

await page.screenshot({ path: 'C:/Users/joses/Documents/mente-ai/tmp/fix_50ms.png', fullPage: false });

const info = await page.evaluate(() => {
  const allDivs = Array.from(document.querySelectorAll('div'));
  const sidebar = allDivs.find(d => d.className.includes('relative shrink-0 hidden') && d.className.includes('md:flex'));
  return {
    sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null,
  };
});
console.log('At 50ms after load:');
console.log('  sidebarWidth:', info.sidebarWidth);

// Take a few more measurements
for (const target of [200, 500, 1000]) {
  await page.waitForTimeout(target - 50);
  const m = await page.evaluate(() => {
    const allDivs = Array.from(document.querySelectorAll('div'));
    const sidebar = allDivs.find(d => d.className.includes('relative shrink-0 hidden') && d.className.includes('md:flex'));
    return sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null;
  });
  console.log(`At ${target}ms: sidebarWidth=${m}`);
}

await page.screenshot({ path: 'C:/Users/joses/Documents/mente-ai/tmp/fix_1000ms.png', fullPage: false });

await browser.close();
