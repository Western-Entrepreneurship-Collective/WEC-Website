import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const sections = ["hero", "about", "experience", "community", "pillars", "ecosystem", "find-your-place", "join"];

async function useReadingMode(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("wec-motion-v2", "off"));
}

async function waitForStoryLayout(page: Page) {
  await expect(page.locator("html")).toHaveClass(/\blenis\b/);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

test("full motion is the default despite system or legacy preferences", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("wec-motion", "off"));
  await page.goto("/");
  await expect(page.locator(".wec-site")).toHaveAttribute("data-motion", "full");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  await expect.poll(() => page.locator(".arrow").first().evaluate(element => getComputedStyle(element).transitionDuration)).toBe("0.24s");
  await page.locator(".motion-toggle").click();
  await expect(page.locator(".wec-site")).toHaveAttribute("data-motion", "reduced");
  await page.locator(".motion-toggle").click();
  await expect(page.locator(".wec-site")).toHaveAttribute("data-motion", "full");
  await page.reload();
  await expect(page.locator(".wec-site")).toHaveAttribute("data-motion", "full");
});

test("complete narrative, valid anchors, assets, and responsive bounds", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await useReadingMode(page);
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("By Founders, for Founders.");
  expect(await page.locator("main > section").evaluateAll(nodes => nodes.map(node => node.id))).toEqual(sections);
  expect(await page.locator("a[href^='#']").evaluateAll(links => links.filter(link => !document.getElementById(link.getAttribute("href")!.slice(1))).map(link => link.outerHTML))).toEqual([]);
  await page.evaluate(() => document.fonts.ready);
  // Lower-page and closed-dialog logos intentionally use native lazy loading.
  const sources = await page.locator("img").evaluateAll(images => [...new Set((images as HTMLImageElement[]).map(image => image.src))]);
  for (const source of sources) expect((await page.request.get(source)).ok()).toBeTruthy();
  await expect.poll(() => page.locator(".hero-mark").evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  expect(await page.locator(".program-window").count()).toBe(3);
  expect(await page.locator(".lab-sheet, .lab-stage").count()).toBe(0);
  expect(await page.locator(".pillar-panel").count()).toBe(5);
  await expect(page.locator("#experience #from-the-field .field-person")).toHaveCount(5);
  await expect(page.locator("main > #from-the-field, .foundation-base")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("audience choices lead to the appropriate experience", async ({ page }) => {
  await useReadingMode(page);
  await page.goto("/#find-your-place");
  const choice = page.getByRole("button", { name: "I have an idea.", exact: false });
  await choice.click();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#audience-answer")).toContainText("Founder Labs");
  await page.getByRole("link", { name: "Put it to the test" }).click();
  await expect(page).toHaveURL(/#founder-labs$/);
  await expect(page.locator("#founder-labs")).toBeInViewport();
});

test("CTA availability dialogs are honest, keyboard accessible, and restore focus", async ({ page }) => {
  await useReadingMode(page);
  await page.goto("/#join");
  const button = page.getByRole("button", { name: "Join WEC", exact: true });
  await button.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Membership details aren’t available");
  await expect(dialog.getByRole("button", { name: "Close dialog" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("link")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(button).toBeFocused();
  await page.getByRole("button", { name: "Attend an event" }).click();
  await expect(page.getByRole("dialog")).toContainText("Event dates and registration details aren’t available");
  await page.getByRole("dialog").getByRole("link").click();
  await expect(page).toHaveURL(/#experience$/);
});

test("reduced motion exposes all chapters and passes accessibility audit", async ({ page }) => {
  await useReadingMode(page);
  await page.goto("/");
  await expect(page.locator(".wec-site")).toHaveAttribute("data-motion", "reduced");
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  for (const panel of await page.locator(".pillar-panel, .program-window").all()) await expect(panel).toBeVisible();
  const result = await new AxeBuilder({ page }).options({
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    rules: { "label-content-name-mismatch": { enabled: true } },
  }).analyze();
  expect(result.violations.map(violation => ({ id: violation.id, nodes: violation.nodes.map(node => node.target) }))).toEqual([]);
});

test("navigation, scroll chapters, and motion cleanup work", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.locator(".wec-site")).toHaveAttribute("data-motion", "full");
  if (isMobile) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
    await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: /Pillars/ }).click();
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
    await expect(page).toHaveURL(/#pillars$/);
    await expect(page.locator(".pin-spacer")).toHaveCount(1);
  } else {
    await expect(page.locator(".wec-site")).toHaveAttribute("data-story-desktop", "true");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Pillars" }).click();
    await expect(page.locator(".foundation-intro")).toBeInViewport();
    await expect(page.locator(".pin-spacer")).toHaveCount(1);
    await expect(page.locator(".foundation-nav button")).toHaveCount(5);
    await expect(page.locator(".building-column")).toHaveCount(5);
  }
  await page.locator(".motion-toggle").click();
  await expect(page.locator(".wec-site")).toHaveAttribute("data-motion", "reduced");
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".wec-site")).toHaveAttribute("data-motion", "reduced");
});

test("direct anchors restore correctly on reload", async ({ page, isMobile }) => {
  await page.goto("/#ecosystem");
  await expect(page.locator("#ecosystem")).toBeInViewport();
  if (!isMobile) await expect(page.locator(".wec-site")).toHaveAttribute("data-story-desktop", "true");
  await page.reload();
  await expect(page.locator("#ecosystem")).toBeInViewport();
});

test("spatial layers respond to scrolling and fully release into reading mode", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await waitForStoryLayout(page);
  await expect(page.locator(".wec-site")).toHaveAttribute("data-spatial-story", "true");

  for (const [trigger, layer, before, after] of [
    [".hero-stage", ".hero-room", 0, -220],
    [".about-evidence", ".proof-guide-horizontal", .9, .35],
    [".ecosystem-map", ".ecosystem-camera", .7, .1],
    [".join-composition", ".join-fragment", .9, .15],
  ] as const) {
    const position = await page.locator(trigger).evaluate(element => element.getBoundingClientRect().top + scrollY);
    const height = await page.evaluate(() => innerHeight);
    await page.evaluate(y => scrollTo(0, y), Math.max(0, position - before * height));
    await page.waitForTimeout(800);
    const initial = await page.locator(layer).first().evaluate(element => getComputedStyle(element).transform);
    await page.evaluate(y => scrollTo(0, y), Math.max(0, position - (after < 0 ? after : after * height)));
    await expect.poll(() => page.locator(layer).first().evaluate(element => getComputedStyle(element).transform)).not.toBe(initial);
  }
  await page.locator(".motion-toggle").click();
  await expect(page.locator(".wec-site")).not.toHaveAttribute("data-spatial-story");
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  for (const decoration of await page.locator(".motion-art").all()) await expect(decoration).not.toBeVisible();
  await expect(page.locator(".ecosystem-camera")).not.toHaveAttribute("style", /transform/);
  for (const title of await page.locator(".pillar-word").all()) await expect(title).toBeVisible();
  expect(errors).toEqual([]);
});

test("door opens into About, reverses, and releases its transforms", async ({ page }) => {
  await page.goto("/");
  await waitForStoryLayout(page);
  const notes = page.getByRole("complementary", { name: "Your invitation to WEC" });
  await expect(notes).toHaveCSS("opacity", "1");
  await expect(notes.locator(".door-note").first()).toHaveCSS("opacity", "1");
  await expect(notes).toContainText("You don’t need a finished idea.");
  await expect(notes).toContainText("People to build with.");
  const leaf = page.locator(".door-leaf");
  const closed = await leaf.evaluate(element => getComputedStyle(element).transform);
  const distance = await page.locator(".hero-stage").evaluate(element => (element as HTMLElement).offsetHeight);
  await page.evaluate(y => scrollTo(0, y), distance * .48);
  await expect.poll(() => leaf.evaluate(element => getComputedStyle(element).transform)).not.toBe(closed);
  await expect.poll(() => page.locator(".hero-room").evaluate(element => new DOMMatrix(getComputedStyle(element).transform).a)).toBeGreaterThan(1.5);
  await page.evaluate(y => scrollTo(0, y), distance + 5);
  await expect(page.locator("#about-heading")).toBeInViewport();
  await expect(page.locator(".hero-stage")).toHaveCSS("pointer-events", "none");
  const prompt = page.locator("#starting-prompt");
  const initial = await prompt.textContent();
  await page.getByRole("button", { name: "Try another prompt" }).click();
  await expect(prompt).not.toHaveText(initial!);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(notes).toHaveCSS("opacity", "1");
  await expect.poll(() => leaf.evaluate(element => getComputedStyle(element).transform)).toBe(closed);
  await expect(page.locator(".hero-stage")).not.toHaveCSS("pointer-events", "none");
  await page.locator(".motion-toggle").click();
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await expect(page.locator(".hero-room")).not.toHaveAttribute("style", /transform/);
  await expect(leaf).not.toHaveAttribute("style", /transform/);
});

test("starting prompts and community invitations respond to keyboard input", async ({ page }) => {
  await useReadingMode(page);
  await page.goto("/#about");
  const prompt = page.locator("#starting-prompt");
  const initial = await prompt.textContent();
  const next = page.getByRole("button", { name: "Try another prompt" });
  await next.focus();
  await next.press("Enter");
  await expect(prompt).not.toHaveText(initial!);
  await next.press("Enter");
  await next.press("Enter");
  await expect(prompt).toHaveText(initial!);
  await expect(next).toBeFocused();
  const dinner = page.getByRole("button", { name: "Dinners", exact: true });
  await dinner.focus();
  await dinner.press("Enter");
  await expect(dinner).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#community-answer")).toContainText("Pull up a chair");
  await expect(page.locator(".community-choices [aria-pressed=true]")).toHaveCount(1);
  await expect(page.locator(".pillar-word")).toHaveText(["Build", "Discover", "Connect", "Explore", "Contribute"]);
});

test("program windows overlap, navigate, and restore accessible reading order", async ({ page }) => {
  await page.goto("/#experience");
  await waitForStoryLayout(page);
  const buttons = page.locator(".experience-nav button");
  for (const i of [0, 1, 2, 0]) {
    await buttons.nth(i).click();
    const card = page.locator(`#experience-program-${i}`);
    {
      await expect(page.locator("#experience")).toHaveAttribute("data-active-program", String(i));
      await expect(buttons.nth(i)).toHaveAttribute("aria-current", "true");
      await expect(card).not.toHaveAttribute("inert", "");
      expect(await page.locator(".program-window[inert]").count()).toBe(2);
      await expect.poll(() => card.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return rect.top >= 72 && rect.bottom <= innerHeight;
      })).toBeTruthy();
      if (i > 0) {
        const overlap = await card.evaluate(element => {
          const previous = element.previousElementSibling!.getBoundingClientRect();
          const current = element.getBoundingClientRect();
          return current.top > previous.top && current.top < previous.bottom;
        });
        expect(overlap).toBeTruthy();
      }
    }
    await expect(card.locator(".program-window-footer .text-link")).toBeInViewport();
    await expect(card.locator('.window-marks .is-filled')).toHaveCount(i + 1);
    if (i === 2) await expect(card.locator('h3 .program-window-number')).toHaveText('03');
    expect(await card.evaluate(element => {
      const footer = element.querySelector('.program-window-footer')!.getBoundingClientRect();
      const field = element.querySelector('.field')?.getBoundingClientRect();
      return footer.bottom <= element.getBoundingClientRect().bottom + 1 && (!field || field.bottom <= footer.top);
    })).toBeTruthy();
  }
  await page.locator("#experience-program-0 .program-window-footer button").click();
  await expect(page.locator("#experience")).toHaveAttribute("data-active-program", "1");
  await expect(page.locator("#founder-labs")).toContainText("positioning statement");
  await page.locator(".motion-toggle").click();
  for (const card of await page.locator(".program-window").all()) {
    await expect(card).not.toHaveAttribute("inert", "");
    await expect(card).not.toHaveAttribute("aria-hidden", "true");
  }
});

