/**
 * Every application address on the site, in one small file.
 *
 * It is deliberately separate from src/lib/execApplications.ts. That module
 * carries all twelve roles and their questions, and the navigation, the
 * Collective section and the Join section need nothing from it but a path —
 * importing it there would ship the whole schema to every visitor of the home
 * page. Nothing here imports anything, so it costs a few bytes wherever it
 * lands.
 *
 * ⛔ In the App Router a folder's name IS the URL, so each constant must match
 * its folder:
 *   APPLY_PATH             → src/app/apply/             (the chooser)
 *   MEMBER_APPLY_PATH      → src/app/apply/member/      (the member sign up)
 *   EXEC_APPLICATIONS_PATH → src/app/apply/executives/  (the exec application)
 *   EXEC_APPLICATIONS_API  → src/app/api/exec-applications/
 *
 * ⛔ MEMBER_APPLY_PATH and /api/join belong to the member sign up. The exec
 * flow never reads, posts to or changes either of them.
 *
 * Every "Join WEC" call to action points at MEMBER_APPLY_PATH, not at
 * APPLY_PATH: someone tapping Join has already chosen, and a chooser in front
 * of them would be one more tap at a booth on bad wifi. APPLY_PATH is for
 * people who arrive without having chosen.
 */
export const APPLY_PATH = "/apply";
export const MEMBER_APPLY_PATH = "/apply/member";
export const EXEC_APPLICATIONS_PATH = "/apply/executives";
export const EXEC_APPLICATIONS_API = "/api/exec-applications";
