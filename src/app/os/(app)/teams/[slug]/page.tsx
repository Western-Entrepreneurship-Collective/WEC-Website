import Link from "next/link";
import { Empty, Panel, Progress, Stat, TaskTable } from "@/components/os/ui";
import { displayName } from "@/lib/os/dal";
import { formatDate } from "@/lib/os/format";
import { createClient, rpc } from "@/lib/os/supabase";
import type { ProjectSummary } from "@/lib/os/types";
import { getTeam } from "./team";

const ROLE_ORDER: Record<string, number> = { president: 0, vp: 1, director: 2, coordinator: 3 };

export default async function TeamDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { department, canOpen } = await getTeam(slug);
  const supabase = await createClient();
  const { data: positions } = await supabase.from("positions").select("*").eq("department_id", department.id).is("archived_at", null);
  const ids = (positions ?? []).map(p => p.id);
  const { data: rows } = await supabase.from("position_assignments").select("position_id, seat_no, during, is_acting, executives!position_assignments_executive_id_fkey(id, full_name, preferred_name, status)").in("position_id", ids);
  const today = new Date().toISOString().slice(0, 10);
  const holders = (rows ?? []).filter(r => r.executives?.status === "active" && (() => { const u = String(r.during).split(",")[1]?.replace(/[)\]]/, ""); return !u || u > today; })());
  const roster = (positions ?? []).sort((a, b) => (ROLE_ORDER[a.org_role] ?? 9) - (ROLE_ORDER[b.org_role] ?? 9)).flatMap(p =>
    Array.from({ length: p.seat_count }, (_, i) => {
      const h = holders.find(x => x.position_id === p.id && x.seat_no === i + 1);
      return { key: `${p.id}${i}`, title: p.title, name: h?.executives ? displayName(h.executives) : null, acting: h?.is_acting };
    }));

  const rosterPanel = (
    <Panel title="People">
      <ul className="os-list">
        {roster.map(r => <li key={r.key}><span>{r.name ?? <span className="os-muted">Open seat</span>}{r.acting ? " (acting)" : ""}</span><span className="os-muted">{r.title}</span></li>)}
      </ul>
    </Panel>
  );
  if (!canOpen) return rosterPanel;

  const [projects, incoming, outgoing, upcoming, sops, meetings] = await Promise.all([
    rpc<ProjectSummary[]>("project_summaries", { p_department: department.id }),
    supabase.from("tasks").select("*").eq("responsible_department_id", department.id).eq("is_cross_team", true).in("request_state", ["pending", "clarification_requested"]).order("created_at").limit(6),
    supabase.from("tasks").select("*").eq("requesting_department_id", department.id).eq("is_cross_team", true).not("status", "in", "(done,cancelled)").order("due_at", { nullsFirst: false }).limit(6),
    supabase.from("tasks").select("*").eq("responsible_department_id", department.id).not("status", "in", "(done,cancelled)").order("due_at", { nullsFirst: false }).limit(8),
    supabase.from("sops").select("id, title").eq("department_id", department.id).is("archived_at", null).order("title").limit(5),
    supabase.from("meetings").select("id, title, starts_at").eq("department_id", department.id).order("starts_at", { ascending: false }).limit(5),
  ]);
  const internal = projects.filter(p => p.kind === "INTERNAL" && !p.event_id);
  const linked = projects.filter(p => p.kind === "INTERNAL" && p.event_id);
  const eventProjects = projects.filter(p => p.kind === "EVENT");
  const projectList = (list: ProjectSummary[], empty: string) => list.length === 0 ? <Empty>{empty}</Empty> : (
    <ul className="os-list">
      {list.map(p => <li key={p.id}><Link href={`/os/projects/${p.id}`}>{p.name}</Link><span className="os-list-side"><Progress value={p.progress} /><span className="os-muted">{p.progress}%</span></span></li>)}
    </ul>
  );
  return (
    <>
      <div className="os-stats">
        <Stat label="Open projects" value={projects.filter(p => p.status !== "completed").length} href={`/os/teams/${slug}/projects`} />
        <Stat label="Incoming requests" value={(incoming.data ?? []).length} href={`/os/teams/${slug}/requests`} />
        <Stat label="Outgoing requests" value={(outgoing.data ?? []).length} href={`/os/teams/${slug}/requests`} />
        <Stat label="Open tasks" value={(upcoming.data ?? []).length} href={`/os/teams/${slug}/tasks`} />
      </div>
      <div className="os-grid">
        <Panel title="Upcoming deadlines"><TaskTable tasks={upcoming.data ?? []} empty="No open tasks." /></Panel>
        <Panel title="Incoming requests" action={<Link className="os-link" href={`/os/teams/${slug}/requests`}>All</Link>}><TaskTable tasks={incoming.data ?? []} empty="Nothing waiting." /></Panel>
        <Panel title="Outgoing requests"><TaskTable tasks={outgoing.data ?? []} empty="No open requests." /></Panel>
        <Panel title="Internal projects">{projectList(internal, "No internal projects.")}</Panel>
        <Panel title="Event-linked internal projects">{projectList(linked, "None linked to an event.")}</Panel>
        <Panel title="Event projects">{projectList(eventProjects, "None assigned to this team.")}</Panel>
        {rosterPanel}
        <Panel title="SOPs" action={<Link className="os-link" href={`/os/teams/${slug}/sops`}>All</Link>}>
          {(sops.data ?? []).length === 0 ? <Empty>No SOPs yet.</Empty> : <ul className="os-list">{(sops.data ?? []).map(s => <li key={s.id}><Link href={`/os/sops/${s.id}`}>{s.title}</Link></li>)}</ul>}
        </Panel>
        <Panel title="Meeting notes" action={<Link className="os-link" href={`/os/teams/${slug}/meetings`}>All</Link>}>
          {(meetings.data ?? []).length === 0 ? <Empty>No meetings recorded.</Empty> : <ul className="os-list">{(meetings.data ?? []).map(m => <li key={m.id}><Link href={`/os/meetings/${m.id}`}>{m.title}</Link><span className="os-muted">{formatDate(m.starts_at)}</span></li>)}</ul>}
        </Panel>
      </div>
    </>
  );
}
