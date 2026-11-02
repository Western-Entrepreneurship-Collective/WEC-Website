import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { ProjectForm } from "@/components/os/ProjectForm";
import { Check, Hidden, Panel } from "@/components/os/ui";
import { archiveProject, setProjectPeople, setProjectStatus } from "@/lib/os/actions/work";
import { displayName, getDepartments, getDirectory, requireMe } from "@/lib/os/dal";
import { label } from "@/lib/os/format";
import { createClient } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!project) notFound();
  // The same rule the database applies, so this page never offers what would be refused.
  const manages = !project.archived_at && (me.is_president || project.lead_executive_id === me.id || me.positions.some(p => p.is_head && p.department_id === project.owning_department_id));
  if (!manages) notFound();
  const [departments, directory, teams, parts] = await Promise.all([
    getDepartments(),
    getDirectory(),
    supabase.from("project_departments").select("department_id").eq("project_id", id),
    supabase.from("project_participants").select("executive_id").eq("project_id", id),
  ]);
  const teamIds = (teams.data ?? []).map(t => t.department_id);
  const people = directory.filter(p => p.status === "active");
  const participating = (parts.data ?? []).map(p => p.executive_id);
  return (
    <div className="os-page os-page-narrow">
      <ProjectForm
        project={{
          id, name: project.name, summary: project.summary, lead: project.lead_executive_id, starts_on: project.starts_on, due_on: project.due_on, updated_at: project.updated_at,
          team: project.owning_department_id ?? "", teams: teamIds, fixedEvent: project.kind === "EVENT", visibility: project.visibility, share: project.share_progress_with_event_lead,
        }}
        myTeams={departments.filter(d => d.id === project.owning_department_id).map(d => ({ id: d.id, name: d.name }))}
        otherTeams={departments.filter(d => d.id !== project.owning_department_id).map(d => ({ id: d.id, name: d.name }))}
        events={[]} templates={[]} people={people.map(p => ({ id: p.id, name: displayName(p) }))}
      />
      <Panel title="Status">
        <div className="os-row os-wrap">
          {["planning", "active", "on_hold", "completed", "cancelled"].filter(s => s !== project.status).map(s => (
            <ActionForm key={s} action={setProjectStatus}><Hidden name="id" value={id} /><Hidden name="status" value={s} /><SubmitButton variant="ghost">{label(s)}</SubmitButton></ActionForm>
          ))}
        </div>
        {["completed", "cancelled"].includes(project.status) ? (
          <ActionForm action={archiveProject} confirm="Archive this project? It becomes read-only, and nothing is deleted."><Hidden name="id" value={id} /><SubmitButton variant="ghost">Archive</SubmitButton></ActionForm>
        ) : null}
      </Panel>
      <details className="os-more os-panel">
        <summary>Add individual people</summary>
        <ActionForm action={setProjectPeople} className="os-stack">
          <Hidden name="id" value={id} />
          {teamIds.map(t => <Hidden key={t} name="departments" value={t} />)}
          <div className="os-check-grid">{people.map(p => <Check key={p.id} name="participants" value={p.id} label={displayName(p)} defaultChecked={participating.includes(p.id)} />)}</div>
          <div><SubmitButton variant="ghost">Save people</SubmitButton></div>
        </ActionForm>
      </details>
    </div>
  );
}
