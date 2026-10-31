"use server";
import { redirect } from "next/navigation";
import { createServiceClient } from "../admin";
import { rpc } from "../supabase";
import { bool, date, dateTime, optional, optionalUuid, text, uuid, uuids } from "../validate";
import { run } from "./run";
import type { ActionResult } from "../types";

const eventFields = (fd: FormData) => ({
  name: text(fd, "name", { max: 160, label: "Name" }),
  program: optional(fd, "program", 120) ?? "",
  description: optional(fd, "description") ?? "",
  objectives: optional(fd, "objectives") ?? "",
  tier: text(fd, "tier", { max: 1, label: "Tier" }),
  starts_at: dateTime(fd, "starts_at", { required: true, label: "Date and time" }),
  ends_at: dateTime(fd, "ends_at"),
  location: optional(fd, "location", 200) ?? "",
  estimated_budget: optional(fd, "estimated_budget", 16) ?? "",
  requires_speakers: bool(fd, "requires_speakers"),
  requires_registration: bool(fd, "requires_registration"),
  requires_member_participation: bool(fd, "requires_member_participation"),
  requires_sponsorship: bool(fd, "requires_sponsorship"),
  requires_finance: bool(fd, "requires_finance"),
  requires_communications: bool(fd, "requires_communications"),
  requires_founder_support: bool(fd, "requires_founder_support"),
  requires_media: bool(fd, "requires_media"),
  requires_logistics: bool(fd, "requires_logistics"),
  marketing_notes: optional(fd, "marketing_notes") ?? "",
  registration_notes: optional(fd, "registration_notes") ?? "",
  sponsorship_notes: optional(fd, "sponsorship_notes") ?? "",
});

export async function saveEvent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let id = optionalUuid(fd, "id");
  const r = await run(async () => {
    id = await rpc<string>("save_event", {
      p_id: id, p_fields: eventFields(fd), p_leads: uuids(fd, "leads"), p_departments: uuids(fd, "departments"),
      p_expected: optional(fd, "expected"),
    });
    const guests = String(fd.get("guests") ?? "").split("\n").map(l => l.trim()).filter(Boolean)
      .map(l => { const [name, role] = l.split(" - "); return { name: name.trim(), role: role?.trim() ?? "" }; });
    await rpc("set_event_guests", { p_event: id, p_guests: guests });
  });
  if (!r.ok) return r;
  redirect(`/os/events/${id}`);
}

export const submitEvent = async (_: ActionResult, fd: FormData) => run(() => rpc("submit_event", { p_event: uuid(fd, "id") }), "Sent to the President.");
export const decideEvent = async (_: ActionResult, fd: FormData) =>
  run(() => rpc("decide_event", { p_event: uuid(fd, "id"), p_decision: text(fd, "decision", { max: 40 }), p_note: optional(fd, "note") ?? "" }));
export const rescheduleEvent = async (_: ActionResult, fd: FormData) =>
  run(() => rpc("reschedule_event", { p_event: uuid(fd, "id"), p_starts_at: dateTime(fd, "starts_at", { required: true, label: "Date" }), p_ends_at: dateTime(fd, "ends_at"), p_expected: optional(fd, "expected") }), "Rescheduled. Template dates moved with it.");
export const setEventStatus = async (_: ActionResult, fd: FormData) => run(() => rpc("set_event_status", { p_event: uuid(fd, "id"), p_status: text(fd, "status", { max: 20 }) }));
export const archiveEvent = async (_: ActionResult, fd: FormData) => run(() => rpc("archive_event", { p_event: uuid(fd, "id") }), "Archived.");

const projectFields = (fd: FormData) => ({
  kind: optional(fd, "kind", 10),
  name: text(fd, "name", { max: 160, label: "Name" }),
  summary: optional(fd, "summary") ?? "",
  owning_department_id: optionalUuid(fd, "owning_department_id") ?? "",
  event_id: optionalUuid(fd, "event_id") ?? "",
  lead_executive_id: optionalUuid(fd, "lead_executive_id") ?? "",
  starts_on: date(fd, "starts_on", "Start date") ?? "",
  due_on: date(fd, "due_on", "Due date") ?? "",
  visibility: optional(fd, "visibility", 20) ?? "",
  share_progress_with_event_lead: bool(fd, "share_progress_with_event_lead"),
});

export async function createProject(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let id = "";
  const r = await run(async () => {
    id = await rpc<string>("create_project", { p_fields: projectFields(fd), p_departments: uuids(fd, "departments"), p_template: optionalUuid(fd, "template") });
  });
  if (!r.ok) return r;
  redirect(`/os/projects/${id}`);
}

