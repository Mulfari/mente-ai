import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const url = "https://mulfai.com.ve/chat";
const out = "tmp/chat_loggedin_verify.json";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);

  // Click "Iniciar sesión" to open auth modal
  const loginBtn = page.getByText("Iniciar sesión", { exact: true }).first();
  if (await loginBtn.count() > 0) {
    await loginBtn.click();
    await page.waitForTimeout(1500);

    // Try to fill email + password if fields are visible
    const emailInput = page.locator('input[type="email"]').first();
    const passInput = page.locator('input[type="password"]').first();
    if (await emailInput.count() > 0) {
      await emailInput.fill("jscmulfari@gmail.com");
      await page.waitForTimeout(300);
    }
    if (await passInput.count() > 0) {
      await passInput.fill("Mul-f4ri-2026");
      await page.waitForTimeout(300);
    }

    // Submit
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await page.waitForTimeout(5000);
    }
  }

  await page.screenshot({ path: "tmp/chat_loggedin_empty.png" });
  const emptyState = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return { error: "no main" };
    return { scrollHeight: main.scrollHeight, clientHeight: main.clientHeight, scrollTop: main.scrollTop };
  });

  // Find first conversation in sidebar
  const firstConv = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/chat/"]'));
    return links.length > 0 ? links[0].getAttribute("href") : null;
  });

  let longConvData = null;
  if (firstConv) {
    await page.goto("https://mulfai.com.ve" + firstConv, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: "tmp/chat_loggedin_long.png" });

    longConvData = await page.evaluate(() => {
      const main = document.querySelector("main");
      if (!main) return { error: "no main" };
      const bubbles = main.querySelectorAll('.animate-fade-in');
      const userBubbles = Array.from(bubbles).filter(b => b.className.includes("justify-end"));
      const assistantBubbles = Array.from(bubbles).filter(b => b.className.includes("justify-start"));
      const firstBubble = bubbles[0];
      const lastBubble = bubbles[bubbles.length - 1];
      return {
        scrollHeight: main.scrollHeight,
        clientHeight: main.clientHeight,
        scrollTop: main.scrollTop,
        bubbleCount: bubbles.length,
        userCount: userBubbles.length,
        assistantCount: assistantBubbles.length,
        atBottom: main.scrollHeight - main.scrollTop - main.clientHeight < 5,
        firstBubbleHasAvatar: firstBubble ? !!firstBubble.querySelector("svg") : null,
        firstBubbleText: firstBubble ? firstBubble.textContent.substring(0, 60) : null,
        lastBubbleText: lastBubble ? lastBubble.textContent.substring(0, 60) : null,
      };
    });
  }

  const result = { ok: true, url, emptyState, firstConv, longConvData, shot: firstConv ? "tmp/chat_loggedin_long.png" : "tmp/chat_loggedin_empty.png" };
  writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error("FAILED:", e.message);
  process.exit(1);
} finally {
  await browser.close();
}
