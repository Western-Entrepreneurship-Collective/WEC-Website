import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Field, Hidden, Panel } from "@/components/os/ui";
import { archivePosition, saveDepartment, savePosition } from "@/lib/os/actions/admin";
import { createClient } from "@/lib/os/supabase";

const ROLES = [["vp", "Vice President"], ["director", "Director"], ["coordinator", "Coordinator"], ["president", "President"]];

export default async function AdminOrg() {
  const supabase = await createClient();
  const [{ data: departments }, { data: positions }] = await Promise.all([
    supabase.from("departments").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("positions").select("*").is("archived_at", null).order("sort_order"),
  ]);
  const all = positions ?? [];
  const positionFields = (departmentId: string, p?: (typeof all)[number]) => (
    <>
      <Hidden name="id" value={p?.id} /><Hidden name="department" value={departmentId} />
      <Field label="Title"><input name="title" defaultValue={p?.title} required maxLength={80} /></Field>
      <Field label="Role"><select name="org_role" defaultValue={p?.org_role ?? "director"}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      <Field label="Reports to"><select name="reports_to" defaultValue={p?.reports_to_position_id ?? ""}><option value="">Nobody</option>{all.filter(x => x.id !== p?.id).map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select></Field>
      <Field label="Seats"><input name="seats" type="number" min="1" max="50" defaultValue={p?.seat_count ?? 1} /></Field>
      <SubmitButton variant="ghost">{p ? "Save" : "Add position"}</SubmitButton>
    </>
  );
  return (
    <>
      {(departments ?? []).map(d => (
        <Panel key={d.id} title={d.name}>
          <details>
            <summary>Edit department</summary>
            <ActionForm action={saveDepartment} className="os-stack">
              <Hidden name="id" value={d.id} />
              <div className="os-form-grid">
                <Field label="Name"><input name="name" defaultValue={d.name} required maxLength={80} /></Field>
                <Field label="Short name" hint="Used in links. Lowercase, with hyphens."><input name="slug" defaultValue={d.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></Field>
                <Field label="Head" hint="Receives this department's requests."><select name="head" defaultValue={d.head_position_id ?? ""}><option value="">None</option>{all.filter(p => p.department_id === d.id).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>
              </div>
              <Field label="Description"><input name="description" defaultValue={d.description} /></Field>
              <div><SubmitButton variant="ghost">Save department</SubmitButton></div>
            </ActionForm>
          </details>
          {all.filter(p => p.department_id === d.id).map(p => (
            <div key={p.id} className="os-position-row">
              <ActionForm action={savePosition} className="os-inline-form" ariaLabel={`Edit ${p.title}`}>{positionFields(d.id, p)}</ActionForm>
              <ActionForm action={archivePosition} confirm={`Retire the position ${p.title}? Its history stays.`}><Hidden name="id" value={p.id} /><button className="os-link-btn" type="submit">Retire</button></ActionForm>
            </div>
          ))}
          <details>
            <summary>Add a position</summary>
            <ActionForm action={savePosition} className="os-inline-form" resetOnSuccess ariaLabel={`Add a position to ${d.name}`}>{positionFields(d.id)}</ActionForm>
          </details>
        </Panel>
      ))}
      <Panel title="Add a department">
        <ActionForm action={saveDepartment} className="os-inline-form" resetOnSuccess>
          <Field label="Name"><input name="name" required maxLength={80} /></Field>
          <Field label="Short name"><input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></Field>
          <Field label="Description"><input name="description" /></Field>
          <SubmitButton variant="ghost">Add department</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
