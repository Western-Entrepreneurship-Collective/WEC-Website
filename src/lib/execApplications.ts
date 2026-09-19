/**
 * WEC Executive Applications 2026-27: every question, its limit, its checks,
 * and the link to the club's Google Form. ONE file, read by BOTH sides:
 *
 *   - the page (src/components/sections/ExecApplicationsForm.tsx), to draw the
 *     stages and check answers as they are typed;
 *   - the server route (src/app/api/exec-applications/route.ts), to check the
 *     answers AGAIN and do the actual sending.
 *
 * The same functions run in both places, so the browser and the server can
 * never disagree about what is valid. Nothing here touches Node APIs.
 *
 * ONE SETTING CONNECTS IT
 *
 *   WEC_APPLY_GOOGLE_FORM_URL  =  the Google Form's PRE-FILLED LINK.
 *
 * In the Form: the ⋮ menu → "Get pre-filled link", type the placeholder word
 * below into each question, pick "1st Year" for year and "VP Content" for the
 * position, press "Get link", copy it. That link carries the Form's id and the
 * hidden entry number of every question, so nobody has to dig through page
 * source. Full steps are in docs/EXEC-APPLICATIONS-FORM.md.
 *
 * It is SERVER SIDE ONLY (no NEXT_PUBLIC_ prefix). The browser never sees the
 * Form's address and never posts to Google itself.
 */

// ─── Where it lives ──────────────────────────────────────────────────────────
// The addresses live in src/lib/applyRoutes.ts, which holds nothing else, so a
// component that needs only a path does not pull all twelve roles in with it.
// Re-exported here because this file is what the flow already imports.
export { APPLY_PATH, EXEC_APPLICATIONS_API, EXEC_APPLICATIONS_PATH, MEMBER_APPLY_PATH } from "@/lib/applyRoutes";

/**
 * The hidden trap field's name, shared by the page and the route.
 * ⛔ Deliberately NOT "website", "url", "name" or "email": a password manager
 * or autofill could fill one of those in for a real person and get them
 * silently dropped as a bot.
 */
export const HONEYPOT = "wec_hp";

// ─── Positions ───────────────────────────────────────────────────────────────
// key   : what is stored and sent, and what the flow routes on.
// title : the exact wording the applicant and the Google Form both use.
// group : the two headings the role cards are listed under.
// sub   : the line under the title on the role questions stage.
// desc  : the one line on the card.
// qs    : ONLY this role's questions. The flow shows nothing else. There is no
//         hidden set of other roles' questions anywhere in the page.

export type RoleQuestion = { id: "r1" | "r2" | "r3" | "r4"; label: string; max: number };
export type Role = {
  key: string;
  title: string;
  group: string;
  sub: string;
  desc: string;
  qs: RoleQuestion[];
  link?: { id: "rlink"; label: string; hint: string };
};

