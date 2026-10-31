import type { Metadata } from "next";
import Link from "next/link";
import { Empty, Page, Panel, Pill, Progress, Stat, TaskTable } from "@/components/os/ui";
import { displayName, getDirectory, nameLookup, requireMe } from "@/lib/os/dal";
import { entityHref, formatDate, formatDateTime, notificationText, torontoDateKey } from "@/lib/os/format";
import { createClient, rpc } from "@/lib/os/supabase";
import type { CalendarItem, NotificationRow, ProjectSummary } from "@/lib/os/types";

export const metadata: Metadata = { title: "Dashboard" };

const OPEN = ["unassigned", "todo", "in_progress", "blocked", "submitted", "revisions_requested"];

export default async function DashboardPage() {
  const me = await requireMe();
  const supabase = await createClient();
  const nameOf = nameLookup(await getDirectory());
  const now = new Date();
  const inTwoWeeks = new Date(now.getTime() + 14 * 86_400_000);
  const departments = me.positions.map(p => p.department_id);

  const [mine, assigned, reviews, requests, participating, announcements, sops, summaries, calendar, notifications] = await Promise.all([
    supabase.from("tasks").select("*").eq("assigned_to", me.id).in("status", OPEN).order("due_at", { nullsFirst: false }).limit(12),
    supabase.from("tasks").select("*").eq("assigned_by", me.id).neq("assigned_to", me.id).in("status", OPEN).order("due_at", { nullsFirst: false }).limit(8),
    supabase.from("tasks").select("*").eq("status", "submitted").neq("assigned_to", me.id).order("submitted_at").limit(8),
    supabase.from("tasks").select("*").in("request_state", ["pending", "clarification_requested"]).order("created_at").limit(8),
    supabase.from("project_participants").select("project_id").eq("executive_id", me.id),
    supabase.from("announcements").select("*").is("archived_at", null).order("published_at", { ascending: false }).limit(3),
    departments.length ? supabase.from("sops").select("id, title, review_on").in("department_id", departments).is("archived_at", null).not("current_version_id", "is", null).order("title").limit(6) : Promise.resolve({ data: [] }),
    rpc<ProjectSummary[]>("project_summaries"),
    rpc<CalendarItem[]>("calendar_items", { p_from: now.toISOString(), p_to: inTwoWeeks.toISOString(), p_scope: "personal" }),
    rpc<NotificationRow[]>("my_notifications", { p_limit: 6, p_unread_only: true }),
  ]);

  const myTasks = mine.data ?? [];
  const participatingIds = new Set((participating.data ?? []).map(p => p.project_id));
  const projects = summaries.filter(p => p.can_open && (p.lead_name === displayName(me) || participatingIds.has(p.id) || departments.length > 0) && p.status !== "completed").slice(0, 8);
  const overdue = myTasks.filter(t => t.due_at && new Date(t.due_at) < now).length;
  const dueThisWeek = myTasks.filter(t => t.due_at && new Date(t.due_at) >= now && new Date(t.due_at) < new Date(now.getTime() + 7 * 86_400_000)).length;
  const reviewRows = (reviews.data ?? []).filter(t => t.assigned_by === me.id || t.created_by === me.id || me.is_president || me.positions.some(p => p.is_head && (p.department_id === t.requesting_department_id || p.department_id === t.responsible_department_id)));
  const agenda = calendar.sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 8);

  return (
    <Page eyebrow={new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Toronto" }).format(now)} title={`Hello, ${displayName(me).split(" ")[0]}.`}>
      {me.positions.length === 0 && !me.is_admin ? <p className="os-note">You do not hold a position yet, so there is not much to show. An administrator can assign you one.</p> : null}
      <div className="os-stats">
        <Stat label="Assigned to me" value={myTasks.length} href="/os/tasks" />
        <Stat label="Overdue" value={overdue} href="/os/tasks" />
        <Stat label="Due this week" value={dueThisWeek} href="/os/calendar" />
        <Stat label="Waiting on my review" value={reviewRows.length} />
      </div>
      {(announcements.data ?? []).map(a => (
        <div key={a.id} className="os-announcement"><strong>{a.title}</strong><p>{a.body}</p></div>
      ))}
      <div className="os-grid">
        <Panel title="My tasks" action={<Link className="os-link" href="/os/tasks">All</Link>}>
          <TaskTable tasks={myTasks} empty="Nothing assigned to you right now." />
        </Panel>
        <Panel title="Upcoming" action={<Link className="os-link" href="/os/calendar">Calendar</Link>}>
          {agenda.length === 0 ? <Empty>Nothing in the next two weeks.</Empty> : (
            <ul className="os-list">
              {agenda.map(i => {
                const href = entityHref(i.item_type, i.item_id);
                return <li key={`${i.item_type}${i.item_id}`}>{href && i.item_type !== "milestone" ? <Link href={href}>{i.title}</Link> : i.title}<span className="os-muted">{formatDateTime(i.starts_at)}</span></li>;
              })}
            </ul>
          )}
        </Panel>
        {reviewRows.length ? <Panel title="Pending reviews"><TaskTable tasks={reviewRows} nameOf={nameOf} /></Panel> : null}
        {(requests.data ?? []).length ? <Panel title="Requests waiting for an answer"><TaskTable tasks={requests.data ?? []} /></Panel> : null}
        <Panel title="Tasks I assigned"><TaskTable tasks={assigned.data ?? []} nameOf={nameOf} empty="You have not assigned anything open." /></Panel>
        <Panel title="Projects">
          {projects.length === 0 ? <Empty>No active projects yet.</Empty> : (
            <ul className="os-list">
              {projects.map(p => <li key={p.id}><Link href={`/os/projects/${p.id}`}>{p.name}</Link><span className="os-list-side"><Progress value={p.progress} /><span className="os-muted">{p.progress}%</span></span></li>)}
            </ul>
          )}
        </Panel>
        <Panel title="Notifications" action={<Link className="os-link" href="/os/notifications">All</Link>}>
          {notifications.length === 0 ? <Empty>You are all caught up.</Empty> : (
            <ul className="os-list">
              {notifications.map(n => {
                const href = entityHref(n.entity_type, n.entity_id);
                return <li key={n.id}><span>{notificationText(n.kind)}: {href ? <Link href={href}>{n.title}</Link> : n.title}</span><span className="os-muted">{formatDate(n.created_at)}</span></li>;
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Relevant SOPs" action={<Link className="os-link" href="/os/sops">Library</Link>}>
          {(sops.data ?? []).length === 0 ? <Empty>Your department has no published SOPs yet.</Empty> : (
            <ul className="os-list">
              {(sops.data ?? []).map(s => <li key={s.id}><Link href={`/os/sops/${s.id}`}>{s.title}</Link>{s.review_on && s.review_on <= torontoDateKey(now) ? <Pill value="changes_requested" /> : null}</li>)}
            </ul>
          )}
        </Panel>
      </div>
    </Page>
  );
}
