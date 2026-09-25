"use client";

/**
 * The membership sign up form.
 *
 * It used to live in a dialog opened by the Join section's button. It does not
 * any more: every Join WEC call to action now routes to /apply, and the form
 * is rendered by /apply/member. This file is the form's body and nothing else.
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

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Arrow } from "@/components/graphics/DraftGraphics";
import { contactEmail, emailRule, googleForm, slackUrl } from "@/data/siteContent";
import { BLANK, YEARS, validateAnswers, type Answers, type Field } from "@/lib/googleForm";
import { CONSENT_ERROR, PRIVACY_CONSENT, PRIVACY_PATH } from "@/lib/privacy";

type Status = "idle" | "sending" | "joined" | "mail-opened" | "failed";

const FIELD_NAMES: Record<Field, string> = {
  name: "Name", email: "Email", year: "Year", building: "What you're building",
  signature: "Signature", evidence: "Made or shipped", favourite: "Favourite thing",
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
    "What is your favourite thing about entrepreneurship?",
    v.favourite || "Not answered",
  ];
  // ⛔ The address is NOT percent encoded. encodeURIComponent turns "@" into
  // "%40" and some mail clients then fail to parse the recipient at all.
  return `mailto:${EMAIL}`
    + `?subject=${encodeURIComponent(`WEC signup, ${v.name}`)}`
    + `&body=${encodeURIComponent(lines.join("\n"))}`;
}

/**
 * The questions, the validation and the three delivery routes, with NO dialog
 * around them. Two places render this: the Join WEC dialog below, and the
 * standalone /apply page the printed QR code lands on. The QR is the reason it
 * is split out — a scan must show the form itself, not a button that opens one.
 *
 * The heading tag is a prop because the same markup is an h2 inside the dialog
 * (which already has its own heading structure) and the h1 of the /apply page.
 */
/**
 * WHAT HAPPENS IN THE THIRTY SECONDS AFTER SOMEBODY JOINS.
 *
 * Before this, the screen said "You're in" and stopped. Somebody signed up at a
 * booth, got a full stop, and was never seen again. This is the flow Seb
 * approved on 22 September: land in the Slack, say hi, and know that dues start
 * in January.
 *
 * THE SLACK STEP DISAPPEARS WHEN NEXT_PUBLIC_WEC_SLACK_URL IS NOT SET.
 * The club's Slack link is a deploy setting, so this has to be safe to merge
 * before anybody has added it. No link means no step, never a dead button.
 *
 * THE INTRO IS BUILT FROM WHAT THEY ALREADY TYPED, never from a guess. If the
 * "what are you building" box was left short, the sentence just ends earlier.
 * Nothing is invented on their behalf and then posted under their name.
 */
function JoinedNextSteps({ answers }: { answers: Answers }) {
  const [copied, setCopied] = useState(false);
  const firstName = answers.name.trim().split(/\s+/)[0];
  const building = answers.building.trim();
  const year = answers.year.trim();

  const intro = [
    `Hi, I'm ${firstName || "new here"}${year ? `, ${year}` : ""}.`,
    building ? `Right now I'm working on ${building}` : "",
  ].filter(Boolean).join(" ");

  async function copy() {
    try {
      await navigator.clipboard.writeText(intro);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 4000);
    } catch {
      // The clipboard refused, which happens on an insecure origin and in some
      // locked down browsers. The text is on the screen and selectable, so
      // there is still a way through. Saying nothing beats a false "Copied".
      setCopied(false);
    }
  }

  return (
    <div className="join-next">
      <p className="join-next-title">Two things left</p>
      <ol className="join-next-steps">
        {slackUrl && (
          <li>
            <strong>Join the WEC Slack.</strong> It is where announcements and
            events go. Use your Western email and you are straight in.
            <p>
              <a className="join-primary join-next-btn" href={slackUrl} target="_blank" rel="noreferrer">
                Join the WEC Slack
              </a>
            </p>
          </li>
        )}
        <li>
          <strong>Say hi in #introductions.</strong> Here is one ready to paste.
          <p className="join-intro">{intro}</p>
          <p>
            <button type="button" className="join-next-copy" onClick={copy}>
              {copied ? "Copied" : "Copy this"}
            </button>
          </p>
        </li>
      </ol>
      <p className="join-signed">Your signature is recorded. Nothing else to do.</p>
    </div>
  );
}

