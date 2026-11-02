import Link from "next/link";
import { notFound } from "next/navigation";
import { Empty, Page, Panel } from "@/components/os/ui";
import { formatDateTime } from "@/lib/os/format";
import { createClient } from "@/lib/os/supabase";
import { getTeam } from "../team";

export default async function TeamMeetings({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { department, canOpen } = await getTeam(slug);
  if (!canOpen) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("meetings").select("id, title, starts_at").eq("department_id", department.id).order("starts_at", { ascending: false }).limit(100);
  return (
    <Page title={`${department.name} meeting notes`}>
      <nav className="os-crumbs" aria-label="You are here"><Link href={`/os/teams/${slug}`}>{department.name}</Link></nav>
      <p><Link className="os-btn os-btn-primary" href={`/os/meetings/new?department=${department.id}`}>Record a meeting</Link></p>
      <Panel>{(data ?? []).length === 0 ? <Empty>No meetings recorded.</Empty> : <ul className="os-list">{(data ?? []).map(m => <li key={m.id}><Link href={`/os/meetings/${m.id}`}>{m.title}</Link><span className="os-muted">{formatDateTime(m.starts_at)}</span></li>)}</ul>}</Panel>
    </Page>
  );
}
