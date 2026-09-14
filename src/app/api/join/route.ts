/**
 * POST /api/join: takes the sign up form's answers and submits them to the
 * club's Google Form, which writes them into the Form's linked Sheet.
 * GET /api/join: a setup check. Says in plain words whether the Form is
 * connected and what, if anything, will make Google refuse answers.
 *
 * WHY THE SERVER SENDS IT, NOT THE BROWSER
 *
 * A browser posting straight to Google gets an opaque response, so the page
 * could never know whether the answer was recorded. It would have to say
 * "you're in" on faith. Sent from here, Google's reply is readable, and the
 * student is only told they're in after Google accepted it.
 *
 * ⛔ No answers are stored here or logged. The Sheet is the only copy.
 */
import { cleanAnswers, parseEmailRule, parseGoogleForm, validateAnswers } from "@/lib/googleForm";
import { checkGoogleForm } from "@/lib/googleFormCheck";

// Only Google may receive the answers. WEC_GOOGLE_FORM_TEST_HOST is server-only
// and exists so the whole path can be tested against a local stand-in for Google.
function allowedHost(action: string) {
  const host = new URL(action).host;
  return host === "docs.google.com" || (!!process.env.WEC_GOOGLE_FORM_TEST_HOST && host === process.env.WEC_GOOGLE_FORM_TEST_HOST);
}

function connectedForm() {
  const form = parseGoogleForm(process.env.NEXT_PUBLIC_WEC_GOOGLE_FORM_URL);
  if (!form.ok) return { form: null, reason: `NEXT_PUBLIC_WEC_GOOGLE_FORM_URL: ${form.reason}` };
  if (!allowedHost(form.action)) return { form: null, reason: "NEXT_PUBLIC_WEC_GOOGLE_FORM_URL is not a docs.google.com link" };
  return { form, reason: "" };
}

export async function GET() {
  const { form, reason } = connectedForm();
  const emailRule = parseEmailRule(process.env.NEXT_PUBLIC_WEC_EMAIL_RULE);
  if (!form) return Response.json({ connected: false, emailRule, problems: [reason] });
  const check = await checkGoogleForm(form);
  return Response.json({ connected: true, emailRule, ready: check.ok, problems: check.problems });
}

export async function POST(request: Request) {
  const { form, reason } = connectedForm();
  if (!form) {
    console.error("[join] Google Form not connected:", reason);
    return Response.json({ error: "not_connected" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  // A hidden field no person sees. Bots fill every box; pretend it worked.
  if (body && typeof body === "object" && (body as Record<string, unknown>).website) {
    return Response.json({ ok: true });
  }
  const answers = cleanAnswers(body);
  if (!answers) return Response.json({ error: "bad_request" }, { status: 400 });
  const errors = validateAnswers(answers, parseEmailRule(process.env.NEXT_PUBLIC_WEC_EMAIL_RULE));
  if (Object.keys(errors).length) return Response.json({ error: "invalid", errors }, { status: 400 });

  const params = new URLSearchParams();
  for (const [field, entry] of Object.entries(form.entries)) {
    const value = answers[field as keyof typeof answers];
    if (entry && value) params.append(entry, value);
  }
  params.append("pageHistory", "0");

  try {
    // ⛔ redirect "manual": a Form that requires sign-in answers with a
    // redirect to Google's login page. Followed, that looks like success.
    const response = await fetch(form.action, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status !== 200) {
      // Google gives no reason, so look at the Form and log the likely one.
      const check = await checkGoogleForm(form).catch(() => ({ ok: false, problems: ["could not check the Form"] }));
      console.error(`[join] Google Form refused the answers (status ${response.status}).`,
        check.problems.length ? `Likely why: ${check.problems.join(" | ")}` : "The Form itself looks fine.",
        "Full check: open /api/join");
      return Response.json({ error: "refused" }, { status: 502 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[join] Google Form unreachable:", (error as Error).name);
    return Response.json({ error: "unreachable" }, { status: 502 });
  }
}
