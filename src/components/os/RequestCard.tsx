import Link from "next/link";
import { ActionForm, SubmitButton } from "./ActionForm";
import { Field, Hidden, TeamTile } from "./ui";
import { shortDue } from "@/lib/os/format";
import { respondToRequest } from "@/lib/os/actions/work";
import type { Task } from "@/lib/os/types";

// Take it, give it to someone, or say no. That is the whole of answering another team.
export function RequestCard({ task, from, project, people, meId, why }: {
  task: Pick<Task, "id" | "title" | "due_at">; from: string; project?: string; people: { id: string; name: string }[]; meId: string; why?: string;
}) {
  return (
    <article className="os-request">
      <div className="os-request-head">
        <TeamTile name={from} />
        <div>
          <Link href={`/os/tasks/${task.id}`}>{task.title}</Link>
          <small>{why ?? `From ${from}${project ? `, for ${project}` : ""}`}</small>
        </div>
        {task.due_at ? <span className="os-request-due">{shortDue(task.due_at)}</span> : null}
      </div>
      <div className="os-request-actions">
        <ActionForm action={respondToRequest}>
          <Hidden name="id" value={task.id} /><Hidden name="action" value="accept" /><Hidden name="delegate" value={meId} />
          <SubmitButton>Take it</SubmitButton>
        </ActionForm>
        {people.length ? (
          <ActionForm action={respondToRequest} className="os-row">
            <Hidden name="id" value={task.id} /><Hidden name="action" value="accept" />
            <label className="sr-only" htmlFor={`assign-${task.id}`}>Assign {task.title} to</label>
            <select id={`assign-${task.id}`} name="delegate" required defaultValue="">
              <option value="" disabled>Assign to...</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <SubmitButton variant="ghost">Assign</SubmitButton>
          </ActionForm>
        ) : null}
        <details className="os-more os-request-decline">
          <summary>Decline</summary>
          <ActionForm action={respondToRequest} className="os-inline-form">
            <Hidden name="id" value={task.id} /><Hidden name="action" value="decline" />
            <Field label="Why? They will be told."><input name="note" required maxLength={500} /></Field>
            <SubmitButton variant="danger">Decline</SubmitButton>
          </ActionForm>
        </details>
      </div>
    </article>
  );
}
