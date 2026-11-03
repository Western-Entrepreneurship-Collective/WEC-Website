-- LOCAL ONLY. Fictional people for tests and local development; every address is
-- on the reserved .test domain. `supabase db reset` loads this, and nothing ever
-- applies it to a hosted project. The shared password is for this stack alone.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', v.id::uuid, 'authenticated', 'authenticated', v.email,
  extensions.crypt('local-test-password', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from (values
  ('a0000000-0000-0000-0000-000000000001', 'president@wec.test'),
  ('a0000000-0000-0000-0000-000000000002', 'vp.events@wec.test'),
  ('a0000000-0000-0000-0000-000000000003', 'vp.content@wec.test'),
  ('a0000000-0000-0000-0000-000000000004', 'dir.content@wec.test'),
  ('a0000000-0000-0000-0000-000000000005', 'vp.outreach@wec.test'),
  ('a0000000-0000-0000-0000-000000000006', 'coord.outreach@wec.test'),
  ('a0000000-0000-0000-0000-000000000007', 'vp.finance@wec.test'),
  ('a0000000-0000-0000-0000-000000000008', 'dir.finance@wec.test'),
  ('a0000000-0000-0000-0000-000000000009', 'admin@wec.test'),
  ('a0000000-0000-0000-0000-00000000000a', 'former@wec.test'),
  ('a0000000-0000-0000-0000-00000000000b', 'dir.admin@wec.test')
) as v (id, email);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id, u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
from auth.users u where u.email like '%@wec.test';

insert into os.executives (id, email, full_name, status, activated_at)
select u.id, u.email, v.name, 'active', now()
from auth.users u join (values
  ('president@wec.test', 'Pat President'),
  ('vp.events@wec.test', 'Eve Events'),
  ('vp.content@wec.test', 'Connie Content'),
  ('dir.content@wec.test', 'Dana Director'),
  ('vp.outreach@wec.test', 'Otto Outreach'),
  ('coord.outreach@wec.test', 'Cory Coordinator'),
  ('vp.finance@wec.test', 'Fay Finance'),
  ('dir.finance@wec.test', 'Finn Finance'),
  ('admin@wec.test', 'Ada Admin'),
  ('former@wec.test', 'Fran Former'),
  ('dir.admin@wec.test', 'Dee Administrator')
) as v (email, name) on v.email = u.email;

insert into os.position_assignments (executive_id, position_id, seat_no, academic_year_id, during)
select e.id, p.id, 1, (select id from os.academic_years where is_current), daterange('2026-05-01', null)
from (values
  ('president@wec.test', 'President'),
  ('vp.events@wec.test', 'VP Events'),
  ('vp.content@wec.test', 'VP Content'),
  ('dir.content@wec.test', 'Director of Content'),
  ('vp.outreach@wec.test', 'VP Outreach'),
  ('coord.outreach@wec.test', 'Speaker Acquisition Coordinator'),
  ('vp.finance@wec.test', 'VP Finance'),
  ('dir.finance@wec.test', 'Director of Financial Operations'),
  ('former@wec.test', 'Director of Sponsorship'),
  ('dir.admin@wec.test', 'Director of Administration')
) as v (email, title)
join os.executives e on e.email = v.email
join os.positions p on p.title = v.title;

insert into os.system_admins (executive_id) select id from os.executives where email = 'admin@wec.test';

-- Deactivated after the assignment above, the way it happens for real.
update os.position_assignments set during = daterange('2026-05-01', '2026-06-01')
where executive_id = (select id from os.executives where email = 'former@wec.test');
update os.executives set status = 'deactivated', deactivated_at = now() where email = 'former@wec.test';

-- Past the welcome screen, so tests and local browsing start on Home.
update os.executives set onboarding = '{"welcomed":"2026-10-01T12:00:00Z"}' where email like '%@wec.test';
