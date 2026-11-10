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
import { saveRepScore, setRepShortlist } from "@/lib/os/actions/hiring";
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
                    <td>{a.shortlisted ? <span className="os-pill os-tone-good">Shortlisted</span> : null}</td>
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

export function RepScoreForm({ id, mine }: { id: string; mine: { areas: number[]; note: string } | null }) {
  // Controlled, so React's reset after a form action never wipes what was typed.
  const [values, setValues] = useState<number[]>(mine?.areas ?? [3, 3, 3, 3]);
  const [note, setNote] = useState(mine?.note ?? "");
  return (
    <ActionForm action={saveRepScore} ariaLabel="Your score">
      <input type="hidden" name="id" value={id} />
      <fieldset className="os-fieldset">
        <legend>Your score</legend>
        <div className="os-stack">
          {REVIEW_AREAS.map((area, i) => (
            <div key={area} className="os-score">
              <label className="os-score-head" htmlFor={`area-${i}`}>
                <span>{area}</span><span className="os-score-value">{values[i]} / 5</span>
              </label>
              <input id={`area-${i}`} name={`area-${i}`} type="range" min={1} max={5} step={1} value={values[i]}
                     style={{ "--fill": `${(values[i] - 1) * 25}%` } as React.CSSProperties}
                     onChange={e => setValues(prev => prev.map((v, j) => j === i ? +e.target.value : v))} />
              <div className="os-score-ticks" aria-hidden="true">
                {[1, 2, 3, 4, 5].map(n => <span key={n} className={n === values[i] ? "is-on" : undefined}>{n}</span>)}
              </div>
            </div>
          ))}
          <p className="os-muted">Total {values.reduce((s, v) => s + v, 0)} / 20</p>
          <label className="os-field">Why this score (one line)
            <input name="note" value={note} onChange={e => setNote(e.target.value)} maxLength={NOTE_MAX} placeholder="Strong story, unsure about hours" />
          </label>
          <div className="os-row">
            <SubmitButton>{mine ? "Update score" : "Save score"}</SubmitButton>
          </div>
        </div>
      </fieldset>
    </ActionForm>
  );
}

export function ShortlistButton({ id, shortlisted, full }: { id: string; shortlisted: boolean; full: boolean }) {
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
