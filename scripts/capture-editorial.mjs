import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('artifacts', { recursive: true });
const engine = process.env.SCENE_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const browser = await (engine === 'webkit' ? webkit : chromium).launch();
const results = [];
for (const [width, height] of [[1440,1000],[1024,768],[390,844],[320,740],[375,667],[960,500]]) {
  const page = await browser.newPage({viewport:{width,height}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:3000/', {waitUntil:'networkidle'});
  await page.waitForTimeout(1400);
  for (const section of ['about','community','ecosystem']) {
    await page.locator(`#${section}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(650);
    await page.locator(`#${section}`).screenshot({path:`artifacts/editorial-${engine}-${width}-${section}.png`});
  }
  const programs = [];
  for (const index of [0,1,2]) {
    await page.locator('.experience-nav button').nth(index).click();
    await page.waitForTimeout(950);
    await page.screenshot({path:`artifacts/editorial-${engine}-${width}-program-${index}.png`});
    programs.push(await page.locator(`#experience-program-${index}`).evaluate(card => {
      const body = card.querySelector('.program-window-body');
      const footer = card.querySelector('.program-window-footer').getBoundingClientRect();
      const media = card.querySelector('.program-window-media')?.getBoundingClientRect();
      return { overflow: body.scrollHeight-body.clientHeight, bottom: card.getBoundingClientRect().bottom, footerOverflow: footer.bottom-card.getBoundingClientRect().bottom, imageHeight: media?.height, imageOverFooter: media ? media.bottom-footer.top : 0 };
    }));
  }
  await page.keyboard.press('Escape');
  const about = await page.locator('.about-grid').evaluate(el=>{
    const a=el.children[0].getBoundingClientRect(), b=el.children[1].getBoundingClientRect();
    return { topDifference: Math.abs(a.top-b.top), heightDifference: Math.abs(a.height-b.height) };
  });
  results.push({width,height,programs,about,errors});
  await page.close();
}
await browser.close();
await writeFile(`artifacts/editorial-${engine}-audit.json`, JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
if(results.some(r=>r.errors.length || r.programs.some(p=>p.overflow>1 || p.footerOverflow>1 || p.imageOverFooter>0 || p.bottom>r.height+1) || (r.width>=760 && (r.about.topDifference>1 || r.about.heightDifference>1)))) process.exitCode=1;
