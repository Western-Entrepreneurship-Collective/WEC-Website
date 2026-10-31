import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Upload } from "@/components/os/Upload";
import { DueDate, Empty, Field, Hidden, Page, Panel, PeopleSelect, Pill, PriorityField, TaskTable } from "@/components/os/ui";
import {
  addComment, addDependency, assignTask, clarifyRequest, createTask, decideDeadline, delegateRequest, deleteChecklistItem, proposeDeadline, removeDependency,
  respondToRequest, reviewDeliverable, saveChecklistItem, setTaskStatus, submitDeliverable, updateTask,
} from "@/lib/os/actions/work";
import { getDirectory, inDepartment, nameLookup, requireMe } from "@/lib/os/dal";
import { formatDateTime, label, toLocalInput } from "@/lib/os/format";
import { createClient, rpc } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "Task" };

type Context = { project_id: string; project_name: string; project_kind: string; can_open_project: boolean; event_id: string | null; requesting_department: string; responsible_department: string };
type Dep = { task_id: string; title: string; status: string; can_open: boolean; direction: "blocked_by" | "blocks" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: task } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (!task) notFound();

  const directory = await getDirectory();
  const nameOf = nameLookup(directory);
  const [context, deps, subtasks, checklist, comments, reviews, proposals, attachments, history, assignments, project, siblings] = await Promise.all([
    rpc<Context[]>("task_context", { p_task: id }),
    rpc<Dep[]>("task_dependencies", { p_task: id }),
    supabase.from("tasks").select("*").eq("parent_task_id", id).order("due_at", { nullsFirst: false }),
    supabase.from("task_checklist_items").select("*").eq("task_id", id).order("position"),
    supabase.from("task_comments").select("*").eq("task_id", id).order("created_at"),
    supabase.from("task_review_events").select("*").eq("task_id", id).order("created_at"),
    supabase.from("deadline_proposals").select("*").eq("task_id", id).order("created_at", { ascending: false }),
    supabase.from("attachments").select("*").eq("entity_type", "task").eq("entity_id", id).order("created_at"),
    supabase.from("task_assignment_history").select("*").eq("task_id", id).order("created_at"),
    supabase.from("position_assignments").select("executive_id, positions!inner(department_id)").eq("positions.department_id", task.responsible_department_id),
    supabase.from("projects").select("archived_at").eq("id", task.project_id).maybeSingle(),
    supabase.from("tasks").select("id, title").eq("project_id", task.project_id).neq("id", id).not("status", "eq", "cancelled").order("title").limit(200),
  ]);
  const ctx = context[0];
  const team = directory.filter(p => new Set((assignments.data ?? []).map(a => a.executive_id)).has(p.id));
  const archived = Boolean(project.data?.archived_at);

  const responsibleHead = me.is_president || me.positions.some(p => p.is_head && p.department_id === task.responsible_department_id);
  const inRequesting = inDepartment(me, task.requesting_department_id);
  const inResponsible = inDepartment(me, task.responsible_department_id);
  const open = !["done", "cancelled"].includes(task.status);
  const canEdit = !archived && (me.is_president || task.assigned_to === me.id || task.assigned_by === me.id || responsibleHead);
  const openProposal = (proposals.data ?? []).find(p => p.state === "open");
  const canReview = task.status === "submitted" && (me.is_president || (task.is_cross_team ? (task.created_by === me.id || me.positions.some(p => p.is_head && p.department_id === task.requesting_department_id)) : (task.assigned_by === me.id || responsibleHead)));

  return (
    <Page
      eyebrow={ctx ? `${label(ctx.project_kind)} · ${ctx.project_name}` : undefined}
      title={task.title}
      actions={<><Pill value={task.request_state && task.request_state !== "accepted" ? task.request_state : task.status} /><Pill value={task.priority} /></>}
    >
      {archived ? <p className="os-note">This project is archived. Everything here is read-only.</p> : null}
      {task.due_was_clamped ? <p className="os-note">This date had already passed when the task was generated, so it was set to the day of generation.</p> : null}

      {task.is_cross_team && !archived ? (
        <Panel title="Cross-team request">
          <p className="os-muted">From {ctx?.requesting_department} to {ctx?.responsible_department}. Both teams see this same record and its status.</p>
          {responsibleHead && task.request_state && ["pending", "clarification_requested"].includes(task.request_state) ? (
            <div className="os-stack">
              <ActionForm action={respondToRequest} className="os-inline-form" ariaLabel="Accept the request">
                <Hidden name="id" value={id} /><Hidden name="action" value="accept" />
                <PeopleSelect name="delegate" people={team} label="Delegate to" blank="Decide later" />
                <SubmitButton>Accept</SubmitButton>
              </ActionForm>
              <ActionForm action={respondToRequest} className="os-inline-form" ariaLabel="Ask for clarification">
                <Hidden name="id" value={id} /><Hidden name="action" value="clarify" />
                <Field label="Ask for clarification"><input name="note" required /></Field>
                <SubmitButton variant="ghost">Ask</SubmitButton>
              </ActionForm>
              <ActionForm action={respondToRequest} className="os-inline-form" ariaLabel="Decline the request" confirm="Decline this request? The requesting team will be told.">
                <Hidden name="id" value={id} /><Hidden name="action" value="decline" />
                <Field label="Reason for declining"><input name="note" required /></Field>
                <SubmitButton variant="danger">Decline</SubmitButton>
              </ActionForm>
            </div>
          ) : null}
          {task.request_state === "clarification_requested" && inRequesting ? (
            <ActionForm action={clarifyRequest} className="os-inline-form">
              <Hidden name="id" value={id} />
              <Field label="Your answer"><input name="note" required /></Field>
              <SubmitButton>Send answer</SubmitButton>
            </ActionForm>
          ) : null}
          {task.request_state === "accepted" && responsibleHead && open ? (
            <ActionForm action={delegateRequest} className="os-inline-form">
              <Hidden name="id" value={id} />
              <PeopleSelect name="delegate" people={team} label="Delegate to" value={task.assigned_to} blank={null} />
              <SubmitButton variant="ghost">Delegate</SubmitButton>
            </ActionForm>
          ) : null}
        </Panel>
      ) : null}

      {canReview && !archived ? (
        <Panel title="Review the deliverable">
          <div className="os-stack">
            <ActionForm action={reviewDeliverable} className="os-inline-form">
              <Hidden name="id" value={id} /><Hidden name="accept" value="true" />
              <SubmitButton>Accept deliverable</SubmitButton>
            </ActionForm>
            <ActionForm action={reviewDeliverable} className="os-inline-form">
              <Hidden name="id" value={id} /><Hidden name="accept" value="false" />
              <Field label="What needs revising"><input name="note" required /></Field>
              <SubmitButton variant="ghost">Request revisions</SubmitButton>
            </ActionForm>
          </div>
        </Panel>
      ) : null}

      <div className="os-split">
        <div className="os-stack-lg">
          <Panel title="Details">
            <dl className="os-dl">
              <div><dt>Project</dt><dd>{ctx?.can_open_project ? <Link className="os-link" href={`/os/projects/${ctx.project_id}`}>{ctx.project_name}</Link> : ctx?.project_name}</dd></div>
              {task.parent_task_id ? <div><dt>Subtask of</dt><dd><Link className="os-link" href={`/os/tasks/${task.parent_task_id}`}>Parent task</Link></dd></div> : null}
              <div><dt>Assigned to</dt><dd>{nameOf(task.assigned_to)}</dd></div>
              <div><dt>Assigned by</dt><dd>{task.assigned_by ? nameOf(task.assigned_by) : "Generated automatically"}</dd></div>
              <div><dt>Requesting team</dt><dd>{ctx?.requesting_department}</dd></div>
              <div><dt>Responsible team</dt><dd>{ctx?.responsible_department}</dd></div>
              <div><dt>Due</dt><dd><DueDate value={task.due_at} status={task.status} /></dd></div>
              <div><dt>Visibility</dt><dd>{task.visibility === "project" ? "Everyone on the project" : task.visibility === "team" ? "The team" : "Restricted"}</dd></div>
              <div><dt>Created</dt><dd>{formatDateTime(task.created_at)}</dd></div>
              <div><dt>Last changed</dt><dd>{formatDateTime(task.updated_at)}</dd></div>
            </dl>
            {task.description ? <><h3>Description</h3><p className="os-pre">{task.description}</p></> : null}
            {task.deliverables ? <><h3>Deliverables</h3><p className="os-pre">{task.deliverables}</p></> : null}
          </Panel>

          <Panel title="Subtasks">
            <TaskTable tasks={subtasks.data ?? []} nameOf={nameOf} empty="No subtasks." />
            {canEdit && open ? (
              <ActionForm action={createTask} className="os-inline-form" resetOnSuccess ariaLabel="Add a subtask">
                <Hidden name="project" value={task.project_id} /><Hidden name="parent_task_id" value={id} /><Hidden name="stay" value="1" />
                <Hidden name="assigned_to" value={task.assigned_to} /><Hidden name="visibility" value={task.visibility === "restricted" ? "restricted" : "team"} />
                <Hidden name="due_at" value={toLocalInput(task.due_at)} />
                <Field label="New subtask"><input name="title" required maxLength={200} /></Field>
                <SubmitButton variant="ghost">Add</SubmitButton>
              </ActionForm>
            ) : null}
          </Panel>

          <Panel title="Checklist">
            {(checklist.data ?? []).length === 0 ? <Empty>No checklist.</Empty> : (
              <ul className="os-checklist">
                {(checklist.data ?? []).map(item => (
                  <li key={item.id}>
                    <ActionForm action={saveChecklistItem} className="os-row">
                      <Hidden name="item" value={item.id} /><Hidden name="id" value={id} /><Hidden name="label" value={item.label} />
                      <Hidden name="is_done" value={item.is_done ? "false" : "true"} />
                      <button className="os-tick" type="submit" disabled={!canEdit} aria-pressed={item.is_done} aria-label={`${item.is_done ? "Untick" : "Tick"} ${item.label}`}>{item.is_done ? "✓" : ""}</button>
                      <span className={item.is_done ? "os-done" : undefined}>{item.label}</span>
                    </ActionForm>
                    {canEdit ? <ActionForm action={deleteChecklistItem}><Hidden name="item" value={item.id} /><button className="os-link-btn" type="submit" aria-label={`Remove ${item.label}`}>Remove</button></ActionForm> : null}
                  </li>
                ))}
              </ul>
            )}
            {canEdit ? (
              <ActionForm action={saveChecklistItem} className="os-inline-form" resetOnSuccess ariaLabel="Add a checklist item">
                <Hidden name="id" value={id} />
                <Field label="New item"><input name="label" required maxLength={300} /></Field>
                <SubmitButton variant="ghost">Add</SubmitButton>
              </ActionForm>
            ) : null}
          </Panel>

          <Panel title="Comments">
            {(comments.data ?? []).length === 0 ? <Empty>No comments yet.</Empty> : (
              <ul className="os-comments">
                {(comments.data ?? []).map(c => <li key={c.id}><p className="os-muted">{nameOf(c.author_id)} · {formatDateTime(c.created_at)}</p><p className="os-pre">{c.body}</p></li>)}
              </ul>
            )}
            {!archived ? (
              <ActionForm action={addComment} className="os-stack" resetOnSuccess ariaLabel="Add a comment">
                <Hidden name="id" value={id} />
                {task.is_cross_team ? <small className="os-muted">Both teams can read comments on this request.</small> : null}
                <Field label="Comment"><textarea name="body" rows={3} required maxLength={8000} /></Field>
                <div><SubmitButton variant="ghost">Post</SubmitButton></div>
              </ActionForm>
            ) : null}
          </Panel>
        </div>

        <div className="os-stack-lg">
          {canEdit && open && task.status !== "unassigned" ? (
            <Panel title="Status">
              <div className="os-row os-wrap">
                {["todo", "in_progress", "blocked"].filter(s => s !== task.status).map(s => (
                  <ActionForm key={s} action={setTaskStatus}><Hidden name="id" value={id} /><Hidden name="status" value={s} /><Hidden name="expected" value={task.updated_at} /><SubmitButton variant="ghost">{label(s)}</SubmitButton></ActionForm>
                ))}
                {!task.requires_review ? <ActionForm action={setTaskStatus}><Hidden name="id" value={id} /><Hidden name="status" value="done" /><Hidden name="expected" value={task.updated_at} /><SubmitButton>Mark done</SubmitButton></ActionForm> : null}
              </div>
              {["todo", "in_progress", "revisions_requested"].includes(task.status) ? (
                <ActionForm action={submitDeliverable} className="os-stack">
                  <Hidden name="id" value={id} />
                  <Field label="Note with the deliverable"><input name="note" /></Field>
                  <div><SubmitButton variant={task.requires_review ? "primary" : "ghost"}>Submit for review</SubmitButton></div>
                </ActionForm>
              ) : null}
              {(!task.is_cross_team || inRequesting || me.is_president) ? (
                <ActionForm action={setTaskStatus} confirm="Cancel this task? It stays on record but no longer counts as open.">
                  <Hidden name="id" value={id} /><Hidden name="status" value="cancelled" />
                  <button className="os-link-btn" type="submit">{task.is_cross_team ? "Withdraw this request" : "Cancel this task"}</button>
                </ActionForm>
              ) : null}
            </Panel>
          ) : null}

          {!task.is_cross_team && open && !archived && (canEdit || (task.assigned_to === null && inResponsible)) ? (
            <Panel title="Assign">
              <ActionForm action={assignTask} className="os-inline-form">
                <Hidden name="id" value={id} />
                <PeopleSelect name="assignee" people={directory.filter(p => team.some(t => t.id === p.id) || p.id === me.id)} label="Assign to" value={task.assigned_to} />
                <SubmitButton variant="ghost">Assign</SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}

          {(inRequesting || inResponsible || me.is_president) && !archived && open ? (
            <Panel title="Deadline">
              {openProposal ? (
                <>
                  <p>{nameOf(openProposal.proposed_by)} proposed <strong>{formatDateTime(openProposal.proposed_due_at)}</strong>{openProposal.note ? `: ${openProposal.note}` : "."}</p>
                  {openProposal.proposed_by !== me.id || me.is_president ? (
                    <div className="os-row">
                      <ActionForm action={decideDeadline}><Hidden name="proposal" value={openProposal.id} /><Hidden name="accept" value="true" /><SubmitButton>Agree</SubmitButton></ActionForm>
                      <ActionForm action={decideDeadline}><Hidden name="proposal" value={openProposal.id} /><Hidden name="accept" value="false" /><SubmitButton variant="ghost">Decline</SubmitButton></ActionForm>
                    </div>
                  ) : <p className="os-muted">Waiting for the other side to answer.</p>}
                </>
              ) : (
                <ActionForm action={proposeDeadline} className="os-stack" resetOnSuccess>
                  <Hidden name="id" value={id} />
                  <Field label="Propose a new date"><input name="due" type="datetime-local" required /></Field>
                  <Field label="Why"><input name="note" /></Field>
                  <div><SubmitButton variant="ghost">Propose</SubmitButton></div>
                </ActionForm>
              )}
            </Panel>
          ) : null}

          <Panel title="Dependencies">
            {deps.length === 0 ? <Empty>None.</Empty> : (
              <ul className="os-list">
                {deps.map(d => (
                  <li key={d.task_id + d.direction}>
                    <span>{d.direction === "blocked_by" ? "Waiting on " : "Blocks "}{d.can_open ? <Link href={`/os/tasks/${d.task_id}`}>{d.title}</Link> : d.title} <Pill value={d.status} /></span>
                    {canEdit && d.direction === "blocked_by" ? <ActionForm action={removeDependency}><Hidden name="id" value={id} /><Hidden name="depends_on" value={d.task_id} /><button className="os-link-btn" type="submit">Remove</button></ActionForm> : null}
                  </li>
                ))}
              </ul>
            )}
            {canEdit && open ? (
              <ActionForm action={addDependency} className="os-inline-form" resetOnSuccess>
                <Hidden name="id" value={id} />
                <Field label="Waits on">
                  <select name="depends_on" required defaultValue="">
                    <option value="" disabled>Choose a task</option>
                    {(siblings.data ?? []).filter(t => !deps.some(d => d.task_id === t.id)).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </Field>
                <SubmitButton variant="ghost">Add</SubmitButton>
              </ActionForm>
            ) : null}
          </Panel>

          <Panel title="Files">
            {(attachments.data ?? []).length === 0 ? <Empty>No files.</Empty> : (
              <ul className="os-list">
                {(attachments.data ?? []).map(a => <li key={a.id}><a className="os-link" href={`/os/attachments/${a.id}`}>{a.file_name}</a><span className="os-muted">{Math.ceil(a.size_bytes / 1024)} KB</span></li>)}
              </ul>
            )}
            {canEdit ? <Upload type="task" entity={id} /> : null}
          </Panel>

          <Panel title="History">
            <ul className="os-timeline">
              {[...(reviews.data ?? []).map(r => ({ at: r.created_at, text: `${label(r.kind)} by ${nameOf(r.actor_id)}${r.note ? `: ${r.note}` : ""}`, key: r.id })),
                ...(history.data ?? []).map(h => ({ at: h.created_at, text: `${h.note || "Assigned"}: ${nameOf(h.assigned_to)}`, key: `h${h.id}` }))]
                .sort((a, b) => a.at.localeCompare(b.at))
                .map(h => <li key={h.key}><span className="os-muted">{formatDateTime(h.at)}</span>{h.text}</li>)}
            </ul>
          </Panel>

          {canEdit ? (
            <Panel title="Edit">
              <ActionForm action={updateTask} className="os-stack">
                <Hidden name="id" value={id} /><Hidden name="expected" value={task.updated_at} />
                <Field label="Title"><input name="title" defaultValue={task.title} required maxLength={200} /></Field>
                <Field label="Description"><textarea name="description" rows={4} defaultValue={task.description} /></Field>
                <Field label="Deliverables"><textarea name="deliverables" rows={3} defaultValue={task.deliverables} /></Field>
                <PriorityField value={task.priority} />
                {task.is_cross_team ? <Hidden name="due_at" value={toLocalInput(task.due_at)} /> : <Field label="Due" hint={task.due_source === "template" ? "Changing this protects it from automatic rescheduling." : undefined}><input name="due_at" type="datetime-local" defaultValue={toLocalInput(task.due_at)} /></Field>}
                {!task.is_cross_team ? (
                  <Field label="Visibility">
                    <select name="visibility" defaultValue={task.visibility}>
                      <option value="project">Everyone on the project</option><option value="team">The team</option><option value="restricted">Restricted</option>
                    </select>
                  </Field>
                ) : null}
                <div><SubmitButton variant="ghost">Save</SubmitButton></div>
              </ActionForm>
            </Panel>
          ) : null}
        </div>
      </div>
    </Page>
  );
}
