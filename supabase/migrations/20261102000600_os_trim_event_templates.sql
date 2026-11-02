-- Event work cut to what is necessary and specific. Each template gets a new version,
-- so anything already generated keeps the tasks it was made with. Tier A, B and C run
-- 4, 3 and 2 weeks. Dates count back from the event's start; post-event dates count
-- forward from its end.
create function private.trim_event_template(p_key text, p_tasks jsonb, p_activation jsonb default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  tid uuid;
  def jsonb;
  vid uuid;
begin
  select t.id, v.definition into tid, def from os.templates t join os.template_versions v on v.id = t.current_version_id where t.key = p_key;
  def := def || jsonb_build_object('tasks', p_tasks);
  if p_activation is not null then def := def || jsonb_build_object('activation', p_activation); end if;
  perform private.validate_template_definition(def, 'event_project');
  insert into os.template_versions (template_id, version, definition)
  select tid, max(version) + 1, def from os.template_versions where template_id = tid
  returning id into vid;
  update os.templates set current_version_id = vid where id = tid;
end $$;

create function private.trim_task(p_key text, p_title text, p_a int, p_b int, p_c int, p_depends text[] default '{}', p_priority text default 'normal', p_condition jsonb default null)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object('key', p_key, 'title', p_title, 'priority', p_priority, 'anchor', 'event_start',
    'offset', jsonb_build_object('A', -p_a, 'B', -p_b, 'C', -p_c), 'depends_on', to_jsonb(p_depends), 'condition', p_condition))
$$;

create function private.trim_after(p_key text, p_title text, p_days int) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('key', p_key, 'title', p_title, 'priority', 'normal', 'anchor', 'event_end',
    'offset', jsonb_build_object('default', p_days), 'depends_on', '[]'::jsonb)
$$;

select private.trim_event_template('event-events', jsonb_build_array(
  private.trim_task('venue', 'Book the venue', 28, 21, 14, '{}', 'high'),
  private.trim_task('run', 'Write the run-of-show', 7, 5, 4, array['venue']),
  private.trim_task('setup', 'Set up the room and AV', 0, 0, 0, array['run'], 'high')));

-- Content's posting schedule depends on the event's size, and its first post is the announcement:
-- Tier A has 4 posts and 4 stories, Tier B has 3 and 3, Tier C has 2 and 2.
select private.trim_event_template('event-content', jsonb_build_array(
  private.trim_task('graphics', 'Make the event graphics', 20, 15, 10),
  private.trim_task('post_a1', 'Post 1 of 4', 18, 18, 18, array['graphics'], 'normal', '{"field":"tier","eq":"A"}'),
  private.trim_task('post_a2', 'Post 2 of 4', 11, 11, 11, array['graphics'], 'normal', '{"field":"tier","eq":"A"}'),
  private.trim_task('post_a3', 'Post 3 of 4', 7, 7, 7, array['graphics'], 'normal', '{"field":"tier","eq":"A"}'),
  private.trim_task('post_a4', 'Post 4 of 4', 1, 1, 1, array['graphics'], 'normal', '{"field":"tier","eq":"A"}'),
  private.trim_task('story_a1', 'Story 1 of 4', 11, 11, 11, array['graphics'], 'normal', '{"field":"tier","eq":"A"}'),
  private.trim_task('story_a2', 'Story 2 of 4', 7, 7, 7, array['graphics'], 'normal', '{"field":"tier","eq":"A"}'),
  private.trim_task('story_a3', 'Story 3 of 4', 3, 3, 3, array['graphics'], 'normal', '{"field":"tier","eq":"A"}'),
  private.trim_task('story_a4', 'Story 4 of 4', 1, 1, 1, array['graphics'], 'normal', '{"field":"tier","eq":"A"}'),
  private.trim_task('post_b1', 'Post 1 of 3', 14, 14, 14, array['graphics'], 'normal', '{"field":"tier","eq":"B"}'),
  private.trim_task('post_b2', 'Post 2 of 3', 7, 7, 7, array['graphics'], 'normal', '{"field":"tier","eq":"B"}'),
  private.trim_task('post_b3', 'Post 3 of 3', 1, 1, 1, array['graphics'], 'normal', '{"field":"tier","eq":"B"}'),
  private.trim_task('story_b1', 'Story 1 of 3', 7, 7, 7, array['graphics'], 'normal', '{"field":"tier","eq":"B"}'),
  private.trim_task('story_b2', 'Story 2 of 3', 3, 3, 3, array['graphics'], 'normal', '{"field":"tier","eq":"B"}'),
  private.trim_task('story_b3', 'Story 3 of 3', 1, 1, 1, array['graphics'], 'normal', '{"field":"tier","eq":"B"}'),
  private.trim_task('post_c1', 'Post 1 of 2', 7, 7, 7, array['graphics'], 'normal', '{"field":"tier","eq":"C"}'),
  private.trim_task('post_c2', 'Post 2 of 2', 1, 1, 1, array['graphics'], 'normal', '{"field":"tier","eq":"C"}'),
  private.trim_task('story_c1', 'Story 1 of 2', 3, 3, 3, array['graphics'], 'normal', '{"field":"tier","eq":"C"}'),
  private.trim_task('story_c2', 'Story 2 of 2', 1, 1, 1, array['graphics'], 'normal', '{"field":"tier","eq":"C"}'),
  private.trim_task('media', 'Take event photos and video', 0, 0, 0, '{}', 'normal', '{"field":"requires_media","eq":true}'),
  private.trim_after('recap', 'Post the recap', 5)));

