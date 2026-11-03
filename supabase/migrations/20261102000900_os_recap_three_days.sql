-- The event recap is due 3 days after the event, not 5. A new template version, so
-- anything already generated keeps the dates it was made with.
do $$
declare
  tid uuid;
  def jsonb;
  vid uuid;
begin
  select t.id, v.definition into tid, def from os.templates t join os.template_versions v on v.id = t.current_version_id where t.key = 'event-content';
  def := jsonb_set(def, '{tasks}', (
    select jsonb_agg(case when x->>'key' = 'recap' then jsonb_set(x, '{offset,default}', '3') else x end order by ord)
    from jsonb_array_elements(def->'tasks') with ordinality as a (x, ord)));
  perform private.validate_template_definition(def, 'event_project');
  insert into os.template_versions (template_id, version, definition)
  select tid, max(version) + 1, def from os.template_versions where template_id = tid
  returning id into vid;
  update os.templates set current_version_id = vid where id = tid;
end $$;
