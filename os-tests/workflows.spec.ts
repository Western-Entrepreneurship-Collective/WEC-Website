import { expect, test, type Page } from "@playwright/test";
import { PEOPLE, dbQuery, futureLocal, signIn, statusOf } from "./support/helpers";

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
  await expect(page.locator(".os-event-head").getByText("In review")).toBeVisible();

  await signIn(page, PEOPLE.vpContent);
  await page.goto("/os/events");
  await expect(page.getByText(EVENT)).toHaveCount(0);

  await signIn(page, PEOPLE.president);
  await page.goto("/os/notifications");
  await expect(page.locator(".os-unread", { hasText: EVENT })).toContainText("Event proposal to review");
  await page.getByRole("link", { name: "All of WEC" }).click();
  const proposal = page.locator(".os-request", { hasText: EVENT });
  await proposal.getByRole("button", { name: "Approve" }).click();
  await expect(proposal).toHaveCount(0);
  await page.getByRole("link", { name: EVENT }).click();
  await expect(page.locator(".os-event-head").getByText("Approved")).toBeVisible();
  const byTeam = page.getByRole("group", { name: "Team progress" });
  await expect(byTeam.getByRole("link", { name: "Content", exact: true })).toBeVisible();
  await expect(byTeam.getByRole("link", { name: "Outreach", exact: true })).toBeVisible();
  await expect(byTeam.getByRole("link", { name: "Sponsorship", exact: true })).toHaveCount(0);

  await signIn(page, PEOPLE.vpContent);
  await page.goto("/os/notifications");
  await expect(page.getByText(`${EVENT} — Content`)).toBeVisible();
  await page.goto("/os/teams/content");
  await page.getByRole("link", { name: `${EVENT} — Content` }).click();
  await expect(page.getByRole("link", { name: "Collect promotional requirements" })).toBeVisible();

  await signIn(page, PEOPLE.dirFinance);
  await page.goto(`/os/calendar?scope=all&month=${futureLocal(45).slice(0, 7)}`);
  await expect(page.getByRole("link", { name: EVENT })).toBeVisible();
});

test("task: assign, complete, and readiness moves", async ({ page }) => {
  await signIn(page, PEOPLE.vpContent);
  await page.goto("/os/teams/content");
  await page.getByRole("link", { name: `${EVENT} — Content` }).click();
  await page.getByRole("link", { name: "Collect promotional requirements" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Who").selectOption({ label: "Dana Director" });
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await expect(page.getByText("Assigned.", { exact: true })).toBeVisible();

  await signIn(page, PEOPLE.dirContent);
  await page.goto("/os");
  const row = page.locator(".os-next-up", { hasText: "Collect promotional requirements" });
  await row.getByRole("link", { name: "Collect promotional requirements" }).click();
  await page.getByRole("group", { name: "Status" }).getByRole("button", { name: "Done" }).click();
  await expect(statusOf(page)).toHaveText("Done");

  await page.goto("/os/events");
  await expect(page.locator(".os-list li", { hasText: EVENT })).not.toContainText("0% ready");
});

test("projects: my team or all of WEC, grouped tasks, and editing kept apart", async ({ page }) => {
  await signIn(page, PEOPLE.vpContent);
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page.getByRole("link", { name: `${EVENT} — Content` })).toBeVisible();
  // Another team's part of an event stays with that team, in either view.
  await expect(page.getByRole("link", { name: `${EVENT} — Outreach` })).toHaveCount(0);
  await page.getByRole("link", { name: "All of WEC" }).click();
  await expect(page.getByRole("link", { name: `${EVENT} — Outreach` })).toHaveCount(0);
  await page.getByRole("link", { name: `${EVENT} — Content` }).click();
  await expect(page.getByRole("region", { name: "To do" }).getByRole("link", { name: "Prepare graphics" })).toBeVisible();
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edit project" })).toBeVisible();
  await expect(page.locator("summary", { hasText: "Add individual people" })).toBeVisible();
  const url = page.url();

  // A Director who does not lead it has no Edit link, and the address doesn't open it.
  await signIn(page, PEOPLE.dirContent);
  expect((await page.goto(url))?.status()).toBe(404);
  await page.goto(url.replace("/edit", ""));
  await expect(page.getByRole("link", { name: "Edit", exact: true })).toHaveCount(0);
});

test("a project for one team, then shared with another", async ({ page }) => {
  await signIn(page, PEOPLE.dirContent);
  await page.goto("/os/projects/new");
  await page.getByLabel("Project name").fill("Posting guide refresh");
  await expect(page.getByText("Only Content and the President can see it.")).toBeVisible();
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: "Posting guide refresh" })).toBeVisible();
  const url = page.url();

  await signIn(page, PEOPLE.dirFinance);
  expect((await page.goto(url))?.status(), "private to Content").toBe(404);

  await signIn(page, PEOPLE.vpContent);
  await page.goto(`${url}/edit`);
  await page.getByLabel(/^Multiple teams/).check();
  await expect(page.getByText("Choose at least one other team")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
  await page.getByRole("checkbox", { name: "Finance" }).check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Content, with Finance.")).toBeVisible();

  await signIn(page, PEOPLE.dirFinance);
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Posting guide refresh" })).toBeVisible();
  await expect(page.getByRole("form", { name: "Add a task" })).toBeVisible();
});

