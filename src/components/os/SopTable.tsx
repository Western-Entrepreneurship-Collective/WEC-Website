import Link from "next/link";
import { Empty, Pill } from "./ui";
import { formatDate } from "@/lib/os/format";
import type { Sop } from "@/lib/os/types";

export function SopTable({ sops, departmentName }: { sops: Sop[]; departmentName?: (id: string) => string }) {
  if (!sops.length) return <Empty>No SOPs here yet.</Empty>;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="os-table-wrap" tabIndex={0} role="group" aria-label="Table">
      <table className="os-table">
        <thead><tr><th scope="col">SOP</th>{departmentName ? <th scope="col">Department</th> : null}<th scope="col">Status</th><th scope="col">Review by</th></tr></thead>
        <tbody>
          {sops.map(s => (
            <tr key={s.id}>
              <td><Link href={`/os/sops/${s.id}`}>{s.title}</Link></td>
              {departmentName ? <td>{departmentName(s.department_id)}</td> : null}
              <td>{s.archived_at ? <Pill value="archived" /> : s.current_version_id ? <Pill value="published" /> : <Pill value="draft" />}</td>
              <td>{s.review_on ? <span className={s.review_on <= today ? "os-overdue" : undefined}>{formatDate(s.review_on)}</span> : <span className="os-muted">Not set</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
