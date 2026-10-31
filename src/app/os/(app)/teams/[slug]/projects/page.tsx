import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectTable } from "@/components/os/ProjectTable";
import { can } from "@/lib/os/dal";
import { rpc } from "@/lib/os/supabase";
import type { ProjectSummary } from "@/lib/os/types";
import { getTeam } from "../team";

export default async function TeamProjects({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { me, department, canOpen, isMember } = await getTeam(slug);
  if (!canOpen) notFound();
  const projects = await rpc<ProjectSummary[]>("project_summaries", { p_department: department.id, p_include_archived: true });
  return (
    <>
      {isMember && can(me, "project.create_internal") ? <p><Link className="os-btn os-btn-primary" href={`/os/projects/new?kind=INTERNAL&department=${department.id}`}>New internal project</Link></p> : null}
      <ProjectTable projects={projects} empty="This team has no projects yet." />
    </>
  );
}
