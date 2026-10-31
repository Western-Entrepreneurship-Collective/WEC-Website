-- Event → Projects → Tasks, atomic generation, duplicate prevention, dates, reminders.
begin;
\ir helpers.psql
select plan(38);

-- ─── Proposal authorization ────────────────────────────────────────────────
select tests.login(:'vpco');
select throws_ok($$select api.save_event(null, '{"name":"x","tier":"B","starts_at":"2027-03-01T18:00:00Z"}'::jsonb, '{}', '{}')$$, 'P0403', null, 'only VP Events submits proposals');
select tests.login(:'vpev');
select set_config('t.e', api.save_event(null, jsonb_build_object('name','Founder Lab','tier','B','starts_at',(now() + interval '60 days')::text,'requires_speakers',true,'requires_registration',true,'requires_media',true), array[:'vpev'::uuid], '{}')::text, true);
select api.submit_event(current_setting('t.e')::uuid);
select tests.login(:'pres');
select is((select count(*)::int from api.my_notifications() where entity_id = current_setting('t.e')::uuid), 1, 'the President is told about the proposal');
select tests.login(:'vpev');
select throws_ok($$select api.decide_event(current_setting('t.e')::uuid, 'approved')$$, 'P0403', null, 'VP Events cannot approve');
select tests.login(:'adm');
select throws_ok($$select api.decide_event(current_setting('t.e')::uuid, 'approved')$$, 'P0403', null, 'an administrator cannot approve');
select tests.login(:'dirfi');
select throws_ok($$select api.decide_event(current_setting('t.e')::uuid, 'approved')$$, 'P0403', null, 'a Director cannot approve');
select is((select count(*)::int from api.calendar_items(now(), now() + interval '90 days', 'core') where item_id = current_setting('t.e')::uuid), 0, 'not on the Core Calendar before approval');

-- ─── Atomicity: a bad template leaves nothing behind ───────────────────────
reset role;
create temporary table t_saved as select id, current_version_id from os.templates where key = 'event-finance';
insert into os.template_versions (id, template_id, version, definition)
select 'f0000000-0000-0000-0000-000000000001', id, 99,
  '{"project_name":"Broken","anchor":"event_start","tasks":[{"key":"a","title":"Bad priority","priority":"nonsense","offset":{"default":-1}}]}'::jsonb
from os.templates where key = 'event-content';
update os.templates set current_version_id = 'f0000000-0000-0000-0000-000000000001' where key = 'event-content';
select tests.login(:'pres');
select throws_ok($$select api.decide_event(current_setting('t.e')::uuid, 'approved')$$, '23514', null, 'a broken template fails the approval');
select is((select status from os.events where id = current_setting('t.e')::uuid), 'submitted', 'the event stays submitted');
select is((select count(*)::int from os.projects where event_id = current_setting('t.e')::uuid), 0, 'and no project exists, half made or otherwise');
reset role;
update os.templates set current_version_id = (select id from os.template_versions v where v.template_id = os.templates.id and v.version = 1) where key = 'event-content';
delete from os.notifications where entity_id = current_setting('t.e')::uuid and kind <> 'event.proposed';

-- ─── Generation ────────────────────────────────────────────────────────────
select tests.login(:'pres');
select is(api.decide_event(current_setting('t.e')::uuid, 'approved', 'Go'), 5, 'approval generates five projects for this event');
select is((select count(*)::int from api.calendar_items(now(), now() + interval '90 days', 'core') where item_id = current_setting('t.e')::uuid), 1, 'on the Core Calendar now');
select bag_eq(
  $$select d.slug from os.projects p join os.departments d on d.id = p.owning_department_id where p.event_id = current_setting('t.e')::uuid$$,
  array['events', 'content', 'operations', 'outreach', 'community'],
  'exactly the departments this event calls for, and none of sponsorship, finance, communications or venture'
);
select is((select count(*)::int from os.tasks t join os.projects p on p.id = t.project_id join os.departments d on d.id = p.owning_department_id where p.event_id = current_setting('t.e')::uuid and d.slug = 'content'), 8, 'the Content project has its tasks, the media one included');
select is((select count(*)::int from os.tasks t join os.projects p on p.id = t.project_id join os.departments d on d.id = p.owning_department_id where p.event_id = current_setting('t.e')::uuid and d.slug = 'operations' and t.template_task_key = 'logistics'), 0, 'a task whose condition is false is left out');
select isnt((select template_version_id from os.projects where event_id = current_setting('t.e')::uuid limit 1), null, 'each project records its template version');
select is((select count(*)::int from os.task_dependencies d join os.tasks t on t.id = d.task_id join os.projects p on p.id = t.project_id where p.event_id = current_setting('t.e')::uuid and t.template_task_key = 'run'), 1, 'template dependencies are wired up');
select is((select t.status from os.tasks t join os.projects p on p.id = t.project_id where p.event_id = current_setting('t.e')::uuid and t.template_task_key = 'run' limit 1), 'blocked', 'and a task waiting on one starts blocked');
select is((select assigned_to from os.tasks t join os.projects p on p.id = t.project_id join os.departments d on d.id = p.owning_department_id where p.event_id = current_setting('t.e')::uuid and d.slug = 'content' limit 1), :'vpco'::uuid, 'generated tasks go to the department''s VP');
select is((select t.status from os.tasks t join os.projects p on p.id = t.project_id join os.departments d on d.id = p.owning_department_id where p.event_id = current_setting('t.e')::uuid and d.slug = 'community' and t.template_task_key = 'registration' limit 1), 'unassigned', 'and stay visibly unassigned when the seat is vacant');
select tests.login(:'vpco');
select cmp_ok((select count(*)::int from api.my_notifications() where kind = 'project.generated'), '>=', 1, 'the receiving VP is notified');
select tests.login(:'pres');
select throws_ok($$select api.decide_event(current_setting('t.e')::uuid, 'approved')$$, 'P0409', null, 'approving twice is refused');

