-- Reviewing First Year Rep applications in WEC OS (/os/applications).
--
-- WHO: only the people on hiring.rep_reviewers. Seeded below with whoever holds
-- President, VP Finance and VP Operations on the day this runs. Anyone else gets
-- "Not found" from every function here, so the page 404s for them. A reviewer
-- whose WEC OS account is deactivated loses access at once (is_active_exec).
--
-- BLIND SCORING, ENFORCED HERE, NOT IN THE BROWSER:
--   * api.rep_list and api.rep_get never return another reviewer's score, the
--     average, or the shortlist flag for an application the caller has not scored.
--   * Once the caller has scored AND someone else has too, the caller's score is
--     locked, so nobody can save a dummy score, read the others, then change theirs.
--   * Shortlisting needs your own score first.
--
-- ⛔ Applications are deleted when the round closes (the club's privacy rule).
-- api.rep_close_round deletes every application; scores and the shortlist go with
-- them (ON DELETE CASCADE). Only VP Operations can run it.

create table hiring.rep_reviewers (
  executive_id uuid primary key references os.executives(id) on delete cascade,
  added_at timestamptz not null default now()
);

create table hiring.rep_scores (
  application_id uuid not null references hiring.rep_applications(id) on delete cascade,
  -- restrict, not cascade: removing a reviewer mid-round must not delete scores
  -- other reviewers have already seen (which would also unlock theirs).
  reviewer_id uuid not null references hiring.rep_reviewers(executive_id) on delete restrict,
  -- Four areas, 1 to 5 each, in this order: gets things done, reliability,
  -- startup curiosity, fit for the role (src/lib/repReview.ts REVIEW_AREAS).
  -- coalesce: a CHECK that comes out null passes, so an empty array or one holding
  -- a null must be made to fail explicitly.
  areas smallint[] not null check (coalesce(
    cardinality(areas) = 4 and array_ndims(areas) = 1 and array_position(areas, null) is null
      and 1 <= all(areas) and 5 >= all(areas), false)),
  total smallint not null generated always as (areas[1] + areas[2] + areas[3] + areas[4]) stored,
  note text not null check (length(trim(note)) between 1 and 300),
  updated_at timestamptz not null default now(),
  primary key (application_id, reviewer_id)
);

create table hiring.rep_shortlist (
  application_id uuid primary key references hiring.rep_applications(id) on delete cascade,
  added_by uuid references hiring.rep_reviewers(executive_id) on delete set null,
  added_at timestamptz not null default now()
);

alter table hiring.rep_reviewers enable row level security;
alter table hiring.rep_scores enable row level security;
alter table hiring.rep_shortlist enable row level security;
revoke all on hiring.rep_reviewers, hiring.rep_scores, hiring.rep_shortlist from public, anon, authenticated;

-- Seed: the hiring reviewers, by the seat they hold today.
insert into hiring.rep_reviewers (executive_id)
select distinct a.executive_id
from os.position_assignments a
join os.positions p on p.id = a.position_id
join os.executives e on e.id = a.executive_id
where p.title in ('President', 'VP Finance', 'VP Operations')
  and e.status = 'active' and a.during @> private.today()
on conflict do nothing;

create function private.is_rep_reviewer() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active_exec() and exists (select 1 from hiring.rep_reviewers where executive_id = auth.uid())
$$;

create function private.require_rep_reviewer() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.is_rep_reviewer() is not true then
    raise exception 'Not found' using errcode = 'P0404';
  end if;
end $$;

-- True once the caller has scored this application and another reviewer has too:
-- from then on the caller can see the others, so their own score is locked.
create function private.rep_score_locked(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from hiring.rep_scores where application_id = p_id and reviewer_id = auth.uid())
     and exists (select 1 from hiring.rep_scores where application_id = p_id and reviewer_id <> auth.uid())
$$;

-- For the nav: true shows the Applications tab.
create function api.rep_is_reviewer() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.is_rep_reviewer(), false)
$$;

-- The list. Short fields only. "average", "scored_by" and "shortlisted" are null
-- until the caller has saved their own score for that application.
create function api.rep_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_rep_reviewer();
  return jsonb_build_object(
    'shortlist_count', (select count(*) from hiring.rep_shortlist),
    'can_close_round', private.can_close_rep_round(),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name, 'year', r.year, 'program', r.program, 'submitted_at', r.submitted_at,
        'my_total', mine.total,
        'average', case when mine.total is null then null
          else (select round(avg(s.total)::numeric, 1) from hiring.rep_scores s where s.application_id = r.id) end,
        'scored_by', case when mine.total is null then null
          else (select count(*) from hiring.rep_scores s where s.application_id = r.id) end,
        'shortlisted', case when mine.total is null then null
          else exists (select 1 from hiring.rep_shortlist l where l.application_id = r.id) end
      ) order by r.submitted_at, r.id)
      from hiring.rep_applications r
      left join hiring.rep_scores mine on mine.application_id = r.id and mine.reviewer_id = auth.uid()
    ), '[]')
  );
end $$;

-- One application in full. "others" is empty and "shortlisted" null until the
-- caller has scored it.
create function api.rep_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r hiring.rep_applications;
  mine hiring.rep_scores;
  scored boolean;
