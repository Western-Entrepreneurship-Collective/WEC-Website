import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Field } from "@/components/os/ui";
import { login } from "@/lib/os/actions/auth";
import { getMe } from "@/lib/os/dal";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const me = await getMe();
  if (me?.must_change_password) redirect("/os/change-password");
  if (me?.status === "active") redirect("/os");
  return (
    <>
      <h1>Sign in</h1>
      <p>For the WEC executive team. Accounts are by invitation.</p>
      <ActionForm action={login} className="os-stack os-gate-form">
        <Field label="Email"><input name="email" type="email" autoComplete="username" required /></Field>
        <Field label="Password"><input name="password" type="password" autoComplete="current-password" required /></Field>
        <SubmitButton>Sign in</SubmitButton>
      </ActionForm>
      <p className="os-gate-link"><Link className="os-link" href="/os/forgot-password">Forgot your password?</Link></p>
    </>
  );
}
