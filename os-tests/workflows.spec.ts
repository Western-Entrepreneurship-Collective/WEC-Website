import { expect, test, type Page } from "@playwright/test";
import { PEOPLE, dbQuery, futureLocal, signIn } from "./support/helpers";

test.describe.configure({ mode: "serial" });

const EVENT = "Founder Lab: Customer Discovery";

async function fillEvent(page: Page) {
  await page.getByLabel("Name", { exact: true }).fill(EVENT);
  await page.getByLabel("Starts").fill(futureLocal(45));
  await page.getByLabel("Tier").selectOption("B");
  await page.getByLabel("External speakers, mentors, judges or partners").check();
  await page.getByLabel("Registration", { exact: true }).check();
}

test("event: proposal, approval, generated projects and tasks", async ({ page }) => {
  await signIn(page, PEOPLE.vpEvents);
  await page.goto("/os/events/new");
  await fillEvent(page);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("heading", { name: EVENT })).toBeVisible();
  await expect(page.getByText("Projects are generated when this event is approved.")).toBeVisible();
  await page.getByRole("button", { name: "Send to the President" }).click();
  await expect(page.locator(".os-page-head").getByText("In review")).toBeVisible();

  await signIn(page, PEOPLE.vpContent);
  await page.goto("/os/events");
  await expect(page.getByText(EVENT)).toHaveCount(0);

  await signIn(page, PEOPLE.president);
  await page.goto("/os/notifications");
  await expect(page.locator(".os-unread", { hasText: EVENT })).toContainText("Event proposal to review");
  await page.goto("/os/president");
  await page.getByRole("link", { name: EVENT }).click();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.locator(".os-page-head").getByText("Approved")).toBeVisible();
  await expect(page.getByRole("link", { name: `${EVENT} — Content` })).toBeVisible();
  await expect(page.getByRole("link", { name: `${EVENT} — Outreach` })).toBeVisible();
  await expect(page.getByRole("link", { name: `${EVENT} — Sponsorship` })).toHaveCount(0);

  await signIn(page, PEOPLE.vpContent);
  await page.goto("/os/notifications");
  await expect(page.getByText(`${EVENT} — Content`)).toBeVisible();
  await page.goto("/os/teams/content");
  await page.getByRole("link", { name: `${EVENT} — Content` }).click();
  await expect(page.getByRole("link", { name: "Collect promotional requirements" })).toBeVisible();

  await signIn(page, PEOPLE.dirFinance);
  await page.goto(`/os/calendar/core?view=agenda&date=${futureLocal(40).slice(0, 10)}`);
  await expect(page.getByRole("link", { name: EVENT })).toBeVisible();
});

