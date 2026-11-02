import "server-only";
import { rpc } from "./supabase";

/** task id to project name, for task lists. Asks the database, which only answers for tasks this person can read. */
export async function projectNames(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await rpc<{ task_id: string; project_name: string }[]>("task_project_names", { p_tasks: ids });
  return new Map(rows.map(r => [r.task_id, r.project_name]));
}