test("field highlights consume scrolling while the surrounding page stays fixed", async ({ page, isMobile }) => {
  await page.goto("/#from-the-field");
  await waitForStoryLayout(page);
  await expect(page.locator(".wec-site")).toHaveAttribute("data-motion", "full");
  await expect(page.locator(".wec-site")).toHaveAttribute("data-scroll-locked", "experience");
  await expect(page.locator("#experience")).toHaveAttribute("data-active-program", "2");
  const position = await page.evaluate(() => scrollY);
  await page.waitForTimeout(550);
  for (const i of [1, 2, 3, 4, 3, 2, 1, 0]) {
    const forward = i > Number(await page.locator(".field").getAttribute("data-active-person"));
    if (isMobile) await page.keyboard.press(forward ? "ArrowDown" : "ArrowUp");
    else await page.mouse.wheel(0, forward ? 4 : -4);
    await page.waitForTimeout(125);
    const active = page.locator(".field-person.is-active");
    await expect(active).toHaveCount(1);
    await expect(active).toContainText(["Founders", "Operators", "Investors", "Alumni", "Professionals"][i]);
    await expect(active).toBeInViewport();
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(position, 0);
    await expect(page.locator("#experience")).toHaveAttribute("data-active-program", "2");
  }
  if (isMobile) await page.keyboard.press("ArrowUp");
  else await page.mouse.wheel(0, -4);
  await expect(page.locator("#experience")).toHaveAttribute("data-active-program", "1");
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(position, 0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".wec-site")).not.toHaveAttribute("data-scroll-locked");
  await expect(page.locator("html")).not.toHaveAttribute("style", /overflow: hidden/);
  await page.locator('.experience-nav button').last().click();
  await page.locator('.field-person button').last().click();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.wec-site')).not.toHaveAttribute('data-scroll-locked');
  await page.locator('.motion-toggle').click();
  for (const cycle of [0, 1]) {
    if (cycle) {
      await page.locator('.motion-toggle').click();
      await expect(page.locator('.wec-site')).toHaveAttribute('data-scroll-scenes', 'true');
      await page.locator('.motion-toggle').click();
    }
    await page.locator('.field-person button').nth(2).click();
    await expect(page.locator('.field-person.is-active')).toHaveCount(1);
    await expect(page.locator('.field-person.is-active')).toContainText('Investors');
    await expect(page.locator('.field-progress')).toHaveText('03 / 05');
  }
});

