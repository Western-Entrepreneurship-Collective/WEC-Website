import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Check, Empty, Field, Hidden, Panel, Pill } from "@/components/os/ui";
import { updateRule } from "@/lib/os/actions/admin";
import { formatDateTime } from "@/lib/os/format";
import { createClient } from "@/lib/os/supabase";

export default async function AdminAutomation() {
  const supabase = await createClient();
  const [{ data: rules }, { data: runs }] = await Promise.all([
    supabase.from("automation_rules").select("*").order("category").order("name"),
    supabase.from("automation_runs").select("*, automation_rules(name)").order("started_at", { ascending: false }).limit(100),
  ]);
  return (
    <>
      {(["deadline", "recurring"] as const).map(cat => (
        <Panel key={cat} title={cat === "deadline" ? "Reminders" : "Recurring work"}>
          <ul className="os-people">
            {(rules ?? []).filter(r => r.category === cat).map(r => (
              <li key={r.id}>
                <details>
                  <summary><span><strong>{r.name}</strong> <span className="os-muted">{r.description}</span></span><span className={r.enabled ? "os-pill os-tone-good" : "os-pill os-tone-plain"}>{r.enabled ? "On" : "Off"}</span></summary>
                  <ActionForm action={updateRule} className="os-stack">
                    <Hidden name="id" value={r.id} />
                    <Check name="enabled" label="On" defaultChecked={r.enabled} />
                    <Field label="Settings"><textarea name="config" rows={3} className="os-mono" defaultValue={JSON.stringify(r.config)} /></Field>
                    <Field label="Schedule"><textarea name="schedule" rows={2} className="os-mono" defaultValue={JSON.stringify(r.schedule)} /></Field>
                    <div><SubmitButton variant="ghost">Save</SubmitButton></div>
                  </ActionForm>
                </details>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
      <Panel title="Execution log">
        {(runs ?? []).length === 0 ? <Empty>Nothing has run yet.</Empty> : (
          <div className="os-table-wrap" tabIndex={0} role="group" aria-label="Table">
            <table className="os-table">
              <thead><tr><th scope="col">Rule</th><th scope="col">Occurrence</th><th scope="col">Result</th><th scope="col">Items</th><th scope="col">When</th></tr></thead>
              <tbody>{(runs ?? []).map(r => <tr key={r.id}><td>{r.automation_rules?.name}</td><td>{r.occurrence_key}</td><td><Pill value={r.status} />{r.error ? <small className="os-block os-overdue">{r.error}</small> : null}</td><td>{r.items_created}</td><td>{formatDateTime(r.started_at)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
