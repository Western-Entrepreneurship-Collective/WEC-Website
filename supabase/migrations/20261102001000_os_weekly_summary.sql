-- The Director of Administration's weekly summary, and their read-only view of what
-- every team is working on.

-- ─── The summary ────────────────────────────────────────────────────────────
-- One per week, tied to the task that asks for it. The site never sends it: its author
-- copies it into their own email, then marks it sent.
create table os.weekly_summaries (
  task_id uuid primary key references os.tasks (id) on delete cascade,
  week_start date not null unique,
  events_meetings text not null default '' check (length(events_meetings) <= 20000),
  team_progress text not null default '' check (length(team_progress) <= 20000),
  results_feedback text not null default '' check (length(results_feedback) <= 20000),
  sent_at timestamptz,
  sent_by uuid references os.executives (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger weekly_summaries_touch before update on os.weekly_summaries for each row execute function private.touch_updated_at();
alter table os.weekly_summaries enable row level security;
grant select on os.weekly_summaries to authenticated;
create policy read_with_task on os.weekly_summaries for select to authenticated
  using (private.can_read_task(task_id));

-- The work has its own project, so it stays out of the team's other recurring work.
create function private.run_weekly_summary(p_rule os.automation_rules) returns int
language plpgsql security definer set search_path = '' as $$
declare
  dept uuid;
  pid uuid;
  assignee uuid;
  tid uuid;
  week_ date := date_trunc('week', private.today()::timestamp)::date;
begin
  select id into dept from os.departments where slug = p_rule.config->>'department' and archived_at is null;
  if dept is null then raise exception 'No department called %', p_rule.config->>'department'; end if;
  -- Whoever holds the seat, even before their first sign-in.
  select a.executive_id into assignee
  from os.position_assignments a
  join os.positions p on p.id = a.position_id
  join os.executives e on e.id = a.executive_id
  where p.title = p_rule.config->>'position' and e.status <> 'deactivated' and a.during @> private.today()
  order by a.seat_no limit 1;
  if assignee is null then select h into assignee from private.department_heads(dept) h limit 1; end if;

  select id into pid from os.projects where system_key = 'weekly-summaries';
  if pid is null then
    insert into os.projects (kind, owning_department_id, lead_executive_id, name, summary, status, system_key, academic_year_id)
    values ('INTERNAL', dept, assignee, 'Weekly summaries', 'The summary of each week, sent to the executive team.', 'active', 'weekly-summaries', private.current_year())
    returning id into pid;
  end if;

  insert into os.tasks (project_id, title, description, requesting_department_id, responsible_department_id, assigned_to, status,
    priority, due_at, due_source, source, template_task_key)
  values (pid, p_rule.config->>'title', coalesce(p_rule.config->>'description', ''), dept, dept, assignee,
    case when assignee is null then 'unassigned' else 'todo' end, 'normal',
    ((week_ + 6)::timestamp + time '23:59') at time zone 'America/Toronto', 'manual', 'automation', p_rule.key || ':' || week_)
  on conflict (project_id, template_task_key) do nothing
  returning id into tid;
  if tid is null then return 0; end if;
  insert into os.weekly_summaries (task_id, week_start) values (tid, week_);
  perform private.notify(assignee, 'task.assigned', 'task', tid, 'assigned:' || tid);
  return 1;
end $$;

create or replace function private.run_recurring_rule(p_rule os.automation_rules, p_occurrence text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  dept uuid;
  pid uuid;
  assignee uuid;
  tid uuid;
begin
  if p_rule.key = 'weekly_summary' then return private.run_weekly_summary(p_rule); end if;
  select id into dept from os.departments where slug = p_rule.config->>'department' and archived_at is null;
  if dept is null then raise exception 'No department called %', p_rule.config->>'department'; end if;
  pid := private.recurring_project(dept);
  select h into assignee from private.department_heads(dept) h limit 1;
  insert into os.tasks (project_id, title, description, requesting_department_id, responsible_department_id, assigned_to, status,
    priority, due_at, due_source, source, template_task_key)
  values (pid, (p_rule.config->>'title') || ' (' || p_occurrence || ')', coalesce(p_rule.config->>'description', ''), dept, dept, assignee,
    case when assignee is null then 'unassigned' else 'todo' end, coalesce(p_rule.config->>'priority', 'normal'),
    now() + make_interval(days => coalesce((p_rule.config->>'due_days')::int, 7)), 'manual', 'automation', p_rule.key || ':' || p_occurrence)
  on conflict (project_id, template_task_key) do nothing
  returning id into tid;
  if tid is null then return 0; end if;
  perform private.notify(assignee, 'task.assigned', 'task', tid, 'assigned:' || tid);
  return 1;
end $$;

insert into os.automation_rules (key, category, name, description, schedule, config, enabled) values
  ('weekly_summary', 'recurring', 'Weekly summary', 'Asks the Director of Administration for a summary every Monday, due Sunday night.',
   '{"freq":"weekly","weekday":1}',
   '{"department":"administration","position":"Director of Administration","title":"Write the weekly summary"}', true);

-- Only the person it's assigned to writes it, and a sent summary stays as it was sent.
create function private.lock_my_summary(p_task uuid) returns os.weekly_summaries
language plpgsql security definer set search_path = '' as $$
declare
  s os.weekly_summaries;
  t record;
begin
  perform private.require_active();
  select * into s from os.weekly_summaries where task_id = p_task for update;
  if not found or private.can_read_task(p_task) is not true then perform private.not_found(); end if;
  select project_id, assigned_to into t from os.tasks where id = p_task;
  if t.assigned_to is distinct from auth.uid() then
    raise exception 'Only the person writing this summary can change it' using errcode = 'P0403';
  end if;
  perform private.assert_project_writable(t.project_id);
  if s.sent_at is not null then raise exception 'This summary has already been sent' using errcode = 'P0409'; end if;
  return s;
end $$;

create function api.save_weekly_summary(p_task uuid, p_events text, p_teams text, p_results text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.lock_my_summary(p_task);
  update os.weekly_summaries set events_meetings = coalesce(p_events, ''), team_progress = coalesce(p_teams, ''), results_feedback = coalesce(p_results, '')
  where task_id = p_task;
  perform private.audit('weekly_summary.saved', 'task', p_task);
end $$;
grant execute on function api.save_weekly_summary(uuid, text, text, text) to authenticated;

create function api.mark_weekly_summary_sent(p_task uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s os.weekly_summaries;
begin
  s := private.lock_my_summary(p_task);
  if btrim(s.events_meetings) = '' or btrim(s.team_progress) = '' or btrim(s.results_feedback) = '' then
    raise exception 'Fill in all three sections first. If there is nothing to report, write None this week.' using errcode = 'P0422';
  end if;
  update os.weekly_summaries set sent_at = now(), sent_by = auth.uid() where task_id = p_task;
  update os.tasks set status = 'done', blocked_auto = false, completed_at = now() where id = p_task;
  perform private.audit('weekly_summary.sent', 'task', p_task);
end $$;
grant execute on function api.mark_weekly_summary_sent(uuid) to authenticated;

-- Returns the file's path, so the server can remove it from Storage afterward.
create function api.remove_weekly_summary_photo(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  a record;
begin
  select * into a from os.attachments where id = p_id and entity_type = 'task' for update;
  if not found then perform private.not_found(); end if;
  perform private.lock_my_summary(a.entity_id);
  delete from os.attachments where id = p_id;
  perform private.audit('attachment.removed', 'task', a.entity_id, jsonb_build_object('attachment_id', p_id));
  return a.storage_path;
end $$;
grant execute on function api.remove_weekly_summary_photo(uuid) to authenticated;

-- ─── The team overview ──────────────────────────────────────────────────────
-- A fixed set of columns, on purpose: names, dates and status, with no task ids,
-- details or comments. It opens nothing, so every project and task page still refuses.
insert into os.permissions (key, action, description) values
  ('overview.view', 'view', 'See every team''s projects, task list and completion');
insert into os.permission_grants (permission_key, position_id)
select 'overview.view', id from os.positions where title = 'Director of Administration';

create function api.team_overview() returns table (
  department_id uuid, department_name text, department_slug text, project_id uuid, project_name text,
  task_title text, assignee_name text, due_at timestamptz, task_status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_active();
  perform private.require_perm('overview.view');
  return query
    select d.id, d.name, d.slug, p.id, p.name, t.title, coalesce(nullif(e.preferred_name, ''), e.full_name), t.due_at, t.status
    from os.projects p
    join os.departments d on d.id = p.owning_department_id
    left join os.tasks t on t.project_id = p.id and t.parent_task_id is null and t.status <> 'cancelled' and t.visibility <> 'restricted'
    left join os.executives e on e.id = t.assigned_to
    where p.archived_at is null and p.system_key is null and p.status in ('planning', 'active', 'on_hold')
    order by d.sort_order, p.name, t.due_at nulls last, t.title;
end $$;
grant execute on function api.team_overview() to authenticated;

revoke execute on all functions in schema api, private from public;
