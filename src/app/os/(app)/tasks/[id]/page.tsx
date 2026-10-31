import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { MarkOnboarding } from "@/components/os/MarkOnboarding";
import { Upload } from "@/components/os/Upload";
import { Avatar, Due, Empty, Field, Hidden, Panel, PeopleSelect, Pill, PriorityField, Section, TaskTable } from "@/components/os/ui";
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

const VISIBILITY: Record<string, string> = { project: "Everyone on the project", team: "The team", restricted: "Only the people on this task and the team's lead" };

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
  const teamIds = new Set((assignments.data ?? []).map(a => a.executive_id));
  const team = directory.filter(p => teamIds.has(p.id));
  const archived = Boolean(project.data?.archived_at);

  const responsibleHead = me.is_president || me.positions.some(p => p.is_head && p.department_id === task.responsible_department_id);
  const inRequesting = inDepartment(me, task.requesting_department_id);
  const inResponsible = inDepartment(me, task.responsible_department_id);
  const open = !["done", "cancelled"].includes(task.status);
  const canEdit = !archived && (me.is_president || task.assigned_to === me.id || task.assigned_by === me.id || responsibleHead);
  const canWork = canEdit && (!task.is_cross_team || task.assigned_to === me.id || responsibleHead);
  const openProposal = (proposals.data ?? []).find(p => p.state === "open");
  const canReview = !archived && task.status === "submitted" && (me.is_president || (task.is_cross_team
    ? task.created_by === me.id || me.positions.some(p => p.is_head && p.department_id === task.requesting_department_id)
    : (task.assigned_by === me.id && task.assigned_to !== me.id) || responsibleHead));
  const waiting = task.status === "blocked" && task.blocked_auto;
  const statusShown = task.request_state && task.request_state !== "accepted" ? task.request_state : waiting ? "waiting" : task.status;
  const reviewer = task.is_cross_team ? "the team that asked for this" : task.assigned_by ? nameOf(task.assigned_by) : "the team's lead";
  const canSubmit = canWork && ["todo", "in_progress", "revisions_requested"].includes(task.status);
  const allDone = (checklist.data ?? []).length > 0 && (checklist.data ?? []).every(c => c.is_done);

  const next = archived ? "This project is archived, so this task is read-only."
    : task.status === "done" ? (task.reviewed_at ? `Accepted by ${nameOf(task.reviewed_by)}.` : "This is finished.")
    : task.status === "cancelled" ? "This was cancelled. It stays on record."
    : task.request_state === "pending" ? (responsibleHead ? "Your team was asked for this. Accept it, ask a question, or decline." : "Waiting for the other team's lead to answer.")
    : task.request_state === "clarification_requested" ? (inRequesting ? "The other team has a question. Answer it below." : "Waiting for the requesting team to answer your question.")
    : task.status === "unassigned" ? "Nobody has this yet. Choose who does it."
    : waiting ? "This can't start until the tasks listed under \"Can't start until\" are finished."
    : task.status === "submitted" ? (canReview ? "Handed in and waiting for you. Accept it or ask for changes." : `Handed in. Waiting for ${reviewer} to accept it.`)
    : task.status === "revisions_requested" ? "Changes were requested. Make them, then submit it again."
    : task.requires_review ? `${allDone ? "Everything's ticked off, so submit it." : "Finish the work, then submit it."} ${reviewer[0].toUpperCase() + reviewer.slice(1)} reviews it before it counts as done.`
    : "Mark it done when it's finished. Your work doesn't need a review.";

  return (
    <div className="os-page">
      {canEdit || task.assigned_to === me.id ? (me.onboarding?.task_opened ? null : <MarkOnboarding step="task_opened" />) : null}
      <nav className="os-crumbs" aria-label="Breadcrumb">
        {ctx?.can_open_project ? <Link href={`/os/projects/${ctx.project_id}`}>{ctx.project_name}</Link> : <span>{ctx?.project_name}</span>}
        {task.parent_task_id ? <><span aria-hidden="true">/</span><Link href={`/os/tasks/${task.parent_task_id}`}>Parent task</Link></> : null}
      </nav>

      <header className="os-page-head">
        <div>
          <h1>{task.title}</h1>
          <div className="os-row os-wrap os-head-meta"><Pill value={statusShown} />{open ? <Due value={task.due_at} /> : null}{task.priority !== "normal" ? <Pill value={task.priority} /> : null}{task.is_cross_team ? <span className="os-tag">Cross-team</span> : null}</div>
        </div>
        {canWork && open && task.status !== "unassigned" ? (
          <div className="os-row os-wrap os-head-actions">
            {task.status === "todo" ? <ActionForm action={setTaskStatus}><Hidden name="id" value={id} /><Hidden name="status" value="in_progress" /><Hidden name="expected" value={task.updated_at} /><SubmitButton variant="ghost">Start</SubmitButton></ActionForm> : null}
            {task.status === "blocked" && !waiting ? <ActionForm action={setTaskStatus}><Hidden name="id" value={id} /><Hidden name="status" value="in_progress" /><Hidden name="expected" value={task.updated_at} /><SubmitButton variant="ghost">No longer blocked</SubmitButton></ActionForm> : null}
            {["todo", "in_progress"].includes(task.status) ? <ActionForm action={setTaskStatus}><Hidden name="id" value={id} /><Hidden name="status" value="blocked" /><Hidden name="expected" value={task.updated_at} /><SubmitButton variant="ghost">I&apos;m blocked</SubmitButton></ActionForm> : null}
            {!task.requires_review && task.status !== "blocked" ? <ActionForm action={setTaskStatus}><Hidden name="id" value={id} /><Hidden name="status" value="done" /><Hidden name="expected" value={task.updated_at} /><SubmitButton>Mark done</SubmitButton></ActionForm> : null}
          </div>
        ) : null}
      </header>

      <p className="os-next"><strong>What happens next:</strong> {next}</p>

      {task.is_cross_team && !archived && open ? (
        <>
          {responsibleHead && task.request_state && ["pending", "clarification_requested"].includes(task.request_state) ? (
            <Panel title={`${ctx?.requesting_department} is asking your team for this`}>
              <div className="os-stack">
                <ActionForm action={respondToRequest} className="os-inline-form" ariaLabel="Accept the request">
                  <Hidden name="id" value={id} /><Hidden name="action" value="accept" />
                  <PeopleSelect name="delegate" people={team} label="Delegate to" blank="Decide later" />
                  <SubmitButton>Accept</SubmitButton>
                </ActionForm>
                <details className="os-more">
                  <summary>Ask a question or decline</summary>
                  <div className="os-stack">
                    <ActionForm action={respondToRequest} className="os-inline-form" ariaLabel="Ask for clarification">
                      <Hidden name="id" value={id} /><Hidden name="action" value="clarify" />
                      <Field label="Your question"><input name="note" required /></Field>
                      <SubmitButton variant="ghost">Ask</SubmitButton>
                    </ActionForm>
                    <ActionForm action={respondToRequest} className="os-inline-form" ariaLabel="Decline the request" confirm="Decline this request? The requesting team will be told.">
                      <Hidden name="id" value={id} /><Hidden name="action" value="decline" />
                      <Field label="Reason for declining"><input name="note" required /></Field>
                      <SubmitButton variant="danger">Decline</SubmitButton>
                    </ActionForm>
                  </div>
                </details>
              </div>
            </Panel>
          ) : null}
          {task.request_state === "clarification_requested" && inRequesting ? (
            <Panel title="Answer the other team's question">
              <ActionForm action={clarifyRequest} className="os-inline-form">
                <Hidden name="id" value={id} />
                <Field label="Your answer"><input name="note" required /></Field>
                <SubmitButton>Send answer</SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}
        </>
      ) : null}

      {canReview ? (
        <Panel title="Review what was handed in">
          <div className="os-stack">
            <ActionForm action={reviewDeliverable}><Hidden name="id" value={id} /><Hidden name="accept" value="true" /><SubmitButton>Accept deliverable</SubmitButton></ActionForm>
            <ActionForm action={reviewDeliverable} className="os-inline-form">
              <Hidden name="id" value={id} /><Hidden name="accept" value="false" />
              <Field label="What needs revising"><input name="note" required /></Field>
              <SubmitButton variant="ghost">Request revisions</SubmitButton>
            </ActionForm>
          </div>
        </Panel>
      ) : null}

      {canSubmit && task.requires_review ? (
        <Panel title="Hand it in">
          <ActionForm action={submitDeliverable} className="os-inline-form">
            <Hidden name="id" value={id} />
            <Field label="Note with the deliverable"><input name="note" /></Field>
            <SubmitButton>Submit for review</SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}

      <div className="os-split">
        <div className="os-stack-lg">
          <Section title="What's needed">
            {task.description ? <p className="os-pre os-body">{task.description}</p> : <p className="os-empty">No description yet.</p>}
            {task.deliverables ? <><h3>You&apos;ll hand in</h3><p className="os-pre os-body">{task.deliverables}</p></> : null}
          </Section>

          <Section title="Steps">
            {(checklist.data ?? []).length === 0 ? <p className="os-empty">No steps. Add some if it helps to break this down.</p> : (
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
              <ActionForm action={saveChecklistItem} className="os-inline-form" resetOnSuccess ariaLabel="Add a step">
                <Hidden name="id" value={id} />
                <Field label="New item"><input name="label" required maxLength={300} /></Field>
                <SubmitButton variant="ghost">Add</SubmitButton>
              </ActionForm>
            ) : null}
          </Section>

          {(subtasks.data ?? []).length || (canEdit && open) ? (
            <Section title="Subtasks">
              {(subtasks.data ?? []).length ? <TaskTable tasks={subtasks.data ?? []} nameOf={nameOf} /> : null}
              {canEdit && open ? (
                <ActionForm action={createTask} className="os-inline-form" resetOnSuccess ariaLabel="Add a subtask">
                  <Hidden name="project" value={task.project_id} /><Hidden name="parent_task_id" value={id} /><Hidden name="stay" value="1" />
                  <Hidden name="assigned_to" value={task.assigned_to} /><Hidden name="visibility" value={task.visibility === "restricted" ? "restricted" : "team"} />
                  <Hidden name="due_at" value={toLocalInput(task.due_at)} />
                  <Field label="New subtask"><input name="title" required maxLength={200} /></Field>
                  <SubmitButton variant="ghost">Add</SubmitButton>
                </ActionForm>
              ) : null}
            </Section>
          ) : null}

          <Section title="Conversation">
            {(comments.data ?? []).length === 0 ? null : (
              <ul className="os-comments">
                {(comments.data ?? []).map(c => <li key={c.id}><Avatar name={nameOf(c.author_id)} /><div><small className="os-muted"><strong>{nameOf(c.author_id)}</strong> · {formatDateTime(c.created_at)}</small><p className="os-pre">{c.body}</p></div></li>)}
              </ul>
            )}
            {!archived ? (
              <ActionForm action={addComment} className="os-stack" resetOnSuccess ariaLabel="Add a comment">
                <Hidden name="id" value={id} />
                <Field label="Comment" hint={task.is_cross_team ? "Both teams can read this." : undefined}><textarea name="body" rows={2} required maxLength={8000} placeholder="Ask a question or share an update" /></Field>
                <div><SubmitButton variant="ghost">Post</SubmitButton></div>
              </ActionForm>
            ) : null}
          </Section>
        </div>

        <aside className="os-panel os-facts">
          <dl className="os-facts-list">
            <div><dt>Assigned to</dt><dd><Avatar name={task.assigned_to ? nameOf(task.assigned_to) : null} />{task.assigned_to === me.id ? "You" : nameOf(task.assigned_to)}</dd></div>
            <div><dt>Given by</dt><dd>{task.assigned_by ? <><Avatar name={nameOf(task.assigned_by)} />{task.assigned_by === me.id ? "You" : nameOf(task.assigned_by)}</> : "Generated automatically"}</dd></div>
            <div><dt>Due</dt><dd>{formatDateTime(task.due_at)}</dd></div>
            <div><dt>{task.is_cross_team ? "Asked by" : "Team"}</dt><dd>{task.is_cross_team ? ctx?.requesting_department : ctx?.responsible_department}</dd></div>
            {task.is_cross_team ? <div><dt>Done by</dt><dd>{ctx?.responsible_department}</dd></div> : null}
            <div><dt>Who can see this</dt><dd>{task.is_cross_team ? "Both teams, for this task only" : VISIBILITY[task.visibility]}</dd></div>
          </dl>

          {task.due_was_clamped ? <p className="os-muted">This date had already passed when the task was generated, so it was set to that day.</p> : null}

          {(inRequesting || inResponsible || me.is_president) && !archived && open ? (
            openProposal ? (
              <div className="os-facts-block">
                <h3>New date proposed</h3>
                <p>{nameOf(openProposal.proposed_by)} proposed <strong>{formatDateTime(openProposal.proposed_due_at)}</strong>{openProposal.note ? `: ${openProposal.note}` : "."}</p>
                {openProposal.proposed_by !== me.id || me.is_president ? (
                  <div className="os-row">
                    <ActionForm action={decideDeadline}><Hidden name="proposal" value={openProposal.id} /><Hidden name="accept" value="true" /><SubmitButton>Agree</SubmitButton></ActionForm>
                    <ActionForm action={decideDeadline}><Hidden name="proposal" value={openProposal.id} /><Hidden name="accept" value="false" /><SubmitButton variant="ghost">Decline</SubmitButton></ActionForm>
                  </div>
                ) : <p className="os-muted">Waiting for an answer.</p>}
              </div>
            ) : (
              <details className="os-more">
                <summary>Propose a new date</summary>
                <ActionForm action={proposeDeadline} className="os-stack" resetOnSuccess>
                  <Hidden name="id" value={id} />
                  <Field label="New date"><input name="due" type="datetime-local" required /></Field>
                  <Field label="Why"><input name="note" /></Field>
                  <div><SubmitButton variant="ghost">Propose</SubmitButton></div>
                </ActionForm>
              </details>
            )
          ) : null}

          {task.is_cross_team && task.request_state === "accepted" && responsibleHead && open ? (
            <details className="os-more">
              <summary>Change who has this</summary>
              <ActionForm action={delegateRequest} className="os-inline-form">
                <Hidden name="id" value={id} />
                <PeopleSelect name="delegate" people={team} label="Delegate to" value={task.assigned_to} blank={null} />
                <SubmitButton variant="ghost">Delegate</SubmitButton>
              </ActionForm>
            </details>
          ) : null}
          {!task.is_cross_team && open && !archived && (canEdit || (task.assigned_to === null && inResponsible)) ? (
            <details className="os-more" open={task.status === "unassigned"}>
              <summary>Change who has this</summary>
              <ActionForm action={assignTask} className="os-inline-form">
                <Hidden name="id" value={id} />
                <PeopleSelect name="assignee" people={directory.filter(p => teamIds.has(p.id) || p.id === me.id)} label="Assign to" value={task.assigned_to} />
                <SubmitButton variant="ghost">Assign</SubmitButton>
              </ActionForm>
            </details>
          ) : null}

          <div className="os-facts-block">
            <h3>Can&apos;t start until</h3>
            {deps.filter(d => d.direction === "blocked_by").length === 0 ? <p className="os-muted">Nothing. It&apos;s free to start.</p> : (
              <ul className="os-list">
                {deps.filter(d => d.direction === "blocked_by").map(d => (
                  <li key={d.task_id}>
                    <span>{d.status === "done" ? "✓ " : ""}{d.can_open ? <Link href={`/os/tasks/${d.task_id}`}>{d.title}</Link> : d.title}</span>
                    {canEdit ? <ActionForm action={removeDependency}><Hidden name="id" value={id} /><Hidden name="depends_on" value={d.task_id} /><button className="os-link-btn" type="submit">Remove</button></ActionForm> : null}
                  </li>
                ))}
              </ul>
            )}
            {deps.some(d => d.direction === "blocks") ? <><h3>Other tasks waiting on this</h3><ul className="os-list">{deps.filter(d => d.direction === "blocks").map(d => <li key={d.task_id}>{d.can_open ? <Link href={`/os/tasks/${d.task_id}`}>{d.title}</Link> : d.title}</li>)}</ul></> : null}
            {canEdit && open ? (
              <details className="os-more">
                <summary>Add something this waits on</summary>
                <ActionForm action={addDependency} className="os-inline-form" resetOnSuccess>
                  <Hidden name="id" value={id} />
                  <Field label="Can't start until">
                    <select name="depends_on" required defaultValue="">
                      <option value="" disabled>Choose a task</option>
                      {(siblings.data ?? []).filter(t => !deps.some(d => d.task_id === t.id)).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                  </Field>
                  <SubmitButton variant="ghost">Add</SubmitButton>
                </ActionForm>
              </details>
            ) : null}
          </div>

          <div className="os-facts-block">
            <h3>Files</h3>
            {(attachments.data ?? []).length === 0 ? null : <ul className="os-list">{(attachments.data ?? []).map(a => <li key={a.id}><a className="os-link" href={`/os/attachments/${a.id}`}>{a.file_name}</a><span className="os-muted">{Math.ceil(a.size_bytes / 1024)} KB</span></li>)}</ul>}
            {canEdit ? <Upload type="task" entity={id} /> : (attachments.data ?? []).length === 0 ? <Empty>No files.</Empty> : null}
          </div>

          {canEdit ? (
            <details className="os-more">
              <summary>Edit this task</summary>
              <ActionForm action={updateTask} className="os-stack">
                <Hidden name="id" value={id} /><Hidden name="expected" value={task.updated_at} />
                <Field label="Title"><input name="title" defaultValue={task.title} required maxLength={200} /></Field>
                <Field label="What's needed"><textarea name="description" rows={4} defaultValue={task.description} /></Field>
                <Field label="You'll hand in"><textarea name="deliverables" rows={3} defaultValue={task.deliverables} /></Field>
                <PriorityField value={task.priority} />
                {task.is_cross_team ? <Hidden name="due_at" value={toLocalInput(task.due_at)} /> : <Field label="Due" hint={task.due_source === "template" ? "Changing this protects it from automatic rescheduling." : undefined}><input name="due_at" type="datetime-local" defaultValue={toLocalInput(task.due_at)} /></Field>}
                {!task.is_cross_team ? (
                  <Field label="Who can see this">
                    <select name="visibility" defaultValue={task.visibility}>
                      <option value="project">Everyone on the project</option><option value="team">The team</option><option value="restricted">Only the people on this task and the team&apos;s lead</option>
                    </select>
                  </Field>
                ) : null}
                <div><SubmitButton variant="ghost">Save</SubmitButton></div>
              </ActionForm>
            </details>
          ) : null}

          {canWork && open && !task.requires_review && ["todo", "in_progress"].includes(task.status) ? (
            <details className="os-more">
              <summary>Ask for a review first</summary>
              <ActionForm action={submitDeliverable} className="os-stack">
                <Hidden name="id" value={id} />
                <Field label="Note with the deliverable"><input name="note" /></Field>
                <div><SubmitButton variant="ghost">Submit for review</SubmitButton></div>
              </ActionForm>
            </details>
          ) : null}

          <details className="os-more">
            <summary>History</summary>
            <ul className="os-timeline">
              {[...(reviews.data ?? []).map(r => ({ at: r.created_at, text: `${label(r.kind)} by ${nameOf(r.actor_id)}${r.note ? `: ${r.note}` : ""}`, key: r.id })),
                ...(history.data ?? []).map(h => ({ at: h.created_at, text: `${h.note || "Assigned"}: ${nameOf(h.assigned_to)}`, key: `h${h.id}` }))]
                .sort((a, b) => a.at.localeCompare(b.at))
                .map(h => <li key={h.key}><span className="os-muted">{formatDateTime(h.at)}</span>{h.text}</li>)}
            </ul>
          </details>

          {canEdit && open && (!task.is_cross_team || inRequesting || me.is_president) ? (
            <ActionForm action={setTaskStatus} confirm="Cancel this task? It stays on record but no longer counts as open.">
              <Hidden name="id" value={id} /><Hidden name="status" value="cancelled" />
              <button className="os-link-btn os-danger-link" type="submit">{task.is_cross_team ? "Withdraw this request" : "Cancel this task"}</button>
            </ActionForm>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
