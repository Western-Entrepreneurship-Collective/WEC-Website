import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Empty, Field, Hidden, Panel, PeopleSelect } from "@/components/os/ui";
import { finishYearTransition, generateHandovers, startYearTransition, transitionDeparture } from "@/lib/os/actions/admin";
import { getDirectory } from "@/lib/os/dal";
import { formatDate } from "@/lib/os/format";
import { createClient } from "@/lib/os/supabase";

export default async function AdminYears() {
  const supabase = await createClient();
  const [{ data: years }, { data: open }, { data: snapshots }, people] = await Promise.all([
    supabase.from("academic_years").select("*").order("starts_on", { ascending: false }),
    supabase.from("year_transitions").select("*").eq("status", "open").maybeSingle(),
    supabase.from("roster_snapshots").select("*").order("department_name").order("position_title"),
    getDirectory(),
  ]);
  const active = people.filter(p => p.status === "active");
  return (
    <>
      <Panel title="Academic years">
        <ul className="os-list">{(years ?? []).map(y => <li key={y.id}><span>{y.label}{y.is_current ? <span className="os-tag">Current</span> : null}</span><span className="os-muted">{formatDate(y.starts_on)} to {formatDate(y.ends_on)}</span></li>)}</ul>
      </Panel>
      {!open ? (
        <Panel title="Start the transition to a new year">
          <p className="os-muted">This saves the current roster and changes nothing else. You work through departures and handovers next, and the new year starts only when you finish.</p>
          <ActionForm action={startYearTransition} className="os-inline-form">
            <Field label="New year"><input name="label" required maxLength={40} placeholder="2027-28" /></Field>
            <Field label="Starts"><input name="starts_on" type="date" required /></Field>
            <Field label="Ends"><input name="ends_on" type="date" required /></Field>
            <SubmitButton>Start transition</SubmitButton>
          </ActionForm>
        </Panel>
      ) : (
        <Panel title="Transition in progress">
          <ol className="os-steps">
            <li>
              <h3>Generate handover projects</h3>
              <p className="os-muted">One for each department, private to it. Safe to run again.</p>
              <ActionForm action={generateHandovers}><Hidden name="id" value={open.id} /><SubmitButton variant="ghost">Generate</SubmitButton></ActionForm>
            </li>
            <li>
              <h3>Record departures</h3>
              <p className="os-muted">Moves unfinished work and closes the account. Returning executives stay; give them their new position after finishing.</p>
              <ActionForm action={transitionDeparture} className="os-inline-form" confirm="Close this account? They lose access immediately and their open work moves on.">
                <Hidden name="id" value={open.id} />
                <PeopleSelect name="executive" people={active} label="Departing" blank={null} required />
                <PeopleSelect name="reassign_to" people={active} label="Hand work to" blank="Their department head" />
                <SubmitButton variant="danger">Record departure</SubmitButton>
              </ActionForm>
            </li>
            <li>
              <h3>Finish</h3>
              <p className="os-muted">Makes the new year current and ends every position from the old one. Accounts stay. Assign the new roster right after this: until you do, executives without a position see no team work.</p>
              <ActionForm action={finishYearTransition} confirm="Finish the transition? Every position from the old year ends now."><Hidden name="id" value={open.id} /><SubmitButton variant="danger">Finish transition</SubmitButton></ActionForm>
            </li>
          </ol>
        </Panel>
      )}
      <Panel title="Rosters on record">
        {(years ?? []).filter(y => (snapshots ?? []).some(s => s.academic_year_id === y.id)).length === 0 ? <Empty>No rosters saved yet. One is saved each time a transition starts.</Empty> : (
          (years ?? []).filter(y => (snapshots ?? []).some(s => s.academic_year_id === y.id)).map(y => (
            <details key={y.id}>
              <summary>{y.label}</summary>
              <ul className="os-list">{(snapshots ?? []).filter(s => s.academic_year_id === y.id).map(s => <li key={s.id}><span>{s.full_name}</span><span className="os-muted">{s.department_name}: {s.position_title}</span></li>)}</ul>
            </details>
          ))
        )}
      </Panel>
    </>
  );
}
