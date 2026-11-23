import { expect, test } from "@playwright/test";
import { PEOPLE, dbQuery, signIn, statusOf } from "./support/helpers";

test.describe.configure({ mode: "serial" });

test("a deliverable: handed in on the task, then seen by every team on the event", async ({ page }) => {
  const event = await dbQuery(`insert into os.events (name, tier, starts_at, status, submitted_by, requires_speakers)
    values ('Handover night', 'C', now() + interval '200 days', 'approved', (select id from os.executives where email = 'vp.events@wec.test'), true) returning id`);
  await dbQuery(`select private.generate_event_projects('${event.split("\n")[0]}')`);
  const id = event.split("\n")[0];
  const venue = await dbQuery(`select t.id from os.tasks t join os.projects p on p.id = t.project_id where p.event_id = '${id}' and t.template_task_key = 'venue'`);

  await signIn(page, PEOPLE.vpEvents);
  await page.goto(`/os/tasks/${venue}`);
  const handIn = page.getByRole("region", { name: "Deliverable" });
  await expect(handIn).toContainText("Not handed in yet");
  await page.getByRole("group", { name: "Status" }).getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Hand in this task's deliverable before marking it done")).toBeVisible();

  await handIn.getByLabel("What you're handing in").fill("Room 2230, Ivey. 80 seats. Booking 4471.");
  await handIn.getByRole("button", { name: "Hand in" }).click();
  await expect(handIn).toContainText("Handed in by you");
  await page.getByRole("group", { name: "Status" }).getByRole("button", { name: "Done" }).click();
  await expect(statusOf(page)).toHaveText("Done");

  // Content works on the same event, so it sees what Events handed in, but not Events' task.
  await signIn(page, PEOPLE.dirContent);
  await page.goto(`/os/events/${id}`);
  const list = page.getByRole("group", { name: "Deliverables" });
  await expect(list.getByRole("row", { name: /Room, building/ })).toContainText("Room 2230, Ivey. 80 seats. Booking 4471.");
  await expect(list.getByRole("row", { name: /guest list/ })).toContainText("Nothing yet");
  await expect(list.getByRole("link", { name: /Room, building/ })).toHaveCount(0);
  await page.goto(`/os/tasks/${venue}`);
  await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();

  // The overview shows which are in.
  await signIn(page, PEOPLE.president);
  await page.goto("/os/overview?team=events");
  await expect(page.getByRole("row", { name: /Book the venue/ }).last()).toContainText("Handed in");

  // Out of the way of the workflow tests, which expect one event's work per team.
  await dbQuery(`update os.tasks set status = 'cancelled' where status <> 'done' and project_id in (select id from os.projects where event_id = '${id}');
    update os.projects set archived_at = now() where event_id = '${id}';
    update os.events set status = 'archived', archived_at = now() where id = '${id}';`);
});
