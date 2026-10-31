-- WEC OS foundation: schemas, lockdown defaults, the organization, identity.
--
-- THREE SCHEMAS, ON PURPOSE
--   os       tables. Exposed to PostgREST for SELECT only, always under RLS.
--   api      functions. The only way anything is written. SECURITY DEFINER,
--            search_path = '', each one authorizes its own caller.
--   private  helpers. Never exposed. Reached only from policies and api.
--
-- This repository is public. No real name or email belongs in a migration.

create extension if not exists btree_gist with schema extensions;

create schema os;
create schema api;
create schema private;

revoke all on schema os, api, private from public, anon, authenticated;
grant usage on schema os, api to authenticated;
-- Policies call private.* as the querying role, so authenticated needs USAGE.
-- Each helper is still EXECUTE-granted one by one.
grant usage on schema private to authenticated;
grant usage on schema api to service_role;

-- Postgres grants EXECUTE on new functions to PUBLIC by default, and a per-schema
-- default cannot take that away. So the last migration revokes it outright, and
-- supabase/tests/00_lockdown.sql fails if any function is ever left callable.
alter default privileges in schema os revoke all on tables from public, anon, authenticated, service_role;

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create function private.forbid_change() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '% on os.% is not allowed', tg_op, tg_table_name using errcode = 'P0403';
end $$;

-- ─── Academic years ────────────────────────────────────────────────────────
create table os.academic_years (
  id uuid primary key default gen_random_uuid(),
  label text not null unique check (length(trim(label)) between 1 and 40),
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on > starts_on)
);
create unique index academic_years_one_current on os.academic_years (is_current) where is_current;

-- ─── Departments and positions ─────────────────────────────────────────────
create table os.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  head_position_id uuid,
  sort_order int not null default 100,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table os.positions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references os.departments (id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 80),
  -- Organizational role only. Technical permission lives in system_admins.
  org_role text not null check (org_role in ('president', 'vp', 'director', 'coordinator')),
  reports_to_position_id uuid references os.positions (id) on delete set null,
  seat_count int not null default 1 check (seat_count between 1 and 50),
  sort_order int not null default 100,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, title),
  check (reports_to_position_id is null or reports_to_position_id <> id)
);
alter table os.departments
  add constraint departments_head_position_fk foreign key (head_position_id) references os.positions (id) on delete set null;
create unique index positions_one_president on os.positions (org_role) where org_role = 'president' and archived_at is null;

-- ─── Executives ────────────────────────────────────────────────────────────
create table os.executives (
  id uuid primary key references auth.users (id) on delete restrict,
  email text not null unique check (email = lower(email)),
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  preferred_name text check (preferred_name is null or length(trim(preferred_name)) between 1 and 80),
  status text not null default 'invited' check (status in ('invited', 'active', 'deactivated')),
  activated_at timestamptz,
  deactivated_at timestamptz,
  -- Which first-day steps this person has done, with when: only their own, and
  -- nothing depends on it except what Home shows them.
  onboarding jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'deactivated') = (deactivated_at is not null))
);

