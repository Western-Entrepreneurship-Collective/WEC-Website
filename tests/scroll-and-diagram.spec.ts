import { test, expect } from '@playwright/test';

test('one fifth of the previous Experience input visits every step without moving the page', async ({ page }) => {
  await page.goto('/#venture-studio');
  await expect(page.locator('.wec-site')).toHaveAttribute('data-scroll-locked', 'experience');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as {fieldSteps: string[]}).fieldSteps = log;
    new MutationObserver(records => {
      for (const record of records) if (record.attributeName === 'data-active-person') log.push((record.target as HTMLElement).dataset.activePerson!);
    }).observe(document.querySelector('.field')!, { attributes: true });
  });
  const position = await page.evaluate(() => scrollY);
  // Previously: two 90px program changes plus four 18px field changes = 252px.
  // Input received during an animation is retained, rather than discarded.
  // Dispatch exact normalized input: WebKit rounds native wheel pixels, and
  // mobile WebKit does not implement Playwright's mouse wheel API.
  await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 252 / 5, cancelable: true })));
  await expect(page.locator('.field')).toHaveAttribute('data-active-person', '4');
  await expect(page.locator('#experience')).toHaveAttribute('data-active-program', '2');
  expect(await page.evaluate(() => (window as unknown as {fieldSteps: string[]}).fieldSteps)).toEqual(['0','1','2','3','4']);
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(position, 0);
  await expect(page.locator('.wec-site')).toHaveAttribute('data-scroll-locked', 'experience');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  await expect(page.locator('.wec-site')).not.toHaveAttribute('data-scroll-locked');
});

test('ecosystem arrows connect every destination without overlapping its label', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wec-motion-v2', 'off'));
  await page.goto('/#ecosystem');
  await expect(page.locator('.ecosystem-arrow')).toHaveCount(7);
  await expect(page.locator('.ecosystem-node')).toHaveText(['Competitions', 'Funding programs', 'Venture development', 'Entrepreneurial programming', 'Alumni', 'Mentors']);
  expect(await page.locator('.ecosystem-route').evaluateAll(routes => routes.every(route => {
    const arrow = route.querySelector('.ecosystem-arrow')!.getBoundingClientRect();
    const card = route.querySelector('.ecosystem-node')!.getBoundingClientRect();
    return arrow.width > 0 && arrow.right <= card.left && Math.abs((arrow.top + arrow.bottom) / 2 - (card.top + card.bottom) / 2) < 2;
  }))).toBeTruthy();
  for (const selector of ['.ecosystem-wec', '.ecosystem-centre', '.ecosystem-node']) {
    expect(await page.locator(selector).evaluateAll(nodes => nodes.every(node => {
      const r = node.getBoundingClientRect();
      return r.width > 0 && r.left >= 0 && r.right <= innerWidth;
    }))).toBeTruthy();
  }
});
