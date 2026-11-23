-- Deliverables: what certain tasks hand to the other teams on the same event, and who
-- can see them. Also: the President gets the team overview, and the overview now opens
-- the projects and tasks it lists, to read only.

-- ─── The team overview ──────────────────────────────────────────────────────
insert into os.permission_grants (permission_key, org_role)
select 'overview.view', 'president'
where not exists (select 1 from os.permission_grants where permission_key = 'overview.view' and org_role = 'president');

-- What the overview lists, it opens: every team's projects except the system's own
-- (handovers, weekly summaries) and Global proposals nobody has approved yet.
create function private.overview_sees_project(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.has_perm('overview.view'), false) and exists (
    select 1 from os.projects p
    where p.id = p_project and p.system_key is null and (p.kind <> 'GLOBAL' or p.approval_status = 'approved')
  )
$$;

-- Reading is all the overview adds. can_read_project and can_read_task stay the gate
-- for everything that changes a record, so someone who sees a task only through the
-- overview can't comment on it, tick it or take files from it.
create function private.can_view_project(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.can_read_project(p_project), false) or private.overview_sees_project(p_project)
$$;

create function private.can_view_task(p_task uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.can_read_task(p_task) then return true; end if;
  if private.has_perm('overview.view') is not true then return false; end if;
  -- Restricted tasks stay with the people on them. The President reads them anyway.
  return exists (
    select 1 from os.tasks t
    where t.id = p_task and t.visibility <> 'restricted' and private.overview_sees_project(t.project_id)
  );
end $$;

create function private.can_view_attachment_entity(p_type text, p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'task' then private.can_view_task(p_id)
    else private.can_read_attachment_entity(p_type, p_id)
  end
$$;

-- Helpers a policy calls run as the querying role, so they need EXECUTE. They answer
-- only about the caller.
grant execute on function private.overview_sees_project(uuid), private.can_view_project(uuid), private.can_view_task(uuid),
  private.can_view_attachment_entity(text, uuid)
to authenticated;

drop policy read_project on os.projects;
drop policy read_project on os.project_departments;
drop policy read_project on os.project_participants;
drop policy read_project on os.project_sop_refs;
drop policy read_parent on os.milestones;
create policy read_project on os.projects for select to authenticated using (private.can_view_project(id));
create policy read_project on os.project_departments for select to authenticated using (private.can_view_project(project_id));
create policy read_project on os.project_participants for select to authenticated using (private.can_view_project(project_id));
create policy read_project on os.project_sop_refs for select to authenticated using (private.can_view_project(project_id));
create policy read_parent on os.milestones for select to authenticated using (
  core_visible and (select private.is_active_exec())
  or (project_id is not null and private.can_view_project(project_id))
  or (event_id is not null and private.can_read_event(event_id))
);

drop policy read_task on os.tasks;
drop policy read_task on os.task_checklist_items;
drop policy read_task on os.task_comments;
drop policy read_task on os.task_assignment_history;
drop policy read_task on os.task_review_events;
drop policy read_task on os.deadline_proposals;
drop policy read_both on os.task_dependencies;
create policy read_task on os.tasks for select to authenticated using (private.can_view_task(id));
create policy read_task on os.task_checklist_items for select to authenticated using (private.can_view_task(task_id));
create policy read_task on os.task_comments for select to authenticated using (private.can_view_task(task_id));
create policy read_task on os.task_assignment_history for select to authenticated using (private.can_view_task(task_id));
create policy read_task on os.task_review_events for select to authenticated using (private.can_view_task(task_id));
create policy read_task on os.deadline_proposals for select to authenticated using (private.can_view_task(task_id));
create policy read_both on os.task_dependencies for select to authenticated
  using (private.can_view_task(task_id) and private.can_view_task(depends_on_task_id));

create or replace function api.task_dependencies(p_task uuid)
returns table (task_id uuid, title text, status text, can_open boolean, direction text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.can_view_task(p_task) is not true then return; end if;
  return query
    select t.id,
      case when private.can_view_task(t.id) then t.title else 'Restricted task' end,
      t.status, private.can_view_task(t.id), 'blocked_by'::text
    from os.task_dependencies d join os.tasks t on t.id = d.depends_on_task_id where d.task_id = p_task
    union all
    select t.id,
      case when private.can_view_task(t.id) then t.title else 'Restricted task' end,
      t.status, private.can_view_task(t.id), 'blocks'::text
    from os.task_dependencies d join os.tasks t on t.id = d.task_id where d.depends_on_task_id = p_task;
end $$;
grant execute on function api.task_dependencies(uuid) to authenticated;

-- can_take_part: false when the overview is the only reason this person can see the task.
drop function api.task_context(uuid);
create function api.task_context(p_task uuid)
returns table (project_id uuid, project_name text, project_kind text, can_open_project boolean, event_id uuid,
  requesting_department text, responsible_department text, can_take_part boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.can_view_task(p_task) is not true then return; end if;
  return query
    select p.id, p.name, p.kind, private.can_view_project(p.id),
      case when private.can_view_project(p.id) then p.event_id end,
      req.name, res.name, coalesce(private.can_read_task(p_task), false)
    from os.tasks t
    join os.projects p on p.id = t.project_id
    join os.departments req on req.id = t.requesting_department_id
    join os.departments res on res.id = t.responsible_department_id
    where t.id = p_task;
end $$;
grant execute on function api.task_context(uuid) to authenticated;

-- ─── Deliverables ───────────────────────────────────────────────────────────
-- One per task at most. A template task names it; the task's own people hand it in.
-- 'document' takes a file from the task or a link; 'link' a link; 'text' a written answer.
create table os.task_deliverables (
  task_id uuid primary key references os.tasks (id) on delete cascade,
  kind text not null check (kind in ('document', 'link', 'text')),
  label text not null check (length(trim(label)) between 1 and 200),
  required boolean not null default true,
  link_url text check (link_url is null or (link_url ~* '^https?://[^[:space:]]+$' and length(link_url) <= 2000)),
  body text check (body is null or length(body) between 1 and 4000),
  attachment_id uuid references os.attachments (id) on delete set null,
  submitted_by uuid references os.executives (id) on delete set null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index task_deliverables_attachment on os.task_deliverables (attachment_id) where attachment_id is not null;
create trigger task_deliverables_touch before update on os.task_deliverables for each row execute function private.touch_updated_at();
alter table os.task_deliverables enable row level security;
grant select on os.task_deliverables to authenticated;

-- Who sees a deliverable: anyone who can see its task, and everyone on a team working
-- on the same event, plus the event's leads. They see what was handed in, not the task.
create function private.can_view_deliverable(p_task uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  ev uuid;
  vis text;
begin
  if private.is_active_exec() is not true then return false; end if;
  if private.can_view_task(p_task) then return true; end if;
  select p.event_id, t.visibility into ev, vis from os.tasks t join os.projects p on p.id = t.project_id where t.id = p_task;
  if ev is null or vis = 'restricted' then return false; end if;
  return exists (select 1 from os.event_leads where event_id = ev and executive_id = auth.uid())
    or exists (
      select 1 from os.projects p
      where p.event_id = ev and p.status <> 'cancelled' and p.owning_department_id is not null
        and private.in_department(p.owning_department_id)
    );
end $$;

grant execute on function private.can_view_deliverable(uuid) to authenticated;
create policy read_deliverable on os.task_deliverables for select to authenticated using (private.can_view_deliverable(task_id));

-- A task made from a template gets the deliverable its template names. Subtasks carry
-- a dotted key, so they never match.
create function private.attach_template_deliverable() returns trigger
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
  insert into os.task_deliverables (task_id, kind, label, required)
  values (new.id, spec->>'kind', left(trim(spec->>'label'), 200), coalesce(spec->>'required', 'true') <> 'false')
  on conflict (task_id) do nothing;
  return new;
end $$;
create trigger tasks_template_deliverable after insert on os.tasks
  for each row execute function private.attach_template_deliverable();

-- Every route to done goes through this, whichever function makes the change.
create function private.guard_deliverable_before_done() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' and exists (
    select 1 from os.task_deliverables d where d.task_id = new.id and d.required and d.submitted_at is null
  ) then
    raise exception 'Hand in this task''s deliverable before marking it done' using errcode = 'P0409';
  end if;
  return new;
end $$;
create trigger tasks_deliverable_before_done before update of status on os.tasks
  for each row execute function private.guard_deliverable_before_done();

-- Handing it in, or replacing what was handed in. Whoever may edit the task may do it.
create function api.hand_in_deliverable(p_task uuid, p_link text default null, p_body text default null, p_attachment uuid default null)
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
    submitted_by = auth.uid(), submitted_at = now()
  where task_id = p_task;
  perform private.audit('deliverable.handed_in', 'task', p_task, jsonb_build_object('kind', d.kind));
end $$;
grant execute on function api.hand_in_deliverable(uuid, text, text, uuid) to authenticated;

-- Everything an event's tasks hand in, for everyone working on the event.
create function api.event_deliverables(p_event uuid)
returns table (task_id uuid, department_name text, task_title text, label text, kind text, required boolean,
  due_at timestamptz, task_status text, submitted_at timestamptz, submitted_by_name text, link_url text, body text,
  attachment_id uuid, file_name text, can_open_task boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.can_read_event(p_event) is not true then return; end if;
  return query
    select d.task_id, dep.name, t.title, d.label, d.kind, d.required, t.due_at, t.status, d.submitted_at,
      coalesce(nullif(e.preferred_name, ''), e.full_name), d.link_url, d.body, a.id, a.file_name, private.can_view_task(t.id)
    from os.task_deliverables d
    join os.tasks t on t.id = d.task_id
    join os.projects p on p.id = t.project_id
    join os.departments dep on dep.id = t.responsible_department_id
    left join os.executives e on e.id = d.submitted_by
    left join os.attachments a on a.id = d.attachment_id and a.confirmed_at is not null
    where p.event_id = p_event and p.archived_at is null and t.status <> 'cancelled'
      and private.can_view_deliverable(d.task_id)
    order by t.due_at nulls last, dep.sort_order, t.title;
end $$;
grant execute on function api.event_deliverables(uuid) to authenticated;

-- Files: the task's own readers, the overview, and anyone a deliverable's file was handed to.
drop policy read_entity on os.attachments;
create policy read_entity on os.attachments for select to authenticated
  using (confirmed_at is not null and (
    private.can_view_attachment_entity(entity_type, entity_id)
    or (entity_type = 'task' and exists (
      select 1 from os.task_deliverables d where d.attachment_id = attachments.id and private.can_view_deliverable(d.task_id)
    ))
  ));

create or replace function api.attachment_path(p_id uuid) returns table (storage_path text, file_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.is_active_exec() is not true then return; end if;
  return query
    select a.storage_path, a.file_name from os.attachments a
    where a.id = p_id and a.confirmed_at is not null and (
      private.can_view_attachment_entity(a.entity_type, a.entity_id)
      or (a.entity_type = 'task' and exists (
        select 1 from os.task_deliverables d where d.attachment_id = a.id and private.can_view_deliverable(d.task_id)
      ))
    );
end $$;
grant execute on function api.attachment_path(uuid) to authenticated;

-- ─── The overview, with ids and deliverables ────────────────────────────────
drop function api.team_overview();
create function api.team_overview() returns table (
  department_id uuid, department_name text, department_slug text, project_id uuid, project_name text,
  task_id uuid, task_title text, assignee_name text, due_at timestamptz, task_status text,
  deliverable_label text, deliverable_required boolean, deliverable_submitted_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare president boolean := private.is_president();
begin
  perform private.require_active();
  perform private.require_perm('overview.view');
  return query
    select d.id, d.name, d.slug, p.id, p.name, t.id, t.title, coalesce(nullif(e.preferred_name, ''), e.full_name), t.due_at, t.status,
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

-- ─── What each event template asks to be handed in ──────────────────────────
-- New template versions, as before. Open tasks already made from these templates get
-- their deliverable too, so this term's events have them.
create temporary table deliverable_specs (template_key text, task_key text, kind text, label text);
insert into deliverable_specs values
  ('event-events', 'venue', 'text', 'Room, building, capacity and the booking confirmation'),
  ('event-events', 'run', 'document', 'The run-of-show'),
  ('event-finance', 'budget', 'document', 'The approved budget, with its total'),
  ('event-finance', 'reconcile', 'document', 'The final expense report and receipts'),
  ('event-sponsorship', 'materials', 'document', 'The sponsor package'),
  ('event-sponsorship', 'commitments', 'document', 'Each sponsor''s name, amount, what they were promised, and their logo'),
  ('event-outreach', 'confirm', 'document', 'The confirmed guest list, with roles and arrival times'),
  ('event-outreach', 'bios', 'document', 'Guest bios and headshots'),
  ('event-community', 'registration', 'link', 'The registration link'),
  ('event-community', 'feedback', 'link', 'The feedback form link'),
  ('event-communications', 'draft', 'text', 'The draft announcement'),
  ('event-operations', 'logistics', 'text', 'What''s booked, and when it arrives'),
  ('event-venture', 'package', 'document', 'The brochure, poster and email');

do $$
declare
  k text;
  tid uuid;
  def jsonb;
  vid uuid;
begin
  for k in select distinct template_key from deliverable_specs loop
    select t.id, v.definition into tid, def
    from os.templates t join os.template_versions v on v.id = t.current_version_id where t.key = k;
    continue when tid is null;
    def := jsonb_set(def, '{tasks}', (
      select jsonb_agg(case when s.kind is null then x
        else x || jsonb_build_object('deliverable', jsonb_build_object('kind', s.kind, 'label', s.label, 'required', true)) end
        order by ord)
      from jsonb_array_elements(def->'tasks') with ordinality as a (x, ord)
      left join deliverable_specs s on s.template_key = k and s.task_key = x->>'key'));
    perform private.validate_template_definition(def, 'event_project');
    insert into os.template_versions (template_id, version, definition)
    select tid, max(version) + 1, def from os.template_versions where template_id = tid
    returning id into vid;
    update os.templates set current_version_id = vid where id = tid;
  end loop;
end $$;

insert into os.task_deliverables (task_id, kind, label, required)
select t.id, s.kind, s.label, true
from os.tasks t
join os.template_versions v on v.id = t.template_version_id
join os.templates tp on tp.id = v.template_id
join deliverable_specs s on s.template_key = tp.key and s.task_key = t.template_task_key
where t.status not in ('done', 'cancelled')
on conflict (task_id) do nothing;

drop table deliverable_specs;

-- Keep this the last step of any migration that adds functions.
revoke execute on all functions in schema api, private from public;
