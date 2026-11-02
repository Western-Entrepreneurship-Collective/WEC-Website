/**
 * GET /api/os/health: is the WEC OS sweep alive? Answers only to the jobs secret.
 * The daily GitHub Action calling this is also what keeps a free-tier database from
 * pausing over a quiet summer, and it fails loudly if the sweep has gone stale.
 */
import { serviceRpc } from "@/lib/os/admin";
import { jobAuthorized, jobResponse } from "@/lib/os/jobAuth";

const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

export async function GET(request: Request) {
  if (!jobAuthorized(request)) return jobResponse({ error: "forbidden" }, 403);
  try {
    const health = await serviceRpc<{ heartbeat: string | null; failed_jobs: number }>("service_health");
    const stale = !health.heartbeat || Date.now() - new Date(health.heartbeat).getTime() > STALE_AFTER_MS;
    return jobResponse({ ok: !stale, stale, failedJobs: health.failed_jobs, heartbeat: health.heartbeat }, stale ? 503 : 200);
  } catch {
    return jobResponse({ ok: false, error: "unreachable" }, 503);
  }
}
