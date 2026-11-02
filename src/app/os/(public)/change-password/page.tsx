import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Field } from "@/components/os/ui";
import { logout, replaceTemporaryPassword } from "@/lib/os/actions/auth";
import { getMe } from "@/lib/os/dal";

export const metadata: Metadata = { title: "Choose your password" };

export default async function ChangePasswordPage() {
  const me = await getMe();
  if (!me) redirect("/os/login");
  if (!me.must_change_password) redirect("/os");
  return (
    <>
      <h1>Choose your password</h1>
      <p>You signed in with a temporary password. Choose your own to open WEC OS.</p>
      <ActionForm action={replaceTemporaryPassword} className="os-stack os-gate-form">
        <Field label="New password" hint="At least 10 characters."><input name="password" type="password" autoComplete="new-password" minLength={10} required /></Field>
        <Field label="Repeat it"><input name="confirm" type="password" autoComplete="new-password" minLength={10} required /></Field>
        <SubmitButton>Save and continue</SubmitButton>
      </ActionForm>
      <form action={logout} className="os-gate-link"><button type="submit" className="os-link-btn">Sign out</button></form>
    </>
  );
}