reset role;
select lives_ok($$select private.generate_event_projects(current_setting('t.e')::uuid)$$, 'running generation again directly does not fail');
select is((select count(*)::int from os.projects where event_id = current_setting('t.e')::uuid), 5, 'and makes no duplicate projects');

-- ─── Tier offsets and clamping ─────────────────────────────────────────────
select is((select extract(day from e.starts_at - t.due_at)::int from os.tasks t join os.projects p on p.id = t.project_id join os.events e on e.id = p.event_id where p.event_id = current_setting('t.e')::uuid and t.template_task_key = 'venue' limit 1), 21, 'Tier B venue confirmation lands 21 days out');
insert into os.events (id, name, tier, starts_at, status) values ('e3000000-0000-0000-0000-000000000001', 'Tomorrow', 'A', now() + interval '1 day', 'approved');
select private.generate_event_projects('e3000000-0000-0000-0000-000000000001');
select ok((select bool_and(t.due_at >= now()) and bool_or(t.due_was_clamped) from os.tasks t join os.projects p on p.id = t.project_id where p.event_id = 'e3000000-0000-0000-0000-000000000001'), 'no date lands in the past, and clamped ones are flagged');

-- ─── Rescheduling leaves manual dates alone ────────────────────────────────
select tests.login(:'vpco');
select set_config('t.mt', (select t.id from os.tasks t join os.projects p on p.id = t.project_id join os.departments d on d.id = p.owning_department_id where p.event_id = current_setting('t.e')::uuid and d.slug = 'content' and t.template_task_key = 'requirements')::text, true);
select set_config('t.tt', (select t.id from os.tasks t join os.projects p on p.id = t.project_id join os.departments d on d.id = p.owning_department_id where p.event_id = current_setting('t.e')::uuid and d.slug = 'content' and t.template_task_key = 'graphics')::text, true);
select api.update_task(current_setting('t.mt')::uuid, jsonb_build_object('title', 'Collect promotional requirements', 'due_at', '2027-06-01T12:00:00Z'));
select set_config('t.before', (select due_at::text from os.tasks where id = current_setting('t.tt')::uuid), true);
select tests.login(:'vpev');
select cmp_ok(api.reschedule_event(current_setting('t.e')::uuid, now() + interval '75 days', null), '>', 0, 'rescheduling moves template dates');
reset role;
select is((select due_at from os.tasks where id = current_setting('t.mt')::uuid), '2027-06-01T12:00:00Z'::timestamptz, 'a hand-set date is protected');
select is((select extract(day from due_at - current_setting('t.before')::timestamptz)::int from os.tasks where id = current_setting('t.tt')::uuid), 15, 'a template date moved by the same 15 days');
select cmp_ok((select count(*)::int from os.notifications where kind = 'task.deadline_changed' and entity_id = current_setting('t.tt')::uuid), '>=', 1, 'participants hear about the move');

-- ─── The sweep: twice over, one result ─────────────────────────────────────
select private.run_sweep();
select set_config('t.n1', (select count(*)::text from os.notifications), true);
select set_config('t.t1', (select count(*)::text from os.tasks), true);
select set_config('t.r1', (select count(*)::text from os.automation_runs), true);
select private.run_sweep();
select is((select count(*)::text from os.notifications), current_setting('t.n1'), 'a second sweep sends no second notification');
select is((select count(*)::text from os.tasks), current_setting('t.t1'), 'and makes no second recurring task');
select is((select count(*)::text from os.automation_runs), current_setting('t.r1'), 'and logs no second run');
select isnt((select value from os.settings where key = 'sweep_heartbeat'), 'null'::jsonb, 'the heartbeat is written');

-- ─── Job failure, retry, and loop stop ─────────────────────────────────────
insert into os.jobs (id, kind, max_attempts) values ('d0000000-0000-0000-0000-000000000001', 'no.such.kind', 2);
select private.process_jobs();
select is((select state from os.jobs where id = 'd0000000-0000-0000-0000-000000000001'), 'failed', 'a failing job is marked for retry');
update os.jobs set next_run_at = now() where id = 'd0000000-0000-0000-0000-000000000001';
select private.process_jobs();
select is((select state from os.jobs where id = 'd0000000-0000-0000-0000-000000000001'), 'dead', 'and goes dead after its attempts, visible to admins');
insert into os.jobs (id, kind, depth) values ('d0000000-0000-0000-0000-000000000002', 'project.completed', 4);
select private.process_jobs();
select matches((select last_error from os.jobs where id = 'd0000000-0000-0000-0000-000000000002'), 'chain', 'an automation chain past the depth limit stops with a record');

-- ─── Template validation and versions ──────────────────────────────────────
select tests.login(:'adm');
select throws_ok($$select api.save_template(null, 'bad', 'internal', 'Bad', '', tests.dept('content'), '{"anchor":"project_start","tasks":[{"key":"a","title":"A","depends_on":["b"]},{"key":"b","title":"B","depends_on":["a"]}]}'::jsonb)$$, 'P0422', null, 'circular template dependencies are refused on save');
select tests.login(:'vpco');
select throws_ok($$select api.save_template(null, 'bad', 'internal', 'Bad', '', tests.dept('content'), '{"anchor":"project_start","tasks":[]}'::jsonb)$$, 'P0404', null, 'a VP cannot edit templates');

select * from finish();
rollback;
