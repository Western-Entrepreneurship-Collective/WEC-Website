import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Kanban } from "@/components/os/Kanban";
import { RequestCard } from "@/components/os/RequestCard";
import { Avatar, Hidden, Meter, TaskRow, TeamTile, ViewSwitch } from "@/components/os/ui";
import { setTaskStatus } from "@/lib/os/actions/work";
import { getDepartments, requireMe } from "@/lib/os/dal";
import { shortDue, torontoDateKey } from "@/lib/os/format";
import { getSeats } from "@/lib/os/org";
import { projectNames } from "@/lib/os/projectNames";
import { createClient, rpc } from "@/lib/os/supabase";
import type { ProjectSummary, Task } from "@/lib/os/types";

export const metadata: Metadata = { title: "My tasks" };

const TZ = "America/Toronto";
const DAY = 86_400_000;
const CLOSED = "(done,cancelled)";
const isLate = (t: Pick<Task, "due_at" | "status">) => Boolean(t.due_at) && new Date(t.due_at!) < new Date() && !["done", "cancelled"].includes(t.status);

// Sunday to Saturday, the same as the calendar.
function thisWeek() {
  const noon = new Date(`${torontoDateKey(new Date())}T12:00:00Z`);
  const sunday = noon.getTime() - noon.getUTCDay() * DAY;
  return Array.from({ length: 7 }, (_, i) => new Date(sunday + i * DAY));
}

