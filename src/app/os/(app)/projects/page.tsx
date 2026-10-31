import type { Metadata } from "next";
import Link from "next/link";
import { ProjectTable } from "@/components/os/ProjectTable";
import { Page } from "@/components/os/ui";
import { can, displayName, requireMe } from "@/lib/os/dal";
import { createClient, rpc } from "@/lib/os/supabase";
import type { ProjectSummary } from "@/lib/os/types";

export const metadata: Metadata = { title: "Projects" };

const FILTERS = [["mine", "Mine"], ["team", "My team"], ["event", "Events"], ["global", "Global"], ["archived", "Archived"]] as const;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const me = await requireMe();
  const { show } = await searchParams;
  const current = FILTERS.some(([id]) => id === show) ? show! : "mine";
  const supabase = await createClient();
  const [projects, { data: myTasks }, { data: myProjects }] = await Promise.all([
    rpc<ProjectSummary[]>("project_summaries", { p_include_archived: true }),
    supabase.from("tasks").select("project_id").eq("assigned_to", me.id).not("status", "in", "(done,cancelled)"),
    supabase.from("project_participants").select("project_id").eq("executive_id", me.id),
  ]);
  const onIt = new Set([...(myTasks ?? []), ...(myProjects ?? [])].map(r => r.project_id));
  const teams = new Set(me.positions.map(p => p.department_name));
  const live = projects.filter(p => !p.archived_at && p.approval_status !== "rejected");
  const tests: Record<string, (p: ProjectSummary) => boolean> = {
    mine: p => onIt.has(p.id) || p.lead_name === displayName(me),
    team: p => Boolean(p.department_name && teams.has(p.department_name)),
    event: p => p.kind === "EVENT",
    global: p => p.kind === "GLOBAL",
  };
  const countOf = (id: string) => (id === "archived" ? projects.filter(p => p.archived_at).length : live.filter(tests[id]).length);
  const rows = current === "archived" ? projects.filter(p => p.archived_at) : live.filter(tests[current]);
  const empty: Record<string, string> = {
    mine: "You're not on any projects yet. When you're given a task or added to a project, it shows up here.",
    team: "Your team has no projects yet.",
    event: "No event projects you can see yet. They're created when an event is approved.",
    global: "No Global Projects have been published.",
    archived: "Nothing archived that you can see.",
  };
  const canCreate = can(me, "project.create_internal") && me.positions.length > 0;
  return (
    <Page title="Projects" subtitle="Everything you can see, in one list. Pick a view to narrow it down." actions={canCreate ? <Link className="os-btn os-btn-primary" href="/os/projects/new?kind=INTERNAL">New project</Link> : null}>
      <nav className="os-chips" aria-label="Filter projects">
        {FILTERS.map(([id, name]) => <Link key={id} className="os-chip" href={id === "mine" ? "/os/projects" : `/os/projects?show=${id}`} aria-current={id === current ? "page" : undefined}>{name} <span>{countOf(id)}</span></Link>)}
      </nav>
      <ProjectTable projects={rows} empty={empty[current]} />
      {rows.some(p => !p.can_open) ? <p className="os-muted">&quot;Progress only&quot; means you can see how a project is going. Its tasks stay with the people working on it.</p> : null}
    </Page>
  );
}
