-- The member list: who can add to it, who can read it, and what it accepts.
begin;
\ir helpers.psql
select plan(16);

-- Locked down.
select ok((select relrowsecurity from pg_class where oid = 'members.members'::regclass), 'members has RLS enabled');
select is((select count(*)::int from information_schema.role_table_grants
  where table_schema = 'members' and grantee in ('anon', 'authenticated', 'public')), 0, 'no API role has a grant on members');
select ok(not has_schema_privilege('anon', 'members', 'usage'), 'anon cannot use the members schema');
select ok(not has_schema_privilege('authenticated', 'members', 'usage'), 'nor can a signed-in executive');
select ok(not has_function_privilege('authenticated', 'api.service_join_member(text,text,text,text,text,text,text)', 'execute'),
  'a signed-in executive cannot add members');

-- Joining, as the site's server does it.
set local role service_role;
select is(api.service_join_member('Ada Lovelace', '  Ada@UWO.ca ', 'Year 1', 'a loom', 'Ada Lovelace'), true, 'a new member is added');
select is(api.service_join_member('Ada Again', 'ada@uwo.ca', 'Year 2', 'other', 'Ada Again'), false, 'the same email again adds nobody');
select throws_ok($$select api.service_join_member('Bad Year', 'bad@uwo.ca', 'Year 5', 'x', 'Bad Year')$$,
  '23514', null, 'a year that is not one of the six is refused');
select throws_ok($$select api.service_join_member('', 'blank@uwo.ca', 'Year 1', 'x', 'x')$$,
  '23514', null, 'a blank name is refused');
reset role;

select is((select count(*)::int from members.members), 1, 'one row for Ada');
select is((select email from members.members), 'ada@uwo.ca', 'stored trimmed and lowercase');
select is((select year || ' ' || name from members.members), 'Year 1 Ada Lovelace', 'the first sign up stands');
select ok((select privacy_agreed_at is not null and source = 'website' and status = 'active' from members.members),
  'a website row records consent, its source and starts active');

-- The one-off import from the Sheet: an old row with no consent date is allowed.
insert into members.members (name, email, year, source, joined_at)
  values ('From the Sheet', 'sheet@uwo.ca', 'Year 3', 'sheet_import', '2026-09-15 12:00-04');
select is((select count(*)::int from members.members), 2, 'an imported row without a consent date is accepted');

-- Rows added by hand may say 'Year 5+' or 'Unknown'; anything else is still refused.
insert into members.members (name, email, year, source) values
  ('Fifth Year', 'fifth@uwo.ca', 'Year 5+', 'sheet_import'),
  ('No Year Yet', 'noyear@uwo.ca', 'Unknown', 'sheet_import');
select is((select count(*)::int from members.members), 4, 'Year 5+ and Unknown are accepted');
select throws_ok($$insert into members.members (name, email, year, source) values ('X', 'x5@uwo.ca', '5th year', 'sheet_import')$$,
  '23514', null, 'other spellings are still refused');

select * from finish();
rollback;
