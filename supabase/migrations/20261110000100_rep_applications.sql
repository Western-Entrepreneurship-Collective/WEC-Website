-- First Year Rep applications, 2026-27: everyone who applies through
-- /apply/first-year-rep (src/app/api/rep-applications/route.ts).
--
-- ITS OWN SCHEMA, ON PURPOSE, the same way as members (20261103000100_members.sql).
--
-- Applicants are not members yet and have no WEC OS account. The hiring schema is
-- not in the Data API's exposed schemas, so no API key can read it. The only way
-- in from the site is one api function that only the service role may call, from
-- the route on the server. Reading the applications is done in the dashboard, by
-- the two reviewers.
--
-- ⛔ Applications are deleted when the round closes (the club's privacy rule): empty
-- this table once offers are accepted.

create schema hiring;
revoke all on schema hiring from public, anon, authenticated;

create table hiring.rep_applications (
  id uuid primary key default gen_random_uuid(),
  round text not null default 'first-year-rep-2026-27',
  name text not null check (length(trim(name)) between 1 and 200),
  -- Stored trimmed and lowercase, so one address is one application per round.
  western_email text not null check (western_email = lower(trim(western_email)) and length(western_email) between 3 and 200),
  program text not null check (length(trim(program)) between 1 and 200),
  -- src/lib/repApplications.ts REP_YEARS, exactly.
  year text not null check (year in ('1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduate', 'Other')),
  residence text not null default '' check (length(residence) <= 200),
  social text not null default '' check (length(social) <= 300),
  why text not null check (length(trim(why)) between 1 and 8000),
  company text not null check (length(trim(company)) between 1 and 8000),
  event_idea text not null check (length(trim(event_idea)) between 1 and 8000),
  show_up text not null check (length(trim(show_up)) between 1 and 8000),
  reach text not null check (length(trim(reach)) between 1 and 8000),
  link text not null default '' check (length(link) <= 2000),
  hours text not null check (hours in ('Yes', 'No', 'Not sure')),
  dates text not null default '' check (length(dates) <= 8000),
  exec_next text not null default '' check (exec_next in ('', 'Yes', 'No', 'Maybe')),
  anything text not null default '' check (length(anything) <= 8000),
  heard text not null default '' check (heard in ('', 'Instagram', 'LinkedIn', 'A group chat', 'A friend', 'A WEC event', 'Other')),
  -- The privacy box. The site refuses an application without it.
  privacy_agreed_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  unique (round, western_email)
);
-- On with no policies: nothing reads it through the API, even with a key.
alter table hiring.rep_applications enable row level security;
revoke all on hiring.rep_applications from public, anon, authenticated;

-- Adds one application. Returns true for a new one, false when this email already
-- applied this round (nothing changes then: the first application stands).
create function api.service_apply_rep(
  p_name text, p_western_email text, p_program text, p_year text, p_residence text, p_social text,
  p_why text, p_company text, p_event_idea text, p_show_up text, p_reach text, p_link text,
  p_hours text, p_dates text, p_exec_next text, p_anything text, p_heard text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
begin
  insert into hiring.rep_applications (
    name, western_email, program, year, residence, social,
    why, company, event_idea, show_up, reach, link,
    hours, dates, exec_next, anything, heard, privacy_agreed_at
  ) values (
    trim(p_name), lower(trim(p_western_email)), trim(p_program), p_year, coalesce(p_residence, ''), coalesce(p_social, ''),
    p_why, p_company, p_event_idea, p_show_up, p_reach, coalesce(p_link, ''),
    p_hours, coalesce(p_dates, ''), coalesce(p_exec_next, ''), coalesce(p_anything, ''), coalesce(p_heard, ''), now()
  )
  on conflict (round, western_email) do nothing
  returning id into new_id;
  return new_id is not null;
end $$;
grant execute on function api.service_apply_rep(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to service_role;

-- Keep this the last step of any migration that adds functions (see 20261031000900_os_finalize.sql).
revoke execute on all functions in schema api, private from public;
