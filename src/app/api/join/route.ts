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
 * THE MEMBER LIST IN SUPABASE (WEC_MEMBERS_DB=on, src/lib/members.ts)
 *
 * On: the sign up is saved to members.members first, then sent to the Google
 * Form as well, as a second copy; a Google failure is logged and the student is
 * not told, because they are already on the list. An email already on the list
 * is told they're in and nothing is sent, so the Sheet gets no duplicate. If the
 * database cannot be reached, Google alone decides, as it did before, and the
 * Sheet import catches the list up later. Off: Google only, as before.
 *
 * ⛔ No answers are logged.
 *
 * ⛔ NOTHING IS SENT WITHOUT CONSENT. A submission without privacyAgreed set to
 * true is refused before any answer is read, so nothing reaches Google unless
 * the person ticked the box that links to /privacy (src/lib/privacy.ts).
 */
import { type Answers, cleanAnswers, parseEmailRule, parseGoogleForm, validateAnswers } from "@/lib/googleForm";
import { checkGoogleForm } from "@/lib/googleFormCheck";
import { membersDbOn, saveMember } from "@/lib/members";
import { hasConsent } from "@/lib/privacy";

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
  const membersDb = membersDbOn();
  if (!form) return Response.json({ connected: false, emailRule, membersDb, problems: [reason] });
  const check = await checkGoogleForm(form);
  return Response.json({ connected: true, emailRule, membersDb, ready: check.ok, problems: check.problems });
}

export async function POST(request: Request) {
  const membersDb = membersDbOn();
  const { form, reason } = connectedForm();
  if (!form && !membersDb) {
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
  if (!hasConsent(body)) return Response.json({ error: "consent_required" }, { status: 400 });
  const answers = cleanAnswers(body);
  if (!answers) return Response.json({ error: "bad_request" }, { status: 400 });
  const errors = validateAnswers(answers, parseEmailRule(process.env.NEXT_PUBLIC_WEC_EMAIL_RULE));
  if (Object.keys(errors).length) return Response.json({ error: "invalid", errors }, { status: 400 });

  if (membersDb) {
    let saved: "new" | "existing";
    try {
      saved = await saveMember(answers);
    } catch (error) {
      // A database outage must not stop sign ups. Google takes it alone, and the
      // next run of scripts/members-import.mjs brings it into the list.
      console.error("[join] MEMBER LIST SAVE FAILED, falling back to Google only. Run the Sheet import to catch up:",
        (error as Error).message);
      if (!form) return Response.json({ error: "unreachable" }, { status: 502 });
      const sent = await sendToGoogle(form, answers);
      return sent.ok ? Response.json({ ok: true }) : Response.json({ error: sent.error }, { status: 502 });
    }
    if (saved === "existing") return Response.json({ ok: true });
    // They are on the list. Google is the second copy from here on.
    if (!form) console.error("[join] Saved to the member list; Google Form not connected:", reason);
    else await sendToGoogle(form, answers);
    return Response.json({ ok: true });
  }

  const sent = await sendToGoogle(form!, answers);
  return sent.ok ? Response.json({ ok: true }) : Response.json({ error: sent.error }, { status: 502 });
}

type ConnectedForm = NonNullable<ReturnType<typeof connectedForm>["form"]>;

/** Sends the answers to the Google Form. Logs why when it fails; never logs the answers. */
async function sendToGoogle(form: ConnectedForm, answers: Answers): Promise<{ ok: true } | { ok: false; error: "refused" | "unreachable" }> {
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
      return { ok: false, error: "refused" };
    }
    return { ok: true };
  } catch (error) {
    console.error("[join] Google Form unreachable:", (error as Error).name);
    return { ok: false, error: "unreachable" };
  }
}
