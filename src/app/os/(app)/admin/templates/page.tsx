import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Field, Panel } from "@/components/os/ui";
import { saveTemplate } from "@/lib/os/actions/admin";
import { label } from "@/lib/os/format";
import { createClient } from "@/lib/os/supabase";

const STARTER = JSON.stringify({ project_name: "New project", lead_position: null, anchor: "project_start", tasks: [{ key: "first", title: "First task", priority: "normal", offset: { default: 7 } }] }, null, 2);

export default async function AdminTemplates() {
  const supabase = await createClient();
  const [{ data: templates }, { data: departments }, { data: versions }] = await Promise.all([
    supabase.from("templates").select("*").order("kind").order("name"),
    supabase.from("departments").select("id, name").order("sort_order"),
    supabase.from("template_versions").select("id, version"),
  ]);
  const versionOf = (id: string | null) => versions?.find(v => v.id === id)?.version;
  const groups = ["event_project", "global", "internal"] as const;
  const titles = { event_project: "Event Project templates", global: "Global Project templates", internal: "Internal Project templates" };
  return (
    <>
      {groups.map(g => (
        <Panel key={g} title={titles[g]}>
          <ul className="os-list">
            {(templates ?? []).filter(t => t.kind === g).map(t => (
              <li key={t.id}>
                <span><Link href={`/os/admin/templates/${t.id}`}>{t.name}</Link> <span className="os-muted">{departments?.find(d => d.id === t.department_id)?.name}</span>{t.archived_at ? <span className="os-tag">{label("archived")}</span> : null}</span>
                <span className="os-muted">v{versionOf(t.current_version_id)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
      <Panel title="New template">
        <ActionForm action={saveTemplate} className="os-stack">
          <div className="os-form-grid">
            <Field label="Name"><input name="name" required maxLength={160} /></Field>
            <Field label="Key" hint="Lowercase letters, numbers and hyphens. Permanent."><input name="key" required pattern="[a-z0-9_\-]+" /></Field>
            <Field label="Used for"><select name="kind"><option value="internal">Internal projects</option><option value="global">Global projects</option><option value="event_project">Event projects</option></select></Field>
            <Field label="Department"><select name="department" defaultValue=""><option value="">None</option>{(departments ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          </div>
          <Field label="Description"><input name="description" /></Field>
          <Field label="Definition"><textarea name="definition" rows={12} className="os-mono" defaultValue={STARTER} /></Field>
          <div><SubmitButton>Create template</SubmitButton></div>
        </ActionForm>
      </Panel>
    </>
  );
}
