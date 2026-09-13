import { test, expect } from '@playwright/test';

test('phone rotation releases locked scenes and keeps all content readable', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Phone orientation behavior');
  await page.goto('/#venture-studio');
  await expect(page.locator('.wec-site')).toHaveAttribute('data-scroll-locked', 'experience');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('.wec-site')).not.toHaveAttribute('data-scroll-scenes');
  await expect(page.locator('.wec-site')).not.toHaveAttribute('data-scroll-locked');
  await expect(page.locator('.program-window[inert]')).toHaveCount(0);
  for (const panel of await page.locator('.pillar-panel, .program-window').all()) await expect(panel).toBeVisible();
  expect(await page.locator('.program-window-body').evaluateAll(bodies => bodies.every(body => body.scrollHeight <= body.clientHeight + 1))).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.wec-site')).toHaveAttribute('data-scroll-scenes', 'true');
  await page.locator('.experience-nav button').last().click();
  await expect(page.locator('#experience')).toHaveAttribute('data-active-program', '2');
  await page.keyboard.press('Escape');
  await page.locator('.foundation-nav button').last().click();
  await expect(page.locator('#pillars')).toHaveAttribute('data-raised-pillars', '5');
  await page.keyboard.press('Escape');
  await expect(page.locator('.wec-site')).not.toHaveAttribute('data-scroll-locked');
});
