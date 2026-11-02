import type { Metadata } from "next";
import Link from "next/link";
import { Empty, Meter, ViewSwitch } from "@/components/os/ui";
import { can, displayName, requireMe } from "@/lib/os/dal";
import { shortDue } from "@/lib/os/format";
import { createClient, rpc } from "@/lib/os/supabase";
import type { ProjectSummary } from "@/lib/os/types";

export const metadata: Metadata = { title: "Projects" };

function tag(p: ProjectSummary) {
  if (p.event_name) return { text: `Event: ${p.event_name}`, cls: "is-event" };
  if (p.kind === "GLOBAL") return { text: "Shared", cls: "is-shared" };
  return { text: `Private to ${p.department_name ?? "the team"}`, cls: "" };
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const me = await requireMe();
  const { scope } = await searchParams;
  const current = scope === "all" || scope === "archived" ? scope : "team";
  const supabase = await createClient();
  const [projects, { data: myTasks }, { data: myProjects }] = await Promise.all([
    rpc<ProjectSummary[]>("project_summaries", { p_include_archived: true }),
    supabase.from("tasks").select("project_id").eq("assigned_to", me.id).not("status", "in", "(done,cancelled)"),
    supabase.from("project_participants").select("project_id").eq("executive_id", me.id),
  ]);
  const onIt = new Set([...(myTasks ?? []), ...(myProjects ?? [])].map(r => r.project_id));
  const teams = new Set(me.positions.map(p => p.department_name));
  const live = projects.filter(p => !p.archived_at);
  const mine = (p: ProjectSummary) => onIt.has(p.id) || p.lead_name === displayName(me) || Boolean(p.department_name && teams.has(p.department_name)) || p.other_teams.some(t => teams.has(t));
  const rows = current === "archived" ? projects.filter(p => p.archived_at) : current === "all" ? live : live.filter(mine);
  const canCreate = can(me, "project.create_internal") && me.positions.length > 0;
  return (
    <div className="os-page">
      <header className="os-page-head">
        <h1>Projects</h1>
        <div className="os-row os-wrap">
          <ViewSwitch label="Show" items={[{ href: "/os/projects", label: "My team", on: current === "team" }, { href: "/os/projects?scope=all", label: "All of WEC", on: current === "all" }]} />
          {canCreate ? <Link className="os-btn os-btn-primary" href="/os/projects/new">New project</Link> : null}
        </div>
      </header>
      {rows.length === 0 ? <Empty>{current === "team" ? "Your team has no projects yet. Start one, or wait for an approved event to create them." : "Nothing here that you can see."}</Empty> : (
        <ul className="os-project-grid">
          {rows.map(p => {
            const t = tag(p);
            return (
              <li key={p.id} className="os-project-card">
                <div className="os-named">
                  <span>
                    <Link href={`/os/projects/${p.id}`}>{p.name}</Link>
                    <small>{p.lead_name ? `${p.lead_name}, ` : ""}{p.department_name ?? "Organization"}{p.other_teams.length ? `, with ${p.other_teams.join(" and ")}` : ""}</small>
                  </span>
                </div>
                <span className={`os-project-tag ${t.cls}`}>{t.text}</span>
                <div>
                  <Meter value={p.progress} />
                  <p className="os-between-line"><small>{p.done_tasks} of {p.total_tasks} done</small>{p.overdue_tasks ? <small className="os-overdue">{p.overdue_tasks} overdue</small> : <small>{p.due_on ? `Due ${shortDue(p.due_on).replace(/^\w+, /, "")}` : "No date"}</small>}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="os-muted">{current === "archived" ? <Link className="os-link" href="/os/projects">Back to current projects</Link> : <Link className="os-link" href="/os/projects?scope=archived">Archived projects</Link>}</p>
    </div>
  );
}
