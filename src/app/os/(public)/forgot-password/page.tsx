import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Field } from "@/components/os/ui";
import { requestPasswordReset } from "@/lib/os/actions/auth";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1>Reset your password</h1>
      <p>We will email you a link.</p>
      <ActionForm action={requestPasswordReset} className="os-stack os-gate-form">
        <Field label="Email"><input name="email" type="email" autoComplete="username" required /></Field>
        <SubmitButton>Send reset link</SubmitButton>
      </ActionForm>
      <p className="os-gate-link"><Link className="os-link" href="/os/login">Back to sign in</Link></p>
    </>
  );
}
