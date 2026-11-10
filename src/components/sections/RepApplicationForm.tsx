"use client";

/**
 * WEC First Year Rep applications 2026-27, the applicant's side.
 *
 * Built on the exec application's look and flow (the exec-* classes in
 * src/styles/exec-applications.css): stages along the top, one stage at a
 * time, live word counters, a review page with Edit buttons, and nothing sent
 * until Submit. Every question, limit and check comes from
 * src/lib/repApplications.ts, the same file the server route checks against.
 *
 * Answers live in React state while the tab is open and nowhere else: no
 * localStorage, nothing saved as you go.
 *
 * ⛔ LOCAL PREVIEW. Outside production the form can be filled in even when the
 * server says applications are closed, so the design can be reviewed on a
 * laptop. Submitting still goes through the server, which refuses while
 * closed, so a preview can never send anything anywhere.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Arrow } from "@/components/graphics/DraftGraphics";
import {
  HONEYPOT, REP_APPLICATIONS_API, REP_CLOSES, REP_STAGES,
  blankRep, checkRepApplication, checkRepStage, words,
  type RepApplication, type RepErrors, type RepFieldId, type RepQuestion,
} from "@/lib/repApplications";
import { CONSENT_ERROR, PRIVACY_CONSENT, PRIVACY_PATH } from "@/lib/privacy";

const REVIEW = REP_STAGES.length + 1;
const PREVIEW = process.env.NODE_ENV !== "production";

type Status = "idle" | "sending" | "sent" | "unconfirmed" | "unconsented" | "failed" | "limited" | "closed";

const errorId = (id: string) => `rep-error-${id}`;

function Field({ q, error, children }: { q: RepQuestion; error?: string; children: ReactNode }) {
  return (
    <div className="exec-field">
      <label htmlFor={q.id}>{q.label}{q.req ? <span className="exec-req" aria-hidden="true"> *</span> : <span className="exec-hint"> (optional)</span>}</label>
      {children}
      {error
        ? <em className="exec-error" id={errorId(q.id)}>{error}</em>
        : q.hint ? <span className="exec-hint">{q.hint}</span> : null}
    </div>
  );
}

/** A written answer with a live word counter that turns red past the limit. */
function LongAnswer({ q, value, onChange, error }: {
  q: RepQuestion; value: string; onChange: (value: string) => void; error?: string;
}) {
  const n = words(value);
  const max = q.max ?? 0;
  const over = max > 0 && n > max;
  return (
    <div className="exec-field exec-long">
      <label htmlFor={q.id}>{q.label}{q.req ? <span className="exec-req" aria-hidden="true"> *</span> : <span className="exec-hint"> (optional)</span>}</label>
      {q.hint ? <span className="exec-hint">{q.hint}</span> : null}
      <textarea id={q.id} name={q.id} rows={max > 120 ? 7 : 4} value={value} onChange={e => onChange(e.target.value)}
                aria-invalid={!!error} aria-describedby={error ? errorId(q.id) : `${q.id}-count`} />
      <div className="exec-count">
        {error ? <em className="exec-error" id={errorId(q.id)}>{error}</em> : <span />}
        {max ? <span id={`${q.id}-count`} className={`exec-words${over ? " is-over" : ""}`}>{n} / {max} words</span> : <span />}
      </div>
    </div>
  );
}

