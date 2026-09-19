/**
 * The exec applications page, driven in a real browser against the production
 * build, with the server pointed at a local stand-in for Google
 * (tests/support/fakeGoogle.ts, started by tests/support/globalSetup.ts). One
 * full application at 375px wide and one at desktop width, each checked all the
 * way to the row the stand-in received. Nothing leaves this machine.
 */
import { test, expect, type Page } from "@playwright/test";
import { E2E_FAKE_ORIGIN, ENTRY } from "./support/fakeGoogle";

const PAGE = "/apply/executives";
const MEMBER = "/apply/member";

function words(n: number, word = "idea") { return new Array(n).fill(word).join(" "); }

async function received(page: Page) {
  const response = await page.request.get(`${E2E_FAKE_ORIGIN}/__received`);
  return (await response.json()) as Record<string, string>[];
}

async function openAndWait(page: Page) {
  await page.goto(PAGE);
  // Opens straight on the form: the mark, one line, then stage 1.
  await expect(page.locator(".exec-head")).toContainText("WEC Executive Applications 2026-27");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Let's get to know you.");
  await expect(page.locator("fieldset.exec-fs")).not.toHaveAttribute("disabled");
}

async function fillAbout(page: Page, name: string) {
  await page.locator("#name").fill(name);
  await page.locator("#westernEmail").fill("test.applicant@uwo.ca");
  await page.locator("#personalEmail").fill("test.applicant@example.com");
  await page.locator("#year").selectOption("2nd Year");
  await page.locator("#program").fill("Computer Science");
  await page.locator("#resume").fill("https://example.com/resume");
  await page.locator("#intro").fill("I build small tools for my classmates.");
  await expect(page.locator("#intro-count")).toHaveText("7 / 150 words");
}

async function fillGeneral(page: Page) {
  await page.locator("#g1").fill(`My pitch. ${words(20)}`);
  await page.locator("#g2").fill(`Proud of this. ${words(20)}`);
}

async function fillRole(page: Page, count: number) {
  for (let i = 1; i <= count; i++) await page.locator(`#r${i}`).fill(`Role answer ${i}. ${words(10)}`);
}

