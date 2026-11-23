import { execSync } from "node:child_process";
import { LOCAL } from "./local";

// A clean database for each run. `supabase db reset` acts on this project's own
// local containers (project_id wec-os), never on anything hosted.
export default async function globalSetup() {
  execSync("npx supabase db reset --local", { stdio: "pipe", timeout: 180_000 });
  // The reset restarts the API, which reloads its schema for a few seconds after.
  // A sign-in in that window fails, so wait until a real call answers.
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const res = await fetch(`${LOCAL.url}/rest/v1/rpc/me`, {
      method: "POST",
      headers: { apikey: LOCAL.anonKey, "Content-Profile": "api", "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => null);
    if (res && res.status < 500) return;
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error("The local API did not come back after the reset");
}
