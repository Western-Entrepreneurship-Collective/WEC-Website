-- Deliverables: what event tasks hand in, who sees it, and the overview that opens
-- every team's work without letting anyone change it.
begin;
\ir helpers.psql
select plan(30);

-- An approved event with guests: Events, Content and Outreach get projects. Finance doesn't.
select tests.login(:'vpev');
select set_config('t.e', api.save_event(null, jsonb_build_object('name','Pitch night','tier','B','starts_at',(now() + interval '60 days')::text,'requires_speakers',true), array[:'vpev'::uuid], '{}')::text, true);
select api.submit_event(current_setting('t.e')::uuid);
select tests.login(:'pres');
select api.decide_event(current_setting('t.e')::uuid, 'approved');

reset role;
create function tests.event_task(k text) returns uuid language sql stable security definer set search_path = '' as $$
  select t.id from os.tasks t join os.projects p on p.id = t.project_id
  where p.event_id = current_setting('t.e')::uuid and t.template_task_key = k
$$;
grant execute on function tests.event_task(text) to authenticated;
select set_config('t.venue', tests.event_task('venue')::text, true);
select set_config('t.bios', tests.event_task('bios')::text, true);

select is((select kind from os.task_deliverables where task_id = current_setting('t.venue')::uuid), 'text', 'Booking the venue asks for a written answer');
select is((select kind from os.task_deliverables where task_id = current_setting('t.bios')::uuid), 'document', 'Guest bios ask for a file or a link');
select is((select count(*)::int from os.task_deliverables where task_id = tests.event_task('graphics')), 0, 'Content''s tasks hand nothing in');
select is((select count(*)::int from os.task_deliverables where task_id = tests.event_task('invite')), 0, 'and neither does sending invitations');

-- Handing in, and what done waits for.
select tests.login(:'vpev');
select throws_ok(format($$select api.set_task_status(%L, 'done')$$, current_setting('t.venue')), 'P0409', null, 'A task can''t be done before its deliverable is handed in');
select throws_ok(format($$select api.hand_in_deliverable(%L, null, '   ')$$, current_setting('t.venue')), 'P0422', null, 'A blank answer isn''t handed in');
select lives_ok(format($$select api.hand_in_deliverable(%L, null, 'Room 2230, Ivey. 80 seats. Booking 4471.')$$, current_setting('t.venue')), 'The person doing the task hands it in');
select is((select submitted_by from os.task_deliverables where task_id = current_setting('t.venue')::uuid), :'vpev'::uuid, 'and it records who did');
select lives_ok(format($$select api.set_task_status(%L, 'done')$$, current_setting('t.venue')), 'Then the task can be done');

select tests.login(:'vpou');
select throws_ok(format($$select api.hand_in_deliverable(%L, 'drive.google.com/bios')$$, current_setting('t.bios')), 'P0422', null, 'A link needs https://');
reset role;
insert into os.attachments (id, entity_type, entity_id, storage_path, file_name, content_type, size_bytes, uploaded_by, confirmed_at) values
  ('f0000000-0000-0000-0000-0000000000d1', 'task', current_setting('t.venue')::uuid, 'task/x/d1/plan.pdf', 'plan.pdf', 'application/pdf', 10, :'vpev', now()),
  ('f0000000-0000-0000-0000-0000000000d2', 'task', current_setting('t.bios')::uuid, 'task/x/d2/bios.pdf', 'bios.pdf', 'application/pdf', 10, :'vpou', now());
select tests.login(:'vpou');
select throws_ok(format($$select api.hand_in_deliverable(%L, null, null, 'f0000000-0000-0000-0000-0000000000d1')$$, current_setting('t.bios')), 'P0422', null, 'A file from another task can''t be handed in');
select lives_ok(format($$select api.hand_in_deliverable(%L, null, null, 'f0000000-0000-0000-0000-0000000000d2')$$, current_setting('t.bios')), 'A file from the task can');

