import { chromium, webkit } from 'playwright';
import { mkdir } from 'node:fs/promises';
await mkdir('artifacts', { recursive: true });
const engine = process.env.SCENE_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const browser = await (engine === 'webkit' ? webkit : chromium).launch();
for (const [width,height] of [[1440,1000],[1024,768],[768,1024],[390,844],[320,740]]) {
  const page = await browser.newPage({viewport:{width,height}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:3000/#ecosystem',{waitUntil:'networkidle'});
  const start = await page.locator('.ecosystem-scene').evaluate(el => el.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')));
  const travel = await page.locator('.ecosystem-scene').evaluate(el => el.offsetHeight);
  for (const [name, progress] of [['start', 0], ['approach', .38], ['signs', .65], ['doors', .87], ['labels', .95], ['room', 1], ['reverse', 0]]) {
    await page.evaluate(y => scrollTo(0, y), start + travel * (progress <= .6 ? progress : progress <= .72 ? .6 + (progress - .6) * 6.4 : 1.368 + (progress - .72) * 8) / 3.608);
    await page.waitForFunction(progress=>Math.abs(Number(document.querySelector('.ecosystem-scene').dataset.progress)-progress)<8/document.querySelector('.ecosystem-scene').offsetHeight,progress);
    await page.waitForTimeout(150);
    await page.screenshot({path:`artifacts/ecosystem-${engine}-${width}-${name}.png`});
  }
  await page.locator('.motion-toggle').evaluate(el => el.click());
  await page.locator('.ecosystem-scene').scrollIntoViewIfNeeded();
  await page.locator('.ecosystem-scene').screenshot({path:`artifacts/ecosystem-${engine}-${width}-reading.png`});
  const bounds = await page.locator('.opportunity-sign, .circle-person').evaluateAll(nodes => nodes.map(el => ({ name: el.textContent, overflow: el.scrollWidth - el.clientWidth })));
  console.log(JSON.stringify({width,height,errors,bounds}));
  if(errors.length || bounds.some(node => node.overflow > 1)) process.exitCode = 1;
  await page.close();
}
await browser.close();
