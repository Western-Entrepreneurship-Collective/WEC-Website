import { ActionForm } from "@/components/os/ActionForm";
import { Field, Hidden, Panel } from "@/components/os/ui";
import { togglePermission } from "@/lib/os/actions/admin";
import { createClient } from "@/lib/os/supabase";
import { SubmitButton } from "@/components/os/ActionForm";

const ROLES = ["president", "vp", "director", "coordinator"];

export default async function AdminPermissions() {
  const supabase = await createClient();
  const [{ data: permissions }, { data: grants }, { data: positions }, { data: departments }] = await Promise.all([
    supabase.from("permissions").select("*").order("key"),
    supabase.from("permission_grants").select("*, positions(title), departments(name), executives(full_name)"),
    supabase.from("positions").select("id, title").is("archived_at", null).order("title"),
    supabase.from("departments").select("id, name").is("archived_at", null).order("sort_order"),
  ]);
  const all = grants ?? [];
  const has = (key: string, role: string) => all.some(g => g.permission_key === key && g.org_role === role);
  const specific = all.filter(g => !g.org_role);
  return (
    <>
      <p className="os-muted">Who may do what, by role. Some rules are not here because they are not settings: internal projects stay private to their team, archived records stay read-only, and the audit log cannot be edited. Being an administrator is separate from all of this.</p>
      <Panel title="By role">
        <div className="os-table-wrap" tabIndex={0} role="group" aria-label="Table">
          <table className="os-table os-matrix">
            <thead><tr><th scope="col">Permission</th>{ROLES.map(r => <th key={r} scope="col">{r === "vp" ? "VP" : r[0].toUpperCase() + r.slice(1)}</th>)}</tr></thead>
            <tbody>
              {(permissions ?? []).map(p => (
                <tr key={p.key}>
                  <td>{p.description}<small className="os-muted os-block">{p.key}</small></td>
                  {ROLES.map(r => (
                    <td key={r}>
                      <ActionForm action={togglePermission}>
                        <Hidden name="permission" value={p.key} /><Hidden name="org_role" value={r} /><Hidden name="granted" value={has(p.key, r) ? "false" : "true"} />
                        <button type="submit" className="os-tick" aria-pressed={has(p.key, r)} aria-label={`${has(p.key, r) ? "Remove" : "Grant"} ${p.description} for ${r}`}>{has(p.key, r) ? "✓" : ""}</button>
                      </ActionForm>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="For a specific position or department">
        <ul className="os-list">
          {specific.map(g => (
            <li key={g.id}>
              <span>{g.permission_key} <span className="os-muted">{g.positions?.title ?? g.departments?.name ?? g.executives?.full_name}</span></span>
              <ActionForm action={togglePermission} confirm="Remove this permission?">
                <Hidden name="permission" value={g.permission_key} /><Hidden name="position" value={g.position_id} /><Hidden name="department" value={g.department_id} /><Hidden name="executive" value={g.executive_id} /><Hidden name="granted" value="false" />
                <button className="os-link-btn" type="submit">Remove</button>
              </ActionForm>
            </li>
          ))}
        </ul>
        <ActionForm action={togglePermission} className="os-inline-form">
          <Hidden name="granted" value="true" />
          <Field label="Permission"><select name="permission" required>{(permissions ?? []).map(p => <option key={p.key} value={p.key}>{p.key}</option>)}</select></Field>
          <Field label="Position"><select name="position" defaultValue=""><option value="">None</option>{(positions ?? []).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>
          <Field label="Or department"><select name="department" defaultValue=""><option value="">None</option>{(departments ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <SubmitButton variant="ghost">Grant</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
