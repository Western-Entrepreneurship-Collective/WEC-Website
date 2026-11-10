import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RepScoreForm, ShortlistButton } from "@/components/os/ApplicationsBoard";
import { Page, Panel } from "@/components/os/ui";
import { requireMe } from "@/lib/os/dal";
import { RpcError, rpc } from "@/lib/os/supabase";
import { REP_STAGES, type RepFieldId } from "@/lib/repApplications";
import { SHORTLIST_SIZE, type RepApplicationFull, type RepReview } from "@/lib/repReview";

export const metadata: Metadata = { title: "Application" };

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
              <RepScoreForm id={a.id} mine={r.mine} />
              <ShortlistButton id={a.id} shortlisted={r.shortlisted} full={r.shortlist_count >= SHORTLIST_SIZE} />
              <p className="os-muted">
                {r.mine
                  ? r.others.length
                    ? `Other reviewers: ${r.others.map(o => `${o.name} ${o.total}/20 (${o.note})`).join(" · ")}`
                    : "No one else has scored this yet."
                  : "Other reviewers' scores stay hidden until you save yours."}
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </Page>
  );
}
