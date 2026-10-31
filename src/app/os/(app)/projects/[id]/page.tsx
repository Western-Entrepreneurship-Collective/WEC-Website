import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Kanban } from "@/components/os/Kanban";
import { Check, Empty, Field, Hidden, Page, Panel, PeopleSelect, Pill, PriorityField, Progress, Tabs, TaskTable } from "@/components/os/ui";
import { archiveProject, createTask, decideGlobal, saveMilestone, setMilestoneDone, setProjectPeople, setProjectStatus, submitGlobal, updateProject } from "@/lib/os/actions/work";
import { linkProjectSop } from "@/lib/os/actions/knowledge";
import { can, getDepartments, getDirectory, inDepartment, nameLookup, requireMe } from "@/lib/os/dal";
import { formatDate, formatDateTime, label } from "@/lib/os/format";
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

  return (
    <Page
      eyebrow={label(project.kind)}
      title={project.name}
      actions={<><Pill value={project.status} />{project.kind === "GLOBAL" ? <Pill value={project.approval_status} /> : null}</>}
    >
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

      <div className="os-split">
        <div className="os-stack-lg">
          <Panel>
            <div className="os-list-side os-wide"><Progress value={summary?.progress ?? 0} /><strong>{summary?.progress ?? 0}%</strong></div>
            {project.summary ? <p className="os-pre">{project.summary}</p> : null}
          </Panel>
          <Tabs current={view === "board" ? "board" : "list"} items={[{ key: "list", href: `/os/projects/${id}`, label: "List" }, { key: "board", href: `/os/projects/${id}?view=board`, label: "Board" }]} />
          {view === "board" ? (
            <Kanban cards={allTasks.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, assignee: nameOf(t.assigned_to), due: t.due_at ? formatDate(t.due_at) : undefined, is_cross_team: t.is_cross_team, requires_review: t.requires_review, updated_at: t.updated_at }))} />
          ) : (
            <Panel title={`Tasks (${top.length})`}>
              <TaskTable tasks={top} nameOf={nameOf} empty="No tasks you can see in this project yet." />
            </Panel>
          )}
          {canAddTask ? (
            <Panel title="Add a task">
              <ActionForm action={createTask} className="os-stack" resetOnSuccess>
                <Hidden name="project" value={id} /><Hidden name="stay" value="1" />
                <Hidden name="responsible_department_id" value={project.owning_department_id} />
                <div className="os-form-grid">
                  <Field label="Title"><input name="title" required maxLength={200} /></Field>
                  <PeopleSelect name="assigned_to" people={directory} label="Assign to" value={me.id} />
                  <Field label="Due"><input name="due_at" type="datetime-local" /></Field>
                  <PriorityField />
                  <Field label="Visibility">
                    <select name="visibility" defaultValue="project"><option value="project">Everyone on the project</option><option value="team">The team</option><option value="restricted">Restricted</option></select>
                  </Field>
                </div>
                <Field label="Description and deliverables"><textarea name="description" rows={2} /></Field>
                <Check name="requires_review" label="The assigner reviews this before it counts as done" />
                <div><SubmitButton variant="ghost">Add task</SubmitButton></div>
              </ActionForm>
              {canRequest ? <p><Link className="os-link" href={`/os/requests/new?project=${id}`}>Need another team? Send a cross-team request.</Link></p> : null}
            </Panel>
          ) : null}
        </div>

        <div className="os-stack-lg">
          <Panel title="Details">
            <dl className="os-dl">
              {event.data ? <div><dt>Event</dt><dd><Link className="os-link" href={`/os/events/${event.data.id}`}>{event.data.name}</Link></dd></div> : null}
              <div><dt>Owning team</dt><dd>{departments.find(d => d.id === project.owning_department_id)?.name ?? "Organization"}</dd></div>
              <div><dt>Lead</dt><dd>{nameOf(project.lead_executive_id)}</dd></div>
              <div><dt>Starts</dt><dd>{formatDate(project.starts_on)}</dd></div>
              <div><dt>Due</dt><dd>{formatDate(project.due_on)}</dd></div>
              <div><dt>Participating</dt><dd>{(partDepts.data ?? []).map(d => departments.find(x => x.id === d.department_id)?.name).join(", ") || "None"}</dd></div>
              <div><dt>People</dt><dd>{(parts.data ?? []).map(p => nameOf(p.executive_id)).join(", ") || "None added"}</dd></div>
              {project.template_version_id ? <div><dt>From template</dt><dd>Yes, version on record</dd></div> : null}
            </dl>
          </Panel>

          <Panel title="Milestones">
            {(milestones.data ?? []).length === 0 ? <Empty>None.</Empty> : (
              <ul className="os-list">
                {(milestones.data ?? []).map(m => (
                  <li key={m.id}>
                    <span className={m.completed_at ? "os-done" : undefined}>{m.title} <span className="os-muted">{formatDate(m.due_on)}</span></span>
                    {manages ? <ActionForm action={setMilestoneDone}><Hidden name="id" value={m.id} /><Hidden name="done" value={m.completed_at ? "false" : "true"} /><button className="os-link-btn" type="submit">{m.completed_at ? "Reopen" : "Done"}</button></ActionForm> : null}
                  </li>
                ))}
              </ul>
            )}
            {manages ? (
              <ActionForm action={saveMilestone} className="os-stack" resetOnSuccess>
                <Hidden name="project" value={id} />
                <Field label="New milestone"><input name="title" required maxLength={160} /></Field>
                <Field label="Date"><input name="due_on" type="date" required /></Field>
                {me.is_president ? <Check name="core" label="Show on the Core Calendar" /> : null}
                <div><SubmitButton variant="ghost">Add</SubmitButton></div>
              </ActionForm>
            ) : null}
          </Panel>

          <Panel title="SOPs used">
            {(sopRefs.data ?? []).length === 0 ? <Empty>None linked.</Empty> : (
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
              <ActionForm action={linkProjectSop} className="os-inline-form">
                <Hidden name="project" value={id} />
                <Field label="Link current version of"><select name="version" required>{(publishedSops.data ?? []).map(s => <option key={s.id} value={s.current_version_id ?? ""}>{s.title}</option>)}</select></Field>
                <SubmitButton variant="ghost">Link</SubmitButton>
              </ActionForm>
            ) : null}
          </Panel>

          {manages ? (
            <Panel title="Manage">
              <div className="os-row os-wrap">
                {["planning", "active", "on_hold", "completed", "cancelled"].filter(s => s !== project.status).map(s => (
                  <ActionForm key={s} action={setProjectStatus}><Hidden name="id" value={id} /><Hidden name="status" value={s} /><SubmitButton variant="ghost">{label(s)}</SubmitButton></ActionForm>
                ))}
              </div>
              <ActionForm action={updateProject} className="os-stack">
                <Hidden name="id" value={id} /><Hidden name="expected" value={project.updated_at} />
                <Field label="Name"><input name="name" defaultValue={project.name} required maxLength={160} /></Field>
                <Field label="Summary"><textarea name="summary" rows={3} defaultValue={project.summary} /></Field>
                <PeopleSelect name="lead_executive_id" people={directory} label="Lead" value={project.lead_executive_id} />
                <Field label="Starts"><input name="starts_on" type="date" defaultValue={project.starts_on ?? ""} /></Field>
                <Field label="Due" hint="Dates set by hand on tasks stay as they are."><input name="due_on" type="date" defaultValue={project.due_on ?? ""} /></Field>
                {project.kind === "INTERNAL" && project.event_id ? <Check name="share_progress_with_event_lead" label="Share high-level progress with the event lead (never tasks)" defaultChecked={project.share_progress_with_event_lead} /> : null}
                {project.kind !== "INTERNAL" ? (
                  <Field label="Who can open it"><select name="visibility" defaultValue={project.visibility}><option value="participants">The owning and participating teams</option><option value="organization">Every executive</option></select></Field>
                ) : null}
                <div><SubmitButton variant="ghost">Save</SubmitButton></div>
              </ActionForm>
              <ActionForm action={setProjectPeople} className="os-stack">
                <Hidden name="id" value={id} />
                {project.kind !== "INTERNAL" ? (
                  <fieldset className="os-fieldset"><legend>Participating teams</legend><div className="os-check-grid">{departments.map(d => <label key={d.id} className="os-check"><input type="checkbox" name="departments" value={d.id} defaultChecked={(partDepts.data ?? []).some(x => x.department_id === d.id)} /><span>{d.name}</span></label>)}</div></fieldset>
                ) : null}
                <fieldset className="os-fieldset"><legend>People</legend><div className="os-check-grid">{directory.filter(p => p.status === "active").map(p => <label key={p.id} className="os-check"><input type="checkbox" name="participants" value={p.id} defaultChecked={(parts.data ?? []).some(x => x.executive_id === p.id)} /><span>{p.preferred_name || p.full_name}</span></label>)}</div></fieldset>
                <div><SubmitButton variant="ghost">Save people</SubmitButton></div>
              </ActionForm>
              {["completed", "cancelled"].includes(project.status) ? (
                <ActionForm action={archiveProject} confirm="Archive this project? It becomes read-only, and nothing is deleted."><Hidden name="id" value={id} /><SubmitButton variant="ghost">Archive</SubmitButton></ActionForm>
              ) : null}
            </Panel>
          ) : null}

          {(approvals.data ?? []).length ? (
            <Panel title="Decision history">
              <ul className="os-timeline">{(approvals.data ?? []).map(a => <li key={a.id}><span className="os-muted">{formatDateTime(a.created_at)}</span>{label(a.decision)} by {nameOf(a.actor_id)}{a.note ? `: ${a.note}` : ""}</li>)}</ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </Page>
  );
}
