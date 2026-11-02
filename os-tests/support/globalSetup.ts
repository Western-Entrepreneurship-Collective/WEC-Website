import { execSync } from "node:child_process";

// A clean database for each run. `supabase db reset` acts on this project's own
// local containers (project_id wec-os), never on anything hosted.
export default function globalSetup() {
  execSync("npx supabase db reset --local", { stdio: "pipe", timeout: 180_000 });
}
