begin;
\ir helpers.psql
select plan(15);

select ok(not has_function_privilege('authenticated', 'api.service_provision_account(text,text,text,boolean)', 'execute'),
  'signed-in users cannot create accounts in a batch');

\set temp 'a0000000-0000-0000-0000-0000000000f1'
select lives_ok($$select api.service_provision_account('New.Person@wec.test', 'New Person', 'Director of Content')$$, 'a batch account is provisioned');
select is((select seat_no from os.invitations where email = 'new.person@wec.test'), 2, 'and takes the seat that is free, not one someone holds');
select throws_ok($$select api.service_provision_account('x@wec.test', 'X', 'Nothing Like This')$$, 'P0422', null, 'an unknown position is refused');
select throws_ok($$select api.service_provision_account('vp.content@wec.test', 'X', null)$$, 'P0409', null, 'an existing address is refused');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
values (:'temp', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'new.person@wec.test', 'temporary-hash', now());

select is((select status from os.executives where id = :'temp'), 'invited', 'the account starts closed');
select ok((select must_change_password from os.executives where id = :'temp'), 'and owes a new password');

select tests.login(:'temp');
select is((select count(*)::int from os.departments), 0, 'holding the temporary password shows nothing');
select is((api.me()->>'must_change_password')::boolean, true, 'but the app can tell where to send them');
select lives_ok($$select api.activate_account()$$, 'calling activate directly does not fail');
select is((api.me()->>'status'), 'invited', 'and does not open the account');
reset role;

update auth.users set raw_user_meta_data = '{"a": 1}' where id = :'temp';
select is((select status from os.executives where id = :'temp'), 'invited', 'other changes to the login do not open it');

update auth.users set encrypted_password = 'their-own-hash' where id = :'temp';
select is((select status from os.executives where id = :'temp'), 'active', 'a new password opens it');
select ok(not (select must_change_password from os.executives where id = :'temp'), 'and clears the debt');

select tests.login(:'temp');
select cmp_ok((select count(*)::int from os.departments), '>', 0, 'and now they can see WEC');
reset role;

select * from finish();
rollback;
