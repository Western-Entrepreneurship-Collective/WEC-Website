import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PEOPLE, signIn } from "./support/helpers";

const PAGES = ["/os", "/os?view=board", "/os/tasks/new", "/os/tasks?show=closed", "/os/calendar", "/os/calendar?scope=all", "/os/teams", "/os/teams/content", "/os/teams/finance", "/os/events", "/os/projects", "/os/projects/new", "/os/sops", "/os/meetings", "/os/notifications", "/os/profile"];

test("the main screens pass an accessibility audit and do not scroll sideways", async ({ page }) => {
  test.setTimeout(120000);
  await signIn(page, PEOPLE.vpContent);
  for (const path of PAGES) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.map(v => `${path} ${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});

test("the President's screen passes the same audit", async ({ page }) => {
  await signIn(page, PEOPLE.president);
  await page.goto("/os/president");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.map(v => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("administration passes the same audit", async ({ page }) => {
  test.setTimeout(90000);
  await signIn(page, PEOPLE.admin);
  for (const path of ["/os/admin", "/os/admin/executives", "/os/admin/org", "/os/admin/permissions", "/os/admin/templates", "/os/admin/automation", "/os/admin/jobs", "/os/admin/audit", "/os/admin/years", "/os/admin/archives", "/os/admin/settings"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.map(v => `${path} ${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});

test("sign-in passes the audit too", async ({ page }) => {
  await page.goto("/os/login");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.map(v => v.id)).toEqual([]);
});
