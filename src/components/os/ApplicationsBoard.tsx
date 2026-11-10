"use client";

/**
 * First Year Rep review in WEC OS: the sortable list (/os/applications) and the
 * score form on each applicant's own page (/os/applications/[id]).
 *
 * Nothing secret reaches this file: the server only sends other reviewers'
 * scores and the average once the signed-in reviewer has saved their own
 * (api.rep_list and api.rep_get in 20261111000100_rep_reviews.sql).
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Panel } from "@/components/os/ui";
import { closeRepRound, saveRepScore, setRepShortlist } from "@/lib/os/actions/hiring";
import { NOTE_MAX, REVIEW_AREAS, type RepListRow } from "@/lib/repReview";
import "@/styles/os-applications.css";

const shortDate = (v: string) => new Date(v).toLocaleDateString("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric" });

export function ApplicationsList({ rows }: { rows: RepListRow[] }) {
  const [sort, setSort] = useState<"date" | "average" | "name">("date");
  const [year, setYear] = useState("");
  const years = useMemo(() => [...new Set(rows.map(r => r.year))], [rows]);

  const shown = useMemo(() => {
    const list = rows.filter(r => !year || r.year === year);
    return [...list].sort((a, b) => sort === "name" ? a.name.localeCompare(b.name)
      : sort === "date" ? a.submitted_at.localeCompare(b.submitted_at)
        : (b.average ?? -1) - (a.average ?? -1));
  }, [rows, sort, year]);

  return (
    <div className="os-stack-lg">
      <div className="os-row">
        <label className="os-field">Sort by
          <select value={sort} onChange={e => setSort(e.target.value as typeof sort)}>
            <option value="date">Date applied</option><option value="average">Average score</option><option value="name">Name</option>
          </select>
        </label>
        <label className="os-field">Year
          <select value={year} onChange={e => setYear(e.target.value)}>
            <option value="">All years</option>
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
        </label>
      </div>

      <Panel title="Applicants">
        {shown.length === 0 ? <p className="os-muted">No applications yet.</p> : (
          <div className="os-table-wrap" tabIndex={0} role="group" aria-label="Applicants">
            <table className="os-table">
              <thead><tr><th scope="col">Applicant</th><th scope="col" className="os-wide-only">Program</th><th scope="col">Your score</th><th scope="col">Average</th><th scope="col">Interview</th></tr></thead>
              <tbody>
                {shown.map(a => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/os/applications/${a.id}`}>{a.name}</Link>
                      <small className="os-muted os-block">{a.year} · applied {shortDate(a.submitted_at)}</small>
                    </td>
                    <td className="os-wide-only">{a.program}</td>
                    <td>{a.my_total !== null ? `${a.my_total} / 20` : <span className="os-muted">Not scored</span>}</td>
                    <td>{a.average !== null ? `${Number(a.average).toFixed(1)} / 20 (${a.scored_by})` : <span className="os-muted">Hidden</span>}</td>
                    <td>{a.shortlisted === true ? <span className="os-pill os-tone-good">Shortlisted</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function RepScoreForm({ id, mine, locked }: { id: string; mine: { areas: number[]; note: string } | null; locked: boolean }) {
  // Every area starts unset, so a careless Save cannot record a score nobody chose.
  // Controlled, so React's reset after a form action never wipes what was typed.
  const [values, setValues] = useState<(number | null)[]>(mine?.areas ?? [null, null, null, null]);
  const [note, setNote] = useState(mine?.note ?? "");
  const allSet = values.every(v => v !== null);

  if (locked && mine) {
    return (
      <fieldset className="os-fieldset">
        <legend>Your score: {mine.areas.reduce((s, v) => s + v, 0)} / 20</legend>
        <ul className="os-stack">
          {REVIEW_AREAS.map((area, i) => <li key={area}>{area}: {mine.areas[i]} / 5</li>)}
        </ul>
        <p>{mine.note}</p>
        <p className="os-muted">Locked. Other reviewers have scored this applicant too, so you can see their scores and yours can no longer change.</p>
      </fieldset>
    );
  }

  return (
    <ActionForm action={saveRepScore} ariaLabel="Your score">
      <input type="hidden" name="id" value={id} />
      <fieldset className="os-fieldset">
        <legend>Your score</legend>
        <div className="os-stack">
          {REVIEW_AREAS.map((area, i) => {
            const v = values[i];
            return (
              <div key={area} className={`os-score${v === null ? " is-unset" : ""}`}>
                <label className="os-score-head" htmlFor={`area-${i}`}>
                  <span>{area}</span><span className="os-score-value">{v === null ? "Pick 1 to 5" : `${v} / 5`}</span>
                </label>
                <input type="hidden" name={`area-${i}`} value={v ?? ""} />
                <input id={`area-${i}`} type="range" min={1} max={5} step={1} value={v ?? 3}
                       aria-valuetext={v === null ? "Not scored yet" : `${v} out of 5`}
                       style={{ "--fill": v === null ? "0%" : `${(v - 1) * 25}%` } as React.CSSProperties}
                       onChange={e => setValues(prev => prev.map((x, j) => j === i ? +e.target.value : x))}
                       onClick={e => setValues(prev => prev.map((x, j) => j === i ? +(e.target as HTMLInputElement).value : x))} />
                <div className="os-score-ticks">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" className={n === v ? "is-on" : undefined} aria-label={`${area}: ${n}`}
                            onClick={() => setValues(prev => prev.map((x, j) => j === i ? n : x))}>{n}</button>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="os-muted">{allSet ? `Total ${values.reduce<number>((s, x) => s + (x ?? 0), 0)} / 20` : "Score all four areas to save."}</p>
          <label className="os-field">Why this score (one line)
            <input name="note" value={note} onChange={e => setNote(e.target.value)} maxLength={NOTE_MAX} placeholder="Strong story, unsure about hours" />
          </label>
          <p className="os-muted">Once another reviewer has scored this applicant too, your score locks.</p>
          <div className="os-row">
            <SubmitButton>{mine ? "Update score" : "Save score"}</SubmitButton>
          </div>
        </div>
      </fieldset>
    </ActionForm>
  );
}

export function ShortlistButton({ id, shortlisted, full }: { id: string; shortlisted: boolean | null; full: boolean }) {
  if (shortlisted === null) return <p className="os-muted">Score this applicant to see or change the interview shortlist.</p>;
  return (
    <ActionForm action={setRepShortlist} ariaLabel="Interview shortlist">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="on" value={shortlisted ? "false" : "true"} />
      {!shortlisted && full
        ? <p className="os-muted">The shortlist is full (10). Remove someone to add this applicant.</p>
        : <SubmitButton variant="ghost">{shortlisted ? "Remove from shortlist" : "Shortlist for interview"}</SubmitButton>}
    </ActionForm>
  );
}

// VP Operations only. Folded shut by default and set apart in red at the bottom of
// the page, so nothing in it can be pressed by accident: it has to be opened, the
// word DELETE typed, and then a second confirmation accepted.
export function DangerZone({ count }: { count: number }) {
  return (
    <details className="os-danger-zone">
      <summary>Danger zone <span className="os-muted">VP Operations only</span></summary>
      <div className="os-stack">
        <h3>Close the round</h3>
        <p>Do this only after the reps have accepted their offers. It deletes all {count} applications, every score and the shortlist, as the privacy policy promises. It cannot be undone.</p>
        <ActionForm action={closeRepRound} ariaLabel="Close the round"
                    confirm={`Delete all ${count} applications, every score and the shortlist? This cannot be undone.`}>
          <div className="os-stack">
            <label className="os-field">Type DELETE to confirm
              <input name="confirm" autoComplete="off" spellCheck={false} />
            </label>
            <div className="os-row"><SubmitButton variant="danger">Close the round and delete everything</SubmitButton></div>
          </div>
        </ActionForm>
      </div>
    </details>
  );
}
