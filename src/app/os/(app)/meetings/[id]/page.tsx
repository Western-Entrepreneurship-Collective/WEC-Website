import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Upload } from "@/components/os/Upload";
import { Empty, Field, Hidden, Page, Panel, PeopleSelect } from "@/components/os/ui";
import { archiveMeeting, convertActionItem, saveActionItem } from "@/lib/os/actions/knowledge";
import { can, getDepartments, getDirectory, inDepartment, nameLookup, requireMe } from "@/lib/os/dal";
import { formatDate, formatDateTime } from "@/lib/os/format";
import { createClient } from "@/lib/os/supabase";
import { MeetingForm } from "../MeetingForm";

export const metadata: Metadata = { title: "Meeting" };

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: meeting } = await supabase.from("meetings").select("*").eq("id", id).maybeSingle();
  if (!meeting) notFound();
  const [departments, people, parts, atts, items, links, projects, files] = await Promise.all([
    getDepartments(), getDirectory(),
    supabase.from("meeting_departments").select("department_id").eq("meeting_id", id),
    supabase.from("meeting_attendees").select("executive_id").eq("meeting_id", id),
    supabase.from("meeting_action_items").select("*").eq("meeting_id", id).order("created_at"),
    supabase.from("meeting_project_links").select("project_id, projects(name)").eq("meeting_id", id),
    supabase.from("projects").select("id, name").is("archived_at", null).order("name").limit(200),
    supabase.from("attachments").select("*").eq("entity_type", "meeting").eq("entity_id", id),
  ]);
  const nameOf = nameLookup(people);
  const manages = !meeting.archived_at && (me.is_president || meeting.created_by === me.id || (inDepartment(me, meeting.department_id) && can(me, "meeting.create")));
  const projectChoices = projects.data ?? [];
  return (
    <Page eyebrow={departments.find(d => d.id === meeting.department_id)?.name} title={meeting.title} actions={<span className="os-muted">{formatDateTime(meeting.starts_at)}</span>}>
      {meeting.archived_at ? <p className="os-note">This meeting record is archived and read-only.</p> : null}
      <div className="os-split">
        <div className="os-stack-lg">
          <Panel title="Agenda"><div className="os-doc">{meeting.agenda || <span className="os-muted">No agenda recorded.</span>}</div></Panel>
          <Panel title="Minutes"><div className="os-doc">{meeting.minutes || <span className="os-muted">No minutes recorded.</span>}</div></Panel>
          <Panel title="Decisions"><div className="os-doc">{meeting.decisions || <span className="os-muted">No decisions recorded.</span>}</div></Panel>
          {manages ? <Panel title="Edit"><MeetingForm meeting={meeting} choices={departments} departments={departments} people={people} projects={projectChoices} chosenDepartments={(parts.data ?? []).map(p => p.department_id)} attendees={(atts.data ?? []).map(a => a.executive_id)} chosenProjects={(links.data ?? []).map(l => l.project_id)} /></Panel> : null}
        </div>
        <div className="os-stack-lg">
          <Panel title="Action items">
            {(items.data ?? []).length === 0 ? <Empty>None yet.</Empty> : (
              <ul className="os-list">
                {(items.data ?? []).map(item => (
                  <li key={item.id} className="os-action-item">
                    <span>{item.title} <span className="os-muted">{nameOf(item.owner_id)}{item.due_on ? ` · ${formatDate(item.due_on)}` : ""}</span></span>
                    {item.converted_task_id ? <Link className="os-link" href={`/os/tasks/${item.converted_task_id}`}>Task</Link> : manages ? (
                      <ActionForm action={convertActionItem} className="os-inline-form">
                        <Hidden name="item" value={item.id} />
                        <Field label="Make a task in"><select name="project" required defaultValue=""><option value="" disabled>Choose a project</option>{projectChoices.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
                        <SubmitButton variant="ghost">Create task</SubmitButton>
                      </ActionForm>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {manages ? (
              <ActionForm action={saveActionItem} className="os-stack" resetOnSuccess>
                <Hidden name="meeting" value={id} />
                <Field label="New action"><input name="title" required maxLength={200} /></Field>
                <PeopleSelect name="owner" people={people} label="Owner" />
                <Field label="Due"><input name="due_on" type="date" /></Field>
                <div><SubmitButton variant="ghost">Add</SubmitButton></div>
              </ActionForm>
            ) : null}
            {can(me, "project.create_internal") && manages ? <p className="os-muted">An action that needs a new project? <Link className="os-link" href={`/os/projects/new?kind=INTERNAL&department=${meeting.department_id}`}>Create one first</Link>, then convert it.</p> : null}
          </Panel>
          <Panel title="Attendees">{(atts.data ?? []).length === 0 ? <Empty>None recorded.</Empty> : <ul className="os-list">{(atts.data ?? []).map(a => <li key={a.executive_id}>{nameOf(a.executive_id)}</li>)}</ul>}</Panel>
          <Panel title="Linked projects">{(links.data ?? []).length === 0 ? <Empty>None.</Empty> : <ul className="os-list">{(links.data ?? []).map(l => <li key={l.project_id}><Link href={`/os/projects/${l.project_id}`}>{l.projects?.name}</Link></li>)}</ul>}</Panel>
          <Panel title="Files">
            <ul className="os-list">{(files.data ?? []).map(a => <li key={a.id}><a className="os-link" href={`/os/attachments/${a.id}`}>{a.file_name}</a></li>)}</ul>
            {manages ? <Upload type="meeting" entity={id} /> : null}
          </Panel>
          {manages ? <ActionForm action={archiveMeeting} confirm="Archive this meeting record? It stays on record, read-only."><Hidden name="id" value={id} /><SubmitButton variant="ghost">Archive</SubmitButton></ActionForm> : null}
        </div>
      </div>
    </Page>
  );
}
