import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Field, Page, PriorityField } from "@/components/os/ui";
import { createRequest } from "@/lib/os/actions/work";
import { can, getDepartments, requireMe } from "@/lib/os/dal";
import { createClient } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "New cross-team request" };

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ project?: string; to?: string }> }) {
  const me = await requireMe();
  if (!can(me, "request.create")) notFound();
  const { project, to } = await searchParams;
  const supabase = await createClient();
  const [departments, { data: projects }] = await Promise.all([
    getDepartments(),
    supabase.from("projects").select("id, name").is("archived_at", null).in("status", ["planning", "active", "on_hold"]).order("name").limit(300),
  ]);
  const mine = me.positions;
  return (
    <Page title="New cross-team request">
      <ActionForm action={createRequest} className="os-stack os-panel">
        <p className="os-note">The receiving team will see this request and the name of the project it belongs to. They will not see anything else in that project.</p>
        <div className="os-form-grid">
          <Field label="Title"><input name="title" required maxLength={200} /></Field>
          <Field label="From project">
            <select name="project" defaultValue={project ?? ""} required>
              <option value="" disabled>Choose a project</option>
              {(projects ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Your team">
            <select name="requesting" required>{mine.map(p => <option key={p.position_id} value={p.department_id}>{p.department_name}</option>)}</select>
          </Field>
          <Field label="Send to">
            <select name="receiving" required defaultValue={to ?? ""}>
              <option value="" disabled>Choose a team</option>
              {departments.filter(d => !mine.some(p => p.department_id === d.id)).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Due"><input name="due_at" type="datetime-local" /></Field>
          <PriorityField />
        </div>
        <Field label="What you need"><textarea name="description" rows={3} /></Field>
        <Field label="Deliverables"><textarea name="deliverables" rows={2} /></Field>
        <div><SubmitButton>Send request</SubmitButton></div>
      </ActionForm>
    </Page>
  );
}
