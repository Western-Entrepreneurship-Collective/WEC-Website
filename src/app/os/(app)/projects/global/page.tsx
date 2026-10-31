import type { Metadata } from "next";
import Link from "next/link";
import { ProjectTable } from "@/components/os/ProjectTable";
import { Page, Panel } from "@/components/os/ui";
import { can, requireMe } from "@/lib/os/dal";
import { rpc } from "@/lib/os/supabase";
import type { ProjectSummary } from "@/lib/os/types";

export const metadata: Metadata = { title: "Global Projects" };

export default async function GlobalProjectsPage() {
  const me = await requireMe();
  const projects = await rpc<ProjectSummary[]>("project_summaries", { p_kind: "GLOBAL", p_include_archived: true });
  const published = projects.filter(p => p.approval_status === "approved");
  const mine = projects.filter(p => p.approval_status !== "approved");
  return (
    <Page title="Global Projects" actions={can(me, "global.submit") ? <Link className="os-btn os-btn-primary" href="/os/projects/new?kind=GLOBAL">{me.is_president ? "New Global Project" : "Propose a Global Project"}</Link> : null}>
      <p className="os-muted">Organization-wide initiatives. Every executive sees the summary; task details stay with the people working on them.</p>
      <Panel title="Published"><ProjectTable projects={published} empty="No Global Projects have been published." /></Panel>
      {mine.length ? <Panel title="Drafts and proposals"><ProjectTable projects={mine} empty="" /></Panel> : null}
    </Page>
  );
}
