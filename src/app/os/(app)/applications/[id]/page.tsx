import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RepScoreForm, ShortlistButton } from "@/components/os/ApplicationsBoard";
import { Page, Panel } from "@/components/os/ui";
import { requireMe } from "@/lib/os/dal";
import { RpcError, rpc } from "@/lib/os/supabase";
import { REP_STAGES, type RepFieldId } from "@/lib/repApplications";
import { REVIEW_AREAS, SHORTLIST_SIZE, type RepApplicationFull, type RepReview } from "@/lib/repReview";

export const metadata: Metadata = { title: "Application" };

// Every score side by side, once you have saved yours: one row per reviewer, each
// area, the total, the note, and the average underneath.
function ScoresTable({ mine, others }: { mine: NonNullable<RepReview["mine"]>; others: RepReview["others"] }) {
  const rows = [{ name: "You", ...mine }, ...others];
  const avg = rows.reduce((s, x) => s + x.total, 0) / rows.length;
  return (
    <Panel title="Scores">
      <div className="os-table-wrap" tabIndex={0} role="group" aria-label="Scores">
        <table className="os-table">
          <thead>
            <tr><th scope="col">Reviewer</th>{REVIEW_AREAS.map(a => <th key={a} scope="col">{a}</th>)}<th scope="col">Total</th><th scope="col">Why</th></tr>
          </thead>
          <tbody>
            {rows.map(x => (
              <tr key={x.name}>
                <th scope="row">{x.name}</th>
                {x.areas.map((v, i) => <td key={i}>{v} / 5</td>)}
                <td><strong>{x.total} / 20</strong></td>
                <td>{x.note}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><th scope="row">Average</th>{REVIEW_AREAS.map((a, i) => <td key={a}>{(rows.reduce((s, x) => s + x.areas[i], 0) / rows.length).toFixed(1)}</td>)}<td><strong>{avg.toFixed(1)} / 20</strong></td><td className="os-muted">{rows.length} scored</td></tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  );
}

// Form field id → database column, where they differ.
const COLUMN: Partial<Record<RepFieldId, keyof RepApplicationFull>> = {
  westernEmail: "western_email", event: "event_idea", showUp: "show_up", execNext: "exec_next",
};

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMe();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let r: RepReview;
  try {
    r = await rpc<RepReview>("rep_get", { p_id: id });
  } catch (error) {
    if (error instanceof RpcError && error.code === "P0404") notFound();
    throw error;
  }
  const a = r.application;
  // Every question in the form's own words and order, except name and email (in the title).
  const answers = REP_STAGES.flatMap(s => s.qs)
    .filter(q => q.id !== "name" && q.id !== "westernEmail")
    .map(q => [q.label, a[COLUMN[q.id] ?? (q.id as keyof RepApplicationFull)]] as const);

  return (
    <Page eyebrow="First Year Rep hiring" title={a.name} subtitle={a.western_email}>
      <div className="os-stack-lg">
        <div className="os-row">
          <Link className="os-btn os-btn-ghost" href="/os/applications">Back to applications</Link>
          {r.prev_id ? <Link className="os-btn os-btn-ghost" href={`/os/applications/${r.prev_id}`}>Previous applicant</Link> : null}
          {r.next_id ? <Link className="os-btn os-btn-ghost" href={`/os/applications/${r.next_id}`}>Next applicant</Link> : null}
        </div>
        <Panel title="Application">
          <div className="os-split">
            <dl className="os-stack">
              {answers.map(([q, v]) => (
                <div key={q}><dt className="os-muted">{q}</dt><dd style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{v || "Not answered"}</dd></div>
              ))}
            </dl>
            <div className="os-stack">
              {/* key: a fresh form per applicant, so values never carry over between pages */}
              <RepScoreForm key={a.id} id={a.id} mine={r.mine} locked={r.locked} />
              <ShortlistButton id={a.id} shortlisted={r.shortlisted} full={r.shortlist_count >= SHORTLIST_SIZE} />
              <p className="os-muted">
                {r.mine
                  ? r.others.length ? "Everyone's scores are in the table below." : "No one else has scored this yet."
                  : "Other reviewers' scores stay hidden until you save yours."}
              </p>
            </div>
          </div>
        </Panel>
        {r.mine && r.others.length ? <ScoresTable mine={r.mine} others={r.others} /> : null}
      </div>
    </Page>
  );
}