test("task: assign, complete, and readiness moves", async ({ page }) => {
  await signIn(page, PEOPLE.vpContent);
  await page.goto("/os/teams/content");
  await page.getByRole("link", { name: `${EVENT} — Content` }).click();
  await page.getByRole("link", { name: "Collect promotional requirements" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Assign to").selectOption({ label: "Dana Director" });
  await page.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(page.getByText("Assigned.", { exact: true })).toBeVisible();

  await signIn(page, PEOPLE.dirContent);
  await page.goto("/os/tasks");
  await page.getByRole("link", { name: "Collect promotional requirements" }).click();
  await page.getByRole("button", { name: "Mark done" }).click();
  await expect(page.locator(".os-page-head").getByText("Done")).toBeVisible();

  await page.goto("/os/events");
  await expect(page.locator(".os-list li", { hasText: EVENT })).not.toContainText("0% ready");
});

test("kanban: a card moves with the keyboard-reachable control", async ({ page }) => {
  await dbQuery(`insert into os.projects (id, kind, owning_department_id, name) values ('b8000000-0000-0000-0000-000000000002', 'INTERNAL', (select id from os.departments where slug = 'content'), 'Board test') on conflict do nothing;
    insert into os.tasks (project_id, title, assigned_by, assigned_to, requesting_department_id, responsible_department_id)
    select 'b8000000-0000-0000-0000-000000000002', 'Move me', e.id, e.id, d.id, d.id from os.executives e, os.departments d where e.email = 'dir.content@wec.test' and d.slug = 'content';`);
  await signIn(page, PEOPLE.dirContent);
  await page.goto("/os/tasks?view=board");
  const card = page.locator(".os-card", { hasText: "Move me" });
  await card.getByRole("combobox").focus();
  await card.getByRole("combobox").selectOption("in_progress");
  await expect(page.getByRole("region", { name: "In progress" }).locator(".os-card", { hasText: "Move me" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "In progress" }).locator(".os-card", { hasText: "Move me" })).toBeVisible();
  expect(await dbQuery("select status from os.tasks where title = 'Move me'")).toBe("in_progress");
});

test("cross-team: the whole request flow, on one record", async ({ page }) => {
  await dbQuery(`insert into os.projects (id, kind, owning_department_id, name) values ('b8000000-0000-0000-0000-000000000001', 'INTERNAL', (select id from os.departments where slug = 'finance'), 'Year-end report') on conflict do nothing;
    insert into os.tasks (project_id, title, assigned_by, assigned_to, requesting_department_id, responsible_department_id)
    select 'b8000000-0000-0000-0000-000000000001', 'Sibling only Finance sees', e.id, e.id, d.id, d.id from os.executives e, os.departments d where e.email = 'vp.finance@wec.test' and d.slug = 'finance';`);

  // 1. Create
  await signIn(page, PEOPLE.dirFinance);
  await page.goto("/os/requests/new?project=b8000000-0000-0000-0000-000000000001");
  await expect(page.getByText(/will see this request and the name of the project/)).toBeVisible();
  await page.getByLabel("Title").fill("Design the report cover");
  await page.getByLabel("Send to").selectOption({ label: "Content" });
  await page.getByLabel("Due").fill(futureLocal(20));
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByRole("heading", { name: "Design the report cover" })).toBeVisible();
  await expect(page.locator(".os-page-head").getByText("Awaiting response")).toBeVisible();
  const url = page.url();

  // 2-3. The receiving VP is told, and it is in the queue. Their Director does not see it yet.
  await signIn(page, PEOPLE.dirContent);
  expect((await page.goto(url))?.status()).toBe(404);

  await signIn(page, PEOPLE.vpContent);
  await page.goto("/os/teams/content/requests");
  await expect(page.getByRole("link", { name: "Design the report cover" })).toBeVisible();
  await page.goto("/os/notifications");
  await page.getByRole("link", { name: "Design the report cover" }).first().click();
  await expect(page.getByText("Year-end report").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Year-end report" })).toHaveCount(0);

  // 4-5. Accept and delegate
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Delegate to").selectOption({ label: "Dana Director" });
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.locator(".os-page-head").getByText("To do")).toBeVisible();

  // 6. The assignee delivers
  await signIn(page, PEOPLE.dirContent);
  await page.goto(url);
  await page.getByRole("textbox", { name: "Comment" }).fill("Working on it.");
  await page.getByRole("button", { name: "Post" }).click();
  await expect(page.locator(".os-comments")).toContainText("Working on it.");
  await page.getByLabel("Note with the deliverable").fill("First pass");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.locator(".os-page-head").getByText("In review")).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept deliverable" })).toHaveCount(0);
  // Nothing else from Finance's project came with it.
  await expect(page.getByText("Sibling only Finance sees")).toHaveCount(0);

  // 7. The requester sends it back, then accepts
  await signIn(page, PEOPLE.dirFinance);
  await page.goto(url);
  await page.getByLabel("What needs revising").fill("Bigger logo");
  await page.getByRole("button", { name: "Request revisions" }).click();
  await expect(page.locator(".os-page-head").getByText("Revisions")).toBeVisible();

  await signIn(page, PEOPLE.dirContent);
  await page.goto(url);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.locator(".os-page-head").getByText("In review")).toBeVisible();

  await signIn(page, PEOPLE.dirFinance);
  await page.goto(url);
  await page.getByRole("button", { name: "Accept deliverable" }).click();
  await expect(page.locator(".os-page-head").getByText("Done")).toBeVisible();

  // 8. Same answer on both sides, and only one row exists.
  await signIn(page, PEOPLE.vpContent);
  await page.goto(url);
  await expect(page.locator(".os-page-head").getByText("Done")).toBeVisible();
  expect(await dbQuery("select count(*) from os.tasks where title = 'Design the report cover'")).toBe("1");
});

