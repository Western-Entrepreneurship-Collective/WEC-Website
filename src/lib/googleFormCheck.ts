/**
 * Server only. Reads the club's Google Form the way a visitor sees it and says,
 * in plain words, what about it will make Google refuse the site's answers.
 *
 * WHY
 *
 * Google's refusal is a bare "400" with no reason. The first real test failed
 * exactly like that: the Year question still had Google's default "Option 1"
 * to "Option 4", so "Year 1" was not an allowed answer. Nothing on screen or in
 * the log said so. This does.
 *
 * The public Form page embeds FB_PUBLIC_LOAD_DATA_, a JSON array holding every
 * question's title, type, entry id and options. Its layout is Google's and not
 * documented, so every read is defensive: if it cannot be read, the check says
 * "could not read" rather than guessing a problem.
 */
import { REQUIRED, YEARS, type Field, type GoogleForm } from "@/lib/googleForm";

type Question = { title: string; entry: string; choices: string[]; required: boolean };

export type FormCheck = { ok: boolean; problems: string[] };

function readQuestions(html: string): Question[] | null {
  const match = html.match(/FB_PUBLIC_LOAD_DATA_ = ([\s\S]*?);\s*<\/script>/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    const items: unknown[] = data?.[1]?.[1] ?? [];
    const questions: Question[] = [];
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

const LABELS: Record<Field, string> = {
  name: "Name", email: "Email", year: "Year", building: "What are you building",
  signature: "Signature", evidence: "Made or shipped anything", hardest: "Hardest part",
};

export async function checkGoogleForm(form: Extract<GoogleForm, { ok: true }>): Promise<FormCheck> {
  let response: Response;
  try {
    response = await fetch(form.viewUrl, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch {
    return { ok: false, problems: ["Could not reach the Google Form. Check the internet connection, then try again."] };
  }
  if (response.status >= 300 && response.status < 400) {
    return { ok: false, problems: ["The Form asks people to sign in to Google. In the Form's Settings, turn off \"Restrict to users\" and any sign-in requirement."] };
  }
  if (response.status !== 200) {
    return { ok: false, problems: [`Google answered ${response.status} for the Form. It may be deleted, or the link is wrong.`] };
  }
  const html = await response.text();
  if (/no longer accepting responses/i.test(html)) {
    return { ok: false, problems: ["The Form is closed. In the Form's Responses tab, turn on \"Accepting responses\"."] };
  }
  const questions = readQuestions(html);
  if (!questions) return { ok: false, problems: ["Could not read the Form's questions, so nothing could be checked. It may still work."] };

  const problems: string[] = [];
  const byEntry = new Map(questions.map(q => [q.entry, q]));
  for (const [field, entry] of Object.entries(form.entries) as [Field, string][]) {
    const q = byEntry.get(entry);
    if (!q) {
      problems.push(`The "${LABELS[field]}" question was deleted or replaced in the Form. Make a new pre-filled link and update the setting.`);
      continue;
    }
    if (field === "year" && q.choices.length) {
      const missing = YEARS.filter(year => !q.choices.includes(year));
      const extra = q.choices.filter(choice => choice && !YEARS.includes(choice));
      if (missing.length) {
        problems.push(`The "${q.title}" question's options must be exactly: ${YEARS.join(", ")}. `
          + `Missing: ${missing.join(", ")}.${extra.length ? ` Rename or remove: ${extra.join(", ")}.` : ""}`);
      }
    }
  }
  const linked = new Set(Object.values(form.entries));
  for (const q of questions) {
    if (q.required && !linked.has(q.entry)) {
      problems.push(`"${q.title}" is required in the Form but the site does not fill it in. Make it optional, or delete it.`);
    }
  }
  for (const field of REQUIRED) {
    if (!form.entries[field]) problems.push(`The site has no question to put "${LABELS[field]}" in.`);
  }
  return { ok: problems.length === 0, problems };
}