export const ROLES: Role[] = [
  {
    key: "vp-content", title: "VP Content", group: "Vice Presidents",
    sub: "You'll own what WEC creates and how the world sees us.",
    desc: "What WEC makes and posts. Series, campaigns, the feed.",
    qs: [
      { id: "r1", label: "Why do you want to lead Content for WEC?", max: 250 },
      { id: "r2", label: "If you were given complete creative freedom, what would you change or add to WEC's content strategy this year?", max: 250 },
      { id: "r3", label: "Pitch a content series or campaign that could make students want to follow WEC, attend our events, or join the community.", max: 200 },
      { id: "r4", label: "What is something you have created that you are genuinely proud of? What made it successful?", max: 150 },
    ],
  },
  {
    key: "vp-communications", title: "VP Communications", group: "Vice Presidents",
    sub: "You'll own how WEC talks to Western, and whether anyone acts on it.",
    desc: "Announcements, membership growth, turning interest into attendance.",
    qs: [
      { id: "r1", label: "Why do you want to lead Communications for WEC?", max: 250 },
      { id: "r2", label: "How would you use communication to increase WEC membership and turn interested students into active members?", max: 250 },
      { id: "r3", label: "Write an announcement that would make a busy Western student genuinely want to attend a WEC event.", max: 150 },
      { id: "r4", label: "Tell us about a time you successfully communicated an idea, message, or opportunity and got people to act on it.", max: 150 },
    ],
  },
  {
    key: "vp-community", title: "VP Community", group: "Vice Presidents",
    sub: "You'll own whether this feels like a founder community or another club.",
    desc: "Members knowing each other. Belonging, retention, the room.",
    qs: [
      { id: "r1", label: "Why do you want to lead Community for WEC?", max: 250 },
      { id: "r2", label: "How would you make WEC feel like a real founder community rather than another student club?", max: 250 },
      { id: "r3", label: "Design one initiative that would help WEC members build meaningful relationships with each other.", max: 200 },
      { id: "r4", label: "Imagine engagement is strong in September but drops significantly halfway through the year. What would you do?", max: 200 },
    ],
  },
  {
    key: "director-admin", title: "Director of Admin", group: "Directors & Coordinators",
    sub: "You'll make sure nothing agreed in a meeting quietly disappears.",
    desc: "Systems, follow-through, the record of who is doing what.",
    qs: [
      { id: "r1", label: "Why are you interested in the Director of Admin role?", max: 150 },
      { id: "r2", label: "Imagine an exec meeting ends with 15 action items across different people. What system would you create to make sure nothing gets forgotten?", max: 200 },
      { id: "r3", label: "Tell us about a time you had to keep yourself or a team organized while managing multiple responsibilities.", max: 150 },
    ],
  },
  {
    key: "event-experience", title: "Event Experience Coordinator", group: "Directors & Coordinators",
    sub: "You'll own what an evening actually feels like from the door onward.",
    desc: "The experience, not the agenda. Arrival to leaving.",
    qs: [
      { id: "r1", label: "Why are you interested in Event Experience?", max: 150 },
      { id: "r2", label: "Design a WEC event that you would genuinely want to attend. What would the experience look and feel like from arrival to leaving?", max: 250 },
      { id: "r3", label: "What separates a memorable event from an event that simply delivers information?", max: 150 },
    ],
  },
  {
    key: "director-logistics", title: "Director of Logistics", group: "Directors & Coordinators",
    sub: "You'll be the reason an event runs when three things go wrong at once.",
    desc: "Rooms, food, gear, timing, and the fix under pressure.",
    qs: [
      { id: "r1", label: "Why are you interested in Logistics?", max: 150 },
      { id: "r2", label: "Imagine you arrive 30 minutes before a major event. The room setup is wrong, food hasn't arrived, and the speaker's presentation won't connect to the projector. What do you do first, and why?", max: 200 },
      { id: "r3", label: "Tell us about a time you had to solve a problem under pressure.", max: 150 },
    ],
  },
  {
    key: "director-finops", title: "Director of Financial Operations", group: "Directors & Coordinators",
    sub: "You'll know where the money went before anyone has to ask.",
    desc: "Budgets, spend, receipts, and saying no early enough to matter.",
    qs: [
      { id: "r1", label: "Why are you interested in Financial Operations?", max: 150 },
      { id: "r2", label: "WEC has a $5,000 event budget. Three weeks into planning, $4,000 has already been committed. What would you do?", max: 200 },
      { id: "r3", label: "Tell us about a time you worked with numbers, budgets, spreadsheets, or financial information.", max: 150 },
    ],
  },
  {
    key: "speaker-acquisition", title: "Speaker Acquisition Coordinator", group: "Directors & Coordinators",
    sub: "You'll get founders worth hearing into a room at Western.",
    desc: "Cold outreach to people who owe you nothing, and a yes.",
    qs: [
      { id: "r1", label: "Why are you interested in Speaker Acquisition?", max: 150 },
      { id: "r2", label: "Choose a founder or entrepreneur you would want to bring to WEC. Who are they, why would students care, and how would you convince them to say yes?", max: 200 },
      { id: "r3", label: "Write the first outreach message you would send to a founder you've never spoken to.", max: 150 },
    ],
  },
  {
    key: "outreach", title: "Outreach Coordinator", group: "Directors & Coordinators",
    sub: "You'll reach the students who have never heard of us.",
    desc: "First message, follow-up, and a process that survives 100 of them.",
    qs: [
      { id: "r1", label: "Why are you interested in Outreach?", max: 150 },
      { id: "r2", label: "You have 100 potential students to contact. Walk us through your process from first message to follow-up.", max: 200 },
      { id: "r3", label: "Write a short message to a Western student who has never heard of WEC that would make them curious enough to learn more.", max: 100 },
    ],
  },
  {
    key: "director-video", title: "Director of Video", group: "Directors & Coordinators",
    sub: "You'll make the thing people stop scrolling for.",
    desc: "Short video. Shooting, cutting, and knowing what earns a watch.",
    qs: [
      { id: "r1", label: "Why are you interested in Video?", max: 150 },
      { id: "r2", label: "WEC gives you 60 seconds to make a video that shows Western students why they should join WEC. What would you create?", max: 200 },
      { id: "r3", label: "What makes a social media video worth watching instead of scrolling past?", max: 150 },
    ],
    // The only role with a fifth answer. It is optional, and it is a link, not
    // a file, for the same reason the resume is: see the resume field below.
    link: { id: "rlink", label: "A link to your work", hint: "Optional. A reel, a YouTube channel, a Drive folder, anything that plays." },
  },
  {
    key: "email-newsletter", title: "Email & Newsletter Coordinator", group: "Directors & Coordinators",
    sub: "You'll write the email people actually open.",
    desc: "The newsletter, the subject line, and a reason to open it.",
    qs: [
      { id: "r1", label: "Why are you interested in Email & Newsletter?", max: 150 },
      { id: "r2", label: "Imagine WEC hasn't sent an email in over a month. What would you put in the next newsletter?", max: 200 },
      { id: "r3", label: "Write a subject line that would make a busy Western student open a WEC email.", max: 50 },
    ],
  },
  {
    key: "director-engagement", title: "Director of Engagement", group: "Directors & Coordinators",
    sub: "You'll turn a member list into people who keep showing up.",
    desc: "The gap between 300 signed up and 30 in the room.",
    qs: [
      { id: "r1", label: "Why are you interested in Engagement?", max: 150 },
      { id: "r2", label: "WEC has 300 members, but only 30 consistently show up. What would you do?", max: 250 },
      { id: "r3", label: "Design one initiative that would help members build genuine relationships with each other.", max: 150 },
    ],
  },
];