test("global project: a VP proposes, the President publishes", async ({ page }) => {
  await signIn(page, PEOPLE.dirContent);
  expect((await page.goto("/os/projects/new?kind=GLOBAL"))?.status(), "Directors cannot").toBe(404);

  await signIn(page, PEOPLE.vpOutreach);
  await page.goto("/os/projects/new?kind=GLOBAL");
  await page.getByLabel("Name", { exact: true }).fill("Annual Sponsorship Strategy");
  await page.getByLabel("Due").fill(new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: "Annual Sponsorship Strategy" })).toBeVisible();
  await page.getByRole("button", { name: "Send to the President" }).click();
  await expect(page.locator(".os-page-head").getByText("Awaiting response")).toBeVisible();
  const url = page.url();

  await signIn(page, PEOPLE.vpFinance);
  await page.goto("/os/projects/global");
  await expect(page.getByText("Annual Sponsorship Strategy")).toHaveCount(0);

  await signIn(page, PEOPLE.president);
  await page.goto(url);
  await page.getByRole("button", { name: "Approve and publish" }).click();
  await expect(page.locator(".os-page-head").getByText("Approved")).toBeVisible();

  await signIn(page, PEOPLE.vpFinance);
  await page.goto("/os/projects/global");
  await expect(page.getByText("Annual Sponsorship Strategy")).toBeVisible();
  await page.goto(url);
  await expect(page.getByText(/details belong to the teams working on it/)).toBeVisible();
});

test("files: attached by someone on the task, refused to everyone else", async ({ page, browser }) => {
  await signIn(page, PEOPLE.dirFinance);
  await page.goto("/os/tasks");
  await page.goto("/os/teams/finance");
  await dbQuery("update os.tasks set assigned_to = (select id from os.executives where email = 'dir.finance@wec.test') where title = 'Sibling only Finance sees'");
  await page.goto("/os/tasks");
  await page.getByRole("link", { name: "Sibling only Finance sees" }).click();
  await expect(page.getByRole("heading", { name: "Sibling only Finance sees" })).toBeVisible();
  const taskUrl = page.url();
  await page.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("private notes") });
  const link = page.getByRole("link", { name: "notes.txt" });
  await expect(link).toBeVisible({ timeout: 15000 });
  const href = await link.getAttribute("href");

  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  expect(await download.path()).toBeTruthy();

  const outsider = await browser.newContext();
  const oPage = await outsider.newPage();
  await signIn(oPage, PEOPLE.dirContent);
  expect((await oPage.goto(taskUrl))?.status()).toBe(404);
  const res = await oPage.request.get(href!, { maxRedirects: 0 });
  expect(res.status()).toBe(404);
  await outsider.close();
});

test("SOP: draft, approval, publish, immutable history, restore", async ({ page }) => {
  await signIn(page, PEOPLE.dirContent);
  await page.goto("/os/sops/new");
  await page.getByLabel("Title").fill("Posting guide");
  await page.getByLabel("Procedure").fill("Line one\nLine two");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("heading", { name: "Posting guide" })).toBeVisible();
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page.getByRole("button", { name: "Submit for approval" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);
  const url = page.url();

  await signIn(page, PEOPLE.vpContent);
  await page.goto(url);
  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByRole("button", { name: "Yes, continue" }).click();
  await expect(page.getByRole("heading", { name: "Current version: 1.0" })).toBeVisible();

  await page.getByRole("button", { name: "Start minor revision" }).click();
  await expect(page.getByRole("heading", { name: "Draft: 1.1" })).toBeVisible();
  await page.getByLabel("Procedure").fill("Line one\nLine two changed");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByRole("button", { name: "Yes, continue" }).click();
  await expect(page.getByRole("heading", { name: "Current version: 1.1" })).toBeVisible();

  await page.getByRole("link", { name: "Compare" }).click();
  await expect(page.locator(".os-diff-del")).toContainText("Line two");
  await expect(page.locator(".os-diff-add")).toContainText("Line two changed");

  await page.goto(url);
  await page.locator(".os-list").getByRole("link", { name: "1.0" }).click();
  await expect(page.getByText("This version cannot be changed.")).toBeVisible();
  await page.getByRole("button", { name: "Restore this content as a new version" }).click();
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Draft: 2.0" })).toBeVisible();

  const count = await dbQuery("select count(*) from os.sop_versions v join os.sops s on s.id = v.sop_id where s.title = 'Posting guide'");
  expect(count).toBe("3");
});

