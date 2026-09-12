import { chromium, webkit } from "playwright";
import { mkdir } from "node:fs/promises";

await mkdir("artifacts", { recursive: true });
const engine = process.env.DOOR_BROWSER === "webkit" ? "webkit" : "chromium";
const browser = await (engine === "webkit" ? webkit : chromium).launch();
for (const [width, height] of [[1440, 1000], [390, 844], [320, 740], [960, 500]]) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "warning") console.log(message.text()); });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(1100);
  const distance = await page.locator(".hero-stage").evaluate(element => element.offsetHeight);
  for (const [name, progress] of [["closed", 0], ["opening", .3], ["through", .58], ["arrival", .88], ["about", 1], ["reverse", 0]]) {
    await page.evaluate(y => scrollTo(0, y), distance * progress);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `artifacts/door-${engine}-${width}-${name}.png` });
  }
  console.log(JSON.stringify({ width, height, errors }));
  await page.close();
  if (errors.length) process.exitCode = 1;
}
await browser.close();
