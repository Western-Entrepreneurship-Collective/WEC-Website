"use server";
import { createServiceClient } from "../admin";
import { osSiteUrl } from "../config";
import { requireAdmin } from "../dal";
import { rpc } from "../supabase";
import { Invalid, bool, date, optional, optionalUuid, text, uuid } from "../validate";
import { run } from "./run";
import type { ActionResult } from "../types";

// The RPC records and authorizes; only then does the service key ask Auth to send
// the email. If sending fails, the invitation stays open and Resend works.
export const inviteExecutive = async (_: ActionResult, fd: FormData) => run(async () => {
  await requireAdmin();
  const email = text(fd, "email", { max: 200, label: "Email" }).toLowerCase();
  await rpc("create_invitation", {
    p_email: email, p_full_name: text(fd, "full_name", { max: 120, label: "Name" }), p_position: optionalUuid(fd, "position"),
    p_seat: Number(fd.get("seat") || 1), p_grant_admin: bool(fd, "grant_admin"),
  });
  await sendInvite(email);
}, "Invitation sent.");

async function sendInvite(email: string) {
  const { error } = await createServiceClient().auth.admin.inviteUserByEmail(email, { redirectTo: `${osSiteUrl()}/os/activate` });
  if (error) {
    console.error("[os] invitation email failed", error.status);
    throw new Invalid("The invitation is saved, but the email did not send. Check the mail settings, then Resend.");
  }
}

export const resendInvitation = async (_: ActionResult, fd: FormData) => run(async () => {
  await requireAdmin();
  await sendInvite(text(fd, "email", { max: 200 }).toLowerCase());
}, "Sent again.");
export const revokeInvitation = async (_: ActionResult, fd: FormData) => run(() => rpc("revoke_invitation", { p_invitation: uuid(fd, "id") }), "Revoked.");

// Status first, inside the RPC: from that commit on every policy refuses this
// person. The ban only stops token refresh, so a failure here is logged, not fatal.
export const deactivateExecutive = async (_: ActionResult, fd: FormData) => run(async () => {
  const id = uuid(fd, "id");
  await rpc("deactivate_executive", { p_executive: id, p_reassign_to: optionalUuid(fd, "reassign_to") });
  await banUser(id, true);
}, "Account deactivated.");

async function banUser(id: string, banned: boolean) {
  const { error } = await createServiceClient().auth.admin.updateUserById(id, { ban_duration: banned ? "876000h" : "none" });
  if (error) console.error("[os] account ban did not apply", error.status);
}

export const reactivateExecutive = async (_: ActionResult, fd: FormData) => run(async () => {
  const id = uuid(fd, "id");
  await rpc("reactivate_executive", { p_executive: id });
  await banUser(id, false);
}, "Account reactivated.");

export const assignPosition = async (_: ActionResult, fd: FormData) => run(() => rpc("assign_position", { p_executive: uuid(fd, "id"), p_position: uuid(fd, "position"), p_seat: Number(fd.get("seat") || 1), p_is_acting: bool(fd, "acting") }), "Position assigned.");
export const endAssignment = async (_: ActionResult, fd: FormData) => run(() => rpc("end_assignment", { p_assignment: uuid(fd, "id") }), "Assignment ended.");
export const setSystemAdmin = async (_: ActionResult, fd: FormData) => run(() => rpc("set_system_admin", { p_executive: uuid(fd, "id"), p_is_admin: fd.get("value") === "true" }));

export const saveDepartment = async (_: ActionResult, fd: FormData) => run(() => rpc("upsert_department", { p_id: optionalUuid(fd, "id"), p_name: text(fd, "name", { max: 80, label: "Name" }), p_slug: text(fd, "slug", { max: 60, label: "Short name" }), p_description: optional(fd, "description") ?? "", p_head_position: optionalUuid(fd, "head") }), "Saved.");
export const savePosition = async (_: ActionResult, fd: FormData) => run(() => rpc("upsert_position", { p_id: optionalUuid(fd, "id"), p_department: uuid(fd, "department"), p_title: text(fd, "title", { max: 80, label: "Title" }), p_org_role: text(fd, "org_role", { max: 20 }), p_reports_to: optionalUuid(fd, "reports_to"), p_seats: Number(fd.get("seats") || 1) }), "Saved.");
export const archivePosition = async (_: ActionResult, fd: FormData) => run(() => rpc("archive_position", { p_id: uuid(fd, "id") }), "Archived.");

