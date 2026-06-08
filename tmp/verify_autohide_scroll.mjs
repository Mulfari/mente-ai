import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

const page = await context.newPage();
await page.goto('https://mulfai.com.ve/chat', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

// Create a scrollable test div to check scrollbar opacity
const result = await page.evaluate(() => {
  const testDiv = document.createElement('div');
  testDiv.style.cssText = 'width: 200px; height: 200px; overflow-y: auto; position: fixed; top: -1000px;';
  testDiv.innerHTML = '<div style="height: 1000px;">content</div>';
  document.body.appendChild(testDiv);

  const styles = getComputedStyle(testDiv, '::-webkit-scrollbar-thumb');
  const result = {
    background: styles.background.substring(0, 80),
    borderRadius: styles.borderRadius,
    opacity: styles.opacity,
    transition: styles.transition.substring(0, 80),
  };

  document.body.removeChild(testDiv);
  return result;
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
