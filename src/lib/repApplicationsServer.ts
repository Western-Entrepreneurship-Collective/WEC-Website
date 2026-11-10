import "server-only";
import { serviceRpc } from "@/lib/os/admin";
import type { RepApplication } from "@/lib/repApplications";

/**
 * First Year Rep applications in Supabase
 * (supabase/migrations/20261110000100_rep_applications.sql).
 *
 * WEC_REP_APPLICATIONS=on opens the form: /api/rep-applications then says it is
 * open and saves each application. Unset or anything else, the form is closed
 * and nothing is saved. Server-only (no NEXT_PUBLIC_), so turning it off is a
 * change in Vercel and a redeploy, the same as WEC_MEMBERS_DB.
 */
export function repApplicationsOn() {
  return process.env.WEC_REP_APPLICATIONS === "on";
}

/** "new" when saved, "existing" when this email already applied this round. Throws when the database is unreachable. */
export async function saveRepApplication(a: RepApplication): Promise<"new" | "existing"> {
  const added = await serviceRpc<boolean>("service_apply_rep", {
    p_name: a.name,
    p_western_email: a.westernEmail,
    p_program: a.program,
    p_year: a.year,
    p_residence: a.residence,
    p_social: a.social,
    p_why: a.why,
    p_company: a.company,
    p_event_idea: a.event,
    p_show_up: a.showUp,
    p_reach: a.reach,
    p_link: a.link,
    p_hours: a.hours,
    p_dates: a.dates,
    p_exec_next: a.execNext,
    p_anything: a.anything,
    p_heard: a.heard,
  });
  return added ? "new" : "existing";
}

// ─── Rate limit ──────────────────────────────────────────────────────────────
// 5 submissions per IP per 10 minutes, in memory. Its own counter, separate from
// the exec form's, so one form can never use up the other's allowance. In memory
// means it resets when a server instance starts, so it slows a script down rather
// than stopping a determined one (see the 8 Nov 2026 security check).
const RATE_LIMIT = 5;
export const RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function overLimit(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}
