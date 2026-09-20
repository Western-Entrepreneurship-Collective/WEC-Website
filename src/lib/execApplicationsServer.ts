/**
 * Server only. Everything the exec applications route needs that the page must
 * never see: which host may receive an application, the check that reads the
 * club's Google Form, the five-minute cache of that check, who may see the
 * detailed check, and the per-IP rate limit.
 *
 * Kept out of route.ts because a route file may only export its HTTP methods,
 * and the tests need to reset the cache and the rate-limit counts between runs.
 *
 * ⛔ Answers are never stored here and never logged.
 */
import { timingSafeEqual } from "node:crypto";
import { ALWAYS_SENT, FIELDS, REQUIRED, ROLE_FIELD, YEARS, parseExecForm, type ExecForm, type FieldId } from "@/lib/execApplications";

type ConnectedForm = Extract<ExecForm, { ok: true }>;
/**
 * problems  stop the page opening. Every one of them means Google would refuse
 *           EVERY application, so letting people type is worse than saying so.
 * warnings  do not. They mean some applications would be refused and others
 *           would go through, and closing the page for everyone to prevent
 *           that is the worse trade: it turns a partial failure into an
 *           outage. They are reported by the setup check so they get fixed.
 */
export type FormCheck = { ok: boolean; problems: string[]; warnings: string[] };

const CHECK_TTL_MS = 5 * 60 * 1000;       // the public Form check is reused for 5 minutes
export const RATE_LIMIT = 5;              // submissions allowed per IP ...
export const RATE_WINDOW_MS = 10 * 60 * 1000; // ... per 10 minutes

/**
 * Production means the live Vercel deployment. NOT NODE_ENV: `next start`
 * always sets NODE_ENV to production, including locally and in the Playwright
 * run, which would make the local stand-in for Google impossible to test.
 */
export function isProduction() {
  return process.env.VERCEL_ENV === "production";
}

/**
 * Only Google, over https, may receive an application. WEC_GOOGLE_FORM_TEST_HOST
 * is server only and exists so the whole path can be tested against a local
 * stand-in for Google (plain http, on this machine). It is IGNORED in
 * production, so a stray value there can never send applications anywhere else.
 */
function allowedHost(action: string) {
  const url = new URL(action);
  if (url.protocol === "https:" && url.host === "docs.google.com") return true;
  const testHost = process.env.WEC_GOOGLE_FORM_TEST_HOST;
  return !isProduction() && !!testHost && url.host === testHost;
}

export function connectedForm(): { form: ConnectedForm | null; reason: string } {
  const form = parseExecForm(process.env.WEC_APPLY_GOOGLE_FORM_URL);
  if (!form.ok) return { form: null, reason: `WEC_APPLY_GOOGLE_FORM_URL: ${form.reason}` };
  if (!allowedHost(form.action)) return { form: null, reason: "WEC_APPLY_GOOGLE_FORM_URL is not an https://docs.google.com link" };
  return { form, reason: "" };
}

// ─── Reading the Form the way a visitor sees it ──────────────────────────────
// Google's refusal is a bare 400 with no reason attached. The public Form page
// embeds FB_PUBLIC_LOAD_DATA_, a JSON array holding every question's title,
// type, entry id and options. Its layout is Google's and is not documented, so
// every read below is defensive: if it cannot be read, the check says "could
// not read" rather than inventing a problem. Same reading as googleFormCheck.ts.
type FormQuestion = { title: string; entry: string; choices: string[]; required: boolean };

function readQuestions(html: string): FormQuestion[] | null {
  const match = html.match(/FB_PUBLIC_LOAD_DATA_ = ([\s\S]*?);\s*<\/script>/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    const items: unknown[] = data?.[1]?.[1] ?? [];
    const questions: FormQuestion[] = [];
    for (const item of items as unknown[][]) {
      const title = typeof item?.[1] === "string" ? item[1].trim() : "(untitled)";
      for (const sub of (item?.[4] ?? []) as unknown[][]) {
        const choices = Array.isArray(sub?.[1]) ? (sub[1] as unknown[][]).map(c => String(c?.[0] ?? "")) : [];
        questions.push({ title, entry: `entry.${sub?.[0]}`, choices, required: Boolean(sub?.[2]) });
      }
    }
    return questions;
  } catch {
    return null;
  }
}

function labelFor(id: FieldId) {
  return FIELDS.find(f => f.id === id)?.label ?? id;
}

