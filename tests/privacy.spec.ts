/**
 * The privacy policy and the rule that nothing is collected until the visitor agrees.
 *
 *   1  /privacy renders the policy, with the club's contact address and its date
 *   2  every page with a form, and the home page, links to /privacy
 *   3  the member form refuses to send anything until the privacy box is ticked
 *   4  /api/join refuses a submission without consent before it reads a single answer
 */
import { test, expect } from "@playwright/test";
import { POST as JOIN } from "@/app/api/join/route";
import { PRIVACY_CONSENT, PRIVACY_EMAIL } from "@/lib/privacy";

test("1  /privacy renders the policy, with the contact address and its date", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "browser independent");
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy Policy");
  await expect(page.getByText(/Last updated: \d+ \w+ \d{4}/)).toBeVisible();
  for (const h of ["Who we are", "What we collect", "Why we collect it", "Who can see it", "Where it is stored",
    "How long we keep it", "Your choices", "Emails from us", "Changes"]) {
    await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
  }
  const mail = page.getByRole("link", { name: PRIVACY_EMAIL }).first();
  await expect(mail).toHaveAttribute("href", `mailto:${PRIVACY_EMAIL}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no side scroll").toBe(true);
});

test("2  the home page and every page with a form link to /privacy", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "browser independent");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("wec-motion-v2", "off"));
  for (const path of ["/", "/apply", "/apply/member", "/apply/executives"]) {
    await page.goto(path);
    await expect(page.locator('footer a[href="/privacy"]'), `${path} footer`).toHaveCount(1);
  }
});

test("3  the member form sends nothing until the privacy box is ticked", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "browser independent");
  const posts: string[] = [];
  page.on("request", r => { if (r.url().includes("/api/join") && r.method() === "POST") posts.push(r.url()); });
  await page.goto("/apply/member");
  await page.getByLabel("Name", { exact: true }).fill("Privacy Tester");
  await page.getByLabel(/email/i).first().fill("privacy.tester@uwo.ca");
  await page.getByLabel("Year").selectOption("Year 2");
  await page.getByLabel(/What are you building/).fill("A test.");
  await page.getByLabel(/Signature/).fill("Privacy Tester");
  const box = page.getByLabel(/I have read the privacy policy/);
  await expect(box, "the box starts unticked").not.toBeChecked();
  await page.getByRole("button", { name: /Join WEC/ }).click();
  await expect(page.getByText("Please tick the box to agree to the privacy policy.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Join WEC");
  expect(posts, "nothing was posted").toHaveLength(0);
  await expect(page.getByRole("link", { name: "privacy policy", exact: true })).toHaveAttribute("href", "/privacy");
  await box.check();
  await expect(page.getByText("Please tick the box to agree to the privacy policy.")).toHaveCount(0);
});

test("4  /api/join refuses a submission without consent", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "server test, runs once");
  const saved = process.env.NEXT_PUBLIC_WEC_GOOGLE_FORM_URL;
  // A syntactically valid Form link. The refusal happens before any fetch, so nothing is sent anywhere.
  process.env.NEXT_PUBLIC_WEC_GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/TEST/viewform"
    + "?entry.1=NAME&entry.2=EMAIL&entry.3=Year+1&entry.4=BUILDING&entry.5=SIGNATURE";
  try {
    const answers = { name: "A", email: "a@uwo.ca", year: "Year 1", building: "x", signature: "A" };
    for (const consent of [undefined, false, "true", 1]) {
      const body = consent === undefined ? answers : { ...answers, [PRIVACY_CONSENT]: consent };
      const response = await JOIN(new Request("http://localhost/api/join", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }));
      expect(response.status, `consent ${JSON.stringify(consent)}`).toBe(400);
      expect(await response.json()).toEqual({ error: "consent_required" });
    }
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_WEC_GOOGLE_FORM_URL;
    else process.env.NEXT_PUBLIC_WEC_GOOGLE_FORM_URL = saved;
  }
});
