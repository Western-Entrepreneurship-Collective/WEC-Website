import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Check, Field, Page, Panel } from "@/components/os/ui";
import { changePassword } from "@/lib/os/actions/auth";
import { updatePreferences, updateProfile } from "@/lib/os/actions/work";
import { requireMe } from "@/lib/os/dal";
import { createClient } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const me = await requireMe();
  const supabase = await createClient();
  const { data: prefs } = await supabase.from("notification_preferences").select("*").maybeSingle();
  return (
    <Page title="Profile">
      <div className="os-grid">
        <Panel title="You">
          <ActionForm action={updateProfile} className="os-stack">
            <Field label="Full name"><input name="full_name" defaultValue={me.full_name} required maxLength={120} /></Field>
            <Field label="Preferred name"><input name="preferred_name" defaultValue={me.preferred_name ?? ""} maxLength={80} /></Field>
            <Field label="Email" hint="The address you sign in with."><input value={me.email} readOnly /></Field>
            <div><SubmitButton variant="ghost">Save</SubmitButton></div>
          </ActionForm>
          <p><Link className="os-link" href="/os/welcome">See the welcome guide again</Link></p>
          <h3>Positions</h3>
          {me.positions.length ? <ul className="os-list">{me.positions.map(p => <li key={p.position_id}>{p.title}<span className="os-muted">{p.department_name}{p.is_acting ? " · acting" : ""}</span></li>)}</ul> : <p className="os-muted">None.</p>}
        </Panel>
        <Panel title="Notifications">
          <ActionForm action={updatePreferences} className="os-stack">
            <Check name="email_digest" label="Email me when my team is added to a project, and a daily digest when I have unread notifications" defaultChecked={prefs?.email_digest ?? true} />
            <fieldset className="os-fieldset">
              <legend>Do not notify me about</legend>
              {[["deadline.upcoming", "Upcoming deadlines"], ["task.commented", "New comments"], ["announcement.published", "Announcements"]].map(([k, l]) => (
                <label key={k} className="os-check"><input type="checkbox" name="muted" value={k} defaultChecked={prefs?.muted_kinds?.includes(k)} /><span>{l}</span></label>
              ))}
            </fieldset>
            <div><SubmitButton variant="ghost">Save</SubmitButton></div>
          </ActionForm>
        </Panel>
        <Panel title="Change password">
          <ActionForm action={changePassword} className="os-stack" resetOnSuccess>
            <Field label="Current password"><input name="current" type="password" autoComplete="current-password" required /></Field>
            <Field label="New password" hint="At least 10 characters."><input name="password" type="password" autoComplete="new-password" minLength={10} required /></Field>
            <Field label="Repeat it"><input name="confirm" type="password" autoComplete="new-password" minLength={10} required /></Field>
            <div><SubmitButton variant="ghost">Change password</SubmitButton></div>
          </ActionForm>
        </Panel>
      </div>
    </Page>
  );
}
