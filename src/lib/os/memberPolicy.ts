/**
 * The member data rules everyone agrees to before the member list opens.
 * Change the wording and raise the version together, and raise
 * private.member_policy_version() in a migration to match: everyone is asked again.
 * Keep it true to the privacy policy (src/app/privacy/page.tsx).
 */
export const MEMBER_POLICY_VERSION = 1;

export const MEMBER_POLICY_RULES = [
  "Members gave us their name, email and year to hear from WEC. That is the only thing it is for: contacting members about WEC events and club business.",
  "Never share it outside the WEC executive team. Not with sponsors, other clubs, friends or anyone else, and never sell it.",
  "Always put members in BCC, never To or CC, so nobody sees anyone else's address.",
  "Don't add members to any other list: no personal mailing lists, group chats or other clubs' lists.",
  "Don't keep copies. If you download a CSV or paste a list, delete it as soon as you're done, and delete everything when you leave your position.",
  "If something goes wrong, like an email sent to the wrong people or a list shared by mistake, tell the VP Operations right away.",
  "Opening this list and every copy or download is recorded with your name.",
];
