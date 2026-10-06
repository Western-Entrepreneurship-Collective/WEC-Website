/**
 * /slack — the page an existing member is emailed to get into the club's Slack.
 *
 * ⛔ The test server runs WITHOUT NEXT_PUBLIC_WEC_SLACK_URL (playwright.config.ts
 * sets only the Google Form vars), which is exactly the state this page has to
 * survive: it must say the link is not set up rather than render a button that
 * goes nowhere. The live button is checked against the deployment, where the
 * variable is set, because the value is inlined at build time and cannot be
 * injected at runtime.
 */
import { test, expect } from "@playwright/test";

test("tells a member what to do and collects nothing at all", async ({ page }) => {
  await page.goto("/slack");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Join the WEC Slack.");

  // The second step is the whole reason the page says more than "here is a link":
  // it asks for a name, a year and a short intro.
  const steps = page.getByText(/say hi in #introductions/i);
  await expect(steps).toBeVisible();
  const intro = await page.locator(".join-next-steps li").last().innerText();
  for (const word of ["name", "year", "intro"]) {
    expect(intro.toLowerCase(), `the intro step should ask for a ${word}`).toContain(word);
  }

  // ⛔ NOTHING is gathered here. The moment a field appears this page needs the
  // privacy consent every other form carries, and it stops being safe to mail
  // to a list without ceremony.
  await expect(page.locator("form, input, textarea, select")).toHaveCount(0);

  await expect(page.getByRole("link", { name: /privacy policy/i })).toBeVisible();
});

test("without the Slack link set, it says so instead of showing a dead button", async ({ page }) => {
  await page.goto("/slack");
  await expect(page.locator('a[href*="slack.com"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: /join the wec slack/i })).toHaveCount(0);
  await expect(page.getByText(/not set up yet/i)).toBeVisible();
});

test("is kept out of search results", async ({ page }) => {
  await page.goto("/slack");
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots ?? "", "it is handed to members, not found in search").toContain("noindex");
});
