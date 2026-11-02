import { ActionForm, SubmitButton } from "./ActionForm";
import { Check, Field } from "./ui";
import { inviteExecutive } from "@/lib/os/actions/admin";

export function InviteForm({ positions }: { positions: { id: string; title: string; team?: string }[] }) {
  return (
    <ActionForm action={inviteExecutive} className="os-stack" resetOnSuccess>
      <div className="os-form-grid">
        <Field label="Full name"><input name="full_name" required maxLength={120} /></Field>
        <Field label="Email"><input name="email" type="email" required /></Field>
        <Field label="Position">
          <select name="position" defaultValue=""><option value="">Assign later</option>{positions.map(p => <option key={p.id} value={p.id}>{p.team}: {p.title}</option>)}</select>
        </Field>
        <Field label="Seat" hint="For a title held by more than one person."><input name="seat" type="number" min="1" defaultValue="1" /></Field>
      </div>
      <Check name="grant_admin" label="Also a System Administrator" />
      <div><SubmitButton>Send invitation</SubmitButton></div>
    </ActionForm>
  );
}