export const GROUPS = ["Vice Presidents", "Directors & Coordinators"];

// ─── The questions everyone answers ──────────────────────────────────────────
// ph: the word typed into that question when making the pre-filled link. It is
//     how the entry.NNN number is found again without reading Google's HTML.

export const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Graduate", "Other"];

export type FieldId =
  | "name" | "westernEmail" | "personalEmail" | "phone" | "year" | "program"
  | "linkedin" | "portfolio" | "resume" | "intro" | "g1" | "g2"
  | "role" | "r1" | "r2" | "r3" | "r4" | "rlink";

export type FieldKind = "text" | "email" | "phone" | "select" | "url" | "long";

export type Question = {
  id: FieldId;
  label: string;
  ph: string | null;
  req: boolean;
  kind: FieldKind;
  rule?: "western" | "any";
  placeholder?: string;
  hint?: string;
  choices?: string[];
  max?: number;
};

export const ABOUT: Question[] = [
  { id: "name", label: "Full name", ph: "NAME", req: true, kind: "text", placeholder: "Amara Osei" },
  { id: "westernEmail", label: "Western email", ph: "WESTERNEMAIL", req: true, kind: "email", rule: "western", placeholder: "you@uwo.ca", hint: "We reply here first." },
  { id: "personalEmail", label: "Personal email", ph: "PERSONALEMAIL", req: true, kind: "email", rule: "any", placeholder: "you@gmail.com", hint: "In case your Western mail is full or you graduate." },
  { id: "phone", label: "Phone number", ph: "PHONE", req: false, kind: "phone", placeholder: "519 555 0134", hint: "Optional. Only used if we are trying to reach you about an interview." },
  { id: "year", label: "Year of study", ph: null, req: true, kind: "select", choices: YEARS },
  { id: "program", label: "Program / faculty", ph: "PROGRAM", req: true, kind: "text", placeholder: "Ivey HBA, Computer Science, Health Sci" },
  { id: "linkedin", label: "LinkedIn", ph: "LINKEDIN", req: false, kind: "url", placeholder: "https://linkedin.com/in/", hint: "Optional." },
  { id: "portfolio", label: "Portfolio or website", ph: "PORTFOLIO", req: false, kind: "url", placeholder: "https://", hint: "Optional." },
  // RESUME IS A LINK, NOT AN UPLOAD, AND THAT IS A DECISION, NOT AN OVERSIGHT.
  // TODO(club): a real file upload needs a Google Drive service account the
  // club does not have yet, and Google Forms' own file-upload question forces
  // every applicant to sign in to a Google account before it will accept the
  // form at all. Both were judged worse than asking for a link. When the club
  // has Drive credentials, this field becomes an upload and the Form question
  // becomes a file question, and nothing else on this page has to change.
  {
    id: "resume", label: "Resume link", ph: "RESUME", req: true, kind: "url",
    placeholder: "https://drive.google.com/...",
    hint: "Required. Paste a link to your resume: a Google Drive or Dropbox file set to \"anyone with the link\", a LinkedIn profile, or your own site. We do not take file uploads.",
  },
  {
    id: "intro", label: "Short introduction", ph: "INTRO", req: true, kind: "long", max: 150,
    hint: "Give us a quick introduction. Who are you, and what are you currently building, exploring, or interested in?",
  },
];

