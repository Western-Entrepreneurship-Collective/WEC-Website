-- WEC OS automation: templates, generation, the sweep, recurring work, reminders.
--
-- Two paths. Generation on approval happens inside the approving transaction, so
-- nothing is ever half made. Everything else runs from a sweep every 15 minutes,
-- which is safe to run twice, overlap, or fail partway: unique keys are the
-- duplicate guard, not good behaviour.

create function private.condition_fields() returns text[] language sql immutable set search_path = '' as $$
  select array['tier', 'requires_speakers', 'requires_registration', 'requires_member_participation', 'requires_sponsorship',
    'requires_finance', 'requires_communications', 'requires_founder_support', 'requires_media', 'requires_logistics']
$$;

-- Conditions are data: all / any / field-equals over a fixed list of fields. No
-- SQL or expression is ever stored or evaluated.
create function private.eval_condition(p_cond jsonb, p_facts jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare c jsonb;
begin
  if p_cond is null or p_cond = 'null'::jsonb or p_cond = '{}'::jsonb then return true; end if;
  if p_cond ? 'all' then
    for c in select jsonb_array_elements(p_cond->'all') loop
      if not private.eval_condition(c, p_facts) then return false; end if;
    end loop;
    return true;
  end if;
  if p_cond ? 'any' then
    for c in select jsonb_array_elements(p_cond->'any') loop
      if private.eval_condition(c, p_facts) then return true; end if;
    end loop;
    return false;
  end if;
  return coalesce(p_facts->(p_cond->>'field') = p_cond->'eq', false);
end $$;

create function private.validate_condition(p_cond jsonb) returns void
language plpgsql immutable set search_path = '' as $$
declare c jsonb;
begin
  if p_cond is null or p_cond = 'null'::jsonb or p_cond = '{}'::jsonb then return; end if;
  if p_cond ? 'all' or p_cond ? 'any' then
    for c in select jsonb_array_elements(coalesce(p_cond->'all', p_cond->'any')) loop
      perform private.validate_condition(c);
    end loop;
    return;
  end if;
  if not (p_cond->>'field' = any (private.condition_fields())) or not p_cond ? 'eq' then
    raise exception 'Unknown condition field: %', coalesce(p_cond->>'field', '(none)') using errcode = 'P0422';
  end if;
end $$;

-- Checked on save, so a bad template fails where it is edited and not on the day
-- a President approves an event.
create function private.validate_template_definition(p_def jsonb, p_kind text) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  t jsonb;
  s jsonb;
  d text;
  keys text[] := '{}';
  sub_keys text[];
  priority_ text;
  anchors text[];
begin
  if jsonb_typeof(p_def) <> 'object' or jsonb_typeof(p_def->'tasks') <> 'array' then
    raise exception 'A template needs a list of tasks' using errcode = 'P0422';
  end if;
  anchors := case p_kind when 'event_project' then array['event_start', 'event_end', 'project_start', 'project_due']
                         else array['project_start', 'project_due'] end;
  perform private.validate_condition(p_def->'activation');
  if p_def ? 'lead_position' and p_def->>'lead_position' is not null
     and not exists (select 1 from os.positions where title = p_def->>'lead_position' and archived_at is null) then
    raise exception 'No position called %', p_def->>'lead_position' using errcode = 'P0422';
  end if;
  for t in select jsonb_array_elements(p_def->'tasks') loop
    if coalesce(length(trim(t->>'key')), 0) = 0 or coalesce(length(trim(t->>'title')), 0) = 0 then
      raise exception 'Every task needs a key and a title' using errcode = 'P0422';
    end if;
    if (t->>'key') = any (keys) then
      raise exception 'Two tasks share the key %', t->>'key' using errcode = 'P0422';
    end if;
    keys := keys || (t->>'key');
    priority_ := coalesce(t->>'priority', 'normal');
    if priority_ not in ('low', 'normal', 'high', 'urgent') then
      raise exception 'Unknown priority: %', priority_ using errcode = 'P0422';
    end if;
    if coalesce(t->>'anchor', p_def->>'anchor') is null or not (coalesce(t->>'anchor', p_def->>'anchor') = any (anchors)) then
      raise exception 'Task % needs a date anchor from: %', t->>'key', array_to_string(anchors, ', ') using errcode = 'P0422';
    end if;
    perform private.validate_condition(t->'condition');
    sub_keys := '{}';
    for s in select jsonb_array_elements(coalesce(t->'subtasks', '[]')) loop
      if coalesce(length(trim(s->>'key')), 0) = 0 or coalesce(length(trim(s->>'title')), 0) = 0 then
        raise exception 'Every subtask needs a key and a title' using errcode = 'P0422';
      end if;
      if (s->>'key') = any (sub_keys) then
        raise exception 'Two subtasks of % share the key %', t->>'key', s->>'key' using errcode = 'P0422';
      end if;
      sub_keys := sub_keys || (s->>'key');
    end loop;
  end loop;
  for t in select jsonb_array_elements(p_def->'tasks') loop
    for d in select jsonb_array_elements_text(coalesce(t->'depends_on', '[]')) loop
      if not (d = any (keys)) then
        raise exception 'Task % depends on %, which is not in this template', t->>'key', d using errcode = 'P0422';
      end if;
      if d = t->>'key' then
        raise exception 'Task % depends on itself', d using errcode = 'P0422';
      end if;
    end loop;
  end loop;
  -- Circular dependencies, by removing whatever has nothing left to wait for.
  declare
    remaining jsonb := p_def->'tasks';
    next_remaining jsonb;
    done_keys text[] := '{}';
    progressed boolean := true;
  begin
    while progressed and jsonb_array_length(remaining) > 0 loop
      progressed := false;
      next_remaining := '[]';
      for t in select jsonb_array_elements(remaining) loop
        if not exists (
          select 1 from jsonb_array_elements_text(coalesce(t->'depends_on', '[]')) x where not (x = any (done_keys))
        ) then
          done_keys := done_keys || (t->>'key');
          progressed := true;
        else
          next_remaining := next_remaining || jsonb_build_array(t);
        end if;
      end loop;
      remaining := next_remaining;
    end loop;
    if jsonb_array_length(remaining) > 0 then
      raise exception 'These template tasks wait on each other in a circle' using errcode = 'P0422';
    end if;
  end;
  if p_def ? 'sop_ids' and exists (
    select 1 from jsonb_array_elements_text(p_def->'sop_ids') x
    where not exists (select 1 from os.sops s where s.id::text = x)
  ) then
    raise exception 'A linked SOP no longer exists' using errcode = 'P0422';
  end if;
end $$;

create function private.anchor_time(p_anchor text, p_event_start timestamptz, p_event_end timestamptz, p_starts date, p_due date) returns timestamptz
language plpgsql stable set search_path = '' as $$
begin
  return case p_anchor
    when 'event_start' then p_event_start
    when 'event_end' then coalesce(p_event_end, p_event_start)
    when 'project_start' then (p_starts::timestamp + time '17:00') at time zone 'America/Toronto'
    when 'project_due' then (p_due::timestamp + time '17:00') at time zone 'America/Toronto'
  end;
end $$;

-- Tier-specific days if the template has them, otherwise its default.
create function private.offset_days(p_offset jsonb, p_tier text) returns int
language sql immutable set search_path = '' as $$
  select case
    when p_offset is null then null
    when jsonb_typeof(p_offset) = 'number' then (p_offset #>> '{}')::int
    else coalesce((p_offset->>coalesce(p_tier, 'default'))::int, (p_offset->>'default')::int)
  end
$$;

create function private.position_holder(p_title text) returns uuid
language sql stable security definer set search_path = '' as $$
  select a.executive_id
  from os.position_assignments a
  join os.positions p on p.id = a.position_id
  join os.executives e on e.id = a.executive_id
  where p.title = p_title and e.status = 'active' and a.during @> private.today()
  order by a.seat_no limit 1
$$;

-- Tasks and subtasks for one project, from one saved template version. A date
-- that has already passed becomes today, and is flagged rather than quietly
-- planted in the past.
create function private.materialize_tasks(p_project uuid, p_version uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  p record;
  ev_start timestamptz;
  ev_end timestamptz;
  def jsonb;
  facts jsonb := '{}';
  tier_ text;
  t jsonb;
  s jsonb;
  dep text;
  anchor_ text;
  days_ int;
  anchor_at timestamptz;
  due timestamptz;
  clamped boolean;
  tid uuid;
  key_ text;
  assignee uuid;
  made int := 0;
  end_of_today timestamptz := ((private.today()::timestamp + time '23:59') at time zone 'America/Toronto');
begin
  select * into p from os.projects where id = p_project;
  select definition into def from os.template_versions where id = p_version;
  if p.event_id is not null then
    select to_jsonb(e), e.tier, e.starts_at, e.ends_at into facts, tier_, ev_start, ev_end from os.events e where e.id = p.event_id;
  end if;
  assignee := p.lead_executive_id;

  for t in select jsonb_array_elements(def->'tasks') loop
    continue when not private.eval_condition(t->'condition', facts);
    anchor_ := coalesce(t->>'anchor', def->>'anchor');
    days_ := private.offset_days(t->'offset', tier_);
    anchor_at := private.anchor_time(anchor_, ev_start, ev_end, p.starts_on, p.due_on);
    due := anchor_at + make_interval(days => coalesce(days_, 0));
    clamped := due is not null and due < now();
    if clamped then due := end_of_today; end if;

    insert into os.tasks (project_id, title, description, deliverables, requesting_department_id, responsible_department_id,
      assigned_to, status, priority, due_at, due_source, offset_anchor, offset_days, due_was_clamped, source, template_task_key,
      template_version_id, visibility)
    values (p_project, t->>'title', coalesce(t->>'description', ''), coalesce(t->>'deliverables', ''),
      p.owning_department_id, p.owning_department_id, assignee, case when assignee is null then 'unassigned' else 'todo' end,
      coalesce(t->>'priority', 'normal'), due, 'template', anchor_, days_, clamped, 'automation', t->>'key', p_version,
      coalesce(t->>'visibility', 'project'))
    on conflict (project_id, template_task_key) do nothing
    returning id into tid;
    continue when tid is null;
    made := made + 1;
    insert into os.task_assignment_history (task_id, assigned_to, note) values (tid, assignee, 'Generated from template');

    for s in select jsonb_array_elements(coalesce(t->'subtasks', '[]')) loop
      continue when not private.eval_condition(s->'condition', facts);
      key_ := (t->>'key') || '.' || (s->>'key');
      days_ := coalesce(private.offset_days(s->'offset', tier_), private.offset_days(t->'offset', tier_));
      due := anchor_at + make_interval(days => coalesce(days_, 0));
      clamped := due is not null and due < now();
      if clamped then due := end_of_today; end if;
      insert into os.tasks (project_id, parent_task_id, title, description, requesting_department_id, responsible_department_id,
        assigned_to, status, priority, due_at, due_source, offset_anchor, offset_days, due_was_clamped, source, template_task_key,
        template_version_id, visibility)
      values (p_project, tid, s->>'title', coalesce(s->>'description', ''), p.owning_department_id, p.owning_department_id,
        assignee, case when assignee is null then 'unassigned' else 'todo' end, coalesce(s->>'priority', t->>'priority', 'normal'),
        due, 'template', anchor_, days_, clamped, 'automation', key_, p_version, coalesce(t->>'visibility', 'project'))
      on conflict (project_id, template_task_key) do nothing;
      made := made + 1;
    end loop;
  end loop;

  for t in select jsonb_array_elements(def->'tasks') loop
    for dep in select jsonb_array_elements_text(coalesce(t->'depends_on', '[]')) loop
      insert into os.task_dependencies (task_id, depends_on_task_id)
      select a.id, b.id from os.tasks a, os.tasks b
      where a.project_id = p_project and b.project_id = p_project
        and a.template_task_key = t->>'key' and b.template_task_key = dep
      on conflict do nothing;
    end loop;
  end loop;
  -- Generated tasks that wait on something start out blocked, not ready.
  update os.tasks tk set status = 'blocked', blocked_auto = true
  where tk.project_id = p_project and tk.source = 'automation' and tk.status = 'todo'
    and exists (select 1 from os.task_dependencies d join os.tasks b on b.id = d.depends_on_task_id
                where d.task_id = tk.id and b.status not in ('done', 'cancelled'));

  -- Pin the SOP version in force today, so the project keeps it as the SOP moves on.
  insert into os.project_sop_refs (project_id, sop_version_id)
  select p_project, s.current_version_id
  from jsonb_array_elements_text(coalesce(def->'sop_ids', '[]')) x
  join os.sops s on s.id::text = x
  where s.current_version_id is not null
  on conflict do nothing;
  return made;
end $$;

-- Manual project, chosen template. Called from api.create_project after that
-- function has authorized the caller.
create function private.initialize_from_template(p_project uuid, p_template uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p record;
  tpl record;
  def jsonb;
  holder uuid;
  made int;
begin
  select * into p from os.projects where id = p_project for update;
  select * into tpl from os.templates where id = p_template and archived_at is null;
  if not found or tpl.current_version_id is null then
    raise exception 'That template is not available' using errcode = 'P0422';
  end if;
  if (tpl.kind = 'global' and p.kind <> 'GLOBAL') or (tpl.kind = 'internal' and p.kind <> 'INTERNAL')
     or (tpl.kind = 'event_project' and p.kind <> 'EVENT') then
    raise exception 'That template is for a different kind of project' using errcode = 'P0422';
  end if;
  if tpl.kind = 'internal' and tpl.department_id is distinct from p.owning_department_id then
    raise exception 'That template belongs to another department' using errcode = 'P0422';
  end if;
  select definition into def from os.template_versions where id = tpl.current_version_id;
  holder := private.position_holder(def->>'lead_position');
  update os.projects set template_id = p_template, template_version_id = tpl.current_version_id,
    lead_executive_id = coalesce(lead_executive_id, holder) where id = p_project;
  made := private.materialize_tasks(p_project, tpl.current_version_id);
  perform private.audit('project.initialized', 'project', p_project,
    jsonb_build_object('template_version_id', tpl.current_version_id, 'tasks', made));
end $$;

-- Event approved: one project per template whose conditions this event meets.
create function private.generate_event_projects(p_event uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  ev record;
  facts jsonb;
  tpl record;
  def jsonb;
  has_list boolean;
  pid uuid;
  lead_ uuid;
  made int := 0;
begin
  select * into ev from os.events where id = p_event;
  facts := to_jsonb(ev);
  has_list := exists (select 1 from os.event_departments where event_id = p_event);
  for tpl in
    select t.*, v.definition from os.templates t join os.template_versions v on v.id = t.current_version_id
    where t.kind = 'event_project' and t.archived_at is null
    order by t.key
  loop
    def := tpl.definition;
    continue when def ? 'tiers' and jsonb_typeof(def->'tiers') = 'array' and not (def->'tiers' ? ev.tier);
    continue when not private.eval_condition(def->'activation', facts);
    continue when has_list and not exists (
      select 1 from os.event_departments where event_id = p_event and department_id = tpl.department_id
    );
    lead_ := private.position_holder(def->>'lead_position');
    insert into os.projects (kind, event_id, owning_department_id, lead_executive_id, name, summary, starts_on, due_on, status,
      template_id, template_version_id, academic_year_id, visibility)
    values ('EVENT', p_event, tpl.department_id, lead_, ev.name || ' — ' || coalesce(def->>'project_name', tpl.name), coalesce(def->>'summary', ''),
      private.today(), (coalesce(ev.ends_at, ev.starts_at) at time zone 'America/Toronto')::date + coalesce((def->>'closes_days_after')::int, 14),
      'active', tpl.id, tpl.current_version_id, ev.academic_year_id, 'participants')
    on conflict (event_id, template_id) where event_id is not null and template_id is not null do nothing
    returning id into pid;
    continue when pid is null;
    perform private.materialize_tasks(pid, tpl.current_version_id);
    perform private.audit('project.generated', 'project', pid, jsonb_build_object('event_id', p_event, 'template_version_id', tpl.current_version_id));
    perform private.notify_heads(tpl.department_id, 'project.generated', 'project', pid, 'generated:' || pid);
    made := made + 1;
  end loop;
  return made;
end $$;

-- The shared recalculation: template-dated, unfinished, unarchived. A hand-set
-- date has due_source = 'manual' and is never in this set.
create function private.recalculate_tasks(p_project uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  p record;
  ev_start timestamptz;
  ev_end timestamptz;
  t record;
  due timestamptz;
  clamped boolean;
  who uuid;
  moved int := 0;
begin
  select * into p from os.projects where id = p_project and archived_at is null;
  if not found then return 0; end if;
  if p.event_id is not null then select starts_at, ends_at into ev_start, ev_end from os.events where id = p.event_id; end if;
  for t in
    select * from os.tasks
    where project_id = p_project and due_source = 'template' and status not in ('done', 'cancelled')
    for update
  loop
    due := private.anchor_time(t.offset_anchor, ev_start, ev_end, p.starts_on, p.due_on) + make_interval(days => coalesce(t.offset_days, 0));
    clamped := due is not null and due < now();
    if clamped then due := (private.today()::timestamp + time '23:59') at time zone 'America/Toronto'; end if;
    continue when due is not distinct from t.due_at;
    update os.tasks set due_at = due, due_was_clamped = clamped where id = t.id;
    for who in select x from unnest(array[t.assigned_to, t.assigned_by]) x where x is not null loop
      perform private.notify(who, 'task.deadline_changed', 'task', t.id, 'deadline:' || t.id || ':' || due);
    end loop;
    moved := moved + 1;
  end loop;
  return moved;
end $$;

create function private.recalculate_project_dates(p_project uuid) returns int
language sql security definer set search_path = '' as $$
  select private.recalculate_tasks(p_project)
$$;

create function private.recalculate_event_dates(p_event uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid;
  ev record;
  moved int := 0;
begin
  select * into ev from os.events where id = p_event;
  for pid in select id from os.projects where event_id = p_event and archived_at is null loop
    update os.projects p set due_on = (coalesce(ev.ends_at, ev.starts_at) at time zone 'America/Toronto')::date
      + coalesce((select (v.definition->>'closes_days_after')::int from os.template_versions v where v.id = p.template_version_id), 14)
    where p.id = pid and p.template_version_id is not null;
    moved := moved + private.recalculate_tasks(pid);
  end loop;
  return moved;
end $$;

-- ─── Admin: templates and rules ────────────────────────────────────────────
create function api.save_template(p_id uuid, p_key text, p_kind text, p_name text, p_description text, p_department uuid, p_definition jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  tid uuid := p_id;
  tpl record;
  next_version int;
  vid uuid;
begin
  perform private.require_admin();
  if tid is null then
    perform private.validate_template_definition(p_definition, p_kind);
    insert into os.templates (key, kind, name, description, department_id)
    values (p_key, p_kind, trim(p_name), coalesce(p_description, ''), p_department) returning * into tpl;
    tid := tpl.id;
  else
    select * into tpl from os.templates where id = tid for update;
    if not found then perform private.not_found(); end if;
    perform private.validate_template_definition(p_definition, tpl.kind);
    update os.templates set name = trim(p_name), description = coalesce(p_description, ''), department_id = p_department where id = tid;
  end if;
  select coalesce(max(version), 0) + 1 into next_version from os.template_versions where template_id = tid;
  insert into os.template_versions (template_id, version, definition, created_by)
  values (tid, next_version, p_definition, auth.uid()) returning id into vid;
  update os.templates set current_version_id = vid where id = tid;
  perform private.audit('template.saved', 'template', tid, jsonb_build_object('version', next_version));
  return tid;
end $$;
grant execute on function api.save_template(uuid, text, text, text, text, uuid, jsonb) to authenticated;

create function api.set_template_archived(p_id uuid, p_archived boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update os.templates set archived_at = case when p_archived then now() end where id = p_id;
  if not found then perform private.not_found(); end if;
  perform private.audit(case when p_archived then 'template.archived' else 'template.restored' end, 'template', p_id);
end $$;
grant execute on function api.set_template_archived(uuid, boolean) to authenticated;

create function api.update_automation_rule(p_id uuid, p_enabled boolean, p_schedule jsonb, p_config jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update os.automation_rules set enabled = p_enabled, schedule = coalesce(p_schedule, schedule), config = coalesce(p_config, config), updated_by = auth.uid()
  where id = p_id;
  if not found then perform private.not_found(); end if;
  perform private.audit('automation.rule_changed', 'automation_rule', p_id, jsonb_build_object('enabled', p_enabled));
end $$;
grant execute on function api.update_automation_rule(uuid, boolean, jsonb, jsonb) to authenticated;

create function api.retry_job(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update os.jobs set state = 'pending', attempts = 0, next_run_at = now(), last_error = null
  where id = p_id and state in ('failed', 'dead');
  if not found then perform private.not_found(); end if;
  perform private.audit('job.retried', 'job', p_id);
end $$;
grant execute on function api.retry_job(uuid) to authenticated;

-- ─── Jobs ──────────────────────────────────────────────────────────────────
create function private.handle_job(j os.jobs) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p record;
  ev record;
  v jsonb;
  f jsonb;
  who uuid;
begin
  if j.kind = 'project.completed' then
    -- Follow-up tasks the project's template asks for, once, keyed so a retry or
    -- a second completion cannot make them again.
    select * into p from os.projects where id = j.entity_id;
    if not found or p.archived_at is not null or p.template_version_id is null then return; end if;
    select definition into v from os.template_versions where id = p.template_version_id;
    for f in select jsonb_array_elements(coalesce(v->'followups', '[]')) loop
      insert into os.tasks (project_id, title, description, requesting_department_id, responsible_department_id, assigned_to, status,
        priority, due_at, due_source, source, template_task_key, template_version_id)
      select p.id, f->>'title', coalesce(f->>'description', ''), d, d, p.lead_executive_id,
        case when p.lead_executive_id is null then 'unassigned' else 'todo' end, coalesce(f->>'priority', 'normal'),
        now() + make_interval(days => coalesce((f->>'due_days')::int, 7)), 'manual', 'automation',
        'followup.' || (f->>'key'), p.template_version_id
      from (select coalesce(p.owning_department_id, (select id from os.departments where slug = 'presidents-office')) as d) x
      on conflict (project_id, template_task_key) do nothing;
    end loop;
  elsif j.kind = 'event.completed' then
    select * into ev from os.events where id = j.entity_id;
    if not found then return; end if;
    if ev.submitted_by is not null then
      perform private.notify(ev.submitted_by, 'event.closed', 'event', ev.id, 'event-closed:' || ev.id);
    end if;
    for who in select executive_id from os.event_leads where event_id = ev.id loop
      perform private.notify(who, 'event.closed', 'event', ev.id, 'event-closed:' || ev.id);
    end loop;
  else
    raise exception 'No handler for job kind %', j.kind;
  end if;
end $$;

-- A chain deeper than this is a loop, and it stops here with an honest record
-- rather than running forever or vanishing.
create function private.max_job_depth() returns int language sql immutable set search_path = '' as $$ select 3 $$;

create function private.process_jobs(p_limit int default 50) returns int
language plpgsql security definer set search_path = '' as $$
declare
  j os.jobs;
  n int := 0;
begin
  for j in
    select * from os.jobs
    where state in ('pending', 'failed') and next_run_at <= now() and kind not like 'email.%'
    order by next_run_at
    limit p_limit
    -- Overlapping sweeps each take different rows and never wait on each other.
    for update skip locked
  loop
    if j.depth > private.max_job_depth() then
      update os.jobs set state = 'dead', last_error = 'Stopped: automation chain went deeper than ' || private.max_job_depth(), finished_at = now() where id = j.id;
      continue;
    end if;
    begin
      perform private.handle_job(j);
      update os.jobs set state = 'done', attempts = j.attempts + 1, finished_at = now(), last_error = null where id = j.id;
    exception when others then
      -- One failure stops one job. The exception block undoes that job's partial
      -- work and the sweep carries on.
      update os.jobs set
        attempts = j.attempts + 1,
        state = case when j.attempts + 1 >= j.max_attempts then 'dead' else 'failed' end,
        next_run_at = now() + make_interval(mins => power(2, j.attempts + 1)::int * 5),
        last_error = left(sqlerrm, 500),
        finished_at = case when j.attempts + 1 >= j.max_attempts then now() end
      where id = j.id;
    end;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ─── Reminders ─────────────────────────────────────────────────────────────
-- Each of these is safe to re-run: the dedupe key is what limits the noise.
create function private.rule_due_soon(cfg jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select t.id, t.assigned_to, t.due_at, d::int as days
    from os.tasks t join os.projects p on p.id = t.project_id
    cross join lateral jsonb_array_elements_text(coalesce(cfg->'days', '[7,2,1]')) d
    where p.archived_at is null and t.status not in ('done', 'cancelled', 'submitted') and t.assigned_to is not null
      and (t.due_at at time zone 'America/Toronto')::date = private.today() + d::int
  loop
    perform private.notify(r.assigned_to, 'deadline.upcoming', 'task', r.id, 'due-soon:' || r.id || ':' || r.due_at || ':' || r.days);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Once when it goes overdue, then once a week, and to the head after a while.
create function private.rule_overdue(cfg jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
  week_ text := to_char(private.today(), 'IYYY-IW');
begin
  for r in
    select t.id, t.assigned_to, t.due_at, t.responsible_department_id as dept
    from os.tasks t join os.projects p on p.id = t.project_id
    where p.archived_at is null and t.status not in ('done', 'cancelled', 'submitted') and t.due_at < now()
  loop
    perform private.notify(r.assigned_to, 'deadline.overdue', 'task', r.id, 'overdue:' || r.id || ':' || r.due_at || ':' || week_);
    if r.due_at < now() - make_interval(days => coalesce((cfg->>'escalate_days')::int, 3)) then
      perform private.notify_heads(r.dept, 'deadline.overdue', 'task', r.id, 'overdue-head:' || r.id || ':' || r.due_at || ':' || week_);
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

create function private.rule_blocked(cfg jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
  week_ text := to_char(private.today(), 'IYYY-IW');
begin
  for r in
    select t.id, t.updated_at, t.responsible_department_id as dept
    from os.tasks t join os.projects p on p.id = t.project_id
    where p.archived_at is null and t.status = 'blocked'
      and t.updated_at < now() - make_interval(days => coalesce((cfg->>'days')::int, 3))
  loop
    perform private.notify_heads(r.dept, 'task.blocked_escalated', 'task', r.id, 'blocked-head:' || r.id || ':' || week_);
    if r.updated_at < now() - make_interval(days => coalesce((cfg->>'president_days')::int, 7)) then
      perform private.notify_presidents('task.blocked_escalated', 'task', r.id, 'blocked-president:' || r.id || ':' || week_);
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

create function private.rule_project_deadline(cfg jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id, lead_executive_id, due_on from os.projects
    where archived_at is null and status in ('planning', 'active', 'on_hold')
      and due_on between private.today() and private.today() + coalesce((cfg->>'days')::int, 7)
  loop
    perform private.notify(r.lead_executive_id, 'project.deadline', 'project', r.id, 'project-due:' || r.id || ':' || r.due_on);
    n := n + 1;
  end loop;
  return n;
end $$;

create function private.rule_pending_approval(cfg jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
  days_ int := coalesce((cfg->>'days')::int, 3);
  bucket text := (extract(epoch from now())::bigint / (86400 * greatest(days_, 1)))::text;
begin
  for r in
    select 'event' as t, id from os.events where status = 'submitted' and submitted_at < now() - make_interval(days => days_)
    union all
    select 'project', p.id from os.projects p where p.kind = 'GLOBAL' and p.approval_status = 'pending' and p.updated_at < now() - make_interval(days => days_)
  loop
    perform private.notify_presidents('approval.pending', r.t, r.id, 'approval-pending:' || r.id || ':' || bucket);
    n := n + 1;
  end loop;
  return n;
end $$;

create function private.rule_sop_review(cfg jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id, department_id, responsible_executive_id, review_on from os.sops
    where archived_at is null and review_on <= private.today() + coalesce((cfg->>'days')::int, 14)
  loop
    if r.responsible_executive_id is not null then
      perform private.notify(r.responsible_executive_id, 'sop.review_due', 'sop', r.id, 'sop-review:' || r.id || ':' || r.review_on);
    else
      perform private.notify_heads(r.department_id, 'sop.review_due', 'sop', r.id, 'sop-review:' || r.id || ':' || r.review_on);
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Off until an administrator turns them on: authorizing the archive is theirs.
create function private.rule_auto_archive(cfg jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  days_ int := coalesce((cfg->>'days')::int, 90);
  r record;
  n int := 0;
begin
  for r in
    select id from os.projects
    where archived_at is null and status = 'completed' and completed_at < now() - make_interval(days => days_)
      and not exists (select 1 from os.tasks t where t.project_id = os.projects.id and t.status not in ('done', 'cancelled'))
    for update
  loop
    update os.projects set archived_at = now() where id = r.id;
    perform private.audit('project.archived', 'project', r.id, '{"automatic":true}');
    n := n + 1;
  end loop;
  for r in
    select e.id from os.events e
    where e.status = 'completed' and e.updated_at < now() - make_interval(days => days_)
      and not exists (select 1 from os.projects p where p.event_id = e.id and p.archived_at is null)
    for update
  loop
    update os.events set status = 'archived', archived_at = now() where id = r.id;
    perform private.audit('event.archived', 'event', r.id, '{"automatic":true}');
    n := n + 1;
  end loop;
  return n;
end $$;

-- ─── Recurring work ────────────────────────────────────────────────────────
-- Which occurrence, if any, is due now. Asking "has this period's turn arrived"
-- rather than "is today the day" means a paused sweep catches up when it returns.
create function private.recurring_occurrence(p_schedule jsonb) returns text
language plpgsql stable set search_path = '' as $$
declare
  today_ date := private.today();
begin
  case p_schedule->>'freq'
    when 'weekly' then
      if extract(isodow from today_) >= coalesce((p_schedule->>'weekday')::int, 1) then return to_char(today_, 'IYYY-"W"IW'); end if;
    when 'monthly' then
      if extract(day from today_) >= coalesce((p_schedule->>'day')::int, 1) then return to_char(today_, 'YYYY-MM'); end if;
    when 'yearly' then
      if p_schedule->'months' @> to_jsonb(extract(month from today_)::int)
         and extract(day from today_) >= coalesce((p_schedule->>'day')::int, 1) then
        return to_char(today_, 'YYYY-MM');
      end if;
    else
      return null;
  end case;
  return null;
end $$;

-- Tasks always belong to a project, so a department's recurring work has one.
create function private.recurring_project(p_department uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  skey text := 'recurring:' || p_department;
  pid uuid;
begin
  select id into pid from os.projects where system_key = skey;
  if pid is not null then return pid; end if;
  insert into os.projects (kind, owning_department_id, name, summary, status, system_key, academic_year_id)
  values ('INTERNAL', p_department, 'Recurring operations', 'Regular reviews and reports, generated on schedule.', 'active', skey, private.current_year())
  on conflict (system_key) do nothing
  returning id into pid;
  if pid is null then select id into pid from os.projects where system_key = skey; end if;
  return pid;
end $$;

create function private.run_recurring_rule(p_rule os.automation_rules, p_occurrence text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  dept uuid;
  pid uuid;
  assignee uuid;
  tid uuid;
begin
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

-- ─── The sweep ─────────────────────────────────────────────────────────────
create function private.run_rule(r os.automation_rules, p_occurrence text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  run_id uuid;
  n int := 0;
begin
  -- The insert IS the lock: a second sweep gets no row back and moves on.
  insert into os.automation_runs (rule_id, occurrence_key) values (r.id, p_occurrence)
  on conflict (rule_id, occurrence_key) do nothing
  returning id into run_id;
  if run_id is null then return; end if;
  begin
    if r.category = 'recurring' then
      n := private.run_recurring_rule(r, p_occurrence);
    else
      n := case r.key
        when 'deadline_upcoming' then private.rule_due_soon(r.config)
        when 'deadline_overdue' then private.rule_overdue(r.config)
        when 'blocked_escalation' then private.rule_blocked(r.config)
        when 'project_deadline' then private.rule_project_deadline(r.config)
        when 'approval_pending' then private.rule_pending_approval(r.config)
        when 'sop_review' then private.rule_sop_review(r.config)
        when 'auto_archive' then private.rule_auto_archive(r.config)
      end;
    end if;
    update os.automation_runs set status = 'succeeded', items_created = coalesce(n, 0), finished_at = now() where id = run_id;
  exception when others then
    update os.automation_runs set status = 'failed', error = left(sqlerrm, 500), finished_at = now() where id = run_id;
  end;
end $$;

create function private.enqueue_digests() returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select distinct x.recipient_id from os.notifications x
    join os.executives e on e.id = x.recipient_id and e.status = 'active'
    left join os.notification_preferences p on p.executive_id = x.recipient_id
    where x.emailed_at is null and x.read_at is null and coalesce(p.email_digest, true)
  loop
    perform private.enqueue('email.digest', 'executive', r.recipient_id, '{}', 'digest:' || r.recipient_id || ':' || private.today());
    n := n + 1;
  end loop;
  return n;
end $$;

-- Asks the app to send anything queued. A wake-up only: it carries no content,
-- and the route it calls proves itself with the shared secret. With no URL
-- configured, or no pg_net, the daily GitHub Action covers this.
create table private.config (key text primary key, value text not null);

create function private.wake_email_worker() returns void
language plpgsql security definer set search_path = '' as $$
declare
  url_ text;
  secret_ text;
begin
  select value into url_ from private.config where key = 'jobs_url';
  select value into secret_ from private.config where key = 'jobs_secret';
  if url_ is null or secret_ is null then return; end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then return; end if;
  if not exists (select 1 from os.jobs where kind like 'email.%' and state in ('pending', 'failed') and next_run_at <= now()) then return; end if;
  execute 'select net.http_post(url := $1, headers := $2, body := ''{}''::jsonb)'
    using url_, jsonb_build_object('Authorization', 'Bearer ' || secret_, 'Content-Type', 'application/json');
exception when others then
  -- A failed wake-up costs one digest's timing, never the sweep.
  raise warning 'email wake-up failed: %', sqlerrm;
end $$;

create function private.prune_logs() returns void
language plpgsql security definer set search_path = '' as $$
declare
  notif_days int := coalesce((select (value #>> '{}')::int from os.settings where key = 'notification_retention_days'), 365);
  run_days int := coalesce((select (value #>> '{}')::int from os.settings where key = 'run_log_retention_days'), 365);
begin
  delete from os.notifications where read_at < now() - make_interval(days => notif_days);
  delete from os.automation_runs where started_at < now() - make_interval(days => run_days);
  delete from os.jobs where state = 'done' and finished_at < now() - make_interval(days => run_days);
end $$;

create function private.run_sweep() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r os.automation_rules;
  occ text;
  jobs_done int;
begin
  jobs_done := private.process_jobs();
  for r in select * from os.automation_rules where enabled order by key loop
    occ := case r.category
      when 'recurring' then private.recurring_occurrence(r.schedule)
      else private.today()::text
    end;
    continue when occ is null;
    perform private.run_rule(r, occ);
  end loop;
  perform private.enqueue_digests();
  perform private.prune_logs();
  perform private.wake_email_worker();
  update os.settings set value = to_jsonb(now()), updated_at = now() where key = 'sweep_heartbeat';
  return jsonb_build_object('jobs', jobs_done, 'at', now());
end $$;

-- Admin "run now", and the fallback route if pg_cron is unavailable on a project.
create function api.run_sweep_now() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  perform private.audit('automation.sweep_run', 'automation', null);
  return private.run_sweep();
end $$;
grant execute on function api.run_sweep_now() to authenticated;

create function api.service_run_sweep() returns jsonb
language sql security definer set search_path = '' as $$
  select private.run_sweep()
$$;
grant execute on function api.service_run_sweep() to service_role;

-- What the email route may send: an address and a count, never content. Claiming
-- marks the notifications, so a crash mid-send cannot double-send on retry.
create function api.service_claim_emails(p_limit int default 20)
returns table (job_id uuid, email text, preferred_name text, unread int)
language plpgsql security definer set search_path = '' as $$
declare
  j record;
  addr text;
  nm text;
  cnt int;
begin
  for j in
    select * from os.jobs where kind = 'email.digest' and state in ('pending', 'failed') and next_run_at <= now()
    order by next_run_at limit least(greatest(coalesce(p_limit, 20), 1), 100) for update skip locked
  loop
    select e.email, coalesce(e.preferred_name, e.full_name) into addr, nm
    from os.executives e where e.id = j.entity_id and e.status = 'active';
    select count(*) into cnt from os.notifications n where n.recipient_id = j.entity_id and n.emailed_at is null and n.read_at is null;
    if addr is null or cnt = 0 then
      update os.jobs set state = 'done', finished_at = now() where id = j.id;
      continue;
    end if;
    update os.jobs set state = 'running', attempts = attempts + 1 where id = j.id;
    update os.notifications n set emailed_at = now() where n.recipient_id = j.entity_id and n.emailed_at is null and n.read_at is null;
    job_id := j.id; email := addr; preferred_name := nm; unread := cnt;
    return next;
  end loop;
end $$;
grant execute on function api.service_claim_emails(int) to service_role;

create function api.service_finish_email(p_job uuid, p_ok boolean, p_error text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update os.jobs set
    state = case when p_ok then 'done' when attempts >= max_attempts then 'dead' else 'failed' end,
    last_error = case when p_ok then null else left(coalesce(p_error, 'send failed'), 500) end,
    next_run_at = case when p_ok then next_run_at else now() + make_interval(mins => power(2, attempts)::int * 5) end,
    finished_at = case when p_ok or attempts >= max_attempts then now() end
  where id = p_job;
end $$;
grant execute on function api.service_finish_email(uuid, boolean, text) to service_role;

create function api.service_health() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'heartbeat', (select value from os.settings where key = 'sweep_heartbeat'),
    'failed_jobs', (select count(*) from os.jobs where state = 'dead')
  )
$$;
grant execute on function api.service_health() to service_role;

-- pg_cron, if this project has it. The migration still succeeds without it, and
-- docs/WEC-OS.md covers the signed-route fallback.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('wec-os-sweep', '*/15 * * * *', 'select private.run_sweep()');
  else
    raise notice 'pg_cron is not available: use the signed sweep route instead';
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end $$;
