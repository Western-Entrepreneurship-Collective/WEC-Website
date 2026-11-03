"use server";
import { redirect } from "next/navigation";
import { createServiceClient } from "../admin";
import { rpc } from "../supabase";
import { SUMMARY_SECTIONS } from "../summary";
import { Invalid, optional, uuid } from "../validate";
import { run } from "./run";
import type { ActionResult } from "../types";

const MAX_SECTION = 20000;

export async function saveWeeklySummary(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = uuid(fd, "id");
  const review = fd.get("intent") === "review";
  const r = await run(async () => {
    const [events, teams, results] = SUMMARY_SECTIONS.map(section => optional(fd, section.key, MAX_SECTION) ?? "");
    if (review && (!events || !teams || !results)) throw new Invalid("Fill in all three sections first. If there is nothing to report, write None this week.");
    await rpc("save_weekly_summary", { p_task: id, p_events: events, p_teams: teams, p_results: results });
  }, "Draft saved.");
  if (!r.ok || !review) return r;
  redirect(`/os/summaries/${id}/review`);
}

export const markWeeklySummarySent = async (_: ActionResult, fd: FormData) =>
  run(() => rpc("mark_weekly_summary_sent", { p_task: uuid(fd, "id") }), "Marked as sent. A new summary task appears on Monday.");

export const removeWeeklySummaryPhoto = async (_: ActionResult, fd: FormData) =>
  run(async () => {
    const path = await rpc<string>("remove_weekly_summary_photo", { p_id: uuid(fd, "photo") });
    await createServiceClient().storage.from("os-attachments").remove([path]);
  });
