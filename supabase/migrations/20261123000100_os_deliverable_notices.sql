-- When a deliverable comes in, the teams that need it hear about it: a notification on
-- the site and an email whose subject says who handed in what, for which event. The
-- email names the team, the deliverable and the event, and links to the event page.
-- What was handed in stays in WEC OS.
--
-- Also: the overview tells a task that's waiting on an earlier one from a stuck one.

-- ─── Who each deliverable is for ────────────────────────────────────────────
-- name: how a subject line says it ("the run-of-show"). notify: the slugs of the teams
-- that need it, and 'president' for the President. Empty means every team on the event.
alter table os.task_deliverables
  add column name text check (name is null or length(trim(name)) between 1 and 80),
  add column notify text[] not null default '{}';

create temporary table deliverable_notices (template_key text, task_key text, name text, notify text[]);
insert into deliverable_notices values
  ('event-events', 'venue', 'the venue details', '{content,communications,community,operations}'),
  ('event-events', 'run', 'the run-of-show', '{}'),
  ('event-finance', 'budget', 'the event budget', '{events,operations,sponsorship}'),
  ('event-finance', 'reconcile', 'the expense report', '{president}'),
  ('event-sponsorship', 'materials', 'the sponsor package', '{finance,president}'),
  ('event-sponsorship', 'commitments', 'the sponsor commitments', '{content,finance,events}'),
  ('event-outreach', 'confirm', 'the confirmed guest list', '{events,content}'),
  ('event-outreach', 'bios', 'the guest bios and headshots', '{content,communications}'),
  ('event-community', 'registration', 'the registration link', '{content,communications}'),
  ('event-community', 'feedback', 'the feedback form', '{events,president}'),
  ('event-communications', 'draft', 'the draft announcement', '{content,president}'),
  ('event-operations', 'logistics', 'the equipment and transport plan', '{events}'),
  ('event-venture', 'package', 'the member resource package', '{content,communications,community}');

do $$
declare
  k text;
  tid uuid;
  def jsonb;
  vid uuid;
begin
  for k in select distinct template_key from deliverable_notices loop
    select t.id, v.definition into tid, def
    from os.templates t join os.template_versions v on v.id = t.current_version_id where t.key = k;
    continue when tid is null;
    def := jsonb_set(def, '{tasks}', (
      select jsonb_agg(case when s.name is null or not (x ? 'deliverable') then x
        else jsonb_set(x, '{deliverable}', (x->'deliverable') || jsonb_build_object('name', s.name, 'notify', to_jsonb(s.notify))) end
        order by ord)
      from jsonb_array_elements(def->'tasks') with ordinality as a (x, ord)
      left join deliverable_notices s on s.template_key = k and s.task_key = x->>'key'));
    perform private.validate_template_definition(def, 'event_project');
    insert into os.template_versions (template_id, version, definition)
    select tid, max(version) + 1, def from os.template_versions where template_id = tid
    returning id into vid;
    update os.templates set current_version_id = vid where id = tid;
  end loop;
end $$;

update os.task_deliverables d set name = s.name, notify = s.notify
from os.tasks t
join os.template_versions v on v.id = t.template_version_id
join os.templates tp on tp.id = v.template_id
join deliverable_notices s on s.template_key = tp.key and s.task_key = t.template_task_key
where t.id = d.task_id;

drop table deliverable_notices;

create or replace function private.attach_template_deliverable() returns trigger
language plpgsql security definer set search_path = '' as $$
declare spec jsonb;
begin
  if new.template_version_id is null or new.template_task_key is null then return new; end if;
  select x->'deliverable' into spec
  from os.template_versions v, jsonb_array_elements(v.definition->'tasks') x
  where v.id = new.template_version_id and x->>'key' = new.template_task_key
  limit 1;
  if spec is null or jsonb_typeof(spec) <> 'object' or coalesce(spec->>'kind', '') not in ('document', 'link', 'text')
     or coalesce(length(trim(spec->>'label')), 0) = 0 then
    return new;
  end if;
  insert into os.task_deliverables (task_id, kind, label, required, name, notify)
  values (new.id, spec->>'kind', left(trim(spec->>'label'), 200), coalesce(spec->>'required', 'true') <> 'false',
    nullif(left(trim(coalesce(spec->>'name', '')), 80), ''),
    case when jsonb_typeof(spec->'notify') = 'array'
      then array(select jsonb_array_elements_text(spec->'notify')) else '{}' end)
  on conflict (task_id) do nothing;
  return new;
end $$;

