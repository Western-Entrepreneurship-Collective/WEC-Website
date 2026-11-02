-- The simpler WEC OS. A project is either one team's or several teams', with no approval
-- step, and work sent to another team is finished by that team without a sign-off. Who
-- can read what does not change: requests still show only themselves and a project name.

drop function api.submit_global_project(uuid);
drop function api.decide_global_project(uuid, text, text);
update os.projects set approval_status = 'approved', decided_at = coalesce(decided_at, now())
  where kind = 'GLOBAL' and approval_status <> 'approved';

delete from os.permission_grants where permission_key = 'global.approve';
delete from os.permissions where key = 'global.approve';
update os.permissions set description = 'Start projects with other teams' where key = 'global.submit';
-- A Director can already start a project for their own team. The checks that matter,
-- that it is their own team and an approved event, stay in the functions below.
insert into os.permission_grants (permission_key, org_role) values ('global.submit', 'director'), ('project.create_event', 'director'),
  -- Directors can give a task to someone on their own team. check_assignee keeps it to that team.
  ('task.assign', 'director')
  on conflict do nothing;

create or replace function private.authorize_project_create(p_kind text, p_department uuid, p_event uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_kind = 'GLOBAL' then
    perform private.require_perm('global.submit');
    if p_department is not null and private.is_president() is not true and private.in_department(p_department) is not true then
      raise exception 'You can only start a project for your own team' using errcode = 'P0403';
    end if;
  elsif p_kind = 'EVENT' then
    perform private.require_perm('project.create_event');
    if not exists (select 1 from os.events where id = p_event and status in ('approved', 'in_progress')) then
      raise exception 'Projects can only be added to an approved event' using errcode = 'P0409';
    end if;
    if private.is_president() is not true and private.has_perm('event.edit') is not true
       and private.in_department(p_department) is not true then
      raise exception 'You can only add projects for your own department' using errcode = 'P0403';
    end if;
  elsif p_kind = 'INTERNAL' then
    perform private.require_perm('project.create_internal');
    if private.in_department(p_department) is not true then
      raise exception 'You can only create internal projects for your own department' using errcode = 'P0403';
    end if;
    if p_event is not null and private.can_read_event(p_event) is not true then perform private.not_found(); end if;
  else
    raise exception 'Unknown project kind' using errcode = 'P0422';
  end if;
end $$;

create or replace function api.create_project(p_fields jsonb, p_departments uuid[] default '{}', p_template uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  kind_ text := p_fields->>'kind';
  dept uuid := nullif(p_fields->>'owning_department_id', '')::uuid;
  ev uuid := nullif(p_fields->>'event_id', '')::uuid;
  lead_ uuid := nullif(p_fields->>'lead_executive_id', '')::uuid;
  pid uuid;
  approval text := case when kind_ = 'GLOBAL' then 'approved' else 'not_required' end;
begin
  perform private.require_active();
  perform private.authorize_project_create(kind_, dept, ev);
  -- A project with several teams is owned by whoever raised it, for task routing only. It
  -- never narrows who sees the project: that is what visibility is for.
  if kind_ = 'GLOBAL' and dept is null then
    select department_id into dept from private.exec_positions(auth.uid()) limit 1;
  end if;
  if lead_ is not null and private.exec_is_active(lead_) is not true then
    raise exception 'The project lead must have an active account' using errcode = 'P0422';
  end if;
  insert into os.projects (kind, event_id, owning_department_id, lead_executive_id, name, summary, starts_on, due_on,
    approval_status, visibility, share_progress_with_event_lead, submitted_by, decided_by, decided_at, academic_year_id, created_by, status)
  values (kind_, ev, dept, coalesce(lead_, auth.uid()), p_fields->>'name', coalesce(p_fields->>'summary', ''),
    nullif(p_fields->>'starts_on', '')::date, nullif(p_fields->>'due_on', '')::date, approval,
    case when kind_ = 'INTERNAL' then 'participants' else coalesce(nullif(p_fields->>'visibility', ''), 'participants') end,
    coalesce((p_fields->>'share_progress_with_event_lead')::boolean, false) and kind_ = 'INTERNAL' and ev is not null,
    auth.uid(), case when approval = 'approved' then auth.uid() end, case when approval = 'approved' then now() end,
    private.current_year(), auth.uid(), 'planning')
  returning id into pid;
  if kind_ <> 'INTERNAL' then
    insert into os.project_departments (project_id, department_id) select pid, x from unnest(coalesce(p_departments, '{}')) x where x is distinct from dept;
  end if;
  perform private.audit('project.created', 'project', pid, jsonb_build_object('kind', kind_));
  if p_template is not null then
    perform private.initialize_from_template(pid, p_template);
  end if;
  return pid;
end $$;

-- Changing the teams is what changes the kind, so nobody has to know the kinds. An
-- event's own generated project stays that event's whatever its teams are.
create function api.set_project_teams(p_project uuid, p_departments uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p record;
  others uuid[];
  new_kind text;
begin
  perform private.require_active();
  select * into p from os.projects where id = p_project for update;
  if not found or private.can_read_project(p_project) is not true then perform private.not_found(); end if;
  if private.can_manage_project(p_project) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  select coalesce(array_agg(distinct x), '{}') into others from unnest(coalesce(p_departments, '{}')) x where x is distinct from p.owning_department_id;
  new_kind := case
    when p.kind = 'EVENT' then 'EVENT'
    when cardinality(others) = 0 then 'INTERNAL'
    when p.event_id is not null then 'EVENT'
    else 'GLOBAL' end;
  if new_kind = 'INTERNAL' and p.owning_department_id is null then
    raise exception 'A project for one team needs an owning team' using errcode = 'P0422';
  end if;
  update os.projects set kind = new_kind,
    approval_status = case when new_kind = 'GLOBAL' then 'approved' else 'not_required' end,
    decided_by = case when new_kind = 'GLOBAL' then auth.uid() end,
    decided_at = case when new_kind = 'GLOBAL' then now() end,
    visibility = case when new_kind = 'INTERNAL' then 'participants' else visibility end
  where id = p_project;
  delete from os.project_departments where project_id = p_project;
  insert into os.project_departments (project_id, department_id) select p_project, x from unnest(others) x;
  perform private.audit('project.teams_changed', 'project', p_project, jsonb_build_object('kind', new_kind, 'teams', cardinality(others)));
end $$;
grant execute on function api.set_project_teams(uuid, uuid[]) to authenticated;

create or replace function api.create_cross_team_request(p_project uuid, p_receiving uuid, p_fields jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  p record;
  requesting uuid := nullif(p_fields->>'requesting_department_id', '')::uuid;
  tid uuid;
begin
  perform private.require_perm('request.create');
  select * into p from os.projects where id = p_project;
  if not found or private.can_read_project(p_project) is not true then perform private.not_found(); end if;
  if requesting is null then
    select department_id into requesting from private.exec_positions(auth.uid()) limit 1;
  end if;
  if requesting is null or private.in_department(requesting) is not true then
    raise exception 'A request comes from a team you belong to' using errcode = 'P0403';
  end if;
  if not exists (select 1 from os.departments where id = p_receiving and archived_at is null) then perform private.not_found(); end if;
  if requesting = p_receiving then
    raise exception 'That is your own team. Create a task instead.' using errcode = 'P0422';
  end if;
  insert into os.tasks (project_id, title, description, deliverables, assigned_by, requesting_department_id, responsible_department_id,
    status, priority, due_at, visibility, is_cross_team, request_state, requires_review, created_by)
  values (p_project, p_fields->>'title', coalesce(p_fields->>'description', ''), coalesce(p_fields->>'deliverables', ''),
    auth.uid(), requesting, p_receiving, 'unassigned', coalesce(nullif(p_fields->>'priority', ''), 'normal'),
    nullif(p_fields->>'due_at', '')::timestamptz, 'project', true, 'pending', false, auth.uid())
  returning id into tid;
  insert into os.task_review_events (task_id, kind, actor_id) values (tid, 'requested', auth.uid());
  perform private.audit('request.created', 'task', tid, jsonb_build_object('receiving', p_receiving));
  perform private.notify_heads(p_receiving, 'request.received', 'task', tid, 'request:' || tid);
  return tid;
end $$;

-- With no sign-off, a request is done when the team doing it says so. It must still
-- have been accepted, so nobody can finish work that was never taken on.
alter table os.tasks drop constraint cross_team_done_needs_acceptance;
alter table os.tasks add constraint cross_team_done_needs_acceptance check (
  not is_cross_team or status <> 'done' or request_state = 'accepted'
);

create or replace function api.set_task_status(p_task uuid, p_status text, p_expected timestamptz default null) returns void
language plpgsql security definer set search_path = '' as $$
declare t record;
begin
  perform private.require_active();
  if p_status not in ('todo', 'in_progress', 'blocked', 'done', 'cancelled') then
    raise exception 'That status has its own action' using errcode = 'P0422';
  end if;
  select * into t from os.tasks where id = p_task for update;
  if not found or private.can_read_task(p_task) is not true then perform private.not_found(); end if;
  if private.can_edit_task(p_task) is not true
     and not (t.is_cross_team and t.status = 'done' and p_status = 'todo' and private.in_department(t.requesting_department_id)) then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  perform private.check_version(p_expected, t.updated_at);
  -- The requester may withdraw the request, or reopen finished work if something is
  -- missing. How far along it is otherwise belongs to the team doing it.
  if t.is_cross_team and p_status <> 'cancelled' and t.assigned_to is distinct from auth.uid()
     and private.is_department_head(t.responsible_department_id) is not true and private.is_president() is not true
     and not (t.status = 'done' and p_status = 'todo' and private.in_department(t.requesting_department_id)) then
    raise exception 'The team doing the work updates its progress' using errcode = 'P0403';
  end if;
  -- Accepted work stays accepted. The review record is what both teams rely on.
  if t.status = 'done' and t.reviewed_at is not null then
    raise exception 'That deliverable was accepted, so it stays done' using errcode = 'P0409';
  end if;
  if t.status = 'unassigned' and p_status not in ('cancelled') then
    raise exception 'Assign this task before starting it' using errcode = 'P0409';
  end if;
  if p_status = 'done' and t.requires_review then
    raise exception 'This task needs its deliverable submitted and accepted first' using errcode = 'P0409';
  end if;
  if p_status = 'done' and exists (
    select 1 from os.task_dependencies y join os.tasks b on b.id = y.depends_on_task_id
    where y.task_id = p_task and b.status not in ('done', 'cancelled')
  ) then
    raise exception 'Another task has to finish before this one can' using errcode = 'P0409';
  end if;
  if p_status = 'cancelled' and t.is_cross_team and private.in_department(t.requesting_department_id) is not true and private.is_president() is not true then
    raise exception 'Only the requesting team can withdraw a request' using errcode = 'P0403';
  end if;
  update os.tasks set status = p_status, blocked_auto = false,
    completed_at = case when p_status = 'done' then now() end
  where id = p_task;
  perform private.audit('task.status_changed', 'task', p_task, jsonb_build_object('status', p_status));
  if p_status in ('done', 'cancelled') then
    perform private.refresh_dependents(p_task);
  end if;
  if p_status = 'done' and t.assigned_by is not null and t.assigned_by <> auth.uid() then
    perform private.notify(t.assigned_by, 'task.completed', 'task', p_task, 'completed:' || p_task);
  end if;
end $$;

-- The one way a task is made: for a person, or for a team, with its steps, all or nothing.
-- The checks are the ones create_task and create_cross_team_request already make.
create function api.new_task(p_project uuid, p_person uuid, p_team uuid, p_fields jsonb, p_steps text[] default '{}') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  owner_ uuid;
  mine uuid;
  dept uuid;
  person uuid := p_person;
  tid uuid;
begin
  perform private.require_active();
  if p_person is not null and p_team is not null then
    raise exception 'Choose a person or a team, not both' using errcode = 'P0422';
  end if;
  if coalesce(cardinality(p_steps), 0) > 50 then
    raise exception 'That is too many steps' using errcode = 'P0422';
  end if;
  select owning_department_id into owner_ from os.projects where id = p_project;
  mine := case when private.in_department(owner_) then owner_
    else (select department_id from private.exec_positions(auth.uid()) limit 1) end;

  if p_team is not null then
    tid := api.create_cross_team_request(p_project, p_team, p_fields || jsonb_build_object('requesting_department_id', mine));
  else
    person := coalesce(person, auth.uid());
    dept := case when person = auth.uid() then coalesce(mine, owner_) else coalesce(
      (select a.department_id from private.exec_positions(person) a
       where private.in_department(a.department_id) order by a.department_id = owner_ desc limit 1),
      owner_) end;
    tid := api.create_task(p_project, p_fields || jsonb_build_object('assigned_to', person, 'responsible_department_id', dept));
  end if;

  insert into os.task_checklist_items (task_id, label, position)
  select tid, trim(s), n::int from unnest(coalesce(p_steps, '{}')) with ordinality as u(s, n) where length(trim(s)) > 0;
  return tid;
end $$;
grant execute on function api.new_task(uuid, uuid, uuid, jsonb, text[]) to authenticated;

-- Adds the counts and the other teams, which project cards show. A person with
-- summary access sees these and nothing else about the project.
drop function api.project_summaries(text, uuid, uuid, boolean);
create function api.project_summaries(p_kind text default null, p_department uuid default null, p_event uuid default null, p_include_archived boolean default false)
returns table (id uuid, kind text, name text, status text, approval_status text, starts_on date, due_on date, progress int,
  department_name text, event_id uuid, event_name text, archived_at timestamptz, can_open boolean, lead_name text,
  next_due timestamptz, overdue_tasks int, done_tasks int, total_tasks int, owning_department_id uuid, other_teams text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.is_active_exec() is not true then return; end if;
  return query
    select p.id, p.kind, p.name, p.status, p.approval_status, p.starts_on, p.due_on, private.project_progress(p.id),
      d.name, e.id, e.name, p.archived_at, private.can_read_project(p.id), coalesce(x.preferred_name, x.full_name),
      (select min(t.due_at) from os.tasks t where t.project_id = p.id and t.status not in ('done', 'cancelled') and t.due_at >= now()),
      (select count(*)::int from os.tasks t where t.project_id = p.id and t.status not in ('done', 'cancelled') and t.due_at < now()),
      (select count(*)::int from os.tasks t where t.project_id = p.id and t.status = 'done'),
      (select count(*)::int from os.tasks t where t.project_id = p.id and t.status <> 'cancelled'),
      p.owning_department_id,
      coalesce((select array_agg(o.name order by o.sort_order) from os.project_departments pd join os.departments o on o.id = pd.department_id where pd.project_id = p.id), '{}')
    from os.projects p
    left join os.departments d on d.id = p.owning_department_id
    left join os.events e on e.id = p.event_id
    left join os.executives x on x.id = p.lead_executive_id
    where private.can_read_project_summary(p.id)
      and (p_kind is null or p.kind = p_kind)
      and (p_department is null or p.owning_department_id = p_department)
      and (p_event is null or p.event_id = p_event)
      and (p_include_archived or p.archived_at is null)
    order by p.due_on nulls last, p.name;
end $$;
grant execute on function api.project_summaries(text, uuid, uuid, boolean) to authenticated;

-- Task lists show which project each task belongs to. Someone asked to do one task in
-- another team's project may see that project's name and nothing else, same as task_context.
create function api.task_project_names(p_tasks uuid[]) returns table (task_id uuid, project_name text)
language sql stable security definer set search_path = '' as $$
  select t.id, p.name from os.tasks t join os.projects p on p.id = t.project_id
  where t.id = any (p_tasks) and private.can_read_task(t.id)
$$;
grant execute on function api.task_project_names(uuid[]) to authenticated;

revoke execute on all functions in schema api, private from public;