test("a full application at desktop width: every stage, role switch, edit, submit", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one desktop run is enough; each run is a real submission");
  const name = `Desktop Tester ${Date.now()}`;
  await openAndWait(page);
  // No landing page, no hero: nothing between the header and the form.
  await expect(page.locator(".exec-page > *")).toHaveCount(2);

  // Continue with nothing filled in: every required box says why, nothing moves.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Let's get to know you.");
  await expect(page.locator(".exec-error").first()).toBeVisible();
  await expect(page.locator(".exec-actions-hint")).toContainText("need fixing");

  await fillAbout(page, name);
  // The phone rule runs in the browser from the same schema as the server.
  await page.locator("#phone").fill("12345");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#exec-error-phone")).toContainText("too short");
  await page.locator("#phone").fill("");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Before we talk roles...");
  // Live counter, and over the limit it refuses to move on.
  await page.locator("#g1").fill(words(251));
  await expect(page.locator("#g1-count")).toHaveText("251 / 250 words");
  await expect(page.locator("#g1-count")).toHaveClass(/is-over/);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#exec-error-g1")).toContainText("The limit is 250");
  await fillGeneral(page);
  // Back never loses an answer.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator("#name")).toHaveValue(name);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#g2")).toHaveValue(`Proud of this. ${words(20)}`);
  await page.getByRole("button", { name: "Continue" }).click();

  // Position: clicking a card IS the continue.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Where do you want to build?");
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
  await expect(page.locator(".exec-role")).toHaveCount(12);
  await page.getByRole("button", { name: /^VP Content/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("VP Content");
  // Only this role's questions: VP Content has four.
  await expect(page.locator(".exec-long textarea")).toHaveCount(4);
  await page.locator("#r1").fill("Written for VP Content.");

  // Switching role after answering asks first. Saying no keeps everything.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: /^Outreach Coordinator/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Where do you want to build?");
  await expect(page.locator(".exec-role", { hasText: "VP Content" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".exec-role", { hasText: "Outreach Coordinator" })).toHaveAttribute("aria-pressed", "false");
  // Saying yes switches and clears the old role's answers.
  let asked = "";
  page.once("dialog", dialog => { asked = dialog.message(); void dialog.accept(); });
  await page.getByRole("button", { name: /^Outreach Coordinator/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Outreach Coordinator");
  expect(asked).toContain("will delete them");
  await expect(page.locator("#r1")).toHaveValue("");
  await expect(page.locator(".exec-long textarea")).toHaveCount(3);
  await fillRole(page, 3);
  await page.getByRole("button", { name: "Review application" }).click();

  // Review, with an Edit per section that comes straight back.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Review your application.");
  await expect(page.locator(".exec-review")).toHaveCount(4);
  await page.getByRole("button", { name: "Edit About you" }).click();
  await expect(page.locator("#program")).toHaveValue("Computer Science");
  await page.locator("#program").fill("Software Engineering");
  await page.getByRole("button", { name: "Back to review" }).click();
  await expect(page.locator(".exec-review").first()).toContainText("Software Engineering");

  // The confirm tick is required.
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.locator(".exec-card").getByRole("alert")).toContainText("Please tick the box");
  await page.getByLabel("I confirm that the information in this application is accurate.").check();
  await page.getByRole("button", { name: "Submit application" }).click();

  // "You're in" only after the stand-in for Google took it with a 200.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("You’re in. 🚀");
  await expect(page.locator(".exec-done-rows")).toContainText("Outreach Coordinator");
  const row = (await received(page)).find(r => r[ENTRY.name] === name);
  expect(row, "the stand-in received this application").toBeTruthy();
  expect(row![ENTRY.role]).toBe("Outreach Coordinator");
  expect(row![ENTRY.program]).toBe("Software Engineering");
  expect(row![ENTRY.r1]).toMatch(/^Why are you interested in Outreach\?\n\nRole answer 1\./);
  expect(row![ENTRY.r4], "nothing from the VP Content answers").toBeUndefined();
  expect(Object.values(row!).join(" ")).not.toContain("Written for VP Content");
});

test("a full application at 375px wide", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "one phone run is enough; each run is a real submission");
  await page.setViewportSize({ width: 375, height: 812 });
  const name = `Phone Tester ${Date.now()}`;
  await openAndWait(page);
  const noSideScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(await noSideScroll()).toBe(true);

  await fillAbout(page, name);
  await page.getByRole("button", { name: "Continue" }).click();
  await fillGeneral(page);
  await page.getByRole("button", { name: "Continue" }).click();
  expect(await noSideScroll()).toBe(true);
  await page.getByRole("button", { name: /^Director of Video/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Director of Video");
  await fillRole(page, 3);
  await page.locator("#rlink").fill("https://example.com/reel");
  await page.getByRole("button", { name: "Review application" }).click();
  expect(await noSideScroll()).toBe(true);
  await page.getByLabel("I confirm that the information in this application is accurate.").check();
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("You’re in. 🚀");

  const row = (await received(page)).find(r => r[ENTRY.name] === name);
  expect(row, "the stand-in received this application").toBeTruthy();
  expect(row![ENTRY.role]).toBe("Director of Video");
  expect(row![ENTRY.rlink]).toBe("https://example.com/reel");
});

test("stays closed, and cannot be filled in, unless the Form is connected AND ready", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "browser independent");
  await page.route("**/api/exec-applications", route => route.request().method() === "GET"
    ? route.fulfill({ json: { connected: true, ready: false } })
    : route.continue());
  await page.goto(PAGE);
  await expect(page.getByRole("status").filter({ hasText: "Applications are not open yet." })).toBeVisible();
  await expect(page.locator("fieldset.exec-fs")).toHaveAttribute("disabled", "");
  await expect(page.locator("#name")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
});

test("the member sign up is unchanged at its new path, and Join links to the exec page", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "browser independent");
  await page.goto(MEMBER);
  await expect(page.getByRole("heading", { level: 1, name: "Join WEC" })).toBeVisible();
  await expect(page.locator("form.join-form")).toBeVisible();
  await expect(page.locator(".exec-page, .exec-card")).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("wec-motion-v2", "off"));
  await page.goto("/#join");
  const link = page.locator("#join").getByRole("link", { name: "Exec team applications" });
  await expect(link).toHaveAttribute("href", PAGE);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${PAGE}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Let's get to know you.");
});

test("the /apply chooser offers both applications and leads to each", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "browser independent");
  await page.goto("/apply");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What are you applying for?");

  // Two doors, each pointing at its own page. The exec one is a link here
  // because playwright.config.ts gives the server a connected Form.
  const member = page.getByRole("link", { name: /Become a member/ });
  const exec = page.getByRole("link", { name: /Apply for the exec team/ });
  await expect(member).toHaveAttribute("href", MEMBER);
  await expect(exec).toHaveAttribute("href", PAGE);

  await exec.click();
  await expect(page).toHaveURL(new RegExp(`${PAGE}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Let's get to know you.");

  await page.goto("/apply");
  await page.getByRole("link", { name: /Become a member/ }).click();
  await expect(page).toHaveURL(new RegExp(`${MEMBER}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Join WEC" })).toBeVisible();
  await expect(page.locator("form.join-form")).toBeVisible();
});

test("every Join WEC call to action still goes straight to the member form", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "browser independent");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("wec-motion-v2", "off"));
  await page.goto("/");
  // Nobody who has already chosen should be shown the chooser.
  await expect(page.locator(".nav-join")).toHaveAttribute("href", MEMBER);
  expect(await page.locator(`a[href="/apply"]`).count()).toBe(0);
});
