import Link from "next/link";
import { label, torontoDateKey } from "@/lib/os/format";
import { rpc } from "@/lib/os/supabase";
import { Empty, Pill } from "./ui";
import type { CalendarItem } from "@/lib/os/types";

const TZ = "America/Toronto";
const DAY = 86_400_000;
const TYPES = ["event", "project", "milestone", "task"] as const;

type Params = { view?: string; date?: string; show?: string | string[] };

function hrefFor(item: CalendarItem) {
  if (!item.can_open) return null;
  if (item.item_type === "milestone") return null;
  const base = item.item_type === "event" ? "events" : item.item_type === "project" ? "projects" : "tasks";
  return `/os/${base}/${item.item_id}`;
}

const utcDay = (key: string) => new Date(`${key}T12:00:00Z`);
const keyOf = (d: Date) => d.toISOString().slice(0, 10);

/**
 * One calendar for every scope. Items come from api.calendar_items, which reads the
 * source records and applies their read checks. Nothing is stored here, and all of
 * it works through links, so it needs no client code at all.
 */
export async function Calendar({ scope, department, basePath, searchParams }: { scope: "core" | "team" | "personal" | "org"; department?: string; basePath: string; searchParams: Params }) {
  const view = searchParams.view === "week" || searchParams.view === "agenda" ? searchParams.view : "month";
  const anchorKey = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date ?? "") ? searchParams.date! : torontoDateKey(new Date());
  const anchor = utcDay(anchorKey);
  const shown = new Set(([] as string[]).concat(searchParams.show ?? TYPES as unknown as string[]));

  let start: Date; let end: Date; let prev: Date; let next: Date; let heading: string;
  if (view === "month") {
    const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1, 12));
    start = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * DAY);
    const last = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0, 12));
    end = new Date(last.getTime() + (6 - ((last.getUTCDay() + 6) % 7)) * DAY);
    prev = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1, 12));
    next = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1, 12));
    heading = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  } else if (view === "week") {
    start = new Date(anchor.getTime() - ((anchor.getUTCDay() + 6) % 7) * DAY);
    end = new Date(start.getTime() + 6 * DAY);
    prev = new Date(anchor.getTime() - 7 * DAY);
    next = new Date(anchor.getTime() + 7 * DAY);
    heading = `Week of ${new Intl.DateTimeFormat("en-CA", { month: "long", day: "numeric", timeZone: "UTC" }).format(start)}`;
  } else {
    start = anchor;
    end = new Date(anchor.getTime() + 41 * DAY);
    prev = new Date(anchor.getTime() - 42 * DAY);
    next = new Date(anchor.getTime() + 42 * DAY);
    heading = `From ${new Intl.DateTimeFormat("en-CA", { month: "long", day: "numeric", timeZone: "UTC" }).format(start)}`;
  }

  const rows = await rpc<CalendarItem[]>("calendar_items", {
    p_from: new Date(start.getTime() - DAY).toISOString(), p_to: new Date(end.getTime() + DAY * 2).toISOString(), p_scope: scope, p_department: department ?? null,
  });
  const items = rows.filter(i => shown.has(i.item_type)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const byDay = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const key = torontoDateKey(new Date(item.starts_at));
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }

  const q = (over: Partial<Params>) => {
    const p = new URLSearchParams();
    p.set("view", over.view ?? view);
    p.set("date", over.date ?? anchorKey);
    for (const s of shown) p.append("show", s);
    return `${basePath}?${p}`;
  };
  const days: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY) days.push(new Date(t));
  const todayKey = torontoDateKey(new Date());
  const entry = (item: CalendarItem) => {
    const href = hrefFor(item);
    const time = item.item_type === "event" ? new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZone: TZ }).format(new Date(item.starts_at)) + " " : "";
    const overdue = item.item_type === "task" && new Date(item.starts_at) < new Date() && item.status !== "done" && item.status !== "cancelled";
    const body = <>{time}{item.title}<span className="sr-only"> ({label(item.status)})</span></>;
    const cls = `os-cal-item os-cal-${item.item_type} os-cal-status-${item.status}${overdue ? " is-overdue" : ""}`;
    return href ? <Link key={`${item.item_type}${item.item_id}`} className={cls} href={href} title={label(item.status)}>{body}</Link> : <span key={`${item.item_type}${item.item_id}`} className={cls}>{body}</span>;
  };

  return (
    <div className="os-cal">
      <div className="os-cal-bar">
        <div className="os-row">
          <Link className="os-btn os-btn-ghost" href={q({ date: keyOf(prev) })} aria-label="Previous">←</Link>
          <Link className="os-btn os-btn-ghost" href={q({ date: todayKey })}>Today</Link>
          <Link className="os-btn os-btn-ghost" href={q({ date: keyOf(next) })} aria-label="Next">→</Link>
          <h2>{heading}</h2>
        </div>
        <nav className="os-row" aria-label="Calendar view">
          {(["month", "week", "agenda"] as const).map(v => <Link key={v} className="os-chip" aria-current={v === view ? "page" : undefined} href={q({ view: v })}>{v[0].toUpperCase() + v.slice(1)}</Link>)}
        </nav>
      </div>
      <form className="os-cal-filter" action={basePath}>
        <input type="hidden" name="view" value={view} />
        <input type="hidden" name="date" value={anchorKey} />
        {TYPES.map(t => <label key={t} className="os-check"><input type="checkbox" name="show" value={t} defaultChecked={shown.has(t)} /><span>{t[0].toUpperCase() + t.slice(1)}s</span></label>)}
        <button className="os-btn os-btn-ghost" type="submit">Filter</button>
      </form>
      {view === "agenda" ? (
        byDay.size === 0 ? <Empty>Nothing scheduled in this period.</Empty> : (
          <ul className="os-agenda">
            {[...byDay.entries()].map(([key, list]) => (
              <li key={key}>
                <h3>{new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(utcDay(key))}</h3>
                <ul>{list.map(item => <li key={`${item.item_type}${item.item_id}`}>{entry(item)} <Pill value={item.status} />{item.department_name ? <span className="os-muted"> {item.department_name}</span> : null}</li>)}</ul>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="os-cal-scroll" tabIndex={0} role="group" aria-label={heading}>
          <div className={`os-cal-grid os-cal-${view}`}>
            <div className="os-cal-head" aria-hidden="true">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <span key={d}>{d}</span>)}</div>
            <div className="os-cal-days">
              {days.map(d => {
                const key = keyOf(d);
                const inMonth = view !== "month" || d.getUTCMonth() === anchor.getUTCMonth();
                return (
                  <div key={key} className={`os-cal-day${inMonth ? "" : " is-outside"}${key === todayKey ? " is-today" : ""}`}>
                    <span className="os-cal-num"><span className="sr-only">{new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", timeZone: "UTC" }).format(d)} </span>{d.getUTCDate()}</span>
                    {(byDay.get(key) ?? []).map(entry)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