create table os.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  position_id uuid references os.positions (id) on delete set null,
  seat_no int check (seat_no is null or seat_no > 0),
  grant_admin boolean not null default false,
  invited_by uuid references os.executives (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index invitations_one_open on os.invitations (email) where accepted_at is null and revoked_at is null;

create table os.position_assignments (
  id uuid primary key default gen_random_uuid(),
  executive_id uuid not null references os.executives (id) on delete restrict,
  position_id uuid not null references os.positions (id) on delete restrict,
  seat_no int not null default 1 check (seat_no > 0),
  academic_year_id uuid not null references os.academic_years (id) on delete restrict,
  during daterange not null check (not isempty(during)),
  is_acting boolean not null default false,
  created_by uuid references os.executives (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_person_per_seat exclude using gist (position_id with =, seat_no with =, during with &&),
  constraint one_seat_per_person exclude using gist (executive_id with =, position_id with =, during with &&)
);
create index position_assignments_executive on os.position_assignments (executive_id);
create index position_assignments_position on os.position_assignments (position_id);

create function private.check_seat_number() returns trigger language plpgsql set search_path = '' as $$
declare seats int;
begin
  select seat_count into seats from os.positions where id = new.position_id;
  if new.seat_no > seats then
    raise exception 'That position has % seat(s)', seats using errcode = 'P0422';
  end if;
  return new;
end $$;
create trigger position_assignments_seat before insert or update on os.position_assignments
  for each row execute function private.check_seat_number();

-- ─── Technical permission, separate from organizational position ───────────
create table os.system_admins (
  executive_id uuid primary key references os.executives (id) on delete restrict,
  granted_by uuid references os.executives (id) on delete set null,
  granted_at timestamptz not null default now()
);

create table os.permissions (
  key text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  action text not null check (action in ('view', 'create', 'edit', 'assign', 'approve', 'publish', 'archive', 'administer')),
  description text not null
);

create table os.permission_grants (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null references os.permissions (key) on delete cascade,
  org_role text check (org_role in ('president', 'vp', 'director', 'coordinator')),
  position_id uuid references os.positions (id) on delete cascade,
  department_id uuid references os.departments (id) on delete cascade,
  executive_id uuid references os.executives (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(org_role, position_id, department_id, executive_id) = 1)
);
create unique index permission_grants_unique on os.permission_grants (
  permission_key,
  coalesce(org_role, ''),
  coalesce(position_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(department_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(executive_id, '00000000-0000-0000-0000-000000000000')
);

-- ─── Audit log: append only, including TRUNCATE ────────────────────────────
create table os.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references os.executives (id) on delete set null,
  actor_kind text not null default 'executive' check (actor_kind in ('executive', 'system')),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  -- Field names and non-sensitive values only (status, assignee, dates). Never
  -- descriptions or internal titles: administrators read this log, and the role
  -- gives them no operational content.
  changes jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_created on os.audit_log (created_at desc);
create index audit_log_entity on os.audit_log (entity_type, entity_id);
create trigger audit_log_no_update before update or delete on os.audit_log
  for each row execute function private.forbid_change();
create trigger audit_log_no_truncate before truncate on os.audit_log
  for each statement execute function private.forbid_change();

create table os.settings (
  key text primary key,
  value jsonb not null,
  description text not null default '',
  updated_by uuid references os.executives (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ─── The structure from the brief: 10 departments, 18 titles, 21 seats ─────
insert into os.academic_years (label, starts_on, ends_on, is_current)
values ('2026-27', '2026-05-01', '2027-04-30', true);

insert into os.departments (name, slug, description, sort_order) values
  ('President''s Office', 'presidents-office', 'Organization-wide direction and administration.', 10),
  ('Events', 'events', 'What happens at an event and how it feels.', 20),
  ('Operations', 'operations', 'Physical and administrative execution.', 30),
  ('Community', 'community', 'Belonging, engagement and retention.', 40),
  ('Content', 'content', 'What WEC makes and posts.', 50),
  ('Outreach', 'outreach', 'Speakers, mentors and the founder community.', 60),
  ('Sponsorship', 'sponsorship', 'Sponsor pipeline and commitments.', 70),
  ('Venture Development', 'venture-development', 'Founder-focused programming and resources.', 80),
  ('Finance', 'finance', 'Budget, spend and reporting.', 90),
  ('Communications', 'communications', 'Formal announcements and messaging.', 100);

with d as (select id, slug from os.departments)
insert into os.positions (department_id, title, org_role, seat_count, sort_order)
select d.id, v.title, v.org_role, v.seats, v.sort_order
from (values
  ('presidents-office', 'President', 'president', 1, 1),
  ('presidents-office', 'Director of Administration', 'director', 1, 2),
  ('events', 'VP Events', 'vp', 1, 1),
  ('events', 'Event Experience Coordinator', 'coordinator', 1, 2),
  ('operations', 'VP Operations', 'vp', 1, 1),
  ('operations', 'Director of Logistics', 'director', 1, 2),
  ('community', 'VP Community', 'vp', 1, 1),
  ('community', 'Director of Engagement', 'director', 2, 2),
  ('content', 'VP Content', 'vp', 1, 1),
  ('content', 'Director of Content', 'director', 2, 2),
  ('outreach', 'VP Outreach', 'vp', 1, 1),
  ('outreach', 'Speaker Acquisition Coordinator', 'coordinator', 1, 2),
  ('sponsorship', 'VP Sponsorship', 'vp', 1, 1),
  ('sponsorship', 'Sponsorship Coordinator', 'coordinator', 1, 2),
  ('venture-development', 'VP Venture Development', 'vp', 1, 1),
  ('finance', 'VP Finance', 'vp', 1, 1),
  ('finance', 'Director of Finance', 'director', 2, 2),
  ('communications', 'VP Communications', 'vp', 1, 1)
) as v (slug, title, org_role, seats, sort_order)
join d on d.slug = v.slug;

-- VPs and the Director of Administration report to the President; everyone else
-- to their department's VP. The head of a department is whoever receives its
-- requests: the VP, or the President for the President's Office.
update os.positions p set reports_to_position_id = (select id from os.positions where org_role = 'president')
where p.org_role = 'vp' or p.title = 'Director of Administration';
update os.positions p set reports_to_position_id = vp.id
from os.positions vp
where vp.department_id = p.department_id and vp.org_role = 'vp' and p.org_role in ('director', 'coordinator');
update os.departments d set head_position_id = p.id
from os.positions p
where p.department_id = d.id and p.org_role in ('vp', 'president');

insert into os.permissions (key, action, description) values
  ('event.submit', 'create', 'Submit event proposals'),
  ('event.approve', 'approve', 'Approve, reject or return event proposals'),
  ('event.edit', 'edit', 'Edit and reschedule approved events'),
  ('event.archive', 'archive', 'Close and archive events'),
  ('project.create_event', 'create', 'Add projects under an approved event'),
  ('project.create_internal', 'create', 'Create internal projects for your own department'),
  ('project.archive', 'archive', 'Archive completed projects your department owns'),
  ('global.submit', 'create', 'Submit Global Projects'),
  ('global.approve', 'approve', 'Approve Global Projects'),
  ('task.create', 'create', 'Create tasks in projects you can work in'),
  ('task.assign', 'assign', 'Assign tasks to others in your department'),
  ('request.create', 'create', 'Send cross-team requests'),
  ('escalation.view', 'view', 'See blocked and overdue work across the organization'),
  ('sop.create', 'create', 'Draft SOPs for your own department'),
  ('sop.publish', 'publish', 'Publish SOP revisions for your own department'),
  ('sop.archive', 'archive', 'Archive obsolete SOPs for your own department'),
  ('meeting.create', 'create', 'Record meetings for your own department'),
  ('announcement.publish', 'publish', 'Publish organizational announcements');

insert into os.permission_grants (permission_key, org_role)
select k, r from (values
  ('event.approve','president'), ('event.edit','president'), ('event.archive','president'),
  ('project.create_event','president'), ('project.create_event','vp'),
  ('project.create_internal','president'), ('project.create_internal','vp'), ('project.create_internal','director'),
  ('project.archive','president'), ('project.archive','vp'),
  ('global.submit','president'), ('global.submit','vp'), ('global.approve','president'),
  ('task.create','president'), ('task.create','vp'), ('task.create','director'), ('task.create','coordinator'),
  ('task.assign','president'), ('task.assign','vp'),
  ('request.create','president'), ('request.create','vp'), ('request.create','director'), ('request.create','coordinator'),
  ('escalation.view','president'),
  ('sop.create','president'), ('sop.create','vp'), ('sop.create','director'),
  ('sop.publish','president'), ('sop.publish','vp'),
  ('sop.archive','president'), ('sop.archive','vp'),
  ('meeting.create','president'), ('meeting.create','vp'), ('meeting.create','director'), ('meeting.create','coordinator'),
  ('announcement.publish','president')
) as v (k, r);

-- Proposals come from one seat, not a whole role, so this grant is to a position.
insert into os.permission_grants (permission_key, position_id)
select k, (select id from os.positions where title = 'VP Events')
from (values ('event.submit'), ('event.edit'), ('event.archive')) as v (k);

insert into os.settings (key, value, description) values
  ('timezone', '"America/Toronto"', 'Timezone for deadlines and recurring schedules'),
  ('upload_limit_mb', '10', 'Largest attachment accepted, in megabytes'),
  ('notification_retention_days', '365', 'Read notifications older than this are removed'),
  ('run_log_retention_days', '365', 'Automation logs older than this are removed'),
  ('sweep_heartbeat', 'null', 'Last time the automation sweep finished');

create trigger academic_years_touch before update on os.academic_years for each row execute function private.touch_updated_at();
create trigger departments_touch before update on os.departments for each row execute function private.touch_updated_at();
create trigger positions_touch before update on os.positions for each row execute function private.touch_updated_at();
create trigger executives_touch before update on os.executives for each row execute function private.touch_updated_at();
create trigger position_assignments_touch before update on os.position_assignments for each row execute function private.touch_updated_at();
