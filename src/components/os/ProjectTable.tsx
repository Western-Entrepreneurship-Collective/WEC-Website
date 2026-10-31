import Link from "next/link";
import { Empty, Pill, Progress } from "./ui";
import { formatDate, label } from "@/lib/os/format";
import type { ProjectSummary } from "@/lib/os/types";

export function ProjectTable({ projects, empty }: { projects: ProjectSummary[]; empty: string }) {
  if (!projects.length) return <Empty>{empty}</Empty>;
  return (
    <div className="os-table-wrap" tabIndex={0} role="group" aria-label="Table">
      <table className="os-table">
        <thead><tr><th scope="col">Project</th><th scope="col">Type</th><th scope="col">Team</th><th scope="col">Status</th><th scope="col">Progress</th><th scope="col">Due</th></tr></thead>
        <tbody>
          {projects.map(p => (
            <tr key={p.id}>
              <td>{p.can_open ? <Link href={`/os/projects/${p.id}`}>{p.name}</Link> : p.name}{p.archived_at ? <span className="os-tag">Archived</span> : null}{p.approval_status === "pending" ? <span className="os-tag">Awaiting approval</span> : null}</td>
              <td>{label(p.kind)}</td>
              <td>{p.department_name ?? "Organization"}</td>
              <td><Pill value={p.status} /></td>
              <td><div className="os-list-side"><Progress value={p.progress} /><span className="os-muted">{p.progress}%</span></div></td>
              <td>{formatDate(p.due_on)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
