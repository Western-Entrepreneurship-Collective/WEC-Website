import "server-only";
import type { Answers } from "@/lib/googleForm";
import { serviceRpc } from "@/lib/os/admin";

/**
 * The member list in Supabase (supabase/migrations/20261103000100_members.sql).
 *
 * WEC_MEMBERS_DB=on makes /api/join save every sign up here first, and only then
 * send it to the Google Form, which stays as a second copy. Unset or anything
 * else, /api/join works exactly as it did before: Google only. Server-only (no
 * NEXT_PUBLIC_), so a redeploy with it off is the whole rollback.
 */
export function membersDbOn() {
  return process.env.WEC_MEMBERS_DB === "on";
}

/** "new" when they were added, "existing" when the email was already a member. Throws when the database is unreachable. */
export async function saveMember(a: Answers): Promise<"new" | "existing"> {
  const added = await serviceRpc<boolean>("service_join_member", {
    p_name: a.name,
    p_email: a.email,
    p_year: a.year,
    p_building: a.building,
    p_signature: a.signature,
    p_evidence: a.evidence,
    p_favourite: a.favourite,
  });
  return added ? "new" : "existing";
}
