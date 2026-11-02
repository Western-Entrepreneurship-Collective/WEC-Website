import type { Metadata } from "next";
import Link from "next/link";
import { Empty, Page, Panel, Pill, Progress } from "@/components/os/ui";
import { can, requireMe } from "@/lib/os/dal";
import { formatDateTime } from "@/lib/os/format";
import { createClient, rpc } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  const me = await requireMe();
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").order("starts_at", { ascending: false }).limit(200);
  const events = data ?? [];
  const live = events.filter(e => ["approved", "in_progress"].includes(e.status));
  const proposals = events.filter(e => ["draft", "submitted", "changes_requested", "rejected"].includes(e.status));
  const past = events.filter(e => ["completed", "archived"].includes(e.status));
  const readiness = new Map(await Promise.all(live.map(async e => [e.id, await rpc<number>("event_readiness", { p_event: e.id })] as const)));
  return (
    <Page title="Events" actions={can(me, "event.submit") ? <Link className="os-btn os-btn-primary" href="/os/events/new">New proposal</Link> : null}>
      <Panel title="Approved and in progress">
        {live.length === 0 ? <Empty>No approved events yet.</Empty> : (
          <ul className="os-list">
            {live.map(e => <li key={e.id}><span><Link href={`/os/events/${e.id}`}>{e.name}</Link> <span className="os-muted">Tier {e.tier} · {formatDateTime(e.starts_at)}</span></span><span className="os-list-side"><Progress value={readiness.get(e.id) ?? 0} /><span className="os-muted">{readiness.get(e.id) ?? 0}% ready</span></span></li>)}
          </ul>
        )}
      </Panel>
      {proposals.length ? (
        <Panel title="Proposals">
          <ul className="os-list">{proposals.map(e => <li key={e.id}><span><Link href={`/os/events/${e.id}`}>{e.name}</Link> <span className="os-muted">{formatDateTime(e.starts_at)}</span></span><Pill value={e.status} /></li>)}</ul>
        </Panel>
      ) : null}
      {past.length ? (
        <Panel title="Past events">
          <ul className="os-list">{past.map(e => <li key={e.id}><span><Link href={`/os/events/${e.id}`}>{e.name}</Link> <span className="os-muted">{formatDateTime(e.starts_at)}</span></span><Pill value={e.status} /></li>)}</ul>
        </Panel>
      ) : null}
    </Page>
  );
}