test("five building pillars rise quickly while the document stays locked", async ({ page, isMobile }) => {
  await page.goto("/#pillars");
  await waitForStoryLayout(page);
  const entry = await page.locator(".foundation-scene").evaluate(element => element.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-height")) - 70);
  await page.evaluate(y => scrollTo(0, y), entry);
  await page.waitForTimeout(150);
  if (isMobile) await page.keyboard.press("PageDown");
  else await page.mouse.wheel(0, 160);
  await expect(page.locator(".wec-site")).toHaveAttribute("data-scroll-locked", "pillars");
  await expect(page.locator("#pillars")).toHaveAttribute("data-raised-pillars", "0");
  const position = await page.evaluate(() => scrollY);
  await page.waitForTimeout(180);
  for (const raised of [1, 2, 3, 4, 5, 4, 3, 2, 1]) {
    const forward = raised > Number(await page.locator("#pillars").getAttribute("data-raised-pillars"));
    if (isMobile) await page.keyboard.press(forward ? "ArrowDown" : "ArrowUp");
    else await page.mouse.wheel(0, forward ? 32 : -32);
    await page.waitForTimeout(180);
    await expect(page.locator("#pillars")).toHaveAttribute("data-raised-pillars", String(raised));
    await expect(page.locator(".building-column.is-raised")).toHaveCount(raised);
    await expect(page.locator(`#pillar-${raised - 1}`)).toBeVisible();
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(position, 0);
  }
  expect(await page.locator(".foundation-scene").evaluate(element => element.getBoundingClientRect().bottom <= innerHeight + 1)).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(page.locator(".wec-site")).not.toHaveAttribute("data-scroll-locked");
  await expect(page.locator(".building-column.is-raised")).toHaveCount(5);
  await page.locator(".foundation-nav button").last().click();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".wec-site")).not.toHaveAttribute("data-scroll-locked");
  await page.locator(".motion-toggle").click();
  for (const panel of await page.locator(".pillar-panel").all()) await expect(panel).toBeVisible();
  for (const column of await page.locator(".building-column").all()) await expect(column).not.toHaveAttribute("style", /transform/);
  await expect(page.locator("html")).not.toHaveAttribute("style", /overflow: hidden/);
});

