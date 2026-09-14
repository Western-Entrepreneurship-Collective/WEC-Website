import { test, expect, type Page } from "@playwright/test";

async function wheel(page: Page, deltaY: number) {
  // Normalized wheel events also exercise the controller on mobile WebKit.
  await page.evaluate(delta => document.body.dispatchEvent(new WheelEvent("wheel", { deltaY: delta, cancelable: true, bubbles: true })), deltaY);
}

async function ready(page: Page, hash = "") {
  await page.goto(`/${hash}`);
  await expect(page.locator(".wec-site")).toHaveAttribute("data-scroll-scenes", "true");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

test("pillars fade their roof and base in both directions and stay empty on reverse exit", async ({ page }) => {
  await ready(page, "#pillar-0");
  await expect(page.locator("#pillars")).toHaveAttribute("data-raised-pillars", "1");
  for (const part of [".building-roof", ".building-steps"]) await expect(page.locator(part)).toHaveCSS("opacity", "1");
  await page.keyboard.press("ArrowUp");
  await expect(page.locator("#pillars")).toHaveAttribute("data-raised-pillars", "0");
  for (const part of [".building-roof", ".building-steps"]) await expect(page.locator(part)).toHaveCSS("opacity", "0");
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(".wec-site")).not.toHaveAttribute("data-scroll-locked");
  await expect(page.locator(".building-column.is-raised")).toHaveCount(0);
  await wheel(page, 12);
  await expect(page.locator(".wec-site")).toHaveAttribute("data-scroll-locked", "pillars");
  await expect(page.locator("#pillars")).toHaveAttribute("data-raised-pillars", "0");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#pillars")).toHaveAttribute("data-raised-pillars", "1");
  for (const part of [".building-roof", ".building-steps"]) await expect(page.locator(part)).toHaveCSS("opacity", "1");
  await page.locator(".motion-toggle").click();
  for (const part of [".building-roof", ".building-steps"]) {
    await expect(page.locator(part)).toBeVisible();
    await expect(page.locator(part)).not.toHaveAttribute("style", /opacity|visibility/);
  }
});

test("reversing cancels queued forward steps and keyboard navigation clears pending input", async ({ page }) => {
  await ready(page, "#venture-studio");
  await expect(page.locator(".wec-site")).toHaveAttribute("data-scroll-locked", "experience");
  const position = await page.evaluate(() => scrollY);
  await wheel(page, 1280);
  await expect(page.locator("#experience")).toHaveAttribute("data-active-program", "1");
  await wheel(page, -720);
  await expect(page.locator("#experience")).toHaveAttribute("data-active-program", "0");
  await page.waitForTimeout(650);
  await expect(page.locator("#experience")).toHaveAttribute("data-active-program", "0");
  await wheel(page, 1280);
  await page.keyboard.press("Home");
  await page.waitForTimeout(650);
  await expect(page.locator("#experience")).toHaveAttribute("data-active-program", "0");
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(position, 0);
});

test("Experience re-enters from either exit without leaking the release gesture to the page", async ({ page }) => {
  await ready(page, "#from-the-field");
  await page.locator(".field-person button").last().click();
  await page.waitForTimeout(150);
  const position = await page.evaluate(() => scrollY);
  await wheel(page, 800);
  await expect(page.locator(".wec-site")).not.toHaveAttribute("data-scroll-locked");
  await page.waitForTimeout(250);
  expect(Math.abs(await page.evaluate(() => scrollY) - position)).toBeLessThanOrEqual(5);
  await wheel(page, -8);
  await expect(page.locator(".wec-site")).toHaveAttribute("data-scroll-locked", "experience");
  await expect(page.locator(".field")).toHaveAttribute("data-active-person", "2");
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(".field")).toHaveAttribute("data-active-person", "1");
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(".wec-site")).not.toHaveAttribute("data-scroll-locked");
  await wheel(page, 12);
  await expect(page.locator(".wec-site")).toHaveAttribute("data-scroll-locked", "experience");
  await expect(page.locator("#experience")).toHaveAttribute("data-active-program", "0");
});

test("touch reversal during a transition cancels stale movement", async ({ page }) => {
  await ready(page, "#from-the-field");
  await expect(page.locator(".wec-site")).toHaveAttribute("data-scroll-locked", "experience");
  const touch = async (type: string, y: number) => page.evaluate(({ type, y }) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "touches", { value: type === "touchend" ? [] : [{ clientX: 190, clientY: y }] });
    document.querySelector(".field")!.dispatchEvent(event);
  }, { type, y });
  await page.waitForTimeout(150);
  await touch("touchstart", 500);
  await touch("touchmove", 260);
  await expect(page.locator(".field")).toHaveAttribute("data-active-person", "1");
  await touch("touchmove", 500);
  await expect(page.locator(".field")).toHaveAttribute("data-active-person", "0");
  await touch("touchend", 500);
  await page.waitForTimeout(350);
  await expect(page.locator(".field")).toHaveAttribute("data-active-person", "0");
});

