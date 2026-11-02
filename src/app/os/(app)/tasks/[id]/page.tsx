import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { RequestCard } from "@/components/os/RequestCard";
import { Upload } from "@/components/os/Upload";
import { Field, Hidden, Meter, Person, TaskRow } from "@/components/os/ui";
import {
  addComment, addDependency, assignTask, decideDeadline, delegateRequest, deleteChecklistItem, proposeDeadline, removeDependency,
  saveChecklistItem, setTaskStatus, updateTask,
} from "@/lib/os/actions/work";
import { can, displayName, getDirectory, inDepartment, nameLookup, requireMe } from "@/lib/os/dal";
import { formatDate, formatDateTime, label, torontoDateKey } from "@/lib/os/format";
import { getSeats, seatHolder, teamLead, titleLookup } from "@/lib/os/org";
import { createClient, rpc } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "Task" };

type Context = { project_id: string; project_name: string; project_kind: string; can_open_project: boolean; event_id: string | null; requesting_department: string; responsible_department: string };
type Dep = { task_id: string; title: string; status: string; can_open: boolean; direction: "blocked_by" | "blocks" };

const STATUSES = ["todo", "in_progress", "blocked", "done"] as const;

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: task } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (!task) notFound();

  const directory = await getDirectory();
  const nameOf = nameLookup(directory);
  const seats = await getSeats();
  const titleOf = titleLookup(seats);
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
  const team = directory.filter(p => teamIds.has(p.id) && p.status === "active");
  const archived = Boolean(project.data?.archived_at);

  const responsibleHead = me.is_president || me.positions.some(p => p.is_head && p.department_id === task.responsible_department_id);
  const inRequesting = inDepartment(me, task.requesting_department_id);
  const inResponsible = inDepartment(me, task.responsible_department_id);
  const open = !["done", "cancelled"].includes(task.status);
  const canEdit = !archived && (me.is_president || task.assigned_to === me.id || task.assigned_by === me.id || responsibleHead);
  const canWork = canEdit && (!task.is_cross_team || task.assigned_to === me.id || responsibleHead);
  const openProposal = (proposals.data ?? []).find(p => p.state === "open");
  const waiting = task.status === "blocked" && task.blocked_auto;
  const isAsked = task.is_cross_team && task.request_state && ["pending", "clarification_requested"].includes(task.request_state);
  const items = checklist.data ?? [];
  const ticked = items.filter(c => c.is_done).length;
  const blockedBy = deps.filter(d => d.direction === "blocked_by");
  const shown = task.status === "submitted" ? "in_progress" : task.status === "revisions_requested" ? "todo" : task.status;
  const canReopen = !archived && task.status === "done" && (canWork || (task.is_cross_team && inRequesting));
  const canCancel = canEdit && open && (!task.is_cross_team || inRequesting || me.is_president);
  // Someone who gave this to another person or team follows it from the middle of the page.
  const sent = task.is_cross_team ? inRequesting : task.assigned_by === me.id && task.assigned_to !== null && task.assigned_to !== me.id;
  const Heading = sent ? "h2" : "h3";
  const asker = seatHolder(seats, task.assigned_by) ?? teamLead(seats, task.requesting_department_id);
  const doer = seatHolder(seats, task.assigned_to) ?? teamLead(seats, task.responsible_department_id);
  const more = (
    <>
      {task.assigned_by ? <p className="os-muted">Given by {task.assigned_by === me.id ? "you" : nameOf(task.assigned_by)}.</p> : <p className="os-muted">Created automatically.</p>}

      {task.is_cross_team && (inRequesting || inResponsible || me.is_president) && !archived && open ? (
        openProposal ? (
          <section>
            <Heading>New date proposed</Heading>
            <p>{nameOf(openProposal.proposed_by)} proposed <strong>{formatDateTime(openProposal.proposed_due_at)}</strong>{openProposal.note ? `: ${openProposal.note}` : "."}</p>
            {openProposal.proposed_by !== me.id || me.is_president ? (
              <div className="os-row">
                <ActionForm action={decideDeadline}><Hidden name="proposal" value={openProposal.id} /><Hidden name="accept" value="true" /><SubmitButton>Agree</SubmitButton></ActionForm>
                <ActionForm action={decideDeadline}><Hidden name="proposal" value={openProposal.id} /><Hidden name="accept" value="false" /><SubmitButton variant="ghost">Decline</SubmitButton></ActionForm>
              </div>
            ) : <p className="os-muted">Waiting for an answer.</p>}
          </section>
        ) : (
          <ActionForm action={proposeDeadline} className="os-stack" resetOnSuccess>
            <Hidden name="id" value={id} />
            <Field label="Propose a new date"><input name="due" type="datetime-local" required /></Field>
            <Field label="Why"><input name="note" /></Field>
            <div><SubmitButton variant="ghost">Propose</SubmitButton></div>
          </ActionForm>
        )
      ) : null}

      <section>
        <Heading>Files</Heading>
        {(attachments.data ?? []).length ? <ul className="os-list">{(attachments.data ?? []).map(a => <li key={a.id}><a className="os-link" href={`/os/attachments/${a.id}`}>{a.file_name}</a><span className="os-muted">{Math.ceil(a.size_bytes / 1024)} KB</span></li>)}</ul> : null}
        {canEdit ? <Upload type="task" entity={id} /> : (attachments.data ?? []).length ? null : <p className="os-muted">No files.</p>}
      </section>

      <section>
        <Heading>Can&apos;t start until</Heading>
        {blockedBy.length === 0 ? <p className="os-muted">Nothing. It&apos;s free to start.</p> : (
          <ul className="os-list">
            {blockedBy.map(d => (
              <li key={d.task_id}>
                <span>{d.status === "done" ? "✓ " : ""}{d.can_open ? <Link href={`/os/tasks/${d.task_id}`}>{d.title}</Link> : d.title}</span>
                {canEdit ? <ActionForm action={removeDependency}><Hidden name="id" value={id} /><Hidden name="depends_on" value={d.task_id} /><button className="os-link-btn" type="submit">Remove</button></ActionForm> : null}
              </li>
            ))}
          </ul>
        )}
        {deps.some(d => d.direction === "blocks") ? <><Heading>Other tasks waiting on this</Heading><ul className="os-list">{deps.filter(d => d.direction === "blocks").map(d => <li key={d.task_id}>{d.can_open ? <Link href={`/os/tasks/${d.task_id}`}>{d.title}</Link> : d.title}</li>)}</ul></> : null}
        {canEdit && open ? (
          <ActionForm action={addDependency} className="os-inline-form" resetOnSuccess>
            <Hidden name="id" value={id} />
            <Field label="Add something this waits on">
              <select name="depends_on" required defaultValue="">
                <option value="" disabled>Choose a task</option>
                {(siblings.data ?? []).filter(t => !deps.some(d => d.task_id === t.id)).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </Field>
            <SubmitButton variant="ghost">Add</SubmitButton>
          </ActionForm>
        ) : null}
      </section>

      {canEdit ? (
        <ActionForm action={updateTask} className="os-stack">
          <Hidden name="id" value={id} /><Hidden name="expected" value={task.updated_at} /><Hidden name="deliverables" value={task.deliverables} /><Hidden name="priority" value={task.priority} /><Hidden name="visibility" value={task.visibility} />
          <Hidden name="due" value={task.due_at ? torontoDateKey(new Date(task.due_at)) : ""} />
          <Heading>Edit this task</Heading>
          <Field label="Title"><input name="title" defaultValue={task.title} required maxLength={200} /></Field>
          <Field label="Details"><textarea name="description" rows={4} defaultValue={task.description} /></Field>
          <div><SubmitButton variant="ghost">Save</SubmitButton></div>
        </ActionForm>
      ) : null}

      <section>
        <Heading>History</Heading>
        <ul className="os-timeline">
          {[...(reviews.data ?? []).map(r => ({ at: r.created_at, text: `${label(r.kind)} by ${nameOf(r.actor_id)}${r.note ? `: ${r.note}` : ""}`, key: r.id })),
            ...(history.data ?? []).map(h => ({ at: h.created_at, text: `${h.note || "Assigned"}: ${nameOf(h.assigned_to)}`, key: `h${h.id}` }))]
            .sort((a, b) => a.at.localeCompare(b.at))
            .map(h => <li key={h.key}><span className="os-muted">{formatDateTime(h.at)}</span>{h.text}</li>)}
        </ul>
      </section>

    </>
  );

  return (
    <div className="os-page">
      <div className="os-task-top">
        <nav className="os-crumbs" aria-label="You are here">
          <Link href="/os/projects">Projects</Link><span aria-hidden="true">/</span>
          {ctx?.can_open_project ? <Link href={`/os/projects/${ctx.project_id}`}>{ctx.project_name}</Link> : <span>{ctx?.project_name}</span>}
          {task.parent_task_id ? <><span aria-hidden="true">/</span><Link href={`/os/tasks/${task.parent_task_id}`}>Parent task</Link></> : null}
        </nav>
        {sent && canCancel ? (
          <ActionForm action={setTaskStatus} confirm="Withdraw this task? It stays on record but no longer counts as open.">
            <Hidden name="id" value={id} /><Hidden name="status" value="cancelled" />
            <SubmitButton variant="danger">Withdraw this task</SubmitButton>
          </ActionForm>
        ) : null}
      </div>

      <div className="os-task-layout">
        <article className="os-task-sheet">
          <header>
            <h1>{task.title}</h1>
            {task.is_cross_team ? (
              <p className="os-asked"><Person name={asker ?? "Nobody in the lead seat"} title={ctx?.requesting_department} /><span>asked</span><Person name={doer ?? "Nobody in the lead seat"} title={ctx?.responsible_department} /></p>
            ) : null}
          </header>

          {archived ? <p className="os-note">This project is archived, so this task is read-only.</p> : null}
          {waiting ? <p className="os-note">This can&apos;t start until {blockedBy.filter(d => d.status !== "done").map(d => d.title).join(" and ") || "an earlier task"} is done.</p> : null}
          {task.status === "done" ? <p className="os-done-note">Done.{task.is_cross_team ? ` ${ctx?.requesting_department} has been told, and can reopen this if something's missing.` : ""}</p> : null}
          {task.status === "cancelled" ? <p className="os-note">{task.request_state === "declined" ? `${ctx?.responsible_department} declined this.` : "This was cancelled."} It stays on record.</p> : null}
          {isAsked && !archived && !responsibleHead ? <p className="os-note">Waiting for {ctx?.responsible_department}&apos;s lead to take it or give it to someone.</p> : null}
          {isAsked && !archived && responsibleHead ? (
            <RequestCard task={task} from={ctx?.requesting_department ?? "Another team"} why={`${asker ? `${asker}, ` : ""}${ctx?.requesting_department} is asking your team for this`} people={team.filter(p => p.id !== me.id).map(p => ({ id: p.id, name: displayName(p) }))} meId={me.id} />
          ) : null}

          <section aria-labelledby="details">
            <h2 id="details">Details</h2>
            {task.description ? <p className="os-pre">{task.description}</p> : <p className="os-muted">No details yet.</p>}
            {task.deliverables ? <p className="os-pre os-muted">To hand in: {task.deliverables}</p> : null}
          </section>

          <section aria-labelledby="steps">
            <div className="os-between-line"><h2 id="steps">Steps</h2>{items.length ? <small>{ticked} of {items.length} done</small> : null}</div>
            {items.length ? <Meter value={(ticked / items.length) * 100} /> : null}
            {items.length ? (
              <ul className="os-checklist">
                {items.map(item => (
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
            ) : null}
            {canEdit ? (
              <ActionForm action={saveChecklistItem} className="os-inline-form" resetOnSuccess ariaLabel="Add a step">
                <Hidden name="id" value={id} />
                <Field label="Add a step"><input name="label" required maxLength={300} /></Field>
                <SubmitButton variant="ghost">Add</SubmitButton>
              </ActionForm>
            ) : null}
          </section>

          {(subtasks.data ?? []).length ? (
            <section aria-labelledby="subtasks">
              <h2 id="subtasks">Smaller tasks</h2>
              <div>{(subtasks.data ?? []).map(t => <TaskRow key={t.id} task={t} sub={nameOf(t.assigned_to)} canTick={canWork && t.status !== "unassigned"} />)}</div>
            </section>
          ) : null}

          <section aria-labelledby="comments">
            <h2 id="comments">Comments</h2>
            {(comments.data ?? []).length ? (
              <ul className="os-comments">
                {(comments.data ?? []).map(c => <li key={c.id}><div><div className="os-comment-head"><Person name={nameOf(c.author_id)} title={titleOf(c.author_id)} /><small className="os-muted">{formatDateTime(c.created_at)}</small></div><p className="os-pre">{c.body}</p></div></li>)}
              </ul>
            ) : null}
            {!archived ? (
              <ActionForm action={addComment} className="os-inline-form" resetOnSuccess ariaLabel="Add a comment">
                <Hidden name="id" value={id} />
                <Field label="Comment" hint={task.is_cross_team ? "Both teams can read this." : undefined}><input name="body" required maxLength={8000} /></Field>
                <SubmitButton variant="ghost">Post</SubmitButton>
              </ActionForm>
            ) : null}
          </section>

          {sent ? more : null}
        </article>

        <aside className="os-task-side">
          <div>
            <span id="status-label" className="os-side-label">Status</span>
            {canWork && !archived && !isAsked && task.status !== "unassigned" && task.status !== "cancelled" && !waiting ? (
              <div className="os-status-buttons" role="group" aria-labelledby="status-label">
                {STATUSES.map(s => (
                  <ActionForm key={s} action={setTaskStatus}>
                    <Hidden name="id" value={id} /><Hidden name="status" value={s} /><Hidden name="expected" value={task.updated_at} />
                    <button type="submit" className={`is-${s}`} aria-pressed={shown === s}>{label(s)}</button>
                  </ActionForm>
                ))}
              </div>
            ) : (
              <p className={`os-status-text is-${shown}`}>{waiting ? "Waiting" : isAsked ? label("pending") : label(task.status)}</p>
            )}
            {canReopen && !canWork ? <ActionForm action={setTaskStatus}><Hidden name="id" value={id} /><Hidden name="status" value="todo" /><Hidden name="expected" value={task.updated_at} /><SubmitButton variant="ghost">Reopen</SubmitButton></ActionForm> : null}
          </div>

          <div>
            {task.is_cross_team && task.request_state === "accepted" && responsibleHead && open ? (
              <ActionForm action={delegateRequest} className="os-stack">
                <Hidden name="id" value={id} />
                <Field label="Who"><select name="delegate" defaultValue={task.assigned_to ?? ""} required>{task.assigned_to ? null : <option value="" disabled>Choose</option>}{directory.filter(p => p.status === "active" && (teamIds.has(p.id) || p.id === me.id || p.id === task.assigned_to)).map(p => <option key={p.id} value={p.id}>{displayName(p)}</option>)}</select></Field>
                <div><SubmitButton variant="ghost">Change</SubmitButton></div>
              </ActionForm>
            ) : !task.is_cross_team && open && !archived && (canEdit || (task.assigned_to === null && inResponsible)) ? (
              <ActionForm action={assignTask} className="os-stack">
                <Hidden name="id" value={id} />
                <Field label="Who"><select name="assignee" defaultValue={task.assigned_to ?? ""}><option value="">Nobody yet</option>{directory.filter(p => p.status === "active" && ((can(me, "task.assign") && teamIds.has(p.id)) || p.id === me.id || p.id === task.assigned_to)).map(p => <option key={p.id} value={p.id}>{displayName(p)}</option>)}</select></Field>
                <div><SubmitButton variant="ghost">Change</SubmitButton></div>
              </ActionForm>
            ) : (
              <><span className="os-side-label">Who</span><p><Person name={task.assigned_to === me.id ? "You" : task.assigned_to ? nameOf(task.assigned_to) : "Nobody yet"} title={titleOf(task.assigned_to)} /></p></>
            )}
          </div>

          <div>
            {canEdit && open && !task.is_cross_team ? (
              <ActionForm action={updateTask} className="os-stack">
                <Hidden name="id" value={id} /><Hidden name="expected" value={task.updated_at} /><Hidden name="title" value={task.title} /><Hidden name="description" value={task.description} /><Hidden name="deliverables" value={task.deliverables} /><Hidden name="priority" value={task.priority} /><Hidden name="visibility" value={task.visibility} />
                <Field label="Due"><input name="due" type="date" defaultValue={task.due_at ? torontoDateKey(new Date(task.due_at)) : ""} /></Field>
                <div><SubmitButton variant="ghost">Save date</SubmitButton></div>
              </ActionForm>
            ) : (
              <><span className="os-side-label">Due</span><p>{task.due_at ? formatDate(task.due_at) : "No date"}</p></>
            )}
          </div>

          <div>
            <span className="os-side-label">Project</span>
            <p>{ctx?.can_open_project ? <Link className="os-link" href={`/os/projects/${ctx.project_id}`}>{ctx.project_name}</Link> : ctx?.project_name}</p>
          </div>

          {sent ? null : (
            <details className="os-more">
              <summary>More</summary>
              <div className="os-stack">
                {more}
                {canCancel ? <ActionForm action={setTaskStatus} confirm="Cancel this task? It stays on record but no longer counts as open.">
                  <Hidden name="id" value={id} /><Hidden name="status" value="cancelled" />
                  <button className="os-link-btn os-danger-link" type="submit">{task.is_cross_team ? "Withdraw this task" : "Cancel this task"}</button>
                </ActionForm> : null}
              </div>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}