export const GENERAL: Question[] = [
  { id: "g1", ph: "GENERAL1", req: true, kind: "long", max: 250, label: "Pitch yourself as if you were a startup. What makes you different, what problem do you solve, and why should WEC want you on the team?" },
  { id: "g2", ph: "GENERAL2", req: true, kind: "long", max: 250, label: "What are you most proud of?" },
];

// The role answers all go into the SAME five Form questions, whichever role is
// chosen. Twelve roles times four questions would be forty-odd questions in
// one Form, and a Sheet with forty mostly-empty columns. The role column says
// which role, and each answer is sent with its own question text above it so a
// reader of the Sheet never has to cross-reference anything.
export const ROLE_SLOTS: { id: "r1" | "r2" | "r3" | "r4" | "rlink"; ph: string }[] = [
  { id: "r1", ph: "ROLE1" }, { id: "r2", ph: "ROLE2" },
  { id: "r3", ph: "ROLE3" }, { id: "r4", ph: "ROLE4" },
  { id: "rlink", ph: "ROLELINK" },
];

export const ROLE_FIELD = { id: "role" as const, ph: null, label: "Position applied for", choices: ROLES.map(r => r.title) };

/** Every field the site can send, in the order it appears in the Sheet. */
export const FIELDS: { id: FieldId; ph: string | null; label?: string }[] = [
  ...ABOUT, ...GENERAL, ROLE_FIELD, ...ROLE_SLOTS,
];

// Required in the Form's eyes. The role questions are required of the
// applicant but share slots, so they are checked by the flow, not by entry id.
export const REQUIRED: FieldId[] = ["name", "westernEmail", "personalEmail", "year", "program", "resume", "intro", "g1", "g2", "role", "r1", "r2", "r3"];

// Long enough for the longest answer plus its question text, short enough that
// nobody can post a novel. 250 words is about 1,700 characters. An answer over
// it is REFUSED with a sentence saying so, never cut short: a silently
// truncated answer is an applicant's words changed without them knowing.
export const MAX_CHARS = 8000;

export type Application = Record<FieldId, string> & { roleKey: string };
export type Errors = Partial<Record<FieldId, string>>;

function tooLong(text: string): string | null {
  const n = text.length;
  return n > MAX_CHARS
    ? `That is ${n.toLocaleString("en-US")} characters. The most one answer can hold is ${MAX_CHARS.toLocaleString("en-US")}.`
    : null;
}

export function roleByKey(key: string | undefined): Role | null {
  return ROLES.find(r => r.key === key) ?? null;
}

export function roleByTitle(title: string): Role | null {
  return ROLES.find(r => r.title === title) ?? null;
}

export function blank(): Application {
  const v = { roleKey: "" } as Application;
  for (const f of FIELDS) v[f.id] = "";
  return v;
}

// ─── Words ───────────────────────────────────────────────────────────────────
export function words(text: string | undefined): number {
  const t = String(text ?? "").trim();
  return t ? t.split(/\s+/).length : 0;
}