export default async function MyTasksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const me = await requireMe();
  if (!me.onboarding?.welcomed) redirect("/os/welcome");
  const { view } = await searchParams;
  const supabase = await createClient();
  const headOf = me.positions.filter(p => p.is_head);
  const headIds = headOf.map(p => p.department_id);
  const [mine, sent, requests, heads, announcements, summaries, seats, departments, onProjects] = await Promise.all([
    supabase.from("tasks").select("*").eq("assigned_to", me.id).not("status", "in", CLOSED).order("due_at", { nullsFirst: false }).limit(200),
    supabase.from("tasks").select("*").eq("created_by", me.id).eq("is_cross_team", true).not("status", "in", CLOSED).order("due_at", { nullsFirst: false }).limit(20),
    headIds.length ? supabase.from("tasks").select("*").in("responsible_department_id", headIds).in("request_state", ["pending", "clarification_requested"]).order("created_at").limit(20) : Promise.resolve({ data: [] }),
    headIds.length ? supabase.from("tasks").select("id, title, due_at, assigned_to, status").in("responsible_department_id", headIds).not("status", "in", CLOSED).limit(300) : Promise.resolve({ data: [] }),
    supabase.from("announcements").select("*").is("archived_at", null).order("published_at", { ascending: false }).limit(2),
    rpc<ProjectSummary[]>("project_summaries"),
    getSeats(),
    getDepartments(),
    supabase.from("project_participants").select("project_id").eq("executive_id", me.id),
  ]);

  const tasks = mine.data ?? [];
  const asked = requests.data ?? [];
  const waitingOnOthers = sent.data ?? [];
  const names = await projectNames([...tasks, ...asked, ...waitingOnOthers].map(t => t.id));
  const nameOfTeam = (id: string) => departments.find(d => d.id === id)?.name ?? "Another team";
  const canTick = (t: Task) => t.status !== "unassigned";
  const actionable = tasks.filter(t => !(t.status === "blocked" && t.blocked_auto));
  const next = actionable[0];
  const weekEnd = thisWeek()[6];
  const endOfWeek = torontoDateKey(weekEnd);
  const inWeek = (t: Task) => Boolean(t.due_at) && torontoDateKey(new Date(t.due_at!)) <= endOfWeek;
  const rest = tasks.filter(t => t.id !== next?.id);
  const week = rest.filter(inWeek);
  const later = rest.filter(t => !inWeek(t));
  const today = torontoDateKey(new Date());
  const days = thisWeek().map(d => {
    const key = d.toISOString().slice(0, 10);
    const count = tasks.filter(t => t.due_at && torontoDateKey(new Date(t.due_at)) === key).length;
    return { key, count, short: new Intl.DateTimeFormat("en-CA", { weekday: "short", timeZone: "UTC" }).format(d), num: d.getUTCDate(), long: new Intl.DateTimeFormat("en-CA", { month: "long", day: "numeric", timeZone: "UTC" }).format(d) };
  });

  const myTeams = new Set(me.positions.map(p => p.department_id));
  const onIt = new Set([...tasks.map(t => t.project_id), ...(onProjects.data ?? []).map(p => p.project_id)]);
  const projects = summaries.filter(p => p.can_open && !p.archived_at && (onIt.has(p.id) || (p.owning_department_id && myTeams.has(p.owning_department_id)))).slice(0, 6);

  const teamPeople = (departmentId: string) => seats.filter(s => s.departmentId === departmentId && s.execId && s.execId !== me.id).map(s => ({ id: s.execId!, name: s.name! }));
  const teamOpen = heads.data ?? [];
  const lateOnTeam = teamOpen.filter(isLate);
  const load = headIds.length ? [...new Map(seats.filter(s => s.execId && headIds.includes(s.departmentId)).map(s => [s.execId!, s])).values()].map(s => {
    const theirs = teamOpen.filter(t => t.assigned_to === s.execId);
    return { id: s.execId!, name: s.execId === me.id ? "You" : s.name!, open: theirs.length, late: theirs.filter(isLate).length };
  }) : [];
  const most = Math.max(1, ...load.map(p => p.open));
  const board = view === "board";

  return (
    <div className="os-page">
      <header className="os-page-head">
        <div>
          <p className="os-eyebrow">{new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: TZ }).format(new Date())}</p>
          <h1>My tasks</h1>
        </div>
        <ViewSwitch label="View" items={[{ href: "/os", label: "List", on: !board }, { href: "/os?view=board", label: "Board", on: board }]} />
      </header>
      {me.positions.length === 0 && !me.is_admin ? <p className="os-note">You don&apos;t hold a position yet, so there isn&apos;t much to show. An administrator can assign you one.</p> : null}
      {(announcements.data ?? []).map(a => <div key={a.id} className="os-announcement"><strong>{a.title}</strong><p>{a.body}</p></div>)}

      {board ? (
        <Kanban cards={tasks.map(t => ({ id: t.id, title: t.title, status: t.status, sub: names.get(t.id), due: shortDue(t.due_at), late: isLate(t), updated_at: t.updated_at, waiting: t.status === "blocked" && t.blocked_auto }))} />
      ) : (
        <div className="os-split">
          <div className="os-stack-lg">
            {asked.length ? (
              <section className="os-requests" aria-labelledby="asked">
                <header>
                  <h2 id="asked">Requests for {headOf.map(p => p.department_name).join(" and ")}</h2>
                  <p>{asked.length} {asked.length === 1 ? "is" : "are"} waiting for you to take or assign.</p>
                </header>
                {asked.map(t => <RequestCard key={t.id} task={t} from={nameOfTeam(t.requesting_department_id)} project={names.get(t.id)} people={teamPeople(t.responsible_department_id)} meId={me.id} />)}
              </section>
            ) : null}

            {next ? (
              <section className="os-next-up" aria-labelledby="next">
                <div>
                  <h2 id="next">Do this next</h2>
                  <Link href={`/os/tasks/${next.id}`}>{next.title}</Link>
                  <p>{names.get(next.id)}. <strong className={isLate(next) ? "os-overdue" : undefined}>{next.due_at ? (isLate(next) ? `Overdue since ${shortDue(next.due_at)}.` : `Due ${shortDue(next.due_at)}.`) : "No date."}</strong></p>
                </div>
                <div className="os-row os-wrap">
                  {canTick(next) ? <ActionForm action={setTaskStatus}><Hidden name="id" value={next.id} /><Hidden name="status" value="done" /><Hidden name="expected" value={next.updated_at} /><SubmitButton>Mark done</SubmitButton></ActionForm> : null}
                  <Link className="os-btn os-btn-ghost" href={`/os/tasks/${next.id}`}>Open task</Link>
                </div>
              </section>
            ) : (
              <p className="os-empty-big">{asked.length ? "Nothing else is on your list." : "You're all caught up. When someone gives you a task, it lands here."}</p>
            )}

            {week.length ? (
              <section className="os-panel" aria-labelledby="week">
                <h2 id="week">This week <em className="os-count-text">{week.length} left</em></h2>
                <div>{week.map(t => <TaskRow key={t.id} task={t} sub={names.get(t.id)} canTick={canTick(t)} />)}</div>
              </section>
            ) : null}
            {later.length ? (
              <section className="os-panel" aria-labelledby="later">
                <h2 id="later">Later</h2>
                <div>{later.map(t => <TaskRow key={t.id} task={t} sub={names.get(t.id)} canTick={canTick(t)} />)}</div>
              </section>
            ) : null}
            <p className="os-muted"><Link className="os-link" href="/os/tasks?show=closed">Finished tasks</Link></p>
          </div>

          <aside className="os-stack-lg">
            <section className="os-panel" aria-labelledby="days">
              <h2 id="days">Your week</h2>
              <ol className="os-week">
                {days.map(d => (
                  <li key={d.key} className={d.key === today ? "is-today" : undefined} aria-label={`${d.long}, ${d.count} ${d.count === 1 ? "task" : "tasks"}`}>
                    <span>{d.short}</span><strong>{d.num}</strong>
                    <span className="os-dots" aria-hidden="true">{Array.from({ length: Math.min(d.count, 4) }, (_, i) => <i key={i} />)}</span>
                  </li>
                ))}
              </ol>
            </section>

            {load.length ? (
              <section className="os-panel" aria-labelledby="load">
                <h2 id="load">Who has what</h2>
                <ul className="os-load">
                  {load.map(p => (
                    <li key={p.id}>
                      <Avatar name={p.name === "You" ? seats.find(s => s.execId === me.id)?.name : p.name} />
                      <div>
                        <span><strong>{p.name}</strong><small className={p.late ? "os-overdue" : undefined}>{p.open} open{p.late ? `, ${p.late} late` : ""}</small></span>
                        <Meter value={(p.open / most) * 100} tone={p.late ? "bad" : undefined} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {lateOnTeam.length ? (
              <section className="os-panel os-panel-bad" aria-labelledby="teamlate">
                <h2 id="teamlate">{lateOnTeam.length} {lateOnTeam.length === 1 ? "task" : "tasks"} running late</h2>
                <ul className="os-plain-list">
                  {lateOnTeam.slice(0, 5).map(t => <li key={t.id}><Link href={`/os/tasks/${t.id}`}>{t.title}</Link><small>{seats.find(s => s.execId === t.assigned_to)?.name ?? "Unassigned"}. Due {shortDue(t.due_at)}</small></li>)}
                </ul>
              </section>
            ) : null}

            {waitingOnOthers.length ? (
              <section className="os-panel" aria-labelledby="waiting">
                <h2 id="waiting">Waiting on others</h2>
                <ul className="os-plain-list">
                  {waitingOnOthers.map(t => (
                    <li key={t.id} className="os-with-tile">
                      <TeamTile name={nameOfTeam(t.responsible_department_id)} size="small" />
                      <span><Link href={`/os/tasks/${t.id}`}>{t.title}</Link><small>{nameOfTeam(t.responsible_department_id)}. {t.assigned_to ? `${seats.find(s => s.execId === t.assigned_to)?.name?.split(" ")[0] ?? "Someone"} is on it` : "Waiting for an answer"}{t.due_at ? `, due ${shortDue(t.due_at)}` : ""}</small></span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {projects.length ? (
              <section className="os-panel" aria-labelledby="myprojects">
                <h2 id="myprojects">My projects</h2>
                <ul className="os-plain-list">
                  {projects.map(p => <li key={p.id} className="os-project-line"><Link href={`/os/projects/${p.id}`}>{p.name}</Link><small>{p.done_tasks} of {p.total_tasks}</small><Meter value={p.progress} /></li>)}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}
