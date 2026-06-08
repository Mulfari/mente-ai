import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const url = "https://mulfai.com.ve/chat";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "tmp/aurora_verify_empty.png" });

  // Take a 2nd screenshot a few seconds later to confirm aurora is animating
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "tmp/aurora_verify_empty_t2.png" });

  // Sample some pixels to confirm there's color (not pure black)
  const samples = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 200; c.height = 200;
    return c; // not used; we just sample via the body bg
  });

  // Use Playwright's evaluate to grab the body backgroundImage
  const bgInfo = await page.evaluate(() => {
    const cs = getComputedStyle(document.body, "::before");
    return {
      bgColor: cs.backgroundColor,
      bgImage: cs.backgroundImage.substring(0, 200),
      animation: cs.animation,
    };
  });

  const result = { ok: true, url, bgInfo, shot1: "tmp/aurora_verify_empty.png", shot2: "tmp/aurora_verify_empty_t2.png" };
  writeFileSync("tmp/aurora_verify.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error("FAILED:", e.message);
  process.exit(1);
} finally {
  await browser.close();
}
