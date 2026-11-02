import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { PEOPLE, apiAs, dbQuery, latestEmailLink, signIn, signOut } from "./support/helpers";
import { LOCAL } from "./support/local";

test("signing in and out works, and pages need a session", async ({ page }) => {
  await page.goto("/os");
  await expect(page).toHaveURL(/\/os\/login$/);
  await signIn(page, PEOPLE.vpContent);
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
  await signOut(page);
  await page.goto("/os/tasks");
  await expect(page).toHaveURL(/\/os\/login$/);
});

test("the session cookie is httpOnly and scoped to /os", async ({ page, context }) => {
  await signIn(page, PEOPLE.vpContent);
  const cookies = await context.cookies();
  const session = cookies.filter(c => c.name.includes("auth-token"));
  expect(session.length).toBeGreaterThan(0);
  for (const c of session) {
    expect(c.httpOnly).toBe(true);
    expect(c.path).toBe("/os");
  }
});

test("a wrong password and a deactivated account fail with the same words", async ({ page }) => {
  await page.goto("/os/login");
  await page.getByLabel("Email").fill(PEOPLE.vpContent);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  const message = page.locator(".os-form-error");
  await expect(message).toBeVisible();
  const wrongPassword = await message.textContent();

  await page.getByLabel("Email").fill(PEOPLE.former);
  await page.getByLabel("Password").fill(LOCAL.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(message).toHaveText(wrongPassword!);
  await expect(page).toHaveURL(/\/os\/login$/);
});

test("public signup is off", async () => {
  const response = await fetch(`${LOCAL.url}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: LOCAL.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "stranger@wec.test", password: "long-enough-password" }),
  });
  expect(response.status).toBe(422);
});

test("invitation, activation and password recovery, end to end", async ({ page }) => {
  await signIn(page, PEOPLE.admin);
  await page.goto("/os/admin/executives");
  const email = `new.exec.${Date.now()}@wec.test`;
  await page.getByLabel("Full name").fill("Nia Newperson");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Position").first().selectOption({ label: "Community: Director of Engagement" });
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText("Invitation sent.")).toBeVisible();
  await expect(page.getByText("Nia Newperson", { exact: true })).toBeVisible();

  // The email link spends nothing until the button is pressed.
  const link = await latestEmailLink(email, "activate");
  await page.context().clearCookies();
  await page.goto(link);
  await page.goto(link);
  await page.getByLabel("New password").fill("a-new-long-password");
  await page.getByLabel("Repeat it").fill("a-new-long-password");
  await page.getByRole("button", { name: "Activate my account" }).click();
  // A first sign-in lands on the welcome guide, once.
  await expect(page).toHaveURL(/\/os\/welcome$/);
  await expect(page.getByRole("heading", { name: "Welcome to WEC OS, Nia." })).toBeVisible();
  await expect(page.getByText("Director of Engagement").first()).toBeVisible();
  await page.getByRole("button", { name: "Take me to my Home" }).click();
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
  await page.goto("/os");
  await expect(page).toHaveURL(/\/os$/);

  // Recovery
  await signOut(page);
  await page.goto("/os/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/reset link is on its way/)).toBeVisible();
  const reset = await expect.poll(async () => latestEmailLink(email, "reset-password").catch(() => ""), { timeout: 15000 }).not.toBe("").then(() => latestEmailLink(email, "reset-password"));
  await page.goto(reset);
  await page.getByLabel("New password").fill("another-long-password");
  await page.getByLabel("Repeat it").fill("another-long-password");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();

  // The password reset page says nothing different about an unknown address.
  await page.context().clearCookies();
  await page.goto("/os/forgot-password");
  await page.getByLabel("Email").fill("nobody@wec.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/reset link is on its way/)).toBeVisible();
});

test("a batch of accounts: the temporary password opens nothing until it is replaced", async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), "wec-accounts-"));
  const list = join(dir, "list.csv");
  const email = `batch.${Date.now()}@wec.test`;
  writeFileSync(list, `email,name,position,admin\n${email},"Bea Batch",Director of Engagement,\n`);
  const home = join(dir, "home");
  mkdirSync(home);
  const env = { ...process.env, HOME: home, SUPABASE_URL: LOCAL.url, SUPABASE_SERVICE_ROLE_KEY: LOCAL.serviceKey };
  const script = "scripts/os-create-accounts.mjs";

  expect(execFileSync("node", [script, list, "--dry-run"], { env, encoding: "utf8" })).toContain("nothing was created");
  expect(await dbQuery(`select count(*) from os.executives where email = '${email}'`)).toBe("0");

  const printed = execFileSync("node", [script, list], { env, encoding: "utf8" });
  const file = readdirSync(home).find(f => f.startsWith("wec-os-passwords-"))!;
  expect(statSync(join(home, file)).mode & 0o777).toBe(0o600);
  const temporary = readFileSync(join(home, file), "utf8").trim().split("\n")[1].split(",")[3].replaceAll('"', "");
  expect(temporary).toMatch(/^\w{5}-\w{5}-\w{5}-\w{5}$/);
  expect(printed).not.toContain(temporary);

  // Running it again leaves the account and its password alone.
  expect(execFileSync("node", [script, list], { env, encoding: "utf8" })).toContain("left alone");

  await page.goto("/os/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(temporary);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/os\/change-password$/);

  // No other page opens first.
  await page.goto("/os");
  await expect(page).toHaveURL(/\/os\/change-password$/);
  await page.goto("/os/teams");
  await expect(page).toHaveURL(/\/os\/change-password$/);

  await page.getByLabel("New password").fill(temporary);
  await page.getByLabel("Repeat it").fill(temporary);
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.locator(".os-form-error")).toContainText("different from the temporary one");

  await page.getByLabel("New password").fill("bea-chose-this-password");
  await page.getByLabel("Repeat it").fill("bea-chose-this-password");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/os\/welcome$/);
  await expect(page.getByRole("heading", { name: "Welcome to WEC OS, Bea." })).toBeVisible();

  // The temporary password is finished.
  await page.context().clearCookies();
  await page.goto("/os/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(temporary);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".os-form-error")).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("bea-chose-this-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/os\/welcome$/);
});

test("the batch script refuses a list kept inside the public repository", async () => {
  const env = { ...process.env, SUPABASE_URL: LOCAL.url, SUPABASE_SERVICE_ROLE_KEY: LOCAL.serviceKey };
  expect(() => execFileSync("node", ["scripts/os-create-accounts.mjs", "package.json"], { env, stdio: "pipe" })).toThrow(/outside this repository/);
});

test("deactivating someone cuts off a session that is already open", async ({ browser }) => {
  const victim = await browser.newContext();
  const vPage = await victim.newPage();
  await signIn(vPage, PEOPLE.coordOutreach);
  const api = await apiAs(PEOPLE.coordOutreach);
  expect((await api.schema("os").from("departments").select("id")).data?.length).toBeGreaterThan(0);

  const adminCtx = await browser.newContext();
  const aPage = await adminCtx.newPage();
  await signIn(aPage, PEOPLE.admin);
  await aPage.goto("/os/admin/executives");
  const row = aPage.locator(".os-people > li", { hasText: PEOPLE.coordOutreach });
  await row.locator("summary").click();
  await row.getByRole("button", { name: "Deactivate account" }).click();
  await row.getByRole("button", { name: "Yes, continue" }).click();
  await expect(row.getByText("Deactivated")).toBeVisible();

  // The same token, a moment later.
  expect((await api.schema("os").from("departments").select("id")).data).toEqual([]);
  await vPage.goto("/os/tasks");
  await expect(vPage).toHaveURL(/\/os\/login$/);

  await aPage.goto("/os/admin/executives");
  const again = aPage.locator(".os-people > li", { hasText: PEOPLE.coordOutreach });
  await again.locator("summary").click();
  await again.getByRole("button", { name: "Reactivate" }).click();
  await again.getByRole("button", { name: "Yes, continue" }).click();
  await expect(again.locator("summary").getByText("Active")).toBeVisible();
  await victim.close();
  await adminCtx.close();
});
