import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MemberPolicyGate } from "@/components/os/MemberPolicyGate";
import { MembersBoard, type Member } from "@/components/os/MembersBoard";
import { Page } from "@/components/os/ui";
import { can, requireMe } from "@/lib/os/dal";
import { rpc } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "Members" };

const SUBTITLE = "Everyone on the member list. Copy a batch into the BCC line of your own email.";

/**
 * The member list, for members.view only (VP Community to start). Read-only: nothing
 * here edits a member. Until the person has agreed to the member data rules, the
 * addresses are not even fetched, so they never reach the browser.
 */
export default async function MembersPage() {
  const me = await requireMe();
  if (!can(me, "members.view")) notFound();
  const agreed = await rpc<boolean>("member_policy_agreed");
  if (!agreed) return <Page title="Members" subtitle={SUBTITLE}><MemberPolicyGate /></Page>;
  const members = await rpc<Member[]>("member_list");
  return (
    <Page title="Members" subtitle={SUBTITLE}>
      <MembersBoard members={members} />
    </Page>
  );
}
