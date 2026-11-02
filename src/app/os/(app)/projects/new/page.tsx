import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectForm } from "@/components/os/ProjectForm";
import { can, displayName, getDepartments, getDirectory, requireMe } from "@/lib/os/dal";
import { createClient } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ event?: string; teams?: string; then?: string }> }) {
  const me = await requireMe();
  if (!can(me, "project.create_internal") || me.positions.length === 0) notFound();
  const { event, teams, then } = await searchParams;
  const supabase = await createClient();
  const [departments, directory, { data: templates }, { data: events }] = await Promise.all([
    getDepartments(),
    getDirectory(),
    supabase.from("templates").select("id, name, kind, department_id").is("archived_at", null).in("kind", ["internal", "global", "event_project"]).order("name"),
    supabase.from("events").select("id, name").in("status", ["approved", "in_progress"]).order("starts_at"),
  ]);
  const mine = new Set(me.positions.map(p => p.department_id));
  return (
    <ProjectForm
      myTeams={departments.filter(d => mine.has(d.id)).map(d => ({ id: d.id, name: d.name }))}
      otherTeams={departments.filter(d => !mine.has(d.id)).map(d => ({ id: d.id, name: d.name }))}
      events={(events ?? []).map(e => ({ id: e.id, name: e.name }))}
      templates={(templates ?? []).map(t => ({ id: t.id, name: t.name, kind: t.kind, department_id: t.department_id }))}
      people={directory.filter(p => p.status === "active").map(p => ({ id: p.id, name: displayName(p) }))}
      startEvent={event}
      startMulti={teams === "multi" || Boolean(event)}
      thenTask={then === "task"}
    />
  );
}
