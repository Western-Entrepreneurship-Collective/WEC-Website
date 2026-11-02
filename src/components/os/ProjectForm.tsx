"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveProject } from "@/lib/os/actions/work";

type Named = { id: string; name: string };
type Template = Named & { kind: string; department_id: string | null };

function Submit({ label, blocked }: { label: string; blocked: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="os-btn os-btn-primary" disabled={pending || blocked}>{label}</button>;
}

/** A project is one team's or several teams'. Nothing here asks anyone to learn a project type. */
export function ProjectForm({ project, myTeams, otherTeams, events, templates, people, startEvent, startMulti }: {
  project?: { id: string; name: string; summary: string; lead: string | null; starts_on: string | null; due_on: string | null; updated_at: string; team: string; teams: string[]; fixedEvent: boolean; visibility: string; share: boolean };
  myTeams: Named[]; otherTeams: Named[]; events: Named[]; templates: Template[]; people: Named[]; startEvent?: string; startMulti?: boolean;
}) {
  const [state, action] = useActionState(saveProject, null);
  const [multi, setMulti] = useState(project ? project.teams.length > 0 : Boolean(startMulti));
  const [chosen, setChosen] = useState<string[]>(project?.teams ?? []);
  const [team, setTeam] = useState(project?.team ?? myTeams[0]?.id ?? "");
  const [eventId, setEventId] = useState(startEvent ?? "");
  const teamName = (project ? [...myTeams, ...otherTeams].find(t => t.id === project.team) : myTeams.find(t => t.id === team))?.name ?? "your team";
  const others = [...myTeams, ...otherTeams].filter(t => t.id !== team);
  const needsTeam = multi && chosen.length === 0;
  const kind = !multi ? "internal" : eventId ? "event_project" : "global";
  const usable = templates.filter(t => t.kind === kind && (kind !== "internal" || t.department_id === team));
  return (
    <form action={action} className="os-form-card os-stack" aria-labelledby="project-heading">
      <div className="os-form-head"><h1 id="project-heading">{project ? "Edit project" : "New project"}</h1><Link href={project ? `/os/projects/${project.id}` : "/os/projects"} aria-label="Close">Close</Link></div>
      {project ? <><input type="hidden" name="id" value={project.id} /><input type="hidden" name="expected" value={project.updated_at} /><input type="hidden" name="visibility" value={project.visibility} />{project.share ? <input type="hidden" name="share_progress_with_event_lead" value="true" /> : null}</> : null}
      <div className="os-field"><label htmlFor="project-name">Project name</label><input id="project-name" name="name" required maxLength={160} defaultValue={project?.name} /></div>
      {!project ? (
        myTeams.length > 1 ? (
          <div className="os-field"><label htmlFor="project-team">Team</label><select id="project-team" name="owning_department_id" value={team} onChange={e => { setTeam(e.target.value); setChosen(chosen.filter(c => c !== e.target.value)); }}>{myTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        ) : <input type="hidden" name="owning_department_id" value={team} />
      ) : <input type="hidden" name="owning_department_id" value={project.team} />}

      <fieldset className="os-audience">
        <legend>Who&apos;s working on this?</legend>
        {project?.fixedEvent ? null : (
          <label className={!multi ? "is-on" : undefined}>
            <input type="radio" name="audience" value="team" checked={!multi} onChange={() => setMulti(false)} />
            <span><strong>Just my team</strong><small>Only {teamName} and the President can see it.</small></span>
          </label>
        )}
        <label className={multi ? "is-on" : undefined}>
          <input type="radio" name="audience" value="multi" checked={multi} onChange={() => setMulti(true)} />
          <span><strong>Multiple teams</strong><small>Every executive can see its name and progress. Only the teams you choose can open its tasks.</small></span>
        </label>
        {multi ? (
          <div className="os-audience-teams">
            <p>{teamName} is already included. Add:</p>
            <div className="os-check-grid">
              {others.map(t => (
                <label key={t.id} className="os-check">
                  <input type="checkbox" name="teams" value={t.id} checked={chosen.includes(t.id)} onChange={e => setChosen(e.target.checked ? [...chosen, t.id] : chosen.filter(c => c !== t.id))} />
                  <span>{t.name}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </fieldset>

      <details className="os-more">
        <summary>More options</summary>
        <div className="os-stack">
          {!project ? (
            <>
              <div className="os-field"><label htmlFor="project-event">Part of an event</label><select id="project-event" name="event_id" value={eventId} onChange={e => setEventId(e.target.value)}><option value="">None</option>{events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
              <div className="os-field"><label htmlFor="project-template">Start from a template</label><select id="project-template" name="template" key={kind} defaultValue=""><option value="">Blank project</option>{usable.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            </>
          ) : null}
          <div className="os-field"><label htmlFor="project-summary">What it&apos;s for</label><textarea id="project-summary" name="summary" rows={2} defaultValue={project?.summary} /></div>
          <div className="os-field"><label htmlFor="project-lead">Lead</label><select id="project-lead" name="lead_executive_id" defaultValue={project?.lead ?? ""}>{project ? null : <option value="">Me</option>}{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="os-form-grid">
            <div className="os-field"><label htmlFor="project-start">Starts</label><input id="project-start" name="starts_on" type="date" defaultValue={project?.starts_on ?? ""} /></div>
            <div className="os-field"><label htmlFor="project-due">Due</label><input id="project-due" name="due_on" type="date" defaultValue={project?.due_on ?? ""} /></div>
          </div>
        </div>
      </details>

      {needsTeam ? <p className="os-outcome" aria-live="polite">Choose at least one other team, or switch to Just my team.</p> : null}
      {state?.error ? <p className="os-form-error" role="alert">{state.error}</p> : null}
      <div><Submit label={project ? "Save changes" : "Create project"} blocked={needsTeam} /></div>
    </form>
  );
}
