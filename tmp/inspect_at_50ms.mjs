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

// Hard reload and wait for load
await page.reload({ waitUntil: 'load' });
console.log('Page fully loaded');

// Now wait 50ms and inspect DOM
await page.waitForTimeout(50);

const domState = await page.evaluate(() => {
  // Find all buttons
  const allButtons = Array.from(document.querySelectorAll('button'));
  const buttonInfo = allButtons.map(b => {
    const rect = b.getBoundingClientRect();
    const cs = getComputedStyle(b);
    return {
      text: b.textContent.trim().substring(0, 50),
      visible: rect.width > 0 && rect.height > 0,
      opacity: cs.opacity,
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  }).filter(b => b.visible && b.text.length > 0);
  
  // Find the footer wrapper
  const allDivs = Array.from(document.querySelectorAll('div'));
  const footer = allDivs.find(d => {
    const style = d.getAttribute('style') || '';
    return style.includes('calc(50% + 56px)') && style.includes('bottom:');
  });
  
  // Find hero
  const hero = document.querySelector('h1');
  
  // Find sidebar
  const sidebar = allDivs.find(d => d.className.includes('relative shrink-0 hidden') && d.className.includes('md:flex'));
  
  return {
    buttons: buttonInfo,
    footerFound: !!footer,
    footerOpacity: footer ? getComputedStyle(footer).opacity : null,
    footerClass: footer ? footer.className : null,
    heroText: hero ? hero.textContent : null,
    heroOpacity: hero ? getComputedStyle(hero).opacity : null,
    sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null,
  };
});

console.log('\n=== DOM state at 50ms after load ===');
console.log('Sidebar width:', domState.sidebarWidth);
console.log('Hero text:', domState.heroText);
console.log('Hero opacity:', domState.heroOpacity);
console.log('Footer found:', domState.footerFound);
console.log('Footer opacity:', domState.footerOpacity);
console.log('Footer class:', domState.footerClass);
console.log('\nVisible buttons:');
domState.buttons.forEach(b => {
  console.log(`  "${b.text}" at (${b.x}, ${b.y}) size ${b.width}x${b.height}, opacity=${b.opacity}`);
});

await browser.close();
