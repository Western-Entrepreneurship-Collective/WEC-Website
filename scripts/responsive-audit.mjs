import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";

await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch();
const results = [];
for (const [width, height] of [[320, 740], [375, 667], [375, 812], [390, 844], [768, 1024], [960, 500], [1024, 768], [1200, 768], [1280, 720], [1366, 650], [1280, 560], [1280, 500], [1440, 800], [1920, 1080]]) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("wec-motion-v2", "off"));
  await page.goto("http://localhost:3001", { waitUntil: "networkidle" });
  const issues = await page.evaluate(() => {
    return [...document.querySelectorAll("h1, h2, h3, h4, p, button, .wec-logo")].filter(element => {
      if (element.closest("dialog:not([open]), [hidden], .sr-only")) return false;
      // Cells intentionally extend inside this bounded horizontal scroller.
      const list = element.closest(".field-list-scroll");
      if (list) {
        const bounds = list.getBoundingClientRect();
        if (bounds.left >= 0 && bounds.right <= innerWidth && getComputedStyle(list).overflowX === "auto") return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.left < -2 || rect.right > innerWidth + 2);
    }).map(element => ({ tag: element.tagName, class: element.className, text: element.textContent?.slice(0, 65) }));
  });
  await page.screenshot({ path: `artifacts/viewport-${width}.png` });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => { localStorage.removeItem("wec-motion-v2"); window.dispatchEvent(new Event("wec-motion-preference")); });
  await page.waitForTimeout(450);
  const pinning = await page.locator(".wec-site").getAttribute("data-story-desktop") === "true";
  const expectedPinning = width >= 960 && height >= 500;
  const programIssues = [];
  for (let i = 0; i < 3; i++) {
    await page.locator(".experience-nav button").nth(i).click();
    await page.waitForTimeout(550);
    const bounds = await page.locator(`#experience-program-${i}`).evaluate(element => {
      const card = element.getBoundingClientRect();
      const body = element.querySelector(".program-window-body");
      const copy = element.querySelector(".program-window-copy").getBoundingClientRect();
      const footer = element.querySelector(".program-window-footer").getBoundingClientRect();
      const field = element.querySelector('.field');
      return { top: card.top, bottom: card.bottom, contentHeight: body.clientHeight, overflow: body.scrollWidth - body.clientWidth, verticalOverflow: body.scrollHeight - body.clientHeight, textOverFooter: Math.max(copy.bottom, field?.getBoundingClientRect().bottom ?? 0) - footer.top, footerOverflow: footer.bottom - card.bottom, internalScroll: ["auto", "scroll"].includes(getComputedStyle(body).overflowY) };
    });
    if (bounds.top < 72 || bounds.bottom > height + 1 || bounds.contentHeight < 80 || bounds.overflow > 1 || bounds.verticalOverflow > 1 || bounds.textOverFooter > 0 || bounds.footerOverflow > 1 || bounds.internalScroll) programIssues.push({ program: i, ...bounds });
  }
  await page.keyboard.press("Escape");
  await page.locator('.foundation-nav button').last().click();
  await page.waitForTimeout(300);
  const foundation = await page.locator('.foundation-scene').evaluate(element => ({ top: element.getBoundingClientRect().top, bottom: element.getBoundingClientRect().bottom, viewport: innerHeight }));
  await page.keyboard.press('Escape');
  results.push({ width, height, issues, programIssues, foundation, pinning, expectedPinning });
  if (width === 768) {
    await page.locator("#ecosystem").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1600);
    await page.locator("#ecosystem").screenshot({ path: "artifacts/tablet-ecosystem.png" });
    await page.locator(".experience-nav button").first().click();
    await page.waitForTimeout(1600);
    await page.locator("#experience-program-0").screenshot({ path: "artifacts/tablet-studio.png" });
  }
  await page.close();
}
await browser.close();
await writeFile("artifacts/responsive-audit.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (results.some(result => result.issues.length || result.programIssues.length || result.foundation.bottom > result.height + 1 || result.pinning !== result.expectedPinning)) process.exitCode = 1;
