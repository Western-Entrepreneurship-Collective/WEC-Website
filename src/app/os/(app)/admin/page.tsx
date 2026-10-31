import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Calendar } from "@/components/os/Calendar";
import { Empty, Panel, Stat } from "@/components/os/ui";
import { runSweepNow } from "@/lib/os/actions/admin";
import { requireAdmin } from "@/lib/os/dal";
import { formatDateTime, hoursSince } from "@/lib/os/format";
import { createClient, rpc } from "@/lib/os/supabase";

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; show?: string | string[] }> }) {
  await requireAdmin();
  const supabase = await createClient();
  const [active, invited, dead, failedRuns, heartbeat, unrouted] = await Promise.all([
    supabase.from("executives").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("invitations").select("id", { count: "exact", head: true }).is("accepted_at", null).is("revoked_at", null),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("state", "dead"),
    supabase.from("automation_runs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("settings").select("value").eq("key", "sweep_heartbeat").maybeSingle(),
    rpc<{ task_id: string; department_name: string; created_at: string }[]>("unrouted_requests"),
  ]);
  const beat = typeof heartbeat.data?.value === "string" ? heartbeat.data.value : null;
  const stale = !beat || hoursSince(beat) > 2;
  return (
    <>
      <div className="os-stats">
        <Stat label="Active executives" value={active.count ?? 0} href="/os/admin/executives" />
        <Stat label="Open invitations" value={invited.count ?? 0} href="/os/admin/executives" />
        <Stat label="Jobs failed for good" value={dead.count ?? 0} href="/os/admin/jobs" />
        <Stat label="Failed rule runs" value={failedRuns.count ?? 0} href="/os/admin/automation" />
      </div>
      <Panel title="Automation sweep">
        <p className={stale ? "os-overdue" : undefined}>{beat ? `Last finished ${formatDateTime(beat)}.` : "It has not run yet."}{stale ? " It should run every 15 minutes, so this needs a look." : ""}</p>
        <ActionForm action={runSweepNow}><SubmitButton variant="ghost">Run it now</SubmitButton></ActionForm>
      </Panel>
      <Panel title="Unrouted requests">
        {unrouted.length === 0 ? <Empty>Every request has someone to receive it.</Empty> : (
          <>
            <p className="os-muted">Nobody holds the head seat for these departments, or any seat above them. Fill a seat and they route themselves.</p>
            <ul className="os-list">{unrouted.map(u => <li key={u.task_id}>{u.department_name}<span className="os-muted">{formatDateTime(u.created_at)}</span></li>)}</ul>
          </>
        )}
      </Panel>
      <Panel title="Organization schedule"><Calendar scope="org" basePath="/os/admin" searchParams={await searchParams} /></Panel>
    </>
  );
}
