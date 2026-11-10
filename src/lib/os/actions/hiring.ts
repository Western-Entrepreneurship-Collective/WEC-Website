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
    const areas = REVIEW_AREAS.map((_, i) => {
      const v = Number(fd.get(`area-${i}`));
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
