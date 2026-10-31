-- SOPs, meetings, calendars, search, deactivation, the year transition, archives.
begin;
\ir helpers.psql
select plan(56);

-- ─── SOP versions ──────────────────────────────────────────────────────────
select tests.login(:'dirco');
select set_config('t.s', api.create_sop('Posting guide', tests.dept('content'), 'How we post', 'all_execs', current_date + 10, null, null, 'First words')::text, true);
select set_config('t.v1', (select id::text from os.sop_versions where sop_id = current_setting('t.s')::uuid), true);
select is((select major || '.' || minor from os.sop_versions where id = current_setting('t.v1')::uuid), '1.0', 'a new SOP starts at 1.0');
select api.save_sop_draft(current_setting('t.v1')::uuid, 'Better words', 'typo');
select api.submit_sop_version(current_setting('t.v1')::uuid);
select throws_ok($$select api.save_sop_draft(current_setting('t.v1')::uuid, 'Again', '')$$, 'P0409', null, 'a submitted draft cannot be edited');
select throws_ok($$select api.publish_sop_version(current_setting('t.v1')::uuid)$$, 'P0403', null, 'a Director cannot publish');
select tests.login(:'dirfi');
select is((select count(*)::int from os.sops where id = current_setting('t.s')::uuid), 0, 'an unpublished SOP is not visible outside the department');
select tests.login(:'vpco');
select api.publish_sop_version(current_setting('t.v1')::uuid, 'Good');
select tests.login(:'dirfi');
select is((select count(*)::int from os.sop_versions where id = current_setting('t.v1')::uuid), 1, 'published is visible to every executive');
reset role;
select throws_ok($$update os.sop_versions set content = 'tampered' where id = current_setting('t.v1')::uuid$$, 'P0403', null, 'a published version cannot be changed even by the database owner');
select throws_ok($$delete from os.sop_versions where id = current_setting('t.v1')::uuid$$, 'P0403', null, 'or deleted');
select tests.login(:'vpco');
select set_config('t.v2', api.start_sop_draft(current_setting('t.s')::uuid)::text, true);
select is((select major || '.' || minor from os.sop_versions where id = current_setting('t.v2')::uuid), '1.1', 'the next draft is 1.1');
select throws_ok($$select api.start_sop_draft(current_setting('t.s')::uuid)$$, 'P0409', null, 'only one open draft at a time');
select tests.login(:'dirfi');
select is((select count(*)::int from os.sop_versions where id = current_setting('t.v2')::uuid), 0, 'a draft of a published SOP stays private to the department');
select tests.login(:'vpco');
select api.save_sop_draft(current_setting('t.v2')::uuid, 'Second words', '');
select api.submit_sop_version(current_setting('t.v2')::uuid);

-- A project pinned to 1.0 keeps pointing at it
reset role;
insert into os.projects (id, kind, owning_department_id, name, lead_executive_id) values ('b4000000-0000-0000-0000-000000000001', 'INTERNAL', tests.dept('content'), 'Uses SOP', :'vpco');
select tests.login(:'vpco');
select api.link_project_sop('b4000000-0000-0000-0000-000000000001', current_setting('t.v1')::uuid);
select api.publish_sop_version(current_setting('t.v2')::uuid);
select is((select content from os.sop_versions where id = current_setting('t.v1')::uuid), 'Better words', 'publishing 1.1 leaves 1.0 untouched');
select is((select status from os.sop_versions where id = current_setting('t.v1')::uuid), 'superseded', 'and marks it superseded');
select is((select sop_version_id from os.project_sop_refs where project_id = 'b4000000-0000-0000-0000-000000000001')::text, current_setting('t.v1'), 'the historical project keeps its version');
select set_config('t.v3', api.start_sop_draft(current_setting('t.s')::uuid, true, current_setting('t.v1')::uuid)::text, true);
select is((select major || '.' || minor || ':' || content from os.sop_versions where id = current_setting('t.v3')::uuid), '2.0:Better words', 'restoring old content makes a new version, 2.0 here');
select set_config('t.a', current_setting('t.s'), true);
select tests.login(:'adm');
select is((select count(*)::int from os.sops where id = current_setting('t.s')::uuid), 1, 'administrators can reach SOPs');
reset role;
select is((select count(*)::int from os.notifications where kind = 'sop.review_due' and entity_id = current_setting('t.s')::uuid), 0, 'no review reminder until the rule runs');
select private.rule_sop_review('{"days":14}');
select is((select count(*)::int from os.notifications where kind = 'sop.review_due' and entity_id = current_setting('t.s')::uuid), 1, 'and one when it does');

