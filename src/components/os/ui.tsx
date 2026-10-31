import Link from "next/link";
import { dueText, dueTone, formatDue, label } from "@/lib/os/format";
import { initials } from "@/lib/os/initials";
import type { Task } from "@/lib/os/types";

export function Page({ title, eyebrow, subtitle, actions, children }: { title: string; eyebrow?: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="os-page">
      <header className="os-page-head">
        <div>
          {eyebrow ? <p className="os-eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {subtitle ? <p className="os-page-sub">{subtitle}</p> : null}
        </div>
        {actions ? <div className="os-row">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

// A heading on the page itself. Cards are for things; a section is only a label.
export function Section({ title, action, children, id }: { title: string; action?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section className="os-section" id={id}>
      <header className="os-panel-head"><h2>{title}</h2>{action}</header>
      {children}
    </section>
  );
}

export function Avatar({ name, lead }: { name: string | null | undefined; lead?: boolean }) {
  return <span className={`os-avatar${lead ? " is-lead" : ""}${name ? "" : " is-open"}`} aria-hidden="true">{initials(name)}</span>;
}

export const Due = ({ value }: { value: string | null | undefined }) => <span className={`os-due os-due-${dueTone(value)}`}>{dueText(value)}</span>;

export const Status = ({ tone, children }: { tone: string; children: React.ReactNode }) => <span className={`os-status os-status-${tone}`}>{children}</span>;

export function Panel({ title, action, children, id }: { title?: string; action?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section className="os-panel" id={id}>
      {title ? <header className="os-panel-head"><h2>{title}</h2>{action}</header> : null}
      {children}
    </section>
  );
}

export const Empty = ({ children }: { children: React.ReactNode }) => <p className="os-empty">{children}</p>;

const TONES: Record<string, string> = {
  done: "good", completed: "good", approved: "good", accepted: "good", published: "good", active: "info", in_progress: "info", planning: "info", submitted: "warn", pending: "warn",
  clarification_requested: "warn", changes_requested: "warn", revisions_requested: "warn", invited: "warn", on_hold: "warn", blocked: "bad", rejected: "bad", declined: "bad", failed: "bad", dead: "bad", urgent: "bad", high: "warn",
};
export const Pill = ({ value }: { value: string | null | undefined }) => (value ? <span className={`os-pill os-tone-${TONES[value] ?? "plain"}`}>{label(value)}</span> : null);

export function Progress({ value }: { value: number }) {
  return (
    <div className="os-progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={`${value}% complete`}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

export function Stat({ label: name, value, href }: { label: string; value: number | string; href?: string }) {
  const body = <><strong>{value}</strong><span>{name}</span></>;
  return href ? <Link className="os-stat" href={href}>{body}</Link> : <div className="os-stat">{body}</div>;
}

export const Tabs = ({ items, current }: { items: { href: string; label: string; key: string }[]; current: string }) => (
  <nav className="os-tabs" aria-label="Section">
    {items.map(i => <Link key={i.key} href={i.href} aria-current={i.key === current ? "page" : undefined}>{i.label}</Link>)}
  </nav>
);

export function DueDate({ value, status }: { value: string | null; status?: string }) {
  if (!value) return <span className="os-muted">No date</span>;
  const overdue = new Date(value) < new Date() && status !== "done" && status !== "cancelled";
  return <span className={overdue ? "os-overdue" : undefined} title={formatDue(value)}>{overdue || new Date(value).getTime() - new Date().getTime() < 7 * 86_400_000 ? dueText(value) : formatDue(value)}</span>;
}

type TaskRow = Pick<Task, "id" | "title" | "status" | "priority" | "due_at" | "assigned_to" | "is_cross_team" | "request_state" | "responsible_department_id"> & { blocked_auto?: boolean };

export function TaskTable({ tasks, nameOf, teamOf, empty = "Nothing here." }: { tasks: TaskRow[]; nameOf?: (id: string | null) => string; teamOf?: (id: string) => string | undefined; empty?: string }) {
  if (!tasks.length) return <Empty>{empty}</Empty>;
  return (
    <div className="os-table-wrap" tabIndex={0} role="group" aria-label="Tasks">
      <table className="os-table">
        <thead><tr><th scope="col">Task</th><th scope="col">Status</th><th scope="col" className="os-wide-only">Priority</th>{nameOf ? <th scope="col">Assigned to</th> : null}<th scope="col">Due</th></tr></thead>
        <tbody>
          {tasks.map(t => (
            <tr key={t.id}>
              <td><Link href={`/os/tasks/${t.id}`}>{t.title}</Link>{t.is_cross_team ? <span className="os-tag">Cross-team</span> : null}{teamOf ? <small className="os-muted os-block">{teamOf(t.responsible_department_id)}</small> : null}</td>
              <td><Pill value={t.request_state && t.request_state !== "accepted" ? t.request_state : t.status === "blocked" && t.blocked_auto ? "waiting" : t.status} /></td>
              <td className="os-wide-only">{t.priority === "normal" ? <span className="os-muted">Normal</span> : <Pill value={t.priority} />}</td>
              {nameOf ? <td>{nameOf(t.assigned_to)}</td> : null}
              <td><DueDate value={t.due_at} status={t.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PeopleSelect({ name, people, value, blank = "Unassigned", label: labelText, required }: {
  name: string; people: { id: string; full_name: string; preferred_name: string | null; status?: string }[]; value?: string | null; blank?: string | null; label: string; required?: boolean;
}) {
  return (
    <label className="os-field">
      <span>{labelText}</span>
      <select name={name} defaultValue={value ?? ""} required={required}>
        {blank !== null ? <option value="">{blank}</option> : null}
        {people.filter(p => !p.status || p.status === "active" || p.id === value).map(p => <option key={p.id} value={p.id}>{p.preferred_name || p.full_name}</option>)}
      </select>
    </label>
  );
}

export const Field = ({ label: labelText, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="os-field"><span>{labelText}</span>{children}{hint ? <small>{hint}</small> : null}</label>
);

export const Check = ({ name, label: labelText, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) => (
  <label className="os-check"><input type="checkbox" name={name} defaultChecked={defaultChecked} /><span>{labelText}</span></label>
);

export const Hidden = ({ name, value }: { name: string; value: string | null | undefined }) => <input type="hidden" name={name} value={value ?? ""} />;

export function PriorityField({ value }: { value?: string }) {
  return (
    <Field label="Priority">
      <select name="priority" defaultValue={value ?? "normal"}>
        <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
      </select>
    </Field>
  );
}
