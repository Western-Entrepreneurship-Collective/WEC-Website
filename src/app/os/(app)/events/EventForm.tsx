import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Check, Field, Hidden } from "@/components/os/ui";
import { saveEvent } from "@/lib/os/actions/work";
import { toLocalInput } from "@/lib/os/format";
import type { Department, Event } from "@/lib/os/types";

type Person = { id: string; full_name: string; preferred_name: string | null; status: string };

export function EventForm({ event, leads = [], departments, chosen = [], people, guests = "" }: { event?: Event; leads?: string[]; departments: Department[]; chosen?: string[]; people: Person[]; guests?: string }) {
  return (
    <ActionForm action={saveEvent} className="os-stack os-panel">
      <Hidden name="id" value={event?.id} />
      <Hidden name="expected" value={event?.updated_at} />
      <div className="os-form-grid">
        <Field label="Name"><input name="name" defaultValue={event?.name} required maxLength={160} /></Field>
        <Field label="Program"><input name="program" defaultValue={event?.program} maxLength={120} placeholder="Founder Labs" /></Field>
        <Field label="Tier" hint="Sets the planning runway for generated tasks.">
          <select name="tier" defaultValue={event?.tier ?? "B"} required>
            <option value="A">Tier A: 4 weeks. Pitch competitions, networking, large events</option>
            <option value="B">Tier B: 3 weeks. Founder Labs, From-The-Field, workshops, speakers</option>
            <option value="C">Tier C: 2 weeks. Venture Studio sessions, small events</option>
          </select>
        </Field>
        <Field label="Location"><input name="location" defaultValue={event?.location} maxLength={200} /></Field>
        <Field label="Starts"><input name="starts_at" type="datetime-local" defaultValue={toLocalInput(event?.starts_at)} required /></Field>
        <Field label="Ends"><input name="ends_at" type="datetime-local" defaultValue={toLocalInput(event?.ends_at)} /></Field>
        <Field label="Estimated budget (CAD)"><input name="estimated_budget" type="number" min="0" step="0.01" defaultValue={event?.estimated_budget ?? ""} /></Field>
      </div>
      <Field label="Description"><textarea name="description" rows={3} defaultValue={event?.description} /></Field>
      <Field label="Objectives"><textarea name="objectives" rows={3} defaultValue={event?.objectives} /></Field>
      <fieldset className="os-fieldset">
        <legend>What this event needs</legend>
        <p className="os-muted">These decide which projects and tasks are generated on approval.</p>
        <div className="os-check-grid">
          <Check name="requires_speakers" label="External speakers, mentors, judges or partners" defaultChecked={event?.requires_speakers} />
          <Check name="requires_registration" label="Registration" defaultChecked={event?.requires_registration} />
          <Check name="requires_member_participation" label="Member participation" defaultChecked={event?.requires_member_participation} />
          <Check name="requires_sponsorship" label="Sponsorship" defaultChecked={event?.requires_sponsorship} />
          <Check name="requires_finance" label="Financial management" defaultChecked={event?.requires_finance} />
          <Check name="requires_communications" label="Formal communications" defaultChecked={event?.requires_communications} />
          <Check name="requires_founder_support" label="Founder-focused programming" defaultChecked={event?.requires_founder_support} />
          <Check name="requires_media" label="Event media capture" defaultChecked={event?.requires_media} />
          <Check name="requires_logistics" label="Logistical coordination" defaultChecked={event?.requires_logistics} />
        </div>
      </fieldset>
      <fieldset className="os-fieldset">
        <legend>Required departments</legend>
        <p className="os-muted">Leave all unticked to let the needs above decide. Tick some to limit generation to those.</p>
        <div className="os-check-grid">
          {departments.map(d => <label key={d.id} className="os-check"><input type="checkbox" name="departments" value={d.id} defaultChecked={chosen.includes(d.id)} /><span>{d.name}</span></label>)}
        </div>
      </fieldset>
      <fieldset className="os-fieldset">
        <legend>Responsible executives</legend>
        <div className="os-check-grid">
          {people.filter(p => p.status === "active").map(p => <label key={p.id} className="os-check"><input type="checkbox" name="leads" value={p.id} defaultChecked={leads.includes(p.id)} /><span>{p.preferred_name || p.full_name}</span></label>)}
        </div>
      </fieldset>
      <Field label="Speakers or guests" hint="One per line. Name - role."><textarea name="guests" rows={3} defaultValue={guests} /></Field>
      <div className="os-form-grid">
        <Field label="Marketing requirements"><textarea name="marketing_notes" rows={2} defaultValue={event?.marketing_notes} /></Field>
        <Field label="Registration requirements"><textarea name="registration_notes" rows={2} defaultValue={event?.registration_notes} /></Field>
        <Field label="Sponsorship requirements"><textarea name="sponsorship_notes" rows={2} defaultValue={event?.sponsorship_notes} /></Field>
      </div>
      <div><SubmitButton>Save draft</SubmitButton></div>
    </ActionForm>
  );
}
