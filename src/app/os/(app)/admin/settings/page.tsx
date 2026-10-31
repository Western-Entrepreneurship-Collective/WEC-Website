import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Field, Hidden, Panel } from "@/components/os/ui";
import { setSetting } from "@/lib/os/actions/admin";
import { createClient } from "@/lib/os/supabase";

export default async function AdminSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("*").neq("key", "sweep_heartbeat").order("key");
  return (
    <Panel title="System settings">
      <p className="os-muted">Retention covers logs and notifications only. Historical records are never purged.</p>
      <div className="os-stack">
        {(data ?? []).map(s => (
          <ActionForm key={s.key} action={setSetting} className="os-inline-form" ariaLabel={s.description}>
            <Hidden name="key" value={s.key} />
            <Field label={s.description}><input name="value" className="os-mono" defaultValue={JSON.stringify(s.value)} required /></Field>
            <SubmitButton variant="ghost">Save</SubmitButton>
          </ActionForm>
        ))}
      </div>
    </Panel>
  );
}
