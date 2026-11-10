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

// Password guessing. Every login reaches Supabase from Vercel's servers, so
// Supabase's own per-address limit cannot tell one person from another; these can.
// Only FAILED logins count, so an exec meeting all signing in on one Wi-Fi is never
// blocked. 20 failures per network address, and 5 per account from one address, in
// 15 minutes. The account limit is per address on purpose: keyed on the email alone,
// anyone who knew an exec's email could lock that exec out from anywhere.
const loginFailsByIp = limiter(20, 15 * 60 * 1000);
const loginFailsByAccount = limiter(5, 15 * 60 * 1000);
// Reset emails: 5 per address an hour, and 3 per account from one address, so
// nobody can use up the club's email quota (which would also stop invitations).
const resetByIp = limiter(5, 60 * 60 * 1000);
const resetByAccount = limiter(3, 60 * 60 * 1000);
// Wrong current password on the change form, per account.
const changeByUser = limiter(5, 15 * 60 * 1000);

const callerIp = async () => ipFrom(await headers());
// The longest possible email address; anything longer is not one.
const readEmail = (fd: FormData) => String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 254);

export async function login(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const email = readEmail(fd);
  const ip = await callerIp();
  const account = `${email}|${ip}`;
  if (loginFailsByIp.over(ip) || loginFailsByAccount.over(account)) return { ok: false, error: SLOW_DOWN };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: String(fd.get("password") ?? "") });
  if (error) {
    loginFailsByIp.hit(ip);
    loginFailsByAccount.hit(account);
    return { ok: false, error: LOGIN_FAILED };
  }
  loginFailsByAccount.clear(account);
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
  const email = readEmail(fd);
  const ip = await callerIp();
  // The address is checked first, and a blocked address records nothing more.
  if (resetByIp.hit(ip) || (email && resetByAccount.hit(`${email}|${ip}`))) {
    return { ok: false, error: SLOW_DOWN.replace("15 minutes", "an hour") };
  }
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

