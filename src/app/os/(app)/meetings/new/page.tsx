import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Page, Panel } from "@/components/os/ui";
import { can, getDepartments, getDirectory, requireMe } from "@/lib/os/dal";
import { createClient } from "@/lib/os/supabase";
import { MeetingForm } from "../MeetingForm";

export const metadata: Metadata = { title: "Record a meeting" };

export default async function NewMeetingPage({ searchParams }: { searchParams: Promise<{ department?: string }> }) {
  const me = await requireMe();
  if (!can(me, "meeting.create")) notFound();
  const { department } = await searchParams;
  const supabase = await createClient();
  const [departments, people, { data: projects }] = await Promise.all([
    getDepartments(), getDirectory(),
    supabase.from("projects").select("id, name").is("archived_at", null).order("name").limit(200),
  ]);
  const choices = me.is_president ? departments : departments.filter(d => me.positions.some(p => p.department_id === d.id));
  return <Page title="Record a meeting"><Panel><MeetingForm choices={choices} departments={departments} people={people} projects={projects ?? []} department={department} attendees={[me.id]} /></Panel></Page>;
}
