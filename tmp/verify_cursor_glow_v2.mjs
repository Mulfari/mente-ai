import { chromium } from "playwright";

const url = "https://mulfai.com.ve/chat";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

try {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  console.log("HTTP status:", response?.status(), "URL:", page.url());
  await page.waitForTimeout(4000);

  // Move mouse to center
  await page.mouse.move(640, 400);
  await page.waitForTimeout(700);

  // Check if .cursor-glow exists
  const exists = await page.evaluate(() => {
    const el = document.querySelector(".cursor-glow");
    if (!el) return { found: false, count: document.querySelectorAll("*").length };
    const cs = getComputedStyle(el);
    return {
      found: true,
      opacity: cs.opacity,
      transform: cs.transform,
      display: cs.display,
      width: cs.width,
      height: cs.height,
      bg: cs.backgroundImage.substring(0, 200),
    };
  });
  console.log("Element check:", JSON.stringify(exists, null, 2));

  // Take screenshot at a clear position
  await page.mouse.move(400, 400);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "tmp/cursor_glow_v2_left.png" });

  await page.mouse.move(900, 400);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "tmp/cursor_glow_v2_right.png" });
  console.log("Screenshots taken");
} catch (e) {
  console.error("FAILED:", e.message);
  process.exit(1);
} finally {
  await browser.close();
}
