import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { ProjectTable } from "@/components/os/ProjectTable";
import { Field, Hidden, Page, Panel, Pill, Progress } from "@/components/os/ui";
import { archiveEvent, decideEvent, rescheduleEvent, setEventStatus, submitEvent } from "@/lib/os/actions/work";
import { can, getDirectory, nameLookup, requireMe } from "@/lib/os/dal";
import { daysUntil, formatDateTime, label, toLocalInput } from "@/lib/os/format";
import { createClient, rpc } from "@/lib/os/supabase";
import type { ProjectSummary } from "@/lib/os/types";

export const metadata: Metadata = { title: "Event" };

const NEEDS: [string, string][] = [
  ["requires_speakers", "External guests"], ["requires_registration", "Registration"], ["requires_member_participation", "Member participation"], ["requires_sponsorship", "Sponsorship"],
  ["requires_finance", "Financial management"], ["requires_communications", "Formal communications"], ["requires_founder_support", "Founder programming"], ["requires_media", "Media capture"], ["requires_logistics", "Logistics"],
];
const WEEKS: Record<string, number> = { A: 4, B: 3, C: 2 };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!event) notFound();
  const nameOf = nameLookup(await getDirectory());
  const [leads, departments, guests, approvals, projects, readiness] = await Promise.all([
    supabase.from("event_leads").select("executive_id").eq("event_id", id),
    supabase.from("event_departments").select("departments(name)").eq("event_id", id),
    supabase.from("event_guests").select("*").eq("event_id", id),
    supabase.from("approvals").select("*").eq("entity_type", "event").eq("entity_id", id).order("created_at"),
    rpc<ProjectSummary[]>("project_summaries", { p_event: id, p_include_archived: true }),
    rpc<number>("event_readiness", { p_event: id }),
  ]);
  const editable = ["draft", "changes_requested"].includes(event.status) && can(me, "event.submit");
  const live = ["approved", "in_progress"].includes(event.status);
  const leadTimeShort = daysUntil(event.starts_at) < WEEKS[event.tier] * 7;
  const needs = NEEDS.filter(([k]) => (event as unknown as Record<string, unknown>)[k]).map(([, l]) => l);

  return (
    <Page eyebrow={`Tier ${event.tier}${event.program ? ` · ${event.program}` : ""}`} title={event.name} actions={<><Pill value={event.status} />{editable ? <Link className="os-btn os-btn-ghost" href={`/os/events/${id}/edit`}>Edit</Link> : null}</>}>
      {editable && leadTimeShort ? <p className="os-note">Tier {event.tier} events plan over {WEEKS[event.tier]} weeks and this date is closer than that. Tasks whose dates have passed will be due the day the event is approved.</p> : null}
      {editable ? (
        <ActionForm action={submitEvent} className="os-row"><Hidden name="id" value={id} /><SubmitButton>Send to the President</SubmitButton></ActionForm>
      ) : null}
      {event.status === "submitted" && can(me, "event.approve") ? (
        <Panel title="Your decision">
          <p className="os-muted">Approval puts this on the Core Calendar and generates its projects and tasks.</p>
          <ActionForm action={decideEvent} className="os-stack">
            <Hidden name="id" value={id} />
            <Field label="Note" hint="Required if you are asking for changes."><textarea name="note" rows={2} /></Field>
            <div className="os-row os-wrap">
              <SubmitButton name="decision" value="approved">Approve</SubmitButton>
              <SubmitButton name="decision" value="changes_requested" variant="ghost">Request changes</SubmitButton>
              <SubmitButton name="decision" value="rejected" variant="danger">Reject</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      ) : null}

      {live || event.status === "completed" ? (
        <Panel title="Readiness"><div className="os-list-side os-wide"><Progress value={readiness} /><strong>{readiness}%</strong></div></Panel>
      ) : null}

      <div className="os-split">
        <div className="os-stack-lg">
          <Panel title="Projects" action={live && can(me, "project.create_event") ? <Link className="os-link" href={`/os/projects/new?kind=EVENT&event=${id}`}>Add a project</Link> : null}>
            <ProjectTable projects={projects} empty={event.status === "approved" ? "No projects for this event." : "Projects are generated when this event is approved."} />
          </Panel>
          <Panel title="About">
            {event.description ? <p className="os-pre">{event.description}</p> : null}
            {event.objectives ? <><h3>Objectives</h3><p className="os-pre">{event.objectives}</p></> : null}
            {event.marketing_notes ? <><h3>Marketing</h3><p className="os-pre">{event.marketing_notes}</p></> : null}
            {event.registration_notes ? <><h3>Registration</h3><p className="os-pre">{event.registration_notes}</p></> : null}
            {event.sponsorship_notes ? <><h3>Sponsorship</h3><p className="os-pre">{event.sponsorship_notes}</p></> : null}
            {!event.description && !event.objectives ? <p className="os-muted">No description yet.</p> : null}
          </Panel>
        </div>
        <div className="os-stack-lg">
          <Panel title="Details">
            <dl className="os-dl">
              <div><dt>When</dt><dd>{formatDateTime(event.starts_at)}{event.ends_at ? ` to ${formatDateTime(event.ends_at)}` : ""}</dd></div>
              <div><dt>Where</dt><dd>{event.location || "Not set"}</dd></div>
              <div><dt>Estimated budget</dt><dd>{event.estimated_budget != null ? `$${event.estimated_budget}` : "Not set"}</dd></div>
              <div><dt>Responsible</dt><dd>{(leads.data ?? []).map(l => nameOf(l.executive_id)).join(", ") || "Not set"}</dd></div>
              <div><dt>Departments</dt><dd>{(departments.data ?? []).map(d => d.departments?.name).join(", ") || "Decided by needs"}</dd></div>
              <div><dt>Needs</dt><dd>{needs.join(", ") || "None marked"}</dd></div>
            </dl>
            {(guests.data ?? []).length ? <><h3>Guests</h3><ul className="os-list">{(guests.data ?? []).map(g => <li key={g.id}><span>{g.name}{g.role ? ` · ${g.role}` : ""}</span><Pill value={g.status} /></li>)}</ul></> : null}
          </Panel>
          {(live || event.status === "completed") && can(me, "event.edit") ? (
            <Panel title="Manage">
              <ActionForm action={rescheduleEvent} className="os-stack">
                <Hidden name="id" value={id} /><Hidden name="expected" value={event.updated_at} />
                <Field label="Starts" hint="Dates set by hand on tasks stay as they are."><input name="starts_at" type="datetime-local" defaultValue={toLocalInput(event.starts_at)} required /></Field>
                <Field label="Ends"><input name="ends_at" type="datetime-local" defaultValue={toLocalInput(event.ends_at)} /></Field>
                <div><SubmitButton variant="ghost">Reschedule</SubmitButton></div>
              </ActionForm>
              <div className="os-row os-wrap">
                {event.status === "approved" ? <ActionForm action={setEventStatus}><Hidden name="id" value={id} /><Hidden name="status" value="in_progress" /><SubmitButton variant="ghost">Mark in progress</SubmitButton></ActionForm> : null}
                {live ? <ActionForm action={setEventStatus} confirm="Mark this event as completed?"><Hidden name="id" value={id} /><Hidden name="status" value="completed" /><SubmitButton variant="ghost">Mark completed</SubmitButton></ActionForm> : null}
              </div>
            </Panel>
          ) : null}
          {["completed", "rejected"].includes(event.status) && can(me, "event.archive") ? (
            <Panel title="Close">
              <ActionForm action={archiveEvent} confirm="Archive this event and its projects? They become read-only, and nothing is deleted."><Hidden name="id" value={id} /><SubmitButton variant="ghost">Review done: archive</SubmitButton></ActionForm>
            </Panel>
          ) : null}
          <Panel title="Decision history">
            {(approvals.data ?? []).length === 0 ? <p className="os-muted">Not submitted yet.</p> : (
              <ul className="os-timeline">{(approvals.data ?? []).map(a => <li key={a.id}><span className="os-muted">{formatDateTime(a.created_at)}</span>{label(a.decision)} by {nameOf(a.actor_id)}{a.note ? `: ${a.note}` : ""}</li>)}</ul>
            )}
          </Panel>
        </div>
      </div>
    </Page>
  );
}