begin
  perform private.require_rep_reviewer();
  select * into r from hiring.rep_applications where id = p_id;
  if not found then raise exception 'Not found' using errcode = 'P0404'; end if;
  select * into mine from hiring.rep_scores where application_id = p_id and reviewer_id = auth.uid();
  scored := found;
  return jsonb_build_object(
    'application', to_jsonb(r) - 'privacy_agreed_at' - 'round',
    'mine', case when not scored then null
      else jsonb_build_object('areas', mine.areas, 'total', mine.total, 'note', mine.note) end,
    'locked', private.rep_score_locked(p_id),
    'others', case when not scored then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', coalesce(e.preferred_name, e.full_name), 'areas', s.areas, 'total', s.total, 'note', s.note
      ) order by s.updated_at)
      from hiring.rep_scores s join os.executives e on e.id = s.reviewer_id
      where s.application_id = p_id and s.reviewer_id <> auth.uid()
    ), '[]') end,
    'shortlisted', case when not scored then null
      else exists (select 1 from hiring.rep_shortlist where application_id = p_id) end,
    'shortlist_count', (select count(*) from hiring.rep_shortlist),
    'prev_id', (
      select n.id from hiring.rep_applications n
      where (n.submitted_at, n.id) < (r.submitted_at, r.id)
      order by n.submitted_at desc, n.id desc limit 1
    ),
    'next_id', (
      select n.id from hiring.rep_applications n
      where (n.submitted_at, n.id) > (r.submitted_at, r.id)
      order by n.submitted_at, n.id limit 1
    )
  );
end $$;

create function api.rep_save_score(p_id uuid, p_areas int[], p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_rep_reviewer();
  -- Serialise saves on this application, so the lock check below cannot race a
  -- second reviewer saving at the same moment.
  perform 1 from hiring.rep_applications where id = p_id for update;
  if not found then raise exception 'Not found' using errcode = 'P0404'; end if;
  if private.rep_score_locked(p_id) then
    raise exception 'Your score is locked: other reviewers have scored this applicant and their scores are open to you.' using errcode = 'P0409';
  end if;
  if coalesce(length(trim(p_note)), 0) = 0 then
    raise exception 'Add one line explaining the score before saving.' using errcode = 'P0422';
  end if;
  insert into hiring.rep_scores (application_id, reviewer_id, areas, note)
  values (p_id, auth.uid(), p_areas::smallint[], trim(p_note))
  on conflict (application_id, reviewer_id)
  do update set areas = excluded.areas, note = excluded.note, updated_at = now();
end $$;

-- Interview shortlist, shared by the reviewers, at most 10. You must have scored
-- the applicant yourself first.
create function api.rep_set_shortlist(p_id uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_rep_reviewer();
  if not exists (select 1 from hiring.rep_applications where id = p_id) then
    raise exception 'Not found' using errcode = 'P0404';
  end if;
  if not exists (select 1 from hiring.rep_scores where application_id = p_id and reviewer_id = auth.uid()) then
    raise exception 'Score this applicant before changing the shortlist.' using errcode = 'P0409';
  end if;
  if not p_on then
    delete from hiring.rep_shortlist where application_id = p_id;
    return;
  end if;
  -- One at a time, so two reviewers cannot both take the tenth place.
  lock table hiring.rep_shortlist in share row exclusive mode;
  if exists (select 1 from hiring.rep_shortlist where application_id = p_id) then return; end if;
  if (select count(*) from hiring.rep_shortlist) >= 10 then
    raise exception 'The shortlist is full (10). Remove someone first.' using errcode = 'P0409';
  end if;
  insert into hiring.rep_shortlist (application_id, added_by) values (p_id, auth.uid());
end $$;

-- Only whoever holds VP Operations today may close the round: it deletes
-- everything and cannot be undone. Tied to the seat, not a person, so it passes to
-- the next VP Operations with the job.
create function private.can_close_rep_round() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_rep_reviewer() and exists (
    select 1 from private.exec_positions(auth.uid()) s
    join os.positions p on p.id = s.position_id
    where p.title = 'VP Operations'
  )
$$;

-- Closing the round: deletes every application of the round, and with them every
-- score and shortlist place. Returns how many applications were deleted. The page
-- asks for a typed DELETE and a confirmation first; this cannot be undone.
create function api.rep_close_round() returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  perform private.require_rep_reviewer();
  if private.can_close_rep_round() is not true then
    raise exception 'Only VP Operations can close the round.' using errcode = 'P0403';
  end if;
  delete from hiring.rep_applications where round = 'first-year-rep-2026-27';
  get diagnostics n = row_count;
  return n;
end $$;

-- Adds a reviewer later, by WEC OS email, from the SQL editor or a script.
create function api.service_add_rep_reviewer(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  who uuid;
begin
  select id into who from os.executives where email = lower(trim(p_email));
  if who is null then raise exception 'No WEC OS account with that email' using errcode = 'P0404'; end if;
  insert into hiring.rep_reviewers (executive_id) values (who) on conflict do nothing;
end $$;

grant execute on function api.rep_is_reviewer(), api.rep_list(), api.rep_get(uuid),
  api.rep_save_score(uuid, int[], text), api.rep_set_shortlist(uuid, boolean), api.rep_close_round() to authenticated;
grant execute on function api.service_add_rep_reviewer(text) to service_role;

-- Keep this the last step of any migration that adds functions (see 20261031000900_os_finalize.sql).
revoke execute on all functions in schema api, private from public;
