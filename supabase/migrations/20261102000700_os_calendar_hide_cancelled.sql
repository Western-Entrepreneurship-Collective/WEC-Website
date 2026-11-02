-- A cancelled task is off the calendar in every view, and no longer puts its event on the
-- assignee's own calendar. It stays readable under closed tasks.
create or replace function api.calendar_items(p_from timestamptz, p_to timestamptz, p_scope text, p_department uuid default null)
returns table (item_type text, item_id uuid, title text, starts_at timestamptz, ends_at timestamptz, status text, priority text,
  department_name text, can_open boolean, is_cross_team boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  president boolean;
  admin boolean;
begin
  if private.is_active_exec() is not true then return; end if;
  if p_to <= p_from or p_to > p_from + interval '400 days' then
    raise exception 'That date range is not valid' using errcode = 'P0422';
  end if;
  president := private.is_president();
  admin := private.is_admin();

  if p_scope = 'core' then
    -- Approved events, published Global Projects, milestones the President placed
    -- here. Internal work has no path onto this calendar.
    return query
      select 'event'::text, e.id, e.name, e.starts_at, e.ends_at, e.status, null::text, null::text, true, false
      from os.events e
      where e.status in ('approved', 'in_progress', 'completed') and e.starts_at < p_to and coalesce(e.ends_at, e.starts_at) >= p_from
      union all
      select 'project', p.id, p.name, (coalesce(p.due_on, p.starts_on)::timestamp + time '17:00') at time zone 'America/Toronto', null, p.status, null, d.name, private.can_read_project(p.id), false
      from os.projects p left join os.departments d on d.id = p.owning_department_id
      where p.kind = 'GLOBAL' and p.approval_status = 'approved' and p.archived_at is null and coalesce(p.due_on, p.starts_on) is not null
        and (coalesce(p.due_on, p.starts_on)::timestamp + time '17:00') at time zone 'America/Toronto' between p_from and p_to
      union all
      select 'milestone', m.id, m.title, (m.due_on::timestamp + time '17:00') at time zone 'America/Toronto', null,
        case when m.completed_at is null then 'open' else 'done' end, null, null, true, false
      from os.milestones m
      where m.core_visible and (m.due_on::timestamp + time '17:00') at time zone 'America/Toronto' between p_from and p_to;
    return;
  end if;

  if p_scope = 'team' then
    if p_department is null or not (private.in_department(p_department) or president) then return; end if;
    return query
      select 'event'::text, e.id, e.name, e.starts_at, e.ends_at, e.status, null::text, null::text, true, false
      from os.events e
      where e.status in ('approved', 'in_progress', 'completed') and e.starts_at < p_to and coalesce(e.ends_at, e.starts_at) >= p_from
        and (exists (select 1 from os.event_departments x where x.event_id = e.id and x.department_id = p_department)
             or exists (select 1 from os.projects x where x.event_id = e.id and x.owning_department_id = p_department))
      union all
      select 'project', p.id, p.name, (p.due_on::timestamp + time '17:00') at time zone 'America/Toronto', null, p.status, null, d.name, true, false
      from os.projects p left join os.departments d on d.id = p.owning_department_id
      where p.archived_at is null and p.due_on is not null and private.can_read_project(p.id)
        and (p.owning_department_id = p_department or exists (select 1 from os.project_departments x where x.project_id = p.id and x.department_id = p_department))
        and (p.due_on::timestamp + time '17:00') at time zone 'America/Toronto' between p_from and p_to
      union all
      select 'milestone', m.id, m.title, (m.due_on::timestamp + time '17:00') at time zone 'America/Toronto', null,
        case when m.completed_at is null then 'open' else 'done' end, null, d.name, true, false
      from os.milestones m join os.projects p on p.id = m.project_id left join os.departments d on d.id = p.owning_department_id
      where p.archived_at is null and private.can_read_project(p.id)
        and (p.owning_department_id = p_department or exists (select 1 from os.project_departments x where x.project_id = p.id and x.department_id = p_department))
        and (m.due_on::timestamp + time '17:00') at time zone 'America/Toronto' between p_from and p_to
      union all
      select 'task', t.id, t.title, t.due_at, null, t.status, t.priority, d.name, true, t.is_cross_team
      from os.tasks t join os.projects p on p.id = t.project_id join os.departments d on d.id = t.responsible_department_id
      where t.status <> 'cancelled' and p.archived_at is null and t.due_at between p_from and p_to and private.can_read_task(t.id)
        and (t.responsible_department_id = p_department or t.requesting_department_id = p_department);
    return;
  end if;

  if p_scope = 'personal' then
    return query
      select 'task'::text, t.id, t.title, t.due_at, null::timestamptz, t.status, t.priority, d.name, true, t.is_cross_team
      from os.tasks t join os.projects p on p.id = t.project_id join os.departments d on d.id = t.responsible_department_id
      where t.assigned_to = me and t.status <> 'cancelled' and p.archived_at is null and t.due_at between p_from and p_to
      union all
      select 'milestone', m.id, m.title, (m.due_on::timestamp + time '17:00') at time zone 'America/Toronto', null,
        case when m.completed_at is null then 'open' else 'done' end, null, null, true, false
      from os.milestones m join os.projects p on p.id = m.project_id
      where p.lead_executive_id = me and p.archived_at is null
        and (m.due_on::timestamp + time '17:00') at time zone 'America/Toronto' between p_from and p_to
      union all
      select 'project', p.id, p.name, (p.due_on::timestamp + time '17:00') at time zone 'America/Toronto', null, p.status, null, null, true, false
      from os.projects p
      where p.lead_executive_id = me and p.archived_at is null and p.due_on is not null
        and (p.due_on::timestamp + time '17:00') at time zone 'America/Toronto' between p_from and p_to
      union all
      select 'event', e.id, e.name, e.starts_at, e.ends_at, e.status, null, null, true, false
      from os.events e
      where e.status in ('approved', 'in_progress', 'completed') and e.starts_at < p_to and coalesce(e.ends_at, e.starts_at) >= p_from
        and (exists (select 1 from os.event_leads x where x.event_id = e.id and x.executive_id = me)
             or exists (select 1 from os.tasks x join os.projects y on y.id = x.project_id where y.event_id = e.id and x.assigned_to = me and x.status <> 'cancelled'));
    return;
  end if;

  if p_scope = 'org' then
    if not (president or admin) then return; end if;
    return query
      select 'event'::text, e.id, e.name, e.starts_at, e.ends_at, e.status, null::text, null::text, private.can_read_event(e.id), false
      from os.events e
      where private.can_read_event(e.id) and e.status <> 'archived' and e.starts_at < p_to and coalesce(e.ends_at, e.starts_at) >= p_from
      union all
      select 'project', p.id, p.name, (p.due_on::timestamp + time '17:00') at time zone 'America/Toronto', null, p.status, null, d.name, private.can_read_project(p.id), false
      from os.projects p left join os.departments d on d.id = p.owning_department_id
      where p.archived_at is null and p.due_on is not null and private.can_read_project_summary(p.id)
        and (p.due_on::timestamp + time '17:00') at time zone 'America/Toronto' between p_from and p_to
      union all
      -- Tasks only for someone who can read them. The admin role alone cannot.
      select 'task', t.id, t.title, t.due_at, null, t.status, t.priority, d.name, true, t.is_cross_team
      from os.tasks t join os.projects p on p.id = t.project_id join os.departments d on d.id = t.responsible_department_id
      where t.status <> 'cancelled' and p.archived_at is null and t.due_at between p_from and p_to and private.can_read_task(t.id);
    return;
  end if;

  raise exception 'Unknown calendar' using errcode = 'P0422';
end $$;

revoke execute on all functions in schema api, private from public;
