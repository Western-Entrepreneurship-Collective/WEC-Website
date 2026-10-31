-- WEC OS default templates and rules. Task lists come from the brief. All of this
-- is starting data: administrators edit it in /os/admin, and each save makes a new
-- version, so nothing here is treated as fixed.
--
-- Offsets: one week of Tier A's four-week run maps onto its share of Tier B's three
-- and Tier C's two. Pre-event tasks carry a share of the runway; post-event tasks
-- carry a fixed number of days after the event.

create function private.seed_task(p_key text, p_title text, p_share numeric, p_after int default null, p_depends text[] default '{}', p_priority text default 'normal', p_condition jsonb default null, p_anchor text default null)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'key', p_key, 'title', p_title, 'priority', p_priority,
    'anchor', coalesce(p_anchor, case when p_after is not null then 'event_end' else 'event_start' end),
    'offset', case when p_after is not null then jsonb_build_object('default', p_after)
      else jsonb_build_object('A', -round(28 * p_share)::int, 'B', -round(21 * p_share)::int, 'C', -round(14 * p_share)::int) end,
    'depends_on', to_jsonb(p_depends),
    'condition', p_condition
  ))
$$;

create function private.seed_template(p_key text, p_kind text, p_name text, p_dept text, p_lead text, p_activation jsonb, p_tasks jsonb, p_description text default '', p_followups jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  tid uuid;
  vid uuid;
  def jsonb := jsonb_strip_nulls(jsonb_build_object(
    'project_name', p_name, 'lead_position', p_lead, 'activation', p_activation,
    'anchor', case when p_kind = 'event_project' then 'event_start' else 'project_start' end,
    'tasks', p_tasks, 'followups', p_followups
  ));
begin
  perform private.validate_template_definition(def, p_kind);
  insert into os.templates (key, kind, name, description, department_id)
  values (p_key, p_kind, p_name, p_description, (select id from os.departments where slug = p_dept))
  returning id into tid;
  insert into os.template_versions (template_id, version, definition) values (tid, 1, def) returning id into vid;
  update os.templates set current_version_id = vid where id = tid;
end $$;

-- A plain list of titles spread evenly from a start day to an end day after the
-- project starts: for recurring and organizational work, not tied to an event.
create function private.seed_project_tasks(p_titles text[], p_step int default 7) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_agg(jsonb_build_object(
    'key', 't' || i, 'title', t, 'priority', 'normal', 'anchor', 'project_start',
    'offset', jsonb_build_object('default', (i - 1) * p_step),
    'depends_on', '[]'::jsonb
  ) order by i)
  from unnest(p_titles) with ordinality as x (t, i)
$$;

do $seed$
declare
  c_speakers jsonb := '{"field":"requires_speakers","eq":true}';
  c_members jsonb := '{"any":[{"field":"requires_registration","eq":true},{"field":"requires_member_participation","eq":true}]}';
begin
  perform private.seed_template('event-events', 'event_project', 'Event Delivery', 'events', 'VP Events', null, jsonb_build_array(
    private.seed_task('venue', 'Venue confirmation', 1.0, null, '{}', 'high'),
    private.seed_task('schedule', 'Event schedule', 0.8, null, array['venue']),
    private.seed_task('room', 'Room setup', 0.4, null, array['venue']),
    private.seed_task('av', 'Equipment and AV arrangements', 0.4, null, array['venue']),
    private.seed_task('run', 'Run-of-show', 0.25, null, array['schedule']),
    private.seed_task('readiness', 'Event readiness review', 0.1, null, array['run', 'room', 'av'], 'high'),
    private.seed_task('setup', 'Event setup', 0.0, null, array['readiness'], 'high'),
    private.seed_task('report', 'Post-event logistical report', 0, 5)
  ), 'Venue, schedule, room and run-of-show for the event itself.');

  perform private.seed_template('event-content', 'event_project', 'Content', 'content', 'VP Content', null, jsonb_build_array(
    private.seed_task('requirements', 'Collect promotional requirements', 0.9),
    private.seed_task('graphics', 'Prepare graphics', 0.7, null, array['requirements']),
    private.seed_task('copy', 'Draft promotional copy', 0.7, null, array['requirements']),
    private.seed_task('review', 'Submit content for review', 0.55, null, array['graphics', 'copy']),
    private.seed_task('announce', 'Publish event announcement', 0.45, null, array['review'], 'high'),
    private.seed_task('reminders', 'Schedule reminders', 0.3, null, array['announce']),
    private.seed_task('media', 'Capture event media', 0.0, null, '{}', 'normal', '{"field":"requires_media","eq":true}'),
    private.seed_task('recap', 'Prepare post-event recap', 0, 5)
  ), 'Promotion before the event and the recap after it.');

  perform private.seed_template('event-outreach', 'event_project', 'Outreach', 'outreach', 'VP Outreach', c_speakers, jsonb_build_array(
    private.seed_task('identify', 'Identify candidates', 1.0),
    private.seed_task('prepare', 'Prepare outreach', 0.85, null, array['identify']),
    private.seed_task('invite', 'Send invitations', 0.75, null, array['prepare'], 'high'),
    private.seed_task('followup', 'Follow up with candidates', 0.55, null, array['invite']),
    private.seed_task('confirm', 'Confirm participation', 0.4, null, array['followup'], 'high'),
    private.seed_task('bios', 'Collect biographies', 0.3, null, array['confirm']),
    private.seed_task('logistics', 'Coordinate external guest logistics', 0.15, null, array['confirm']),
    private.seed_task('thanks', 'Send thank-you communications', 0, 2)
  ), 'External speakers, mentors, judges and partners.');

  perform private.seed_template('event-community', 'event_project', 'Community', 'community', 'VP Community', c_members, jsonb_build_array(
    private.seed_task('registration', 'Create registration process', 0.8),
    private.seed_task('comms', 'Prepare member communications', 0.65, null, array['registration']),
    private.seed_task('promote', 'Promote registration', 0.5, null, array['comms']),
    private.seed_task('rsvps', 'Monitor RSVPs', 0.2, null, array['promote']),
    private.seed_task('attendance', 'Prepare attendance records', 0.1, null, array['rsvps']),
    private.seed_task('reminders', 'Send event reminders', 0.05, null, array['promote']),
    private.seed_task('feedback', 'Collect feedback', 0, 2),
    private.seed_task('summary', 'Summarize engagement', 0, 7, array['feedback'])
  ), 'Registration, attendance and member engagement.');

  perform private.seed_template('event-sponsorship', 'event_project', 'Sponsorship', 'sponsorship', 'VP Sponsorship', '{"field":"requires_sponsorship","eq":true}', jsonb_build_array(
    private.seed_task('requirements', 'Define sponsorship requirements', 1.0),
    private.seed_task('identify', 'Identify prospective sponsors', 0.9, null, array['requirements']),
    private.seed_task('materials', 'Prepare sponsorship materials', 0.8, null, array['requirements']),
    private.seed_task('outreach', 'Conduct outreach', 0.65, null, array['identify', 'materials'], 'high'),
    private.seed_task('followups', 'Track follow-ups', 0.45, null, array['outreach']),
    private.seed_task('commitments', 'Confirm commitments', 0.3, null, array['followups'], 'high'),
    private.seed_task('deliverables', 'Coordinate sponsor deliverables', 0.1, null, array['commitments']),
    private.seed_task('report', 'Prepare sponsor follow-up reports', 0, 7)
  ), 'Only when an event needs sponsorship.');

  perform private.seed_template('event-operations', 'event_project', 'Operations', 'operations', 'VP Operations', null, jsonb_build_array(
    private.seed_task('docs', 'Documentation checks', 0.8),
    private.seed_task('admin', 'Administrative requirements', 0.7),
    private.seed_task('logistics', 'Logistical coordination', 0.4, null, '{}', 'normal', '{"field":"requires_logistics","eq":true}'),
    private.seed_task('records', 'Meeting records', 0.2),
    private.seed_task('reporting', 'Event reporting', 0, 5),
    private.seed_task('archive', 'Documentation archive', 0, 10, array['reporting']),
    private.seed_task('followup', 'Organizational follow-up', 0, 12)
  ), 'Administrative requirements and the record of the event.');

  perform private.seed_template('event-finance', 'event_project', 'Finance', 'finance', 'VP Finance', '{"field":"requires_finance","eq":true}', jsonb_build_array(
    private.seed_task('budget', 'Review event budget', 0.9, null, '{}', 'high'),
    private.seed_task('funding', 'Verify funding availability', 0.8, null, array['budget']),
    private.seed_task('track', 'Track expenditures', 0.1, null, array['funding']),
    private.seed_task('reimbursements', 'Review reimbursement requests', 0, 5),
    private.seed_task('reconcile', 'Reconcile expenses', 0, 10, array['reimbursements']),
    private.seed_task('summary', 'Prepare post-event financial summary', 0, 14, array['reconcile'])
  ), 'When an event has money to manage.');

  perform private.seed_template('event-communications', 'event_project', 'Communications', 'communications', 'VP Communications', '{"field":"requires_communications","eq":true}', jsonb_build_array(
    private.seed_task('draft', 'Draft event communications', 0.75),
    private.seed_task('coordinate', 'Coordinate messaging with Content and Community', 0.65, null, array['draft']),
    private.seed_task('exec', 'Prepare executive announcements', 0.5, null, array['coordinate']),
    private.seed_task('consistency', 'Review communication consistency', 0.4, null, array['exec']),
    private.seed_task('publish', 'Publish approved communications', 0.3, null, array['consistency'], 'high')
  ), 'Formal organizational communications about the event.');

  perform private.seed_template('event-venture', 'event_project', 'Venture Development', 'venture-development', 'VP Venture Development', '{"field":"requires_founder_support","eq":true}', jsonb_build_array(
    private.seed_task('needs', 'Review founder needs', 0.9),
    private.seed_task('resources', 'Identify relevant venture resources', 0.75, null, array['needs']),
    private.seed_task('materials', 'Prepare workshop activities or development materials', 0.5, null, array['resources']),
    private.seed_task('mentors', 'Coordinate mentorship and resources with Outreach', 0.4, null, array['resources']),
    private.seed_task('compile', 'Compile useful founder resources', 0.15, null, array['materials']),
    private.seed_task('feedback', 'Collect development-oriented event feedback', 0, 3)
  ), 'Founder-focused programming support.');

  -- Global Projects
  perform private.seed_template('global-exec-recruitment', 'global', 'Executive Recruitment', null, 'President', null,
    private.seed_project_tasks(array['Confirm open positions', 'Publish applications', 'Review applications', 'Run interviews', 'Make offers', 'Onboard new executives']));
  perform private.seed_template('global-member-recruitment', 'global', 'Member Recruitment', null, 'VP Community', null,
    private.seed_project_tasks(array['Set recruitment goals', 'Prepare recruitment materials', 'Run campus outreach', 'Follow up with sign-ups', 'Report results']));
  perform private.seed_template('global-strategic-planning', 'global', 'Annual Strategic Planning', null, 'President', null,
    private.seed_project_tasks(array['Review last year', 'Collect department input', 'Draft priorities', 'Executive review', 'Publish the plan'], 10));
  perform private.seed_template('global-website', 'global', 'Website Development', null, 'VP Content', null,
    private.seed_project_tasks(array['Gather requirements', 'Plan content changes', 'Build and review', 'Publish', 'Check after launch']));
  perform private.seed_template('global-sponsorship-campaign', 'global', 'Major Sponsorship Campaign', null, 'VP Sponsorship', null,
    private.seed_project_tasks(array['Set the target', 'Build the prospect list', 'Prepare the package', 'Run outreach', 'Close commitments', 'Report results']));
  perform private.seed_template('global-exec-transition', 'global', 'Executive Transition', null, 'President', null,
    private.seed_project_tasks(array['Confirm incoming team', 'Schedule handover meetings', 'Review open work', 'Transfer accounts and access', 'Close the year']));

  -- Internal Team Projects
  perform private.seed_template('internal-content-planning', 'internal', 'Monthly Content Planning', 'content', 'VP Content', null,
    private.seed_project_tasks(array['Review last month', 'Plan the calendar', 'Assign pieces', 'Review and schedule'], 5));
  perform private.seed_template('internal-speaker-pipeline', 'internal', 'Speaker Pipeline Development', 'outreach', 'VP Outreach', null,
    private.seed_project_tasks(array['Review current pipeline', 'Research new speakers', 'Send first messages', 'Update the pipeline']));
  perform private.seed_template('internal-sponsor-prospecting', 'internal', 'Sponsor Prospecting', 'sponsorship', 'VP Sponsorship', null,
    private.seed_project_tasks(array['Build the prospect list', 'Qualify prospects', 'Assign outreach', 'Review responses']));
  perform private.seed_template('internal-community-engagement', 'internal', 'Community Engagement Initiative', 'community', 'VP Community', null,
    private.seed_project_tasks(array['Choose the initiative', 'Plan activities', 'Run it', 'Review participation']));
  perform private.seed_template('internal-financial-reporting', 'internal', 'Financial Reporting', 'finance', 'VP Finance', null,
    private.seed_project_tasks(array['Collect receipts', 'Reconcile accounts', 'Draft the report', 'Present to the President'], 5));
  perform private.seed_template('internal-sop-review', 'internal', 'Department SOP Review', 'operations', 'VP Operations', null,
    private.seed_project_tasks(array['List current SOPs', 'Mark what is out of date', 'Draft revisions', 'Submit for approval']));
  perform private.seed_template('internal-department-handover', 'internal', 'Department Handover', 'presidents-office', null, null,
    private.seed_project_tasks(array['List everything still open', 'Update SOPs and passwords held by this team', 'Write the handover note', 'Meet your successor', 'Confirm access has moved'], 5),
    'Generated for every department during the academic-year transition.');
end $seed$;

drop function private.seed_task(text, text, numeric, int, text[], text, jsonb, text);
drop function private.seed_template(text, text, text, text, text, jsonb, jsonb, text, jsonb);
drop function private.seed_project_tasks(text[], int);

-- ─── Rules ─────────────────────────────────────────────────────────────────
insert into os.automation_rules (key, category, name, description, schedule, config, enabled) values
  ('deadline_upcoming', 'deadline', 'Upcoming deadline reminders', 'Reminds the assignee ahead of a due date.', '{}', '{"days":[7,2,1]}', true),
  ('deadline_overdue', 'deadline', 'Overdue task alerts', 'Tells the assignee when overdue and weekly after, and the department head after a few days.', '{}', '{"escalate_days":3}', true),
  ('blocked_escalation', 'deadline', 'Blocked-task escalation', 'Tells the head, then the President, about work blocked too long.', '{}', '{"days":3,"president_days":7}', true),
  ('project_deadline', 'deadline', 'Project deadline warnings', 'Warns the project lead as the due date nears.', '{}', '{"days":7}', true),
  ('approval_pending', 'deadline', 'Pending approval reminders', 'Reminds the President about proposals still waiting.', '{}', '{"days":3}', true),
  ('sop_review', 'deadline', 'SOP review reminders', 'Reminds the responsible executive as a review date nears.', '{}', '{"days":14}', true),
  ('auto_archive', 'deadline', 'Archive completed work', 'Archives completed projects and events after this many days. Off until an administrator enables it.', '{}', '{"days":90}', false),
  ('weekly_ops_review', 'recurring', 'Weekly operational review', 'Weekly check of open logistics and administration.', '{"freq":"weekly","weekday":1}', '{"department":"operations","title":"Weekly operational review","due_days":4}', true),
  ('monthly_content_planning', 'recurring', 'Monthly content planning', 'Plan the coming month''s content.', '{"freq":"monthly","day":1}', '{"department":"content","title":"Monthly content planning","due_days":7}', true),
  ('outreach_followup_review', 'recurring', 'Outreach follow-up review', 'Review outstanding outreach follow-ups.', '{"freq":"weekly","weekday":1}', '{"department":"outreach","title":"Outreach follow-up review","due_days":4}', true),
  ('sponsorship_pipeline_review', 'recurring', 'Sponsorship pipeline review', 'Review the sponsor pipeline.', '{"freq":"monthly","day":1}', '{"department":"sponsorship","title":"Sponsorship pipeline review","due_days":7}', true),
  ('community_engagement_review', 'recurring', 'Community engagement review', 'Review member engagement.', '{"freq":"monthly","day":1}', '{"department":"community","title":"Community engagement review","due_days":7}', true),
  ('monthly_finance_report', 'recurring', 'Monthly finance reporting', 'Prepare the monthly finance report.', '{"freq":"monthly","day":1}', '{"department":"finance","title":"Monthly finance report","due_days":10}', true),
  ('exec_meeting_agenda', 'recurring', 'Executive meeting agenda', 'Prepare the executive meeting agenda.', '{"freq":"weekly","weekday":1}', '{"department":"presidents-office","title":"Prepare executive meeting agenda","due_days":3}', true),
  ('end_of_semester_report', 'recurring', 'End-of-semester reporting', 'Summarize the semester.', '{"freq":"yearly","months":[12,4],"day":1}', '{"department":"presidents-office","title":"End-of-semester report","due_days":21}', true),
  ('annual_transition', 'recurring', 'Annual executive transition', 'Start preparing the executive transition.', '{"freq":"yearly","months":[3],"day":1}', '{"department":"presidents-office","title":"Begin annual executive transition","due_days":30,"priority":"high"}', true);
