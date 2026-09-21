"use client";

/**
 * WEC Executive Applications 2026-27, the applicant's side.
 *
 * WHAT THIS PAGE IS NOT
 *
 * No admin, no dashboard, no database, no login. Nothing is kept in
 * localStorage. Answers live in React state for as long as the tab is open and
 * go to exactly one place: the club's Google Form, through
 * /api/exec-applications, which writes them into the Form's Sheet. The Sheet
 * is the only store.
 *
 * THERE IS NO LANDING PAGE. The page opens on stage 1, About you. The club will
 * design the applicant-facing landing page itself; until then somebody who
 * opens this page is already filling the form in, and the only things above it
 * are the WEC mark and one line saying what they are filling in.
 *
 * THE ROUTING IS REAL ROUTING
 *
 * The role questions stage renders the chosen role's questions and nothing
 * else. There is no hidden markup for the other eleven roles and no CSS doing
 * the hiding: roleQuestions() below reads one role's list.
 *
 * Every question, limit and check comes from src/lib/execApplications.ts, the
 * same file the server route checks against.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Arrow } from "@/components/graphics/DraftGraphics";
import { contactEmail } from "@/data/siteContent";
import {
  ABOUT, EXEC_APPLICATIONS_API, GENERAL, GROUPS, HONEYPOT, ROLES, ROLE_SLOTS,
  applicationsOpen, blank, checkAbout, checkEverything, checkGeneral, checkRoleAnswers, checkRoleChoice,
  roleByKey, words, type Application, type Errors, type FieldId, type Question, type Role,
} from "@/lib/execApplications";

const ABOUT_STAGE = 1, GENERAL_STAGE = 2, POSITION = 3, ROLEQ = 4, REVIEW = 5;
type Stage = 1 | 2 | 3 | 4 | 5;

const STAGES: { at: Stage; t: string }[] = [
  { at: ABOUT_STAGE, t: "About you" },
  { at: GENERAL_STAGE, t: "General" },
  { at: POSITION, t: "Position" },
  { at: ROLEQ, t: "Role questions" },
  { at: REVIEW, t: "Review" },
];

type Status = "idle" | "sending" | "sent" | "unconfirmed" | "failed" | "limited" | "closed";

function titleFor(step: Stage, role: Role | null) {
  if (step === ABOUT_STAGE) return "Let's get to know you.";
  if (step === GENERAL_STAGE) return "Before we talk roles...";
  if (step === POSITION) return "Where do you want to build?";
  if (step === ROLEQ) return role ? role.title : "Role questions";
  return "Review your application.";
}

function subtitleFor(step: Stage, role: Role | null) {
  if (step === ABOUT_STAGE) return "Before we get into the role, tell us a little about yourself.";
  if (step === GENERAL_STAGE) return "We want to understand the person behind the application.";
  if (step === POSITION) return "Choose the role where you think you can create the most impact.";
  if (step === ROLEQ) return role ? role.sub : "";
  return "Check everything below, then submit. You can still edit any section.";
}

const errorId = (id: string) => `exec-error-${id}`;

/** " or email <address>" when the club has set an address it owns; nothing otherwise. */
function OrEmail({ lead = " or email " }: { lead?: string }) {
  // ⛔ No fallback address. See the note on contactEmail in siteContent: the
  // address both WEC sites once carried belongs to a domain squatter.
  if (!contactEmail) return null;
  return <>{lead}<strong>{contactEmail}</strong></>;
}

function Field({ id, label, req, error, hint, children }: {
  id: string; label: string; req?: boolean; error?: string; hint?: string; children: ReactNode;
}) {
  return (
    <div className="exec-field">
      <label htmlFor={id}>{label}{req ? <span className="exec-req" aria-hidden="true"> *</span> : null}</label>
      {children}
      {error
        ? <em className="exec-error" id={errorId(id)}>{error}</em>
        : hint ? <span className="exec-hint">{hint}</span> : null}
    </div>
  );
}

/**
 * A long answer with a live word counter. The counter counts as you type and
 * turns red past the limit; Continue refuses to move on while it is red, so
 * nobody writes 400 words and finds out at the end.
 */
