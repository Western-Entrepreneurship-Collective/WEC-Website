import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Field, Hidden } from "@/components/os/ui";
import type { ActionResult } from "@/lib/os/types";

export function PasswordForm({ action, token, button }: { action: (s: ActionResult, f: FormData) => Promise<ActionResult>; token: string; button: string }) {
  return (
    <ActionForm action={action} className="os-stack os-gate-form">
      <Hidden name="token_hash" value={token} />
      <Field label="New password" hint="At least 10 characters."><input name="password" type="password" autoComplete="new-password" minLength={10} required /></Field>
      <Field label="Repeat it"><input name="confirm" type="password" autoComplete="new-password" minLength={10} required /></Field>
      <SubmitButton>{button}</SubmitButton>
    </ActionForm>
  );
}
