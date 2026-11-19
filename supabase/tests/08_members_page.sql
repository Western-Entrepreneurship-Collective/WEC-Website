-- The member list in WEC OS: who can read it, what it returns, the agreement, and the log.
begin;
\ir helpers.psql
select plan(28);

-- Members to read: two active, one who left.
insert into members.members (name, email, year, source) values
  ('Bea Second', 'bea@uwo.ca', 'Year 2', 'sheet_import'),
  ('Al First', 'al@uwo.ca', 'Year 1', 'sheet_import'),
  ('Lou Left', 'lou@uwo.ca', 'Year 3', 'sheet_import');
update members.members set status = 'left' where email = 'lou@uwo.ca';

-- The local stack has no VP Community, so Eve Events takes that seat as well.
insert into os.position_assignments (executive_id, position_id, seat_no, academic_year_id, during)
select :'vpev', p.id, 1, (select id from os.academic_years where is_current), daterange('2026-05-01', null)
from os.positions p where p.title = 'VP Community';

select is((select count(*)::int from os.permission_grants g join os.positions p on p.id = g.position_id
  where g.permission_key = 'members.view' and p.title = 'VP Community'), 1, 'members.view goes to the VP Community seat');
select is((select count(*)::int from os.permission_grants where permission_key = 'members.view'), 1, 'and to nobody else');

-- Who cannot read it.
select tests.login(:'vpou');
select throws_ok($$select * from api.member_list()$$, 'P0403', null, 'Another VP cannot read the member list');
select throws_ok($$select api.log_member_export('copy', 5, null, false, 1, 1)$$, 'P0403', null, 'or log an export');
select tests.login(:'pres');
select throws_ok($$select * from api.member_list()$$, 'P0403', null, 'Nor can the President, for now');
select tests.login(:'adm');
select throws_ok($$select * from api.member_list()$$, 'P0403', null, 'An administrator does not get it by being an administrator');

-- VP Community, after agreeing to the rules once.
select tests.login(:'vpev');
select is(api.member_policy_agreed(), false, 'VP Community has not agreed to the rules yet');
select throws_ok($$select * from api.member_list()$$, 'P0412', null, 'so the list stays closed');
select throws_ok($$select api.log_member_export('copy', 2, null, false, 1, 1)$$, 'P0412', null, 'and nothing can be exported');
select throws_ok($$select api.agree_member_policy(99)$$, 'P0409', null, 'agreeing to a version that is not current is refused');
select lives_ok($$select api.agree_member_policy(1)$$, 'agreeing opens it');
select lives_ok($$select api.agree_member_policy(1)$$, 'agreeing again is harmless');
select is(api.member_policy_agreed(), true, 'the agreement is recorded');
select is((select count(*)::int from api.member_list()), 2, 'VP Community sees the active members only');
select is((select string_agg(name, ', ') from api.member_list()), 'Al First, Bea Second', 'sorted by name');
select is((select year from api.member_list() where email = 'bea@uwo.ca'), 'Year 2', 'with their year');
select lives_ok($$select api.log_member_export('copy', 2, 'Year 2', true, 1, 1)$$, 'a copy is logged');
select lives_ok($$select api.log_member_export('csv', 2, null, false, null, null)$$, 'and so is a download');
select throws_ok($$select api.log_member_export('print', 2, null, false, 1, 1)$$, '22023', null, 'an unknown kind is refused');
select throws_ok($$select api.log_member_export('csv', 0, null, false, null, null)$$, '22023', null, 'an empty export is refused');
select throws_ok($$select api.log_member_export('copy', 3, 'ava@uwo.ca', false, 1, 1)$$, '22023', null, 'a year that is not a year is refused');
select throws_ok($$select api.log_member_export('copy', 3, null, false, 4, 2)$$, '22023', null, 'a batch past the last is refused');
reset role;

select is((select changes ->> 'count' from os.audit_log where action = 'members.export' and changes ->> 'kind' = 'copy' order by id desc limit 1), '2',
  'the log holds the count');
select ok(not exists (select 1 from os.audit_log where action like 'members.%' and changes::text like '%@%'),
  'and no entry holds an email address');
select ok((select count(*) from os.audit_log where action = 'members.viewed' and actor_id = :'vpev') >= 1,
  'opening the list is recorded');
select is((select count(*)::int from os.member_policy_agreements where executive_id = :'vpev'), 1, 'one agreement row, however often they agree');
select ok(exists (select 1 from os.audit_log where action = 'members.policy_agreed' and actor_id = :'vpev'), 'the agreement is in the audit log');
select ok(not has_table_privilege('authenticated', 'os.member_policy_agreements', 'select'), 'nobody reads the agreements table through the API');

select * from finish();
rollback;