-- ─── Naming an approver takes someone who can already publish ──────────────
select tests.login(:'dirco');
select throws_ok($$select api.update_sop(current_setting('t.s')::uuid, 'Posting guide', '', 'all_execs', null, null, (select id from os.positions where title = 'Director of Content'))$$, 'P0403', null, 'a Director cannot name themselves approver');
select throws_ok($$select api.create_sop('Mine', tests.dept('content'), '', 'all_execs', null, null, (select id from os.positions where title = 'Director of Content'), 'x')$$, 'P0403', null, 'not on a new SOP either');
select lives_ok($$select api.update_sop(current_setting('t.s')::uuid, 'Posting guide', 'Edited', 'all_execs', current_date + 10, 'a0000000-0000-0000-0000-000000000004', null)$$, 'the other fields stay editable');

-- ─── No direct route to the bucket ─────────────────────────────────────────
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'os_%'), 0, 'nobody can read or sign bucket objects with their own token');

-- ─── An archived SOP's draft stays put ─────────────────────────────────────
reset role;
update os.sops set archived_at = now() where id = current_setting('t.s')::uuid;
select tests.login(:'vpco');
select throws_ok($$select api.save_sop_draft(current_setting('t.v3')::uuid, 'Late', '')$$, 'P0409', null, 'a draft under an archived SOP cannot be edited');
reset role;
update os.sops set archived_at = null where id = current_setting('t.s')::uuid;

-- ─── Meetings ──────────────────────────────────────────────────────────────
select tests.login(:'dirco');
select set_config('t.m', api.save_meeting(null, jsonb_build_object('title','Content sync','starts_at','2027-01-05T18:00:00Z','department_id',tests.dept('content'),'minutes','Private minutes'), '{}', array[:'dirco'::uuid], '{}')::text, true);
select set_config('t.ai', api.save_action_item(null, current_setting('t.m')::uuid, 'Do the thing', :'dirco', '2027-01-12')::text, true);
select tests.login(:'dirfi');
select is((select count(*)::int from os.meetings where id = current_setting('t.m')::uuid), 0, 'a department''s meeting is private to it');
select throws_ok($$select api.convert_action_item(current_setting('t.ai')::uuid, 'b4000000-0000-0000-0000-000000000001')$$, 'P0404', null, 'and its action items cannot be touched from outside');
select tests.login(:'dirco');
select set_config('t.ct', api.convert_action_item(current_setting('t.ai')::uuid, 'b4000000-0000-0000-0000-000000000001')::text, true);
select is((select project_id::text from os.tasks where id = current_setting('t.ct')::uuid), 'b4000000-0000-0000-0000-000000000001', 'an action item becomes a task in an existing project');
select throws_ok($$select api.convert_action_item(current_setting('t.ai')::uuid, 'b4000000-0000-0000-0000-000000000001')$$, 'P0409', null, 'and only once');

-- ─── Calendars and search ──────────────────────────────────────────────────
select is((select count(*)::int from api.calendar_items('2027-01-01', '2027-02-01', 'personal') where item_id = current_setting('t.ct')::uuid), 1, 'a task shows on the assignee''s personal calendar');
select is((select count(*)::int from api.calendar_items('2027-01-01', '2027-02-01', 'team', tests.dept('content')) where item_id = current_setting('t.ct')::uuid), 1, 'and the team calendar');
select is((select count(*)::int from api.calendar_items('2027-01-01', '2027-02-01', 'core') where item_type = 'task'), 0, 'internal tasks never reach the Core Calendar');
select tests.login(:'dirfi');
select is((select count(*)::int from api.calendar_items('2027-01-01', '2027-02-01', 'team', tests.dept('content'))), 0, 'another team''s calendar returns nothing');
select is((select count(*)::int from api.calendar_items('2027-01-01', '2027-02-01', 'org')), 0, 'and the organization calendar is closed to a Director');
select is((select count(*)::int from api.search('thing')), 0, 'search finds nothing they cannot read');
select tests.login(:'dirco');
select cmp_ok((select count(*)::int from api.search('thing')), '>=', 1, 'and the same search works for someone who can');
select tests.login(:'dirfi');
select is((select count(*)::int from api.search('Private minutes')), 0, 'meeting minutes do not leak through search');

-- ─── Notifications don't outlive access ────────────────────────────────────
select tests.login(:'vpco');
reset role;
insert into os.notifications (recipient_id, kind, entity_type, entity_id, dedupe_key) values (:'dirfi', 'task.assigned', 'task', current_setting('t.ct')::uuid, 'test');
select tests.login(:'dirfi');
select is((select title from api.my_notifications() where kind = 'task.assigned' limit 1), 'A record you no longer have access to', 'a notification shows no title once access is gone');

