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

// Wait extra time for cookies to be stable
await page.waitForTimeout(2000);

// Check what cookies are sent to the server
const response = await page.context().request.get('https://mulfai.com.ve/chat');
const text = await response.text();
console.log('\nResponse status:', response.status());
console.log('\nResponse includes "Iniciar sesión":', text.includes('Iniciar'));
console.log('Response includes "Cuéntame, Salvador":', text.includes('Salvador'));
console.log('Response includes josesalvador0102:', text.includes('josesalvador0102'));
console.log('Response includes "new-conversation":', text.includes('Nueva conversación'));
console.log('Response length:', text.length);

// Check the initial sidebar state from the SSR
const sidebarMatch = text.match(/<div class="relative shrink-0 hidden md:flex[^"]*"[^>]*style="([^"]+)"/);
if (sidebarMatch) {
  console.log('\nSSR Sidebar style:', sidebarMatch[1]);
}
const innerMatch = text.match(/<div class="h-full flex flex-col[^"]*"/);
if (innerMatch) {
  console.log('SSR Inner class:', innerMatch[0].substring(0, 200));
}

await browser.close();