export function RepApplicationForm() {
  const [step, setStep] = useState(1);
  const [v, setV] = useState<RepApplication>(blankRep);
  const [err, setErr] = useState<RepErrors>({});
  const [confirmed, setConfirmed] = useState(false);
  // ⛔ Unticked on purpose. Nothing is sent until it is ticked, and the server
  // refuses an application without it. See src/lib/privacy.ts.
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [trap, setTrap] = useState("");
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<boolean | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    let alive = true;
    fetch(REP_APPLICATIONS_API, { headers: { Accept: "application/json" }, cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (alive) setOpen(d?.connected === true && d?.ready === true); })
      .catch(() => { if (alive) setOpen(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    window.scrollTo(0, 0);
    const current = rootRef.current?.querySelector<HTMLElement>(".exec-step.is-on");
    const strip = current?.closest("ol");
    if (current && strip) strip.scrollLeft = current.offsetLeft - strip.offsetLeft - 24;
    headingRef.current?.focus({ preventScroll: true });
  }, [step, status]);

  function set(id: RepFieldId) {
    return (value: string) => {
      setV(prev => ({ ...prev, [id]: value }));
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

  function go(at: number) { moved.current = true; setStep(at); }

  function next() {
    const problems = checkRepStage(REP_STAGES[step - 1], v);
    setErr(problems);
    if (Object.keys(problems).length) { jumpToFirstProblem(); return; }
    if (editing) { setEditing(false); go(REVIEW); return; }
    go(step + 1);
  }

  function back() { setErr({}); go(step - 1); }

  async function submit() {
    if (status === "sending") return;
    const problems = checkRepApplication(v);
    setErr(problems);
    if (Object.keys(problems).length) { setStatus("idle"); jumpToFirstProblem(); return; }
    if (!confirmed) { setStatus("unconfirmed"); return; }
    if (!agreed) { setStatus("unconsented"); return; }
    setStatus("sending");
    try {
      const response = await fetch(REP_APPLICATIONS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, [HONEYPOT]: trap, [PRIVACY_CONSENT]: agreed }),
      });
      const data = await response.json().catch(() => ({}));
      // "You're in" is only ever said after the server said it was saved.
      if (response.ok && data?.ok) { moved.current = true; setStatus("sent"); return; }
      if (data?.error === "invalid" && data.errors) {
        setErr(data.errors); setStatus("idle"); jumpToFirstProblem(); return;
      }
      setStatus(data?.error === "not_connected" ? "closed" : data?.error === "rate_limited" ? "limited"
        : data?.error === "consent_required" ? "unconsented" : "failed");
    } catch {
      setStatus("failed");
    }
  }

  if (status === "sent") {
    return (
      <div className="exec-card exec-done" role="status" ref={rootRef}>
        <h1 ref={headingRef} tabIndex={-1}>You&rsquo;re in.</h1>
        <p>
          Thanks for applying to be a WEC First Year Rep. Applications close {REP_CLOSES}, and everyone
          who applies hears back by Wednesday, December 2.
        </p>
        <dl className="exec-done-rows">
          <div><dt>Applied as</dt><dd>{v.name}</dd></div>
          <div><dt>We&rsquo;ll reply to</dt><dd>{v.westernEmail}</dd></div>
        </dl>
        <Link className="exec-btn exec-btn-primary" href="/">Back to the site<Arrow /></Link>
      </div>
    );
  }

  const usable = open === true || PREVIEW;
  const errorCount = Object.keys(err).length;
  const pct = Math.round((step - 1) / (REVIEW - 1) * 100);
  const stage = step < REVIEW ? REP_STAGES[step - 1] : null;

  return (
    <div className="exec-card" ref={rootRef}>
      <div className="exec-hp" aria-hidden="true">
        <label>Leave this empty
          <input type="text" name={HONEYPOT} id={HONEYPOT} tabIndex={-1} autoComplete="off"
                 data-lpignore="true" data-1p-ignore="true" data-form-type="other"
                 value={trap} onChange={e => setTrap(e.target.value)} />
        </label>
      </div>

      {open === false && PREVIEW ? (
        <div className="exec-note" role="status">
          <p><strong>Local preview.</strong> Applications are not switched on, so Submit will not send anything. Fill it in to see how it works.</p>
        </div>
      ) : null}
      {open === false && !PREVIEW ? (
        <div className="exec-note is-bad" role="status">
          <p><strong>Applications are not open yet.</strong> The questions below are shown so you know what to expect. Check back soon.</p>
        </div>
      ) : null}
      {open === null ? (
        <div className="exec-note" role="status"><p>Checking whether applications are open...</p></div>
      ) : null}

      <ol className="exec-steps" aria-label="Application stages">
        {[...REP_STAGES.map(s => s.title), "Review"].map((t, i) => {
          const at = i + 1;
          return (
            <li key={t}>
              <button type="button" className={`exec-step${step === at ? " is-on" : step > at ? " is-past" : ""}`}
                      disabled={step <= at} onClick={() => { if (step > at) { setErr({}); go(at); } }}
                      aria-current={step === at ? "step" : undefined}>
                <span className="exec-step-t">{t}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="exec-progress" aria-hidden="true"><div style={{ width: `${pct}%` }} /></div>
      <p className="micro exec-stage-count">Stage {step} of {REVIEW}</p>

      <h1 ref={headingRef} tabIndex={-1}>{stage ? stage.heading : "Review your application."}</h1>
      <p className="exec-sub">{stage ? stage.sub : "Check everything below, then submit. You can still edit any section."}</p>

      <fieldset className="exec-fs" disabled={!usable}>
        {stage ? stageFields(stage.qs) : reviewStep()}

        <div className="exec-actions">
          {step < REVIEW ? (
            <button type="button" className="exec-btn exec-btn-primary" onClick={next}>
              {editing ? "Back to review" : step === REVIEW - 1 ? "Review application" : "Continue"}<Arrow />
            </button>
          ) : (
            <button type="button" className="exec-btn exec-btn-primary" onClick={submit} disabled={status === "sending"}>
              {status === "sending" ? "Sending..." : "Submit application"}<Arrow />
            </button>
          )}
          {step > 1 ? <button type="button" className="exec-btn exec-btn-ghost" onClick={back}>Back</button> : null}
          <span className="exec-actions-hint">
            {errorCount
              ? `${errorCount} ${errorCount === 1 ? "answer needs" : "answers need"} fixing`
              : "Nothing is sent until you submit"}
          </span>
        </div>
      </fieldset>

      {step === 1 ? (
        <div className="exec-note">
          <p>About 10 minutes. Applications close {REP_CLOSES}. Your answers are not saved as you go, so finish in one sitting and keep this tab open.</p>
        </div>
      ) : null}
    </div>
  );

  function stageFields(qs: RepQuestion[]) {
    // A stage of only short fields (About you) sits in the two-column grid. A
    // mixed stage keeps the agreed question order, one field under another.
    if (qs.every(q => q.kind !== "long")) {
      return <div className="exec-stage"><div className="exec-grid">{qs.map(q => shortField(q))}</div></div>;
    }
    return (
      <div className="exec-stage">
        {qs.map(q => q.kind === "long"
          ? <LongAnswer key={q.id} q={q} value={v[q.id]} onChange={set(q.id)} error={err[q.id]} />
          : shortField(q))}
      </div>
    );
  }

  function shortField(q: RepQuestion) {
    const invalid = !!err[q.id];
    const common = {
      id: q.id, name: q.id, value: v[q.id],
      "aria-invalid": invalid,
      "aria-describedby": invalid ? errorId(q.id) : undefined,
    };
    return (
      <Field key={q.id} q={q} error={err[q.id]}>
        {q.kind === "select" ? (
          <select {...common} onChange={e => set(q.id)(e.target.value)}>
            <option value="">Choose one</option>
            {(q.choices ?? []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input {...common} onChange={e => set(q.id)(e.target.value)} placeholder={q.placeholder ?? ""}
                 type={q.kind === "email" ? "email" : q.kind === "url" ? "url" : "text"}
                 inputMode={q.kind === "email" ? "email" : q.kind === "url" ? "url" : undefined}
                 autoComplete={q.id === "name" ? "name" : q.kind === "email" ? "email" : "off"} />
        )}
      </Field>
    );
  }

  function reviewStep() {
    return (
      <div className="exec-stage">
        {REP_STAGES.map((s, i) => (
          <div className="exec-review" key={s.key}>
            <div className="exec-review-h">
              <h2>{s.title}</h2>
              <button type="button" className="exec-edit" aria-label={`Edit ${s.title}`}
                      onClick={() => { setEditing(true); setErr({}); go(i + 1); }}>Edit</button>
            </div>
            <dl>
              {s.qs.map(q => (
                <div key={q.id}><dt>{q.label}</dt><dd>{v[q.id] || "Not answered"}</dd></div>
              ))}
            </dl>
          </div>
        ))}

        <label className="exec-confirm">
          <input type="checkbox" checked={confirmed}
                 onChange={e => { setConfirmed(e.target.checked); if (status === "unconfirmed") setStatus("idle"); }} />
          <span>I confirm that the information in this application is accurate.</span>
        </label>

        <label className="exec-confirm">
          <input type="checkbox" checked={agreed}
                 onChange={e => { setAgreed(e.target.checked); if (status === "unconsented") setStatus("idle"); }} />
          <span>
            I have read the <Link className="privacy-link" href={PRIVACY_PATH}>privacy policy</Link> and agree to WEC
            collecting and using this application as it describes. Only the two reviewers read it.
          </span>
        </label>

        {status === "unconsented" ? <p className="exec-err-top" role="alert">{CONSENT_ERROR}</p> : null}
        {status === "unconfirmed" ? (
          <p className="exec-err-top" role="alert">Please tick the box above to confirm your application is accurate.</p>
        ) : null}
        {status === "failed" ? (
          <div className="exec-note is-bad" role="alert"><p>
            <strong>That didn&rsquo;t go through.</strong> Nothing was submitted and every answer above is still here. Press Submit again in a moment.
          </p></div>
        ) : null}
        {status === "limited" ? (
          <div className="exec-note is-bad" role="alert"><p>
            <strong>Too many tries from this connection.</strong> Nothing was submitted. Wait ten minutes, then press Submit again.
          </p></div>
        ) : null}
        {status === "closed" ? (
          <div className="exec-note is-bad" role="alert"><p>
            <strong>{PREVIEW ? "Local preview: nothing was sent." : "Applications are not open yet."}</strong>{" "}
            {PREVIEW ? "Submissions are switched off here. This is the end of the walkthrough." : "Nothing was submitted. Your answers are still here, so keep this tab open."}
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
}
