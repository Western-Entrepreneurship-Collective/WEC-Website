-- The weekly summary task, who can write it, and the read-only team overview.
begin;
\ir helpers.psql
select plan(24);

select is((select name from os.departments where slug = 'administration'), 'Administration', 'The team is called Administration');
select is((select count(*)::int from os.departments where slug = 'presidents-office' or name ilike '%president%'), 0, 'Nothing is called the President''s Office');

-- The rule, run twice in one week.
select private.run_weekly_summary(r) from os.automation_rules r where key = 'weekly_summary';
select is(private.run_weekly_summary(r), 0, 'A second run in the same week makes nothing') from os.automation_rules r where key = 'weekly_summary';
select is((select count(*)::int from os.weekly_summaries where week_start = date_trunc('week', private.today()::timestamp)::date), 1, 'One summary a week');
select set_config('t.s', (select task_id::text from os.weekly_summaries where week_start = date_trunc('week', private.today()::timestamp)::date), false);
select is((select assigned_to from os.tasks where id = current_setting('t.s')::uuid), :'dirad'::uuid, 'It goes to the Director of Administration');
select is((select to_char(due_at at time zone 'America/Toronto', 'ID HH24:MI') from os.tasks where id = current_setting('t.s')::uuid), '7 23:59', 'Due Sunday night, Toronto time');

-- Writing it.
insert into os.projects (id, kind, owning_department_id, name, approval_status) values
  ('b0000000-0000-0000-0000-0000000000f1', 'INTERNAL', tests.dept('finance'), 'Finance Private', 'not_required');
insert into os.tasks (id, project_id, title, description, requesting_department_id, responsible_department_id, assigned_by, assigned_to, status) values
  ('c0000000-0000-0000-0000-0000000000f1', 'b0000000-0000-0000-0000-0000000000f1', 'Finance task', 'a private detail', tests.dept('finance'), tests.dept('finance'), :'vpfi', :'vpfi', 'done'),
  ('c0000000-0000-0000-0000-0000000000f2', 'b0000000-0000-0000-0000-0000000000f1', 'Withdrawn task', '', tests.dept('finance'), tests.dept('finance'), :'vpfi', :'vpfi', 'cancelled');

select tests.login(:'vpfi');
select is((select count(*)::int from os.weekly_summaries), 0, 'Another team cannot see the summary');
select throws_ok(format($$select api.save_weekly_summary(%L, 'x', 'y', 'z')$$, current_setting('t.s')), 'P0404', null, 'or write it');
select throws_ok($$select * from api.team_overview()$$, 'P0403', null, 'and a VP does not get the overview');

select tests.login(:'dirad');
select throws_ok(format($$select api.mark_weekly_summary_sent(%L)$$, current_setting('t.s')), 'P0422', null, 'A blank summary cannot be marked sent');
select lives_ok(format($$select api.save_weekly_summary(%L, 'Events', 'Teams', 'Results')$$, current_setting('t.s')), 'The person it''s assigned to can write it');
select lives_ok(format($$select api.mark_weekly_summary_sent(%L)$$, current_setting('t.s')), 'and mark it sent');
select is((select status from os.tasks where id = current_setting('t.s')::uuid), 'done', 'which finishes the task');
select throws_ok(format($$select api.save_weekly_summary(%L, 'Changed', 'Teams', 'Results')$$, current_setting('t.s')), 'P0409', null, 'A sent summary stays as it was sent');

-- The overview: names and status, and nothing that opens.
select is((select count(*)::int from api.team_overview() where project_name = 'Finance Private' and task_title = 'Finance task'), 1, 'The overview shows another team''s private task by name');
select is((select count(*)::int from api.team_overview() where task_title = 'Withdrawn task'), 0, 'but not withdrawn tasks');
select is((select count(*)::int from api.team_overview() where project_name = 'Weekly summaries'), 0, 'or the summary''s own project');
select is((select count(*)::int from os.tasks where id = 'c0000000-0000-0000-0000-0000000000f1'), 0, 'The task itself stays closed to them');
select is((select count(*)::int from os.projects where id = 'b0000000-0000-0000-0000-0000000000f1'), 0, 'and so does its project');

-- Sponsorship and Operations' event tasks.
reset role;
insert into os.events (id, name, tier, starts_at, status, submitted_by, requires_sponsorship, requires_logistics) values
  ('e0000000-0000-0000-0000-0000000000a1', 'Tier A event', 'A', now() + interval '90 days', 'approved', :'vpev', true, true),
  ('e0000000-0000-0000-0000-0000000000b1', 'Tier B event', 'B', now() + interval '90 days', 'approved', :'vpev', true, true),
  ('e0000000-0000-0000-0000-0000000000c1', 'Tier C event', 'C', now() + interval '90 days', 'approved', :'vpev', true, true);
select private.generate_event_projects(id) from os.events where id in ('e0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-0000000000c1');
select is((select t.offset_days from os.tasks t join os.projects p on p.id = t.project_id where p.event_id = 'e0000000-0000-0000-0000-0000000000c1' and t.template_task_key = 'commitments'), -7, 'Tier C commitments are confirmed a week before');
select is((select t.offset_days from os.tasks t join os.projects p on p.id = t.project_id where p.event_id = 'e0000000-0000-0000-0000-0000000000a1' and t.template_task_key = 'commitments'), -14, 'Tier A commitments are confirmed 2 weeks before');
select is((select t.offset_days from os.tasks t join os.projects p on p.id = t.project_id where p.event_id = 'e0000000-0000-0000-0000-0000000000b1' and t.template_task_key = 'commitments'), -14, 'and so are Tier B commitments');
select is((select t.offset_days from os.tasks t join os.projects p on p.id = t.project_id where p.event_id = 'e0000000-0000-0000-0000-0000000000a1' and t.template_task_key = 'materials'), -42, 'The Tier A sponsor package starts 6 weeks before');
select is((select count(*)::int from os.tasks t join os.projects p on p.id = t.project_id where p.event_id = 'e0000000-0000-0000-0000-0000000000c1' and p.owning_department_id = tests.dept('operations') and t.title = 'Help set up the event' and t.offset_days = 0), 1, 'Operations helps set up on the day');

select * from finish();
rollback;
