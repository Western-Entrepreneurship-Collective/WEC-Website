/**
 * A stand-in for Google Forms, for testing only. Never deployed, never used by
 * the site: it exists so the exec applications submit path can be proved end to
 * end without a real Form, a real account, or a real row landing in a real
 * Sheet. Nothing it receives leaves this machine.
 *
 * It serves the two things the real thing serves:
 *   GET  /forms/d/e/<id>/viewform      the public page, carrying FB_PUBLIC_LOAD_DATA_
 *   POST /forms/d/e/<id>/formResponse  the submit endpoint
 * plus two for the browser tests, which run in another process:
 *   GET  /__received                   what it has been sent, as JSON
 *
 * and it can be told to behave badly on purpose:
 *   mode "ok"      200, and the answers are recorded in server.received
 *   mode "refuse"  400, the way Google refuses an answer it does not like,
 *                  with no reason attached
 *   mode "signin"  302 to a login page, the way a Form that requires a Google
 *                  account answers. Followed, that redirect looks like success.
 *   mode "closed"  the page says it is no longer accepting responses
 */
import http from "node:http";
import { ABOUT, FIELDS, GENERAL, ROLE_FIELD, ROLE_SLOTS, YEARS, type FieldId } from "../../src/lib/execApplications";

export const FORM_ID = "1FAIpQLFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE";

// entry ids, chosen to look like Google's.
export const ENTRY: Record<FieldId, string> = {
  name: "entry.1000001", westernEmail: "entry.1000002", personalEmail: "entry.1000003",
  phone: "entry.1000004", year: "entry.1000005", program: "entry.1000006",
  linkedin: "entry.1000007", portfolio: "entry.1000008", resume: "entry.1000009",
  intro: "entry.1000010", g1: "entry.1000011", g2: "entry.1000012",
  role: "entry.1000013", r1: "entry.1000014", r2: "entry.1000015",
  r3: "entry.1000016", r4: "entry.1000017", rlink: "entry.1000018",
};

export type FakeQuestion = { title: string; entry: string; required: boolean; choices: string[] | null };
export type FakeMode = "ok" | "refuse" | "signin" | "closed";
export type FakeGoogle = http.Server & { mode: FakeMode; received: Record<string, string>[]; views: number };

// Google's own shape: data[1][1] is the list of questions, each question is
// [ , title, , , [ [entryId, choices, required] ] ].
function loadData(questions: FakeQuestion[]) {
  const items = questions.map(q => [null, q.title, null, null,
    [[Number(q.entry.replace("entry.", "")), q.choices ? q.choices.map(c => [c]) : null, q.required ? 1 : 0]]]);
  return JSON.stringify([null, [null, items]]);
}

/** The question list a correctly built Form would have, straight off the schema. */
export function questions(): FakeQuestion[] {
  const list: FakeQuestion[] = [...ABOUT, ...GENERAL].map(f => ({
    title: f.label, entry: ENTRY[f.id], required: f.req, choices: f.kind === "select" ? [...(f.choices ?? [])] : null,
  }));
  list.push({ title: ROLE_FIELD.label, entry: ENTRY.role, required: true, choices: [...ROLE_FIELD.choices] });
  ROLE_SLOTS.forEach((slot, i) => list.push({ title: `Role question ${i + 1}`, entry: ENTRY[slot.id], required: false, choices: null }));
  return list;
}

/** The pre-filled link the club would paste into the setting, pointed at this stand-in. */
export function prefilledUrl(origin: string) {
  const url = new URL(`${origin}/forms/d/e/${FORM_ID}/viewform`);
  url.searchParams.set("usp", "pp_url");
  for (const f of FIELDS) if (f.ph) url.searchParams.set(ENTRY[f.id], f.ph);
  url.searchParams.set(ENTRY.year, YEARS[0]);
  url.searchParams.set(ENTRY.role, ROLE_FIELD.choices[0]);
  return url.toString();
}

export function startFakeGoogle(options: { questions?: FakeQuestion[] } = {}): FakeGoogle {
  const questionList = options.questions ?? questions();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/__received") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(server.received));
    }
    if (req.method === "GET" && url.pathname === `/forms/d/e/${FORM_ID}/viewform`) {
      server.views++;
      if (server.mode === "signin") {
        res.statusCode = 302;
        res.setHeader("Location", "https://accounts.google.com/signin");
        return res.end();
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end("<!doctype html><html><body>"
        + (server.mode === "closed" ? "<p>This form is no longer accepting responses.</p>" : "")
        + `<script>var FB_PUBLIC_LOAD_DATA_ = ${loadData(questionList)};</script>`
        + "</body></html>");
    }
    if (req.method === "POST" && url.pathname === `/forms/d/e/${FORM_ID}/formResponse`) {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        if (server.mode === "signin") {
          res.statusCode = 302;
          res.setHeader("Location", "https://accounts.google.com/signin");
          return res.end();
        }
        if (server.mode === "refuse") { res.statusCode = 400; return res.end("bad"); }
        const got: Record<string, string> = {};
        new URLSearchParams(Buffer.concat(chunks).toString("utf8")).forEach((value, key) => { got[key] = value; });
        server.received.push(got);
        res.statusCode = 200;
        res.end("ok");
      });
      return;
    }
    res.statusCode = 404;
    res.end("no");
  }) as FakeGoogle;
  server.mode = "ok";
  server.received = [];
  server.views = 0;   // how many times the public Form page was fetched
  return server;
}

/** Where the browser tests' stand-in listens. The Next server is pointed at it in playwright.config.ts. */
export const E2E_FAKE_PORT = 3002;
export const E2E_FAKE_ORIGIN = `http://127.0.0.1:${E2E_FAKE_PORT}`;
