/** POST /api/os/jobs/sweep: runs the automation sweep. For a project without pg_cron. */
import { serviceRpc } from "@/lib/os/admin";
import { jobAuthorized, jobResponse } from "@/lib/os/jobAuth";

export async function POST(request: Request) {
  if (!jobAuthorized(request)) return jobResponse({ error: "forbidden" }, 403);
  try {
    return jobResponse(await serviceRpc("service_run_sweep"));
  } catch {
    return jobResponse({ error: "failed" }, 500);
  }
}
