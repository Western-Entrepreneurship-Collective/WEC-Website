"use server";
import { NOTE_MAX, REVIEW_AREAS } from "@/lib/repReview";
import { rpc } from "../supabase";
import { Invalid, bool, uuid } from "../validate";
import { run } from "./run";
import type { ActionResult } from "../types";

// Every check that matters is in the database (api.rep_save_score and
// api.rep_set_shortlist refuse anyone not on the reviewer list).

export const saveRepScore = async (_: ActionResult, fd: FormData) =>
  run(() => {
    const areas = REVIEW_AREAS.map((area, i) => {
      const raw = String(fd.get(`area-${i}`) ?? "");
      if (!raw) throw new Invalid(`Pick a score for ${area}.`);
      const v = Number(raw);
      if (!Number.isInteger(v) || v < 1 || v > 5) throw new Invalid("Each score is 1 to 5.");
      return v;
    });
    const note = String(fd.get("note") ?? "").trim();
    if (!note) throw new Invalid("Add one line explaining the score before saving.");
    if (note.length > NOTE_MAX) throw new Invalid("Keep the note to one line.");
    return rpc("rep_save_score", { p_id: uuid(fd, "id"), p_areas: areas, p_note: note });
  }, "Score saved.");

export const setRepShortlist = async (_: ActionResult, fd: FormData) =>
  run(() => rpc("rep_set_shortlist", { p_id: uuid(fd, "id"), p_on: bool(fd, "on") }));

// Deletes every application, score and shortlist place of the round. The page
// asks for confirmation before this runs.
export async function closeRepRound(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (String(fd.get("confirm") ?? "").trim() !== "DELETE") return { ok: false, error: "Type DELETE to confirm." };
  let deleted = 0;
  const r = await run(async () => { deleted = await rpc<number>("rep_close_round"); });
  return r.ok ? { ok: true, message: `Round closed. ${deleted} applications deleted, with their scores and the shortlist.` } : r;
}
