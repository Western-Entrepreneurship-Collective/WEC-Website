import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { InviteForm } from "@/components/os/InviteForm";
import { Panel, Pill } from "@/components/os/ui";
import { runSweepNow } from "@/lib/os/actions/admin";
import { getDirectory, nameLookup, requireAdmin } from "@/lib/os/dal";
import { formatDateTime, hoursSince, label } from "@/lib/os/format";
import { getSeats } from "@/lib/os/org";
import { createClient, rpc } from "@/lib/os/supabase";

export default async function AdminOverview() {
  await requireAdmin();
  const supabase = await createClient();
  const [dead, heartbeat, unrouted, seats, people, audit, positions] = await Promise.all([
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("state", "dead"),
    supabase.from("settings").select("value").eq("key", "sweep_heartbeat").maybeSingle(),
    rpc<{ task_id: string; department_name: string; created_at: string }[]>("unrouted_requests"),
    getSeats(),
    getDirectory(),
    supabase.from("audit_log").select("id, actor_id, actor_kind, action, created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("positions").select("id, title, departments!positions_department_id_fkey(name, sort_order)").is("archived_at", null),
  ]);
  const nameOf = nameLookup(people);
  const beat = typeof heartbeat.data?.value === "string" ? heartbeat.data.value : null;
  const stale = !beat || hoursSince(beat) > 2;
  const failed = dead.count ?? 0;
  const filled = seats.filter(s => s.name).length;
  const options = (positions.data ?? []).sort((a, b) => (a.departments?.sort_order ?? 0) - (b.departments?.sort_order ?? 0));
  return (
    <>
      <section className="os-tiles" aria-label="System status">
        <div className={stale ? "is-bad" : "is-good"}>
          <strong>{stale ? "Reminders need a look" : "Reminders running"}</strong>
          <small>{beat ? `Last check ${formatDateTime(beat)}` : "Not run yet"}</small>
          <ActionForm action={runSweepNow}><SubmitButton variant="ghost">Run it now</SubmitButton></ActionForm>
        </div>
        <div className={failed ? "is-bad" : "is-good"}>
          <strong>{failed ? `${failed} failed ${failed === 1 ? "job" : "jobs"}` : "No failed jobs"}</strong>
          <small>{failed ? "Something did not send" : "Everything has been sent"}</small>
          {failed ? <Link className="os-btn os-btn-ghost" href="/os/admin/jobs">Retry</Link> : null}
        </div>
        <div className="is-plain">
          <strong>{filled} of {seats.length} seats filled</strong>
          <small><Link className="os-link" href="/os/admin/org">Teams and positions</Link></small>
        </div>
      </section>
      {unrouted.length ? (
        <Panel title="Tasks with nobody to receive them">
          <p className="os-muted">Nobody holds the lead seat for these teams, or any seat above them. Fill a seat and they route themselves.</p>
          <ul className="os-list">{unrouted.map(u => <li key={u.task_id}>{u.department_name}<span className="os-muted">{formatDateTime(u.created_at)}</span></li>)}</ul>
        </Panel>
      ) : null}
      <Panel title="Invite someone"><InviteForm positions={options.map(p => ({ id: p.id, title: p.title, team: p.departments?.name }))} /></Panel>
      <Panel title="People" action={<Link className="os-link" href="/os/admin/executives">Manage everyone</Link>}>
        <ul className="os-list">
          {people.slice(0, 8).map(p => <li key={p.id}><span>{p.full_name}<small className="os-muted os-block">{seats.filter(s => s.execId === p.id).map(s => s.title).join(", ") || "No position"}</small></span><Pill value={p.status} /></li>)}
        </ul>
      </Panel>
      <Panel title="Recent changes" action={<Link className="os-link" href="/os/admin/audit">Audit log</Link>}>
        <ul className="os-list">
          {(audit.data ?? []).map(a => <li key={a.id}><span>{a.actor_id ? nameOf(a.actor_id) : "System"}: {label(a.action.replace(".", " "))}</span><span className="os-muted">{formatDateTime(a.created_at)}</span></li>)}
        </ul>
      </Panel>
    </>
  );
}
