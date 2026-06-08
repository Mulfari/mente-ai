import { chromium } from 'playwright';

const url = 'https://mulfai.com.ve/chat';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
});

const page = await context.newPage();

// Go directly to chat
console.log('Going to chat...');
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// Look for the login button
const loginBtn = await page.$('button:has-text("Iniciar sesión")');
if (loginBtn) {
  console.log('Found login button, clicking...');
  await loginBtn.click();
  await page.waitForTimeout(1500);
  
  // Now look for the modal
  const emailInput = await page.$('input[type="email"]');
  const passwordInput = await page.$('input[type="password"]');
  console.log('Modal email:', !!emailInput, 'Modal password:', !!passwordInput);
  
  if (emailInput && passwordInput) {
    await emailInput.fill('josesalvador0102@gmail.com');
    await passwordInput.fill('123456789');
    
    // Find submit button in modal
    const submit = await page.$('button[type="submit"]');
    if (submit) {
      await submit.click();
      console.log('Submitted login');
      // Wait for the auth to complete and page to reload
      await page.waitForTimeout(5000);
    }
  }
}

console.log('Current URL after login:', page.url());

// Get cookies to confirm session
const cookies = await context.cookies();
console.log('Cookies:', cookies.map(c => c.name).join(', '));

// Check if there's a session
const localStorage = await page.evaluate(() => {
  const out = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    out[k] = window.localStorage.getItem(k);
  }
  return out;
});
console.log('LocalStorage keys:', Object.keys(localStorage).join(', '));

// Now reload the chat page to capture the flash
console.log('Reloading chat to capture flash...');

// Use a route handler to record timing
const screenshots = [];
await page.goto(url, { waitUntil: 'commit' });
console.log('Page committed, taking rapid screenshots...');

const startTime = Date.now();
const intervals = [50, 100, 200, 400, 700, 1000, 1500, 2000, 3000];
for (const ms of intervals) {
  const target = startTime + ms;
  while (Date.now() < target) {
    await page.waitForTimeout(5);
  }
  await page.screenshot({ path: `C:/Users/joses/Documents/mente-ai/tmp/chat_${ms}ms.png`, fullPage: false });
  screenshots.push(ms);
  console.log(`Screenshot at ${Date.now() - startTime}ms taken`);
}

// Also measure sidebar width over time
console.log('Measuring sidebar width over time...');
const widthMeasurements = [];
for (let i = 0; i < 30; i++) {
  const widths = await page.evaluate(() => {
    const sidebar = document.querySelector('.relative.shrink-0.hidden.md\:flex.flex-col');
    if (!sidebar) return { error: 'no sidebar' };
    const inner = sidebar.firstElementChild;
    return {
      outerWidth: (sidebar).getBoundingClientRect().width,
      innerWidth: inner ? inner.getBoundingClientRect().width : 0,
      outerStyle: sidebar.getAttribute('style'),
      transition: getComputedStyle(sidebar).transition,
    };
  });
  widthMeasurements.push({ t: Date.now() - startTime, ...widths });
  await page.waitForTimeout(100);
}

// Print unique width values
const uniqueWidths = [...new Set(widthMeasurements.map(m => m.outerWidth))];
console.log('Unique widths seen:', uniqueWidths);
console.log('Sample measurements:');
widthMeasurements.slice(0, 10).forEach(m => {
  console.log(`  t=${m.t}ms: outerWidth=${m.outerWidth}, transition=${m.transition?.substring(0, 50)}`);
});

await browser.close();
console.log('Done');
