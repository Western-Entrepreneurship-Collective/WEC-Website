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

const dayDiff = (v: string) => {
  const key = (d: Date) => Date.parse(`${torontoDateKey(d)}T00:00:00Z`);
  return Math.round((key(new Date(v)) - key(new Date())) / 86_400_000);
};

// "In 3 days", "2 days overdue": how a deadline actually gets read.
export function dueText(v: string | null | undefined) {
  if (!v) return "No date";
  const days = dayDiff(v);
  if (new Date(v) < new Date()) return days >= 0 ? "Due earlier today" : `${-days} day${days === -1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 7) return `Due in ${days} days`;
  return `Due ${new Intl.DateTimeFormat("en-CA", { timeZone: TZ, month: "short", day: "numeric" }).format(new Date(v))}`;
}

export function dueTone(v: string | null | undefined) {
  if (!v) return "plain";
  if (new Date(v) < new Date() || dayDiff(v) === 0) return "bad";
  return dayDiff(v) <= 3 ? "warn" : "plain";
}

// For <input type="datetime-local">: wall-clock Toronto time.
export function toLocalInput(v: string | null | undefined) {
  if (!v) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(v));
  const get = (t: string) => parts.find(p => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export const torontoDateKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

// Short enough for a task row: "Thu, Nov 5", or "Oct 30" once it has passed.
export function shortDue(v: string | null | undefined) {
  if (!v) return "No date";
  const past = new Date(v) < new Date();
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, month: "short", day: "numeric", ...(past ? {} : { weekday: "short" }) }).format(new Date(v));
}

export const daysUntil = (v: string) => (new Date(v).getTime() - new Date().getTime()) / 86_400_000;
export const hoursSince = (v: string) => (new Date().getTime() - new Date(v).getTime()) / 3_600_000;

// Whether this person can create and edit a team's SOPs. The database decides; this keeps
// the screen from offering what would be refused.
export const editsSops = (me: { is_president: boolean; positions: { org_role: string; department_id: string }[] }, departmentId?: string) =>
  me.is_president || me.positions.some(p => p.org_role === "vp" && (!departmentId || p.department_id === departmentId));

export const decisionLabel = (v: string) => (v === "submitted" ? "Sent for approval" : label(v));

export const projectKindHelp: Record<string, string> = {
  EVENT: "One team's part of an event",
  GLOBAL: "Shared between teams. Every executive sees its progress",
  INTERNAL: "Only this team and the President",
};

const LABELS: Record<string, string> = {
  unassigned: "Unassigned", todo: "To do", in_progress: "Doing", blocked: "Stuck", submitted: "In review", revisions_requested: "Revisions", done: "Done", cancelled: "Cancelled",
  waiting: "Waiting", pending: "Awaiting response", clarification_requested: "Clarification asked", accepted: "Accepted", declined: "Declined",
  draft: "Draft", changes_requested: "Changes requested", rejected: "Rejected", approved: "Approved", completed: "Completed", archived: "Archived", planning: "Planning", active: "Active", on_hold: "On hold",
  not_required: "No approval needed", behind: "Behind", on_track: "On track", not_started: "Not started", needs_lead: "Needs a lead", published: "Published", superseded: "Superseded", open: "Open", low: "Low", normal: "Normal", high: "High", urgent: "Urgent", running: "Running", succeeded: "Succeeded", failed: "Failed", dead: "Failed for good", skipped: "Skipped", invited: "Invited", deactivated: "Deactivated",
  EVENT: "Event project", GLOBAL: "Shared project", INTERNAL: "Team project",
};
export const label = (v: string | null | undefined) => (v ? LABELS[v] ?? v.replace(/_/g, " ") : "");

const NOTIFICATION_TEXT: Record<string, string> = {
  "task.assigned": "Assigned to you", "task.commented": "New comment", "task.completed": "Completed", "task.deadline_changed": "Deadline changed", "task.blocked": "Blocked by another task", "task.unblocked": "No longer blocked", "task.blocked_escalated": "Blocked for too long",
  "request.received": "Another team sent you a task", "request.accept": "Your request was accepted", "request.decline": "Your request was declined", "request.clarify": "Clarification asked on your request", "request.clarified": "Request clarified",
  "review.requested": "Ready for your review", "review.accepted": "Your deliverable was accepted", "review.revisions": "Revisions requested",
  "deadline.upcoming": "Due soon", "deadline.overdue": "Overdue", "deadline.proposed": "New date proposed", "deadline.decided": "Date proposal answered",
  "event.proposed": "Event proposal to review", "event.decided": "Decision on your event", "event.closed": "Event closed", "global.proposed": "Global Project to review", "global.decided": "Decision on your Global Project", "approval.pending": "Still waiting for your decision",
  "project.generated": "New project for your team", "project.deadline": "Project due soon",
  "sop.submitted": "SOP to approve", "sop.returned": "SOP revision returned", "sop.published": "SOP revision published", "sop.review_due": "SOP due for review", "announcement.published": "New announcement",
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
