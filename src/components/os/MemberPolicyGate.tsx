"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { agreeMemberPolicy } from "@/lib/os/actions/members";
import { MEMBER_POLICY_RULES } from "@/lib/os/memberPolicy";
import "@/styles/os-members.css";

type Action = Parameters<typeof ActionForm>[0]["action"];

/** Shown instead of the list until the person agrees to the member data rules, once. */
export function MemberPolicyGate({ action = agreeMemberPolicy }: { action?: Action }) {
  const [ticked, setTicked] = useState(false);
  return (
    <section className="os-panel os-members-gate">
      <h2>Before you open the member list</h2>
      <p>This list holds members&apos; personal information. To open it, read the rules below and agree to follow them.</p>
      <ol>
        {MEMBER_POLICY_RULES.map(rule => <li key={rule}>{rule}</li>)}
      </ol>
      <ActionForm action={action} ariaLabel="Agree to the member data rules">
        <label className="os-members-gate-agree">
          <input type="checkbox" name="agree" value="yes" aria-label="I agree to follow the member data rules" checked={ticked} onChange={e => setTicked(e.target.checked)} />
          <span>I have read these rules and I agree to follow them. I understand that breaking them can cost me access to the list.</span>
        </label>
        <div><SubmitButton>{ticked ? "Agree and open the list" : "Tick the box to continue"}</SubmitButton></div>
      </ActionForm>
    </section>
  );
}
