-- Project relationships, task rules, and the cross-team workflow end to end.
begin;
\ir helpers.psql
select plan(48);

-- ─── Constraints from the brief ────────────────────────────────────────────
select throws_ok($$insert into os.projects (kind, owning_department_id, name) values ('EVENT', tests.dept('content'), 'No event')$$, '23514', null, 'an EVENT project requires an event');
insert into os.events (id, name, tier, starts_at, status) values ('e1000000-0000-0000-0000-000000000001', 'Ev', 'B', now() + interval '40 days', 'approved');
select throws_ok($$insert into os.projects (kind, event_id, name) values ('GLOBAL', 'e1000000-0000-0000-0000-000000000001', 'Bad')$$, '23514', null, 'a GLOBAL project cannot reference an event');
select lives_ok($$insert into os.projects (id, kind, event_id, owning_department_id, name) values ('b1000000-0000-0000-0000-000000000001', 'INTERNAL', 'e1000000-0000-0000-0000-000000000001', tests.dept('content'), 'Linked')$$, 'an INTERNAL project may reference an event');
select lives_ok($$insert into os.projects (id, kind, owning_department_id, name) values ('b1000000-0000-0000-0000-000000000002', 'INTERNAL', tests.dept('finance'), 'Fin')$$, 'and may not');
select throws_ok($$insert into os.projects (kind, owning_department_id, name, visibility) values ('INTERNAL', tests.dept('content'), 'Open', 'organization')$$, '23514', null, 'an INTERNAL project cannot be opened to the organization');
select throws_ok($$insert into os.tasks (title, assigned_by, requesting_department_id, responsible_department_id) values ('Loose', 'a0000000-0000-0000-0000-000000000001', tests.dept('content'), tests.dept('content'))$$, '23502', null, 'every task belongs to a project');

