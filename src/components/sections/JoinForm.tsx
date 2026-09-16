"use client";

/**
 * The sign up form, in the dialog that used to say membership is unavailable.
 *
 * WHY THIS EXISTS
 *
 * On 17 September there is a booth from 3pm to 6pm and a QR code is the only
 * thing between a conversation and a member. A page that says "membership
 * details aren't available on the website yet" converts nobody.
 *
 * HOW IT DELIVERS, IN ORDER OF PREFERENCE
 *
 * 1. NEXT_PUBLIC_WEC_JOIN_URL set: this component never renders, the link wins
 *    (Seb's DestinationAction, unchanged).
 * 2. NEXT_PUBLIC_WEC_GOOGLE_FORM_URL set: answers go through /api/join into the
 *    club's Google Form and its Sheet. "You're in" shows only after Google
 *    accepted them. This is the intended setup.
 * 3. Only NEXT_PUBLIC_WEC_CONTACT_EMAIL set: the fallback. It opens the
 *    student's mail app with the answers written out.
 *
 * WHY THESE FIELDS
 *
 * The USC's 50-member list needs a name, a signature, a Western email and a
 * year of study, and it accepts a typed signature. Everything else is optional
 * or one sentence, because every extra question at a booth loses people.
 */

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Arrow, Logo } from "@/components/graphics/DraftGraphics";
import { contactEmail, emailRule, googleForm } from "@/data/siteContent";
import { BLANK, YEARS, validateAnswers, type Answers, type Field } from "@/lib/googleForm";

type Status = "idle" | "sending" | "joined" | "mail-opened" | "failed";

const FIELD_NAMES: Record<Field, string> = {
  name: "Name", email: "Email", year: "Year", building: "What you're building",
  signature: "Signature", evidence: "Made or shipped", hardest: "Hardest part",
};

function mailtoFor(v: Answers, EMAIL: string) {
  const lines = [
    `Name: ${v.name}`,
    `Email: ${v.email}`,
    `Year: ${v.year}`,
    `Signature (typed): ${v.signature}`,
    "",
    "What are you building, or what are you curious about?",
    v.building,
    "",
    "What have you made or shipped, if anything?",
    v.evidence || "Not answered",
    "",
    "What is the hardest part right now?",
    v.hardest || "Not answered",
  ];
  // ⛔ The address is NOT percent encoded. encodeURIComponent turns "@" into
  // "%40" and some mail clients then fail to parse the recipient at all.
  return `mailto:${EMAIL}`
    + `?subject=${encodeURIComponent(`WEC signup, ${v.name}`)}`
    + `&body=${encodeURIComponent(lines.join("\n"))}`;
}

