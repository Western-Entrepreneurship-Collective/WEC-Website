"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { newTask } from "@/lib/os/actions/work";
import type { ActionResult } from "@/lib/os/types";

export type Who = { value: string; label: string; group: string; outcome: string; button: string };

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="os-btn os-btn-primary" disabled={pending}>{label}</button>;
}

function Steps() {
  const [steps, setSteps] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    setSteps([...steps, draft.trim()]);
    setDraft("");
  };
  return (
    <div className="os-field">
      <label htmlFor="task-step">Steps <em>(optional)</em></label>
      {steps.length ? (
        <ul className="os-step-draft">
          {steps.map((s, i) => (
            <li key={`${s}${i}`}>
              <span aria-hidden="true" />
              {s}
              <input type="hidden" name="steps" value={s} />
              <button type="button" className="os-link-btn" aria-label={`Remove step: ${s}`} onClick={() => setSteps(steps.filter((_, n) => n !== i))}>Remove</button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="os-row">
        <input
          id="task-step" value={draft} maxLength={300} placeholder="Add a step"
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <button type="button" className="os-btn os-btn-ghost" onClick={add}>Add</button>
      </div>
    </div>
  );
}

const WhoOptions = ({ who }: { who: Who[] }) => [...new Set(who.map(w => w.group))].map(group => (
  <optgroup key={group} label={group}>{who.filter(w => w.group === group).map(w => <option key={w.value} value={w.value}>{w.label}</option>)}</optgroup>
));

/** The whole form on its own page. */
export function TaskForm({ projects, who, project, start, canStartProject }: { projects: { id: string; name: string }[]; who: Who[]; project?: string; start?: string; canStartProject: boolean }) {
  const [state, action] = useActionState(newTask, null);
  const [picked, setPicked] = useState(start && who.some(w => w.value === start) ? start : who[0]?.value);
  const chosen = who.find(w => w.value === picked);
  return (
    <form action={action} className="os-form-card os-stack" aria-labelledby="new-task">
      <div className="os-form-head"><h1 id="new-task">New task</h1><Link href="/os" aria-label="Close">Close</Link></div>
      <div className="os-field"><label htmlFor="task-title">What needs doing?</label><input id="task-title" name="title" required maxLength={200} autoFocus /></div>
      <div className="os-field">
        <label htmlFor="task-project">Project</label>
        <select id="task-project" name="project" required defaultValue={project ?? ""}>
          <option value="" disabled>Choose a project</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {canStartProject ? <small><Link className="os-link" href="/os/projects/new">Start a new project</Link></small> : null}
      </div>
      <div className="os-form-grid">
        <div className="os-field">
          <label htmlFor="task-who">Who?</label>
          <select id="task-who" name="who" value={picked} onChange={e => setPicked(e.target.value)}><WhoOptions who={who} /></select>
        </div>
        <div className="os-field"><label htmlFor="task-due">Due <em>(optional)</em></label><input id="task-due" name="due" type="date" /></div>
      </div>
      <div className="os-field"><label htmlFor="task-details">Details <em>(optional)</em></label><textarea id="task-details" name="description" rows={3} placeholder="What does the person need to know?" /></div>
      <Steps />
      <p className="os-outcome" aria-live="polite">{chosen?.outcome}</p>
      {state?.error ? <p className="os-form-error" role="alert">{state.error}</p> : null}
      <div><Submit label={chosen?.button ?? "Create task"} /></div>
    </form>
  );
}

/** The short version at the top of a project. Details and steps are one click away. */
export function QuickTask({ project, who }: { project: string; who: Who[] }) {
  const form = useRef<HTMLFormElement>(null);
  const [round, setRound] = useState(0);
  const [state, action] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const result = await newTask(prev, fd);
    if (result?.ok) {
      form.current?.reset();
      setRound(r => r + 1);
    }
    return result;
  }, null);
  return (
    <form ref={form} action={action} className="os-quick" aria-label="Add a task">
      <input type="hidden" name="project" value={project} />
      <input type="hidden" name="stay" value="1" />
      <div className="os-quick-row">
        <div className="os-field os-quick-title"><label htmlFor="add-title">Add a task</label><input id="add-title" name="title" required maxLength={200} placeholder="What needs doing?" /></div>
        <div className="os-field"><label htmlFor="add-who">Who?</label><select id="add-who" name="who"><WhoOptions who={who} /></select></div>
        <div className="os-field"><label htmlFor="add-due">Due</label><input id="add-due" name="due" type="date" /></div>
        <Submit label="Add" />
      </div>
      <details className="os-more">
        <summary>Add details and steps</summary>
        <div className="os-stack">
          <div className="os-field"><label htmlFor="add-details">Details</label><textarea id="add-details" name="description" rows={3} placeholder="What does the person need to know?" /></div>
          <Steps key={round} />
        </div>
      </details>
      {state?.error ? <p className="os-form-error" role="alert">{state.error}</p> : null}
      {state?.ok ? <p className="os-form-ok" role="status">{state.message}</p> : null}
    </form>
  );
}
