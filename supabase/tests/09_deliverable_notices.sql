-- When a deliverable comes in, the teams that need it hear about it on the site and by
-- email, with a subject that says who handed in what, for which event.
begin;
\ir helpers.psql
select plan(16);

create function tests.notices(p_who uuid) returns int language sql security definer set search_path = '' as $$
  select count(*)::int from os.notifications where recipient_id = p_who and kind = 'deliverable.handed_in'
$$;
grant execute on function tests.notices(uuid) to authenticated;

-- An event with guests and finance: Events, Content, Outreach and Finance get projects.
select tests.login(:'vpev');
select set_config('t.e', api.save_event(null, jsonb_build_object('name','Pitch night','tier','B','starts_at',(now() + interval '60 days')::text,'requires_speakers',true,'requires_finance',true), array[:'vpev'::uuid], '{}')::text, true);
select api.submit_event(current_setting('t.e')::uuid);
select tests.login(:'pres');
select api.decide_event(current_setting('t.e')::uuid, 'approved');
reset role;
select set_config('t.bios', (select t.id::text from os.tasks t join os.projects p on p.id = t.project_id where p.event_id = current_setting('t.e')::uuid and t.template_task_key = 'bios'), true);
select set_config('t.run', (select t.id::text from os.tasks t join os.projects p on p.id = t.project_id where p.event_id = current_setting('t.e')::uuid and t.template_task_key = 'run'), true);

select is((select name from os.task_deliverables where task_id = current_setting('t.bios')::uuid), 'the guest bios and headshots', 'A deliverable has a name for subject lines');
select is((select notify from os.task_deliverables where task_id = current_setting('t.bios')::uuid), '{content,communications}'::text[], 'and the teams it is for');

-- Outreach hands in the bios. Content needs them; Finance and Events don't.
select tests.login(:'vpou');
select api.hand_in_deliverable(current_setting('t.bios')::uuid, 'https://drive.google.com/bios');
select is(tests.notices(:'vpco'), 1, 'Content''s VP hears the bios came in');
select is(tests.notices(:'dirco'), 1, 'and so does everyone else on Content');
select is(tests.notices(:'vpfi'), 0, 'Finance doesn''t, since it doesn''t need them');
select is(tests.notices(:'vpev'), 0, 'and neither do Events');
select is(tests.notices(:'cdou'), 0, 'Outreach doesn''t tell itself');
select is(tests.notices(:'vpou'), 0, 'least of all the person who handed it in');

-- The email.
reset role;
select is((select entity_type || ':' || entity_id from os.notifications where recipient_id = :'vpco' and kind = 'deliverable.handed_in'),
  'event:' || current_setting('t.e'), 'The notification opens the event, where Content can see it');
insert into os.notification_preferences (executive_id, email_digest, muted_kinds) values (:'dirco', true, '{deliverable.handed_in}');
create temp table claimed on commit drop as select * from api.service_claim_deliverable_emails(100);
select is((select team_name || ' handed in ' || deliverable_name || ' for ' || event_name from claimed where email = 'vp.content@wec.test'),
  'Outreach handed in the guest bios and headshots for Pitch night', 'The email says who handed in what, for which event');
select is((select count(*)::int from claimed where email = 'dir.content@wec.test'), 0, 'Someone who muted these gets no email');
select ok((select emailed_at is not null from os.notifications where recipient_id = :'vpco' and kind = 'deliverable.handed_in'), 'Sending it keeps it out of the daily digest');

-- Replacing it tells them again, as an update.
select tests.login(:'vpou');
select api.hand_in_deliverable(current_setting('t.bios')::uuid, 'https://drive.google.com/bios-v2');
select is(tests.notices(:'vpco'), 2, 'A replacement tells them again');
reset role;
select is((select updated from api.service_claim_deliverable_emails(100) where email = 'vp.content@wec.test'), true, 'and its email says it was updated');

-- The run-of-show is for every team on the event.
select tests.login(:'vpev');
select api.hand_in_deliverable(current_setting('t.run')::uuid, 'https://docs.google.com/run');
select is(tests.notices(:'vpfi'), 1, 'The run-of-show goes to every team on the event');
select is(tests.notices(:'pres'), 0, 'but not to the President, who isn''t on one of its teams');

select * from finish();
rollback;
