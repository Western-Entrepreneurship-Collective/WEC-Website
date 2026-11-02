-- The recurring rules filled every team's lists with generic reviews nobody asked for.
-- They stay off unless an administrator turns one on under Automation. What they already
-- made goes too, except a project someone has since added their own task to.
update os.automation_rules set enabled = false where category = 'recurring';

delete from os.notifications n
using os.tasks t, os.projects p
where n.entity_type = 'task' and n.entity_id = t.id and p.id = t.project_id
  and p.system_key like 'recurring:%' and t.source = 'automation';

delete from os.tasks t
using os.projects p
where p.id = t.project_id and p.system_key like 'recurring:%' and t.source = 'automation';

delete from os.projects p
where p.system_key like 'recurring:%'
  and not exists (select 1 from os.tasks t where t.project_id = p.id);