test("interrupting an anchor scroll still allows later scenes to capture scrolling", async ({ page }) => {
  await ready(page);
  await page.locator('.site-header a[href="#ecosystem"]').first().evaluate(el => (el as HTMLAnchorElement).click());
  await page.waitForTimeout(80);
  await wheel(page, -80);
  // Let the interrupted gesture settle before repositioning without user input.
  await page.waitForTimeout(2100);
  // Depending on the frame at interruption, the reversal may already have
  // entered a scene. Release it before testing a fresh forward approach.
  if (await page.locator(".wec-site").getAttribute("data-scroll-locked")) await page.keyboard.press("Escape");
  const entry = await page.locator(".experience-stage").evaluate(el => el.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-height")) - 70);
  await page.evaluate(y => scrollTo(0, y), entry);
  await page.waitForTimeout(200);
  await wheel(page, 160);
  await expect(page.locator(".wec-site")).toHaveAttribute("data-scroll-locked", "experience");
  await expect(page.locator("#experience")).toHaveAttribute("data-active-program", "0");
});

test("reversing the wheel discards forward momentum outside the scenes", async ({ page }) => {
  await ready(page);
  const position = await page.evaluate(() => new Promise<number>(resolve => {
    const reverse = () => {
      if (scrollY <= 0) return;
      window.removeEventListener("scroll", reverse);
      const position = scrollY;
      document.body.dispatchEvent(new WheelEvent("wheel", { deltaY: -300, bubbles: true, cancelable: true }));
      resolve(position);
    };
    window.addEventListener("scroll", reverse);
    document.body.dispatchEvent(new WheelEvent("wheel", { deltaY: 600, bubbles: true, cancelable: true }));
  }));
  expect(position).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(position);
  await expect(page.locator(".wec-site")).not.toHaveAttribute("data-scroll-locked");
});

test("a slowly settling wheel gesture still enters the scene", async ({ page }) => {
  await ready(page);
  const start = await page.locator(".experience-stage").evaluate(el => el.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-height")) - 10);
  await page.evaluate(y => scrollTo(0, y), start - 600);
  await page.waitForTimeout(250);
  // Cross the rounded trigger coordinate even when WebKit rounds scrollTo down.
  await wheel(page, 602 / .85);
  await expect(page.locator(".wec-site")).toHaveAttribute("data-scroll-locked", "experience");
  await expect(page.locator("#experience")).toHaveAttribute("data-active-program", "0");
});

test("a complete forward and reverse page traversal visits both scenes and releases all locks", async ({ page }) => {
  await ready(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const direction of [1, -1]) {
    const visited = new Set<string>();
    let reachedEnd = false;
    for (let step = 0; step < 70; step++) {
      const state = await page.evaluate(() => ({
        locked: (document.querySelector(".wec-site") as HTMLElement).dataset.scrollLocked,
        atEnd: window.scrollY >= document.documentElement.scrollHeight - innerHeight - 2,
        atStart: window.scrollY <= 2,
      }));
      if (!state.locked && (direction > 0 ? state.atEnd : state.atStart)) { reachedEnd = true; break; }
      if (state.locked) {
        visited.add(state.locked);
        await page.keyboard.press(direction > 0 ? "ArrowDown" : "ArrowUp");
      } else await wheel(page, direction * 1800);
      await page.waitForTimeout(180);
    }
    expect(reachedEnd).toBeTruthy();
    expect([...visited].sort()).toEqual(["experience", "pillars"]);
    await expect(page.locator("html")).not.toHaveAttribute("style", /overflow: hidden/);
  }
  await expect(page.locator(".door-leaf")).toHaveCSS("opacity", "1");
  expect(errors).toEqual([]);
});

test("mobile navigation stops background scrolling and lands below the header", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile navigation");
  await ready(page, "#venture-studio");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator(".wec-site")).not.toHaveAttribute("data-scroll-locked");
  const position = await page.evaluate(() => scrollY);
  await wheel(page, 600);
  await wheel(page, -600);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(position, 0);
  await page.locator('.mobile-menu a[href="#ecosystem"]').click();
  await expect(page.locator(".mobile-menu")).toBeHidden();
  await expect.poll(() => page.locator("#ecosystem").evaluate(el => Math.abs(el.getBoundingClientRect().top - parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-height")) - 16))).toBeLessThan(2);
  await expect(page.locator("html")).not.toHaveAttribute("style", /overflow: hidden/);
});


test("Field and pillars accumulate deliberate scrolling across brief reading pauses", async ({ page }) => {
  for (const scene of [
    { hash: '#from-the-field', selector: '.field', attribute: 'data-active-person', before: '0', after: '1', partial: 120 },
    { hash: '#pillar-0', selector: '#pillars', attribute: 'data-raised-pillars', before: '1', after: '2', partial: 160 },
  ]) {
    await ready(page, scene.hash);
    const position = await page.evaluate(() => scrollY);
    await wheel(page, scene.partial);
    await page.waitForTimeout(550);
    await expect(page.locator(scene.selector)).toHaveAttribute(scene.attribute, scene.before);
    await wheel(page, scene.partial);
    await expect(page.locator(scene.selector)).toHaveAttribute(scene.attribute, scene.after);
    await wheel(page, -scene.partial);
    await page.waitForTimeout(550);
    await expect(page.locator(scene.selector)).toHaveAttribute(scene.attribute, scene.after);
    await wheel(page, -scene.partial);
    await expect(page.locator(scene.selector)).toHaveAttribute(scene.attribute, scene.before);
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(position, 0);
  }
});
