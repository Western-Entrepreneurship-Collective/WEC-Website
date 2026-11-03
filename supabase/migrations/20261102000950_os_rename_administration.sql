-- The President's Office is now called Administration, in its name and its address.
update os.departments set name = 'Administration', slug = 'administration' where slug = 'presidents-office';

update os.automation_rules set config = jsonb_set(config, '{department}', '"administration"')
where config->>'department' = 'presidents-office';

-- The one function that looks this team up by its address.
do $$
declare
  fn oid := 'private.handle_job(os.jobs)'::regprocedure;
begin
  execute replace(pg_get_functiondef(fn), 'presidents-office', 'administration');
end $$;