-- ─── Deactivation and reassignment ─────────────────────────────────────────
select tests.login(:'vpco');
select throws_ok($$select api.deactivate_executive('a0000000-0000-0000-0000-000000000004')$$, 'P0404', null, 'a VP cannot deactivate anyone');
select tests.login(:'adm');
select throws_ok($$select api.deactivate_executive('a0000000-0000-0000-0000-000000000009')$$, 'P0403', null, 'an administrator cannot deactivate themselves');
select throws_ok($$select api.set_system_admin('a0000000-0000-0000-0000-000000000009', false)$$, 'P0403', null, 'or change their own access');
select cmp_ok(api.deactivate_executive(:'dirco'), '>=', 1, 'deactivating moves unfinished work');
reset role;
select is((select assigned_to from os.tasks where id = current_setting('t.ct')::uuid), :'vpco'::uuid, 'to the department head by default');
select tests.login(:'dirco');
select is((select count(*)::int from os.tasks), 0, 'their still-valid session sees nothing, immediately');

-- ─── Archived means read-only ──────────────────────────────────────────────
select tests.login(:'vpco');
select api.set_project_status('b4000000-0000-0000-0000-000000000001', 'completed');
select api.archive_project('b4000000-0000-0000-0000-000000000001');
select throws_ok($$select api.create_task('b4000000-0000-0000-0000-000000000001', '{"title":"Late"}'::jsonb)$$, 'P0409', null, 'no new task under an archived project');
select throws_ok($$select api.add_comment(current_setting('t.ct')::uuid, 'Late')$$, 'P0409', null, 'no new comment either');
select is((select count(*)::int from os.projects where id = 'b4000000-0000-0000-0000-000000000001'), 1, 'but it can still be read');
select throws_ok($$select api.restore_archived('project', 'b4000000-0000-0000-0000-000000000001', 'Mistake')$$, 'P0404', null, 'a VP cannot restore');
select tests.login(:'adm');
select throws_ok($$select api.restore_archived('project', 'b4000000-0000-0000-0000-000000000001', '')$$, 'P0422', null, 'restoring requires a reason');
select lives_ok($$select api.restore_archived('project', 'b4000000-0000-0000-0000-000000000001', 'Mistake')$$, 'an administrator can restore with one');

select tests.login(:'vpco');
select set_config('t.arch', api.create_project(jsonb_build_object('kind','INTERNAL','name','To archive','owning_department_id',tests.dept('content')))::text, true);
select set_config('t.archt', api.create_task(current_setting('t.arch')::uuid, jsonb_build_object('title','File here','assigned_to',:'vpco'::text))::text, true);
select api.set_project_status(current_setting('t.arch')::uuid, 'completed');
select api.archive_project(current_setting('t.arch')::uuid);
select throws_ok($$select * from api.prepare_attachment('task', current_setting('t.archt')::uuid, 'a.txt', 'text/plain', 10)$$, 'P0409', null, 'an archived project takes no new files');
select api.save_meeting(null, jsonb_build_object('title','Old','starts_at','2026-09-01T18:00:00Z','department_id',tests.dept('content')), '{}', '{}', '{}');
select set_config('t.mo', (select id::text from os.meetings where title = 'Old'), true);
select api.archive_meeting(current_setting('t.mo')::uuid);
select throws_ok($$select api.save_action_item(null, current_setting('t.mo')::uuid, 'Late action', null, null)$$, 'P0409', null, 'nor does an archived meeting take new action items');

-- ─── Ending an assignment ──────────────────────────────────────────────────
select tests.login(:'adm');
select set_config('t.pa', api.assign_position(:'vpfi', (select id from os.positions where title = 'VP Community'), 1, true)::text, true);
select api.end_assignment(current_setting('t.pa')::uuid);
select lives_ok($$select api.assign_position('a0000000-0000-0000-0000-000000000008', (select id from os.positions where title = 'VP Community'), 1, true)$$, 'a seat filled and vacated today can be filled again today');
reset role;
insert into os.system_admins (executive_id) values (:'vpfi');
select tests.login(:'adm');
select throws_ok($$select api.assign_position('a0000000-0000-0000-0000-000000000009', (select id from os.positions where title = 'VP Sponsorship'), 1)$$, 'P0403', null, 'still refused with two administrators');
reset role;
delete from os.system_admins where executive_id = :'vpfi';
select tests.login(:'adm');
select lives_ok($$select api.assign_position('a0000000-0000-0000-0000-000000000009', (select id from os.positions where title = 'VP Sponsorship'), 1)$$, 'a sole administrator can, so a year transition cannot lock them out');

-- ─── Academic-year transition ──────────────────────────────────────────────
select set_config('t.tr', api.start_year_transition('2027-28', '2027-05-01', '2028-04-30')::text, true);
select cmp_ok((select count(*)::int from os.roster_snapshots), '>=', 1, 'the outgoing roster is preserved');
select is(api.generate_handover_projects(current_setting('t.tr')::uuid), 10, 'one handover project per department');
select is(api.generate_handover_projects(current_setting('t.tr')::uuid), 0, 'and running it again makes none');
select api.finish_year_transition(current_setting('t.tr')::uuid);
select is((select label from os.academic_years where is_current), '2027-28', 'the year moves on');

select * from finish();
rollback;
