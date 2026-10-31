import type { Metadata } from "next";
import { resetPassword } from "@/lib/os/actions/auth";
import { PasswordForm } from "../PasswordForm";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash } = await searchParams;
  if (!token_hash) return <><h1>This link is incomplete.</h1><p>Ask for a new reset email from the sign-in page.</p></>;
  return (
    <>
      <h1>Choose a new password</h1>
      <PasswordForm action={resetPassword} token={token_hash} button="Save new password" />
    </>
  );
}
