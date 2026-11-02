"use server";
import { redirect } from "next/navigation";
import { rpc } from "../supabase";
import { date, dateTime, optional, optionalUuid, text, uuid, uuids } from "../validate";
import { run } from "./run";
import type { ActionResult } from "../types";

export async function createSop(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let id = "";
  const r = await run(async () => {
    id = await rpc<string>("create_sop", {
      p_title: text(fd, "title", { max: 160, label: "Title" }), p_department: uuid(fd, "department"), p_description: optional(fd, "description") ?? "",
      p_visibility: text(fd, "visibility", { max: 20 }), p_review_on: date(fd, "review_on", "Review date"), p_responsible: optionalUuid(fd, "responsible"),
      p_content: optional(fd, "content", 200000) ?? "",
    });
  });
  if (!r.ok) return r;
  redirect(`/os/sops/${id}`);
}

export const updateSop = async (_: ActionResult, fd: FormData) => run(() => rpc("update_sop", {
  p_sop: uuid(fd, "id"), p_title: text(fd, "title", { max: 160, label: "Title" }), p_description: optional(fd, "description") ?? "", p_visibility: text(fd, "visibility", { max: 20 }),
  p_review_on: date(fd, "review_on", "Review date"), p_responsible: optionalUuid(fd, "responsible"), p_expected: optional(fd, "expected"),
}), "Saved.");
export const startSopDraft = async (_: ActionResult, fd: FormData) => run(() => rpc("start_sop_draft", { p_sop: uuid(fd, "id"), p_major: fd.get("major") === "true", p_from_version: optionalUuid(fd, "from") }), "Draft started.");
export const saveSopDraft = async (_: ActionResult, fd: FormData) => run(() => rpc("save_sop_draft", { p_version: uuid(fd, "version"), p_content: optional(fd, "content", 200000) ?? "", p_change_note: optional(fd, "change_note", 500) ?? "", p_expected: optional(fd, "expected") }), "Draft saved.");
export const submitSopVersion = async (_: ActionResult, fd: FormData) => run(() => rpc("submit_sop_version", { p_version: uuid(fd, "version") }), "Sent to the President.");
export const returnSopVersion = async (_: ActionResult, fd: FormData) => run(() => rpc("return_sop_version", { p_version: uuid(fd, "version"), p_note: text(fd, "note", { label: "Note" }) }));
export const publishSopVersion = async (_: ActionResult, fd: FormData) => run(() => rpc("publish_sop_version", { p_version: uuid(fd, "version"), p_note: optional(fd, "note") ?? "" }), "Published.");
export const setSopArchived = async (_: ActionResult, fd: FormData) => run(() => rpc("set_sop_archived", { p_sop: uuid(fd, "id"), p_archived: fd.get("archived") === "true" }));
export const linkProjectSop = async (_: ActionResult, fd: FormData) => run(() => rpc("link_project_sop", { p_project: uuid(fd, "project"), p_version: uuid(fd, "version"), p_linked: fd.get("linked") !== "false" }));

export async function saveMeeting(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let id = optionalUuid(fd, "id");
  const r = await run(async () => {
    id = await rpc<string>("save_meeting", {
      p_id: id,
      p_fields: { title: text(fd, "title", { max: 160, label: "Title" }), starts_at: dateTime(fd, "starts_at", { required: true, label: "Date and time" }), department_id: optionalUuid(fd, "department_id") ?? "",
        agenda: optional(fd, "agenda", 50000) ?? "", minutes: optional(fd, "minutes", 100000) ?? "", decisions: optional(fd, "decisions", 50000) ?? "" },
      p_departments: uuids(fd, "departments"), p_attendees: uuids(fd, "attendees"), p_projects: uuids(fd, "projects"), p_expected: optional(fd, "expected"),
    });
  });
  if (!r.ok) return r;
  if (fd.get("id")) return { ok: true, message: "Saved." };
  redirect(`/os/meetings/${id}`);
}

export const saveActionItem = async (_: ActionResult, fd: FormData) => run(() => rpc("save_action_item", { p_id: null, p_meeting: uuid(fd, "meeting"), p_title: text(fd, "title", { max: 200, label: "Action" }), p_owner: optionalUuid(fd, "owner"), p_due: date(fd, "due_on", "Date") }));
export const convertActionItem = async (_: ActionResult, fd: FormData) => run(() => rpc("convert_action_item", { p_item: uuid(fd, "item"), p_project: uuid(fd, "project") }), "Task created.");
export const archiveMeeting = async (_: ActionResult, fd: FormData) => run(() => rpc("archive_meeting", { p_id: uuid(fd, "id") }), "Archived.");
