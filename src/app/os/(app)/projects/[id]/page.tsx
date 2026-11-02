import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Kanban } from "@/components/os/Kanban";
import { Check, Empty, Field, Hidden, Page, Panel, Progress, TaskRow, TeamTile, ViewSwitch } from "@/components/os/ui";
import { QuickTask } from "@/components/os/TaskComposer";
import { saveMilestone, setMilestoneDone } from "@/lib/os/actions/work";
import { linkProjectSop } from "@/lib/os/actions/knowledge";
import { can, getDepartments, getDirectory, inDepartment, nameLookup, requireMe } from "@/lib/os/dal";
import { daysUntil, formatDate, shortDue } from "@/lib/os/format";
import { createClient, rpc } from "@/lib/os/supabase";
import { getWho } from "@/lib/os/who";
import type { ProjectSummary, Task } from "@/lib/os/types";

export const metadata: Metadata = { title: "Project" };

const isLate = (t: Task) => Boolean(t.due_at) && new Date(t.due_at!) < new Date() && t.status !== "done";

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const me = await requireMe();
  const { id } = await params;
  const { view } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  const summaries = await rpc<ProjectSummary[]>("project_summaries", { p_include_archived: true });
  const summary = summaries.find(s => s.id === id);

  // Summary-level access: name, status, dates and progress, and nothing more.
  if (!project) {
    if (!summary) notFound();
    return (
      <Page title={summary.name}>
        <p className="os-note">You can see this project&apos;s progress, but its details belong to the teams working on it.</p>
        <Panel>
          <div className="os-list-side os-wide"><Progress value={summary.progress} /><strong>{summary.done_tasks} of {summary.total_tasks} done</strong></div>
          <dl className="os-dl">
            <div><dt>Teams</dt><dd>{[summary.department_name, ...summary.other_teams].filter(Boolean).join(", ") || "Organization"}</dd></div>
            <div><dt>Lead</dt><dd>{summary.lead_name ?? "Not set"}</dd></div>
            <div><dt>Due</dt><dd>{formatDate(summary.due_on)}</dd></div>
          </dl>
        </Panel>
      </Page>
    );
  }

  const [directory, departments, who] = await Promise.all([getDirectory(), getDepartments(), getWho(me)]);
  const nameOf = nameLookup(directory);
  const [tasks, milestones, teams, sopRefs, event, publishedSops] = await Promise.all([
    supabase.from("tasks").select("*").eq("project_id", id).order("due_at", { nullsFirst: false }),
    supabase.from("milestones").select("*").eq("project_id", id).order("due_on"),
    supabase.from("project_departments").select("department_id").eq("project_id", id),
    supabase.from("project_sop_refs").select("sop_version_id, sop_versions(id, major, minor, sop_id, sops!sop_versions_sop_id_fkey(title))").eq("project_id", id),
    project.event_id ? supabase.from("events").select("id, name, starts_at").eq("id", project.event_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("sops").select("id, title, current_version_id").not("current_version_id", "is", null).is("archived_at", null).order("title").limit(200),
  ]);
  const all = tasks.data ?? [];
  const top = all.filter(t => !t.parent_task_id && t.status !== "cancelled");
  const archived = Boolean(project.archived_at);
  const manages = !archived && (me.is_president || project.lead_executive_id === me.id || me.positions.some(p => p.is_head && p.department_id === project.owning_department_id));
  const canAdd = !archived && can(me, "task.create") && (manages || inDepartment(me, project.owning_department_id) || me.positions.some(p => (teams.data ?? []).some(t => t.department_id === p.department_id)));
  const owner = departments.find(d => d.id === project.owning_department_id)?.name;
  const otherTeams = (teams.data ?? []).map(t => departments.find(d => d.id === t.department_id)).filter(d => d !== undefined);
  const open = top.filter(t => t.status !== "done");
  const attention = (t: Task) => isLate(t) || (t.status === "blocked" && !t.blocked_auto);
  const groups = [
    { key: "attention", title: "Needs attention", tone: "bad", list: open.filter(attention) },
    { key: "doing", title: "Doing", tone: "doing", list: open.filter(t => !attention(t) && ["in_progress", "submitted"].includes(t.status)) },
    { key: "todo", title: "To do", tone: "todo", list: open.filter(t => !attention(t) && !["in_progress", "submitted"].includes(t.status)) },
    { key: "done", title: "Done", tone: "good", list: top.filter(t => t.status === "done") },
  ].filter(g => g.list.length);
  const late = open.filter(isLate).length;
  const done = top.length - open.length;
  const board = view === "board";
  const canTick = (t: Task) => !archived && t.status !== "unassigned" && (me.is_president || t.assigned_to === me.id || (t.assigned_by === me.id && !t.is_cross_team) || me.positions.some(p => p.is_head && p.department_id === t.responsible_department_id));
  const teamWord = otherTeams.length ? `${owner}, with ${otherTeams.map(t => t.name).join(" and ")}.` : owner ? `Only ${owner} and the President can see this.` : "";

  return (
    <div className="os-page">
      <header className="os-project-head">
        <div>
          <nav className="os-crumbs" aria-label="You are here"><Link href="/os/projects">Projects</Link></nav>
          <h1>{project.name}</h1>
          <p>{teamWord}{event.data ? <> Part of <Link className="os-link" href={`/os/events/${event.data.id}`}>{event.data.name}</Link>.</> : null}</p>
          {project.summary ? <p className="os-muted">{project.summary}</p> : null}
        </div>
        <dl className="os-numbers">
          <div><dt>Done</dt><dd>{done} of {top.length}</dd></div>
          <div><dt>Overdue</dt><dd className={late ? "os-overdue" : undefined}>{late}</dd></div>
          <div><dt>Due</dt><dd>{project.due_on ? shortDue(project.due_on).replace(/^\w+, /, "") : "None"}</dd></div>
        </dl>
        {manages ? <Link className="os-btn os-btn-ghost" href={`/os/projects/${id}/edit`}>Edit</Link> : null}
      </header>
      {archived ? <p className="os-note">This project is archived. Everything here is read-only.</p> : null}

      {canAdd ? <QuickTask project={id} who={who} /> : null}

      <ViewSwitch label="View" items={[{ href: `/os/projects/${id}`, label: "List", on: !board }, { href: `/os/projects/${id}?view=board`, label: "Board", on: board }]} />

      {board ? (
        <Kanban cards={top.map(t => ({ id: t.id, title: t.title, status: t.status, sub: t.assigned_to ? nameOf(t.assigned_to) : t.is_cross_team ? "Waiting for the other team" : "Unassigned", due: shortDue(t.due_at), late: isLate(t), updated_at: t.updated_at, waiting: t.status === "blocked" && t.blocked_auto }))} />
      ) : (
        <div className="os-split">
          <div className="os-stack-lg">
            {groups.length === 0 ? <Empty>No tasks yet.</Empty> : groups.map(g => (
              <section key={g.key} className={`os-band os-band-${g.tone}`} aria-label={g.title}>
                <h2><span>{g.title}</span><em>{g.list.length}</em></h2>
                <div>
                  {g.list.map(t => {
                    const team = t.is_cross_team ? departments.find(d => d.id === t.responsible_department_id)?.name : null;
                    const person = t.assigned_to ? nameOf(t.assigned_to) : null;
                    return <TaskRow key={t.id} task={t} sub={team ? (person ? `${team}: ${person}` : `Sent to ${team}`) : person ?? "Unassigned"} canTick={canTick(t)} />;
                  })}
                </div>
              </section>
            ))}
          </div>
          <aside className="os-stack-lg">
            {event.data ? (
              <section className="os-panel" aria-labelledby="event">
                <h2 id="event">Part of</h2>
                <Link href={`/os/events/${event.data.id}`}>{event.data.name}</Link>
                <p className="os-muted">{formatDate(event.data.starts_at)}, {Math.max(0, Math.ceil(daysUntil(event.data.starts_at)))} days away</p>
              </section>
            ) : null}
            <section className="os-panel" aria-labelledby="teams">
              <h2 id="teams">Teams</h2>
              <ul className="os-plain-list">
                {owner ? <li className="os-with-tile"><TeamTile name={owner} size="small" /><span>{owner}<small>Owns this project</small></span></li> : null}
                {otherTeams.map(t => <li key={t.id} className="os-with-tile"><TeamTile name={t.name} size="small" /><span>{t.name}<small>Working on it too</small></span></li>)}
              </ul>
            </section>
            <details className="os-more os-panel">
              <summary>Milestones ({(milestones.data ?? []).length})</summary>
              <div className="os-stack">
                {(milestones.data ?? []).length ? (
                  <ul className="os-list">
                    {(milestones.data ?? []).map(m => (
                      <li key={m.id}>
                        <span className={m.completed_at ? "os-done" : undefined}>{m.title} <small className="os-muted">{formatDate(m.due_on)}</small></span>
                        {manages ? <ActionForm action={setMilestoneDone}><Hidden name="id" value={m.id} /><Hidden name="done" value={m.completed_at ? "false" : "true"} /><button className="os-link-btn" type="submit">{m.completed_at ? "Reopen" : "Done"}</button></ActionForm> : null}
                      </li>
                    ))}
                  </ul>
                ) : <p className="os-muted">None yet.</p>}
                {manages ? (
                  <ActionForm action={saveMilestone} className="os-stack" resetOnSuccess>
                    <Hidden name="project" value={id} />
                    <Field label="New milestone"><input name="title" required maxLength={160} /></Field>
                    <Field label="Date"><input name="due_on" type="date" required /></Field>
                    {me.is_president ? <Check name="core" label="Show on everyone's calendar" /> : null}
                    <div><SubmitButton variant="ghost">Add</SubmitButton></div>
                  </ActionForm>
                ) : null}
              </div>
            </details>
            <details className="os-more os-panel">
              <summary>SOPs used ({(sopRefs.data ?? []).length})</summary>
              <div className="os-stack">
                <ul className="os-list">
                  {(sopRefs.data ?? []).map(r => (
                    <li key={r.sop_version_id}>
                      <Link href={`/os/sops/${r.sop_versions?.sop_id}/versions/${r.sop_version_id}`}>{r.sop_versions?.sops?.title} v{r.sop_versions?.major}.{r.sop_versions?.minor}</Link>
                      {manages ? <ActionForm action={linkProjectSop}><Hidden name="project" value={id} /><Hidden name="version" value={r.sop_version_id} /><Hidden name="linked" value="false" /><button className="os-link-btn" type="submit">Unlink</button></ActionForm> : null}
                    </li>
                  ))}
                </ul>
                {manages && (publishedSops.data ?? []).length ? (
                  <ActionForm action={linkProjectSop} className="os-inline-form">
                    <Hidden name="project" value={id} />
                    <Field label="Link an SOP"><select name="version" required>{(publishedSops.data ?? []).map(s => <option key={s.id} value={s.current_version_id ?? ""}>{s.title}</option>)}</select></Field>
                    <SubmitButton variant="ghost">Link</SubmitButton>
                  </ActionForm>
                ) : null}
              </div>
            </details>
          </aside>
        </div>
      )}
    </div>
  );
}
