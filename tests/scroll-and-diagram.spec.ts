import { test, expect } from '@playwright/test';

test('Experience requires four times the previous scroll input while keeping the page fixed', async ({ page }) => {
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
  // The original thresholds for these five positions total 43.2px. That stays on
  // Studio; four times the total input still visits every step in order.
  // Dispatch exact normalized input: WebKit rounds native wheel pixels, and
  // mobile WebKit does not implement Playwright's mouse wheel API.
  await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 43.2, cancelable: true })));
  await page.waitForTimeout(550);
  await expect(page.locator('#experience')).toHaveAttribute('data-active-program', '0');
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(position, 0);
  await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 43.2 * 3, cancelable: true })));
  await expect(page.locator('.field')).toHaveAttribute('data-active-person', '2');
  await expect(page.locator('#experience')).toHaveAttribute('data-active-program', '2');
  expect(await page.evaluate(() => (window as unknown as {fieldSteps: string[]}).fieldSteps)).toEqual(['0','1','2']);
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(position, 0);
  await expect(page.locator('.wec-site')).toHaveAttribute('data-scroll-locked', 'experience');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  await expect(page.locator('.wec-site')).not.toHaveAttribute('data-scroll-locked');
});

test('ecosystem arrows connect every destination without overlapping its label', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wec-motion-v2', 'off'));
  await page.goto('/#ecosystem');
  await expect(page.locator('.ecosystem-arrow')).toHaveCount(11);
  await expect(page.locator('.ecosystem-node')).toHaveText(['Competitions', 'Funding programs', 'Venture development', 'Entrepreneurial programming', 'Alumni', 'Mentors']);
  expect(await page.locator('.ecosystem-arrow[data-from="wec"]').evaluate(element => {
    const path = element as SVGPathElement;
    return path.getPointAtLength(path.getTotalLength()).y - path.getPointAtLength(0).y;
  })).toBeGreaterThan(12);
  expect(await page.locator('.ecosystem-arrow').evaluateAll(arrows => arrows.every(element => {
    const arrow = element as SVGPathElement;
    const svg = arrow.ownerSVGElement!.getBoundingClientRect();
    return [false, true].every(end => {
      const point = arrow.getPointAtLength(end ? arrow.getTotalLength() : 0);
      const node = document.querySelector(`[data-map-node="${end ? arrow.dataset.to : arrow.dataset.from}"]`)!.getBoundingClientRect();
      const x = svg.left + point.x, y = svg.top + point.y;
      const distance = Math.hypot(Math.max(node.left-x, 0, x-node.right), Math.max(node.top-y, 0, y-node.bottom));
      return distance > 3 && distance < 15;
    });
  }))).toBeTruthy();
  expect(await page.locator('.ecosystem-arrow').evaluateAll(arrows => arrows.every(element => {
    const path = element as SVGPathElement;
    const svg = path.ownerSVGElement!.getBoundingClientRect();
    const otherNodes = [...document.querySelectorAll<HTMLElement>('[data-map-node]')].filter(node => ![path.dataset.from, path.dataset.to].includes(node.dataset.mapNode));
    return Array.from({length: 39}, (_, i) => path.getPointAtLength(path.getTotalLength() * (i+1) / 40)).every(point => otherNodes.every(node => {
      const r = node.getBoundingClientRect(), x = svg.left + point.x, y = svg.top + point.y;
      return x <= r.left || x >= r.right || y <= r.top || y >= r.bottom;
    }));
  }))).toBeTruthy();
  expect(await page.locator('[data-map-node]').evaluateAll(nodes => nodes.every((node, i) => {
    const a = node.getBoundingClientRect();
    return nodes.slice(i+1).every(other => { const b = other.getBoundingClientRect(); return a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom; });
  }))).toBeTruthy();
  for (const selector of ['.ecosystem-wec', '.ecosystem-centre', '.ecosystem-node']) {
    expect(await page.locator(selector).evaluateAll(nodes => nodes.every(node => {
      const r = node.getBoundingClientRect();
      return r.width > 0 && r.left >= 0 && r.right <= innerWidth;
    }))).toBeTruthy();
  }
});
