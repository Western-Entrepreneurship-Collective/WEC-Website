-- The member list: everyone who joins through the site's sign up form, plus the
-- people already in the Google Sheet, imported once.
--
-- ITS OWN SCHEMA, ON PURPOSE
--
-- Members are not executives and have no WEC OS account, so none of the os rules
-- apply to them. The members schema is not in the Data API's exposed schemas, so
-- no API key can read it. The only way in from the site is one api function that
-- only the service role may call, from the /api/join route on the server.
-- Everything else (reading, the one-off import, corrections) is done in the
-- dashboard.

create schema members;
revoke all on schema members from public, anon, authenticated;

create table members.members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  -- Stored trimmed and lowercase, so one address is one member.
  email text not null unique check (email = lower(trim(email)) and length(email) between 3 and 200),
  -- The form's six options, exactly (src/lib/googleForm.ts YEARS).
  year text not null check (year in ('Year 1', 'Year 2', 'Year 3', 'Year 4', 'Graduate', 'Alumni')),
  building text not null default '' check (length(building) <= 2000),
  signature text not null default '' check (length(signature) <= 200),
  evidence text not null default '' check (length(evidence) <= 2000),
  favourite text not null default '' check (length(favourite) <= 2000),
  -- 'website' rows come through /api/join; 'sheet_import' rows came from the Google Sheet.
  source text not null default 'website' check (source in ('website', 'sheet_import')),
  -- The privacy box. The site refuses a sign up without it, so every website row
  -- has it. Rows imported from before the policy existed (21 Sept 2026) may not.
  privacy_agreed_at timestamptz check (source <> 'website' or privacy_agreed_at is not null),
  -- 'left' instead of deleting, so the count of who ever joined stays true.
  status text not null default 'active' check (status in ('active', 'left')),
  -- When they joined: now for the site, the Sheet's timestamp for an import.
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- On with no policies: nothing reads it through the API, even with a key.
alter table members.members enable row level security;
revoke all on members.members from public, anon, authenticated;

-- Adds one member. Returns true for a new member, false when the email is already
-- on the list (nothing changes then: the first sign up stands).
create function api.service_join_member(
  p_name text, p_email text, p_year text, p_building text, p_signature text,
  p_evidence text default '', p_favourite text default ''
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
begin
  insert into members.members (name, email, year, building, signature, evidence, favourite, source, privacy_agreed_at)
  values (trim(p_name), lower(trim(p_email)), p_year, coalesce(p_building, ''), coalesce(p_signature, ''),
          coalesce(p_evidence, ''), coalesce(p_favourite, ''), 'website', now())
  on conflict (email) do nothing
  returning id into new_id;
  return new_id is not null;
end $$;
grant execute on function api.service_join_member(text, text, text, text, text, text, text) to service_role;

-- Keep this the last step of any migration that adds functions (see 20261031000900_os_finalize.sql).
revoke execute on all functions in schema api, private from public;