test("several teams at once, with no approval, and outsiders see progress only", async ({ page }) => {
  // Deactivating this person in auth.spec ended their position, so they get it back first.
  await dbQuery(`insert into os.position_assignments (executive_id, position_id, seat_no, academic_year_id, during)
    select e.id, p.id, 1, y.id, daterange(current_date, null) from os.executives e, os.positions p, os.academic_years y
    where e.email = '${PEOPLE.coordOutreach}' and p.title = 'Speaker Acquisition Coordinator' and y.is_current
    and not exists (select 1 from os.position_assignments a where a.executive_id = e.id and a.during @> current_date);`);
  await signIn(page, PEOPLE.coordOutreach);
  await page.goto("/os/projects");
  await page.getByRole("link", { name: "New project" }).click();
  await page.getByLabel("Project name").fill("Speaker outreach list");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: "Speaker outreach list" })).toBeVisible();
  await page.goto("/os/tasks/new");
  await expect(page.getByLabel("Who?").locator("option", { hasText: "Otto Outreach" })).toHaveCount(1);

  await signIn(page, PEOPLE.dirContent);
  await page.goto("/os/projects/new");
  await page.getByLabel("Project name").fill("Annual Sponsorship Strategy");
  await page.getByLabel(/^Multiple teams/).check();
  await page.getByRole("checkbox", { name: "Outreach" }).check();
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByText("Content, with Outreach.")).toBeVisible();
  const url = page.url();

  await signIn(page, PEOPLE.vpOutreach);
  await page.goto(url);
  await expect(page.getByRole("form", { name: "Add a task" })).toBeVisible();

  await signIn(page, PEOPLE.vpFinance);
  await page.goto("/os/projects?scope=all");
  await expect(page.getByRole("link", { name: "Annual Sponsorship Strategy" })).toBeVisible();
  await page.goto(url);
  await expect(page.getByText(/details belong to the teams working on it/)).toBeVisible();
});

