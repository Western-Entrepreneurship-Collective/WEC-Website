import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Page, Progress } from "@/components/os/ui";
import { can, requireMe } from "@/lib/os/dal";
import { label, shortDue } from "@/lib/os/format";
import { getSeats, teamLead } from "@/lib/os/org";
import { rpc } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "Team overview" };

type Row = {
  department_id: string; department_name: string; department_slug: string; project_id: string; project_name: string;
  task_title: string | null; assignee_name: string | null; due_at: string | null; task_status: string | null;
};
type Task = { title: string; who: string; dueAt: string | null; status: string };

const percent = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);
const isDone = (t: Task) => t.status === "done";
const isLate = (t: Task, now: number) => !isDone(t) && Boolean(t.dueAt) && new Date(t.dueAt!).getTime() < now;

/** Read-only by design: nothing here links to a project or a task, and neither would open. */
export default async function TeamOverviewPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const me = await requireMe();
  if (!can(me, "overview.view")) notFound();
  const { team: picked } = await searchParams;
  const [rows, seats] = await Promise.all([rpc<Row[]>("team_overview"), getSeats()]);

  const teams = new Map<string, { id: string; name: string; slug: string; projects: Map<string, { name: string; tasks: Task[] }> }>();
  for (const row of rows) {
    const team = teams.get(row.department_id) ?? { id: row.department_id, name: row.department_name, slug: row.department_slug, projects: new Map() };
    teams.set(row.department_id, team);
    const project = team.projects.get(row.project_id) ?? { name: row.project_name, tasks: [] };
    team.projects.set(row.project_id, project);
    if (row.task_title) project.tasks.push({ title: row.task_title, who: row.assignee_name ?? "Nobody yet", dueAt: row.due_at, status: row.task_status ?? "todo" });
  }
  const all = [...teams.values()];
  const shown = all.filter(t => !picked || t.slug === picked);
  const tasks = shown.flatMap(t => [...t.projects.values()].flatMap(p => p.tasks));
  const done = tasks.filter(isDone).length;
  // A server component renders once per request, so this is that request's time.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <Page title="Team overview" subtitle="What every team is working on, and how far along it is.">
      <dl className="os-numbers os-overview-numbers">
        <div><dt>Complete</dt><dd>{percent(done, tasks.length)}%</dd></div>
        <div><dt>Tasks done</dt><dd>{done} of {tasks.length}</dd></div>
        <div><dt>Overdue</dt><dd className={tasks.some(t => isLate(t, now)) ? "os-overdue" : undefined}>{tasks.filter(t => isLate(t, now)).length}</dd></div>
      </dl>
      {all.length ? (
        <nav className="os-overview-filter" aria-label="Filter by team">
          <Link href="/os/overview" aria-current={picked ? undefined : "page"}>All teams</Link>
          {all.map(t => <Link key={t.id} href={`/os/overview?team=${t.slug}`} aria-current={picked === t.slug ? "page" : undefined}>{t.name}</Link>)}
        </nav>
      ) : null}
      {shown.length === 0 ? <p className="os-muted">No team has an active project yet.</p> : null}
      {shown.map(team => {
        const teamTasks = [...team.projects.values()].flatMap(p => p.tasks);
        const teamPercent = percent(teamTasks.filter(isDone).length, teamTasks.length);
        return (
          <section key={team.id} className="os-panel os-overview-team" aria-label={team.name}>
            <header>
              <div>
                <h2>{team.name}</h2>
                <small>Led by {teamLead(seats, team.id) ?? "nobody yet"}</small>
              </div>
              <div className="os-overview-meter"><Progress value={teamPercent} /><strong>{teamPercent}%</strong></div>
            </header>
            {[...team.projects.entries()].map(([id, project]) => {
              const finished = project.tasks.filter(isDone).length;
              const projectPercent = percent(finished, project.tasks.length);
              return (
                <div key={id} className="os-overview-project">
                  <div className="os-overview-project-head">
                    <h3>{project.name}</h3>
                    <span>{finished} of {project.tasks.length} done, {projectPercent}%</span>
                  </div>
                  <Progress value={projectPercent} />
                  {project.tasks.length ? (
                    <div className="os-table-wrap" tabIndex={0} role="group" aria-label={`${project.name} tasks`}>
                      <table className="os-overview-tasks">
                        <thead><tr><th scope="col">Task</th><th scope="col">Who</th><th scope="col">Due</th><th scope="col">Status</th></tr></thead>
                        <tbody>
                          {project.tasks.map((task, i) => (
                            <tr key={i}>
                              <td>{task.title}</td>
                              <td>{task.who}</td>
                              <td className={isLate(task, now) ? "os-overdue" : undefined}>{task.dueAt ? shortDue(task.dueAt) : "None"}</td>
                              <td>{label(task.status)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="os-muted">No tasks yet.</p>}
                </div>
              );
            })}
          </section>
        );
      })}
    </Page>
  );
}
