import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { LOCAL } from "./local";

export const PEOPLE = {
  president: "president@wec.test",
  vpEvents: "vp.events@wec.test",
  vpContent: "vp.content@wec.test",
  dirContent: "dir.content@wec.test",
  vpOutreach: "vp.outreach@wec.test",
  coordOutreach: "coord.outreach@wec.test",
  vpFinance: "vp.finance@wec.test",
  dirFinance: "dir.finance@wec.test",
  admin: "admin@wec.test",
  former: "former@wec.test",
};

export async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/os/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(LOCAL.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/os$/);
}

// A real session, used to call the API the way an attacker with their own login could.
export async function apiAs(email: string) {
  const client = createClient(LOCAL.url, LOCAL.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: LOCAL.password });
  if (error) throw error;
  return client;
}

export const service = () => createClient(LOCAL.url, LOCAL.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

export async function dbQuery(sql: string) {
  const { execSync } = await import("node:child_process");
  return execSync("docker exec -i supabase_db_wec-os psql -U postgres -d postgres -At -v ON_ERROR_STOP=1", { input: sql, encoding: "utf8" }).trim();
}

export async function latestEmailLink(to: string, marker: string) {
  await expect.poll(async () => (await (await fetch(`${LOCAL.mail}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json()).messages?.length ?? 0, { timeout: 15000 }).toBeGreaterThan(0);
  const { messages } = await (await fetch(`${LOCAL.mail}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
  const message = await (await fetch(`${LOCAL.mail}/api/v1/message/${messages[0].ID}`)).json();
  const match = String(message.HTML).match(new RegExp(`https?://[^"]*${marker}[^"]*`));
  if (!match) throw new Error("No matching link in the email");
  return match[0].replace(/&amp;/g, "&");
}

export const futureLocal = (days: number) => {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${d.toISOString().slice(0, 10)}T18:00`;
};