function LongAnswer({ id, label, hint, max, value, onChange, error, rows = 7 }: {
  id: string; label: string; hint?: string; max: number; value: string;
  onChange: (value: string) => void; error?: string; rows?: number;
}) {
  const n = words(value);
  const over = n > max;
  return (
    <div className="exec-field exec-long">
      <label htmlFor={id}>{label}<span className="exec-req" aria-hidden="true"> *</span></label>
      {hint ? <span className="exec-hint">{hint}</span> : null}
      <textarea id={id} name={id} rows={rows} value={value} onChange={e => onChange(e.target.value)}
                aria-invalid={!!error} aria-describedby={error ? errorId(id) : `${id}-count`} />
      <div className="exec-count">
        {error ? <em className="exec-error" id={errorId(id)}>{error}</em> : <span />}
        <span id={`${id}-count`} className={`exec-words${over ? " is-over" : ""}`}>{n} / {max} words</span>
      </div>
    </div>
  );
}

export function ExecApplicationsForm() {
  const [step, setStep] = useState<Stage>(ABOUT_STAGE);
  const [v, setV] = useState<Application>(blank);
  const [err, setErr] = useState<Errors>({});
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  // The honeypot. No person ever sees it; a bot fills every box it finds.
  const [trap, setTrap] = useState("");
  // Set when an Edit button on the review sent them back, so Continue can take
  // them straight back to the review instead of walking every stage again.
  const [editing, setEditing] = useState(false);
  // null while we are still asking the server whether the Form is connected
  // AND ready. Connected but not ready (a Form Google would refuse) is closed.
  const [open, setOpen] = useState<boolean | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    let alive = true;
    fetch(EXEC_APPLICATIONS_API, { headers: { Accept: "application/json" }, cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (alive) setOpen(applicationsOpen(d)); })
      // No answer from the API at all (an outage) is not a reason to pretend
      // applications are open.
      .catch(() => { if (alive) setOpen(false); });
    return () => { alive = false; };
  }, []);

  // After a stage change, put the reader at the top of the new stage, and put
  // focus on its heading so a screen reader announces where they are.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    window.scrollTo(0, 0);
    // On a phone the stage strip scrolls sideways; keep the current stage in it.
    const current = rootRef.current?.querySelector<HTMLElement>(".exec-step.is-on");
    const strip = current?.closest("ol");
    if (current && strip) strip.scrollLeft = current.offsetLeft - strip.offsetLeft - 24;
    headingRef.current?.focus({ preventScroll: true });
  }, [step, status]);

  const role = roleByKey(v.roleKey);

  function set(id: FieldId) {
    return (value: string) => {
      // Functional, so two quick changes can never overwrite each other.
      setV(prev => ({ ...prev, [id]: value }));
      // Editing a field clears ITS error. Leaving it on screen after the fix
      // reads as "my correction did not work".
      setErr(prev => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    };
  }

  function jumpToFirstProblem() {
    requestAnimationFrame(() => {
      const first = rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], .exec-err-top');
      if (!first) return;
      first.scrollIntoView({ block: "center", behavior: "smooth" });
      first.focus({ preventScroll: true });
    });
  }

  function checkStep(at: Stage): Errors {
    if (at === ABOUT_STAGE) return checkAbout(v);
    if (at === GENERAL_STAGE) return checkGeneral(v);
    if (at === POSITION) return checkRoleChoice(v);
    if (at === ROLEQ) return checkRoleAnswers(v);
    return checkEverything(v);
  }

  function go(at: Stage) {
    moved.current = true;
    setStep(at);
  }

  function next() {
    const problems = checkStep(step);
    setErr(problems);
    if (Object.keys(problems).length) { jumpToFirstProblem(); return; }
    // Came here from an Edit button: go straight back to the review. Changing
    // the position is the one case that cannot come back this way, and it does
    // not: that stage has no Continue, and picking a different card sends them
    // through the new role's questions first.
    if (editing) { setEditing(false); go(REVIEW); return; }
    go((step + 1) as Stage);
  }

  // Back only moves the stage number. It never touches an answer.
  function back() { setErr({}); go((step - 1) as Stage); }

  async function submit() {
    if (status === "sending") return;
    const problems = checkEverything(v);
    setErr(problems);
    if (Object.keys(problems).length) { setStatus("idle"); jumpToFirstProblem(); return; }
    if (!confirmed) { setStatus("unconfirmed"); return; }
    setStatus("sending");
    try {
      const response = await fetch(EXEC_APPLICATIONS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, [HONEYPOT]: trap }),
      });
      const data = await response.json().catch(() => ({}));
      // "You're in" is only ever said after the server said Google took it.
      if (response.ok && data?.ok) { moved.current = true; setStatus("sent"); return; }
      if (data?.error === "invalid" && data.errors) {
        setErr(data.errors); setStatus("idle"); jumpToFirstProblem(); return;
      }
      setStatus(data?.error === "not_connected" ? "closed" : data?.error === "rate_limited" ? "limited" : "failed");
    } catch {
      setStatus("failed");
    }
  }

  // ── stage 3: picking a card goes straight to that role's questions ──
  function anyRoleAnswerTyped() {
    return ROLE_SLOTS.some(slot => String(v[slot.id] ?? "").trim());
  }

  function pickRole(r: Role) {
    const already = v.roleKey === r.key;
    if (!already && anyRoleAnswerTyped()) {
      // Only ever asked when there is something real to lose. Changing role
      // MUST clear the old role's answers: r2 of one role is a different
      // question from r2 of another, and carrying the text across would
      // silently put an answer to a question the applicant never read into the
      // club's Sheet.
      const was = roleByKey(v.roleKey);
      const ok = window.confirm(`You have already written answers for ${was ? was.title : "the other position"}. `
        + `Switching to ${r.title} will delete them, because the questions are different. Switch anyway?`);
      if (!ok) return;
    }
    setV(prev => {
      const nv = { ...prev, roleKey: r.key };
      if (!already) for (const slot of ROLE_SLOTS) nv[slot.id] = "";
      return nv;
    });
    setErr(prev => {
      const ne = { ...prev };
      delete ne.role;
      // The old role's error messages belong to questions that are gone.
      if (!already) for (const slot of ROLE_SLOTS) delete ne[slot.id];
      return ne;
    });
    // Came from an Edit button and did not actually change anything: there is
    // nothing to answer again, so go back to the review.
    if (already && editing) { setEditing(false); go(REVIEW); return; }
    go(ROLEQ);
  }

  // ── success ──
  if (status === "sent") {
    return (
      <div className="exec-card exec-done" role="status" ref={rootRef}>
        <h1 ref={headingRef} tabIndex={-1}>You&rsquo;re in. 🚀</h1>
        <p>
          Thanks for applying to the WEC Executive Team 2026-27. <strong>By founders, for founders.</strong>{" "}
          Applications are now under review. We&rsquo;ll be in touch.
        </p>
        <dl className="exec-done-rows">
          <div><dt>Position</dt><dd>{role?.title}</dd></div>
          <div><dt>Applied as</dt><dd>{v.name}</dd></div>
          <div><dt>We&rsquo;ll reply to</dt><dd>{v.westernEmail}</dd></div>
        </dl>
        <Link className="exec-btn exec-btn-primary" href="/">Back to the site<Arrow /></Link>
      </div>
    );
  }

  // NOT OPEN YET. With no Form connected, or a connected Form that Google would
  // refuse (the server says ready: false), there is nowhere for an application
  // to go, so the whole form sits inside a disabled fieldset: every input,
  // select, textarea, role card and button inside it stops responding. The
  // stages still render, so somebody can read what is being asked, but nothing
  // can be filled in and nothing can be submitted.
  const usable = open === true;
  const errorCount = Object.keys(err).length;
  const pct = Math.round((step - 1) / (REVIEW - 1) * 100);

  return (
    <div className="exec-card" ref={rootRef}>
      {/* Off screen rather than display:none, which some bots skip. */}
      <div className="exec-hp" aria-hidden="true">
        <label>Leave this empty
          <input type="text" name={HONEYPOT} id={HONEYPOT} tabIndex={-1} autoComplete="off"
                 data-lpignore="true" data-1p-ignore="true" data-form-type="other"
                 value={trap} onChange={e => setTrap(e.target.value)} />
        </label>
      </div>

      {open === false ? (
        <div className="exec-note is-bad" role="status">
          <p>
            <strong>Applications are not open yet.</strong> This page is live but it cannot receive an
            application yet, so nothing typed here would reach us. The questions below are shown so you
            know what to expect, and they cannot be filled in yet. Check back shortly<OrEmail lead=", or email " />.
          </p>
        </div>
      ) : null}
      {open === null ? (
        <div className="exec-note" role="status"><p>Checking whether applications are open...</p></div>
      ) : null}

      <ol className="exec-steps" aria-label="Application stages">
        {STAGES.map(s => (
          <li key={s.t}>
            <button
              type="button"
              className={`exec-step${step === s.at ? " is-on" : step > s.at ? " is-past" : ""}`}
              // Going backwards through the strip is allowed and keeps every
              // answer. Jumping forwards is not: later stages depend on the
              // earlier ones being valid.
              disabled={step <= s.at}
              onClick={() => { if (step > s.at) { setErr({}); go(s.at); } }}
              aria-current={step === s.at ? "step" : undefined}
            >
              <span className="exec-step-t">{s.t}</span>
              {s.at === ROLEQ && role ? <span className="exec-step-r">{role.title}</span> : null}
            </button>
          </li>
        ))}
      </ol>
      <div className="exec-progress" aria-hidden="true"><div style={{ width: `${pct}%` }} /></div>
      <p className="micro exec-stage-count">Stage {step} of {REVIEW}</p>

      <h1 ref={headingRef} tabIndex={-1}>{titleFor(step, role)}</h1>
      <p className="exec-sub">{subtitleFor(step, role)}</p>

      <fieldset className="exec-fs" disabled={!usable}>
        {step === ABOUT_STAGE ? aboutStep()
          : step === GENERAL_STAGE ? generalStep()
            : step === POSITION ? positionStep()
              : step === ROLEQ ? roleQuestions() : reviewStep()}

        <div className="exec-actions">
          {/* The position stage has no Continue: picking a card IS the continue. */}
          {step === POSITION ? null : step < REVIEW ? (
            <button type="button" className="exec-btn exec-btn-primary" onClick={next}>
              {editing ? "Back to review" : step === ROLEQ ? "Review application" : "Continue"}<Arrow />
            </button>
          ) : (
            <button type="button" className="exec-btn exec-btn-primary" onClick={submit} disabled={status === "sending"}>
              {status === "sending" ? "Sending..." : "Submit application"}<Arrow />
            </button>
          )}
          {/* Stage 1 is the first thing on the page, so there is nothing to go
              back to. The mark at the top is the way back to the site. */}
          {step > ABOUT_STAGE ? <button type="button" className="exec-btn exec-btn-ghost" onClick={back}>Back</button> : null}
          <span className="exec-actions-hint">
            {errorCount
              ? `${errorCount} ${errorCount === 1 ? "answer needs" : "answers need"} fixing`
              : step === POSITION ? "Pick a position to carry on" : "Nothing is sent until you submit"}
          </span>
        </div>
      </fieldset>

      {step === ABOUT_STAGE ? (
        <div className="exec-note">
          <p>Your answers are not saved as you go. Finish in one sitting, and keep this tab open. Nothing is stored anywhere until you press Submit on the last page.</p>
        </div>
      ) : null}
    </div>
  );

  // ── stage 1 ──
  function aboutStep() {
    return (
      <div className="exec-stage">
        <div className="exec-grid">
          {ABOUT.filter(f => f.kind !== "long").map(f => shortField(f))}
        </div>
        {ABOUT.filter(f => f.kind === "long").map(f => (
          <LongAnswer key={f.id} id={f.id} label={f.label} hint={f.hint} max={f.max ?? 0}
                      value={v[f.id]} onChange={set(f.id)} error={err[f.id]} rows={6} />
        ))}
      </div>
    );
  }

  function shortField(f: Question) {
    const invalid = !!err[f.id];
    const common = {
      id: f.id, name: f.id, value: v[f.id],
      "aria-invalid": invalid,
      "aria-describedby": invalid ? errorId(f.id) : undefined,
    };
    return (
      <Field key={f.id} id={f.id} label={f.label} req={f.req} error={err[f.id]} hint={f.hint}>
        {f.kind === "select" ? (
          <select {...common} onChange={e => set(f.id)(e.target.value)}>
            <option value="">Choose one</option>
            {(f.choices ?? []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input {...common} onChange={e => set(f.id)(e.target.value)} placeholder={f.placeholder ?? ""}
                 type={f.kind === "email" ? "email" : f.kind === "url" ? "url" : f.kind === "phone" ? "tel" : "text"}
                 inputMode={f.kind === "phone" ? "tel" : f.kind === "email" ? "email" : f.kind === "url" ? "url" : undefined}
                 autoComplete={f.id === "name" ? "name" : f.kind === "email" ? "email" : f.kind === "phone" ? "tel" : "off"} />
        )}
      </Field>
    );
  }

  // ── stage 2 ──
  function generalStep() {
    return (
      <div className="exec-stage">
        {GENERAL.map(q => (
          <LongAnswer key={q.id} id={q.id} label={q.label} max={q.max ?? 0}
                      value={v[q.id]} onChange={set(q.id)} error={err[q.id]} rows={9} />
        ))}
      </div>
    );
  }

  // ── stage 3 ──
  function positionStep() {
    return (
      <div className="exec-stage">
        {err.role ? <p className="exec-err-top" role="alert" tabIndex={-1}>{err.role}</p> : null}
        {GROUPS.map(g => (
          <div className="exec-group" key={g}>
            <h2 className="micro">{g}</h2>
            <div className="exec-cards">
              {ROLES.filter(r => r.group === g).map(r => {
                const on = v.roleKey === r.key;
                return (
                  <button type="button" key={r.key} className={`exec-role${on ? " is-on" : ""}`}
                          aria-pressed={on} onClick={() => pickRole(r)}>
                    {on ? <span className="exec-role-n">Selected</span> : null}
                    <span className="exec-role-t">{r.title}</span>
                    <span className="exec-role-d">{r.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── stage 4: ONE role's questions, read from that role ──
  function roleQuestions() {
    if (!role) return <p className="exec-err-top">Pick a position first.</p>;
    return (
      <div className="exec-stage">
        {role.qs.map((q, i) => (
          <LongAnswer key={q.id} id={q.id} label={`${i + 1}. ${q.label}`} max={q.max}
                      value={v[q.id]} onChange={set(q.id)} error={err[q.id]} rows={q.max > 200 ? 9 : 7} />
        ))}
        {role.link ? (
          <Field id={role.link.id} label={role.link.label} error={err[role.link.id]} hint={role.link.hint}>
            <input id={role.link.id} name={role.link.id} type="url" inputMode="url" placeholder="https://"
                   value={v[role.link.id]} onChange={e => set("rlink")(e.target.value)}
                   aria-invalid={!!err[role.link.id]} aria-describedby={err[role.link.id] ? errorId(role.link.id) : undefined} />
          </Field>
        ) : null}
      </div>
    );
  }

  // ── stage 5 ──
  function reviewStep() {
    return (
      <div className="exec-stage">
        {section("About you", ABOUT_STAGE, ABOUT.map(f => [f.label, v[f.id] || "Not answered"]))}
        {section("General questions", GENERAL_STAGE, GENERAL.map(q => [q.label, v[q.id] || "Not answered"]))}
        {section("Position", POSITION, [["Applying for", role ? role.title : "Not chosen"]])}
        {section("Role questions", ROLEQ, role
          ? [...role.qs.map(q => [q.label, v[q.id] || "Not answered"]),
            ...(role.link ? [[role.link.label, v[role.link.id] || "Not answered"]] : [])]
          : [["Role questions", "Pick a position first"]])}

        <label className="exec-confirm">
          <input type="checkbox" checked={confirmed}
                 onChange={e => { setConfirmed(e.target.checked); if (status === "unconfirmed") setStatus("idle"); }} />
          <span>I confirm that the information in this application is accurate.</span>
        </label>

        {status === "unconfirmed" ? (
          <p className="exec-err-top" role="alert">Please tick the box above to confirm your application is accurate.</p>
        ) : null}
        {status === "failed" ? (
          <div className="exec-note is-bad" role="alert"><p>
            <strong>That didn&rsquo;t go through.</strong> Nothing was submitted and every answer above is
            still here. Press Submit again in a moment.
            {contactEmail ? <> If it keeps failing, email your answers to <strong>{contactEmail}</strong> and we will take it from there.</> : null}
          </p></div>
        ) : null}
        {status === "limited" ? (
          <div className="exec-note is-bad" role="alert"><p>
            <strong>Too many tries from this connection.</strong> Nothing was submitted and every answer above
            is still here. Wait ten minutes, then press Submit again.
            {contactEmail ? <> If it keeps happening, email your answers to <strong>{contactEmail}</strong>.</> : null}
          </p></div>
        ) : null}
        {status === "closed" ? (
          <div className="exec-note is-bad" role="alert"><p>
            <strong>Applications are not open yet.</strong> Nothing was submitted. Your answers are still
            here, so keep this tab open, or copy them somewhere safe.
          </p></div>
        ) : null}
        {errorCount ? (
          <p className="exec-err-top" role="alert">
            Some answers still need fixing. Use the Edit buttons above to go back to them. Nothing has been sent.
          </p>
        ) : null}
      </div>
    );
  }

  function section(title: string, at: Stage, rows: string[][]) {
    return (
      <div className="exec-review">
        <div className="exec-review-h">
          <h2>{title}</h2>
          {/* Edit only moves the stage number. It never touches an answer. */}
          <button type="button" className="exec-edit" aria-label={`Edit ${title}`}
                  onClick={() => { setEditing(true); setErr({}); go(at); }}>Edit</button>
        </div>
        <dl>
          {rows.map(([k, value], i) => (
            <div key={`${title}-${i}`}><dt>{k}</dt><dd>{value}</dd></div>
          ))}
        </dl>
      </div>
    );
  }
}
