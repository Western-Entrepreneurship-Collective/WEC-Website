import type { Metadata } from "next";
import Link from "next/link";
import { Empty, Page, Panel } from "@/components/os/ui";
import { can, getDepartments, requireMe } from "@/lib/os/dal";
import { formatDateTime } from "@/lib/os/format";
import { createClient } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "Meetings" };

export default async function MeetingsPage() {
  const me = await requireMe();
  const supabase = await createClient();
  const [{ data }, departments] = await Promise.all([supabase.from("meetings").select("id, title, starts_at, department_id, archived_at").order("starts_at", { ascending: false }).limit(200), getDepartments()]);
  return (
    <Page title="Meetings" actions={can(me, "meeting.create") ? <Link className="os-btn os-btn-primary" href="/os/meetings/new">Record a meeting</Link> : null}>
      <Panel>
        {(data ?? []).length === 0 ? <Empty>No meetings you can see yet.</Empty> : (
          <ul className="os-list">
            {(data ?? []).map(m => <li key={m.id}><span><Link href={`/os/meetings/${m.id}`}>{m.title}</Link> <span className="os-muted">{departments.find(d => d.id === m.department_id)?.name}</span>{m.archived_at ? <span className="os-tag">Archived</span> : null}</span><span className="os-muted">{formatDateTime(m.starts_at)}</span></li>)}
          </ul>
        )}
      </Panel>
    </Page>
  );
}
