import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

const page = await context.newPage();
await page.goto('https://mulfai.com.ve/chat', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

// Check the CSS custom properties and scrollbar styles
const result = await page.evaluate(() => {
  const root = document.documentElement;
  const primary = getComputedStyle(root).getPropertyValue('--primary').trim();

  // Check if the scrollbar CSS is applied by looking at a scrollable element
  const main = document.querySelector('main');
  const sidebarList = document.querySelector('.sidebar-list-in');

  // Create a temporary scrollable div to check the scrollbar style
  const testDiv = document.createElement('div');
  testDiv.style.cssText = 'width: 200px; height: 200px; overflow-y: auto; position: fixed; top: -1000px;';
  testDiv.innerHTML = '<div style="height: 1000px;">content</div>';
  document.body.appendChild(testDiv);

  const scrollbarStyles = {
    width: getComputedStyle(testDiv, '::-webkit-scrollbar').width,
    thumbBg: getComputedStyle(testDiv, '::-webkit-scrollbar-thumb').background,
    thumbRadius: getComputedStyle(testDiv, '::-webkit-scrollbar-thumb').borderRadius,
  };

  document.body.removeChild(testDiv);

  return {
    primary,
    scrollbarStyles,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