export const updateProject = async (_: ActionResult, fd: FormData) =>
  run(() => rpc("update_project", { p_project: uuid(fd, "id"), p_fields: projectFields(fd), p_expected: optional(fd, "expected") }), "Saved.");
export const setProjectStatus = async (_: ActionResult, fd: FormData) => run(() => rpc("set_project_status", { p_project: uuid(fd, "id"), p_status: text(fd, "status", { max: 20 }) }));
export const setProjectPeople = async (_: ActionResult, fd: FormData) =>
  run(() => rpc("set_project_people", { p_project: uuid(fd, "id"), p_departments: uuids(fd, "departments"), p_participants: uuids(fd, "participants") }), "Saved.");
export const archiveProject = async (_: ActionResult, fd: FormData) => run(() => rpc("archive_project", { p_project: uuid(fd, "id") }), "Archived.");
export const submitGlobal = async (_: ActionResult, fd: FormData) => run(() => rpc("submit_global_project", { p_project: uuid(fd, "id") }), "Sent to the President.");
export const decideGlobal = async (_: ActionResult, fd: FormData) =>
  run(() => rpc("decide_global_project", { p_project: uuid(fd, "id"), p_decision: text(fd, "decision", { max: 40 }), p_note: optional(fd, "note") ?? "" }));
export const saveMilestone = async (_: ActionResult, fd: FormData) =>
  run(() => rpc("save_milestone", { p_id: optionalUuid(fd, "id"), p_project: optionalUuid(fd, "project"), p_title: text(fd, "title", { max: 160, label: "Title" }), p_due: date(fd, "due_on", "Date"), p_core: bool(fd, "core") }));
export const setMilestoneDone = async (_: ActionResult, fd: FormData) => run(() => rpc("set_milestone_done", { p_id: uuid(fd, "id"), p_done: bool(fd, "done") }));

const taskFields = (fd: FormData) => ({
  title: text(fd, "title", { max: 200, label: "Title" }),
  description: optional(fd, "description") ?? "",
  deliverables: optional(fd, "deliverables") ?? "",
  priority: optional(fd, "priority", 10) ?? "",
  visibility: optional(fd, "visibility", 12) ?? "",
  due_at: dateTime(fd, "due_at") ?? "",
  assigned_to: optionalUuid(fd, "assigned_to") ?? "",
  parent_task_id: optionalUuid(fd, "parent_task_id") ?? "",
  responsible_department_id: optionalUuid(fd, "responsible_department_id") ?? "",
  requires_review: bool(fd, "requires_review"),
});

export async function createTask(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let id = "";
  const r = await run(async () => {
    id = await rpc<string>("create_task", { p_project: uuid(fd, "project"), p_fields: taskFields(fd) });
  });
  if (!r.ok) return r;
  if (fd.get("stay")) return { ok: true, message: "Added." };
  redirect(`/os/tasks/${id}`);
}

export const updateTask = async (_: ActionResult, fd: FormData) =>
  run(() => rpc("update_task", { p_task: uuid(fd, "id"), p_fields: taskFields(fd), p_expected: optional(fd, "expected") }), "Saved.");
export const assignTask = async (_: ActionResult, fd: FormData) => run(() => rpc("assign_task", { p_task: uuid(fd, "id"), p_assignee: optionalUuid(fd, "assignee") }), "Assigned.");
export const setTaskStatus = async (_: ActionResult, fd: FormData) => run(() => rpc("set_task_status", { p_task: uuid(fd, "id"), p_status: text(fd, "status", { max: 20 }), p_expected: optional(fd, "expected") }));
export const addComment = async (_: ActionResult, fd: FormData) => run(() => rpc("add_comment", { p_task: uuid(fd, "id"), p_body: text(fd, "body", { label: "Comment" }) }));
export const saveChecklistItem = async (_: ActionResult, fd: FormData) =>
  run(() => rpc("save_checklist_item", { p_id: optionalUuid(fd, "item"), p_task: uuid(fd, "id"), p_label: text(fd, "label", { max: 300, label: "Item" }), p_is_done: bool(fd, "is_done") }));
