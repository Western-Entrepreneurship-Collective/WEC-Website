-- Persona × resource. Fixture is written as the database owner, then each persona
-- looks at the same data, including by asking for specific IDs.
begin;
\ir helpers.psql
select plan(58);

insert into os.events (id, name, tier, starts_at, status, submitted_by) values
  ('e0000000-0000-0000-0000-000000000001', 'Approved Lab', 'B', now() + interval '30 days', 'approved', :'vpev'),
  ('e0000000-0000-0000-0000-000000000002', 'Secret Proposal', 'A', now() + interval '60 days', 'submitted', :'vpev');
insert into os.event_leads values ('e0000000-0000-0000-0000-000000000001', :'vpev');

insert into os.projects (id, kind, event_id, owning_department_id, name, summary, approval_status, submitted_by, due_on) values
  ('b0000000-0000-0000-0000-000000000001', 'EVENT', 'e0000000-0000-0000-0000-000000000001', tests.dept('content'), 'Event Content', 'event content summary', 'not_required', null, current_date + 20),
  ('b0000000-0000-0000-0000-000000000002', 'INTERNAL', null, tests.dept('finance'), 'Finance Private', 'fin secret', 'not_required', null, current_date + 20),
  ('b0000000-0000-0000-0000-000000000003', 'INTERNAL', 'e0000000-0000-0000-0000-000000000001', tests.dept('content'), 'Linked Internal', 'linked secret', 'not_required', null, current_date + 20),
  ('b0000000-0000-0000-0000-000000000004', 'GLOBAL', null, tests.dept('outreach'), 'Approved Global', 'global detail', 'approved', :'vpou', current_date + 20),
  ('b0000000-0000-0000-0000-000000000005', 'GLOBAL', null, tests.dept('outreach'), 'Pending Global', 'pending detail', 'pending', :'vpou', current_date + 20),
  ('b0000000-0000-0000-0000-000000000006', 'INTERNAL', 'e0000000-0000-0000-0000-000000000001', tests.dept('finance'), 'Shared Internal', 'shared secret', 'not_required', null, current_date + 20);
update os.projects set share_progress_with_event_lead = true where id = 'b0000000-0000-0000-0000-000000000006';

insert into os.tasks (id, project_id, title, assigned_by, assigned_to, requesting_department_id, responsible_department_id, visibility, due_at) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'Finance team task', :'vpfi', :'dirfi', tests.dept('finance'), tests.dept('finance'), 'team', now() + interval '3 days'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Finance restricted', :'vpfi', :'vpfi', tests.dept('finance'), tests.dept('finance'), 'restricted', now() + interval '3 days'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 'Linked internal task', :'vpco', :'dirco', tests.dept('content'), tests.dept('content'), 'project', now() + interval '3 days'),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', 'Global task', :'vpou', :'cdou', tests.dept('outreach'), tests.dept('outreach'), 'team', now() + interval '3 days'),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000006', 'Shared internal task', :'vpfi', :'dirfi', tests.dept('finance'), tests.dept('finance'), 'project', now() + interval '3 days');
-- Finance asks Content for something, from Finance's private project.
insert into os.tasks (id, project_id, title, assigned_by, requesting_department_id, responsible_department_id, status, is_cross_team, request_state, requires_review, created_by, due_at) values
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'Cross request', :'vpfi', tests.dept('finance'), tests.dept('content'), 'unassigned', true, 'pending', true, :'vpfi', now() + interval '3 days');

-- ─── President: sees all of it ─────────────────────────────────────────────
select tests.login(:'pres');
select is((select count(*)::int from os.projects), 6, 'President sees every project');
select is((select count(*)::int from os.tasks), 6, 'President sees every task, restricted ones included');
select is((select count(*)::int from os.events), 2, 'President sees proposals too');
select is((api.me()->>'is_admin')::boolean, false, 'President is not an administrator by position');
select is((select count(*)::int from os.audit_log), 0, 'President reads no audit log');
select is((select count(*)::int from os.settings), 0, 'President reads no system settings');