export function JoinForm({ label, className }: { label: string; className: string }) {
  const EMAIL = contactEmail;
  const viaGoogle = googleForm.ok;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [v, setV] = useState<Answers>(BLANK);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [status, setStatus] = useState<Status>("idle");

  // ⛔ Editing a field clears ITS error. Found by walking the form: after fixing
  // the email, the red message stayed on screen until Send was pressed again,
  // which reads as "my fix did not work" to someone at a booth.
  const set = (k: Field) => (
    e: { target: { value: string } },
  ) => {
    setV(prev => ({ ...prev, [k]: e.target.value }));
    setErrors(prev => (prev[k] ? { ...prev, [k]: undefined } : prev));
  };

  function close() {
    dialogRef.current?.close();
    buttonRef.current?.focus();
  }

  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(
      "button:not([disabled]), a[href], input:not([tabindex='-1']), select, textarea")];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last?.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (status === "sending") return;
    // ⛔ EVERY FIELD REPORTS ITS OWN ERROR. A form that re-renders looking
    // unchanged, with the typing gone and nothing said, is worse than one that
    // crashes. That exact bug shipped on the other WEC site.
    const next = validateAnswers(v, emailRule);
    setErrors(next);
    if (Object.keys(next).length) {
      // ⛔ With the email box scrolled out of sight, pressing Join showed its
      // error off screen and looked like "nothing happens". So jump to the
      // first wrong box and put the cursor in it.
      requestAnimationFrame(() => {
        const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        first?.scrollIntoView({ block: "center", behavior: "smooth" });
        first?.focus({ preventScroll: true });
      });
      return;
    }

    if (!viaGoogle) {
      if (!EMAIL) return;
      window.location.href = mailtoFor(v, EMAIL);
      setStatus("mail-opened");
      return;
    }

    setStatus("sending");
    try {
      const response = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, website }),
      });
      if (response.ok) { setStatus("joined"); return; }
      const data = await response.json().catch(() => ({}));
      if (data?.error === "invalid" && data.errors) { setErrors(data.errors); setStatus("idle"); return; }
      setStatus("failed");
    } catch {
      setStatus("failed");
    }
  }

  const firstName = v.name.trim().split(/\s+/)[0];
  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <>
      <button
        className={className}
        ref={buttonRef}
        onClick={() => dialogRef.current?.showModal()}
        aria-haspopup="dialog"
      >
        {label}<Arrow diagonal />
      </button>

      <dialog
        ref={dialogRef}
        className="join-dialog join-form-dialog"
        aria-labelledby="join-form-title"
        // ⛔ Without this the form cannot scroll at all. story.ts stops Lenis
        // while any dialog is open, and a stopped Lenis cancels every wheel and
        // touch on the page unless the element opts out with this attribute.
        // Measured: form 1067px tall in a 553px window, wheel moved it 0px.
        data-lenis-prevent
        onKeyDown={trapFocus}
        onClick={event => { if (event.target === event.currentTarget) close(); }}
        onClose={() => buttonRef.current?.focus()}
      >
        <div className="dialog-inner">
          <button className="dialog-close" onClick={close} aria-label="Close dialog" autoFocus>
            <span aria-hidden="true">×</span>
          </button>
          <Logo />
          <p className="micro">Western Entrepreneurship Collective</p>

          {status === "joined" ? (
            <div role="status">
              <h2 id="join-form-title">You&rsquo;re in.</h2>
              <p className="join-done">
                Welcome to WEC{firstName ? `, ${firstName}` : ""}. We&rsquo;ll be in touch
                at <strong>{v.email.trim()}</strong>.
              </p>
            </div>
          ) : status === "mail-opened" ? (
            <div role="status">
              <h2 id="join-form-title">Almost done.</h2>
              <p className="join-done">
                Your email app opened with your answers filled in. Press send
                there to finish. If it didn&rsquo;t open,{" "}
                <a className="text-link" href={mailtoFor(v, EMAIL ?? "")}>try again</a>{" "}
                or email <strong>{EMAIL}</strong>.
              </p>
            </div>
          ) : (
            <>
              <h2 id="join-form-title">Join WEC</h2>
              <p>Free to join. Takes about a minute.</p>
              <form className="join-form" ref={formRef} onSubmit={submit} noValidate>
                <label>
                  <span>Name</span>
                  <input value={v.name} onChange={set("name")} autoComplete="name" aria-invalid={!!errors.name} />
                  {errors.name && <em className="field-error">{errors.name}</em>}
                </label>

                <label>
                  <span>{emailRule === "western" ? "Western email" : "Email"}</span>
                  <input value={v.email} onChange={set("email")} type="email" inputMode="email"
                         autoComplete="email" placeholder={emailRule === "western" ? "you@uwo.ca" : "you@example.com"}
                         aria-invalid={!!errors.email} />
                  {errors.email && <em className="field-error">{errors.email}</em>}
                </label>

                <label>
                  <span>Year</span>
                  <select value={v.year} onChange={set("year")} aria-invalid={!!errors.year}>
                    <option value="" disabled>Pick your year</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  {errors.year && <em className="field-error">{errors.year}</em>}
                </label>

                <label>
                  <span>What are you building, or curious about?</span>
                  <textarea value={v.building} onChange={set("building")} rows={2} aria-invalid={!!errors.building} />
                  {errors.building && <em className="field-error">{errors.building}</em>}
                </label>

                <label>
                  <span>Signature: type your full name</span>
                  <input value={v.signature} onChange={set("signature")} autoComplete="off" aria-invalid={!!errors.signature} />
                  {errors.signature && <em className="field-error">{errors.signature}</em>}
                </label>

                <label>
                  <span>Made or shipped anything? <em>Optional</em></span>
                  <textarea value={v.evidence} onChange={set("evidence")} rows={2} />
                </label>

                <label>
                  <span>Hardest part right now? <em>Optional</em></span>
                  <textarea value={v.hardest} onChange={set("hardest")} rows={2} />
                </label>

                {/* Hidden from people and screen readers. Only bots fill it in. */}
                <input className="join-hp" name="website" value={website}
                       onChange={e => setWebsite(e.target.value)}
                       tabIndex={-1} autoComplete="off" aria-hidden="true" />

                {errorCount > 0 && (
                  <p className="field-error join-failed" role="alert">
                    {errorCount === 1 ? "1 box needs fixing" : `${errorCount} boxes need fixing`}:{" "}
                    {(Object.keys(errors) as Field[]).filter(k => errors[k]).map(k => FIELD_NAMES[k]).join(", ")}.
                  </p>
                )}

                {status === "failed" && (
                  <p className="field-error join-failed" role="alert">
                    That didn&rsquo;t go through. Your answers are still here, so
                    please try again{EMAIL ? <> or email <strong>{EMAIL}</strong></> : null}.
                  </p>
                )}

                <button className="join-primary" type="submit" disabled={status === "sending"}>
                  {status === "sending" ? "Sending…" : "Join WEC"}<Arrow diagonal />
                </button>
                <p className="micro">
                  {viaGoogle
                    ? "We only use this to add you to the member list and contact you about WEC."
                    : "Opens your email app to send."}
                </p>
              </form>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
