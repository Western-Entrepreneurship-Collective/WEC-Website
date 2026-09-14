/**
 * The sign up form's answers, their checks, and the link to the club's Google Form.
 *
 * ONE SETTING CONNECTS IT
 *
 * NEXT_PUBLIC_WEC_GOOGLE_FORM_URL takes the Google Form's PRE-FILLED LINK.
 * In the Form: ⋮ menu → "Get pre-filled link", type the placeholder words below
 * into each question, pick "Year 1" for the year, press "Get link", copy it.
 * That link carries the Form's id and the hidden entry number of every
 * question, so nobody has to dig through page source for them. Full steps are
 * in docs/GOOGLE-FORM.md.
 *
 * ONE OPTIONAL SETTING CHOOSES WHICH EMAILS ARE ACCEPTED
 *
 * NEXT_PUBLIC_WEC_EMAIL_RULE = "western" (the default) or "any".
 * Nobody's address is actually verified either way; this only checks what is
 * typed. "western" matches the USC's requirement for the member list.
 *
 * Shared by the browser (to decide whether the form is live and to check
 * answers as they are typed) and by the server route (which checks them again
 * and does the actual sending). Nothing here touches Node APIs.
 */

export type Answers = {
  name: string;
  email: string;
  year: string;
  building: string;
  signature: string;
  evidence: string;
  hardest: string;
};

export type Field = keyof Answers;

export const YEARS = ["Year 1", "Year 2", "Year 3", "Year 4", "Graduate", "Alumni"];

export const BLANK: Answers = {
  // Year starts EMPTY on purpose: a pre-picked "Year 1" gets sent by people
  // who never looked at it.
  name: "", email: "", year: "", building: "", signature: "", evidence: "", hardest: "",
};

/** The word typed into each question when making the pre-filled link. */
export const PLACEHOLDERS: Record<Exclude<Field, "year">, string> = {
  name: "NAME",
  email: "EMAIL",
  building: "BUILDING",
  signature: "SIGNATURE",
  evidence: "EVIDENCE",
  hardest: "HARDEST",
};

export const REQUIRED: Field[] = ["name", "email", "year", "building", "signature"];
const MAX_LENGTH: Record<Field, number> = {
  name: 200, email: 200, year: 20, building: 2000, signature: 200, evidence: 2000, hardest: 2000,
};

// ─── Email rule ──────────────────────────────────────────────────────────────

export type EmailRule = "western" | "any";

export function parseEmailRule(value: string | undefined): EmailRule {
  return value?.trim().toLowerCase() === "any" ? "any" : "western";
}

// uwo.ca and every *.uwo.ca (huron.uwo.ca, kings.uwo.ca, brescia.uwo.ca), and
// ivey.ca and every *.ivey.ca. Seen in real Western mail: @uwo.ca, @huron.uwo.ca,
// @ivey.ca.
const WESTERN_DOMAIN = /(^|\.)(uwo\.ca|ivey\.ca)$/;

// Typos a thumb makes at a booth. Checked before the rule so the message can
// say what they probably meant rather than just "no".
const TYPOS: [RegExp, string][] = [
  [/^(uwo\.com|uwo\.co|uwo\.c|uwo\.cs|uow\.ca|uwo\.xa|uwo\.ca\.)$/, "uwo.ca"],
  [/^(gmial|gmai|gamil|gnail)\.com$/, "gmail.com"],
];

/** A plain-English problem with the email, or null if it is fine. */
export function emailProblem(raw: string, rule: EmailRule): string | null {
  const email = raw.trim().toLowerCase();
  if (!email) return rule === "western" ? "Please enter your Western email." : "Please enter your email.";
  if (/\s/.test(email)) return "Your email has a space in it. Please remove it.";
  const at = email.split("@");
  if (at.length !== 2 || !at[0]) return "That doesn't look like an email. It needs one @, like you@uwo.ca.";
  const domain = at[1];
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) {
    return "The part after the @ looks incomplete. It should look like uwo.ca.";
  }
  for (const [pattern, meant] of TYPOS) {
    if (pattern.test(domain)) return `Did you mean @${meant}? Please check the spelling.`;
  }
  if (rule === "western" && !WESTERN_DOMAIN.test(domain)) {
    return "Please use your Western email, like you@uwo.ca. Ivey, Huron, King's and Brescia emails work too.";
  }
  return null;
}

// ─── The Form ────────────────────────────────────────────────────────────────

export type GoogleForm =
  | { ok: true; viewUrl: string; action: string; entries: Partial<Record<Field, string>> }
  | { ok: false; reason: string };

export function parseGoogleForm(value: string | undefined): GoogleForm {
  if (!value?.trim()) return { ok: false, reason: "not set" };
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return { ok: false, reason: "not a link" };
  }
  if (!/\/forms\/d\/e\/[^/]+\/viewform$/.test(url.pathname)) {
    return { ok: false, reason: "not a Google Form pre-filled link (it should contain /forms/d/e/.../viewform)" };
  }
  const entries: Partial<Record<Field, string>> = {};
  for (const [key, raw] of url.searchParams) {
    if (!/^entry\.\d+$/.test(key)) continue;
    const answer = raw.trim();
    if (YEARS.some(year => year.toLowerCase() === answer.toLowerCase())) { entries.year = key; continue; }
    for (const [field, word] of Object.entries(PLACEHOLDERS) as [Field, string][]) {
      if (answer.toUpperCase() === word) entries[field] = key;
    }
  }
  const missing = REQUIRED.filter(field => !entries[field]);
  if (missing.length) return { ok: false, reason: `the pre-filled link is missing: ${missing.join(", ")}` };
  const viewUrl = `${url.origin}${url.pathname}`;
  return { ok: true, viewUrl, action: viewUrl.replace(/viewform$/, "formResponse"), entries };
}

// ─── Answers ─────────────────────────────────────────────────────────────────

export function validateAnswers(v: Answers, rule: EmailRule): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  if (!v.name.trim()) errors.name = "Please enter your name.";
  const email = emailProblem(v.email, rule);
  if (email) errors.email = email;
  if (!YEARS.includes(v.year)) errors.year = "Please pick your year.";
  if (!v.building.trim()) errors.building = "Please write a sentence. Anything you're into counts.";
  if (!v.signature.trim()) errors.signature = "Please type your full name here to sign.";
  return errors;
}

/** Untrusted JSON in, trimmed and length-capped answers out, or null if it is not answers at all. */
export function cleanAnswers(body: unknown): Answers | null {
  if (!body || typeof body !== "object") return null;
  const source = body as Record<string, unknown>;
  const out = { ...BLANK };
  for (const field of Object.keys(BLANK) as Field[]) {
    const value = source[field];
    if (value === undefined) continue;
    if (typeof value !== "string") return null;
    out[field] = value.trim().slice(0, MAX_LENGTH[field]);
  }
  return out;
}
