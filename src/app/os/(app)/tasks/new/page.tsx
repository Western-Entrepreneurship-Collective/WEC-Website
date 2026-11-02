import type { Metadata } from "next";
import { TaskForm } from "@/components/os/TaskComposer";
import { can, requireMe } from "@/lib/os/dal";
import { createClient } from "@/lib/os/supabase";
import { getWho } from "@/lib/os/who";

export const metadata: Metadata = { title: "New task" };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ project?: string; to?: string }> }) {
  const me = await requireMe();
  const { project, to } = await searchParams;
  const supabase = await createClient();
  const [who, { data: projects }] = await Promise.all([
    getWho(me),
    supabase.from("projects").select("id, name").is("archived_at", null).in("status", ["planning", "active", "on_hold"]).order("name").limit(300),
  ]);
  return <TaskForm projects={projects ?? []} who={who} project={project} start={to ? `t:${to}` : undefined} canStartProject={can(me, "project.create_internal") && me.positions.length > 0} />;
}
