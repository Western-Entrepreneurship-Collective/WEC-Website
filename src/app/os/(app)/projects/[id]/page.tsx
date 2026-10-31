import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Kanban } from "@/components/os/Kanban";
import { MarkOnboarding } from "@/components/os/MarkOnboarding";
import { projectHealth } from "@/components/os/ProjectTable";
import { Avatar, Check, Due, Empty, Field, Hidden, Page, Panel, PeopleSelect, Pill, PriorityField, Progress, Status, Tabs } from "@/components/os/ui";
import { archiveProject, createTask, decideGlobal, saveMilestone, setMilestoneDone, setProjectPeople, setProjectStatus, submitGlobal, updateProject } from "@/lib/os/actions/work";
import { linkProjectSop } from "@/lib/os/actions/knowledge";
import { can, getDepartments, getDirectory, inDepartment, nameLookup, requireMe } from "@/lib/os/dal";
import { decisionLabel, formatDate, formatDateTime, label, projectKindHelp } from "@/lib/os/format";
import { createClient, rpc } from "@/lib/os/supabase";
import type { ProjectSummary } from "@/lib/os/types";

export const metadata: Metadata = { title: "Project" };

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
      <Page eyebrow={label(summary.kind)} title={summary.name} actions={<Pill value={summary.status} />}>
        <p className="os-note">You can see this project&apos;s progress, but its details belong to the teams working on it.</p>
        <Panel>
          <div className="os-list-side os-wide"><Progress value={summary.progress} /><strong>{summary.progress}%</strong></div>
          <dl className="os-dl">
            <div><dt>Team</dt><dd>{summary.department_name ?? "Organization"}</dd></div>
            <div><dt>Lead</dt><dd>{summary.lead_name ?? "Not set"}</dd></div>
            <div><dt>Due</dt><dd>{formatDate(summary.due_on)}</dd></div>
          </dl>
        </Panel>
      </Page>
    );
  }

  const [directory, departments] = await Promise.all([getDirectory(), getDepartments()]);
  const nameOf = nameLookup(directory);
  const [tasks, milestones, partDepts, parts, sopRefs, event, approvals, publishedSops] = await Promise.all([
    supabase.from("tasks").select("*").eq("project_id", id).order("due_at", { nullsFirst: false }),
    supabase.from("milestones").select("*").eq("project_id", id).order("due_on"),
    supabase.from("project_departments").select("department_id").eq("project_id", id),
    supabase.from("project_participants").select("executive_id").eq("project_id", id),
    supabase.from("project_sop_refs").select("sop_version_id, sop_versions(id, major, minor, sop_id, sops!sop_versions_sop_id_fkey(title))").eq("project_id", id),
    project.event_id ? supabase.from("events").select("id, name").eq("id", project.event_id).maybeSingle() : Promise.resolve({ data: null }),
    project.kind === "GLOBAL" ? supabase.from("approvals").select("*").eq("entity_type", "project").eq("entity_id", id).order("created_at") : Promise.resolve({ data: [] }),
    supabase.from("sops").select("id, title, current_version_id").not("current_version_id", "is", null).is("archived_at", null).order("title").limit(200),
  ]);
  const allTasks = tasks.data ?? [];
  const top = allTasks.filter(t => !t.parent_task_id);
  const archived = Boolean(project.archived_at);
  const manages = !archived && (me.is_president || project.lead_executive_id === me.id || me.positions.some(p => p.is_head && p.department_id === project.owning_department_id));
  const canAddTask = !archived && can(me, "task.create") && (manages || inDepartment(me, project.owning_department_id));
  const blockedOn = project.kind === "GLOBAL" && project.approval_status !== "approved";
  const canRequest = !archived && can(me, "request.create") && !blockedOn;

  const groups = [
    { key: "ready", title: "Ready now", tone: "info", tasks: top.filter(t => ["unassigned", "todo", "in_progress", "revisions_requested"].includes(t.status)) },
    { key: "review", title: "In review", tone: "warn", tasks: top.filter(t => t.status === "submitted") },
    { key: "stuck", title: "Blocked", tone: "bad", tasks: top.filter(t => t.status === "blocked" && !t.blocked_auto) },
    { key: "waiting", title: "Waiting on an earlier step", tone: "wait", tasks: top.filter(t => t.status === "blocked" && t.blocked_auto) },
    { key: "done", title: "Done", tone: "good", tasks: top.filter(t => t.status === "done") },
  ].filter(g => g.tasks.length);
  const tab = view === "board" || (view === "settings" && manages) ? view : "tasks";
  const health = summary ? projectHealth(summary) : null;
  const isHandover = project.system_key?.startsWith("handover:");
  const seeWho = project.kind === "INTERNAL" ? `${departments.find(d => d.id === project.owning_department_id)?.name} and the President` : project.visibility === "organization" ? "Every executive" : "The owning and participating teams";

  return (
    <div className="os-page">
      {isHandover && !me.onboarding?.handover_read ? <MarkOnboarding step="handover_read" /> : null}
      <nav className="os-crumbs" aria-label="Breadcrumb">
        <Link href="/os/projects">Projects</Link>
        {event.data ? <><span aria-hidden="true">/</span><Link href={`/os/events/${event.data.id}`}>{event.data.name}</Link></> : null}
      </nav>
      <header className="os-page-head">
        <div>
          <h1>{project.name}</h1>
          <p className="os-page-sub">{project.summary || `${label(project.kind)}. ${projectKindHelp[project.kind]}.`}</p>
        </div>
        <div className="os-head-progress">
          <div className="os-row os-between"><strong>{summary?.progress ?? 0}%</strong>{project.kind === "GLOBAL" && project.approval_status !== "approved" ? <Pill value={project.approval_status} /> : health ? <Status tone={health.tone}>{health.text}</Status> : null}</div>
          <Progress value={summary?.progress ?? 0} />
        </div>
      </header>
      {archived ? <p className="os-note">This project is archived. Everything here is read-only.</p> : null}
      {project.kind === "GLOBAL" && ["draft", "changes_requested"].includes(project.approval_status) && project.submitted_by === me.id ? (
        <ActionForm action={submitGlobal} className="os-row"><Hidden name="id" value={id} /><SubmitButton>Send to the President</SubmitButton></ActionForm>
      ) : null}
      {project.kind === "GLOBAL" && project.approval_status === "pending" && can(me, "global.approve") ? (
        <Panel title="Your decision">
          <ActionForm action={decideGlobal} className="os-stack">
            <Hidden name="id" value={id} />
            <Field label="Note"><textarea name="note" rows={2} /></Field>
            <div className="os-row os-wrap">
              <SubmitButton name="decision" value="approved">Approve and publish</SubmitButton>
              <SubmitButton name="decision" value="changes_requested" variant="ghost">Request changes</SubmitButton>
              <SubmitButton name="decision" value="rejected" variant="danger">Reject</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      ) : null}
      <Tabs current={tab} items={[
        { key: "tasks", href: `/os/projects/${id}`, label: "Tasks" },
        { key: "board", href: `/os/projects/${id}?view=board`, label: "Board" },
        ...(manages ? [{ key: "settings", href: `/os/projects/${id}?view=settings`, label: "Settings" }] : []),
      ]} />

      {tab === "board" ? (
        <Kanban cards={allTasks.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, assignee: nameOf(t.assigned_to), due: t.due_at ? formatDate(t.due_at) : undefined, is_cross_team: t.is_cross_team, requires_review: t.requires_review, updated_at: t.updated_at }))} />
      ) : null}

      {tab === "tasks" ? (
        <div className="os-split">
          <div className="os-stack-lg">
            {canAddTask ? (
              <ActionForm action={createTask} className="os-stack" resetOnSuccess ariaLabel="Add a task">
                <Hidden name="project" value={id} /><Hidden name="stay" value="1" />
                <Hidden name="responsible_department_id" value={project.owning_department_id} />
                <div className="os-inline-form">
                  <Field label="Add a task"><input name="title" required maxLength={200} placeholder="What needs doing?" /></Field>
                  <SubmitButton variant="ghost">Add</SubmitButton>
                </div>
                <details className="os-more">
                  <summary>More options</summary>
                  <div className="os-stack">
                    <div className="os-form-grid">
                      <PeopleSelect name="assigned_to" people={directory} label="Assign to" value={me.id} />
                      <Field label="Due"><input name="due_at" type="datetime-local" /></Field>
                      <PriorityField />
                      <Field label="Who can see this">
                        <select name="visibility" defaultValue="project"><option value="project">Everyone on the project</option><option value="team">The team</option><option value="restricted">Only the people on this task and the team&apos;s lead</option></select>
                      </Field>
                    </div>
                    <Field label="What's needed"><textarea name="description" rows={2} /></Field>
                    <Check name="requires_review" label="The person assigning this reviews it before it counts as done" />
                  </div>
                </details>
              </ActionForm>
            ) : null}
            {groups.length === 0 ? <Empty>No tasks you can see in this project yet.</Empty> : groups.map(g => (
              <section key={g.key} className={`os-group os-group-${g.tone}`} aria-label={g.title}>
                <h2><span aria-hidden="true" />{g.title}<em>{g.tasks.length}</em></h2>
                <ul>
                  {g.tasks.map(t => (
                    <li key={t.id}>
                      <Link href={`/os/tasks/${t.id}`}>{t.title}</Link>
                      <Avatar name={t.assigned_to ? nameOf(t.assigned_to) : null} />
                      {g.key === "done" ? <small className="os-muted">Finished</small> : g.key === "waiting" ? <small className="os-muted">Waiting</small> : <Due value={t.due_at} />}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {canRequest ? <p className="os-muted">Need another team? <Link className="os-link" href={`/os/requests/new?project=${id}`}>Send a cross-team request</Link>.</p> : null}
          </div>
          <aside className="os-panel os-facts">
            <dl className="os-facts-list">
              <div><dt>Lead</dt><dd><Avatar name={project.lead_executive_id ? nameOf(project.lead_executive_id) : null} />{nameOf(project.lead_executive_id)}</dd></div>
              {event.data ? <div><dt>Part of</dt><dd><Link className="os-link" href={`/os/events/${event.data.id}`}>{event.data.name}</Link></dd></div> : null}
              {project.due_on ? <div><dt>Wraps up</dt><dd>{formatDate(project.due_on)}</dd></div> : null}
              <div><dt>Who can see this</dt><dd>{seeWho}</dd></div>
              {(partDepts.data ?? []).length ? <div><dt>Teams involved</dt><dd>{(partDepts.data ?? []).map(d => departments.find(x => x.id === d.department_id)?.name).join(", ")}</dd></div> : null}
              {(parts.data ?? []).length ? <div><dt>People</dt><dd>{(parts.data ?? []).map(p => nameOf(p.executive_id)).join(", ")}</dd></div> : null}
            </dl>
            <div className="os-facts-block">
              <h3>Milestones</h3>
              {(milestones.data ?? []).length === 0 ? <p className="os-muted">None yet.</p> : (
                <ul className="os-list">
                  {(milestones.data ?? []).map(m => (
                    <li key={m.id}>
                      <span className={m.completed_at ? "os-done" : undefined}>{m.title} <small className="os-muted">{formatDate(m.due_on)}</small></span>
                      {manages ? <ActionForm action={setMilestoneDone}><Hidden name="id" value={m.id} /><Hidden name="done" value={m.completed_at ? "false" : "true"} /><button className="os-link-btn" type="submit">{m.completed_at ? "Reopen" : "Done"}</button></ActionForm> : null}
                    </li>
                  ))}
                </ul>
              )}
              {manages ? (
                <details className="os-more">
                  <summary>Add a milestone</summary>
                  <ActionForm action={saveMilestone} className="os-stack" resetOnSuccess>
                    <Hidden name="project" value={id} />
                    <Field label="New milestone"><input name="title" required maxLength={160} /></Field>
                    <Field label="Date"><input name="due_on" type="date" required /></Field>
                    {me.is_president ? <Check name="core" label="Show on the Core Calendar" /> : null}
                    <div><SubmitButton variant="ghost">Add</SubmitButton></div>
                  </ActionForm>
                </details>
              ) : null}
            </div>
            <div className="os-facts-block">
              <h3>SOPs used</h3>
              {(sopRefs.data ?? []).length === 0 ? <p className="os-muted">None linked.</p> : (
                <ul className="os-list">
                  {(sopRefs.data ?? []).map(r => (
                    <li key={r.sop_version_id}>
                      <Link href={`/os/sops/${r.sop_versions?.sop_id}/versions/${r.sop_version_id}`}>{r.sop_versions?.sops?.title} v{r.sop_versions?.major}.{r.sop_versions?.minor}</Link>
                      {manages ? <ActionForm action={linkProjectSop}><Hidden name="project" value={id} /><Hidden name="version" value={r.sop_version_id} /><Hidden name="linked" value="false" /><button className="os-link-btn" type="submit">Unlink</button></ActionForm> : null}
                    </li>
                  ))}
                </ul>
              )}
              {manages && (publishedSops.data ?? []).length ? (
                <details className="os-more">
                  <summary>Link an SOP</summary>
                  <ActionForm action={linkProjectSop} className="os-inline-form">
                    <Hidden name="project" value={id} />
                    <Field label="Current version of"><select name="version" required>{(publishedSops.data ?? []).map(s => <option key={s.id} value={s.current_version_id ?? ""}>{s.title}</option>)}</select></Field>
                    <SubmitButton variant="ghost">Link</SubmitButton>
                  </ActionForm>
                </details>
              ) : null}
            </div>
            {(approvals.data ?? []).length ? (
              <details className="os-more">
                <summary>Decision history</summary>
                <ul className="os-timeline">{(approvals.data ?? []).map(a => <li key={a.id}><span className="os-muted">{formatDateTime(a.created_at)}</span>{decisionLabel(a.decision)} by {nameOf(a.actor_id)}{a.note ? `: ${a.note}` : ""}</li>)}</ul>
              </details>
            ) : null}
          </aside>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="os-grid">
          <Panel title="Details">
            <ActionForm action={updateProject} className="os-stack">
              <Hidden name="id" value={id} /><Hidden name="expected" value={project.updated_at} />
              <Field label="Name"><input name="name" defaultValue={project.name} required maxLength={160} /></Field>
              <Field label="Summary"><textarea name="summary" rows={3} defaultValue={project.summary} /></Field>
              <PeopleSelect name="lead_executive_id" people={directory} label="Lead" value={project.lead_executive_id} />
              <div className="os-form-grid">
                <Field label="Starts"><input name="starts_on" type="date" defaultValue={project.starts_on ?? ""} /></Field>
                <Field label="Due" hint="Dates set by hand on tasks stay as they are."><input name="due_on" type="date" defaultValue={project.due_on ?? ""} /></Field>
              </div>
              {project.kind === "INTERNAL" && project.event_id ? <Check name="share_progress_with_event_lead" label="Share high-level progress with the event lead (never tasks)" defaultChecked={project.share_progress_with_event_lead} /> : null}
              {project.kind !== "INTERNAL" ? (
                <Field label="Who can open it"><select name="visibility" defaultValue={project.visibility}><option value="participants">The owning and participating teams</option><option value="organization">Every executive</option></select></Field>
              ) : null}
              <div><SubmitButton variant="ghost">Save</SubmitButton></div>
            </ActionForm>
          </Panel>
          <div className="os-stack-lg">
            <Panel title="Status">
              <div className="os-row os-wrap">
                {["planning", "active", "on_hold", "completed", "cancelled"].filter(s => s !== project.status).map(s => (
                  <ActionForm key={s} action={setProjectStatus}><Hidden name="id" value={id} /><Hidden name="status" value={s} /><SubmitButton variant="ghost">{label(s)}</SubmitButton></ActionForm>
                ))}
              </div>
              {["completed", "cancelled"].includes(project.status) ? (
                <ActionForm action={archiveProject} confirm="Archive this project? It becomes read-only, and nothing is deleted."><Hidden name="id" value={id} /><SubmitButton variant="ghost">Archive</SubmitButton></ActionForm>
              ) : null}
            </Panel>
            <Panel title="People">
              <ActionForm action={setProjectPeople} className="os-stack">
                <Hidden name="id" value={id} />
                {project.kind !== "INTERNAL" ? (
                  <fieldset className="os-fieldset"><legend>Teams involved</legend><div className="os-check-grid">{departments.map(d => <label key={d.id} className="os-check"><input type="checkbox" name="departments" value={d.id} defaultChecked={(partDepts.data ?? []).some(x => x.department_id === d.id)} /><span>{d.name}</span></label>)}</div></fieldset>
                ) : null}
                <fieldset className="os-fieldset"><legend>People</legend><div className="os-check-grid">{directory.filter(p => p.status === "active").map(p => <label key={p.id} className="os-check"><input type="checkbox" name="participants" value={p.id} defaultChecked={(parts.data ?? []).some(x => x.executive_id === p.id)} /><span>{p.preferred_name || p.full_name}</span></label>)}</div></fieldset>
                <div><SubmitButton variant="ghost">Save people</SubmitButton></div>
              </ActionForm>
            </Panel>
          </div>
        </div>
      ) : null}
    </div>
  );
}
