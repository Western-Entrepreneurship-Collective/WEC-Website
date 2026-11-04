-- Adding a team to a project tells everyone on it, once, on the site and by email.
begin;
\ir helpers.psql
select plan(12);

create function tests.team_added(p_who uuid) returns int language sql security definer set search_path = '' as $$
  select count(*)::int from os.notifications where recipient_id = p_who and kind = 'project.team_added'
$$;
grant execute on function tests.team_added(uuid) to authenticated;

select tests.login(:'dirco');
select set_config('t.p', api.create_project(jsonb_build_object('kind','GLOBAL','name','Spring speaker series','owning_department_id',tests.dept('content')), array[tests.dept('outreach')])::text, true);
select is(tests.team_added(:'vpou'), 1, 'The added team''s VP hears about it');
select is(tests.team_added(:'cdou'), 1, 'and so does everyone else on that team');
select is(tests.team_added(:'vpco'), 0, 'The team that started the project doesn''t, since it wasn''t added');
select is(tests.team_added(:'dirco'), 0, 'and neither does the person who started it');

select api.set_project_teams(current_setting('t.p')::uuid, array[tests.dept('outreach'), tests.dept('finance')]);
select is(tests.team_added(:'vpfi') + tests.team_added(:'dirfi'), 2, 'A team added later hears about it too');
select is(tests.team_added(:'vpou'), 1, 'and re-saving the teams tells nobody twice');

reset role;
select is((select count(*)::int from os.jobs where kind = 'email.team_added' and payload->>'project_id' = current_setting('t.p')), 4, 'One email is queued per person');

-- Someone who turned email off still gets the notification, but no email.
insert into os.notification_preferences (executive_id, email_digest) values (:'cdou', false);
create temp table claimed on commit drop as select * from api.service_claim_team_emails(100);
select is((select count(*)::int from claimed where project_name = 'Spring speaker series'), 3, 'The email names the project');
select is((select count(*)::int from claimed where email = 'coord.outreach@wec.test'), 0, 'and isn''t sent to someone who turned email off');
select ok((select emailed_at is not null from os.notifications where recipient_id = :'vpou' and kind = 'project.team_added'), 'Sending it stops the daily digest repeating it');

-- An approved event's projects count as adding each team.
select tests.login(:'vpev');
select set_config('t.e', api.save_event(null, jsonb_build_object('name','Founder Lab','tier','B','starts_at',(now() + interval '60 days')::text), array[:'vpev'::uuid], '{}')::text, true);
select api.submit_event(current_setting('t.e')::uuid);
select tests.login(:'pres');
select api.decide_event(current_setting('t.e')::uuid, 'approved');
select is(tests.team_added(:'dirco'), 1, 'An approved event tells everyone on each team that gets a project');
select is(tests.team_added(:'vpco'), 0, 'except the head, who already gets New project for your team');

select * from finish();
rollback;
