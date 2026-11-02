import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Field, Hidden, Panel } from "@/components/os/ui";
import { saveTemplate, setTemplateArchived } from "@/lib/os/actions/admin";
import { formatDateTime } from "@/lib/os/format";
import { createClient } from "@/lib/os/supabase";

export default async function AdminTemplate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: template } = await supabase.from("templates").select("*").eq("id", id).maybeSingle();
  if (!template) notFound();
  const [{ data: versions }, { data: departments }] = await Promise.all([
    supabase.from("template_versions").select("*").eq("template_id", id).order("version", { ascending: false }),
    supabase.from("departments").select("id, name").order("sort_order"),
  ]);
  const current = versions?.find(v => v.id === template.current_version_id);
  return (
    <>
      <Panel title={template.name}>
        <ActionForm action={saveTemplate} className="os-stack">
          <Hidden name="id" value={id} />
          <div className="os-form-grid">
            <Field label="Name"><input name="name" defaultValue={template.name} required maxLength={160} /></Field>
            <Field label="Department"><select name="department" defaultValue={template.department_id ?? ""}><option value="">None</option>{(departments ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          </div>
          <Field label="Description"><input name="description" defaultValue={template.description} /></Field>
          <Field label="Definition" hint="Saving makes a new version. Projects already made keep the version that made them.">
            <textarea name="definition" rows={26} className="os-mono" defaultValue={JSON.stringify(current?.definition ?? {}, null, 2)} />
          </Field>
          <div><SubmitButton>Save as a new version</SubmitButton></div>
        </ActionForm>
        <ActionForm action={setTemplateArchived} confirm={template.archived_at ? "Bring this template back into use?" : "Stop using this template? Existing projects are not affected."}>
          <Hidden name="id" value={id} /><Hidden name="archived" value={template.archived_at ? "false" : "true"} />
          <SubmitButton variant="ghost">{template.archived_at ? "Restore" : "Retire this template"}</SubmitButton>
        </ActionForm>
      </Panel>
      <Panel title="How a definition works">
        <dl className="os-dl">
          <div><dt>anchor</dt><dd>What dates count from: event_start, event_end, project_start, project_due</dd></div>
          <div><dt>offset</dt><dd>Days from the anchor, by tier: {`{"A":-28,"B":-21,"C":-14}`}, or {`{"default":7}`}</dd></div>
          <div><dt>depends_on</dt><dd>Keys of tasks in this template that must finish first</dd></div>
          <div><dt>activation, condition</dt><dd>{`{"field":"requires_sponsorship","eq":true}`}, combined with all and any. Fields: tier and each requires_ flag on the event</dd></div>
          <div><dt>subtasks</dt><dd>The same shape, under a task</dd></div>
          <div><dt>lead_position</dt><dd>Who leads the project and first holds its tasks</dd></div>
          <div><dt>followups</dt><dd>Tasks created when the project completes: key, title, due_days</dd></div>
          <div><dt>sop_ids</dt><dd>SOPs whose current version is pinned to each new project</dd></div>
        </dl>
      </Panel>
      <Panel title="Versions">
        <ul className="os-list">{(versions ?? []).map(v => <li key={v.id}><span>Version {v.version}{v.id === template.current_version_id ? " (current)" : ""}</span><span className="os-muted">{formatDateTime(v.created_at)}</span></li>)}</ul>
      </Panel>
    </>
  );
}
