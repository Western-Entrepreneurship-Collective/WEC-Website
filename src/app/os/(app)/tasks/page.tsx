import type { Metadata } from "next";
import { Kanban } from "@/components/os/Kanban";
import { Page, Panel, Tabs, TaskTable } from "@/components/os/ui";
import { getDepartments, getDirectory, nameLookup, requireMe } from "@/lib/os/dal";
import { formatDate } from "@/lib/os/format";
import { createClient } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "Tasks" };

export default async function MyTasksPage({ searchParams }: { searchParams: Promise<{ view?: string; show?: string }> }) {
  const me = await requireMe();
  const { view, show } = await searchParams;
  const supabase = await createClient();
  const nameOf = nameLookup(await getDirectory());
  const allDepartments = await getDepartments();
  const teamOf = (id: string) => allDepartments.find(d => d.id === id)?.name;
  const closed = show === "closed";
  const query = supabase.from("tasks").select("*");
  const { data } = await (closed ? query.in("status", ["done", "cancelled"]) : query.not("status", "in", "(done,cancelled)"))
    .eq("assigned_to", me.id).order("due_at", { nullsFirst: false }).limit(200);
  const { data: assigned } = await supabase.from("tasks").select("*").eq("assigned_by", me.id).neq("assigned_to", me.id).not("status", "in", "(done,cancelled)").order("due_at", { nullsFirst: false }).limit(100);
  const tasks = data ?? [];
  return (
    <Page title="Tasks">
      <Tabs current={view === "board" ? "board" : closed ? "closed" : "list"} items={[
        { key: "list", href: "/os/tasks", label: "List" },
        { key: "board", href: "/os/tasks?view=board", label: "Board" },
        { key: "closed", href: "/os/tasks?show=closed", label: "Finished" },
      ]} />
      {view === "board" ? (
        <Kanban cards={tasks.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, due: t.due_at ? formatDate(t.due_at) : undefined, is_cross_team: t.is_cross_team, requires_review: t.requires_review, updated_at: t.updated_at }))} />
      ) : (
        <Panel><TaskTable tasks={tasks} teamOf={teamOf} empty={closed ? "Nothing finished yet." : "Nothing assigned to you right now."} /></Panel>
      )}
      {!closed ? <Panel title="Tasks I assigned"><TaskTable tasks={assigned ?? []} nameOf={nameOf} empty="You have not assigned anything open." /></Panel> : null}
    </Page>
  );
}
