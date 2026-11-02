import type { Database } from "./database.types";

type Tables = Database["os"]["Tables"];
export type Event = Tables["events"]["Row"];
export type Project = Tables["projects"]["Row"];
export type Task = Tables["tasks"]["Row"];
export type Department = Tables["departments"]["Row"];
export type Position = Tables["positions"]["Row"];
export type Executive = Tables["executives"]["Row"];
export type Sop = Tables["sops"]["Row"];
export type SopVersion = Tables["sop_versions"]["Row"];
export type Meeting = Tables["meetings"]["Row"];
export type Template = Tables["templates"]["Row"];
export type Rule = Tables["automation_rules"]["Row"];

export type Me = {
  id: string;
  email: string;
  full_name: string;
  preferred_name: string | null;
  status: "invited" | "active" | "deactivated";
  must_change_password: boolean;
  onboarding: Record<string, string>;
  is_admin: boolean;
  is_president: boolean;
  positions: {
    title: string;
    org_role: string;
    position_id: string;
    is_acting: boolean;
    department_id: string;
    department_name: string;
    department_slug: string;
    is_head: boolean;
  }[];
  permissions: string[];
};

export type ProjectSummary = {
  id: string; kind: string; name: string; status: string; approval_status: string; starts_on: string | null; due_on: string | null;
  progress: number; department_name: string | null; event_id: string | null; event_name: string | null; archived_at: string | null;
  can_open: boolean; lead_name: string | null; next_due: string | null; overdue_tasks: number;
};

export type CalendarItem = {
  item_type: "event" | "project" | "milestone" | "task"; item_id: string; title: string; starts_at: string; ends_at: string | null;
  status: string; priority: string | null; department_name: string | null; can_open: boolean; is_cross_team: boolean;
};

export type NotificationRow = {
  id: string; kind: string; entity_type: string; entity_id: string | null; title: string; read_at: string | null; created_at: string;
};

export type ActionResult = { ok: boolean; error?: string; message?: string } | null;
