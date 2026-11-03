-- Sponsorship starts much earlier, with commitments confirmed two weeks out for Tier A and
-- Tier B. Operations also helps set up. New template versions, so anything already
-- generated keeps the tasks it was made with.
create function private.next_event_template(p_key text, p_changes jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  tid uuid;
  def jsonb;
  vid uuid;
begin
  select t.id, v.definition into tid, def from os.templates t join os.template_versions v on v.id = t.current_version_id where t.key = p_key;
  def := def || p_changes;
  perform private.validate_template_definition(def, 'event_project');
  insert into os.template_versions (template_id, version, definition)
  select tid, max(version) + 1, def from os.template_versions where template_id = tid
  returning id into vid;
  update os.templates set current_version_id = vid where id = tid;
end $$;

select private.next_event_template('event-sponsorship', '{
  "tasks": [
    {"key": "materials", "title": "Make the sponsor package", "priority": "normal", "anchor": "event_start", "offset": {"A": -42, "B": -35, "C": -28}, "depends_on": []},
    {"key": "outreach", "title": "Contact sponsors", "priority": "high", "anchor": "event_start", "offset": {"A": -35, "B": -28, "C": -21}, "depends_on": ["materials"]},
    {"key": "commitments", "title": "Confirm sponsor commitments", "priority": "high", "anchor": "event_start", "offset": {"A": -14, "B": -14, "C": -7}, "depends_on": ["outreach"]}
  ]
}'::jsonb);

select private.next_event_template('event-operations', '{
  "tasks": [
    {"key": "logistics", "title": "Arrange equipment and transport", "priority": "normal", "anchor": "event_start", "offset": {"A": -11, "B": -8, "C": -6}, "depends_on": []},
    {"key": "setup", "title": "Help set up the event", "priority": "high", "anchor": "event_start", "offset": {"default": 0}, "depends_on": ["logistics"]}
  ]
}'::jsonb);

drop function private.next_event_template(text, jsonb);
