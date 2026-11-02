import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Field, Page } from "@/components/os/ui";
import { createSop } from "@/lib/os/actions/knowledge";
import { getDepartments, requireMe } from "@/lib/os/dal";
import { editsSops } from "@/lib/os/format";

export const metadata: Metadata = { title: "New SOP" };

export default async function NewSopPage() {
  const me = await requireMe();
  if (!editsSops(me)) notFound();
  const departments = await getDepartments();
  const choices = departments.filter(d => editsSops(me, d.id));
  return (
    <Page title="New SOP">
      <ActionForm action={createSop} className="os-stack os-panel">
        <div className="os-form-grid">
          <Field label="Title"><input name="title" required maxLength={160} /></Field>
          <Field label="Owning department"><select name="department" required>{choices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Who can read it once published">
            <select name="visibility" defaultValue="all_execs"><option value="all_execs">Every executive</option><option value="department">The department</option><option value="restricted">Restricted</option></select>
          </Field>
          <Field label="Review by"><input name="review_on" type="date" /></Field>
        </div>
        <Field label="Description"><textarea name="description" rows={2} /></Field>
        <Field label="Procedure" hint="This is the first draft, version 1.0. Nothing is visible outside the team until the President approves it."><textarea name="content" rows={14} /></Field>
        <div><SubmitButton>Create draft</SubmitButton></div>
      </ActionForm>
    </Page>
  );
}
