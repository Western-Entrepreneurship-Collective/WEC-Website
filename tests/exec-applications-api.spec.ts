/**
 * Server tests for the exec applications path: the real route
 * (src/app/api/exec-applications/route.ts), the real schema, and a stand-in for
 * Google (tests/support/fakeGoogle.ts), so the whole thing is proved without a
 * Google account and without a row landing in a real Sheet.
 *
 * No browser: the route's GET and POST are called in this process with real
 * Request objects, so each test can set the environment (the Form link,
 * VERCEL_ENV, the setup key) the way a deployment would. They run once, in the
 * chromium project, one after another, because they share the route's cache
 * and rate-limit state.
 *
 *   npx playwright test tests/exec-applications-api.spec.ts --project=chromium
 *
 * One test each:
 *   1  a full valid application reaches Google with every answer in the right
 *      entry, the role by name, and each role answer carrying its question
 *   2  only the chosen role's answers are sent, for two different roles
 *   3  Google refusing (a bare 400) is reported as a failure
 *   4  a sign-in redirect counts as a failure, NOT as a success
 *   5  the honeypot answers ok and sends nothing at all
 *   6  junk gets 400
 *   7  a broken application gets 400 with a plain sentence per field
 *   8  with no setting, nothing is accepted and the page is told it is not open
 *   9  the setup check reads the Form and says in plain words what is wrong
 *  10  every required field, emptied on its own, is refused server side
 *  11  every email, phone, link and year rule is checked server side
 *  12  every paragraph is required and its word limit holds both ways
 *  13  one role's answers never carry into another role's submission
 *  14  the page opens only on connected AND ready
 *  15  the public GET answers only { connected, ready }, and is cached
 *  16  the detailed check needs the key, and is refused in production without one
 *  17  the sixth POST from one address in ten minutes gets 429
 *  18  the honeypot logs one line with no answers, and sends nothing
 *  19  an over-long answer is refused with 400, never truncated
 *  20  an http:// Google Form link is refused
 *  21  the test host is ignored in production
 *  24  without privacy consent nothing is sent to Google, and consent must be the boolean true
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { GET, POST } from "@/app/api/exec-applications/route";
import { resetExecApplicationsState } from "@/lib/execApplicationsServer";
import {
  ABOUT, GENERAL, HONEYPOT, MAX_CHARS, applicationsOpen, roleByKey, type Application,
} from "@/lib/execApplications";
import { PRIVACY_CONSENT } from "@/lib/privacy";
import { ENTRY, prefilledUrl, questions, startFakeGoogle, type FakeGoogle } from "./support/fakeGoogle";

test.describe.configure({ mode: "serial" });

const BASE = "http://localhost/api/exec-applications";
const ENV_KEYS = ["WEC_APPLY_GOOGLE_FORM_URL", "WEC_GOOGLE_FORM_TEST_HOST", "WEC_SETUP_CHECK_KEY", "VERCEL_ENV"] as const;

let google: FakeGoogle;
let gPort = 0;
let PREFILLED = "";
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};

function words(n: number) { return new Array(n).fill("word").join(" "); }

type Body = Record<string, unknown>;

function application(roleKey: string): Application & Body {
  const role = roleByKey(roleKey)!;
  const v = {
    name: "Amara Osei", westernEmail: "test.applicant@uwo.ca", personalEmail: "test.applicant@example.com",
    phone: "519 555 0134", year: "3rd Year", program: "Ivey HBA",
    linkedin: "https://example.com/linkedin", portfolio: "https://example.com/portfolio",
    resume: "https://drive.google.com/file/d/abc/view",
    intro: `I build things. ${words(20)}`,
    g1: `My pitch. ${words(30)}`, g2: `What I am proud of. ${words(30)}`,
    role: "", r1: "", r2: "", r3: "", r4: "", rlink: "",
    roleKey,
  } as Application & Body;
  role.qs.forEach((q, i) => { v[q.id] = `Answer ${i + 1}. ${words(15)}`; });
  if (role.link) v[role.link.id] = "https://example.com/reel";
  return v;
}

function connect(url?: string) {
  if (url === "") delete process.env.WEC_APPLY_GOOGLE_FORM_URL;
  else process.env.WEC_APPLY_GOOGLE_FORM_URL = url ?? PREFILLED;
  process.env.WEC_GOOGLE_FORM_TEST_HOST = `127.0.0.1:${gPort}`;
}

// Each post comes from its own address unless one is given, so the tests that
// post dozens of applications are not stopped by the rate limit. Test 17 gives
// one address on purpose.
let nextIp = 1;
// Every post agrees to the privacy policy unless the body says otherwise, the
// way the page sends it. Test 24 posts without it on purpose.
async function post(body: unknown, ip?: string) {
  const from = ip ?? `10.0.${Math.floor(nextIp / 250)}.${(nextIp++ % 250) + 1}`;
  const withConsent = body && typeof body === "object" && !(PRIVACY_CONSENT in body)
    ? { ...(body as Record<string, unknown>), [PRIVACY_CONSENT]: true } : body;
  const response = await POST(new Request(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": `${from}, 203.0.113.9` },
    body: typeof withConsent === "string" ? withConsent : JSON.stringify(withConsent),
  }));
  return { status: response.status, body: await response.json() };
}

async function get(query = "") {
  const response = await GET(new Request(BASE + query));
  return { status: response.status, body: await response.json() };
}
const detail = () => get("?detail=1");

// Captures console lines while fn runs, so a test can prove what was logged.
async function capture(fn: () => Promise<void>) {
  const lines: string[] = [];
  const saved = { warn: console.warn, error: console.error, log: console.log };
  for (const k of ["warn", "error", "log"] as const) console[k] = (...args: unknown[]) => { lines.push(args.join(" ")); };
  try { await fn(); } finally { Object.assign(console, saved); }
  return lines;
}

test.beforeAll(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "server tests run once, not per browser");
  for (const k of ENV_KEYS) if (process.env[k] !== undefined) savedEnv[k] = process.env[k];
  delete process.env.VERCEL_ENV;
  delete process.env.WEC_SETUP_CHECK_KEY;
  google = startFakeGoogle();
  await new Promise<void>(resolve => google.listen(0, "127.0.0.1", () => resolve()));
  gPort = (google.address() as { port: number }).port;
  PREFILLED = prefilledUrl(`http://127.0.0.1:${gPort}`);
});

test.afterAll(async () => {
  if (!google) return;
  await new Promise<void>(resolve => google.close(() => resolve()));
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k];
  }
});

// Every test starts with no cached Form check and no rate-limit counts.
test.beforeEach(() => {
  resetExecApplicationsState();
  delete process.env.VERCEL_ENV;
  delete process.env.WEC_SETUP_CHECK_KEY;
  google.mode = "ok";
  google.received = [];
});

test("1  a full application reaches Google with every answer in the right entry", async () => {
  connect();
  const v = application("vp-content");
  const out = await post(v);
  expect(out.body).toEqual({ ok: true });
  expect(google.received).toHaveLength(1);
  const got = google.received[0];
  expect(got[ENTRY.name]).toBe("Amara Osei");
  expect(got[ENTRY.westernEmail]).toBe("test.applicant@uwo.ca");
  expect(got[ENTRY.personalEmail]).toBe("test.applicant@example.com");
  expect(got[ENTRY.phone]).toBe("519 555 0134");
  expect(got[ENTRY.year]).toBe("3rd Year");
  expect(got[ENTRY.program]).toBe("Ivey HBA");
  expect(got[ENTRY.linkedin]).toBe("https://example.com/linkedin");
  expect(got[ENTRY.portfolio]).toBe("https://example.com/portfolio");
  expect(got[ENTRY.resume]).toBe("https://drive.google.com/file/d/abc/view");
  expect(got[ENTRY.intro]).toBe(v.intro);
  expect(got[ENTRY.g1]).toBe(v.g1);
  expect(got[ENTRY.g2]).toBe(v.g2);
  // The role goes in by its exact title, which is what the Form's options say.
  expect(got[ENTRY.role]).toBe("VP Content");
  // Every role answer carries its own question, so the Sheet reads on its own.
  for (const q of roleByKey("vp-content")!.qs) expect(got[ENTRY[q.id]], q.id).toBe(`${q.label}\n\n${v[q.id]}`);
  expect(got.pageHistory).toBe("0");
});

test("2  only the chosen role's questions are sent, for two different roles", async () => {
  connect();
  // VP Content has four questions, Outreach has three and no link.
  await post(application("vp-content"));
  await post(application("outreach"));
  const [vp, outreach] = google.received;
  expect(vp[ENTRY.r4]).toBeTruthy();
  expect(outreach[ENTRY.r4], "Outreach has no fourth question").toBeUndefined();
  expect(outreach[ENTRY.rlink], "Outreach has no link question").toBeUndefined();
  expect(outreach[ENTRY.r2]).toContain("100 potential students");
  expect(vp[ENTRY.r2]).not.toContain("100 potential students");
  // An answer to a question this role does not have is dropped, not smuggled.
  google.received = [];
  const sneaky = application("outreach");
  sneaky.r4 = "an answer to a question this role never showed";
  await post(sneaky);
  expect(google.received[0][ENTRY.r4]).toBeUndefined();
});

test("3  Google refusing keeps it a failure, and nothing is recorded", async () => {
  connect(); google.mode = "refuse";
  let out = { status: 0, body: {} as Record<string, unknown> };
  const lines = await capture(async () => { out = await post(application("director-logistics")); });
  expect(out.status).toBe(502);
  expect(out.body.error).toBe("refused");
  expect(google.received).toHaveLength(0);
  // The log line names the status, never an answer.
  expect(lines.join(" | ")).toContain("status 400");
  expect(lines.join(" | ")).not.toContain("Amara");
});

test("4  a sign-in redirect counts as a failure, not a success", async () => {
  connect(); google.mode = "signin";
  let out = { status: 0, body: {} as Record<string, unknown> };
  await capture(async () => { out = await post(application("director-video")); });
  expect(out.status, "a 302 to Google's login page must not be read as success").toBe(502);
  expect(out.body.error).toBe("refused");
  expect(google.received).toHaveLength(0);
});

test("5  the honeypot answers ok and sends nothing", async () => {
  connect();
  const v = application("vp-community");
  v[HONEYPOT] = "http://spam.example";
  let out = { status: 0, body: {} };
  await capture(async () => { out = await post(v); });
  expect(out.body, "a bot is told it worked").toEqual({ ok: true });
  expect(google.received, "and nothing at all is sent").toHaveLength(0);
});

test("6  junk gets 400", async () => {
  connect();
  expect((await post("not json at all")).status).toBe(400);
  expect((await post({ hello: "world" })).status, "an object that is not an application").toBe(400);
  expect((await post({ roleKey: "president-of-mars", name: "x" })).status, "a role that does not exist").toBe(400);
  expect((await post({ roleKey: "outreach", name: 12 })).status, "a field that is not text").toBe(400);
  expect(google.received).toHaveLength(0);
});

test("7  a broken application gets 400 and a plain sentence per field", async () => {
  connect();
  const v = application("email-newsletter");
  v.westernEmail = "test.applicant@example.com";   // not a Western address
  v.resume = "drive.google.com/file/d/abc";  // optional, but must be a real link
  v.r3 = words(80);                      // the subject line is 50 words
  const out = await post(v);
  expect(out.status).toBe(400);
  expect(out.body.error).toBe("invalid");
  expect(out.body.errors.westernEmail).toMatch(/Western email/);
  expect(out.body.errors.resume).toMatch(/start the link with https/);
  expect(out.body.errors.r3).toMatch(/limit is 50/);
  expect(google.received, "nothing goes to Google until it is valid").toHaveLength(0);
});

test("8  with no setting, nothing is accepted and the page is told it is not open", async () => {
  connect("");
  let out = { status: 0, body: {} as Record<string, unknown> };
  await capture(async () => { out = await post(application("vp-content")); });
  expect(out.status).toBe(503);
  expect(out.body.error).toBe("not_connected");
  expect((await get()).body).toEqual({ connected: false, ready: false });
  expect((await detail()).body.problems[0]).toMatch(/not set/);
  expect(google.received).toHaveLength(0);
});

test("9  the setup check says in plain words what is wrong with the Form", async () => {
  connect();
  const good = await detail();
  expect(good.body.connected).toBe(true);
  expect(good.body.problems, "a correctly built Form has no problems").toEqual([]);
  expect(good.body.ready).toBe(true);

  // The real failure this check was written for: the year question still has
  // Google's default options, so Google refuses "3rd Year" with a bare 400.
  const broken = questions().map(q => q.entry === ENTRY.year ? { ...q, choices: ["Option 1", "Option 2"] } : q);
  broken.push({ title: "Do you agree to the terms?", entry: "entry.9999999", required: true, choices: null });
  const brokenServer = startFakeGoogle({ questions: broken });
  await new Promise<void>(resolve => brokenServer.listen(0, "127.0.0.1", () => resolve()));
  const bPort = (brokenServer.address() as { port: number }).port;
  process.env.WEC_APPLY_GOOGLE_FORM_URL = prefilledUrl(`http://127.0.0.1:${bPort}`);
  process.env.WEC_GOOGLE_FORM_TEST_HOST = `127.0.0.1:${bPort}`;
  const out = await detail();
  expect(out.body.ready).toBe(false);
  expect(out.body.problems.some((p: string) => /options must be exactly/.test(p) && /1st Year/.test(p)), JSON.stringify(out.body.problems)).toBe(true);
  expect(out.body.problems.some((p: string) => /Do you agree to the terms\?/.test(p) && /required in the Form/.test(p)), JSON.stringify(out.body.problems)).toBe(true);
  await new Promise<void>(resolve => brokenServer.close(() => resolve()));

  // And a Form that requires a Google account.
  connect(); google.mode = "signin";
  const signin = await detail();
  expect(signin.body.problems.some((p: string) => /sign in to Google/.test(p))).toBe(true);
});

// ── The server side of the validation. The browser checks the same rules from
// the same file, but the browser is never the only guard: every one of these
// posts goes straight at the route, with no page involved at all.

test("10  every required field, emptied on its own, is refused with its own sentence", async () => {
  connect();
  // Each is emptied by itself in an otherwise perfect application, so a pass
  // here cannot come from some other field failing.
  for (const id of ["name", "westernEmail", "year", "program", "intro", "g1", "g2"] as const) {
    const v = application("director-admin");
    v[id] = "";
    const out = await post(v);
    expect(out.status, `${id} empty should be refused`).toBe(400);
    expect(out.body.error, `${id} should be an invalid application, not junk`).toBe("invalid");
    expect(out.body.errors[id], `there should be a message for ${id}`).toBeTruthy();
    expect(out.body.errors[id].trim(), `${id}'s message should be a plain sentence`).toMatch(/[a-z].*\.$/);
  }
  // And a missing role choice, which is not one of the fields above.
  const noRole = application("director-admin");
  noRole.roleKey = "";
  expect((await post(noRole)).status, "no position chosen must be refused").toBe(400);
  expect(google.received, "nothing reaches Google while anything is missing").toHaveLength(0);
});

test("11  every rule is checked on the server: emails, phone, links, the year list", async () => {
  connect();
  const cases: [keyof Application, string, RegExp][] = [
    ["westernEmail", "test.applicant@example.com", /Western email/],
    ["westernEmail", "amara@uwo.com", /Did you mean @uwo\.ca/],
    ["westernEmail", "amara at uwo.ca", /space in it|needs one @/],
    ["westernEmail", "amara@uwo", /looks incomplete/],
    ["personalEmail", "not-an-email", /needs one @/],
    ["personalEmail", "amara@gmial.com", /Did you mean @gmail\.com/],
    ["phone", "call me maybe", /digits, spaces/],
    ["phone", "5195", /too short/],
    ["phone", "5195550134555550134", /too long/],
    ["phone", "519 555+0134", /\+ belongs at the very start/],
    ["resume", "drive.google.com/file/d/abc", /start the link with https/],
    ["resume", "https://drive", /complete link/],
    ["linkedin", "linkedin.com/in/amara", /start the link with https/],
    ["portfolio", "ftp://example.com/portfolio", /start the link with https/],
    ["year", "Fifth Year", /pick one of the options/],
  ];
  for (const [id, value, wanted] of cases) {
    const v = application("outreach");
    v[id] = value;
    const out = await post(v);
    expect(out.status, `${id} = ${JSON.stringify(value)} should be refused`).toBe(400);
    expect(out.body.errors[id] ?? "", `${id} = ${JSON.stringify(value)}`).toMatch(wanted);
  }
  // Optional fields, left empty, are fine. Optional means unchecked only when empty.
  const fine = application("outreach");
  fine.phone = ""; fine.linkedin = ""; fine.portfolio = "";
  expect((await post(fine)).body, "empty optional fields are not an error").toEqual({ ok: true });
  expect(google.received).toHaveLength(1);
});

test("12  every paragraph answer is required and its word limit is enforced both ways", async () => {
  connect();
  // Walked from the schema, so a question added later is covered without
  // anybody remembering to add a test for it.
  const roleKey = "vp-content";
  const paragraphs = [
    ...ABOUT.filter(f => f.kind === "long").map(f => ({ id: f.id, max: f.max! })),
    ...GENERAL.map(f => ({ id: f.id, max: f.max! })),
    ...roleByKey(roleKey)!.qs.map(q => ({ id: q.id, max: q.max })),
  ];
  expect(paragraphs.length, "paragraphs from all three stages").toBeGreaterThanOrEqual(7);
  for (const p of paragraphs) {
    const empty = application(roleKey);
    empty[p.id] = "   ";
    const out1 = await post(empty);
    expect(out1.status, `${p.id} empty should be refused`).toBe(400);
    expect(out1.body.errors[p.id], `${p.id} empty should have a message`).toBeTruthy();

    const over = application(roleKey);
    over[p.id] = words(p.max + 1);
    const out2 = await post(over);
    expect(out2.status, `${p.id} one word over its limit should be refused`).toBe(400);
    expect(out2.body.errors[p.id] ?? "").toMatch(new RegExp(`limit is ${p.max}`));

    // Exactly on the limit is allowed: the limit is a limit, not a fence.
    const edge = application(roleKey);
    edge[p.id] = words(p.max);
    expect((await post(edge)).body, `${p.id} exactly at ${p.max} words should be accepted`).toEqual({ ok: true });
  }
  expect(google.received, "only the valid ones reached Google").toHaveLength(paragraphs.length);
});

test("13  one role's answers never carry into another role's submission", async () => {
  connect();
  // Somebody filled in VP Content, went back, and chose Director of Admin. The
  // page clears the old answers; this proves the server does not send them
  // even if a browser or a script kept them.
  const vp = application("vp-content");
  const swapped = application("director-admin");
  swapped.r4 = vp.r4;                    // Director of Admin has no fourth question
  swapped.rlink = "https://old.example"; // and no link question either
  expect((await post(swapped)).body).toEqual({ ok: true });
  const got = google.received[0];
  expect(got[ENTRY.r4], "a leftover fourth answer must not be sent").toBeUndefined();
  expect(got[ENTRY.rlink], "a leftover link must not be sent").toBeUndefined();
  expect(got[ENTRY.role]).toBe("Director of Admin");
  expect(got[ENTRY.r2]).toContain("15 action items");

  // The question text above an answer is always the chosen role's.
  google.received = [];
  const mismatched = application("director-admin");
  mismatched.r2 = "This was written for the VP Content question about creative freedom.";
  await post(mismatched);
  expect(google.received[0][ENTRY.r2]).toMatch(/^Imagine an exec meeting/);

  // A role that does not exist is still refused, even with perfect answers.
  google.received = [];
  const invented = application("vp-content");
  invented.roleKey = "vp-vibes";
  expect((await post(invented)).status).toBe(400);
  expect(google.received).toHaveLength(0);
});

// ── The review fixes ──────────────────────────────────────────────────────────

test("14  the page opens only on connected AND ready; connected but not ready stays closed", async () => {
  // The page decides with applicationsOpen(); prove it uses it, then run it.
  const src = readFileSync(path.join(process.cwd(), "src/components/sections/ExecApplicationsForm.tsx"), "utf8");
  expect(src).toMatch(/setOpen\(applicationsOpen\(d\)\)/);
  expect(applicationsOpen({ connected: true, ready: true })).toBe(true);
  expect(applicationsOpen({ connected: true, ready: false }), "connected but not ready must stay closed").toBe(false);
  expect(applicationsOpen({ connected: false, ready: false })).toBe(false);
  expect(applicationsOpen({ connected: true }), "a missing ready is not ready").toBe(false);
  expect(applicationsOpen(null)).toBe(false);
  // And the server does say connected-but-not-ready for a Form Google would refuse.
  connect(); google.mode = "closed";
  expect((await get()).body).toEqual({ connected: true, ready: false });
});

test("15  the public GET answers only { connected, ready }, and reuses its check", async () => {
  connect();
  const before = google.views;
  const out = await get();
  expect(out.status).toBe(200);
  expect(Object.keys(out.body).sort(), "no problems list, no question titles").toEqual(["connected", "ready"]);
  expect(out.body).toEqual({ connected: true, ready: true });
  await get(); await get();
  expect(google.views - before, "three page views, one Google fetch").toBe(1);
  // A broken Form shows no detail publicly either.
  resetExecApplicationsState(); google.mode = "signin";
  expect((await get()).body).toEqual({ connected: true, ready: false });
});

test("16  the detailed check needs the key, and production without a key refuses it", async () => {
  connect();
  process.env.WEC_SETUP_CHECK_KEY = "s3cret-check-key";
  expect((await detail()).status, "no key given").toBe(403);
  expect((await get("?detail=1&key=wrong")).status, "wrong key").toBe(403);
  expect((await get("?detail=1&key=s3cret-check-ke")).status, "a prefix of the key").toBe(403);
  const ok = await get("?detail=1&key=s3cret-check-key");
  expect(ok.status).toBe(200);
  expect(ok.body.problems, "the right key gets the problems list").toEqual([]);
  delete process.env.WEC_SETUP_CHECK_KEY;
  process.env.VERCEL_ENV = "production";
  const prod = await detail();
  expect(prod.status, "production with no key set: no detail for anybody").toBe(403);
  expect(prod.body.problems).toBeUndefined();
  process.env.VERCEL_ENV = "preview";
  expect((await detail()).status, "a preview deployment with no key set may show it").toBe(200);
});

test("17  the sixth POST from one address in ten minutes gets 429, and nothing is sent for it", async () => {
  connect();
  const ip = "198.51.100.7";
  for (let i = 1; i <= 5; i++) expect((await post(application("outreach"), ip)).body, `post ${i}`).toEqual({ ok: true });
  const sixth = await post(application("outreach"), ip);
  expect(sixth.status).toBe(429);
  expect(sixth.body.error).toBe("rate_limited");
  expect(google.received, "the sixth never reached Google").toHaveLength(5);
  // Another address is not affected.
  expect((await post(application("outreach"), "198.51.100.8")).body).toEqual({ ok: true });
  // The page has a plain message for it.
  const src = readFileSync(path.join(process.cwd(), "src/components/sections/ExecApplicationsForm.tsx"), "utf8");
  expect(src).toContain("rate_limited");
  expect(src).toContain("Too many tries");
});

test("18  the honeypot logs one line with no answers in it, and sends nothing", async () => {
  connect();
  const v = application("vp-community");
  v[HONEYPOT] = "filled by a bot";
  let out = { status: 0, body: {} };
  const lines = await capture(async () => { out = await post(v); });
  expect(out.body).toEqual({ ok: true });
  expect(google.received).toHaveLength(0);
  expect(lines, "exactly one log line").toHaveLength(1);
  expect(lines[0]).toMatch(/\[exec-applications\] honeypot/);
  for (const secret of ["Amara", "test.applicant@uwo.ca", "filled by a bot", "I build things"]) {
    expect(lines[0], `the log line must not carry ${secret}`).not.toContain(secret);
  }
  // The trap is not called "website": a browser autofilling that field must
  // not get a real applicant dropped.
  const real = application("vp-community");
  real.website = "https://example.com/portfolio";
  expect((await post(real)).body).toEqual({ ok: true });
  expect(google.received, "an application carrying a website field still goes through").toHaveLength(1);
});

test("19  an answer over 8,000 characters gets 400 with a sentence, never cut short", async () => {
  connect();
  const v = application("vp-content");
  v.program = "x".repeat(MAX_CHARS + 1);
  const out = await post(v);
  expect(out.status).toBe(400);
  expect(out.body.error).toBe("invalid");
  expect(out.body.errors.program).toMatch(/8,001 characters/);
  expect(out.body.errors.program).toMatch(/8,000/);
  // Under its word limit but over the characters: one giant "word".
  const w = application("vp-content");
  w.g1 = "a".repeat(9000);
  const out2 = await post(w);
  expect(out2.status).toBe(400);
  expect(out2.body.errors.g1).toMatch(/characters/);
  // Exactly at the limit is fine, and sent whole.
  const edge = application("vp-content");
  edge.program = "x".repeat(MAX_CHARS);
  expect((await post(edge)).body).toEqual({ ok: true });
  expect(google.received[0][ENTRY.program].length, "sent whole, not truncated").toBe(MAX_CHARS);
  expect(google.received).toHaveLength(1);
});

test("20  a Google Form link over plain http is refused", async () => {
  connect(prefilledUrl("https://docs.google.com").replace("https://", "http://"));
  // No test host for this one: only the real Google rule applies.
  delete process.env.WEC_GOOGLE_FORM_TEST_HOST;
  expect((await get()).body).toEqual({ connected: false, ready: false });
  expect((await detail()).body.problems[0]).toMatch(/https:\/\/docs\.google\.com/);
  let out = { status: 0 };
  await capture(async () => { out = await post(application("outreach")); });
  expect(out.status).toBe(503);
  expect(google.received).toHaveLength(0);
});

test("21  WEC_GOOGLE_FORM_TEST_HOST is ignored in production", async () => {
  connect();
  process.env.VERCEL_ENV = "production";
  let out = { status: 0 };
  await capture(async () => { out = await post(application("outreach")); });
  expect(out.status, "in production the stand-in host must not be accepted").toBe(503);
  expect(google.received, "nothing reached the test host").toHaveLength(0);
  expect((await get()).body).toEqual({ connected: false, ready: false });
  delete process.env.VERCEL_ENV;
  resetExecApplicationsState();
  expect((await post(application("outreach"))).body, "outside production it is used").toEqual({ ok: true });
});

test("22  personal email and the resume link may be left blank, and are then not sent at all", async () => {
  connect();
  const v = application("vp-content");
  v.personalEmail = "";
  v.resume = "";
  const out = await post(v);
  expect(out.body, "a blank optional field must not stop an application").toEqual({ ok: true });
  expect(google.received).toHaveLength(1);
  const got = google.received[0];
  // Omitted, not sent empty. A Google question that is still required would
  // refuse the whole submission for a blank answer, so the Form's copies of
  // these two must be optional as well: docs/EXEC-APPLICATIONS-FORM.md §1.
  expect(got[ENTRY.personalEmail]).toBeUndefined();
  expect(got[ENTRY.resume]).toBeUndefined();
  // Everything else still arrives.
  expect(got[ENTRY.westernEmail]).toBe("test.applicant@uwo.ca");
  expect(got[ENTRY.role]).toBe("VP Content");
});

test("23  a Form that still demands an optional answer warns, and does NOT close applications", async () => {
  // ⛔ THIS HAPPENED LIVE. Reported as a problem, this shut the applications
  // page for everyone, including the applicants who would have answered the
  // question perfectly well. It is a warning: it is named loudly by the setup
  // check, and the page stays open.
  const stillRequired = questions().map(q =>
    q.entry === ENTRY.personalEmail || q.entry === ENTRY.resume ? { ...q, required: true } : q);
  const server = startFakeGoogle({ questions: stillRequired });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as { port: number }).port;
  process.env.WEC_APPLY_GOOGLE_FORM_URL = prefilledUrl(`http://127.0.0.1:${port}`);
  process.env.WEC_GOOGLE_FORM_TEST_HOST = `127.0.0.1:${port}`;

  const out = await detail();
  expect(out.body.ready, "a mismatch like this must not close the page").toBe(true);
  expect(out.body.problems, "and it is not a problem").toEqual([]);
  for (const label of ["Personal email", "Resume link"]) {
    expect(
      out.body.warnings.some((w: string) => w.includes(label) && /allowed to leave it blank/.test(w)),
      `${label} should be warned about: ${JSON.stringify(out.body.warnings)}`,
    ).toBe(true);
  }
  expect(out.body.warnings.some((w: string) => /Turn Required off/.test(w))).toBe(true);

  // The page asks the public endpoint, which never carries warnings, and opens.
  const publicAnswer = await GET(new Request(BASE));
  expect(await publicAnswer.json()).toEqual({ connected: true, ready: true });

  // And an application that answers the question still goes through.
  const out2 = await post(application("vp-content"));
  expect(out2.body).toEqual({ ok: true });
  await new Promise<void>(resolve => server.close(() => resolve()));
});

test("24  without privacy consent nothing is sent to Google, and consent must be the boolean true", async () => {
  connect();
  const v = application("vp-content");
  for (const consent of [false, "true", 1, null]) {
    const out = await post({ ...v, [PRIVACY_CONSENT]: consent });
    expect(out.status, `consent ${JSON.stringify(consent)} must be refused`).toBe(400);
    expect(out.body).toEqual({ error: "consent_required" });
  }
  // Straight to the route, past the helper that would add consent.
  const missing = await POST(new Request(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.9.9.9" },
    body: JSON.stringify(v),
  }));
  expect(missing.status, "no consent field at all must be refused").toBe(400);
  expect(google.received, "nothing may reach Google without consent").toHaveLength(0);

  const ok = await post({ ...v, [PRIVACY_CONSENT]: true });
  expect(ok.body).toEqual({ ok: true });
  expect(google.received).toHaveLength(1);
  expect(Object.values(google.received[0]), "the consent flag itself is never sent to Google").not.toContain("true");
});
