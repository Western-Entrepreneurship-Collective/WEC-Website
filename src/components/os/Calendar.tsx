import Link from "next/link";
import { label, torontoDateKey } from "@/lib/os/format";
import { rpc } from "@/lib/os/supabase";
import { ViewSwitch } from "./ui";
import type { CalendarItem } from "@/lib/os/types";

const DAY = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hrefFor(item: CalendarItem) {
  if (!item.can_open || item.item_type === "milestone") return null;
  const base = item.item_type === "event" ? "events" : item.item_type === "project" ? "projects" : "tasks";
  return `/os/${base}/${item.item_id}`;
}

/**
 * A month on a wall. Items come from api.calendar_items, which reads the source records
 * and applies their read checks. Nothing is stored here, and it all works through links.
 */
export async function Calendar({ wide, params }: { wide: "core" | "org"; params: { month?: string; scope?: string } }) {
  const all = params.scope === "all";
  const todayKey = torontoDateKey(new Date());
  const monthKey = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : todayKey.slice(0, 7);
  const [year, month] = monthKey.split("-").map(Number);
  const first = Date.UTC(year, month - 1, 1, 12);
  const last = Date.UTC(year, month, 0, 12);
  const start = first - new Date(first).getUTCDay() * DAY;
  const count = Math.ceil((last - start + DAY) / (7 * DAY)) * 7;
  const days = Array.from({ length: count }, (_, i) => new Date(start + i * DAY));

  const rows = await rpc<CalendarItem[]>("calendar_items", {
    p_from: new Date(start - DAY).toISOString(), p_to: new Date(start + (count + 1) * DAY).toISOString(), p_scope: all ? wide : "personal", p_department: null,
  });
  const byDay = new Map<string, CalendarItem[]>();
  for (const item of [...rows].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    const key = torontoDateKey(new Date(item.starts_at));
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }

  const q = (m: string, wideView = all) => `/os/calendar?month=${m}${wideView ? "&scope=all" : ""}`;
  const shift = (delta: number) => new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 7);
  const heading = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);

  return (
    <div className="os-cal">
      <header className="os-cal-bar">
        <div className="os-row os-wrap">
          <h1>{heading}</h1>
          <Link className="os-cal-arrow" href={q(shift(-1))} aria-label="Previous month">‹</Link>
          <Link className="os-cal-arrow" href={q(shift(1))} aria-label="Next month">›</Link>
          <Link className="os-btn os-btn-ghost" href={q(todayKey.slice(0, 7))}>Today</Link>
        </div>
        <ViewSwitch label="Show" items={[{ href: q(monthKey, false), label: "Mine", on: !all }, { href: q(monthKey, true), label: "All of WEC", on: all }]} />
      </header>
      <div className="os-cal-scroll" tabIndex={0} role="group" aria-label={heading}>
        <div className="os-cal-grid">
          <div className="os-cal-head" aria-hidden="true">{WEEKDAYS.map(d => <span key={d}>{d}</span>)}</div>
          <ol className="os-cal-days">
            {days.map(d => {
              const key = d.toISOString().slice(0, 10);
              return (
                <li key={key} className={`os-cal-day${d.getUTCMonth() === month - 1 ? "" : " is-outside"}${key === todayKey ? " is-today" : ""}`} aria-label={new Intl.DateTimeFormat("en-CA", { month: "long", day: "numeric", timeZone: "UTC" }).format(d)}>
                  <span className="os-cal-num">{d.getUTCDate()}</span>
                  {(byDay.get(key) ?? []).map(item => {
                    const href = hrefFor(item);
                    const overdue = item.item_type === "task" && key < todayKey && !["done", "cancelled"].includes(item.status);
                    const cls = `os-cal-item os-cal-${item.item_type === "event" ? "event" : "task"}${overdue ? " is-overdue" : ""}${item.status === "done" ? " is-done" : ""}`;
                    const body = <>{item.title}<span className="sr-only"> ({label(item.status)})</span></>;
                    return href ? <Link key={`${item.item_type}${item.item_id}`} className={cls} href={href}>{body}</Link> : <span key={`${item.item_type}${item.item_id}`} className={cls}>{body}</span>;
                  })}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <p className="os-cal-key" aria-hidden="true"><span className="os-cal-event">Event</span><span className="os-cal-task">Task</span><span className="os-cal-task is-overdue">Overdue</span></p>
    </div>
  );
}
