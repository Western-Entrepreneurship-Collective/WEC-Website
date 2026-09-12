import { chromium, webkit } from "playwright";
import { mkdir } from "node:fs/promises";

await mkdir("artifacts", { recursive: true });
for (const [engine, driver] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await driver.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForSelector("[data-spatial-story]");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  const capture = async (name, y) => {
    await page.evaluate(position => scrollTo(0, position), y);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `artifacts/spatial-${engine}-${name}.png` });
  };

  for (const [name, selector, offsets] of [
    ["hero", ".hero-stage", [0, 300]],
    ["proof", ".about-evidence", [-850, -400]],
    ["ecosystem", ".ecosystem-map", [-600, -350, -120]],
    ["join", ".join-composition", [-900, -650, -250]],
    ["foundations", ".foundation-structure", [-850, -450]],
    ["community", ".community-wall", [-850, -250]],
  ]) {
    const top = await page.locator(selector).evaluate(element => element.getBoundingClientRect().top + scrollY);
    for (const [i, offset] of offsets.entries()) await capture(`${name}-${i}`, top + offset);
  }

  console.log(JSON.stringify({ engine, errors }));
  await browser.close();
  if (errors.length) process.exitCode = 1;
}
