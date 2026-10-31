const TZ = "America/Toronto";

export const formatDate = (v: string | null | undefined) =>
  v ? new Intl.DateTimeFormat("en-CA", { timeZone: v.length === 10 ? "UTC" : TZ, month: "short", day: "numeric", year: "numeric" }).format(new Date(v)) : "No date";

export const formatDateTime = (v: string | null | undefined) =>
  v ? new Intl.DateTimeFormat("en-CA", { timeZone: TZ, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(v)) : "No date";

// For tables: the year only when it is not this one.
export function formatDue(v: string) {
  const d = new Date(v);
  const sameYear = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric" }).format(d) === new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric" }).format(new Date());
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), hour: "numeric", minute: "2-digit" }).format(d);
}

// For <input type="datetime-local">: wall-clock Toronto time.
export function toLocalInput(v: string | null | undefined) {
  if (!v) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(v));
  const get = (t: string) => parts.find(p => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export const torontoDateKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export const daysUntil = (v: string) => (new Date(v).getTime() - new Date().getTime()) / 86_400_000;
export const hoursSince = (v: string) => (new Date().getTime() - new Date(v).getTime()) / 3_600_000;

const LABELS: Record<string, string> = {
  unassigned: "Unassigned", todo: "To do", in_progress: "In progress", blocked: "Blocked", submitted: "In review", revisions_requested: "Revisions", done: "Done", cancelled: "Cancelled",
  waiting: "Waiting", pending: "Awaiting response", clarification_requested: "Clarification asked", accepted: "Accepted", declined: "Declined",
  draft: "Draft", changes_requested: "Changes requested", rejected: "Rejected", approved: "Approved", completed: "Completed", archived: "Archived", planning: "Planning", active: "Active", on_hold: "On hold",
  not_required: "No approval needed", published: "Published", superseded: "Superseded", open: "Open", low: "Low", normal: "Normal", high: "High", urgent: "Urgent", running: "Running", succeeded: "Succeeded", failed: "Failed", dead: "Failed for good", skipped: "Skipped", invited: "Invited", deactivated: "Deactivated",
  EVENT: "Event project", GLOBAL: "Global project", INTERNAL: "Internal project",
};
export const label = (v: string | null | undefined) => (v ? LABELS[v] ?? v.replace(/_/g, " ") : "");

const NOTIFICATION_TEXT: Record<string, string> = {
  "task.assigned": "Assigned to you", "task.commented": "New comment", "task.completed": "Completed", "task.deadline_changed": "Deadline changed", "task.blocked": "Blocked by another task", "task.unblocked": "No longer blocked", "task.blocked_escalated": "Blocked for too long",
  "request.received": "New cross-team request", "request.accept": "Your request was accepted", "request.decline": "Your request was declined", "request.clarify": "Clarification asked on your request", "request.clarified": "Request clarified",
  "review.requested": "Ready for your review", "review.accepted": "Your deliverable was accepted", "review.revisions": "Revisions requested",
  "deadline.upcoming": "Due soon", "deadline.overdue": "Overdue", "deadline.proposed": "New date proposed", "deadline.decided": "Date proposal answered",
  "event.proposed": "Event proposal to review", "event.decided": "Decision on your event", "event.closed": "Event closed", "global.proposed": "Global Project to review", "global.decided": "Decision on your Global Project", "approval.pending": "Still waiting for your decision",
  "project.generated": "New project for your team", "project.deadline": "Project due soon",
  "sop.submitted": "SOP revision to review", "sop.returned": "SOP revision returned", "sop.published": "SOP revision published", "sop.review_due": "SOP due for review", "announcement.published": "New announcement",
};
export const notificationText = (kind: string) => NOTIFICATION_TEXT[kind] ?? kind;

export function entityHref(type: string, id: string | null) {
  if (!id) return null;
  switch (type) {
    case "task": return `/os/tasks/${id}`;
    case "project": return `/os/projects/${id}`;
    case "event": return `/os/events/${id}`;
    case "sop": return `/os/sops/${id}`;
    case "meeting": return `/os/meetings/${id}`;
    case "announcement": return "/os";
    default: return null;
  }
}
