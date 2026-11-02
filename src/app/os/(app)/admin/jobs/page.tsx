import { ActionForm } from "@/components/os/ActionForm";
import { Empty, Hidden, Panel, Pill } from "@/components/os/ui";
import { retryJob } from "@/lib/os/actions/admin";
import { formatDateTime } from "@/lib/os/format";
import { createClient } from "@/lib/os/supabase";

export default async function AdminJobs() {
  const supabase = await createClient();
  const [{ data: failed }, { data: recent }] = await Promise.all([
    supabase.from("jobs").select("*").in("state", ["failed", "dead"]).order("created_at", { ascending: false }).limit(100),
    supabase.from("jobs").select("*").in("state", ["pending", "running", "done"]).order("created_at", { ascending: false }).limit(50),
  ]);
  return (
    <>
      <Panel title="Failed jobs">
        {(failed ?? []).length === 0 ? <Empty>Nothing has failed.</Empty> : (
          <div className="os-table-wrap" tabIndex={0} role="group" aria-label="Table">
            <table className="os-table">
              <thead><tr><th scope="col">Job</th><th scope="col">State</th><th scope="col">Attempts</th><th scope="col">Error</th><th scope="col"><span className="sr-only">Retry</span></th></tr></thead>
              <tbody>{(failed ?? []).map(j => <tr key={j.id}><td>{j.kind}</td><td><Pill value={j.state} /></td><td>{j.attempts}/{j.max_attempts}</td><td>{j.last_error}</td><td><ActionForm action={retryJob}><Hidden name="id" value={j.id} /><button className="os-link-btn" type="submit">Retry</button></ActionForm></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="Recent jobs">
        {(recent ?? []).length === 0 ? <Empty>No jobs yet.</Empty> : <ul className="os-list">{(recent ?? []).map(j => <li key={j.id}><span>{j.kind}</span><span className="os-row"><Pill value={j.state === "done" ? "completed" : j.state} /><span className="os-muted">{formatDateTime(j.created_at)}</span></span></li>)}</ul>}
      </Panel>
    </>
  );
}
