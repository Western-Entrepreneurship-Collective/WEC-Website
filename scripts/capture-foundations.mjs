import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('artifacts', { recursive: true });
const engine = process.env.SCENE_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const browser = await (engine === 'webkit' ? webkit : chromium).launch();
const results = [];
for (const [width, height] of [[1440, 1000], [1024, 768], [390, 844], [320, 740], [375, 667], [960, 500]]) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:3000/#from-the-field', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  for (const i of [0, 4]) {
    await page.locator('.experience').evaluate((element, index) => element.dispatchEvent(new CustomEvent('wec:person', { detail: index })), i);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `artifacts/scenes-${engine}-${width}-field-${i}.png` });
  }
  const field = await page.locator('#from-the-field').evaluate(element => {
    const footer = element.nextElementSibling.getBoundingClientRect();
    const sequence = element.querySelector('.field').getBoundingClientRect();
    const card = element.closest('.program-window').getBoundingClientRect();
    return { bodyOverflow: element.scrollHeight - element.clientHeight, sequenceOverFooter: sequence.bottom - footer.top, footerOverCard: footer.bottom - card.bottom, cardBottom: card.bottom, viewport: innerHeight };
  });
  await page.keyboard.press('Escape');
  for (const i of [0, 2, 4]) {
    await page.locator('.foundation-nav button').nth(i).click();
    await page.waitForTimeout(350);
    await page.screenshot({ path: `artifacts/scenes-${engine}-${width}-pillars-${i + 1}.png` });
  }
  const foundation = await page.locator('.foundation-scene').evaluate(element => {
    const r = element.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: r.height, viewport: innerHeight };
  });
  results.push({ width, height, field, foundation, errors });
  await page.close();
}
await browser.close();
await writeFile(`artifacts/scenes-${engine}-audit.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (results.some(r => r.errors.length || r.field.bodyOverflow > 1 || r.field.sequenceOverFooter > 1 || r.field.footerOverCard > 1 || r.field.cardBottom > r.height + 1 || r.foundation.bottom > r.height + 1)) process.exitCode = 1;
