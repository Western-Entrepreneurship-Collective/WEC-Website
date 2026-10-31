import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkOnboarding } from "@/components/os/MarkOnboarding";
import { Panel, TaskTable } from "@/components/os/ui";
import { can } from "@/lib/os/dal";
import { createClient } from "@/lib/os/supabase";
import { getTeam } from "../team";

export default async function TeamRequests({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { me, department, canOpen } = await getTeam(slug);
  if (!canOpen) notFound();
  const supabase = await createClient();
  const [queue, active, outgoing, closed] = await Promise.all([
    supabase.from("tasks").select("*").eq("responsible_department_id", department.id).in("request_state", ["pending", "clarification_requested"]).order("created_at"),
    supabase.from("tasks").select("*").eq("responsible_department_id", department.id).eq("request_state", "accepted").not("status", "in", "(done,cancelled)").order("due_at", { nullsFirst: false }),
    supabase.from("tasks").select("*").eq("requesting_department_id", department.id).eq("is_cross_team", true).not("status", "in", "(done,cancelled)").order("due_at", { nullsFirst: false }),
    supabase.from("tasks").select("*").eq("is_cross_team", true).or(`requesting_department_id.eq.${department.id},responsible_department_id.eq.${department.id}`).in("status", ["done", "cancelled"]).order("updated_at", { ascending: false }).limit(20),
  ]);
  return (
    <>
      {!me.onboarding?.requests_seen && me.positions.some(p => p.is_head && p.department_id === department.id) ? <MarkOnboarding step="requests_seen" /> : null}
      {can(me, "request.create") ? <p><Link className="os-btn os-btn-primary" href="/os/requests/new">New cross-team request</Link></p> : null}
      <Panel title="Waiting on us"><TaskTable tasks={queue.data ?? []} empty="Nothing waiting. Only the team's lead sees requests before they are accepted." /></Panel>
      <Panel title="Accepted, in progress"><TaskTable tasks={active.data ?? []} empty="Nothing in progress." /></Panel>
      <Panel title="Waiting on other teams"><TaskTable tasks={outgoing.data ?? []} empty="No open requests." /></Panel>
      <Panel title="Closed"><TaskTable tasks={closed.data ?? []} empty="Nothing closed yet." /></Panel>
    </>
  );
}
