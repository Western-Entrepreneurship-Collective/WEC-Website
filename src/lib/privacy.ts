/**
 * The privacy policy's address and the consent rule both forms share.
 *
 * NOTHING IS COLLECTED UNTIL THEY AGREE
 *
 * Both forms show an unticked "I agree" box linking to /privacy, and neither
 * sends a thing until it is ticked. The browser check is for the person; the
 * server check is the real one: /api/join and /api/exec-applications refuse
 * any submission whose PRIVACY_CONSENT field is not exactly true, before a
 * single answer is read or forwarded to Google.
 *
 * The consent itself is never sent to Google. It is a gate, not an answer, and
 * the Forms have no question for it.
 */

export const PRIVACY_PATH = "/privacy";

/** The JSON field both forms send. Only the boolean true counts. */
export const PRIVACY_CONSENT = "privacyAgreed";

/** The address the policy names for questions and requests. */
export const PRIVACY_EMAIL = "western.entrepreneurship.collective@outlook.com";

export const CONSENT_ERROR = "Please tick the box to agree to the privacy policy. Nothing is sent until you do.";

/** True only when an untrusted request body carries the consent flag as the boolean true. */
export function hasConsent(body: unknown): boolean {
  return !!body && typeof body === "object" && (body as Record<string, unknown>)[PRIVACY_CONSENT] === true;
}
