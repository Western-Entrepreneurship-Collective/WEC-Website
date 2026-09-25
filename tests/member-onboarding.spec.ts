/**
 * What a new member sees in the thirty seconds after they join.
 *
 * Until now the success screen said "You're in" and stopped. Somebody signed up
 * at the booth, got a full stop, and was never heard from again. This is the
 * flow approved on 22 September: land in the Slack, say hi, and know that dues
 * start in January.
 *
 *   1  the screen says dues open in January, so nobody is surprised in the new year
 *   2  the intro is built from the answers they typed, and nothing is invented
 *   3  the Slack step is ABSENT, not broken, when the club's Slack link is unset
 *   4  "Your signature is recorded" still shows, so step four is not lost
 *
 * ⛔ TEST 3 IS THE ONE THAT MATTERS AT MERGE TIME. This branch is merged before
 * anybody adds NEXT_PUBLIC_WEC_SLACK_URL to the deploy settings, so the screen
 * has to be correct with the setting missing. A "Join the Slack" button that
 * goes nowhere, on somebody's first thirty seconds with the club, is worse than
 * no button at all.
 */
import { test, expect, type Page } from "@playwright/test";

// Fill the member form with answers a real person could have given, and send
// it. The API is stubbed: this file is about the screen afterwards, not about
// whether Google accepted the row, which tests/privacy.spec.ts already covers.
async function joinAs(page: Page, answers: { name: string; email: string; year: string; building: string }) {
  await page.route("**/api/join", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));

  await page.goto("/apply/member");
  await page.getByLabel("Name", { exact: true }).fill(answers.name);
  await page.getByLabel(/email/i).first().fill(answers.email);
  await page.getByLabel("Year").selectOption(answers.year);
  await page.getByLabel(/What are you building/).fill(answers.building);
  await page.getByLabel(/signature/i).fill(answers.name);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /join|send|submit/i }).first().click();
  await expect(page.getByRole("heading", { name: /You.re in/i })).toBeVisible();
}

const SAMPLE = {
  name: "Test Member",
  email: "test.member@uwo.ca",
  year: "Year 2",
  building: "a study tool for first years",
};

test("1  the screen says dues open in January", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "browser independent");
  await joinAs(page, SAMPLE);
  await expect(page.getByText(/free this term/i)).toBeVisible();
  await expect(page.getByText(/dues open in January/i)).toBeVisible();
});

test("2  the ready made intro uses their own answers", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "browser independent");
  await joinAs(page, SAMPLE);
  const intro = page.locator(".join-intro");
  await expect(intro).toBeVisible();
  const text = (await intro.textContent()) ?? "";
  // Their first name, their year and the thing they typed. Nothing else.
  expect(text).toContain("Test");
  expect(text).toContain("Year 2");
  expect(text).toContain("a study tool for first years");
});

test("3  with no Slack link set, the Slack step is absent rather than broken", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "browser independent");
  // The test server runs without NEXT_PUBLIC_WEC_SLACK_URL, which is exactly
  // the state this branch is merged in.
  await joinAs(page, SAMPLE);
  await expect(page.getByRole("link", { name: /join the wec slack/i })).toHaveCount(0);
  // And nothing anywhere on the screen points at a Slack address.
  const slackLinks = page.locator('a[href*="slack.com"]');
  await expect(slackLinks).toHaveCount(0);
  // The rest of the screen is still there.
  await expect(page.locator(".join-intro")).toBeVisible();
});

test("4  the signature line still says it is recorded", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "browser independent");
  await joinAs(page, SAMPLE);
  await expect(page.getByText(/signature is recorded/i)).toBeVisible();
});

test("5  the new screen does not introduce a sideways scroll on a phone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "browser independent");
  await page.setViewportSize({ width: 390, height: 844 });
  await joinAs(page, SAMPLE);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    "no side scroll").toBe(true);
});
