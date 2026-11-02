import type { Metadata } from "next";
import Link from "next/link";
import { Page, Person } from "@/components/os/ui";
import { can, getDepartments, requireMe } from "@/lib/os/dal";
import { getSeats } from "@/lib/os/org";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage() {
  const me = await requireMe();
  const [departments, seats] = await Promise.all([getDepartments(), getSeats()]);
  const mine = departments.filter(d => me.positions.some(p => p.department_id === d.id));
  const others = departments.filter(d => !mine.includes(d));
  const canSend = can(me, "request.create") && mine.length > 0;
  return (
    <Page title="Teams">
      {mine.map(d => (
        <Link key={d.id} href={`/os/teams/${d.slug}`} className="os-my-team">
          <span>
            <small>Your team</small>
            <strong>{d.name}</strong>
            <span>{d.description}</span>
          </span>
          <b>Open your team</b>
        </Link>
      ))}
      <ul className="os-team-grid">
        {others.map(d => {
          const lead = seats.find(s => s.departmentId === d.id && s.isHead)?.name;
          return (
            <li key={d.id} className="os-team-card">
              <div className="os-named">
                <span><Link href={`/os/teams/${d.slug}`}><Person name={lead ?? "Lead seat open"} title={d.name} /></Link><small>{d.description}</small></span>
              </div>
              <div className="os-team-foot">
                {canSend ? <Link className="os-btn os-btn-ghost" href={`/os/tasks/new?to=${d.id}`} aria-label={`Send ${d.name} a task`}>Send a task</Link> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
