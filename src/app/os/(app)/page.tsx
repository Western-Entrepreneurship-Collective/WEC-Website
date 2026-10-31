import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/os/ActionForm";
import { Avatar, Due, Section } from "@/components/os/ui";
import { dismissChecklist } from "@/lib/os/actions/work";
import { displayName, requireMe } from "@/lib/os/dal";
import { entityHref, formatDateTime } from "@/lib/os/format";
import { getNeeds } from "@/lib/os/needs";
import { getSeats } from "@/lib/os/org";
import { createClient, rpc } from "@/lib/os/supabase";
import type { CalendarItem } from "@/lib/os/types";

export const metadata: Metadata = { title: "Home" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hourCycle: "h23", hour: "numeric" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default async function HomePage() {
  const me = await requireMe();
  if (!me.onboarding?.welcomed) redirect("/os/welcome");

  const supabase = await createClient();
  const now = new Date();
  const first = displayName(me).split(" ")[0];
  const position = me.positions[0];
  const [{ items, later }, seats, announcements, handover, upcoming] = await Promise.all([
    getNeeds(me),
    getSeats(),
    supabase.from("announcements").select("*").is("archived_at", null).order("published_at", { ascending: false }).limit(2),
    position
      ? supabase.from("projects").select("id, name").eq("owning_department_id", position.department_id).like("system_key", "handover:%").is("archived_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    rpc<CalendarItem[]>("calendar_items", { p_from: now.toISOString(), p_to: new Date(now.getTime() + 60 * 86_400_000).toISOString(), p_scope: "core" }),
  ]);

  const done = me.onboarding;
  const head = me.positions.find(p => p.is_head);
  const steps = [
    { label: "Set your password and name", done: true },
    { label: "Meet your team and see how WEC OS works", done: Boolean(done.welcomed), href: "/os/welcome", action: "Open it" },
    ...(head ? [{ label: "Check your team's requests", done: Boolean(done.requests_seen), href: `/os/teams/${head.department_slug}/requests`, action: "Check them" }] : []),
    ...(position ? [{ label: "Open your first task", done: Boolean(done.task_opened), href: "/os/tasks", action: "See your tasks" }] : []),
    ...(handover.data ? [{ label: "Read your team's handover", done: Boolean(done.handover_read), href: `/os/projects/${handover.data.id}`, action: "Read it" }] : []),
    ...(me.is_admin ? [{ label: "Look over the administration pages", done: Boolean(done.admin_seen), href: "/os/admin", action: "Open them" }] : []),
  ];
  const doneCount = steps.filter(s => s.done).length;
  const showChecklist = !done.dismissed && doneCount < steps.length;
  const team = position ? seats.filter(s => s.departmentId === position.department_id) : [];
  const coming = upcoming.sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 4);

  const intro = items.length === 0
    ? later.length ? "Nothing urgent. Your next things are below." : "Nothing is waiting on you right now."
    : `${items.length === 1 ? "One thing needs" : `${items.length} things need`} you. Everything else can wait.`;

  return (
    <div className="os-page">
      <header className="os-page-head">
        <div>
          <p className="os-eyebrow">{new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Toronto" }).format(now)}</p>
          <h1>{greeting()}, {first}.</h1>
          <p className="os-page-sub">{intro}</p>
        </div>
      </header>
      {me.positions.length === 0 && !me.is_admin ? <p className="os-note">You don&apos;t hold a position yet, so there isn&apos;t much to show. An administrator can assign you one.</p> : null}
      {(announcements.data ?? []).map(a => <div key={a.id} className="os-announcement"><strong>{a.title}</strong><p>{a.body}</p></div>)}

      <div className="os-split">
        <div className="os-stack-lg">
          {showChecklist ? (
            <section className="os-panel" aria-labelledby="start">
              <header className="os-panel-head">
                <h2 id="start">Getting started</h2>
                <span className="os-row">
                  <span className="os-muted">{doneCount} of {steps.length} done</span>
                  <ActionForm action={dismissChecklist}><button type="submit" className="os-link-btn">Hide</button></ActionForm>
                </span>
              </header>
              <div className="os-progress" aria-hidden="true"><span style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
              <ul className="os-steps-list">
                {steps.map(s => (
                  <li key={s.label} className={s.done ? "is-done" : undefined}>
                    <span className="os-step-mark" aria-hidden="true">{s.done ? "✓" : ""}</span>
                    <span className="os-step-label">{s.label}<span className="sr-only">{s.done ? " (done)" : ""}</span></span>
                    {!s.done && s.href ? <Link className="os-link" href={s.href}>{s.action}</Link> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Section title="Needs you">
            {items.length === 0 ? <p className="os-empty">You&apos;re all caught up. When someone gives you work or asks your team for something, it lands here.</p> : (
              <ul className="os-needs">
                {items.map(n => (
                  <li key={n.key} className="os-need">
                    <div>
                      <Link className="os-need-title" href={n.href}>{n.title}</Link>
                      <small>{n.why}</small>
                    </div>
                    {n.due && n.due !== "No date" ? <span className={`os-due os-due-${n.tone}`}>{n.due}</span> : null}
                    <Link className="os-btn os-btn-primary" href={n.href} aria-label={`${n.cta}: ${n.title}`}>{n.cta}</Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {later.length ? (
            <Section title="Coming up for you" action={<Link className="os-link" href="/os/tasks">All tasks</Link>}>
              <ul className="os-rows">
                {later.slice(0, 6).map(t => <li key={t.id}><Link href={`/os/tasks/${t.id}`}>{t.title}</Link><Due value={t.due_at} /></li>)}
              </ul>
            </Section>
          ) : null}
        </div>

        <aside className="os-stack-lg">
          {handover.data && !done.handover_read ? (
            <section className="os-feature">
              <p className="os-hand">From last year&apos;s team</p>
              <h2>Start with {position?.department_name}&apos;s handover</h2>
              <p>What&apos;s still open, how the team works, and where everything lives.</p>
              <Link className="os-btn os-btn-invert" href={`/os/projects/${handover.data.id}`}>Read the handover</Link>
            </section>
          ) : null}
          {team.length ? (
            <Section title="Your team" action={position ? <Link className="os-link" href={`/os/teams/${position.department_slug}`}>Open {position.department_name}</Link> : null}>
              <ul className="os-people-list">
                {team.map(s => <li key={s.key}><Avatar name={s.name} lead={s.isHead} /><span><strong>{s.name ?? "Open seat"}{s.execId === me.id ? " (you)" : ""}</strong><small>{s.title}</small></span></li>)}
              </ul>
            </Section>
          ) : null}
          <Section title="Coming up at WEC" action={<Link className="os-link" href="/os/calendar/core">Calendar</Link>}>
            {coming.length === 0 ? <p className="os-empty">Nothing on the Core Calendar yet. Approved events show up here.</p> : (
              <ul className="os-rows">
                {coming.map(c => {
                  const href = c.can_open && c.item_type !== "milestone" ? entityHref(c.item_type, c.item_id) : null;
                  return <li key={c.item_type + c.item_id}>{href ? <Link href={href}>{c.title}</Link> : <span>{c.title}</span>}<small className="os-muted">{formatDateTime(c.starts_at)}</small></li>;
                })}
              </ul>
            )}
          </Section>
        </aside>
      </div>
    </div>
  );
}