test("program scrolling advances whole windows without internal scrolling", async ({ page, isMobile }) => {
  await page.goto("/#venture-studio");
  await waitForStoryLayout(page);
  await expect(page.locator(".wec-site")).toHaveAttribute("data-scroll-locked", "experience");
  await expect(page.locator("#venture-studio")).toContainText("Trade feedback and strengths");
  await expect(page.locator(".program-window-scroll, .studio-sheet, .studio-steps, .labs-focus, .labs-topics")).toHaveCount(0);
  expect(await page.locator("main > #venture-studio, main > #founder-labs").count()).toBe(0);
  const position = await page.evaluate(() => scrollY);
  for (const index of [1, 2, 1, 0]) {
    const forward = index > Number(await page.locator("#experience").getAttribute("data-active-program"));
    await page.waitForTimeout(550);
    if (isMobile) await page.keyboard.press(forward ? "PageDown" : "PageUp");
    else await page.mouse.wheel(0, forward ? 18 : index === 1 ? -4 : -18);
    await expect(page.locator("#experience")).toHaveAttribute("data-active-program", String(index));
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(position, 0);
    const body = page.locator(`#experience-program-${index} .program-window-body`);
    expect(await body.evaluate(element => ["auto", "scroll"].includes(getComputedStyle(element).overflowY))).toBeFalsy();
    expect(await body.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  }
  await page.keyboard.press("Escape");
  await expect(page.locator(".wec-site")).not.toHaveAttribute("data-scroll-locked");
  await page.goto("/#founder-labs");
  await waitForStoryLayout(page);
  await expect(page.locator("#experience")).toHaveAttribute("data-active-program", "1");
  await expect(page.locator("#founder-labs")).toContainText("positioning statement");
  await page.reload();
  await expect(page.locator("#experience")).toHaveAttribute("data-active-program", "1");
});
