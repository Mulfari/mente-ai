import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const url = "https://mulfai.com.ve/chat";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Initial state — no mouse movement
  await page.screenshot({ path: "tmp/cursor_glow_initial.png" });
  const initialGlow = await page.evaluate(() => {
    const el = document.querySelector(".cursor-glow");
    if (!el) return { error: "no .cursor-glow element" };
    const cs = getComputedStyle(el);
    return { opacity: cs.opacity, transform: cs.transform, display: cs.display };
  });

  // Move mouse to a specific position
  await page.mouse.move(400, 300);
  await page.waitForTimeout(500);
  await page.screenshot({ path: "tmp/cursor_glow_pos1.png" });
  const pos1Glow = await page.evaluate(() => {
    const el = document.querySelector(".cursor-glow");
    const cs = getComputedStyle(el);
    return { opacity: cs.opacity, transform: cs.transform };
  });

  // Move mouse to another position
  await page.mouse.move(900, 500);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "tmp/cursor_glow_pos2.png" });
  const pos2Glow = await page.evaluate(() => {
    const el = document.querySelector(".cursor-glow");
    const cs = getComputedStyle(el);
    return { opacity: cs.opacity, transform: cs.transform };
  });

  // Move to corner
  await page.mouse.move(1100, 700);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "tmp/cursor_glow_pos3.png" });
  const pos3Glow = await page.evaluate(() => {
    const el = document.querySelector(".cursor-glow");
    const cs = getComputedStyle(el);
    return { opacity: cs.opacity, transform: cs.transform };
  });

  const result = {
    ok: true,
    url,
    initial: initialGlow,
    pos1_at_400_300: pos1Glow,
    pos2_at_900_500: pos2Glow,
    pos3_at_1100_700: pos3Glow,
  };
  writeFileSync("tmp/cursor_glow_verify.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error("FAILED:", e.message);
  process.exit(1);
} finally {
  await browser.close();
}
