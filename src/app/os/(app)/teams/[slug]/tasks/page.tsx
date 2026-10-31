import { notFound } from "next/navigation";
import { Kanban } from "@/components/os/Kanban";
import { getDirectory, nameLookup } from "@/lib/os/dal";
import { formatDate } from "@/lib/os/format";
import { createClient } from "@/lib/os/supabase";
import { getTeam } from "../team";

export default async function TeamTasks({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { department, canOpen } = await getTeam(slug);
  if (!canOpen) notFound();
  const supabase = await createClient();
  const nameOf = nameLookup(await getDirectory());
  const { data } = await supabase.from("tasks").select("*").eq("responsible_department_id", department.id).not("status", "eq", "cancelled").order("due_at", { nullsFirst: false }).limit(300);
  return <Kanban cards={(data ?? []).filter(t => !t.request_state || t.request_state === "accepted").map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, assignee: nameOf(t.assigned_to), due: t.due_at ? formatDate(t.due_at) : undefined, is_cross_team: t.is_cross_team, requires_review: t.requires_review, updated_at: t.updated_at }))} />;
}