select private.trim_event_template('event-operations', jsonb_build_array(
  private.trim_task('logistics', 'Arrange equipment and transport', 11, 8, 6)),
  '{"field":"requires_logistics","eq":true}');

select private.trim_event_template('event-outreach', jsonb_build_array(
  private.trim_task('invite', 'Send guest invitations', 21, 16, 11, '{}', 'high'),
  private.trim_task('confirm', 'Confirm guests', 11, 8, 6, array['invite'], 'high'),
  private.trim_task('bios', 'Get guest bios and photos', 8, 6, 4, array['confirm']),
  private.trim_after('thanks', 'Send guest thank-yous', 2)));

select private.trim_event_template('event-community', jsonb_build_array(
  private.trim_task('registration', 'Open registration', 22, 17, 11),
  private.trim_task('reminders', 'Send the member reminder', 1, 1, 1, array['registration']),
  private.trim_after('feedback', 'Send the feedback form', 2)));

select private.trim_event_template('event-sponsorship', jsonb_build_array(
  private.trim_task('materials', 'Make the sponsor package', 22, 17, 11),
  private.trim_task('outreach', 'Contact sponsors', 18, 14, 9, array['materials'], 'high'),
  private.trim_task('commitments', 'Confirm sponsor commitments', 8, 6, 4, array['outreach'], 'high')));

select private.trim_event_template('event-finance', jsonb_build_array(
  private.trim_task('budget', 'Approve the event budget', 25, 19, 13, '{}', 'high'),
  private.trim_after('reconcile', 'Reconcile expenses', 10)));

select private.trim_event_template('event-communications', jsonb_build_array(
  private.trim_task('draft', 'Draft the official announcement', 21, 16, 11),
  private.trim_task('publish', 'Send the official announcement and the email', 20, 14, 7, array['draft'], 'high')));

select private.trim_event_template('event-venture', jsonb_build_array(
  private.trim_task('package', 'Make the member resource package', 14, 11, 7)
    || '{"description":"A brochure, poster and email that outline the resources members can get."}'::jsonb));

drop function private.trim_event_template(text, jsonb, jsonb);
drop function private.trim_task(text, text, int, int, int, text[], text, jsonb);
drop function private.trim_after(text, text, int);

revoke execute on all functions in schema api, private from public;