-- Who sees it.
select tests.login(:'dirco');
select is((select body from os.task_deliverables where task_id = current_setting('t.venue')::uuid), 'Room 2230, Ivey. 80 seats. Booking 4471.', 'Another team on the event sees what was handed in');
select is((select count(*)::int from api.event_deliverables(current_setting('t.e')::uuid) where submitted_at is not null), 2, 'and the event lists both hand-ins');
select is((select count(*)::int from os.tasks where id = current_setting('t.venue')::uuid), 0, 'but the task itself stays with Events');
select is((select count(*)::int from api.attachment_path('f0000000-0000-0000-0000-0000000000d2')), 1, 'They can open a handed-in file');
select is((select count(*)::int from api.attachment_path('f0000000-0000-0000-0000-0000000000d1')), 0, 'but not the task''s other files');
select throws_ok(format($$select api.hand_in_deliverable(%L, 'https://example.com')$$, current_setting('t.bios')), 'P0404', null, 'and they can''t hand in another team''s deliverable');

select tests.login(:'vpfi');
select is((select count(*)::int from os.task_deliverables where task_id = current_setting('t.venue')::uuid), 0, 'A team not on the event sees nothing');
select is((select count(*)::int from api.event_deliverables(current_setting('t.e')::uuid)), 0, 'not even on the event page');

-- The overview: the President has it, and it opens what it lists, to read only.
select tests.login(:'pres');
select ok((select count(*) > 0 from api.team_overview()), 'The President has the team overview');

reset role;
insert into os.projects (id, kind, owning_department_id, name, approval_status) values
  ('b0000000-0000-0000-0000-0000000000d1', 'INTERNAL', tests.dept('finance'), 'Finance Private', 'not_required');
insert into os.tasks (id, project_id, title, requesting_department_id, responsible_department_id, assigned_by, assigned_to, status, visibility) values
  ('c0000000-0000-0000-0000-0000000000d1', 'b0000000-0000-0000-0000-0000000000d1', 'Open finance task', tests.dept('finance'), tests.dept('finance'), :'vpfi', :'vpfi', 'todo', 'project'),
  ('c0000000-0000-0000-0000-0000000000d2', 'b0000000-0000-0000-0000-0000000000d1', 'Restricted finance task', tests.dept('finance'), tests.dept('finance'), :'vpfi', :'vpfi', 'todo', 'restricted');

select tests.login(:'dirad');
select is((select count(*)::int from os.projects where id = 'b0000000-0000-0000-0000-0000000000d1'), 1, 'Someone with the overview can open another team''s private project');
select is((select count(*)::int from os.tasks where id = 'c0000000-0000-0000-0000-0000000000d1'), 1, 'and its tasks');
select is((select count(*)::int from os.tasks where id = 'c0000000-0000-0000-0000-0000000000d2'), 0, 'but not a restricted one');
select is((select can_take_part from api.task_context('c0000000-0000-0000-0000-0000000000d1')), false, 'The task page knows they''re only looking');
select throws_ok($$select api.add_comment('c0000000-0000-0000-0000-0000000000d1', 'Looks good')$$, 'P0404', null, 'They can''t comment');
select throws_ok($$select api.set_task_status('c0000000-0000-0000-0000-0000000000d1', 'done')$$, 'P0404', null, 'or change its status');
select is((select deliverable_submitted_at is not null from api.team_overview() where task_id = current_setting('t.venue')::uuid), true, 'The overview shows a deliverable as handed in');
select is((select deliverable_submitted_at is null from api.team_overview() where task_id = tests.event_task('confirm')), true, 'and one that''s still waiting');

select tests.login(:'pres');
select is((select count(*)::int from api.team_overview() where task_id = 'c0000000-0000-0000-0000-0000000000d2'), 1, 'The President''s overview includes restricted tasks');

select * from finish();
rollback;
