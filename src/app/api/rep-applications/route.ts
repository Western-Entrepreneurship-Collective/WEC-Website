/**
 * GET  /api/rep-applications: answers { connected, ready } and nothing else. The
 *      form page opens only when both are true.
 * POST /api/rep-applications: takes a First Year Rep application and saves it to
 *      hiring.rep_applications in Supabase (src/lib/repApplicationsServer.ts).
 *
 * The form is open only while WEC_REP_APPLICATIONS=on. Off, GET says closed and
 * POST refuses with not_connected before reading anything.
 *
 * ⛔ No answers are logged.
 *
 * ⛔ NOTHING IS SAVED WITHOUT CONSENT. An application without privacyAgreed set to
 * true is refused before any answer is read (src/lib/privacy.ts).
 *
 * The applicant is told "you're in" only after the database said it saved. An
 * email that already applied this round is also told they're in: the first
 * application stands and nothing changes.
 */
import { HONEYPOT, checkRepApplication, cleanRepSubmission } from "@/lib/repApplications";
import { RATE_WINDOW_MS, clientIp, overLimit, repApplicationsOn, saveRepApplication } from "@/lib/repApplicationsServer";
import { hasConsent } from "@/lib/privacy";

const LOG = "[rep-applications]";
const MAX_BODY_CHARS = 60_000;

function send(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function GET() {
  const on = repApplicationsOn();
  return send({ connected: on, ready: on });
}

export async function POST(request: Request) {
  if (overLimit(clientIp(request))) {
    return send({ error: "rate_limited" }, 429, { "Retry-After": String(Math.ceil(RATE_WINDOW_MS / 1000)) });
  }
  if (!repApplicationsOn()) return send({ error: "not_connected" }, 503);

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) return send({ error: "bad_request" }, 400);
    body = JSON.parse(text);
  } catch {
    return send({ error: "bad_request" }, 400);
  }
  if (!hasConsent(body)) return send({ error: "consent_required" }, 400);
  // A filled honeypot is a bot. Pretend it worked.
  if (body && typeof body === "object" && String((body as Record<string, unknown>)[HONEYPOT] ?? "").trim()) {
    return send({ ok: true });
  }
  const application = cleanRepSubmission(body);
  if (!application) return send({ error: "bad_request" }, 400);
  const errors = checkRepApplication(application);
  if (Object.keys(errors).length) return send({ error: "invalid", errors }, 400);

  try {
    await saveRepApplication(application);
    return send({ ok: true });
  } catch (error) {
    console.error(`${LOG} save failed:`, (error as Error).message);
    return send({ error: "unreachable" }, 502);
  }
}