-- ─── Telling them ───────────────────────────────────────────────────────────
-- Everyone on each team the deliverable is for, when that team is working on the same
-- event, and the President when it names them. Not the person who handed it in. A
-- replacement tells them again, so a changed venue or run-of-show doesn't go unnoticed.
create function private.deliverable_audience(p_task uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  with d as (
    select dl.notify, p.event_id, t.responsible_department_id as own_team
    from os.task_deliverables dl
    join os.tasks t on t.id = dl.task_id
    join os.projects p on p.id = t.project_id
    where dl.task_id = p_task and p.event_id is not null
  )
  select private.team_members(p.owning_department_id)
  from d
  join os.projects p on p.event_id = d.event_id
  join os.departments dep on dep.id = p.owning_department_id
  where p.status <> 'cancelled' and p.archived_at is null and p.owning_department_id <> d.own_team
    and (cardinality(d.notify) = 0 or dep.slug = any (d.notify))
  union
  select a.executive_id
  from d
  join os.position_assignments a on true
  join os.positions pos on pos.id = a.position_id
  where 'president' = any (d.notify) and pos.org_role = 'president' and a.during @> private.today()
$$;

create function private.announce_deliverable() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ev uuid;
  who uuid;
  key_ text;
begin
  if new.submitted_at is null or new.submitted_at is not distinct from old.submitted_at then return new; end if;
  select p.event_id into ev from os.tasks t join os.projects p on p.id = t.project_id where t.id = new.task_id;
  if ev is null then return new; end if;
  for who in select distinct x from private.deliverable_audience(new.task_id) x loop
    continue when who is null or who is not distinct from auth.uid();
    key_ := 'deliverable:' || new.task_id || ':' || who || ':' || floor(extract(epoch from new.submitted_at) * 1000000)::bigint;
    perform private.notify(who, 'deliverable.handed_in', 'event', ev, key_);
    perform private.enqueue('email.deliverable', 'executive', who,
      jsonb_build_object('task_id', new.task_id, 'updated', old.submitted_at is not null), key_);
  end loop;
  return new;
end $$;
create trigger task_deliverables_announce after update of submitted_at on os.task_deliverables
  for each row execute function private.announce_deliverable();

-- What the email route may send: the address, the team that handed it in, what it was,
-- and the event. Someone who turned email off, or muted these, gets the site only.
-- Claiming marks the matching notification as emailed, so the daily digest doesn't
-- send a second email about it.
create function api.service_claim_deliverable_emails(p_limit int default 40)
returns table (job_id uuid, email text, preferred_name text, team_name text, deliverable_name text,
  event_id uuid, event_name text, updated boolean)
language plpgsql security definer set search_path = '' as $$
declare
  j record;
  addr text;
  nm text;
  team_ text;
  what text;
  ev uuid;
  ev_name text;
  wants boolean;
begin
  for j in
    select * from os.jobs where kind = 'email.deliverable' and state in ('pending', 'failed') and next_run_at <= now()
    order by next_run_at limit least(greatest(coalesce(p_limit, 40), 1), 100) for update skip locked
  loop
    addr := null; team_ := null; ev := null;
    select e.email, coalesce(nullif(e.preferred_name, ''), split_part(e.full_name, ' ', 1)) into addr, nm
    from os.executives e where e.id = j.entity_id and e.status in ('active', 'invited');
    select dep.name, coalesce(d.name, 'a deliverable'), x.id, x.name into team_, what, ev, ev_name
    from os.task_deliverables d
    join os.tasks t on t.id = d.task_id
    join os.departments dep on dep.id = t.responsible_department_id
    join os.projects p on p.id = t.project_id
    join os.events x on x.id = p.event_id
    where d.task_id = (j.payload->>'task_id')::uuid and d.submitted_at is not null and t.status <> 'cancelled';
    select coalesce((select n.email_digest and not ('deliverable.handed_in' = any (n.muted_kinds))
      from os.notification_preferences n where n.executive_id = j.entity_id), true) into wants;
    if addr is null or team_ is null or ev is null or not wants then
      update os.jobs set state = 'done', finished_at = now() where id = j.id;
      continue;
    end if;
    update os.jobs set state = 'running', attempts = attempts + 1 where id = j.id;
    update os.notifications n set emailed_at = now()
    where n.recipient_id = j.entity_id and n.dedupe_key = j.dedupe_key and n.emailed_at is null;
    job_id := j.id; email := addr; preferred_name := nm; team_name := team_; deliverable_name := what;
    event_id := ev; event_name := ev_name; updated := coalesce((j.payload->>'updated')::boolean, false);
    return next;
  end loop;
end $$;
grant execute on function api.service_claim_deliverable_emails(int) to service_role;

-- The real time of each hand-in, so two in a row are never the same moment.
create or replace function api.hand_in_deliverable(p_task uuid, p_link text default null, p_body text default null, p_attachment uuid default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  t record;
  d record;
  link_ text := nullif(trim(coalesce(p_link, '')), '');
  body_ text := nullif(trim(coalesce(p_body, '')), '');
begin
  perform private.require_active();
  select * into t from os.tasks where id = p_task for update;
  if not found or private.can_read_task(p_task) is not true then perform private.not_found(); end if;
  select * into d from os.task_deliverables where task_id = p_task for update;
  if not found then
    raise exception 'This task has no deliverable to hand in' using errcode = 'P0409';
  end if;
  if private.can_edit_task(p_task) is not true then
    raise exception 'Only the person doing this task, or their team''s lead, can hand it in' using errcode = 'P0403';
  end if;
  perform private.assert_project_writable(t.project_id);
  if t.status = 'cancelled' then
    raise exception 'This task was cancelled' using errcode = 'P0409';
  end if;
  if link_ is not null and (link_ !~* '^https?://[^[:space:]]+$' or length(link_) > 2000) then
    raise exception 'Paste a full link, starting with https://' using errcode = 'P0422';
  end if;
  if d.kind = 'text' then
    if body_ is null then raise exception 'Write what you''re handing in' using errcode = 'P0422'; end if;
    if length(body_) > 4000 then raise exception 'Keep it under 4,000 characters' using errcode = 'P0422'; end if;
    link_ := null; p_attachment := null;
  elsif d.kind = 'link' then
    if link_ is null then raise exception 'Paste the link' using errcode = 'P0422'; end if;
    body_ := null; p_attachment := null;
  else
    if (link_ is null) = (p_attachment is null) then
      raise exception 'Choose one of this task''s files, or paste a link' using errcode = 'P0422';
    end if;
    if p_attachment is not null and not exists (
      select 1 from os.attachments a
      where a.id = p_attachment and a.entity_type = 'task' and a.entity_id = p_task and a.confirmed_at is not null
    ) then
      raise exception 'That file isn''t on this task' using errcode = 'P0422';
    end if;
    body_ := null;
  end if;
  update os.task_deliverables set link_url = link_, body = body_, attachment_id = p_attachment,
    submitted_by = auth.uid(), submitted_at = clock_timestamp()
  where task_id = p_task;
  perform private.audit('deliverable.handed_in', 'task', p_task, jsonb_build_object('kind', d.kind));
end $$;
grant execute on function api.hand_in_deliverable(uuid, text, text, uuid) to authenticated;

-- ─── The overview: waiting isn't stuck ──────────────────────────────────────
-- A task waiting on an earlier one is marked blocked automatically. That's the plan
-- working, so the overview says Waiting, the same as the task page.
drop function api.team_overview();
create function api.team_overview() returns table (
  department_id uuid, department_name text, department_slug text, project_id uuid, project_name text,
  task_id uuid, task_title text, assignee_name text, due_at timestamptz, task_status text, task_waiting boolean,
  deliverable_label text, deliverable_required boolean, deliverable_submitted_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare president boolean := private.is_president();
begin
  perform private.require_active();
  perform private.require_perm('overview.view');
  return query
    select d.id, d.name, d.slug, p.id, p.name, t.id, t.title, coalesce(nullif(e.preferred_name, ''), e.full_name), t.due_at, t.status,
      coalesce(t.status = 'blocked' and t.blocked_auto, false),
      dl.label, dl.required, dl.submitted_at
    from os.projects p
    join os.departments d on d.id = p.owning_department_id
    left join os.tasks t on t.project_id = p.id and t.parent_task_id is null and t.status <> 'cancelled'
      and (t.visibility <> 'restricted' or president)
    left join os.executives e on e.id = t.assigned_to
    left join os.task_deliverables dl on dl.task_id = t.id
    where p.archived_at is null and p.system_key is null and p.status in ('planning', 'active', 'on_hold')
      and (p.kind <> 'GLOBAL' or p.approval_status = 'approved')
    order by d.sort_order, p.name, t.due_at nulls last, t.title;
end $$;
grant execute on function api.team_overview() to authenticated;

-- Keep this the last step of any migration that adds functions.
revoke execute on all functions in schema api, private from public;
