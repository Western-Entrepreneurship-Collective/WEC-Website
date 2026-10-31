import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Calendar } from "@/components/os/Calendar";
import { ProjectTable } from "@/components/os/ProjectTable";
import { DueDate, Empty, Field, Hidden, Page, Panel, Pill, Progress, Stat } from "@/components/os/ui";
import { archiveAnnouncement, publishAnnouncement } from "@/lib/os/actions/work";
import { requirePresident } from "@/lib/os/dal";
import { formatDate, formatDateTime } from "@/lib/os/format";
import { createClient, rpc } from "@/lib/os/supabase";
import type { ProjectSummary } from "@/lib/os/types";

export const metadata: Metadata = { title: "President" };

type Escalation = { task_id: string; title: string; status: string; due_at: string | null; department_name: string; project_name: string; is_overdue: boolean };
type Dependency = { task_id: string; title: string; status: string; request_state: string; due_at: string | null; requesting: string; responsible: string };
type DepartmentRow = { department_id: string; department_name: string; open_tasks: number; done_tasks: number; overdue_tasks: number; blocked_tasks: number };

export default async function PresidentPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; show?: string | string[] }> }) {
  await requirePresident();
  const supabase = await createClient();
  const [pendingEvents, upcoming, announcements, projects, escalations, dependencies, departments] = await Promise.all([
    supabase.from("events").select("*").eq("status", "submitted").order("submitted_at"),
    supabase.from("events").select("*").in("status", ["approved", "in_progress"]).order("starts_at").limit(8),
    supabase.from("announcements").select("*").is("archived_at", null).order("published_at", { ascending: false }).limit(5),
    rpc<ProjectSummary[]>("project_summaries"),
    rpc<Escalation[]>("escalations"),
    rpc<Dependency[]>("cross_team_dependencies"),
    rpc<DepartmentRow[]>("department_progress"),
  ]);
  const pendingGlobals = projects.filter(p => p.kind === "GLOBAL" && p.approval_status === "pending");
  const readiness = new Map(await Promise.all((upcoming.data ?? []).map(async e => [e.id, await rpc<number>("event_readiness", { p_event: e.id })] as const)));
  const overdue = escalations.filter(e => e.is_overdue);
  const blocked = escalations.filter(e => e.status === "blocked");
  return (
    <Page eyebrow="Organization" title="President's dashboard">
      <div className="os-stats">
        <Stat label="Event approvals" value={(pendingEvents.data ?? []).length} />
        <Stat label="Global approvals" value={pendingGlobals.length} />
        <Stat label="Overdue tasks" value={overdue.length} />
        <Stat label="Blocked tasks" value={blocked.length} />
      </div>
      <div className="os-grid">
        <Panel title="Pending event approvals">
          {(pendingEvents.data ?? []).length === 0 ? <Empty>Nothing waiting.</Empty> : <ul className="os-list">{(pendingEvents.data ?? []).map(e => <li key={e.id}><Link href={`/os/events/${e.id}`}>{e.name}</Link><span className="os-muted">Tier {e.tier} · {formatDateTime(e.starts_at)}</span></li>)}</ul>}
        </Panel>
        <Panel title="Pending Global Project approvals">
          {pendingGlobals.length === 0 ? <Empty>Nothing waiting.</Empty> : <ul className="os-list">{pendingGlobals.map(p => <li key={p.id}><Link href={`/os/projects/${p.id}`}>{p.name}</Link><span className="os-muted">{p.department_name}</span></li>)}</ul>}
        </Panel>
        <Panel title="Upcoming events and readiness">
          {(upcoming.data ?? []).length === 0 ? <Empty>No approved events coming up.</Empty> : <ul className="os-list">{(upcoming.data ?? []).map(e => <li key={e.id}><span><Link href={`/os/events/${e.id}`}>{e.name}</Link> <span className="os-muted">{formatDate(e.starts_at)}</span></span><span className="os-list-side"><Progress value={readiness.get(e.id) ?? 0} /><span className="os-muted">{readiness.get(e.id) ?? 0}%</span></span></li>)}</ul>}
        </Panel>
        <Panel title="Department progress">
          <div className="os-table-wrap" tabIndex={0} role="group" aria-label="Table">
            <table className="os-table">
              <thead><tr><th scope="col">Team</th><th scope="col">Open</th><th scope="col">Done</th><th scope="col">Overdue</th><th scope="col">Blocked</th></tr></thead>
              <tbody>{departments.map(d => <tr key={d.department_id}><td>{d.department_name}</td><td>{d.open_tasks}</td><td>{d.done_tasks}</td><td className={d.overdue_tasks ? "os-overdue" : undefined}>{d.overdue_tasks}</td><td>{d.blocked_tasks}</td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Blocked and overdue work">
          {escalations.length === 0 ? <Empty>Nothing is blocked or overdue.</Empty> : <ul className="os-list">{escalations.slice(0, 15).map(e => <li key={e.task_id}><span><Link href={`/os/tasks/${e.task_id}`}>{e.title}</Link> <span className="os-muted">{e.department_name}</span></span><span><Pill value={e.status} /> <DueDate value={e.due_at} status={e.status} /></span></li>)}</ul>}
        </Panel>
        <Panel title="Cross-team dependencies">
          {dependencies.length === 0 ? <Empty>No open requests between teams.</Empty> : <ul className="os-list">{dependencies.slice(0, 15).map(d => <li key={d.task_id}><span><Link href={`/os/tasks/${d.task_id}`}>{d.title}</Link> <span className="os-muted">{d.requesting} → {d.responsible}</span></span><Pill value={d.request_state === "accepted" ? d.status : d.request_state} /></li>)}</ul>}
        </Panel>
        <Panel title="Announcements">
          <ActionForm action={publishAnnouncement} className="os-stack" resetOnSuccess>
            <Field label="Title"><input name="title" required maxLength={160} /></Field>
            <Field label="Message"><textarea name="body" rows={3} required /></Field>
            <div><SubmitButton variant="ghost">Publish to every executive</SubmitButton></div>
          </ActionForm>
          <ul className="os-list">
            {(announcements.data ?? []).map(a => <li key={a.id}><span>{a.title}</span><ActionForm action={archiveAnnouncement} confirm="Take this announcement down?"><Hidden name="id" value={a.id} /><button className="os-link-btn" type="submit">Take down</button></ActionForm></li>)}
          </ul>
        </Panel>
      </div>
      <Panel title="Project overview"><ProjectTable projects={projects} empty="No projects yet." /></Panel>
      <Panel title="Core Calendar"><Calendar scope="core" basePath="/os/president" searchParams={await searchParams} /></Panel>
    </Page>
  );
}
