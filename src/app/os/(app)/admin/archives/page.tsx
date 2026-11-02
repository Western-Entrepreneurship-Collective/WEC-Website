import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Empty, Field, Hidden, Panel } from "@/components/os/ui";
import { restoreArchived } from "@/lib/os/actions/admin";
import { formatDate } from "@/lib/os/format";
import { rpc } from "@/lib/os/supabase";

type Archived = { record_type: string; record_id: string; label: string; archived_at: string };

export default async function AdminArchives() {
  const rows = await rpc<Archived[]>("archived_records");
  return (
    <Panel title="Archived records">
      <p className="os-muted">Nothing here is deleted. Restoring is for exceptions, and the reason goes on the record.</p>
      {rows.length === 0 ? <Empty>Nothing is archived.</Empty> : (
        <ul className="os-people">
          {rows.map(r => (
            <li key={r.record_type + r.record_id}>
              <details>
                <summary><span>{r.label} <span className="os-tag">{r.record_type}</span></span><span className="os-muted">{formatDate(r.archived_at)}</span></summary>
                <ActionForm action={restoreArchived} className="os-inline-form" confirm={`Restore "${r.label}"? It becomes editable again.`}>
                  <Hidden name="type" value={r.record_type} /><Hidden name="id" value={r.record_id} />
                  <Field label="Reason"><input name="reason" required maxLength={300} /></Field>
                  <SubmitButton variant="ghost">Restore</SubmitButton>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
