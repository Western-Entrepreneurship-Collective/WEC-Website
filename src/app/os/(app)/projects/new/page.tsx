import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Check, Field, Hidden, Page, PeopleSelect } from "@/components/os/ui";
import { createProject } from "@/lib/os/actions/work";
import { can, getDepartments, getDirectory, requireMe } from "@/lib/os/dal";
import { createClient } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ kind?: string; event?: string; department?: string }> }) {
  const me = await requireMe();
  const { kind: rawKind, event: eventId, department } = await searchParams;
  const kind = rawKind === "GLOBAL" || rawKind === "EVENT" ? rawKind : "INTERNAL";
  const permission = kind === "GLOBAL" ? "global.submit" : kind === "EVENT" ? "project.create_event" : "project.create_internal";
  if (!can(me, permission)) notFound();
  const supabase = await createClient();
  const departments = await getDepartments();
  const mine = departments.filter(d => me.positions.some(p => p.department_id === d.id));
  const [{ data: templates }, { data: events }, people] = await Promise.all([
    supabase.from("templates").select("id, name, kind, department_id").is("archived_at", null).eq("kind", kind === "GLOBAL" ? "global" : kind === "EVENT" ? "event_project" : "internal").order("name"),
    supabase.from("events").select("id, name").in("status", ["approved", "in_progress"]).order("starts_at"),
    getDirectory(),
  ]);
  const choices = kind === "INTERNAL" ? mine : me.is_president || can(me, "event.edit") ? departments : mine;
  const title = kind === "GLOBAL" ? "Global Project" : kind === "EVENT" ? "Event Project" : "Internal Project";
  return (
    <Page title={`New ${title}`}>
      <ActionForm action={createProject} className="os-stack os-panel">
        <Hidden name="kind" value={kind} />
        {kind === "GLOBAL" && !me.is_president ? <p className="os-note">This stays off the Core Calendar until the President approves it. You will send it for approval on the next page.</p> : null}
        {kind === "INTERNAL" ? <p className="os-muted">Only your team and the President can see an internal project, even when it is linked to an event.</p> : null}
        <div className="os-form-grid">
          <Field label="Name"><input name="name" required maxLength={160} /></Field>
          {kind !== "GLOBAL" ? (
            <Field label="Owning team">
              <select name="owning_department_id" defaultValue={department ?? mine[0]?.id} required>
                {choices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
          ) : null}
          {kind !== "GLOBAL" ? (
            <Field label={kind === "EVENT" ? "Event" : "Linked event (optional)"}>
              <select name="event_id" defaultValue={eventId ?? ""} required={kind === "EVENT"}>
                <option value="">{kind === "EVENT" ? "Choose an event" : "None"}</option>
                {(events ?? []).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </Field>
          ) : null}
          <PeopleSelect name="lead_executive_id" people={people} value={me.id} label="Project lead" blank="Me" />
          <Field label="Starts"><input name="starts_on" type="date" /></Field>
          <Field label="Due"><input name="due_on" type="date" /></Field>
          <Field label="Start from a template" hint="Creates its tasks, with dates counted from the start date.">
            <select name="template" defaultValue="">
              <option value="">Blank project</option>
              {(templates ?? []).filter(t => kind !== "INTERNAL" || t.department_id === (department ?? mine[0]?.id) || mine.some(d => d.id === t.department_id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Summary"><textarea name="summary" rows={3} /></Field>
        {kind === "INTERNAL" ? <Check name="share_progress_with_event_lead" label="If linked to an event, share high-level progress with the event lead (never tasks)" /> : null}
        {kind !== "INTERNAL" ? (
          <>
            <fieldset className="os-fieldset">
              <legend>Participating teams</legend>
              <div className="os-check-grid">{departments.map(d => <label key={d.id} className="os-check"><input type="checkbox" name="departments" value={d.id} /><span>{d.name}</span></label>)}</div>
            </fieldset>
            <Field label="Who can open it">
              <select name="visibility" defaultValue="participants"><option value="participants">The owning and participating teams</option><option value="organization">Every executive</option></select>
            </Field>
          </>
        ) : null}
        <div><SubmitButton>Create project</SubmitButton></div>
      </ActionForm>
    </Page>
  );
}
