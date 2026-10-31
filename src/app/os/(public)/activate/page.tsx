import type { Metadata } from "next";
import { activateAccount } from "@/lib/os/actions/auth";
import { PasswordForm } from "../PasswordForm";

export const metadata: Metadata = { title: "Set up your account" };

export default async function ActivatePage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash } = await searchParams;
  if (!token_hash) return <><h1>This link is incomplete.</h1><p>Open the invitation email again, or ask your administrator to resend it.</p></>;
  return (
    <>
      <h1>Set up your account</h1>
      <p>Choose a password to finish activating your WEC OS account.</p>
      <PasswordForm action={activateAccount} token={token_hash} button="Activate my account" />
    </>
  );
}
