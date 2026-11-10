import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplicationsList, CloseRoundForm } from "@/components/os/ApplicationsBoard";
import { Page, Panel, Stat } from "@/components/os/ui";
import { requireMe } from "@/lib/os/dal";
import { RpcError, rpc } from "@/lib/os/supabase";
import { ROUND_CLOSES, SHORTLIST_SIZE, type RepList } from "@/lib/repReview";

export const metadata: Metadata = { title: "Applications" };

export default async function ApplicationsPage() {
  await requireMe();
  // The database decides who may see this. Anyone off the reviewer list gets a
  // 404, the same as a page that does not exist.
  let list: RepList;
  try {
    list = await rpc<RepList>("rep_list");
  } catch (error) {
    if (error instanceof RpcError && error.code === "P0404") notFound();
    throw error;
  }
  const scored = list.rows.filter(r => r.my_total !== null).length;
  return (
    <Page eyebrow="First Year Rep hiring" title="Applications"
          subtitle="Visible to the hiring reviewers only. Score each application alone; the others' scores open once you save yours.">
      <div className="os-stack-lg">
        <div className="os-stats">
          <Stat label="Applications" value={list.rows.length} />
          <Stat label="Scored by you" value={`${scored} of ${list.rows.length}`} />
          <Stat label="Shortlisted for interview" value={`${list.shortlist_count} of ${SHORTLIST_SIZE}`} />
          <Stat label="Applications close" value={ROUND_CLOSES} />
        </div>
        <ApplicationsList rows={list.rows} />
        {list.rows.length > 0 ? (
          <Panel title="Close the round">
            <CloseRoundForm count={list.rows.length} />
          </Panel>
        ) : null}
      </div>
    </Page>
  );
}
