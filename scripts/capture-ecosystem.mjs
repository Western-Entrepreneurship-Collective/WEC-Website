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
  await page.locator('.ecosystem-map').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.locator('.ecosystem-map').screenshot({path:`artifacts/ecosystem-${engine}-${width}.png`});
  console.log(JSON.stringify({width,height,errors}));
  if(errors.length) process.exitCode = 1;
  await page.close();
}
await browser.close();