export async function checkExecForm(form: ConnectedForm): Promise<FormCheck> {
  let response: Response;
  try {
    response = await fetch(form.viewUrl, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch {
    return { ok: false, problems: ["Could not reach the Google Form. Check the internet connection, then try again."], warnings: [] };
  }
  if (response.status >= 300 && response.status < 400) {
    return { ok: false, problems: ["The Form asks people to sign in to Google. In the Form's Settings, turn off \"Restrict to users\" and any sign-in requirement."], warnings: [] };
  }
  if (response.status !== 200) {
    return { ok: false, problems: [`Google answered ${response.status} for the Form. It may be deleted, or the link is wrong.`], warnings: [] };
  }
  const html = await response.text();
  if (/no longer accepting responses/i.test(html)) {
    return { ok: false, problems: ["The Form is closed. In the Form's Responses tab, turn on \"Accepting responses\"."], warnings: [] };
  }
  const questions = readQuestions(html);
  if (!questions) return { ok: false, problems: ["Could not read the Form's questions, so nothing could be checked. It may still work."], warnings: [] };

  const problems: string[] = [];
  const warnings: string[] = [];
  const byEntry = new Map(questions.map(q => [q.entry, q]));
  for (const [id, entry] of Object.entries(form.entries) as [FieldId, string][]) {
    const q = byEntry.get(entry);
    if (!q) {
      problems.push(`The "${labelFor(id)}" question was deleted or replaced in the Form. Make a new pre-filled link and update the setting.`);
      continue;
    }
    // A multiple-choice question only accepts its own options. The first real
    // test of the member sign up failed exactly here: the year question still
    // had Google's default "Option 1" to "Option 4", so the answer was not an
    // allowed one and Google answered 400 with no explanation.
    const wanted = id === "year" ? YEARS : id === "role" ? ROLE_FIELD.choices : null;
    if (wanted && q.choices.length) {
      const missing = wanted.filter(c => !q.choices.includes(c));
      const extra = q.choices.filter(c => c && !wanted.includes(c));
      if (missing.length) {
        problems.push(`The "${q.title}" question's options must be exactly: ${wanted.join(", ")}. `
          + `Missing: ${missing.join(", ")}.${extra.length ? ` Rename or remove: ${extra.join(", ")}.` : ""}`);
      }
    }
  }
  // A question the Form insists on is only safe if the site guarantees an
  // answer for it. Two ways it is not: the site fills nothing into it at all,
  // or the site fills it only when the applicant happens to answer. Both end
  // the same way — Google refuses the whole application with a bare 400 — so
  // both are named here rather than left for a real applicant to find.
  const alwaysSent = new Set<FieldId>(ALWAYS_SENT);
  const idByEntry = new Map((Object.entries(form.entries) as [FieldId, string][]).map(([id, entry]) => [entry, id]));
  for (const q of questions) {
    if (!q.required) continue;
    const id = idByEntry.get(q.entry);
    if (!id) {
      // Nothing is ever put in this one, so EVERY application is refused.
      problems.push(`"${q.title}" is required in the Form but the site does not fill it in. Make it optional, or delete it.`);
    } else if (!alwaysSent.has(id)) {
      // ⛔ A WARNING, NOT A PROBLEM, AND THE DIFFERENCE MATTERS. Only the
      // applications that leave this one blank are refused; the rest arrive
      // exactly as they should. Closing the page would stop the people who
      // would have answered it as well, to protect the people who would not.
      // This shut applications down once already, live, and it must not again.
      warnings.push(`"${q.title}" is required in the Form, but an applicant is allowed to leave it blank. `
        + "Google refuses an application that skips it, though one that answers it goes through. "
        + "Turn Required off on that question in the Form.");
    }
  }
  for (const id of REQUIRED) {
    if (!form.entries[id]) problems.push(`The site has no question to put "${labelFor(id)}" in.`);
  }
  return { ok: problems.length === 0, problems, warnings };
}

// ─── The cached public check ─────────────────────────────────────────────────
// Module scope, so it lives as long as the server instance does. Keyed on the
// setting, so changing the Form link is never answered from the old Form.
let cache: { key: string | undefined; at: number; result: FormCheck } | null = null;

export async function cachedCheck(form: ConnectedForm): Promise<FormCheck> {
  const key = process.env.WEC_APPLY_GOOGLE_FORM_URL;
  if (cache && cache.key === key && Date.now() - cache.at < CHECK_TTL_MS) return cache.result;
  const result = await checkExecForm(form);
  cache = { key, at: Date.now(), result };
  return result;
}

/** Fresh, not cached, and refreshes the cache: what somebody runs while fixing the Form. */
export async function freshCheck(form: ConnectedForm): Promise<FormCheck> {
  const result = await checkExecForm(form);
  cache = { key: process.env.WEC_APPLY_GOOGLE_FORM_URL, at: Date.now(), result };
  return result;
}

/** After Google refuses, the next page load reads the Form fresh. */
export function forgetCheck() {
  cache = null;
}

// ─── Who may see the detailed check ──────────────────────────────────────────
function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * WEC_SETUP_CHECK_KEY set: only with ?key= equal to it. Unset: allowed locally
 * and on preview deployments, refused in production.
 */
export function detailAllowed(url: URL) {
  const secret = process.env.WEC_SETUP_CHECK_KEY;
  if (secret) return sameSecret(url.searchParams.get("key") ?? "", secret);
  return !isProduction();
}

// ─── The rate limit ──────────────────────────────────────────────────────────
// In memory, per server instance: a cold start or a second instance starts from
// zero. It stops one person or one script hammering the Form, not a determined
// attack; the docs recommend a Vercel Firewall rule on top.
let hits = new Map<string, number[]>();

/** The first address in x-forwarded-for, which Vercel sets to the client's. */
export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function overLimit(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  // Keep the map from growing without bound on a long-lived instance.
  if (hits.size > 5000) {
    for (const [key, list] of hits) {
      if (!list.length || now - list[list.length - 1] >= RATE_WINDOW_MS) hits.delete(key);
    }
  }
  return false;
}

/** For the tests only: forget the cached check and every rate-limit count. */
export function resetExecApplicationsState() {
  cache = null;
  hits = new Map();
}
