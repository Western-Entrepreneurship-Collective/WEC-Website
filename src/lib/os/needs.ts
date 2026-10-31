import "server-only";
import { cache } from "react";
import { getDirectory, nameLookup } from "./dal";
import { dueText, dueTone } from "./format";
import { createClient, rpc } from "./supabase";
import type { Me, ProjectSummary } from "./types";

export type NeedItem = { key: string; title: string; why: string; due?: string; tone?: string; cta: string; href: string };

const SOON_MS = 2 * 86_400_000;

/**
 * The one list of what is waiting on this person. Reads everything as them, so it can
 * only ever contain what they may see. Waiting tasks stay out: they are not on anyone yet.
 */
export const getNeeds = cache(async (me: Me) => {
  const supabase = await createClient();
  const nameOf = nameLookup(await getDirectory());
  const now = new Date().getTime();
  const headOf = new Set(me.positions.filter(p => p.is_head).map(p => p.department_id));

  const [mine, reviews, requests] = await Promise.all([
    supabase.from("tasks").select("*").eq("assigned_to", me.id).not("status", "in", "(done,cancelled)").order("due_at", { nullsFirst: false }).limit(100),
    supabase.from("tasks").select("*").eq("status", "submitted").neq("assigned_to", me.id).order("submitted_at").limit(50),
    supabase.from("tasks").select("*").in("request_state", ["pending", "clarification_requested"]).order("created_at").limit(50),
  ]);
  const items: NeedItem[] = [];

  if (me.is_president) {
    const [{ data: events }, globals] = await Promise.all([
      supabase.from("events").select("id, name").eq("status", "submitted").order("submitted_at"),
      rpc<ProjectSummary[]>("project_summaries", { p_kind: "GLOBAL" }),
    ]);
    for (const e of events ?? []) items.push({ key: `e${e.id}`, title: e.name, why: "Event proposal waiting for your decision", cta: "Decide", href: `/os/events/${e.id}` });
    for (const p of globals.filter(g => g.approval_status === "pending")) items.push({ key: `p${p.id}`, title: p.name, why: "Global Project waiting for your decision", cta: "Decide", href: `/os/projects/${p.id}` });
  }

  for (const t of requests.data ?? []) {
    if (t.request_state === "pending" && (headOf.has(t.responsible_department_id) || me.is_president)) {
      items.push({ key: `r${t.id}`, title: t.title, why: "A team is asking yours for this", due: dueText(t.due_at), tone: dueTone(t.due_at), cta: "Answer", href: `/os/tasks/${t.id}` });
    } else if (t.request_state === "clarification_requested" && t.created_by === me.id) {
      items.push({ key: `c${t.id}`, title: t.title, why: "The other team has a question", cta: "Answer", href: `/os/tasks/${t.id}` });
    }
  }
  for (const t of reviews.data ?? []) {
    const reviewer = t.is_cross_team
      ? t.created_by === me.id || headOf.has(t.requesting_department_id)
      : t.assigned_by === me.id || headOf.has(t.responsible_department_id);
    if (reviewer) items.push({ key: `v${t.id}`, title: t.title, why: `${nameOf(t.assigned_to)} handed this in`, cta: "Review", href: `/os/tasks/${t.id}` });
  }

  const open = (mine.data ?? []).filter(t => t.status !== "submitted" && !(t.status === "blocked" && t.blocked_auto));
  const pressing = open.filter(t => t.status === "revisions_requested" || (t.due_at && new Date(t.due_at).getTime() - now < SOON_MS));
  const later = open.filter(t => !pressing.includes(t));
  for (const t of pressing) {
    items.push({
      key: `t${t.id}`, title: t.title,
      why: t.status === "revisions_requested" ? "Changes were requested" : t.assigned_by && t.assigned_by !== me.id ? `${nameOf(t.assigned_by)} gave you this` : "On your list",
      due: dueText(t.due_at), tone: dueTone(t.due_at), cta: t.status === "todo" ? "Start" : "Open", href: `/os/tasks/${t.id}`,
    });
  }
  return { items, later };
});
