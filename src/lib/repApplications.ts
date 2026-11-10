/**
 * WEC First Year Rep applications, 2026-27: the questions and the checks.
 *
 * One role, 5 seats, written answers only. The same file is read by the form
 * (src/components/sections/RepApplicationForm.tsx) and by the server route
 * (src/app/api/rep-applications/route.ts), so the browser and the server can
 * never disagree about what counts as a valid application.
 *
 * The questions were agreed by Sami and Rishabh on 10 Nov 2026: Rishabh's 14
 * plus "Which groups can you reach?" and "Would you be interested in an exec
 * role next year?". Change a question here and both sides change together.
 *
 * The email, link and word rules are the exec application's own, imported
 * rather than copied, so a fix to one is a fix to both.
 */
import { checkField, emailProblem, linkProblem, words, type FieldKind } from "@/lib/execApplications";

export { HONEYPOT } from "@/lib/execApplications";
export { REP_APPLICATIONS_API, REP_APPLICATIONS_PATH } from "@/lib/applyRoutes";
export { words };

export const REP_CLOSES = "Sunday, November 22 at 11:59 pm";

export const REP_YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Graduate", "Other"];
export const HOURS = ["Yes", "No", "Not sure"];
export const EXEC_INTEREST = ["Yes", "No", "Maybe"];
export const HEARD = ["Instagram", "LinkedIn", "A group chat", "A friend", "A WEC event", "Other"];

export type RepFieldId =
  | "name" | "westernEmail" | "program" | "year" | "residence" | "social"
  | "why" | "company" | "event"
  | "showUp" | "reach" | "link"
  | "hours" | "dates" | "execNext" | "anything" | "heard";

export type RepQuestion = {
  id: RepFieldId;
  label: string;
  req: boolean;
  kind: FieldKind;
  rule?: "western" | "any";
  placeholder?: string;
  hint?: string;
  choices?: string[];
  max?: number;
};

export type RepStage = { key: "about" | "why" | "done" | "time"; title: string; heading: string; sub: string; qs: RepQuestion[] };

export const REP_STAGES: RepStage[] = [
  {
    key: "about", title: "About you", heading: "Let's get to know you.",
    sub: "This role is for first-year Western students. None of this is scored.",
    qs: [
      { id: "name", label: "Full name", req: true, kind: "text", placeholder: "Amara Osei" },
      { id: "westernEmail", label: "Western email", req: true, kind: "email", rule: "western", placeholder: "you@uwo.ca", hint: "We reply here." },
      { id: "program", label: "Program", req: true, kind: "text", placeholder: "BMOS, Science, Engineering, Health Sci" },
      { id: "year", label: "Year of study", req: true, kind: "select", choices: REP_YEARS },
      { id: "residence", label: "Residence, or off campus", req: false, kind: "text", placeholder: "Saugeen, Ontario Hall, off campus", hint: "Optional. Only used to balance the final group." },
      { id: "social", label: "Instagram or LinkedIn", req: false, kind: "text", placeholder: "@handle or a link", hint: "Optional. Only a way to reach you." },
    ],
  },
  {
    key: "why", title: "Why you", heading: "Why First Year Rep?",
    sub: "Short and specific beats long and polished. 150 words each at most.",
    qs: [
      { id: "why", label: "Why do you want to be a First Year Rep?", req: true, kind: "long", max: 150 },
      { id: "company", label: "If you could start a company tomorrow, what problem would it solve?", req: true, kind: "long", max: 150, hint: "The idea can be rough. A real problem you care about is the point." },
      { id: "event", label: "What would make a first-year want to come to a WEC event?", req: true, kind: "long", max: 150 },
    ],
  },
  {
    key: "done", title: "What you've done", heading: "Show us how you get things done.",
    sub: "Any setting counts: school, family, a team, a group chat, a hobby. No experience needed.",
    qs: [
      { id: "showUp", label: "Tell us about a time you got people to show up or helped something get done.", req: true, kind: "long", max: 150 },
      { id: "reach", label: "Which groups can you reach? Clubs, classes, teams, residence.", req: true, kind: "long", max: 100 },
      { id: "link", label: "A link to anything you've made or done", req: false, kind: "url", placeholder: "https://", hint: "Optional. A project, post, video or design. Never needed." },
    ],
  },
  {
    key: "time", title: "Time", heading: "A few last things.",
    sub: "The role is 3 to 4 hours a week. A busy schedule stated up front is fine.",
    qs: [
      { id: "hours", label: "Can you give 3 to 4 hours a week from the start date to the end of April?", req: true, kind: "select", choices: HOURS },
      { id: "dates", label: "Any dates you can't work, such as exams, travel or another job?", req: false, kind: "long", max: 100 },
      { id: "execNext", label: "Would you be interested in an exec role next year?", req: false, kind: "select", choices: EXEC_INTEREST },
      { id: "anything", label: "Is there anything we should know, or anything you need to apply or interview?", req: false, kind: "long", max: 150, hint: "Optional. Read only by the two reviewers." },
      { id: "heard", label: "How did you hear about this role?", req: false, kind: "select", choices: HEARD },
    ],
  },
];

export const REP_QUESTIONS: RepQuestion[] = REP_STAGES.flatMap(s => s.qs);

export type RepApplication = Record<RepFieldId, string>;
export type RepErrors = Partial<Record<RepFieldId, string>>;

export function blankRep(): RepApplication {
  const v = {} as RepApplication;
  for (const q of REP_QUESTIONS) v[q.id] = "";
  return v;
}

function checkOne(q: RepQuestion, value: string | undefined): string | null {
  const text = String(value ?? "").trim();
  // Optional and left blank is always fine, whatever the kind.
  if (!q.req && !text) return null;
  if (q.kind === "email") return emailProblem(text, q.rule ?? "any");
  if (q.kind === "url") return linkProblem(text, q.req);
  return checkField({ kind: q.kind, req: q.req, choices: q.choices, max: q.max }, text);
}

export function checkRepStage(stage: RepStage, v: RepApplication): RepErrors {
  const errors: RepErrors = {};
  for (const q of stage.qs) {
    const problem = checkOne(q, v[q.id]);
    if (problem) errors[q.id] = problem;
  }
  return errors;
}

export function checkRepApplication(v: RepApplication): RepErrors {
  return Object.assign({}, ...REP_STAGES.map(s => checkRepStage(s, v)));
}

/** Pulls exactly the known fields out of a request body, as trimmed strings. Anything else is dropped. */
export function cleanRepSubmission(body: unknown): RepApplication | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const v = blankRep();
  for (const q of REP_QUESTIONS) {
    const value = raw[q.id];
    if (value != null && typeof value !== "string") return null;
    v[q.id] = String(value ?? "").trim();
  }
  return v;
}
