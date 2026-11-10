import { redirect } from "next/navigation";
import { APPLY_PATH } from "@/lib/applyRoutes";

/**
 * ⛔ CLOSED. Exec hiring for 2026-27 ended on 18 Oct 2026, so this address now
 * sends anyone who still has the old link to the /apply chooser.
 *
 * The exec form itself is untouched (src/components/sections/ExecApplicationsForm.tsx,
 * src/lib/execApplications.ts, /api/exec-applications) for the next exec
 * round. To reopen it, restore this page from git history (the version before
 * the First Year Rep change) and put the exec card back on /apply.
 */
export default function ExecApplicationsPage() {
  redirect(APPLY_PATH);
}