// ─── Email ───────────────────────────────────────────────────────────────────
// uwo.ca and every *.uwo.ca (huron, kings, brescia), plus ivey.ca and *.ivey.ca.
// The same rule as the member sign up in src/lib/googleForm.ts, kept separate
// on purpose so a change to one form can never quietly change the other.
const WESTERN_DOMAIN = /(^|\.)(uwo\.ca|ivey\.ca)$/;
const TYPOS: [RegExp, string][] = [
  [/^(uwo\.com|uwo\.co|uwo\.c|uwo\.cs|uow\.ca|uwo\.xa|uwo\.ca\.)$/, "uwo.ca"],
  [/^(gmial|gmai|gamil|gnail)\.com$/, "gmail.com"],
];

export function emailProblem(raw: string, rule: "western" | "any"): string | null {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!email) return rule === "western" ? "Please enter your Western email." : "Please enter an email address.";
  if (/\s/.test(email)) return "Your email has a space in it. Please remove it.";
  const at = email.split("@");
  if (at.length !== 2 || !at[0]) return "That doesn't look like an email. It needs one @, like you@uwo.ca.";
  const domain = at[1];
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) return "The part after the @ looks incomplete. It should look like uwo.ca.";
  for (const [pattern, meant] of TYPOS) {
    if (pattern.test(domain)) return `Did you mean @${meant}? Please check the spelling.`;
  }
  if (rule === "western" && !WESTERN_DOMAIN.test(domain)) {
    return "Please use your Western email, like you@uwo.ca. Ivey, Huron, King's and Brescia emails work too.";
  }
  return null;
}

export function linkProblem(raw: string, required: boolean): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return required ? "Please paste a link." : null;
  const long = tooLong(value);
  if (long) return long;
  if (!/^https?:\/\//i.test(value)) return "Please start the link with https:// so it opens.";
  if (!/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(value)) return "That doesn't look like a complete link.";
  return null;
}

// ─── Phone ───────────────────────────────────────────────────────────────────
// Optional, so an empty box is fine. Typed, it has to be a number somebody
// could actually dial: a leading + is allowed, and so are the spaces, dashes,
// dots and brackets people really type, but nothing else. Ten to fifteen
// digits covers a North American number and an international one, and rules
// out a birth year typed into the wrong box.
export function phoneProblem(raw: string, required: boolean): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return required ? "Please enter a phone number." : null;
  if (/[^0-9+()\-.\s]/.test(value)) return "A phone number can only have digits, spaces, brackets, dashes and a leading +.";
  if (/\+/.test(value.slice(1))) return "The + belongs at the very start, like +1 519 555 0134.";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return "That is too short for a phone number. Please include the area code.";
  if (digits.length > 15) return "That is too long for a phone number. Please check it.";
  return null;
}

// ─── Checking a stage ────────────────────────────────────────────────────────
// Each returns { fieldId: "plain sentence" }. Empty means the stage is fine.
// The SAME functions run in the browser as you type and on the server before
// anything is sent, so the two can never disagree.
export function checkField(field: Pick<Question, "kind" | "req" | "rule" | "choices" | "max">, value: string | undefined): string | null {
  const text = String(value ?? "").trim();
  const long = tooLong(text);
  if (long) return long;
  if (field.kind === "email") return emailProblem(text, field.rule ?? "any");
  if (field.kind === "phone") return phoneProblem(text, field.req);
  if (field.kind === "url") return linkProblem(text, field.req);
  if (field.kind === "select") {
    if (!text) return "Please pick one.";
    if (!(field.choices ?? []).includes(text)) return "Please pick one of the options.";
    return null;
  }
  if (!text && field.req) return "This one is required.";
  if (field.max) {
    const n = words(text);
    if (n > field.max) return `That is ${n} words. The limit is ${field.max}.`;
  }
  return null;
}

export function checkAbout(v: Application): Errors {
  const errors: Errors = {};
  for (const f of ABOUT) {
    if (!f.req && !String(v[f.id] ?? "").trim()) continue;
    const problem = checkField(f, v[f.id]);
    if (problem) errors[f.id] = problem;
  }
  return errors;
}

export function checkGeneral(v: Application): Errors {
  const errors: Errors = {};
  for (const f of GENERAL) {
    const problem = checkField(f, v[f.id]);
    if (problem) errors[f.id] = problem;
  }
  return errors;
}

export function checkRoleChoice(v: Application): Errors {
  return roleByKey(v.roleKey) ? {} : { role: "Please choose the one position you are applying for." };
}

