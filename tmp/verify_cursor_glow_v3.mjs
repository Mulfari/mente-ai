import { chromium } from "playwright";

const url = "https://mulfai.com.ve/chat";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const consoleMessages = [];
page.on("console", msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
page.on("pageerror", err => consoleMessages.push({ type: "pageerror", text: err.message }));

try {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  console.log("HTTP:", response?.status(), "URL:", page.url());
  await page.waitForTimeout(5000);

  console.log("=== CONSOLE MESSAGES ===");
  consoleMessages.forEach(m => console.log(`[${m.type}] ${m.text}`));

  // Move mouse and check element
  await page.mouse.move(400, 400);
  await page.waitForTimeout(1000);

  const info = await page.evaluate(() => {
    const el = document.querySelector(".cursor-glow");
    if (!el) return { found: false };
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      found: true,
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      opacity: cs.opacity,
      transform: cs.transform,
      zIndex: cs.zIndex,
      display: cs.display,
      visibility: cs.visibility,
      bgImage: cs.backgroundImage.substring(0, 120),
    };
  });
  console.log("=== GLOW ELEMENT ===");
  console.log(JSON.stringify(info, null, 2));

  // Take screenshot in two places
  await page.screenshot({ path: "tmp/cursor_glow_v3_left.png" });
  await page.mouse.move(900, 400);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "tmp/cursor_glow_v3_right.png" });
  console.log("Screenshots taken");
} catch (e) {
  console.error("FAILED:", e.message);
  process.exit(1);
} finally {
  await browser.close();
}
