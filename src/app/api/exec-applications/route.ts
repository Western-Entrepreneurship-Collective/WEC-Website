/**
 * POST /api/exec-applications: takes an executive application and submits it
 *   to the club's Google Form, which writes it into the Form's linked Sheet.
 * GET /api/exec-applications: answers { connected, ready } and nothing else.
 *   The exec applications page calls it on load and opens only when both are
 *   true. The check behind it is cached for five minutes per server instance,
 *   so a page view is not a Google fetch.
 * GET /api/exec-applications?detail=1&key=<WEC_SETUP_CHECK_KEY>: the setup
 *   check for whoever runs the Form: the same answer plus a plain-words list of
 *   problems, read fresh from Google. It needs the key. With
 *   WEC_SETUP_CHECK_KEY unset it works without one everywhere EXCEPT production
 *   (VERCEL_ENV=production), where it is then refused.
 *
 * THE PATH IS A PLACEHOLDER. This folder's name IS the URL; it must match
 * EXEC_APPLICATIONS_API in src/lib/execApplications.ts. See "Choosing the final
 * URL" in docs/EXEC-APPLICATIONS-FORM.md.
 *
 * WHY THE SERVER SENDS IT, NOT THE BROWSER
 *
 * A browser posting straight to Google gets an opaque response, so the page
 * could never know whether the application was recorded. It would have to say
 * "you're in" on faith. Sent from here, Google's reply is readable, and the
 * applicant is only told they are in after Google accepted it with a 200.
 *
 * NO DATABASE, NO ADMIN, NO LOGIN. The Sheet behind the Form is the only store.
 * ⛔ Answers are never stored here and never logged.
 *
 * ⛔ NOTHING IS SENT WITHOUT CONSENT. An application without privacyAgreed set
 * to true is refused before any answer is read, so nothing reaches Google
 * unless the applicant ticked the box that links to /privacy
 * (src/lib/privacy.ts).
 *
 * Separate from /api/join on purpose: that route and its settings belong to
 * the member sign up, and nothing here reads or changes them.
 */
import { HONEYPOT, answersToSend, checkEverything, cleanSubmission } from "@/lib/execApplications";
import {
  RATE_WINDOW_MS, cachedCheck, clientIp, connectedForm, detailAllowed, forgetCheck, freshCheck, overLimit,
} from "@/lib/execApplicationsServer";
import { hasConsent } from "@/lib/privacy";

const LOG = "[exec-applications]";
const MAX_BODY_CHARS = 200_000;

function send(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { form, reason } = connectedForm();
  if (url.searchParams.get("detail") === "1") {
    if (!detailAllowed(url)) return send({ error: "forbidden", message: "The detailed setup check needs the right key." }, 403);
    if (!form) return send({ connected: false, ready: false, problems: [reason], warnings: [] });
    const fresh = await freshCheck(form);
    // warnings do not close the page, so they are easy to miss. They are
    // returned here precisely so whoever runs this still sees them.
    return send({ connected: true, ready: fresh.ok, problems: fresh.problems, warnings: fresh.warnings });
  }
  // The public answer: two booleans. No question titles, no problems list.
  if (!form) return send({ connected: false, ready: false });
  const check = await cachedCheck(form);
  return send({ connected: true, ready: check.ok });
}

export async function POST(request: Request) {
  if (overLimit(clientIp(request))) {
    return send({ error: "rate_limited" }, 429, { "Retry-After": String(Math.ceil(RATE_WINDOW_MS / 1000)) });
  }

  const { form, reason } = connectedForm();
  if (!form) {
    console.error(`${LOG} Google Form not connected:`, reason);
    return send({ error: "not_connected" }, 503);
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) return send({ error: "bad_request" }, 400);
    body = JSON.parse(text);
  } catch {
    return send({ error: "bad_request" }, 400);
  }
  if (!body || typeof body !== "object") return send({ error: "bad_request" }, 400);

  // A hidden field no person ever sees. Bots fill every box in a form, so a
  // filled one means a bot: say ok and send nothing at all. One line in the log
  // so a real person caught by it can be spotted, and never their answers.
  if ((body as Record<string, unknown>)[HONEYPOT]) {
    console.warn(`${LOG} honeypot filled in; told ok, nothing sent to Google.`);
    return send({ ok: true });
  }

  if (!hasConsent(body)) return send({ error: "consent_required" }, 400);

  const answers = cleanSubmission(body);
  if (!answers) return send({ error: "bad_request" }, 400);
  const errors = checkEverything(answers);
  if (Object.keys(errors).length) return send({ error: "invalid", errors }, 400);

  const params = new URLSearchParams();
  for (const [id, value] of Object.entries(answersToSend(answers)) as [keyof typeof form.entries, string][]) {
    const entry = form.entries[id];
    if (entry && value) params.append(entry, value);
  }
  params.append("pageHistory", "0");

  try {
    // ⛔ redirect "manual": a Form that requires sign-in answers with a redirect
    // to Google's login page. Followed, that redirect looks like a success and
    // the applicant is told they are in while nothing was recorded.
    const response = await fetch(form.action, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status !== 200) {
      // The status only, never the applicant's answers. No second fetch to find
      // out why: that could double the wait past the timeout. The cached check
      // is dropped so the next page load reads the Form fresh, and the detailed
      // check says in plain words what is wrong.
      forgetCheck();
      console.error(`${LOG} Google Form refused an application (status ${response.status}).`,
        "Run the detailed setup check: /api/exec-applications?detail=1&key=...");
      return send({ error: "refused" }, 502);
    }
    return send({ ok: true });
  } catch (error) {
    console.error(`${LOG} Google Form unreachable:`, (error as Error).name);
    return send({ error: "unreachable" }, 502);
  }
}
