"use server";
import { redirect } from "next/navigation";
import { createClient, rpc } from "../supabase";
import { Invalid, text } from "../validate";
import { publicMessage } from "./run";
import type { ActionResult, Me } from "../types";

// One message for every failure, so this form cannot be used to test which
// addresses have accounts or which accounts are deactivated.
const LOGIN_FAILED = "That email and password did not work, or this account is not active.";

export async function login(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(fd.get("email") ?? "").trim().toLowerCase(),
    password: String(fd.get("password") ?? ""),
  });
  if (error) return { ok: false, error: LOGIN_FAILED };
  const me = await rpc<Me | null>("me");
  if (!me || me.status === "deactivated") {
    await supabase.auth.signOut();
    return { ok: false, error: LOGIN_FAILED };
  }
  if (me.must_change_password) redirect("/os/change-password");
  if (me.status === "invited") await rpc("activate_account");
  redirect("/os");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/os/login");
}

export async function requestPasswordReset(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (email) await supabase.auth.resetPasswordForEmail(email);
  return { ok: true, message: "If that address has an account, a reset link is on its way." };
}

function checkPassword(fd: FormData) {
  const password = String(fd.get("password") ?? "");
  if (password.length < 10) throw new Invalid("Use at least 10 characters.");
  if (password !== String(fd.get("confirm") ?? "")) throw new Invalid("Those two passwords do not match.");
  return password;
}

// The token is spent when the person presses the button, never by opening the
// link, so a mail scanner that follows links cannot use up an invitation.
async function verifyAndSetPassword(fd: FormData, type: "invite" | "recovery") {
  const password = checkPassword(fd);
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: text(fd, "token_hash"), type });
  if (error) throw new Invalid("This link has expired or was already used. Ask for a new one.");
  const update = await supabase.auth.updateUser({ password });
  if (update.error) throw new Invalid("That password was not accepted. Try a longer one.");
}

export async function activateAccount(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await verifyAndSetPassword(fd, "invite");
    await rpc("activate_account");
  } catch (error) {
    return { ok: false, error: publicMessage(error) };
  }
  redirect("/os");
}

export async function resetPassword(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await verifyAndSetPassword(fd, "recovery");
  } catch (error) {
    return { ok: false, error: publicMessage(error) };
  }
  redirect("/os");
}

// A database trigger sees the stored password change and opens the account. This only asks
// for the change, so skipping this page or calling the API directly opens nothing.
export async function replaceTemporaryPassword(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const password = checkPassword(fd);
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error?.code === "same_password") throw new Invalid("Choose a password that is different from the temporary one.");
    if (error) throw new Invalid("That password was not accepted. Try a longer one.");
  } catch (error) {
    return { ok: false, error: publicMessage(error) };
  }
  redirect("/os");
}

export async function changePassword(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const password = checkPassword(fd);
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Invalid("That password was not accepted. Try a longer one.");
  } catch (error) {
    return { ok: false, error: publicMessage(error) };
  }
  return { ok: true, message: "Password changed." };
}