test("meeting: minutes stay in the team, and an action becomes a task", async ({ page }) => {
  await signIn(page, PEOPLE.dirContent);
  await page.goto("/os/meetings/new");
  await page.getByLabel("Title").fill("Content sync");
  await page.getByLabel("Date and time").fill(futureLocal(1));
  await page.getByLabel("Minutes").fill("We talked about the plan.");
  await page.getByRole("button", { name: "Create meeting record" }).click();
  await expect(page.getByRole("heading", { name: "Content sync" })).toBeVisible();
  const url = page.url();
  await page.getByLabel("New action").fill("Draft the cover copy");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator(".os-action-item")).toContainText("Draft the cover copy");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Make a task in").selectOption({ label: `${EVENT} — Content` });
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.locator(".os-action-item").getByRole("link", { name: "Task" })).toBeVisible();

  await signIn(page, PEOPLE.dirFinance);
  expect((await page.goto(url))?.status()).toBe(404);
});

test("administration: structure, permissions, templates, year transition", async ({ page }) => {
  await signIn(page, PEOPLE.admin);

  await page.goto("/os/admin/org");
  await expect(page.getByLabel("Edit Director of Content").getByLabel("Seats")).toHaveValue("2");

  await page.goto("/os/admin/permissions");
  const row = page.getByRole("row", { name: /Send cross-team requests/ });
  await row.getByRole("button", { name: /coordinator/ }).click();
  await expect(row.getByRole("button", { name: /Grant Send cross-team requests for coordinator/ })).toBeVisible();
  await row.getByRole("button", { name: /coordinator/ }).click();
  await expect(row.getByRole("button", { name: /Remove Send cross-team requests for coordinator/ })).toBeVisible();

  await page.goto("/os/admin/templates");
  await page.getByRole("link", { name: "Content", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save as a new version" })).toBeVisible();
  const definition = page.getByLabel("Definition");
  const original = await definition.inputValue();
  await definition.fill("{ not json");
  await page.getByRole("button", { name: "Save as a new version" }).click();
  await expect(page.locator(".os-form-error")).toContainText("not valid JSON");
  await definition.fill(original);
  await page.getByRole("button", { name: "Save as a new version" }).click();
  await expect(page.getByText("Saved as a new version.")).toBeVisible();
  await expect(page.getByText("Version 2 (current)")).toBeVisible();

  await page.goto("/os/admin/automation");
  await expect(page.locator("strong", { hasText: "Monthly finance reporting" })).toBeVisible();

  await page.goto("/os/admin/audit");
  await expect(page.getByRole("cell", { name: "template.saved" }).first()).toBeVisible();

  await page.goto("/os/admin/years");
  await page.getByLabel("New year").fill("2027-28");
  await page.getByLabel("Starts").fill("2027-05-01");
  await page.getByLabel("Ends").fill("2028-04-30");
  await page.getByRole("button", { name: "Start transition" }).click();
  await expect(page.getByRole("heading", { name: "Transition in progress" })).toBeVisible();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.getByText("Handover projects generated.")).toBeVisible();
  expect(await dbQuery("select count(*) from os.projects where name = 'Handover 2026-27'")).toBe("10");
  await page.getByRole("button", { name: "Finish transition" }).click();
  await page.getByRole("button", { name: "Yes, continue" }).click();
  await expect(page.locator(".os-list li", { hasText: "2027-28" })).toContainText("Current");
  // Nobody's history went anywhere.
  expect(await dbQuery("select count(*) from os.roster_snapshots")).not.toBe("0");
});