insert into os.tasks (id, project_id, title, assigned_by, assigned_to, requesting_department_id, responsible_department_id)
values ('c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'Parent', :'vpfi', :'dirfi', tests.dept('finance'), tests.dept('finance'));
select throws_ok($$insert into os.tasks (project_id, parent_task_id, title, assigned_by, assigned_to, requesting_department_id, responsible_department_id)
  values ('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Wrong project', 'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', tests.dept('content'), tests.dept('content'))$$,
  '23503', null, 'a subtask must be in its parent''s project');
select throws_ok($$update os.tasks set assigned_to = null where id = 'c1000000-0000-0000-0000-000000000001'$$, '23514', null, 'a started task must have an assignee');

-- ─── No direct writes, whatever the client tries ───────────────────────────
select tests.login(:'vpco');
select throws_ok($$insert into os.tasks (project_id, title, assigned_by, requesting_department_id, responsible_department_id) values ('b1000000-0000-0000-0000-000000000001', 'x', 'a0000000-0000-0000-0000-000000000003', tests.dept('content'), tests.dept('content'))$$, '42501', null, 'no direct INSERT on tasks');
select throws_ok($$update os.tasks set title = 'x'$$, '42501', null, 'no direct UPDATE on tasks');
select throws_ok($$delete from os.audit_log$$, '42501', null, 'no direct DELETE on the audit log');

-- ─── Global Project creation and approval ──────────────────────────────────
select tests.login(:'dirfi');
select throws_ok($$select api.create_project('{"kind":"GLOBAL","name":"Nope"}'::jsonb)$$, 'P0403', null, 'a Director cannot submit a Global Project');
select tests.login(:'cdou');
select throws_ok($$select api.create_project('{"kind":"GLOBAL","name":"Nope"}'::jsonb)$$, 'P0403', null, 'a Coordinator cannot either');

select tests.login(:'vpou');
select lives_ok($$select set_config('t.g', api.create_project('{"kind":"GLOBAL","name":"VP Global","due_on":"2027-02-01"}'::jsonb)::text, true)$$, 'a VP can draft one');
select is((select approval_status from os.projects where id = current_setting('t.g')::uuid), 'draft', 'starting as a draft');
select api.submit_global_project(current_setting('t.g')::uuid);
select is((select count(*)::int from api.calendar_items('2027-01-01', '2027-03-01', 'core') where item_id = current_setting('t.g')::uuid), 0, 'not on the Core Calendar while pending');
select throws_ok($$select api.decide_global_project(current_setting('t.g')::uuid, 'approved')$$, 'P0403', null, 'a VP cannot approve their own');
select tests.login(:'adm');
select throws_ok($$select api.decide_global_project(current_setting('t.g')::uuid, 'approved')$$, 'P0403', null, 'an administrator cannot approve one');
select tests.login(:'pres');
select api.decide_global_project(current_setting('t.g')::uuid, 'approved');
select tests.login(:'dirfi');
select is((select count(*)::int from api.calendar_items('2027-01-01', '2027-03-01', 'core') where item_id = current_setting('t.g')::uuid), 1, 'on the Core Calendar once approved');
select tests.login(:'pres');
select set_config('t.pg', api.create_project('{"kind":"GLOBAL","name":"President Global"}'::jsonb)::text, true);
select is((select approval_status from os.projects where id = current_setting('t.pg')::uuid), 'approved', 'the President creates and approves directly');

-- ─── Internal project creation ─────────────────────────────────────────────
select tests.login(:'dirco');
select throws_ok($$select api.create_project(jsonb_build_object('kind','INTERNAL','name','X','owning_department_id',tests.dept('finance')))$$, 'P0403', null, 'a Director cannot create a project in another department');
select lives_ok($$select api.create_project(jsonb_build_object('kind','INTERNAL','name','Mine','owning_department_id',tests.dept('content')))$$, 'a Director can in their own, with the default grant');
select tests.login(:'cdou');
select throws_ok($$select api.create_project(jsonb_build_object('kind','INTERNAL','name','X','owning_department_id',tests.dept('outreach')))$$, 'P0403', null, 'a Coordinator cannot by default');

-- ─── Assignment ────────────────────────────────────────────────────────────
select tests.login(:'vpco');
select set_config('t.t', api.create_task('b1000000-0000-0000-0000-000000000001', jsonb_build_object('title','Assign me','assigned_to',:'dirco'::text))::text, true);
select is((select assigned_to from os.tasks where id = current_setting('t.t')::uuid), :'dirco'::uuid, 'a VP assigns to their Director');
select is((select assigned_by from os.tasks where id = current_setting('t.t')::uuid), :'vpco'::uuid, 'the same record carries the assigner');
select is((select count(*)::int from os.tasks where title = 'Assign me'), 1, 'and there is exactly one record');
select throws_ok($$select api.create_task('b1000000-0000-0000-0000-000000000001', jsonb_build_object('title','Over','assigned_to','a0000000-0000-0000-0000-000000000008'))$$, 'P0422', null, 'crossing teams has to be a request');
select tests.login(:'dirco');
select lives_ok($$select api.create_task('b1000000-0000-0000-0000-000000000001', jsonb_build_object('title','Self','assigned_to','a0000000-0000-0000-0000-000000000004'))$$, 'self-assignment works');
select is((select count(*)::int from api.my_notifications() where entity_id = current_setting('t.t')::uuid and kind = 'task.assigned'), 1, 'the assignee was notified');
select api.set_task_status(current_setting('t.t')::uuid, 'in_progress');
select api.set_task_status(current_setting('t.t')::uuid, 'done');
select is((select status from os.tasks where id = current_setting('t.t')::uuid), 'done', 'the assignee completes it');
select tests.login(:'vpfi');
select throws_ok($$select api.set_task_status(current_setting('t.t')::uuid, 'todo')$$, 'P0404', null, 'someone from another team gets not-found, by ID');

-- ─── Cross-team, all eight steps ───────────────────────────────────────────
select tests.login(:'dirfi');
select set_config('t.r', api.create_cross_team_request('b1000000-0000-0000-0000-000000000002', tests.dept('content'), '{"title":"Make a graphic","due_at":"2027-01-10T12:00:00Z"}'::jsonb)::text, true);
select tests.login(:'vpco');
select is((select count(*)::int from api.my_notifications() where entity_id = current_setting('t.r')::uuid and kind = 'request.received'), 1, '2. the receiving VP is notified');
select is((select request_state from os.tasks where id = current_setting('t.r')::uuid), 'pending', '3. it waits in the queue');
select tests.login(:'dirco');
select throws_ok($$select api.respond_to_request(current_setting('t.r')::uuid, 'accept')$$, 'P0404', null, 'a Director cannot even see it to accept it');
select tests.login(:'vpco');
select api.respond_to_request(current_setting('t.r')::uuid, 'clarify', 'What size?');
select tests.login(:'dirfi');
select is((select request_state from os.tasks where id = current_setting('t.r')::uuid), 'clarification_requested', '8. the requester sees the same state');
select api.clarify_request(current_setting('t.r')::uuid, 'Square');
select tests.login(:'vpco');
select api.respond_to_request(current_setting('t.r')::uuid, 'accept');
select throws_ok($$select api.delegate_request(current_setting('t.r')::uuid, 'a0000000-0000-0000-0000-000000000008')$$, 'P0422', null, 'delegating outside the team is refused');
select api.delegate_request(current_setting('t.r')::uuid, :'dirco');
select tests.login(:'dirfi');
select throws_ok($$select api.delegate_request(current_setting('t.r')::uuid, 'a0000000-0000-0000-0000-000000000008')$$, 'P0403', null, 'the requester cannot delegate on the other team''s behalf');
select tests.login(:'dirco');
select throws_ok($$select api.set_task_status(current_setting('t.r')::uuid, 'done')$$, 'P0409', null, 'it cannot jump to done without review');
select api.submit_deliverable(current_setting('t.r')::uuid, 'Here it is');
select throws_ok($$select api.review_deliverable(current_setting('t.r')::uuid, true)$$, 'P0403', null, 'the assignee cannot accept their own work');
select tests.login(:'dirfi');
select api.review_deliverable(current_setting('t.r')::uuid, false, 'Bigger logo');
select tests.login(:'dirco');
select is((select status from os.tasks where id = current_setting('t.r')::uuid), 'revisions_requested', '8. revisions show on the same record');
select api.submit_deliverable(current_setting('t.r')::uuid, 'Bigger');
select tests.login(:'dirfi');
select api.review_deliverable(current_setting('t.r')::uuid, true);
select tests.login(:'vpco');
select is((select status from os.tasks where id = current_setting('t.r')::uuid), 'done', '7. accepted: both teams see done');
select is((select count(*)::int from os.tasks where id = current_setting('t.r')::uuid and project_id = 'b1000000-0000-0000-0000-000000000002'), 1, 'still linked to its originating project');
select is((select count(*)::int from os.task_review_events where task_id = current_setting('t.r')::uuid), 9, 'with its whole review history');

-- ─── Deadline negotiation ──────────────────────────────────────────────────
select tests.login(:'dirfi');
select set_config('t.r2', api.create_cross_team_request('b1000000-0000-0000-0000-000000000002', tests.dept('content'), '{"title":"Second","due_at":"2027-01-10T12:00:00Z"}'::jsonb)::text, true);
select tests.login(:'vpco');
select api.respond_to_request(current_setting('t.r2')::uuid, 'accept', '', :'dirco');
select tests.login(:'dirco');
select throws_ok($$select api.update_task(current_setting('t.r2')::uuid, '{"title":"Second","due_at":"2027-03-01T12:00:00Z"}'::jsonb)$$, 'P0409', null, 'a cross-team date moves only by agreement');
select set_config('t.dp', api.propose_deadline(current_setting('t.r2')::uuid, '2027-01-20T12:00:00Z', 'Need longer')::text, true);
select throws_ok($$select api.decide_deadline(current_setting('t.dp')::uuid, true)$$, 'P0403', null, 'you cannot accept your own proposal');
select tests.login(:'dirfi');
select api.decide_deadline(current_setting('t.dp')::uuid, true);
select is((select due_at from os.tasks where id = current_setting('t.r2')::uuid), '2027-01-20T12:00:00Z'::timestamptz, 'the other team agreed, and the date moved');

-- ─── Dependencies: restricted titles, no cycles ────────────────────────────
reset role;
insert into os.tasks (id, project_id, title, assigned_by, assigned_to, requesting_department_id, responsible_department_id)
values ('c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'Content blocker', :'vpco', :'dirco', tests.dept('content'), tests.dept('content'));
insert into os.task_dependencies (task_id, depends_on_task_id) values (current_setting('t.r2')::uuid, 'c1000000-0000-0000-0000-000000000002');
select tests.login(:'dirfi');
select is((select title from api.task_dependencies(current_setting('t.r2')::uuid) limit 1), 'Restricted task', 'another team''s blocker shows no title');
select tests.login(:'dirco');
select api.add_task_dependency('c1000000-0000-0000-0000-000000000002', (select id from os.tasks where title = 'Self'));
select throws_ok($$select api.add_task_dependency((select id from os.tasks where title = 'Self'), 'c1000000-0000-0000-0000-000000000002')$$, 'P0409', null, 'a circular dependency is refused');

select * from finish();
rollback;
