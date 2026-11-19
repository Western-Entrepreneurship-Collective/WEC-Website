"use server";
import { revalidatePath } from "next/cache";
import { rpc } from "../supabase";
import { MEMBER_POLICY_VERSION } from "../memberPolicy";
import { publicMessage } from "./run";
import type { ActionResult } from "../types";

export type ExportKind = "copy" | "csv";
/** What the page was showing. Fixed fields only: never search text, names or addresses. */
export type ExportDetail = { year: string | null; search: boolean; batch: number | null; batches: number | null };

/** The one-time agreement to the member data rules. The list opens after it. */
export async function agreeMemberPolicy(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if (fd.get("agree") !== "yes") return { ok: false, error: "Tick the box to agree first." };
  try {
    await rpc("agree_member_policy", { p_version: MEMBER_POLICY_VERSION });
  } catch (error) {
    return { ok: false, error: publicMessage(error) };
  }
  revalidatePath("/os/members");
  return { ok: true };
}

/**
 * Records one copy or download from the member list: who, how many, how, and the year
 * filter. The database checks members.view and the agreement, and refuses anything
 * outside the fixed fields. No revalidation on purpose, so the page keeps which batches
 * were copied.
 */
export async function logMemberExport(kind: ExportKind, count: number, detail: ExportDetail): Promise<{ ok: boolean; error?: string }> {
  try {
    if (kind !== "copy" && kind !== "csv") return { ok: false, error: "That export is not allowed." };
    if (!Number.isInteger(count) || count < 1) return { ok: false, error: "Nothing to export." };
    await rpc("log_member_export", {
      p_kind: kind, p_count: count, p_year: detail.year, p_search: Boolean(detail.search),
      p_batch: detail.batch, p_batches: detail.batches,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: publicMessage(error) };
  }
}