-- ─── VP Finance: own team only ─────────────────────────────────────────────
select tests.login(:'vpfi');
select is((select count(*)::int from os.projects where id = 'b0000000-0000-0000-0000-000000000002'), 1, 'VP Finance sees own internal project');
select is((select count(*)::int from os.projects where id = 'b0000000-0000-0000-0000-000000000003'), 0, 'VP Finance does not see Content''s internal project, even linked to an event');
select is((select count(*)::int from os.tasks where id = 'c0000000-0000-0000-0000-000000000002'), 1, 'VP sees a restricted task in own department');
select is((select count(*)::int from os.tasks where id = 'c0000000-0000-0000-0000-000000000003'), 0, 'VP Finance cannot fetch Content''s task by ID');
select is((select count(*)::int from os.tasks where id = 'c0000000-0000-0000-0000-000000000005'), 1, 'requester sees the cross-team task');
select is((select count(*)::int from os.events where id = 'e0000000-0000-0000-0000-000000000002'), 0, 'VP Finance does not see an unapproved proposal');
select is((select count(*)::int from os.events where id = 'e0000000-0000-0000-0000-000000000001'), 1, 'approved events are visible to every executive');

-- ─── Director of Finance: restrictions ─────────────────────────────────────
select tests.login(:'dirfi');
select is((select count(*)::int from os.projects where id = 'b0000000-0000-0000-0000-000000000002'), 1, 'Director sees own department project');
select is((select count(*)::int from os.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 1, 'Director sees a team task');
select is((select count(*)::int from os.tasks where id = 'c0000000-0000-0000-0000-000000000002'), 0, 'Director does not see a restricted task they are not on');

-- ─── VP Content: receiver of the cross-team request ────────────────────────
select tests.login(:'vpco');
select is((select count(*)::int from os.tasks where id = 'c0000000-0000-0000-0000-000000000005'), 1, 'receiving VP sees the request');
select is((select count(*)::int from os.projects where id = 'b0000000-0000-0000-0000-000000000002'), 0, 'receiving VP cannot read the originating project');
select is((select count(*)::int from os.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 0, 'receiving VP cannot read a sibling task in that project');
select is((select count(*)::int from os.tasks where id = 'c0000000-0000-0000-0000-000000000002'), 0, 'nor a restricted sibling');
select is((select project_name from api.task_context('c0000000-0000-0000-0000-000000000005')), 'Finance Private', 'receiver gets the originating project''s name through the projection');
select is((select can_open_project from api.task_context('c0000000-0000-0000-0000-000000000005')), false, 'and is told they cannot open it');
select is((select count(*)::int from api.task_context('c0000000-0000-0000-0000-000000000001')), 0, 'task_context reveals nothing about a task they cannot read');

-- ─── Director of Content: pending request stays in the VP's queue ──────────
select tests.login(:'dirco');
select is((select count(*)::int from os.tasks where id = 'c0000000-0000-0000-0000-000000000005'), 0, 'a Director does not see a request until it is accepted');
select is((select count(*)::int from os.projects where id = 'b0000000-0000-0000-0000-000000000003'), 1, 'Director sees own linked internal project');
select is((select count(*)::int from os.projects where id = 'b0000000-0000-0000-0000-000000000001'), 1, 'Director sees own department''s Event Project');
reset role;
update os.tasks set request_state = 'accepted', assigned_to = :'dirco', status = 'todo' where id = 'c0000000-0000-0000-0000-000000000005';
select tests.login(:'dirco');
select is((select count(*)::int from os.tasks where id = 'c0000000-0000-0000-0000-000000000005'), 1, 'after acceptance the team sees it');
select is((select count(*)::int from os.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 0, 'still no sibling tasks');

-- ─── Global Projects: summary for all, tasks by authorization ──────────────
select tests.login(:'cdou');
select is((select count(*)::int from os.projects where id = 'b0000000-0000-0000-0000-000000000004'), 1, 'owning department reads the approved Global Project');
select tests.login(:'dirfi');
select is((select count(*)::int from os.projects where id = 'b0000000-0000-0000-0000-000000000004'), 0, 'another department has no row-level access to a Global Project');
select is((select count(*)::int from api.project_summaries('GLOBAL') where id = 'b0000000-0000-0000-0000-000000000004'), 1, 'but sees it at summary level');
select is((select count(*)::int from api.project_summaries('GLOBAL') where id = 'b0000000-0000-0000-0000-000000000005'), 0, 'a pending Global Project is not listed');
select is((select count(*)::int from os.tasks where id = 'c0000000-0000-0000-0000-000000000004'), 0, 'Global Project task details are not visible');
select tests.login(:'vpou');
select is((select count(*)::int from os.projects where id = 'b0000000-0000-0000-0000-000000000005'), 1, 'submitter sees their own pending Global Project');
select tests.login(:'vpco');
select is((select count(*)::int from os.projects where id = 'b0000000-0000-0000-0000-000000000005'), 0, 'another VP does not');

-- ─── Shared progress: name and percent, never tasks ────────────────────────
select tests.login(:'vpev');
select is((select count(*)::int from os.projects where id = 'b0000000-0000-0000-0000-000000000006'), 0, 'event lead has no row access to a shared internal project');
select is((select count(*)::int from api.project_summaries() where id = 'b0000000-0000-0000-0000-000000000006'), 1, 'but sees its summary when sharing is on');
select is((select can_open from api.project_summaries() where id = 'b0000000-0000-0000-0000-000000000006'), false, 'and cannot open it');
select is((select count(*)::int from os.tasks where id = 'c0000000-0000-0000-0000-000000000006'), 0, 'and cannot see its tasks');
select is((select count(*)::int from api.project_summaries() where id = 'b0000000-0000-0000-0000-000000000003'), 0, 'an unshared linked internal project is not visible to the event lead at all');
select tests.login(:'cdou');
select is((select count(*)::int from api.project_summaries() where id = 'b0000000-0000-0000-0000-000000000006'), 0, 'nobody else sees that shared summary');

-- ─── The event's team-by-team view follows the same rules ──────────────────
reset role;
insert into os.tasks (id, project_id, title, assigned_by, assigned_to, requesting_department_id, responsible_department_id, visibility, due_at) values
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'Secret next step', :'vpco', :'vpco', tests.dept('content'), tests.dept('content'), 'restricted', now() + interval '1 day');
select tests.login(:'vpev');
select is((select count(*)::int from api.event_team_progress('e0000000-0000-0000-0000-000000000001')), 1, 'the event lead sees each team''s row');
select is((select next_title from api.event_team_progress('e0000000-0000-0000-0000-000000000001') limit 1), null, 'but not the title of a task they cannot read');
select tests.login(:'dirfi');
select is((select count(*)::int from api.event_team_progress('e0000000-0000-0000-0000-000000000001')), 0, 'someone outside the project sees no row');
select throws_ok($$select api.mark_onboarding('anything')$$, 'P0422', null, 'onboarding steps are a fixed list');

-- ─── System Administrator alone: schedule, not content ─────────────────────
select tests.login(:'adm');
select is((api.me()->>'is_admin')::boolean, true, 'admin is an administrator');
select is((api.me()->>'is_president')::boolean, false, 'and is not the President');
select is((select count(*)::int from os.tasks), 0, 'admin role reads no tasks');
select is((select count(*)::int from os.projects where kind = 'INTERNAL'), 0, 'admin role reads no internal project rows');
select is((select count(*)::int from api.project_summaries('INTERNAL') where name = 'Finance Private'), 1, 'admin sees the schedule line for it');
select is((select count(*)::int from api.calendar_items(now(), now() + interval '60 days', 'org') where item_type = 'task'), 0, 'org calendar shows the admin no tasks');
select cmp_ok((select count(*)::int from os.settings), '>', 0, 'admin reads settings');

-- ─── Deactivated: a valid token gets nothing, immediately ──────────────────
select tests.login(:'frm');
select is((select count(*)::int from os.events), 0, 'deactivated: no events');
select is((select count(*)::int from os.departments), 0, 'deactivated: no departments');
select is((select count(*)::int from os.executives where id <> :'frm'), 0, 'deactivated: no directory');
select is((select count(*)::int from api.project_summaries()), 0, 'deactivated: no summaries');
select is((select count(*)::int from api.calendar_items(now(), now() + interval '60 days', 'core')), 0, 'deactivated: no calendar');
select throws_ok($$select api.add_comment('c0000000-0000-0000-0000-000000000001', 'hello')$$, 'P0401', null, 'deactivated: writes are refused');

select * from finish();
rollback;
