import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
});

const page = await context.newPage();

// Capture console messages
const consoleMessages = [];
page.on('console', msg => {
  consoleMessages.push({ type: msg.type(), text: msg.text() });
});
page.on('pageerror', err => {
  consoleMessages.push({ type: 'error', text: `PAGE ERROR: ${err.message}` });
});

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

// Clear console messages from login flow
consoleMessages.length = 0;

// Hard reload
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2000);

// Print console messages
console.log('\n=== Console messages during page load ===');
consoleMessages.forEach(m => {
  console.log(`[${m.type}] ${m.text.substring(0, 200)}`);
});

await browser.close();
