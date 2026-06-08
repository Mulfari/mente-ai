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

// Fetch the SSR HTML directly to see what's in the body
const ssrHtml = await page.evaluate(async () => {
  const response = await fetch(window.location.href, { credentials: 'include' });
  return await response.text();
});

// Extract the body content
const bodyMatch = ssrHtml.match(/<body[^>]*>([\s\S]*)<\/body>/);
if (bodyMatch) {
  const body = bodyMatch[1];
  // Check what's in the body
  const hasIniciar = body.includes('Iniciar sesión');
  const hasSalvador = body.includes('Salvador');
  const hasPreguntale = body.includes('Pregúntale algo a VeChat');
  const hasCuentame = body.includes('Cuéntame');
  const hasSidebar = body.includes('Nueva conversación');
  
  console.log('SSR Body contains:');
  console.log('  Iniciar sesión:', hasIniciar);
  console.log('  Salvador:', hasSalvador);
  console.log('  Pregúntale algo a VeChat (logged-out):', hasPreguntale);
  console.log('  Cuéntame (logged-in opener):', hasCuentame);
  console.log('  Nueva conversación (sidebar):', hasSidebar);
  
  // Check the sidebar style
  const sidebarMatch = body.match(/<div class="relative shrink-0 hidden md:flex[^"]*"[^>]*style="([^"]+)"/);
  if (sidebarMatch) {
    console.log('  Sidebar style:', sidebarMatch[1]);
  }
}

// Also check what cookies are being sent
const cookies = await context.cookies();
console.log('\nCookies:', cookies.map(c => `${c.name} (${c.value.length} chars)`).join(', '));

await browser.close();
