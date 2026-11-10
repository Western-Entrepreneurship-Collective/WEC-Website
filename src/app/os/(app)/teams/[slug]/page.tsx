import type { Metadata } from "next";
import Link from "next/link";
import { Empty, Meter, TaskRow } from "@/components/os/ui";
import { can, getDirectory, nameLookup } from "@/lib/os/dal";
import { getSeats } from "@/lib/os/org";
import { projectNames } from "@/lib/os/projectNames";
import { createClient, rpc } from "@/lib/os/supabase";
import type { ProjectSummary } from "@/lib/os/types";
import { getTeam } from "./team";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [{ me, department, canOpen }, allSeats] = await Promise.all([getTeam(slug), getSeats()]);
  const supabase = await createClient();
  const seats = allSeats.filter(s => s.departmentId === department.id);
  const lead = seats.find(s => s.isHead);
  const people = (
    <ul className="os-team-people" aria-label="People">
      {seats.map(s => <li key={s.key}><span><strong>{s.name ?? "Open seat"}{s.execId === me.id ? " (you)" : ""}</strong><small>{s.title}</small></span></li>)}
    </ul>
  );
  const band = (extra?: React.ReactNode) => (
    <header className="os-team-band">
      <div><nav className="os-crumbs" aria-label="You are here"><Link href="/os/teams">Teams</Link></nav><h1>{department.name}</h1><p>{department.description}</p></div>
      {people}
      {extra}
    </header>
  );

  // Someone from another team: who to ask, the work between the two teams, and what
  // this team has chosen to publish. Its private work stays with it.
  if (!canOpen) {
    const mine = me.positions.map(p => p.department_id);
    const myName = me.positions[0]?.department_name;
    const [{ data: sops }, between, projects, directory] = await Promise.all([
      supabase.from("sops").select("id, title").eq("department_id", department.id).is("archived_at", null).not("current_version_id", "is", null).order("title"),
      mine.length ? supabase.from("tasks").select("*").eq("is_cross_team", true).not("status", "in", "(done,cancelled)")
        .or(`and(responsible_department_id.eq.${department.id},requesting_department_id.in.(${mine.join(",")})),and(requesting_department_id.eq.${department.id},responsible_department_id.in.(${mine.join(",")}))`).order("due_at", { nullsFirst: false }).limit(20) : Promise.resolve({ data: [] }),
      rpc<ProjectSummary[]>("project_summaries", { p_department: department.id }),
      getDirectory(),
    ]);
    const nameOf = nameLookup(directory);
    const shared = between.data ?? [];
    const names = await projectNames(shared.map(t => t.id));
    return (
      <div className="os-page">
        {band(can(me, "request.create") && mine.length ? <Link className="os-btn os-btn-primary" href={`/os/tasks/new?to=${department.id}`}>Send {department.name} a task</Link> : null)}
        {!lead?.name ? <p className="os-note">{department.name} has no VP right now, so tasks sent here go to the President.</p> : null}
        <div className="os-split">
          <div className="os-stack-lg">
            <section className="os-panel" aria-labelledby="between">
              <h2 id="between">{myName ? `Between ${myName} and ${department.name}` : `Your tasks with ${department.name}`}</h2>
              {shared.length ? <div>{shared.map(t => <TaskRow key={t.id} task={t} sub={[t.assigned_to ? nameOf(t.assigned_to) : "Not taken yet", names.get(t.id)].filter(Boolean).join(". ")} />)}</div> : <Empty>Nothing between your teams right now.</Empty>}
            </section>
            <section className="os-panel" aria-labelledby="shared">
              <h2 id="shared">Projects you can see</h2>
              {projects.length ? (
                <ul className="os-plain-list">
                  {projects.map(p => <li key={p.id} className="os-project-line"><Link href={`/os/projects/${p.id}`}>{p.name}</Link><small>{p.done_tasks} of {p.total_tasks} done</small><Meter value={p.progress} /></li>)}
                </ul>
              ) : <Empty>None right now.</Empty>}
            </section>
            <p className="os-muted">{department.name}&apos;s private projects and other tasks stay with {department.name}.</p>
          </div>
          <aside className="os-panel">
            <h2>Their published SOPs</h2>
            {(sops ?? []).length ? <ul className="os-plain-list">{(sops ?? []).map(s => <li key={s.id}><Link href={`/os/sops/${s.id}`}>{s.title}</Link></li>)}</ul> : <Empty>None yet.</Empty>}
          </aside>
        </div>
      </div>
    );
  }

  const [projects, incoming, open, sopCount, meetingCount, handover, { data: unclaimed }] = await Promise.all([
    rpc<ProjectSummary[]>("project_summaries", { p_department: department.id }),
    supabase.from("tasks").select("id, requesting_department_id").eq("responsible_department_id", department.id).in("request_state", ["pending", "clarification_requested"]),
    supabase.from("tasks").select("*").eq("responsible_department_id", department.id).not("status", "in", "(done,cancelled)").neq("status", "unassigned").order("due_at", { nullsFirst: false }).limit(200),
    supabase.from("sops").select("id", { count: "exact", head: true }).eq("department_id", department.id).is("archived_at", null),
    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("department_id", department.id),
    supabase.from("projects").select("id, name").eq("owning_department_id", department.id).like("system_key", "handover:%").is("archived_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("tasks").select("*").eq("responsible_department_id", department.id).eq("status", "unassigned").is("request_state", null).order("due_at", { nullsFirst: false }).limit(50),
  ]);
  const tasks = open.data ?? [];
  const names = await projectNames([...tasks, ...(unclaimed ?? [])].map(t => t.id));
  const waiting = incoming.data ?? [];
  const isHead = me.is_president || me.positions.some(p => p.is_head && p.department_id === department.id);
  const holders = [...new Map(seats.filter(s => s.execId).map(s => [s.execId!, s])).values()];
  const leadWord = lead?.name ? lead.name.split(" ")[0] : "the President";
  const canTick = (t: { assigned_to: string | null; assigned_by: string | null; is_cross_team: boolean }) => isHead || t.assigned_to === me.id || (t.assigned_by === me.id && !t.is_cross_team);
  const lateCount = (id: string) => tasks.filter(t => t.assigned_to === id && t.due_at && new Date(t.due_at) < new Date()).length;

  return (
    <div className="os-page">
      {band()}
      <div className="os-split">
        <div className="os-stack-lg">
          {waiting.length ? (
            <section className="os-request-banner" aria-labelledby="requests">
              <h2 id="requests">{waiting.length} {waiting.length === 1 ? "request" : "requests"} waiting on {isHead && lead?.execId === me.id ? "you" : leadWord}</h2>
              {isHead ? <Link className="os-btn os-btn-invert" href={lead?.execId === me.id ? "/os" : "/os/president"}>See requests</Link> : null}
            </section>
          ) : null}
          {holders.map(s => {
            const theirs = tasks.filter(t => t.assigned_to === s.execId);
            const late = lateCount(s.execId!);
            return (
              <section key={s.execId} className="os-panel" aria-label={s.name ?? ""}>
                <h2>{s.name} {late ? <em className="os-overdue">{late} overdue</em> : null}</h2>
                {theirs.length ? <div>{theirs.map(t => <TaskRow key={t.id} task={t} sub={names.get(t.id)} canTick={canTick(t)} />)}</div> : <p className="os-muted">Nothing open.</p>}
              </section>
            );
          })}
          {(unclaimed ?? []).length ? (
            <section className="os-panel" aria-label="Nobody has these yet">
              <h2>Nobody has these yet</h2>
              <div>{(unclaimed ?? []).map(t => <TaskRow key={t.id} task={t} sub={names.get(t.id)} />)}</div>
            </section>
          ) : null}
        </div>
        <aside className="os-stack-lg">
          <section className="os-panel" aria-labelledby="projects">
            <h2 id="projects">Projects</h2>
            {projects.length ? (
              <ul className="os-plain-list">
                {projects.map(p => <li key={p.id} className="os-project-line"><Link href={`/os/projects/${p.id}`}>{p.name}</Link><small>{p.done_tasks} of {p.total_tasks}</small><Meter value={p.progress} /></li>)}
              </ul>
            ) : <Empty>No projects yet.</Empty>}
          </section>
          <section className="os-panel" aria-labelledby="know">
            <h2 id="know">Reference</h2>
            <ul className="os-plain-list">
              <li><Link href={`/os/teams/${slug}/sops`}>SOPs ({sopCount.count ?? 0})</Link></li>
              <li><Link href={`/os/teams/${slug}/meetings`}>Meeting notes ({meetingCount.count ?? 0})</Link></li>
              {handover.data ? <li><Link href={`/os/projects/${handover.data.id}`}>{handover.data.name}</Link></li> : null}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
