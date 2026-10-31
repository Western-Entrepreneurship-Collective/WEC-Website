import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, Page } from "@/components/os/ui";
import { getDepartments, requireMe } from "@/lib/os/dal";
import { getSeats } from "@/lib/os/org";

export const metadata: Metadata = { title: "All Teams" };

export default async function TeamsPage() {
  const me = await requireMe();
  const [departments, seats] = await Promise.all([getDepartments(), getSeats()]);
  const presidentFilled = seats.some(s => s.orgRole === "president" && s.name);
  const mine = departments.filter(d => me.positions.some(p => p.department_id === d.id));
  const others = departments.filter(d => !mine.includes(d));
  const leadOf = (id: string) => seats.find(s => s.departmentId === id && s.isHead);
  return (
    <Page title="All Teams" subtitle="Who does what at WEC, and who to ask. Each team's own work stays private to that team.">
      {mine.map(d => (
        <Link key={d.id} href={`/os/teams/${d.slug}`} className="os-feature os-feature-row">
          <span>
            <small>Your team</small>
            <strong>{d.name}</strong>
            <span>{d.description}{leadOf(d.id)?.name ? ` Led by ${leadOf(d.id)?.name}.` : ""}</span>
          </span>
          <span className="os-btn os-btn-invert">Open your team</span>
        </Link>
      ))}
      <ul className="os-team-grid">
        {others.map(d => {
          const lead = leadOf(d.id);
          const open = seats.filter(s => s.departmentId === d.id && !s.name).length;
          return (
            <li key={d.id}>
              <Link href={`/os/teams/${d.slug}`} className="os-team-card">
                <h2>{d.name}</h2>
                <p>{d.description}</p>
                <span className="os-team-lead">
                  <Avatar name={lead?.name} />
                  <span>
                    <strong className={lead?.name ? undefined : "os-warn-text"}>{lead?.name ?? "Lead seat open"}</strong>
                    <small>{lead?.name ? (open ? `${open} open seat${open === 1 ? "" : "s"}` : "Full team") : presidentFilled ? "Requests go to the President" : "Requests wait for a lead"}</small>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
