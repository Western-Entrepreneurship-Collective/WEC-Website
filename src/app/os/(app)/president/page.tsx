import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { RequestCard } from "@/components/os/RequestCard";
import { Empty, Field, Hidden, Meter, TaskRow, TeamTile } from "@/components/os/ui";
import { archiveAnnouncement, decideEvent, publishAnnouncement } from "@/lib/os/actions/work";
import { displayName, getDepartments, getDirectory, requirePresident } from "@/lib/os/dal";
import { daysUntil, formatDate } from "@/lib/os/format";
import { getSeats } from "@/lib/os/org";
import { projectNames } from "@/lib/os/projectNames";
import { createClient, rpc } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "All of WEC" };

type Escalation = { task_id: string; title: string; status: string; due_at: string | null; department_name: string; project_name: string; is_overdue: boolean };
type DepartmentRow = { department_id: string; department_name: string; open_tasks: number; done_tasks: number; overdue_tasks: number; blocked_tasks: number };

export default async function PresidentPage() {
  const me = await requirePresident();
  const supabase = await createClient();
  const [pendingEvents, upcoming, announcements, escalations, progress, seats, departments, directory, pending] = await Promise.all([
    supabase.from("events").select("*").eq("status", "submitted").order("submitted_at"),
    supabase.from("events").select("*").in("status", ["approved", "in_progress"]).order("starts_at").limit(1),
    supabase.from("announcements").select("*").is("archived_at", null).order("published_at", { ascending: false }).limit(5),
    rpc<Escalation[]>("escalations"),
    rpc<DepartmentRow[]>("department_progress"),
    getSeats(),
    getDepartments(),
    getDirectory(),
    supabase.from("tasks").select("*").in("request_state", ["pending", "clarification_requested"]).order("created_at").limit(50),
  ]);
  const hasLead = (departmentId: string) => seats.some(s => s.departmentId === departmentId && s.isHead && s.name);
  const nameOfTeam = (id: string) => departments.find(d => d.id === id)?.name ?? "A team";
  // Requests reach the President only for a team with nobody in its lead seat.
  const routed = (pending.data ?? []).filter(t => !hasLead(t.responsible_department_id));
  const names = await projectNames(routed.map(t => t.id));
  const peopleIn = (departmentId: string) => [...new Map(seats.filter(s => s.departmentId === departmentId && s.execId && s.execId !== me.id).map(s => [s.execId!, s.name!])).entries()].map(([id, name]) => ({ id, name }));
  const event = (upcoming.data ?? [])[0];
  const readiness = event ? await rpc<number>("event_readiness", { p_event: event.id }) : 0;
  const nameOf = (id: string) => { const p = directory.find(x => x.id === id); return p ? displayName(p) : "Someone"; };

  return (
    <div className="os-page">
      <header className="os-page-head">
        <div>
          <p className="os-eyebrow">{new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Toronto" }).format(new Date())}</p>
          <h1>All of WEC</h1>
        </div>
      </header>
      <div className="os-split">
        <div className="os-stack-lg">
          <section className="os-requests" aria-labelledby="decide">
            <header><h2 id="decide">Waiting on you</h2>{(pendingEvents.data ?? []).length + routed.length === 0 ? <p>Nothing right now.</p> : null}</header>
            {(pendingEvents.data ?? []).map(e => (
              <article key={e.id} className="os-request">
                <div className="os-request-head">
                  <div>
                    <Link href={`/os/events/${e.id}`}>{e.name}</Link>
                    <small>Event proposal{e.submitted_by ? ` from ${nameOf(e.submitted_by)}` : ""}</small>
                  </div>
                  <span className="os-request-due">{formatDate(e.starts_at)}. Tier {e.tier}</span>
                </div>
                <ActionForm action={decideEvent} className="os-stack">
                  <Hidden name="id" value={e.id} />
                  <Field label="Note" hint="Needed if you send it back."><input name="note" maxLength={2000} /></Field>
                  <div className="os-row os-wrap">
                    <SubmitButton name="decision" value="approved">Approve</SubmitButton>
                    <SubmitButton name="decision" value="changes_requested" variant="ghost">Send back</SubmitButton>
                    <SubmitButton name="decision" value="rejected" variant="danger">Reject</SubmitButton>
                  </div>
                </ActionForm>
              </article>
            ))}
            {routed.map(t => (
              <RequestCard key={t.id} task={t} from={nameOfTeam(t.requesting_department_id)} why={`Sent to ${nameOfTeam(t.responsible_department_id)}, which has no VP right now${names.get(t.id) ? `. For ${names.get(t.id)}` : ""}`} people={peopleIn(t.responsible_department_id)} meId={me.id} />
            ))}
          </section>

          <section className="os-band os-band-bad" aria-label="Stuck or overdue">
            <h2><span>Stuck or overdue across WEC</span><em>{escalations.length}</em></h2>
            <div>
              {escalations.length === 0 ? <Empty>Nothing is stuck or overdue.</Empty> : escalations.slice(0, 15).map(e => (
                <TaskRow key={e.task_id} task={{ id: e.task_id, title: e.title, status: e.status, due_at: e.due_at, updated_at: "" }} sub={`${e.department_name}. ${e.project_name}`} />
              ))}
            </div>
          </section>

          <section className="os-panel" aria-labelledby="post">
            <h2 id="post">Tell the executive team</h2>
            <ActionForm action={publishAnnouncement} className="os-stack" resetOnSuccess>
              <Field label="Title"><input name="title" required maxLength={160} /></Field>
              <Field label="Message"><textarea name="body" rows={2} required /></Field>
              <div><SubmitButton>Post</SubmitButton></div>
            </ActionForm>
            {(announcements.data ?? []).length ? (
              <ul className="os-list">
                {(announcements.data ?? []).map(a => <li key={a.id}><span>{a.title}</span><ActionForm action={archiveAnnouncement} confirm="Take this announcement down?"><Hidden name="id" value={a.id} /><button className="os-link-btn" type="submit">Take down</button></ActionForm></li>)}
              </ul>
            ) : null}
          </section>
        </div>

        <aside className="os-stack-lg">
          <section className="os-panel" aria-labelledby="events">
            <h2 id="events">Next event</h2>
            {event ? (
              <>
                <Link href={`/os/events/${event.id}`}>{event.name}</Link>
                <Meter value={readiness} />
                <small className="os-muted">{readiness}% ready, {Math.max(0, Math.ceil(daysUntil(event.starts_at)))} days away</small>
              </>
            ) : <Empty>No approved events coming up.</Empty>}
          </section>
          <section className="os-panel" aria-labelledby="teams">
            <h2 id="teams">Teams</h2>
            <ul className="os-plain-list">
              {departments.map(d => {
                const row = progress.find(p => p.department_id === d.id);
                const trouble = [row?.overdue_tasks ? `${row.overdue_tasks} overdue` : null, row?.blocked_tasks ? `${row.blocked_tasks} stuck` : null].filter(Boolean).join(", ");
                return (
                  <li key={d.id} className="os-team-line">
                    <TeamTile name={d.name} size="small" />
                    <Link href={`/os/teams/${d.slug}`}>{d.name}</Link>
                    {trouble ? <small className="os-overdue">{trouble}</small> : hasLead(d.id) ? <small>On track</small> : <small className="os-warn-text">VP seat open</small>}
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
