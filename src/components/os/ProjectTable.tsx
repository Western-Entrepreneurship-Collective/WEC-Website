import Link from "next/link";
import { Avatar, Due, Empty, Progress, Status } from "./ui";
import { label, projectKindHelp } from "@/lib/os/format";
import type { ProjectSummary } from "@/lib/os/types";

export function projectHealth(p: Pick<ProjectSummary, "status" | "progress" | "overdue_tasks" | "approval_status">) {
  if (p.approval_status === "pending") return { tone: "warn", text: "Awaiting approval" };
  if (p.status === "completed") return { tone: "good", text: "Completed" };
  if (p.status === "cancelled") return { tone: "plain", text: "Cancelled" };
  if (p.status === "on_hold") return { tone: "warn", text: "On hold" };
  if (p.overdue_tasks > 0) return { tone: "bad", text: "Behind" };
  if (p.progress === 0) return { tone: "plain", text: "Not started" };
  return { tone: "good", text: "On track" };
}

export function ProjectTable({ projects, empty }: { projects: ProjectSummary[]; empty: string }) {
  if (!projects.length) return <Empty>{empty}</Empty>;
  return (
    <div className="os-table-wrap os-card-table" tabIndex={0} role="group" aria-label="Projects">
      <table className="os-table">
        <thead><tr><th scope="col">Project</th><th scope="col" className="os-wide-only">Lead</th><th scope="col">Progress</th><th scope="col">Next deadline</th><th scope="col">Status</th></tr></thead>
        <tbody>
          {projects.map(p => {
            const health = projectHealth(p);
            return (
              <tr key={p.id}>
                <td>
                  <Link className="os-row-title" href={`/os/projects/${p.id}`}>{p.name}</Link>
                  {p.archived_at ? <span className="os-tag">Archived</span> : null}
                  <small className="os-block os-muted">{label(p.kind)}{p.department_name ? `, ${p.department_name}` : ""}. {p.can_open ? projectKindHelp[p.kind] : "Progress only"}.</small>
                </td>
                <td className="os-wide-only"><span className="os-row"><Avatar name={p.lead_name} />{p.lead_name ?? "No lead"}</span></td>
                <td><div className="os-list-side"><Progress value={p.progress} /><span className="os-muted">{p.progress}%</span></div></td>
                <td>{p.overdue_tasks > 0 ? <span className="os-due os-due-bad">{p.overdue_tasks} task{p.overdue_tasks === 1 ? "" : "s"} late</span> : p.next_due ? <Due value={p.next_due} /> : <span className="os-muted">None</span>}</td>
                <td><Status tone={health.tone}>{health.text}</Status></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
