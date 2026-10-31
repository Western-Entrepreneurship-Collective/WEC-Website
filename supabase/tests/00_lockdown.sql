begin;
\ir helpers.psql
select plan(9);

select is((select count(*)::int from pg_tables t join pg_class c on c.relname = t.tablename and c.relnamespace = 'os'::regnamespace
  where t.schemaname = 'os' and not c.relrowsecurity), 0, 'every table in os has RLS enabled');

select is((select count(*)::int from information_schema.role_table_grants
  where table_schema = 'os' and grantee in ('anon', 'public')), 0, 'anon and public have no table grants in os');

select is((select count(*)::int from information_schema.role_table_grants
  where table_schema = 'os' and grantee = 'authenticated' and privilege_type <> 'SELECT'), 0, 'authenticated can only SELECT from os tables');

select is((select count(*)::int from information_schema.role_table_grants
  where table_schema = 'private' and grantee in ('anon', 'authenticated', 'public')), 0, 'nothing in private is a readable table');

select is((select count(*)::int from pg_proc p where p.pronamespace in ('api'::regnamespace, 'private'::regnamespace)
  and p.prosecdef and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')), 0,
  'every SECURITY DEFINER function pins its search_path');

select is((select count(*)::int from pg_proc p where p.pronamespace in ('api'::regnamespace, 'private'::regnamespace)
  and has_function_privilege('anon', p.oid, 'execute')), 0, 'anon can execute nothing in api or private');

select is((select count(*)::int from pg_proc p where p.pronamespace = 'api'::regnamespace
  and p.proname like 'service\_%' and has_function_privilege('authenticated', p.oid, 'execute')), 0,
  'signed-in users cannot call service functions');

select ok(not has_function_privilege('authenticated', 'api.bootstrap_first_admin(text,text,text)', 'execute'),
  'bootstrap is out of reach of signed-in users');

select is((select count(*)::int from os.permissions k
  where not exists (select 1 from os.permission_grants g where g.permission_key = k.key)), 0, 'every permission has a default grant');

select * from finish();
rollback;