export const deleteChecklistItem = async (_: ActionResult, fd: FormData) => run(() => rpc("delete_checklist_item", { p_id: uuid(fd, "item") }));
export const addDependency = async (_: ActionResult, fd: FormData) => run(() => rpc("add_task_dependency", { p_task: uuid(fd, "id"), p_depends_on: uuid(fd, "depends_on") }));
export const removeDependency = async (_: ActionResult, fd: FormData) => run(() => rpc("remove_task_dependency", { p_task: uuid(fd, "id"), p_depends_on: uuid(fd, "depends_on") }));
export const submitDeliverable = async (_: ActionResult, fd: FormData) => run(() => rpc("submit_deliverable", { p_task: uuid(fd, "id"), p_note: optional(fd, "note") ?? "" }), "Submitted for review.");
export const reviewDeliverable = async (_: ActionResult, fd: FormData) =>
  run(() => rpc("review_deliverable", { p_task: uuid(fd, "id"), p_accept: fd.get("accept") === "true", p_note: optional(fd, "note") ?? "" }));

export async function createRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let id = "";
  const r = await run(async () => {
    id = await rpc<string>("create_cross_team_request", {
      p_project: uuid(fd, "project"), p_receiving: uuid(fd, "receiving"),
      p_fields: { title: text(fd, "title", { max: 200, label: "Title" }), description: optional(fd, "description") ?? "", deliverables: optional(fd, "deliverables") ?? "",
        priority: optional(fd, "priority", 10) ?? "", due_at: dateTime(fd, "due_at") ?? "", requesting_department_id: optionalUuid(fd, "requesting") ?? "" },
    });
  });
  if (!r.ok) return r;
  redirect(`/os/tasks/${id}`);
}

export const respondToRequest = async (_: ActionResult, fd: FormData) =>
  run(() => rpc("respond_to_request", { p_task: uuid(fd, "id"), p_action: text(fd, "action", { max: 10 }), p_note: optional(fd, "note") ?? "", p_delegate: optionalUuid(fd, "delegate") }));
export const clarifyRequest = async (_: ActionResult, fd: FormData) => run(() => rpc("clarify_request", { p_task: uuid(fd, "id"), p_note: text(fd, "note", { label: "Answer" }) }));
export const delegateRequest = async (_: ActionResult, fd: FormData) => run(() => rpc("delegate_request", { p_task: uuid(fd, "id"), p_delegate: uuid(fd, "delegate") }), "Delegated.");
export const proposeDeadline = async (_: ActionResult, fd: FormData) => run(() => rpc("propose_deadline", { p_task: uuid(fd, "id"), p_due: dateTime(fd, "due", { required: true, label: "New date" }), p_note: optional(fd, "note") ?? "" }), "Proposed.");
export const decideDeadline = async (_: ActionResult, fd: FormData) => run(() => rpc("decide_deadline", { p_proposal: uuid(fd, "proposal"), p_accept: fd.get("accept") === "true" }));

export const publishAnnouncement = async (_: ActionResult, fd: FormData) => run(() => rpc("publish_announcement", { p_title: text(fd, "title", { max: 160, label: "Title" }), p_body: text(fd, "body", { label: "Message" }) }), "Published.");
export const archiveAnnouncement = async (_: ActionResult, fd: FormData) => run(() => rpc("archive_announcement", { p_id: uuid(fd, "id") }));
export const markAllRead = async () => run(() => rpc("mark_notifications_read", { p_ids: null }));
export const updateProfile = async (_: ActionResult, fd: FormData) => run(() => rpc("update_profile", { p_full_name: text(fd, "full_name", { max: 120, label: "Name" }), p_preferred_name: optional(fd, "preferred_name", 80) }), "Saved.");
export const updatePreferences = async (_: ActionResult, fd: FormData) => run(() => rpc("set_notification_preferences", { p_email_digest: bool(fd, "email_digest"), p_muted_kinds: fd.getAll("muted").map(String) }), "Saved.");

// ─── Files ─────────────────────────────────────────────────────────────────
// The RPC decides whether this person may attach here, and only then does the
// service key sign an upload URL for that one path.
export async function prepareUpload(type: string, entity: string, name: string, contentType: string, size: number) {
  let result: { id: string; url: string; path: string } | null = null;
  const r = await run(async () => {
    const rows = await rpc<{ attachment_id: string; storage_path: string }[]>("prepare_attachment", {
      p_type: type, p_entity: entity, p_file_name: name, p_content_type: contentType, p_size: size,
    });
    const { attachment_id, storage_path } = rows[0];
    const { data, error } = await createServiceClient().storage.from("os-attachments").createSignedUploadUrl(storage_path);
    if (error || !data) throw new Error("upload url");
    result = { id: attachment_id, url: data.signedUrl, path: storage_path };
  });
  return r.ok ? { ok: true as const, upload: result! as { id: string; url: string; path: string } } : { ok: false as const, error: r.error };
}

export const confirmUpload = async (id: string) => run(() => rpc("confirm_attachment", { p_id: id }));
