"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ipFrom, limiter } from "@/lib/rateLimit";
import { createClient, rpc } from "../supabase";
import { Invalid, text } from "../validate";
import { publicMessage } from "./run";
import type { ActionResult, Me } from "../types";

// One message for every failure, so this form cannot be used to test which
// addresses have accounts or which accounts are deactivated.
const LOGIN_FAILED = "That email and password did not work, or this account is not active.";
const SLOW_DOWN = "Too many tries. Wait 15 minutes and try again.";

// Password guessing: 10 tries per address and 5 per account in 15 minutes. Every
// login reaches Supabase from Vercel's servers, so Supabase's own per-address limit
// cannot tell one person from another; these limits can. Reset emails: 3 per
// address and 3 per account an hour, so nobody can use up the club's email quota.
const loginByIp = limiter(10, 15 * 60 * 1000);
const loginByEmail = limiter(5, 15 * 60 * 1000);
const resetByIp = limiter(3, 60 * 60 * 1000);
const resetByEmail = limiter(3, 60 * 60 * 1000);
// Wrong current password on the change form, per account.
const changeByUser = limiter(5, 15 * 60 * 1000);

const callerIp = async () => ipFrom(await headers());

export async function login(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const ip = await callerIp();
  // Both are counted on every try, so neither limit can be dodged by the other.
  const ipOver = loginByIp.hit(ip);
  const emailOver = email ? loginByEmail.hit(email) : false;
  if (ipOver || emailOver) return { ok: false, error: SLOW_DOWN };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: String(fd.get("password") ?? "") });
  if (error) return { ok: false, error: LOGIN_FAILED };
  loginByEmail.clear(email);
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
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const ipOver = resetByIp.hit(await callerIp());
  const emailOver = email ? resetByEmail.hit(email) : false;
  if (ipOver || emailOver) return { ok: false, error: SLOW_DOWN.replace("15 minutes", "an hour") };
  const supabase = await createClient();
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
    // Only while the account still has its temporary password. Otherwise this
    // would be a way round the current-password check in changePassword below.
    const me = await rpc<Me | null>("me");
    if (!me?.must_change_password) throw new Invalid("Your password is already set. Change it from your profile.");
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error?.code === "same_password") throw new Invalid("Choose a password that is different from the temporary one.");
    if (error) throw new Invalid("That password was not accepted. Try a longer one.");
  } catch (error) {
    return { ok: false, error: publicMessage(error) };
  }
  redirect("/os");
}

// Asks for the current password first, so someone at an unlocked laptop cannot
// take the account. After the change every other device is signed out.
export async function changePassword(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const current = String(fd.get("current") ?? "");
    if (!current) throw new Invalid("Enter your current password.");
    const password = checkPassword(fd);
    if (password === current) throw new Invalid("Choose a password that is different from your current one.");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) throw new Invalid("Sign in again, then change your password.");
    if (changeByUser.hit(user.id)) throw new Invalid(SLOW_DOWN);
    const check = await supabase.auth.signInWithPassword({ email: user.email, password: current });
    if (check.error || check.data.user?.id !== user.id) throw new Invalid("Your current password is not right.");
    changeByUser.clear(user.id);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Invalid("That password was not accepted. Try a longer one.");
    await supabase.auth.signOut({ scope: "others" });
  } catch (error) {
    return { ok: false, error: publicMessage(error) };
  }
  return { ok: true, message: "Password changed. Every other device has been signed out." };
}

