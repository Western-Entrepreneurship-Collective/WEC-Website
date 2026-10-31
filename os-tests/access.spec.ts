import { expect, test } from "@playwright/test";
import { PEOPLE, apiAs, dbQuery, signIn } from "./support/helpers";

const P = { internal: "b9000000-0000-0000-0000-000000000001", task: "c9000000-0000-0000-0000-000000000001" };

test.beforeAll(async () => {
  await dbQuery(`insert into os.projects (id, kind, owning_department_id, name) values ('${P.internal}', 'INTERNAL', (select id from os.departments where slug = 'finance'), 'Reserve fund plan') on conflict do nothing;
    insert into os.tasks (id, project_id, title, assigned_by, assigned_to, requesting_department_id, responsible_department_id)
    select '${P.task}', '${P.internal}', 'Move the reserve', e.id, e.id, d.id, d.id from os.executives e, os.departments d where e.email = 'vp.finance@wec.test' and d.slug = 'finance' on conflict do nothing;`);
});

test("administration and the President's page are 404 for everyone they are not for", async ({ page }) => {
  await signIn(page, PEOPLE.vpContent);
  for (const path of ["/os/admin", "/os/admin/executives", "/os/admin/audit", "/os/president"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
  await expect(page.getByRole("link", { name: "Administration" })).toHaveCount(0);

  await signIn(page, PEOPLE.president);
  expect((await page.goto("/os/president"))?.status()).toBe(200);
  expect((await page.goto("/os/admin"))?.status(), "the President is not an administrator").toBe(404);

  await signIn(page, PEOPLE.admin);
  expect((await page.goto("/os/admin"))?.status()).toBe(200);
  expect((await page.goto("/os/president"))?.status(), "an administrator is not the President").toBe(404);
});

test("changing the ID in a URL shows nothing from another team", async ({ page }) => {
  await signIn(page, PEOPLE.dirContent);
  expect((await page.goto(`/os/projects/${P.internal}`))?.status()).toBe(404);
  expect((await page.goto(`/os/tasks/${P.task}`))?.status()).toBe(404);
  await page.goto("/os/search?q=reserve");
  await expect(page.getByText("No results.")).toBeVisible();

  await signIn(page, PEOPLE.dirFinance);
  expect((await page.goto(`/os/projects/${P.internal}`))?.status()).toBe(200);
  expect((await page.goto(`/os/tasks/${P.task}`))?.status()).toBe(200);
});

test("the API, called directly with a real login, gives the same answers", async () => {
  const api = await apiAs(PEOPLE.dirContent);
  const os = api.schema("os");
  expect((await os.from("projects").select("*").eq("id", P.internal)).data).toEqual([]);
  expect((await os.from("tasks").select("*").eq("id", P.task)).data).toEqual([]);
  expect((await os.from("audit_log").select("*")).data).toEqual([]);
  expect((await os.from("settings").select("*")).data).toEqual([]);
  expect((await os.from("jobs").select("*")).data).toEqual([]);

  // Writes, by every route a client might try.
  const insert = await os.from("tasks").insert({ project_id: P.internal, title: "x" } as never);
  expect(insert.error?.code).toBe("42501");
  const update = await os.from("tasks").update({ title: "x" } as never).eq("id", P.task);
  expect(update.error?.code).toBe("42501");
  const del = await os.from("projects").delete().eq("id", P.internal);
  expect(del.error?.code).toBe("42501");

  const rpc = api.schema("api");
  for (const [fn, args] of [
    ["add_comment", { p_task: P.task, p_body: "hi" }],
    ["set_task_status", { p_task: P.task, p_status: "done" }],
    ["assign_task", { p_task: P.task, p_assignee: null }],
    ["update_task", { p_task: P.task, p_fields: { title: "stolen" } }],
    ["archive_project", { p_project: P.internal }],
  ] as const) {
    const result = await rpc.rpc(fn as never, args as never);
    expect(result.error, fn).not.toBeNull();
  }
  expect((await rpc.rpc("task_dependencies" as never, { p_task: P.task } as never)).data).toEqual([]);
  expect((await rpc.rpc("task_context" as never, { p_task: P.task } as never)).data).toEqual([]);

  // The private helpers and service functions are not part of the API.
  expect((await rpc.rpc("service_run_sweep" as never)).error).not.toBeNull();
  expect((await rpc.rpc("bootstrap_first_admin" as never, { p_email: "me@wec.test", p_full_name: "Me" } as never)).error).not.toBeNull();
  expect((await api.schema("private" as never).rpc("is_admin" as never)).error).not.toBeNull();
  expect(await dbQuery(`select title from os.tasks where id = '${P.task}'`)).toBe("Move the reserve");
});

test("the job routes answer only to the secret", async ({ request }) => {
  for (const [method, path] of [["get", "/api/os/health"], ["post", "/api/os/jobs/sweep"], ["post", "/api/os/jobs/email"]] as const) {
    expect((await request[method](path)).status(), path).toBe(403);
    expect((await request[method](path, { headers: { Authorization: "Bearer wrong" } })).status(), path).toBe(403);
  }
  const ok = await request.post("/api/os/jobs/sweep", { headers: { Authorization: "Bearer local-jobs-secret" } });
  expect(ok.status()).toBe(200);
  const health = await request.get("/api/os/health", { headers: { Authorization: "Bearer local-jobs-secret" } });
  expect(health.status()).toBe(200);
});

test("/os is kept out of search engines and caches", async ({ request }) => {
  const response = await request.get("/os/login");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  expect(await response.text()).toContain('name="robots" content="noindex');
});

test("the public site runs no session code and sets no cookies", async ({ page, context }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["set-cookie"]).toBeUndefined();
  expect(response?.headers()["x-robots-tag"]).toBeUndefined();
  expect(await context.cookies()).toEqual([]);
  await expect(page.locator(".os-shell")).toHaveCount(0);
  expect(await page.content()).not.toContain("/os/");
});
