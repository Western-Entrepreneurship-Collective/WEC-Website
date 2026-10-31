import Link from "next/link";
import { Empty, Panel } from "@/components/os/ui";
import { getDirectory, nameLookup } from "@/lib/os/dal";
import { formatDateTime } from "@/lib/os/format";
import { createClient } from "@/lib/os/supabase";

const PER_PAGE = 100;

export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ page?: string; action?: string }> }) {
  const { page: rawPage, action } = await searchParams;
  const page = Math.max(Number(rawPage) || 0, 0);
  const supabase = await createClient();
  let query = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).range(page * PER_PAGE, page * PER_PAGE + PER_PAGE - 1);
  if (action) query = query.ilike("action", `${action.replace(/[%_]/g, "")}%`);
  const [{ data }, directory] = await Promise.all([query, getDirectory()]);
  const nameOf = nameLookup(directory);
  return (
    <Panel title="Audit log">
      <form action="/os/admin/audit" className="os-inline-form">
        <label className="os-field"><span>Filter by action</span><input name="action" defaultValue={action} placeholder="event" /></label>
        <button className="os-btn os-btn-ghost" type="submit">Filter</button>
      </form>
      {(data ?? []).length === 0 ? <Empty>Nothing recorded.</Empty> : (
        <div className="os-table-wrap" tabIndex={0} role="group" aria-label="Table">
          <table className="os-table">
            <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Record</th><th scope="col">Changes</th></tr></thead>
            <tbody>
              {(data ?? []).map(a => <tr key={a.id}><td>{formatDateTime(a.created_at)}</td><td>{a.actor_kind === "system" ? "System" : nameOf(a.actor_id)}</td><td>{a.action}</td><td>{a.entity_type}</td><td><code className="os-mono">{JSON.stringify(a.changes)}</code></td></tr>)}
            </tbody>
          </table>
        </div>
      )}
      <div className="os-row">
        {page > 0 ? <Link className="os-link" href={`/os/admin/audit?page=${page - 1}${action ? `&action=${action}` : ""}`}>Newer</Link> : null}
        {(data ?? []).length === PER_PAGE ? <Link className="os-link" href={`/os/admin/audit?page=${page + 1}${action ? `&action=${action}` : ""}`}>Older</Link> : null}
      </div>
    </Panel>
  );
}