export function checkRoleAnswers(v: Application): Errors {
  const role = roleByKey(v.roleKey);
  if (!role) return { role: "Please choose a position first." };
  const errors: Errors = {};
  for (const q of role.qs) {
    const problem = checkField({ req: true, kind: "long", max: q.max }, v[q.id]);
    if (problem) errors[q.id] = problem;
  }
  if (role.link) {
    const problem = linkProblem(v[role.link.id], false);
    if (problem) errors[role.link.id] = problem;
  }
  return errors;
}

export function checkEverything(v: Application): Errors {
  return { ...checkAbout(v), ...checkGeneral(v), ...checkRoleChoice(v), ...checkRoleAnswers(v) };
}

/**
 * The page's one decision about the GET answer: open only when the Form is
 * connected AND ready. Connected but not ready is a Form Google would refuse,
 * so it stays closed. Anything else, including no answer at all, is closed.
 */
export function applicationsOpen(answer: unknown): boolean {
  const d = answer as { connected?: unknown; ready?: unknown } | null;
  return Boolean(d && d.connected === true && d.ready === true);
}

// ─── The Form ────────────────────────────────────────────────────────────────
export type ExecForm =
  | { ok: true; viewUrl: string; action: string; entries: Partial<Record<FieldId, string>> }
  | { ok: false; reason: string };

/** Turns the pre-filled link into { action, entries }, or a plain reason why not. */
export function parseExecForm(value: string | undefined): ExecForm {
  const raw = String(value ?? "").trim();
  if (!raw) return { ok: false, reason: "not set" };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "not a link" };
  }
  if (!/\/forms\/d\/e\/[^/]+\/viewform$/.test(url.pathname)) {
    return { ok: false, reason: "not a Google Form pre-filled link (it should contain /forms/d/e/.../viewform)" };
  }
  const entries: Partial<Record<FieldId, string>> = {};
  for (const [key, answer] of url.searchParams) {
    if (!/^entry\.\d+$/.test(key)) continue;
    const text = answer.trim();
    if (YEARS.includes(text)) { entries.year = key; continue; }
    if (roleByTitle(text)) { entries.role = key; continue; }
    for (const f of FIELDS) {
      if (f.ph && text.toUpperCase() === f.ph) entries[f.id] = key;
    }
  }
  const missing = REQUIRED.filter(id => !entries[id]);
  if (missing.length) return { ok: false, reason: `the pre-filled link is missing: ${missing.join(", ")}` };
  const viewUrl = `${url.origin}${url.pathname}`;
  return { ok: true, viewUrl, action: viewUrl.replace(/viewform$/, "formResponse"), entries };
}

// ─── What actually gets sent ─────────────────────────────────────────────────
// The role answers carry their own question text, so the Sheet reads as a
// document rather than as "Role Q2" with no idea what Q2 was for that role.
// Only the chosen role's questions are read, so a leftover answer to a question
// that role does not have is dropped, never sent.
export function answersToSend(v: Application): Partial<Record<FieldId, string>> {
  const role = roleByKey(v.roleKey);
  const out: Partial<Record<FieldId, string>> = {};
  for (const f of [...ABOUT, ...GENERAL]) {
    const text = String(v[f.id] ?? "").trim();
    if (text) out[f.id] = text;
  }
  if (role) {
    out.role = role.title;
    for (const q of role.qs) {
      const text = String(v[q.id] ?? "").trim();
      if (text) out[q.id] = `${q.label}\n\n${text}`;
    }
    if (role.link) {
      const link = String(v[role.link.id] ?? "").trim();
      if (link) out[role.link.id] = link;
    }
  }
  return out;
}

/**
 * Untrusted JSON in, trimmed answers out, or null if it is not an application
 * at all. Nothing is truncated here: checkField refuses an over-long answer
 * with its own sentence, so the applicant is told instead of silently cut.
 */
export function cleanSubmission(body: unknown): Application | null {
  if (!body || typeof body !== "object") return null;
  const source = body as Record<string, unknown>;
  const v = blank();
  for (const key of Object.keys(v) as (keyof Application)[]) {
    const value = source[key];
    if (value === undefined) continue;
    if (typeof value !== "string") return null;
    v[key] = value.trim();
  }
  if (typeof source.roleKey !== "string" || !roleByKey(source.roleKey)) return null;
  return v;
}
