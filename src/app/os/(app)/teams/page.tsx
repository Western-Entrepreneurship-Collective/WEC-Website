import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/os/ui";
import { getDepartments, requireMe } from "@/lib/os/dal";
import { createClient } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage() {
  const me = await requireMe();
  const departments = await getDepartments();
  const supabase = await createClient();
  const { data: seats } = await supabase.from("position_assignments").select("executive_id, during, positions!inner(department_id)");
  const today = new Date().toISOString().slice(0, 10);
  const counts = new Map<string, number>();
  for (const s of seats ?? []) {
    const upper = String(s.during).split(",")[1]?.replace(/[)\]]/, "");
    if (!upper || upper > today) counts.set(s.positions.department_id, (counts.get(s.positions.department_id) ?? 0) + 1);
  }
  return (
    <Page title="Teams">
      <ul className="os-team-grid">
        {departments.map(d => (
          <li key={d.id}>
            <Link href={`/os/teams/${d.slug}`} className="os-team-card">
              <h2>{d.name}</h2>
              <p>{d.description}</p>
              <span className="os-muted">{counts.get(d.id) ?? 0} {counts.get(d.id) === 1 ? "person" : "people"}{me.positions.some(p => p.department_id === d.id) ? " · your team" : ""}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