test("a new task needs a project, and carries its details and steps", async ({ page }) => {
  await signIn(page, PEOPLE.dirContent);
  await page.getByRole("link", { name: "New task" }).click();
  await expect(page.getByLabel("Project", { exact: true })).toHaveValue("");
  await page.getByLabel("What needs doing?").fill("Prepare the spring graphics");
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page).toHaveURL(/\/os\/tasks\/new$/);

  await page.getByLabel("Project", { exact: true }).selectOption({ label: "Posting guide refresh" });
  await page.getByLabel("Who?").selectOption({ label: "Connie Content" });
  await expect(page.getByText("This goes straight onto Connie's task list.")).toBeVisible();
  await page.getByLabel("Details").fill("Use the event colours.");
  await page.locator("#task-step").fill("Make the post");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.locator("#task-step").fill("Make the header");
  await page.locator("#task-step").press("Enter");
  await page.getByLabel("Due").fill(futureLocal(4).slice(0, 10));
  await page.getByRole("button", { name: "Create task" }).click();

  await expect(page.getByRole("heading", { name: "Prepare the spring graphics" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Details" })).toContainText("Use the event colours.");
  await expect(page.getByText("0 of 2 done")).toBeVisible();
  await page.getByRole("button", { name: "Tick Make the post" }).click();
  await expect(page.getByText("1 of 2 done")).toBeVisible();

  // Added from inside the project too, without leaving it.
  await page.getByRole("link", { name: "Posting guide refresh" }).first().click();
  await page.getByRole("textbox", { name: "Add a task" }).fill("Check the links");
  await page.getByRole("form", { name: "Add a task" }).getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("link", { name: "Check the links" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Add a task" })).toHaveValue("");
});

test("another team's page shows what's between you, not their work", async ({ page }) => {
  await signIn(page, PEOPLE.dirContent);
  await page.getByRole("link", { name: "Teams", exact: true }).click();
  await expect(page.getByRole("link", { name: /Open your team/ })).toBeVisible();
  await page.getByRole("link", { name: "Finance", exact: true }).click();
  await expect(page.getByText("Finance's private projects and other tasks stay with Finance.")).toBeVisible();
  await page.getByRole("link", { name: "Send Finance a task" }).click();
  await expect(page.getByLabel("Who?").locator("option:checked")).toHaveText("Finance");
  await expect(page.getByRole("button", { name: "Send to Finance" })).toBeVisible();
  await expect(page.getByText(/Finance sees this task and the project's name, and nothing else/)).toBeVisible();
});

test("kanban: a card moves with the keyboard-reachable control", async ({ page }) => {
  await dbQuery(`insert into os.projects (id, kind, owning_department_id, name) values ('b8000000-0000-0000-0000-000000000002', 'INTERNAL', (select id from os.departments where slug = 'content'), 'Board test') on conflict do nothing;
    insert into os.tasks (project_id, title, assigned_by, assigned_to, requesting_department_id, responsible_department_id)
    select 'b8000000-0000-0000-0000-000000000002', 'Move me', e.id, e.id, d.id, d.id from os.executives e, os.departments d where e.email = 'dir.content@wec.test' and d.slug = 'content';`);
  await signIn(page, PEOPLE.dirContent);
  await page.getByRole("link", { name: "Board", exact: true }).click();
  const card = page.locator(".os-card", { hasText: "Move me" });
  await card.getByRole("combobox").focus();
  await card.getByRole("combobox").selectOption("in_progress");
  await expect(page.getByRole("region", { name: "Doing" }).locator(".os-card", { hasText: "Move me" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Doing" }).locator(".os-card", { hasText: "Move me" })).toBeVisible();
  expect(await dbQuery("select status from os.tasks where title = 'Move me'")).toBe("in_progress");

  // A task waiting on an earlier one isn't anyone being stuck.
  await signIn(page, PEOPLE.vpContent);
  await page.goto("/os?view=board");
  const waiting = page.locator(".os-card", { hasText: "Publish event announcement" });
  await expect(page.getByRole("region", { name: "To do" }).locator(".os-card", { hasText: "Publish event announcement" })).toContainText("Waiting on an earlier task");
  await expect(waiting.getByRole("combobox")).toBeDisabled();
});

test("a task for another team: sent, taken, finished, on one record", async ({ page }) => {
  await dbQuery(`insert into os.projects (id, kind, owning_department_id, name) values ('b8000000-0000-0000-0000-000000000001', 'INTERNAL', (select id from os.departments where slug = 'finance'), 'Year-end report') on conflict do nothing;
    insert into os.tasks (project_id, title, assigned_by, assigned_to, requesting_department_id, responsible_department_id)
    select 'b8000000-0000-0000-0000-000000000001', 'Sibling only Finance sees', e.id, e.id, d.id, d.id from os.executives e, os.departments d where e.email = 'vp.finance@wec.test' and d.slug = 'finance';`);

  await signIn(page, PEOPLE.dirFinance);
  await page.goto("/os/tasks/new?project=b8000000-0000-0000-0000-000000000001");
  await page.getByLabel("What needs doing?").fill("Design the report cover");
  await page.getByLabel("Who?").selectOption({ label: "Content" });
  await expect(page.getByText(/Connie Content will choose who does this/)).toBeVisible();
  await page.getByLabel("Due").fill(futureLocal(20).slice(0, 10));
  await page.getByRole("button", { name: "Send to Content" }).click();
  await expect(page.getByRole("heading", { name: "Design the report cover" })).toBeVisible();
  await expect(statusOf(page)).toHaveText("Awaiting response");
  const url = page.url();
  await page.goto("/os");
  await expect(page.getByRole("region", { name: "Waiting on others" }).getByRole("link", { name: "Design the report cover" })).toBeVisible();

  // Their Director does not see it until it is theirs.
  await signIn(page, PEOPLE.dirContent);
  expect((await page.goto(url))?.status()).toBe(404);

  // The receiving VP has it on their own home page, and can give it away in one move.
  await signIn(page, PEOPLE.vpContent);
  const request = page.locator(".os-request", { hasText: "Design the report cover" });
  await expect(request).toContainText("From Finance, for Year-end report");
  await request.getByRole("link", { name: "Design the report cover" }).click();
  await expect(page.getByText("Year-end report").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Year-end report" })).toHaveCount(0);
  await page.goto("/os");
  await request.getByLabel("Assign Design the report cover to").selectOption({ label: "Dana Director" });
  await request.getByRole("button", { name: "Assign" }).click();
  await expect(request).toHaveCount(0);

  // Whoever has it talks and finishes it, with nothing else from Finance's project in sight.
  await signIn(page, PEOPLE.dirContent);
  await page.goto(url);
  await page.getByRole("textbox", { name: "Comment" }).fill("Working on it.");
  await page.getByRole("button", { name: "Post" }).click();
  await expect(page.locator(".os-comments")).toContainText("Working on it.");
  await expect(page.getByText("Sibling only Finance sees")).toHaveCount(0);
  await page.getByRole("group", { name: "Status" }).getByRole("button", { name: "Done" }).click();
  await expect(statusOf(page)).toHaveText("Done");
  await expect(page.getByText("Finance has been told, and can reopen this")).toBeVisible();

  // The team that asked sees the same answer, and can send it back.
  await signIn(page, PEOPLE.dirFinance);
  await page.goto(url);
  await expect(statusOf(page)).toHaveText("Done");
  await page.getByRole("button", { name: "Reopen" }).click();
  await expect(statusOf(page)).toHaveText("To do");
  expect(await dbQuery("select count(*) from os.tasks where title = 'Design the report cover'")).toBe("1");
});

test("declining says why, and a team with no VP goes to the President", async ({ page }) => {
  await signIn(page, PEOPLE.dirFinance);
  await page.goto("/os/tasks/new?project=b8000000-0000-0000-0000-000000000001");
  await page.getByLabel("What needs doing?").fill("Write the outreach letter");
  await page.getByLabel("Who?").selectOption({ label: "Outreach" });
  await page.getByRole("button", { name: "Send to Outreach" }).click();
  await expect(page.getByRole("heading", { name: "Write the outreach letter" })).toBeVisible();

  await page.goto("/os/tasks/new?project=b8000000-0000-0000-0000-000000000001");
  await page.getByLabel("What needs doing?").fill("Book the room");
  await page.getByLabel("Who?").selectOption({ label: "Operations" });
  await expect(page.getByText(/The President, since Operations has no VP right now/)).toBeVisible();
  await page.getByRole("button", { name: "Send to Operations" }).click();
  await expect(page.getByRole("heading", { name: "Book the room" })).toBeVisible();

  await signIn(page, PEOPLE.vpOutreach);
  const asked = page.locator(".os-request", { hasText: "Write the outreach letter" });
  await asked.locator("summary", { hasText: "Decline" }).click();
  await asked.getByLabel("Why? They will be told.").fill("Not our area");
  await asked.getByRole("button", { name: "Decline" }).click();
  await expect(asked).toHaveCount(0);

  await signIn(page, PEOPLE.president);
  await page.goto("/os/president");
  const routed = page.locator(".os-request", { hasText: "Book the room" });
  await expect(routed).toContainText("Sent to Operations, which has no VP right now");
  await routed.getByRole("button", { name: "Take it" }).click();
  await expect(routed).toHaveCount(0);
  await page.goto("/os");
  await expect(page.getByRole("link", { name: "Book the room" }).first()).toBeVisible();
});

test("the calendar is a month from Sunday to Saturday", async ({ page }) => {
  await signIn(page, PEOPLE.dirContent);
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page.locator(".os-cal-head span").first()).toHaveText("Sun");
  const heading = await page.getByRole("heading", { level: 1 }).textContent();
  await page.getByRole("link", { name: "Next month" }).click();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(heading!);
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading!);
  expect((await page.locator(".os-cal-day").count()) % 7).toBe(0);
});

test("files: attached by someone on the task, refused to everyone else", async ({ page, browser }) => {
  await signIn(page, PEOPLE.dirFinance);
  await dbQuery("update os.tasks set assigned_to = (select id from os.executives where email = 'dir.finance@wec.test') where title = 'Sibling only Finance sees'");
  await page.goto("/os");
  await page.getByRole("link", { name: "Sibling only Finance sees" }).first().click();
  await expect(page.getByRole("heading", { name: "Sibling only Finance sees" })).toBeVisible();
  const taskUrl = page.url();
  await page.locator(".os-task-side summary", { hasText: "More" }).click();
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

test("SOP: only a VP writes it, and only the President approves it", async ({ page }) => {
  await signIn(page, PEOPLE.dirContent);
  expect((await page.goto("/os/sops/new"))?.status()).toBe(404);
  await page.goto("/os/sops");
  await expect(page.getByRole("link", { name: "New SOP" })).toHaveCount(0);

  // The President writes for any team, their own office included, and needs no second approval.
  await signIn(page, PEOPLE.president);
  await page.goto("/os/sops");
  await page.getByRole("link", { name: "New SOP" }).click();
  await page.getByLabel("Title").fill("How the President's Office works");
  await page.getByLabel("Owning department").selectOption({ label: "President's Office" });
  await page.getByLabel("Procedure").fill("One line");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("button", { name: "Send to the President" })).toHaveCount(0);
  await page.getByRole("button", { name: "Approve and publish" }).click();
  await page.getByRole("button", { name: "Yes, continue" }).click();
  await expect(page.getByRole("heading", { name: "Current version: 1.0" })).toBeVisible();
  await page.goto("/os/sops/new");
  await expect(page.getByLabel("Owning department").locator("option", { hasText: "Finance" })).toHaveCount(1);

  await signIn(page, PEOPLE.vpContent);
  await page.goto("/os/sops/new");
  await page.getByLabel("Title").fill("Posting guide");
  await page.getByLabel("Procedure").fill("Line one\nLine two");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("heading", { name: "Posting guide" })).toBeVisible();
  const url = page.url();

  // The team can read a draft and not touch it.
  await signIn(page, PEOPLE.dirContent);
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Draft: 1.0" })).toBeVisible();
  await expect(page.getByLabel("Procedure")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send to the President" })).toHaveCount(0);

  await signIn(page, PEOPLE.vpContent);
  await page.goto(url);
  await page.getByRole("button", { name: "Send to the President" }).click();
  await expect(page.getByText("Waiting for the President to approve it.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve and publish" })).toHaveCount(0);

  await signIn(page, PEOPLE.president);
  await page.goto("/os/president");
  const waiting = page.locator(".os-request", { hasText: "Posting guide" });
  await waiting.locator("summary", { hasText: "Send back" }).click();
  await waiting.getByLabel("What needs to change?").fill("Add a third line");
  await waiting.getByRole("button", { name: "Send back" }).click();
  await expect(waiting).toHaveCount(0);

  await signIn(page, PEOPLE.vpContent);
  await page.goto(url);
  await page.getByRole("button", { name: "Send to the President" }).click();
  await expect(page.getByText("Waiting for the President to approve it.")).toBeVisible();

  await signIn(page, PEOPLE.president);
  await page.goto("/os/president");
  await waiting.getByRole("button", { name: "Approve and publish" }).click();
  await expect(waiting).toHaveCount(0);

  // A revision goes through the same two people.
  await signIn(page, PEOPLE.vpContent);
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Current version: 1.0" })).toBeVisible();
  await page.getByRole("button", { name: "Start minor revision" }).click();
  await expect(page.getByRole("heading", { name: "Draft: 1.1" })).toBeVisible();
  await page.getByLabel("Procedure").fill("Line one\nLine two changed");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.getByRole("button", { name: "Send to the President" }).click();
  await expect(page.getByText("Waiting for the President to approve it.")).toBeVisible();

  await signIn(page, PEOPLE.president);
  await page.goto(url);
  await page.getByRole("button", { name: "Approve and publish" }).click();
  await page.getByRole("button", { name: "Yes, continue" }).click();
  await expect(page.getByRole("heading", { name: "Current version: 1.1" })).toBeVisible();

  await signIn(page, PEOPLE.vpContent);
  await page.goto(url);
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
