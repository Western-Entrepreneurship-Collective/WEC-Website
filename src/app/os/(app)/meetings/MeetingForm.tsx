import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Field, Hidden } from "@/components/os/ui";
import { saveMeeting } from "@/lib/os/actions/knowledge";
import { toLocalInput } from "@/lib/os/format";
import type { Department, Meeting } from "@/lib/os/types";

type Person = { id: string; full_name: string; preferred_name: string | null; status: string };

export function MeetingForm({ meeting, choices, departments, people, projects, department, chosenDepartments = [], attendees = [], chosenProjects = [] }: {
  meeting?: Meeting; choices: Department[]; departments: Department[]; people: Person[]; projects: { id: string; name: string }[]; department?: string;
  chosenDepartments?: string[]; attendees?: string[]; chosenProjects?: string[];
}) {
  return (
    <ActionForm action={saveMeeting} className="os-stack">
      <Hidden name="id" value={meeting?.id} /><Hidden name="expected" value={meeting?.updated_at} />
      <div className="os-form-grid">
        <Field label="Title"><input name="title" defaultValue={meeting?.title} required maxLength={160} /></Field>
        <Field label="Date and time"><input name="starts_at" type="datetime-local" defaultValue={toLocalInput(meeting?.starts_at)} required /></Field>
        {meeting ? <Hidden name="department_id" value={meeting.department_id} /> : (
          <Field label="Department"><select name="department_id" defaultValue={department} required>{choices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        )}
      </div>
      <Field label="Agenda"><textarea name="agenda" rows={4} defaultValue={meeting?.agenda} /></Field>
      <Field label="Minutes"><textarea name="minutes" rows={7} defaultValue={meeting?.minutes} /></Field>
      <Field label="Decisions"><textarea name="decisions" rows={3} defaultValue={meeting?.decisions} /></Field>
      <fieldset className="os-fieldset"><legend>Other teams taking part</legend><div className="os-check-grid">{departments.map(d => <label key={d.id} className="os-check"><input type="checkbox" name="departments" value={d.id} defaultChecked={chosenDepartments.includes(d.id)} /><span>{d.name}</span></label>)}</div></fieldset>
      <fieldset className="os-fieldset"><legend>Attendees</legend><div className="os-check-grid">{people.filter(p => p.status === "active" || attendees.includes(p.id)).map(p => <label key={p.id} className="os-check"><input type="checkbox" name="attendees" value={p.id} defaultChecked={attendees.includes(p.id)} /><span>{p.preferred_name || p.full_name}</span></label>)}</div></fieldset>
      {projects.length ? <fieldset className="os-fieldset"><legend>Linked projects</legend><div className="os-check-grid">{projects.map(p => <label key={p.id} className="os-check"><input type="checkbox" name="projects" value={p.id} defaultChecked={chosenProjects.includes(p.id)} /><span>{p.name}</span></label>)}</div></fieldset> : null}
      <div><SubmitButton>{meeting ? "Save" : "Create meeting record"}</SubmitButton></div>
    </ActionForm>
  );
}
