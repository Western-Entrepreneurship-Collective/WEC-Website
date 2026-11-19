-- The member list inside WEC OS, for whoever holds members.view (VP Community to start).
--
-- WHAT IT OPENS, AND WHAT IT DOES NOT
--
-- The members schema stays closed to the API. One read function hands back the
-- columns needed to contact members (name, email, year, when they joined) for
-- active members only, after checking the permission. Nothing else on the row
-- (building, signature, evidence, favourite) ever leaves the database this way.
--
-- Every opening of the list is logged by member_list itself (members.viewed), and
-- every copy or download through log_member_export (members.export): who, how many,
-- how, and which year filter. Copy and download counts are what the page reports;
-- the opening is what the server knows for certain. Neither ever holds an address or
-- a name, because administrators read the audit log.

-- THE AGREEMENT
--
-- Before the list opens for the first time, each person agrees to the member data
-- rules (the page shows them). The agreement is kept here with the version they
-- agreed to; raising MEMBER_POLICY_VERSION in the page and here asks everyone again.
-- member_list refuses until the current version is agreed, so the addresses never
-- reach a browser before that.
create table os.member_policy_agreements (
  executive_id uuid not null references os.executives (id) on delete cascade,
  version integer not null check (version > 0),
  agreed_at timestamptz not null default now(),
  primary key (executive_id, version)
);
alter table os.member_policy_agreements enable row level security;
revoke all on os.member_policy_agreements from public, anon, authenticated;

create function private.member_policy_version() returns integer
language sql immutable set search_path = '' as $$ select 1 $$;

create function api.member_policy_agreed() returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_active();
  perform private.require_perm('members.view');
  return exists (select 1 from os.member_policy_agreements
                 where executive_id = auth.uid() and version = private.member_policy_version());
end $$;
grant execute on function api.member_policy_agreed() to authenticated;

create function api.agree_member_policy(p_version integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_active();
  perform private.require_perm('members.view');
  if p_version is distinct from private.member_policy_version() then
    raise exception 'The rules have changed. Reload the page and read them again.' using errcode = 'P0409';
  end if;
  insert into os.member_policy_agreements (executive_id, version) values (auth.uid(), p_version)
  on conflict do nothing;
  perform private.audit('members.policy_agreed', 'member_list', null, jsonb_build_object('version', p_version));
end $$;
grant execute on function api.agree_member_policy(integer) to authenticated;

insert into os.permissions (key, action, description) values
  ('members.view', 'view', 'See the member list (name, email, year) and copy or download it');

-- Granted to exactly one seat. If the title ever differs, fail loudly instead of
-- quietly giving the permission to nobody (or to two seats).
do $$
declare n integer;
begin
  insert into os.permission_grants (permission_key, position_id)
  select 'members.view', id from os.positions where title = 'VP Community';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Expected one VP Community position, found %', n;
  end if;
end $$;

-- Volatile, not stable, on purpose: every opening of the list is recorded (who, when,
-- how many rows), which is the one thing the server itself can vouch for.
create function api.member_list() returns table (
  id uuid, name text, email text, year text, joined_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare n integer;
begin
  perform private.require_active();
  perform private.require_perm('members.view');
  if not exists (select 1 from os.member_policy_agreements
                 where executive_id = auth.uid() and version = private.member_policy_version()) then
    raise exception 'Agree to the member data rules first' using errcode = 'P0412';
  end if;
  select count(*) into n from members.members where status = 'active';
  perform private.audit('members.viewed', 'member_list', null, jsonb_build_object('count', n));
  return query
    select m.id, m.name, m.email, m.year, m.joined_at
    from members.members m
    where m.status = 'active'
    order by lower(m.name), m.email;
end $$;
grant execute on function api.member_list() to authenticated;

-- One copy or download. Structured on purpose, with no free text, so the log can
-- never hold an address or a name:
--   p_kind     'copy' (a batch copied for BCC) or 'csv' (a download)
--   p_count    how many rows, as the page reports it
--   p_year     the year filter, one of the member list's years, or null for all
--   p_search   whether a search narrowed the list (never the search text)
--   p_batch / p_batches   which batch of how many, for a copy
create function api.log_member_export(
  p_kind text, p_count integer, p_year text, p_search boolean, p_batch integer, p_batches integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_active();
  perform private.require_perm('members.view');
  if not exists (select 1 from os.member_policy_agreements
                 where executive_id = auth.uid() and version = private.member_policy_version()) then
    raise exception 'Agree to the member data rules first' using errcode = 'P0412';
  end if;
  if p_kind is null or p_kind not in ('copy', 'csv') then
    raise exception 'Unknown export' using errcode = '22023';
  end if;
  if p_count is null or p_count < 1 or p_count > 10000 then
    raise exception 'Nothing to export' using errcode = '22023';
  end if;
  if p_year is not null and p_year not in ('Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5+', 'Graduate', 'Alumni', 'Unknown') then
    raise exception 'Unknown year' using errcode = '22023';
  end if;
  if p_kind = 'copy' and (p_batch is null or p_batches is null or p_batch < 1 or p_batch > p_batches or p_batches > 10000) then
    raise exception 'Unknown batch' using errcode = '22023';
  end if;
  perform private.audit('members.export', 'member_list', null, jsonb_build_object(
    'kind', p_kind, 'count', p_count, 'year', coalesce(p_year, 'All years'), 'search', coalesce(p_search, false),
    'batch', case when p_kind = 'copy' then p_batch end, 'batches', case when p_kind = 'copy' then p_batches end));
end $$;
grant execute on function api.log_member_export(text, integer, text, boolean, integer, integer) to authenticated;

-- Keep this the last step of any migration that adds functions (see 20261031000900_os_finalize.sql).
revoke execute on all functions in schema api, private from public;