export const togglePermission = async (_: ActionResult, fd: FormData) => run(() => rpc("set_permission_grant", {
  p_permission: text(fd, "permission", { max: 60 }), p_org_role: optional(fd, "org_role", 20), p_position: optionalUuid(fd, "position"),
  p_department: optionalUuid(fd, "department"), p_executive: optionalUuid(fd, "executive"), p_granted: fd.get("granted") === "true",
}));

function parseJson(fd: FormData, key: string, label: string) {
  try {
    return JSON.parse(String(fd.get(key) ?? ""));
  } catch {
    throw new Invalid(`${label} is not valid JSON.`);
  }
}

export const saveTemplate = async (_: ActionResult, fd: FormData) => run(() => rpc("save_template", {
  p_id: optionalUuid(fd, "id"), p_key: optional(fd, "key", 60), p_kind: optional(fd, "kind", 20), p_name: text(fd, "name", { max: 160, label: "Name" }),
  p_description: optional(fd, "description") ?? "", p_department: optionalUuid(fd, "department"), p_definition: parseJson(fd, "definition", "The definition"),
}), "Saved as a new version.");
export const setTemplateArchived = async (_: ActionResult, fd: FormData) => run(() => rpc("set_template_archived", { p_id: uuid(fd, "id"), p_archived: fd.get("archived") === "true" }));
export const updateRule = async (_: ActionResult, fd: FormData) => run(() => rpc("update_automation_rule", { p_id: uuid(fd, "id"), p_enabled: bool(fd, "enabled"), p_schedule: parseJson(fd, "schedule", "The schedule"), p_config: parseJson(fd, "config", "The settings") }), "Saved.");
export const retryJob = async (_: ActionResult, fd: FormData) => run(() => rpc("retry_job", { p_id: uuid(fd, "id") }), "Queued again.");
export const runSweepNow = async () => run(() => rpc("run_sweep_now"), "Sweep finished.");
export const setSetting = async (_: ActionResult, fd: FormData) => run(() => rpc("set_setting", { p_key: text(fd, "key", { max: 60 }), p_value: parseJson(fd, "value", "The value") }), "Saved.");

export const startYearTransition = async (_: ActionResult, fd: FormData) => run(() => rpc("start_year_transition", { p_new_label: text(fd, "label", { max: 40, label: "Label" }), p_starts: date(fd, "starts_on", "Start"), p_ends: date(fd, "ends_on", "End") }), "Started. The roster is saved.");
export const generateHandovers = async (_: ActionResult, fd: FormData) => run(() => rpc("generate_handover_projects", { p_transition: uuid(fd, "id") }), "Handover projects generated.");
export const transitionDeparture = async (_: ActionResult, fd: FormData) => run(async () => {
  const id = uuid(fd, "executive");
  await rpc("transition_departure", { p_transition: uuid(fd, "id"), p_executive: id, p_reassign_to: optionalUuid(fd, "reassign_to") });
  await banUser(id, true);
}, "Departure recorded.");
export const finishYearTransition = async (_: ActionResult, fd: FormData) => run(() => rpc("finish_year_transition", { p_transition: uuid(fd, "id") }), "The new academic year is current.");
export const restoreArchived = async (_: ActionResult, fd: FormData) => run(() => rpc("restore_archived", { p_type: text(fd, "type", { max: 20 }), p_id: uuid(fd, "id"), p_reason: text(fd, "reason", { max: 300, label: "Reason" }) }), "Restored.");
