import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PEOPLE, dbQuery, signIn } from "./support/helpers";

test.describe.configure({ mode: "serial" });

const PHOTO = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const finance = "(select id from os.departments where slug = 'finance')";
const vp = "(select id from os.executives where email = 'vp.finance@wec.test')";

test("the team overview shows every team's work, and opens none of it", async ({ page }) => {
  const projectId = await dbQuery(`insert into os.projects (kind, owning_department_id, name, approval_status) values ('INTERNAL', ${finance}, 'Overview sample', 'not_required') returning id`);
  const project = projectId.split("\n")[0];
  const taskId = await dbQuery(`insert into os.tasks (project_id, title, requesting_department_id, responsible_department_id, assigned_by, assigned_to, status) values
    ('${project}', 'Overview task done', ${finance}, ${finance}, ${vp}, ${vp}, 'done'),
    ('${project}', 'Overview task open', ${finance}, ${finance}, ${vp}, ${vp}, 'todo') returning id`);

  await signIn(page, PEOPLE.dirAdmin);
  await page.getByRole("link", { name: "Team overview" }).click();
  await expect(page.getByRole("heading", { name: "Team overview" })).toBeVisible();
  const team = page.getByRole("region", { name: "Finance" });
  await expect(team.getByRole("heading", { name: "Overview sample" })).toBeVisible();
  await expect(team.getByText("1 of 2 done, 50%")).toBeVisible();
  await expect(team.getByRole("cell", { name: "Overview task open" })).toBeVisible();
  await expect(team.getByRole("link")).toHaveCount(0);
  expect((await page.goto(`/os/tasks/${taskId.split("\n")[0]}`))?.status()).toBe(404);
  expect((await page.goto(`/os/projects/${project}`))?.status()).toBe(404);

  await page.goto("/os/overview?team=finance");
  await expect(page.getByRole("region", { name: "Finance" })).toBeVisible();
  await expect(page.locator(".os-overview-team")).toHaveCount(1);

  await signIn(page, PEOPLE.vpContent);
  await expect(page.getByRole("link", { name: "Team overview" })).toHaveCount(0);
  expect((await page.goto("/os/overview"))?.status()).toBe(404);
});

test("the weekly summary: written, reviewed, copied, then marked as sent", async ({ page, context, browser }) => {
  test.setTimeout(90000);
  await dbQuery("select private.run_weekly_summary(r) from os.automation_rules r where key = 'weekly_summary'");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await signIn(page, PEOPLE.dirAdmin);
  await page.getByRole("link", { name: "Write the weekly summary" }).first().click();
  await expect(page).toHaveURL(/\/os\/summaries\/[0-9a-f-]{36}$/);
  const url = page.url();
  await expect(page.getByText("Which events did we hold, and how did they go?")).toBeVisible();
  await expect(page.getByText(/Due Sunday, .* at 11:59/)).toBeVisible();

  await page.getByRole("button", { name: "Review draft" }).click();
  await expect(page.locator(".os-form-error")).toContainText("Fill in all three sections");

  await page.getByRole("textbox", { name: "Events and meetings" }).fill("Founder Lab had 42 members.\n\nSpeaker Night is next.");
  await page.getByRole("textbox", { name: "Team progress" }).fill("Content is making <graphics>.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Team progress" })).toHaveValue("Content is making <graphics>.");

  await page.locator('input[type="file"]').setInputFiles([{ name: "founder-lab.png", mimeType: "image/png", buffer: PHOTO }, { name: "extra.png", mimeType: "image/png", buffer: PHOTO }]);
  await expect(page.getByRole("img", { name: "extra.png" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("form", { name: "Remove extra.png" }).getByRole("button").click();
  await expect(page.getByRole("img", { name: "extra.png" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "founder-lab.png" })).toBeVisible();
  expect(await page.getByRole("img", { name: "founder-lab.png" }).evaluate(async (img: HTMLImageElement) => { await img.decode(); return img.naturalWidth; })).toBe(1);

  await page.getByRole("textbox", { name: "Results and feedback" }).fill("One new sponsor.");
  await page.getByRole("button", { name: "Review draft" }).click();
  await expect(page.getByRole("heading", { name: "Review your draft" })).toBeVisible();
  await expect(page.getByText("Founder Lab had 42 members.")).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations.map(v => v.id)).toEqual([]);

  await page.getByRole("button", { name: "Copy addresses" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  const addresses = await page.evaluate(() => navigator.clipboard.readText());
  expect(addresses).toContain("dir.admin@wec.test");
  expect(addresses).toContain("president@wec.test");
  expect(addresses).not.toContain("former@wec.test");
  expect(addresses).not.toMatch(/(^|, )admin@wec\.test/);

  await page.getByRole("button", { name: "Copy subject" }).click();
  await expect(page.getByRole("button", { name: "Copy subject" })).toHaveCount(0);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^WEC Weekly Summary: Week of /);

  await page.getByRole("button", { name: "Copy email" }).click();
  await expect(page.getByRole("button", { name: "Copy email" })).toHaveCount(0);
  const html = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    return (await item.getType("text/html")).text();
  });
  expect(html).toContain("Results and feedback");
  expect(html).toContain("&lt;graphics&gt;");
  expect(html).not.toContain("<graphics>");

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download photos" }).click()]);
  expect(download.suggestedFilename()).toBe("founder-lab.png");

  await page.getByRole("button", { name: "Mark as sent" }).click();
  await expect(page.getByText(/^Marked as sent /)).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark as sent" })).toHaveCount(0);
  await page.goto(url);
  await expect(page).toHaveURL(/\/review$/);

  const others = await browser.newContext();
  const president = await others.newPage();
  await signIn(president, PEOPLE.president);
  await president.goto(url);
  await expect(president.getByText("Founder Lab had 42 members.")).toBeVisible();
  await expect(president.getByRole("button", { name: "Copy email" })).toHaveCount(0);
  await signIn(president, PEOPLE.vpContent);
  expect((await president.goto(url))?.status()).toBe(404);
  await others.close();
});
