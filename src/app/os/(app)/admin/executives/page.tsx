import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { InviteForm } from "@/components/os/InviteForm";
import { Check, Empty, Field, Hidden, Panel, PeopleSelect, Pill } from "@/components/os/ui";
import { assignPosition, deactivateExecutive, endAssignment, reactivateExecutive, resendInvitation, revokeInvitation, setSystemAdmin } from "@/lib/os/actions/admin";
import { getDirectory, requireAdmin } from "@/lib/os/dal";
import { formatDate } from "@/lib/os/format";
import { createClient } from "@/lib/os/supabase";

export default async function AdminExecutives() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const [people, positions, assignments, admins, invitations] = await Promise.all([
    getDirectory(),
    supabase.from("positions").select("id, title, seat_count, departments!positions_department_id_fkey(name, sort_order)").is("archived_at", null),
    supabase.from("position_assignments").select("id, executive_id, seat_no, during, is_acting, positions(title)").order("created_at", { ascending: false }),
    supabase.from("system_admins").select("executive_id"),
    supabase.from("invitations").select("*").is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false }),
  ]);
  const positionOptions = (positions.data ?? []).sort((a, b) => (a.departments?.sort_order ?? 0) - (b.departments?.sort_order ?? 0));
  const adminIds = new Set((admins.data ?? []).map(a => a.executive_id));
  const today = new Date().toISOString().slice(0, 10);
  const current = (during: unknown) => { const u = String(during).split(",")[1]?.replace(/[)\]]/, ""); return !u || u > today; };

  return (
    <>
      <Panel title="Invite an executive">
        <InviteForm positions={positionOptions.map(p => ({ id: p.id, title: p.title, team: p.departments?.name }))} />
      </Panel>
      {(invitations.data ?? []).length ? (
        <Panel title="Open invitations">
          <ul className="os-list">
            {(invitations.data ?? []).map(i => (
              <li key={i.id}><span>{i.full_name} <span className="os-muted">{i.email} · {formatDate(i.created_at)}</span></span>
                <span className="os-row">
                  <ActionForm action={resendInvitation}><Hidden name="email" value={i.email} /><button className="os-link-btn" type="submit">Resend</button></ActionForm>
                  <ActionForm action={revokeInvitation} confirm={`Revoke the invitation to ${i.email}?`}><Hidden name="id" value={i.id} /><button className="os-link-btn" type="submit">Revoke</button></ActionForm>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <Panel title="Accounts">
        {people.length === 0 ? <Empty>No accounts yet.</Empty> : (
          <ul className="os-people">
            {people.map(p => (
              <li key={p.id}>
                <details>
                  <summary>
                    <span><strong>{p.full_name}</strong> <span className="os-muted">{p.email}</span></span>
                    <span className="os-row"><Pill value={p.status} />{adminIds.has(p.id) ? <span className="os-tag">Admin</span> : null}</span>
                  </summary>
                  <div className="os-stack">
                    <ul className="os-list">
                      {(assignments.data ?? []).filter(a => a.executive_id === p.id).map(a => (
                        <li key={a.id}><span>{a.positions?.title} <span className="os-muted">seat {a.seat_no}{a.is_acting ? " · acting" : ""}{current(a.during) ? "" : " · ended"}</span></span>
                          {current(a.during) && p.id !== me.id ? <ActionForm action={endAssignment} confirm={`End ${p.full_name}'s assignment as ${a.positions?.title}?`}><Hidden name="id" value={a.id} /><button className="os-link-btn" type="submit">End</button></ActionForm> : null}
                        </li>
                      ))}
                    </ul>
                    {p.id === me.id ? <p className="os-muted">Another administrator has to change your own access.</p> : p.status !== "deactivated" ? (
                      <>
                        <ActionForm action={assignPosition} className="os-inline-form">
                          <Hidden name="id" value={p.id} />
                          <Field label="Assign position"><select name="position" required>{positionOptions.map(o => <option key={o.id} value={o.id}>{o.departments?.name}: {o.title}</option>)}</select></Field>
                          <Field label="Seat"><input name="seat" type="number" min="1" defaultValue="1" /></Field>
                          <Check name="acting" label="Acting" />
                          <SubmitButton variant="ghost">Assign</SubmitButton>
                        </ActionForm>
                        <ActionForm action={setSystemAdmin} confirm={adminIds.has(p.id) ? `Remove ${p.full_name}'s administrator access?` : `Make ${p.full_name} a System Administrator?`}>
                          <Hidden name="id" value={p.id} /><Hidden name="value" value={adminIds.has(p.id) ? "false" : "true"} />
                          <SubmitButton variant="ghost">{adminIds.has(p.id) ? "Remove administrator access" : "Make administrator"}</SubmitButton>
                        </ActionForm>
                        <ActionForm action={deactivateExecutive} className="os-inline-form" confirm={`Deactivate ${p.full_name}? They lose access immediately and their open work moves on.`}>
                          <Hidden name="id" value={p.id} />
                          <PeopleSelect name="reassign_to" people={people.filter(x => x.id !== p.id)} label="Hand unfinished work to" blank="Their department head" />
                          <SubmitButton variant="danger">Deactivate account</SubmitButton>
                        </ActionForm>
                      </>
                    ) : (
                      <ActionForm action={reactivateExecutive} confirm={`Give ${p.full_name} access again?`}><Hidden name="id" value={p.id} /><SubmitButton variant="ghost">Reactivate</SubmitButton></ActionForm>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
