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

await page.waitForTimeout(2000);

// Get the SSR HTML directly
const ssrHtml = await page.evaluate(async () => {
  const response = await fetch(window.location.href, { credentials: 'include' });
  return await response.text();
});

const hasIniciar = ssrHtml.includes('Iniciar sesión');
const hasSalvador = ssrHtml.includes('Salvador');
const hasCuentame = ssrHtml.includes('Cuéntame');
const hasPreguntale = ssrHtml.includes('Pregúntale algo a VeChat');

console.log('SSR HTML contains:');
console.log('  Iniciar sesión:', hasIniciar);
console.log('  Salvador:', hasSalvador);
console.log('  Cuéntame:', hasCuentame);
console.log('  Pregúntale algo a VeChat:', hasPreguntale);

const sidebarMatch = ssrHtml.match(/<div class="relative shrink-0 hidden md:flex[^"]*"[^>]*style="([^"]+)"/);
if (sidebarMatch) {
  console.log('  Sidebar style:', sidebarMatch[1]);
}

await browser.close();
