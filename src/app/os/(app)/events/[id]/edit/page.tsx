import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Page } from "@/components/os/ui";
import { getDepartments, getDirectory, requireMe } from "@/lib/os/dal";
import { createClient } from "@/lib/os/supabase";
import { EventForm } from "../../EventForm";

export const metadata: Metadata = { title: "Edit proposal" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMe();
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!event || !["draft", "changes_requested"].includes(event.status)) notFound();
  const [leads, chosen, guests] = await Promise.all([
    supabase.from("event_leads").select("executive_id").eq("event_id", id),
    supabase.from("event_departments").select("department_id").eq("event_id", id),
    supabase.from("event_guests").select("name, role").eq("event_id", id),
  ]);
  return (
    <Page title={`Edit: ${event.name}`}>
      <EventForm event={event} departments={await getDepartments()} people={await getDirectory()}
        leads={(leads.data ?? []).map(l => l.executive_id)} chosen={(chosen.data ?? []).map(c => c.department_id)}
        guests={(guests.data ?? []).map(g => g.role ? `${g.name} - ${g.role}` : g.name).join("\n")} />
    </Page>
  );
}
