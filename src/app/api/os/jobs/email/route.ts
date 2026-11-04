/**
 * POST /api/os/jobs/email: sends queued emails through Resend, then clears out
 * abandoned uploads. Called by the database sweep, with the jobs secret.
 *
 * ⛔ Two kinds only. A digest says how many notifications are waiting. A team email
 * names the team and the project it was added to, and nothing from inside the project.
 * Neither carries task titles, details or comments.
 */
import { createServiceClient, serviceRpc } from "@/lib/os/admin";
import { osSiteUrl } from "@/lib/os/config";
import { jobAuthorized, jobResponse } from "@/lib/os/jobAuth";

type Claimed = { job_id: string; email: string; preferred_name: string; unread: number };
type TeamClaimed = { job_id: string; email: string; preferred_name: string; team_name: string; project_id: string; project_name: string };

export async function POST(request: Request) {
  if (!jobAuthorized(request)) return jobResponse({ error: "forbidden" }, 403);
  const key = process.env.RESEND_API_KEY;
  const from = process.env.WEC_OS_EMAIL_FROM;
  if (!key || !from) return jobResponse({ error: "email_not_configured" }, 503);

  let sent = 0;
  let failed = 0;
  const send = async (jobId: string, message: { to: string; subject: string; text: string }) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, ...message }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    const ok = response?.ok ?? false;
    await serviceRpc("service_finish_email", { p_job: jobId, p_ok: ok, p_error: ok ? null : `Resend status ${response?.status ?? "unreachable"}` });
    if (ok) sent++; else failed++;
  };
  try {
    // Team emails first: claiming them marks their notifications as emailed, so the
    // digest below doesn't send a second email about the same project.
    for (const job of await serviceRpc<TeamClaimed[]>("service_claim_team_emails", { p_limit: 40 })) {
      await send(job.job_id, {
        to: job.email,
        subject: `${job.team_name} was added to ${job.project_name}`,
        text: `Hi ${job.preferred_name},\n\n${job.team_name} was added to the project ${job.project_name} in WEC OS.\n\n${osSiteUrl()}/os/projects/${job.project_id}\n`,
      });
    }
    for (const job of await serviceRpc<Claimed[]>("service_claim_emails", { p_limit: 40 })) {
      await send(job.job_id, {
        to: job.email,
        subject: "You have updates in WEC OS",
        text: `Hi ${job.preferred_name},\n\nYou have ${job.unread} unread notification${job.unread === 1 ? "" : "s"} in WEC OS.\n\n${osSiteUrl()}/os/notifications\n`,
      });
    }
    const orphans = await serviceRpc<{ attachment_id: string; storage_path: string }[]>("service_claim_orphan_uploads");
    if (orphans.length) {
      await createServiceClient().storage.from("os-attachments").remove(orphans.map(o => o.storage_path));
      for (const o of orphans) await serviceRpc("service_forget_upload", { p_id: o.attachment_id });
    }
    return jobResponse({ sent, failed, orphans: orphans.length });
  } catch {
    return jobResponse({ error: "failed", sent, failed }, 500);
  }
}
