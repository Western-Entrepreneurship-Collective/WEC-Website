import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('artifacts', { recursive: true });
const results = [];
for (const [engine, launcher] of Object.entries({ chromium, webkit })) {
  const browser = await launcher.launch();
  for (const [width, height] of [[320,568],[320,740],[360,640],[375,667],[390,844],[430,932],[740,360],[844,390]]) {
    const page = await browser.newPage({ viewport: {width, height} });
    const issues = [];
    page.on('pageerror', error => issues.push(error.message));
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    const scenes = await page.locator('.wec-site').getAttribute('data-scroll-scenes') === 'true';
    if (scenes !== (height >= 640)) issues.push('Unexpected scene mode');
    for (let index = 0; index < 3; index++) {
      await page.locator('.experience-nav button').nth(index).click();
      await page.waitForTimeout(scenes ? 950 : 200);
      const layout = await page.locator(`#experience-program-${index}`).evaluate(card => {
        const body = card.querySelector('.program-window-body'), footer = card.querySelector('.program-window-footer');
        return { overflow: body.scrollHeight - body.clientHeight, footerOverflow: footer.getBoundingClientRect().bottom - card.getBoundingClientRect().bottom, bottom: card.getBoundingClientRect().bottom, internal: ['auto','scroll'].includes(getComputedStyle(body).overflowY) };
      });
      if (layout.overflow > 1 || layout.footerOverflow > 1 || layout.internal || (scenes && layout.bottom > height + 1)) issues.push({ program:index, ...layout });
    }
    await page.keyboard.press('Escape');
    if (scenes) {
      await page.locator('.foundation-nav button').last().click();
      await page.waitForTimeout(500);
      const bottom = await page.locator('.foundation-scene').evaluate(el => el.getBoundingClientRect().bottom);
      if (bottom > height + 1) issues.push({ foundationBottom: bottom });
      await page.keyboard.press('Escape');
    }
    const taps = await page.locator('.menu-toggle, .nav-join, .foundation-nav button, .program-window-footer .text-link').evaluateAll(elements => elements.filter(el => !el.closest('[inert]')).filter(el => { const r=el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44); }).map(el => el.className));
    if (taps.length) issues.push({ smallTapTargets: taps });
    await page.locator('#ecosystem').scrollIntoViewIfNeeded();
    await page.waitForTimeout(650);
    const diagramFits = await page.locator('[data-map-node]').evaluateAll(nodes => nodes.every(node => {const r=node.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && node.scrollWidth <= node.clientWidth + 1;}));
    if (!diagramFits) issues.push('Ecosystem label overflow');
    if (width === 390) await page.locator('#ecosystem').screenshot({path:`artifacts/mobile-audit-${engine}-ecosystem.png`});
    results.push({engine,width,height,scenes,issues});
    await page.close();
  }
  await browser.close();
}
await writeFile('artifacts/mobile-audit.json', JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
if (results.some(result => result.issues.length)) process.exitCode=1;