export function JoinFormBody({ headingTag: Heading = "h2" }: { headingTag?: "h1" | "h2" }) {
  const EMAIL = contactEmail;
  const viaGoogle = googleForm.ok;
  const formRef = useRef<HTMLFormElement>(null);
  const [v, setV] = useState<Answers>(BLANK);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [status, setStatus] = useState<Status>("idle");
  // ⛔ Unticked on purpose. Nothing leaves the page, by any route, until it is
  // ticked, and /api/join refuses a submission without it. See src/lib/privacy.ts.
  const [agreed, setAgreed] = useState(false);
  const [consentError, setConsentError] = useState(false);

  // ⛔ Editing a field clears ITS error. Found by walking the form: after fixing
  // the email, the red message stayed on screen until Send was pressed again,
  // which reads as "my fix did not work" to someone at a booth.
  const set = (k: Field) => (
    e: { target: { value: string } },
  ) => {
    setV(prev => ({ ...prev, [k]: e.target.value }));
    setErrors(prev => (prev[k] ? { ...prev, [k]: undefined } : prev));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (status === "sending") return;
    // ⛔ EVERY FIELD REPORTS ITS OWN ERROR. A form that re-renders looking
    // unchanged, with the typing gone and nothing said, is worse than one that
    // crashes. That exact bug shipped on the other WEC site.
    const next = validateAnswers(v, emailRule);
    setErrors(next);
    setConsentError(!agreed);
    if (Object.keys(next).length || !agreed) {
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
        body: JSON.stringify({ ...v, website, [PRIVACY_CONSENT]: agreed }),
      });
      if (response.ok) { setStatus("joined"); return; }
      const data = await response.json().catch(() => ({}));
      if (data?.error === "invalid" && data.errors) { setErrors(data.errors); setStatus("idle"); return; }
      if (data?.error === "consent_required") { setConsentError(true); setStatus("idle"); return; }
      setStatus("failed");
    } catch {
      setStatus("failed");
    }
  }

  const firstName = v.name.trim().split(/\s+/)[0];
  const errorCount = Object.values(errors).filter(Boolean).length + (consentError ? 1 : 0);

  return (
    <>
          {status === "joined" ? (
            <div role="status">
              <Heading id="join-form-title">You&rsquo;re in.</Heading>
              <p className="join-done">
                Welcome to WEC{firstName ? `, ${firstName}` : ""}. We&rsquo;ll be in touch
                at <strong>{v.email.trim()}</strong>.
              </p>
              <p className="join-dues">
                Membership is free this term. Dues open in January, once WEC is
                ratified through the USC.
              </p>
              <JoinedNextSteps answers={v} />
            </div>
          ) : status === "mail-opened" ? (
            <div role="status">
              <Heading id="join-form-title">Almost done.</Heading>
              <p className="join-done">
                Your email app opened with your answers filled in. Press send
                there to finish. If it didn&rsquo;t open,{" "}
                <a className="text-link" href={mailtoFor(v, EMAIL ?? "")}>try again</a>{" "}
                or email <strong>{EMAIL}</strong>.
              </p>
            </div>
          ) : (
            <>
              <Heading id="join-form-title">Join WEC</Heading>
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
                  <span>Favourite thing about entrepreneurship? <em>Optional</em></span>
                  <textarea value={v.favourite} onChange={set("favourite")} rows={2} />
                </label>

                {/* Hidden from people and screen readers. Only bots fill it in. */}
                <input className="join-hp" name="website" value={website}
                       onChange={e => setWebsite(e.target.value)}
                       tabIndex={-1} autoComplete="off" aria-hidden="true" />

                <label className="consent">
                  <input type="checkbox" checked={agreed} aria-invalid={consentError}
                         onChange={e => { setAgreed(e.target.checked); if (e.target.checked) setConsentError(false); }} />
                  <span>
                    I have read the <Link className="privacy-link" href={PRIVACY_PATH}>privacy policy</Link> and
                    agree to WEC collecting and using my answers as it describes.
                  </span>
                </label>
                {consentError && <em className="field-error">{CONSENT_ERROR}</em>}

                {errorCount > 0 && (
                  <p className="field-error join-failed" role="alert">
                    {errorCount === 1 ? "1 box needs fixing" : `${errorCount} boxes need fixing`}:{" "}
                    {[...(Object.keys(errors) as Field[]).filter(k => errors[k]).map(k => FIELD_NAMES[k]),
                      ...(consentError ? ["Privacy agreement"] : [])].join(", ")}.
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
                    ? "We only use this to add you to the member list and contact you about WEC. Only our exec team sees it."
                    : "Opens your email app to send."}
                </p>
              </form>
            </>
          )}
    </>
  );
}
