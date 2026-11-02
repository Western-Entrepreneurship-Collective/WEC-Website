import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TaskRow, Empty, Page, Panel } from "@/components/os/ui";
import { requireMe } from "@/lib/os/dal";
import { createClient } from "@/lib/os/supabase";
import { projectNames } from "@/lib/os/projectNames";

export const metadata: Metadata = { title: "Finished tasks" };

// My tasks is the home page. This address only remains for finished work.
export default async function FinishedTasksPage({ searchParams }: { searchParams: Promise<{ show?: string; view?: string }> }) {
  const me = await requireMe();
  const { show, view } = await searchParams;
  if (show !== "closed") redirect(view === "board" ? "/os?view=board" : "/os");
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").select("*").eq("assigned_to", me.id).in("status", ["done", "cancelled"]).order("completed_at", { ascending: false, nullsFirst: false }).limit(200);
  const tasks = data ?? [];
  const names = await projectNames(tasks.map(t => t.id));
  return (
    <Page title="Finished tasks">
      <Panel>{tasks.length ? tasks.map(t => <TaskRow key={t.id} task={t} sub={names.get(t.id)} canTick={t.status === "done"} />) : <Empty>Nothing finished yet.</Empty>}</Panel>
    </Page>
  );
}
