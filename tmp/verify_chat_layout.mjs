import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const url = "https://mulfai.com.ve/chat";
const out = "tmp/chat_gemini_verify.json";
const shot = "tmp/chat_gemini_verify.png";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  // Wait for either EmptyState hero or first message
  await page.waitForTimeout(3000);

  // Take screenshot of empty state first
  await page.screenshot({ path: shot, fullPage: false });
  const emptyBox = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return null;
    return { scrollHeight: main.scrollHeight, clientHeight: main.clientHeight, scrollTop: main.scrollTop };
  });

  // Now try to navigate to an existing conversation if there is one
  const firstConv = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/chat/"]'));
    return links.length > 0 ? links[0].getAttribute("href") : null;
  });

  let longConvBox = null;
  let longShot = "tmp/chat_longconv_verify.png";
  if (firstConv) {
    await page.goto("https://mulfai.com.ve" + firstConv, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: longShot, fullPage: false });
    longConvBox = await page.evaluate(() => {
      const main = document.querySelector("main");
      if (!main) return null;
      const messages = main.querySelectorAll('[class*="animate-fade-in"]');
      return {
        scrollHeight: main.scrollHeight,
        clientHeight: main.clientHeight,
        scrollTop: main.scrollTop,
        messageCount: messages.length,
        atBottom: main.scrollHeight - main.scrollTop - main.clientHeight < 5,
      };
    });
  }

  const result = {
    ok: true,
    url,
    emptyState: { box: emptyBox, shot },
    longConversation: firstConv
      ? { url: firstConv, box: longConvBox, shot: longShot }
      : "no existing conversation found",
  };
  writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error("FAILED:", e.message);
  process.exit(1);
} finally {
  await browser.close();
}
