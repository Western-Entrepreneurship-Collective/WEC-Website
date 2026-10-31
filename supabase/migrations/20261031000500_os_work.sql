-- WEC OS work: events, projects, tasks, cross-team requests.
-- Every function here is one transaction: it authorizes its caller, locks what it
-- changes, writes the audit row, and notifies. There is no other way to write.

create function private.not_found() returns void language plpgsql set search_path = '' as $$
begin
  raise exception 'Not found' using errcode = 'P0404';
end $$;

create function private.current_year() returns uuid language sql stable security definer set search_path = '' as $$
  select id from os.academic_years where is_current
$$;

-- Optimistic concurrency: an edit based on a stale page fails rather than
-- silently overwriting what someone else just saved.
create function private.check_version(p_expected timestamptz, p_actual timestamptz) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_expected is not null and p_expected is distinct from p_actual then
    raise exception 'Someone else changed this while you were editing. Reload and try again.' using errcode = 'P0409';
  end if;
end $$;

create function private.notify_heads(p_department uuid, p_kind text, p_type text, p_id uuid, p_dedupe text) returns void
language plpgsql security definer set search_path = '' as $$
declare h uuid;
begin
  for h in select private.department_heads(p_department) loop
    perform private.notify(h, p_kind, p_type, p_id, p_dedupe);
  end loop;
end $$;

create function private.notify_presidents(p_kind text, p_type text, p_id uuid, p_dedupe text) returns void
language plpgsql security definer set search_path = '' as $$
declare h uuid;
begin
  for h in
    select a.executive_id from os.position_assignments a
    join os.positions p on p.id = a.position_id
    where p.org_role = 'president' and a.during @> private.today()
  loop
    perform private.notify(h, p_kind, p_type, p_id, p_dedupe);
  end loop;
end $$;

create function private.enqueue(p_kind text, p_type text, p_id uuid, p_payload jsonb, p_dedupe text, p_causation uuid default null, p_depth int default 0)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into os.jobs (kind, entity_type, entity_id, payload, dedupe_key, causation_id, depth)
  values (p_kind, p_type, p_id, coalesce(p_payload, '{}'), p_dedupe, p_causation, p_depth)
  on conflict (dedupe_key) do nothing;
end $$;

-- ─── Events ────────────────────────────────────────────────────────────────
-- Create or edit a proposal. Fields arrive as one JSON object, already validated
-- for shape by the server and for meaning by the table's constraints.
create function api.save_event(p_id uuid, p_fields jsonb, p_leads uuid[], p_departments uuid[], p_expected timestamptz default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  e record;
  ev uuid := p_id;
begin
  perform private.require_active();
  if ev is null then
    perform private.require_perm('event.submit');
    insert into os.events (name, program, description, objectives, tier, starts_at, ends_at, location, estimated_budget,
      requires_speakers, requires_registration, requires_member_participation, requires_sponsorship, requires_finance,
      requires_communications, requires_founder_support, requires_media, requires_logistics,
      marketing_notes, registration_notes, sponsorship_notes, submitted_by, academic_year_id)
    values (p_fields->>'name', coalesce(p_fields->>'program', ''), coalesce(p_fields->>'description', ''), coalesce(p_fields->>'objectives', ''),
      p_fields->>'tier', (p_fields->>'starts_at')::timestamptz, nullif(p_fields->>'ends_at', '')::timestamptz, coalesce(p_fields->>'location', ''),
      nullif(p_fields->>'estimated_budget', '')::numeric,
      coalesce((p_fields->>'requires_speakers')::boolean, false), coalesce((p_fields->>'requires_registration')::boolean, false),
      coalesce((p_fields->>'requires_member_participation')::boolean, false), coalesce((p_fields->>'requires_sponsorship')::boolean, false),
      coalesce((p_fields->>'requires_finance')::boolean, false), coalesce((p_fields->>'requires_communications')::boolean, false),
      coalesce((p_fields->>'requires_founder_support')::boolean, false), coalesce((p_fields->>'requires_media')::boolean, false),
      coalesce((p_fields->>'requires_logistics')::boolean, false),
      coalesce(p_fields->>'marketing_notes', ''), coalesce(p_fields->>'registration_notes', ''), coalesce(p_fields->>'sponsorship_notes', ''),
      auth.uid(), private.current_year())
    returning id into ev;
    perform private.audit('event.created', 'event', ev);
  else
    select * into e from os.events where id = ev for update;
    if not found or private.can_read_event(ev) is not true then perform private.not_found(); end if;
    perform private.check_version(p_expected, e.updated_at);
    if e.status not in ('draft', 'changes_requested') then
      raise exception 'An event under review or approved is changed through its own actions' using errcode = 'P0409';
    end if;
    if private.has_perm('event.submit') is not true and e.submitted_by is distinct from auth.uid() then
      raise exception 'You do not have permission for that' using errcode = 'P0403';
    end if;
    update os.events set
      name = p_fields->>'name', program = coalesce(p_fields->>'program', ''), description = coalesce(p_fields->>'description', ''),
      objectives = coalesce(p_fields->>'objectives', ''), tier = p_fields->>'tier',
      starts_at = (p_fields->>'starts_at')::timestamptz, ends_at = nullif(p_fields->>'ends_at', '')::timestamptz,
      location = coalesce(p_fields->>'location', ''), estimated_budget = nullif(p_fields->>'estimated_budget', '')::numeric,
      requires_speakers = coalesce((p_fields->>'requires_speakers')::boolean, false),
      requires_registration = coalesce((p_fields->>'requires_registration')::boolean, false),
      requires_member_participation = coalesce((p_fields->>'requires_member_participation')::boolean, false),
      requires_sponsorship = coalesce((p_fields->>'requires_sponsorship')::boolean, false),
      requires_finance = coalesce((p_fields->>'requires_finance')::boolean, false),
      requires_communications = coalesce((p_fields->>'requires_communications')::boolean, false),
      requires_founder_support = coalesce((p_fields->>'requires_founder_support')::boolean, false),
      requires_media = coalesce((p_fields->>'requires_media')::boolean, false),
      requires_logistics = coalesce((p_fields->>'requires_logistics')::boolean, false),
      marketing_notes = coalesce(p_fields->>'marketing_notes', ''), registration_notes = coalesce(p_fields->>'registration_notes', ''),
      sponsorship_notes = coalesce(p_fields->>'sponsorship_notes', '')
    where id = ev;
    perform private.audit('event.edited', 'event', ev);
  end if;

  delete from os.event_leads where event_id = ev;
  insert into os.event_leads (event_id, executive_id) select ev, x from unnest(coalesce(p_leads, '{}')) x;
  delete from os.event_departments where event_id = ev;
  insert into os.event_departments (event_id, department_id) select ev, x from unnest(coalesce(p_departments, '{}')) x;
  return ev;
end $$;
grant execute on function api.save_event(uuid, jsonb, uuid[], uuid[], timestamptz) to authenticated;

create function api.set_event_guests(p_event uuid, p_guests jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare e record;
begin
  perform private.require_active();
  select * into e from os.events where id = p_event for update;
  if not found or private.can_read_event(p_event) is not true then perform private.not_found(); end if;
  if private.has_perm('event.edit') is not true and private.has_perm('event.submit') is not true
     and not exists (select 1 from os.event_leads where event_id = p_event and executive_id = auth.uid()) then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  delete from os.event_guests where event_id = p_event;
  insert into os.event_guests (event_id, name, role, status)
  select p_event, g->>'name', coalesce(g->>'role', ''), coalesce(g->>'status', 'proposed')
  from jsonb_array_elements(coalesce(p_guests, '[]')) g;
  perform private.audit('event.guests_changed', 'event', p_event);
end $$;
grant execute on function api.set_event_guests(uuid, jsonb) to authenticated;

create function api.submit_event(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare e record;
begin
  perform private.require_perm('event.submit');
  select * into e from os.events where id = p_event for update;
  if not found or private.can_read_event(p_event) is not true then perform private.not_found(); end if;
  if e.status not in ('draft', 'changes_requested') then
    raise exception 'That proposal is not a draft' using errcode = 'P0409';
  end if;
  update os.events set status = 'submitted', submitted_by = auth.uid(), submitted_at = now() where id = p_event;
  insert into os.approvals (entity_type, entity_id, decision, actor_id) values ('event', p_event, 'submitted', auth.uid());
  perform private.audit('event.submitted', 'event', p_event, jsonb_build_object('status', 'submitted'));
  perform private.notify_presidents('event.proposed', 'event', p_event, 'event-proposed:' || p_event || ':' || now()::date);
end $$;
grant execute on function api.submit_event(uuid) to authenticated;

-- Approve, reject, or return. Approval generates everything in this transaction:
-- if any template fails, the event stays submitted and nothing exists half made.
create function api.decide_event(p_event uuid, p_decision text, p_note text default '') returns int
language plpgsql security definer set search_path = '' as $$
declare
  e record;
  made int := 0;
begin
  perform private.require_perm('event.approve');
  if p_decision not in ('approved', 'rejected', 'changes_requested') then
    raise exception 'Unknown decision' using errcode = 'P0422';
  end if;
  select * into e from os.events where id = p_event for update;
  if not found or private.can_read_event(p_event) is not true then perform private.not_found(); end if;
  if e.status <> 'submitted' then
    raise exception 'That proposal is not waiting for a decision' using errcode = 'P0409';
  end if;
  if p_decision = 'changes_requested' and length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'Say what needs to change' using errcode = 'P0422';
  end if;
  update os.events set status = p_decision, decided_by = auth.uid(), decided_at = now() where id = p_event;
  insert into os.approvals (entity_type, entity_id, decision, actor_id, note) values ('event', p_event, p_decision, auth.uid(), coalesce(p_note, ''));
  perform private.audit('event.' || p_decision, 'event', p_event, jsonb_build_object('status', p_decision));
  if e.submitted_by is not null then
    perform private.notify(e.submitted_by, 'event.decided', 'event', p_event, 'event-decided:' || p_event || ':' || p_decision || ':' || now());
  end if;
  if p_decision = 'approved' then
    made := private.generate_event_projects(p_event);
  end if;
  return made;
end $$;
grant execute on function api.decide_event(uuid, text, text) to authenticated;

-- Moving an approved event moves the template dates under it, and nothing a
-- person set by hand.
create function api.reschedule_event(p_event uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_expected timestamptz default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  e record;
  moved int;
begin
  perform private.require_perm('event.edit');
  select * into e from os.events where id = p_event for update;
  if not found or private.can_read_event(p_event) is not true then perform private.not_found(); end if;
  perform private.check_version(p_expected, e.updated_at);
  update os.events set starts_at = p_starts_at, ends_at = p_ends_at where id = p_event;
  perform private.audit('event.rescheduled', 'event', p_event, jsonb_build_object('starts_at', p_starts_at));
  moved := private.recalculate_event_dates(p_event);
  return moved;
end $$;
grant execute on function api.reschedule_event(uuid, timestamptz, timestamptz, timestamptz) to authenticated;

create function api.set_event_status(p_event uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare e record;
begin
  perform private.require_perm('event.edit');
  if p_status not in ('approved', 'in_progress', 'completed') then
    raise exception 'Unknown status' using errcode = 'P0422';
  end if;
  select * into e from os.events where id = p_event for update;
  if not found or private.can_read_event(p_event) is not true then perform private.not_found(); end if;
  if e.status not in ('approved', 'in_progress', 'completed') then
    raise exception 'That event has not been approved' using errcode = 'P0409';
  end if;
  update os.events set status = p_status where id = p_event;
  perform private.audit('event.status_changed', 'event', p_event, jsonb_build_object('status', p_status));
  if p_status = 'completed' then
    perform private.enqueue('event.completed', 'event', p_event, '{}', 'event-completed:' || p_event);
  end if;
end $$;
grant execute on function api.set_event_status(uuid, text) to authenticated;

-- Closing takes the event and every project under it out of circulation.
-- Nothing is deleted. A Restore in the admin console brings it back.
create function api.archive_event(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare e record;
begin
  perform private.require_perm('event.archive');
  select * into e from os.events where id = p_event for update;
  if not found or private.can_read_event(p_event) is not true then perform private.not_found(); end if;
  if e.status not in ('completed', 'rejected') then
    raise exception 'Only a completed or rejected event can be archived' using errcode = 'P0409';
  end if;
  update os.projects set archived_at = now() where event_id = p_event and archived_at is null;
  update os.events set status = 'archived', archived_at = now() where id = p_event;
  perform private.audit('event.archived', 'event', p_event);
end $$;
grant execute on function api.archive_event(uuid) to authenticated;

-- ─── Projects ──────────────────────────────────────────────────────────────
-- Who may start a project of this kind, under this department and event.
create function private.authorize_project_create(p_kind text, p_department uuid, p_event uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_kind = 'GLOBAL' then
    perform private.require_perm('global.submit');
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

create function api.create_project(p_fields jsonb, p_departments uuid[] default '{}', p_template uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  kind_ text := p_fields->>'kind';
  dept uuid := nullif(p_fields->>'owning_department_id', '')::uuid;
  ev uuid := nullif(p_fields->>'event_id', '')::uuid;
  lead_ uuid := nullif(p_fields->>'lead_executive_id', '')::uuid;
  pid uuid;
  approval text := 'not_required';
  president boolean;
begin
  perform private.require_active();
  perform private.authorize_project_create(kind_, dept, ev);
  president := private.is_president();
  -- A Global Project is owned by whoever raised it, for task routing only. It
  -- never narrows who sees the project: that is what visibility is for.
  if kind_ = 'GLOBAL' and dept is null then
    select department_id into dept from private.exec_positions(auth.uid()) limit 1;
  end if;
  -- The President's own Global Projects need no second signature. A VP's go to
  -- the President and stay off the Core Calendar until approved.
  if kind_ = 'GLOBAL' then approval := case when president then 'approved' else 'draft' end; end if;
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
    insert into os.project_departments (project_id, department_id) select pid, x from unnest(coalesce(p_departments, '{}')) x;
  end if;
  perform private.audit('project.created', 'project', pid, jsonb_build_object('kind', kind_));
  if approval = 'approved' then
    insert into os.approvals (entity_type, entity_id, decision, actor_id, note) values ('project', pid, 'approved', auth.uid(), 'Created by the President');
  end if;
  if p_template is not null then
    perform private.initialize_from_template(pid, p_template);
  end if;
  return pid;
end $$;
grant execute on function api.create_project(jsonb, uuid[], uuid) to authenticated;

create function private.can_manage_project(p_project uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare p record;
begin
  if private.is_active_exec() is not true then return false; end if;
  select kind, owning_department_id, lead_executive_id into p from os.projects where id = p_project;
  if not found then return false; end if;
  return private.is_president() or p.lead_executive_id = auth.uid()
    or (p.owning_department_id is not null and private.is_department_head(p.owning_department_id));
end $$;

-- Changing a project's dates recalculates the template-dated tasks under it.
create function api.update_project(p_project uuid, p_fields jsonb, p_expected timestamptz default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  p record;
  lead_ uuid := nullif(p_fields->>'lead_executive_id', '')::uuid;
  new_start date := nullif(p_fields->>'starts_on', '')::date;
  new_due date := nullif(p_fields->>'due_on', '')::date;
  moved int := 0;
begin
  perform private.require_active();
  select * into p from os.projects where id = p_project for update;
  if not found or private.can_read_project(p_project) is not true then perform private.not_found(); end if;
  if private.can_manage_project(p_project) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  perform private.check_version(p_expected, p.updated_at);
  if lead_ is not null and lead_ is distinct from p.lead_executive_id and private.exec_is_active(lead_) is not true then
    raise exception 'The project lead must have an active account' using errcode = 'P0422';
  end if;
  update os.projects set
    name = p_fields->>'name', summary = coalesce(p_fields->>'summary', ''), starts_on = new_start, due_on = new_due,
    lead_executive_id = lead_,
    share_progress_with_event_lead = coalesce((p_fields->>'share_progress_with_event_lead')::boolean, false)
      and kind = 'INTERNAL' and event_id is not null,
    visibility = case when kind = 'INTERNAL' then 'participants' else coalesce(nullif(p_fields->>'visibility', ''), visibility) end
  where id = p_project;
  perform private.audit('project.edited', 'project', p_project, jsonb_build_object('starts_on', new_start, 'due_on', new_due));
  if new_start is distinct from p.starts_on or new_due is distinct from p.due_on then
    moved := private.recalculate_project_dates(p_project);
  end if;
  return moved;
end $$;
grant execute on function api.update_project(uuid, jsonb, timestamptz) to authenticated;

create function api.set_project_status(p_project uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  perform private.require_active();
  if p_status not in ('planning', 'active', 'on_hold', 'completed', 'cancelled') then
    raise exception 'Unknown status' using errcode = 'P0422';
  end if;
  select * into p from os.projects where id = p_project for update;
  if not found or private.can_read_project(p_project) is not true then perform private.not_found(); end if;
  if private.can_manage_project(p_project) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  if p.kind = 'GLOBAL' and p.approval_status <> 'approved' then
    raise exception 'That project has not been approved' using errcode = 'P0409';
  end if;
  update os.projects set status = p_status, completed_at = case when p_status = 'completed' then now() else null end where id = p_project;
  perform private.audit('project.status_changed', 'project', p_project, jsonb_build_object('status', p_status));
  if p_status = 'completed' then
    perform private.enqueue('project.completed', 'project', p_project, '{}', 'project-completed:' || p_project);
  end if;
end $$;
grant execute on function api.set_project_status(uuid, text) to authenticated;

create function api.set_project_people(p_project uuid, p_departments uuid[], p_participants uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  perform private.require_active();
  select * into p from os.projects where id = p_project for update;
  if not found or private.can_read_project(p_project) is not true then perform private.not_found(); end if;
  if private.can_manage_project(p_project) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  delete from os.project_departments where project_id = p_project;
  -- Internal projects never gain participating departments.
  if p.kind <> 'INTERNAL' then
    insert into os.project_departments (project_id, department_id) select p_project, x from unnest(coalesce(p_departments, '{}')) x;
  end if;
  delete from os.project_participants where project_id = p_project;
  insert into os.project_participants (project_id, executive_id) select p_project, x from unnest(coalesce(p_participants, '{}')) x;
  perform private.audit('project.people_changed', 'project', p_project);
end $$;
grant execute on function api.set_project_people(uuid, uuid[], uuid[]) to authenticated;

create function api.archive_project(p_project uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  perform private.require_perm('project.archive');
  select * into p from os.projects where id = p_project for update;
  if not found or private.can_read_project(p_project) is not true then perform private.not_found(); end if;
  if private.can_manage_project(p_project) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  if p.status not in ('completed', 'cancelled') then
    raise exception 'Only a completed or cancelled project can be archived' using errcode = 'P0409';
  end if;
  update os.projects set archived_at = now() where id = p_project;
  perform private.audit('project.archived', 'project', p_project);
end $$;
grant execute on function api.archive_project(uuid) to authenticated;

-- ─── Global Project approval ───────────────────────────────────────────────
create function api.submit_global_project(p_project uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  perform private.require_perm('global.submit');
  select * into p from os.projects where id = p_project for update;
  if not found or p.kind <> 'GLOBAL' or private.can_read_project(p_project) is not true then perform private.not_found(); end if;
  if p.approval_status not in ('draft', 'changes_requested') then
    raise exception 'That project is not a draft' using errcode = 'P0409';
  end if;
  update os.projects set approval_status = 'pending' where id = p_project;
  insert into os.approvals (entity_type, entity_id, decision, actor_id) values ('project', p_project, 'submitted', auth.uid());
  perform private.audit('global.submitted', 'project', p_project, jsonb_build_object('approval_status', 'pending'));
  perform private.notify_presidents('global.proposed', 'project', p_project, 'global-proposed:' || p_project || ':' || now()::date);
end $$;
grant execute on function api.submit_global_project(uuid) to authenticated;

create function api.decide_global_project(p_project uuid, p_decision text, p_note text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  perform private.require_perm('global.approve');
  if p_decision not in ('approved', 'rejected', 'changes_requested') then
    raise exception 'Unknown decision' using errcode = 'P0422';
  end if;
  select * into p from os.projects where id = p_project for update;
  if not found or p.kind <> 'GLOBAL' or private.can_read_project(p_project) is not true then perform private.not_found(); end if;
  if p.approval_status <> 'pending' then
    raise exception 'That project is not waiting for a decision' using errcode = 'P0409';
  end if;
  update os.projects set approval_status = p_decision, decided_by = auth.uid(), decided_at = now(),
    status = case when p_decision = 'approved' then 'active' else status end
  where id = p_project;
  insert into os.approvals (entity_type, entity_id, decision, actor_id, note) values ('project', p_project, p_decision, auth.uid(), coalesce(p_note, ''));
  perform private.audit('global.' || p_decision, 'project', p_project, jsonb_build_object('approval_status', p_decision));
  if p.submitted_by is not null then
    perform private.notify(p.submitted_by, 'global.decided', 'project', p_project, 'global-decided:' || p_project || ':' || p_decision || ':' || now());
  end if;
end $$;
grant execute on function api.decide_global_project(uuid, text, text) to authenticated;

-- ─── Milestones ────────────────────────────────────────────────────────────
create function api.save_milestone(p_id uuid, p_project uuid, p_title text, p_due date, p_core boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  m uuid := p_id;
  core boolean := coalesce(p_core, false);
begin
  perform private.require_active();
  if p_project is not null then
    if private.can_read_project(p_project) is not true then perform private.not_found(); end if;
    if private.can_manage_project(p_project) is not true then
      raise exception 'You do not have permission for that' using errcode = 'P0403';
    end if;
  elsif private.is_president() is not true then
    raise exception 'Only the President adds organization-wide milestones' using errcode = 'P0403';
  end if;
  if core and private.is_president() is not true then
    raise exception 'Only the President places milestones on the Core Calendar' using errcode = 'P0403';
  end if;
  if m is null then
    insert into os.milestones (project_id, title, due_on, core_visible, created_by)
    values (p_project, trim(p_title), p_due, core, auth.uid()) returning id into m;
  else
    update os.milestones set title = trim(p_title), due_on = p_due, core_visible = core
    where id = m and project_id is not distinct from p_project;
    if not found then perform private.not_found(); end if;
  end if;
  perform private.audit('milestone.saved', 'milestone', m, jsonb_build_object('due_on', p_due, 'core', core));
  return m;
end $$;
grant execute on function api.save_milestone(uuid, uuid, text, date, boolean) to authenticated;

create function api.set_milestone_done(p_id uuid, p_done boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare m record;
begin
  perform private.require_active();
  select * into m from os.milestones where id = p_id for update;
  if not found then perform private.not_found(); end if;
  if m.project_id is not null then
    if private.can_read_project(m.project_id) is not true then perform private.not_found(); end if;
    if private.can_manage_project(m.project_id) is not true then
      raise exception 'You do not have permission for that' using errcode = 'P0403';
    end if;
  elsif private.is_president() is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  update os.milestones set completed_at = case when p_done then now() end where id = p_id;
end $$;
grant execute on function api.set_milestone_done(uuid, boolean) to authenticated;

-- ─── Tasks ─────────────────────────────────────────────────────────────────
-- Is this person allowed to take this assignment? Assignments stay inside the
-- responsible department, or to oneself: crossing teams is a request, not a task.
create function private.check_assignee(p_assignee uuid, p_department uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_assignee is null then return; end if;
  if private.exec_is_active(p_assignee) is not true then
    raise exception 'That person does not have an active account' using errcode = 'P0422';
  end if;
  if p_assignee = auth.uid() then return; end if;
  if private.exec_in_department(p_assignee, p_department) is not true
     and p_assignee not in (select private.department_heads(p_department)) then
    raise exception 'To give work to another department, send a cross-team request' using errcode = 'P0422';
  end if;
  if private.has_perm('task.assign') is not true then
    raise exception 'You can only assign tasks to yourself' using errcode = 'P0403';
  end if;
end $$;

create function private.record_assignment(p_task uuid, p_to uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into os.task_assignment_history (task_id, assigned_to, assigned_by, note) values (p_task, p_to, auth.uid(), coalesce(p_note, ''));
  if p_to is not null and p_to is distinct from auth.uid() then
    perform private.notify(p_to, 'task.assigned', 'task', p_task, 'assigned:' || p_task || ':' || p_to || ':' || now());
  end if;
end $$;

create function private.can_add_task_to_project(p_project uuid, p_department uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.has_perm('task.create') is not true or private.can_read_project(p_project) is not true then return false; end if;
  return private.is_president() or private.can_manage_project(p_project) or private.in_department(p_department);
end $$;

create function api.create_task(p_project uuid, p_fields jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  p record;
  parent_requesting uuid;
  parent_responsible uuid;
  dept uuid := nullif(p_fields->>'responsible_department_id', '')::uuid;
  assignee uuid := nullif(p_fields->>'assigned_to', '')::uuid;
  parent_id uuid := nullif(p_fields->>'parent_task_id', '')::uuid;
  tid uuid;
begin
  perform private.require_active();
  select * into p from os.projects where id = p_project;
  if not found or private.can_read_project(p_project) is not true then perform private.not_found(); end if;
  if parent_id is not null then
    select requesting_department_id, responsible_department_id into parent_requesting, parent_responsible
    from os.tasks where id = parent_id and project_id = p_project;
    if not found or private.can_read_task(parent_id) is not true then perform private.not_found(); end if;
    dept := coalesce(dept, parent_responsible);
  end if;
  dept := coalesce(dept, p.owning_department_id,
    (select department_id from private.exec_positions(auth.uid()) limit 1));
  if dept is null then raise exception 'Choose a responsible team' using errcode = 'P0422'; end if;
  if private.can_add_task_to_project(p_project, dept) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  perform private.check_assignee(assignee, dept);

  insert into os.tasks (project_id, parent_task_id, title, description, deliverables, assigned_by, assigned_to,
    requesting_department_id, responsible_department_id, status, priority, due_at, visibility, requires_review, created_by)
  values (p_project, parent_id, p_fields->>'title', coalesce(p_fields->>'description', ''), coalesce(p_fields->>'deliverables', ''),
    auth.uid(), assignee,
    coalesce(parent_requesting, dept), dept,
    case when assignee is null then 'unassigned' else 'todo' end,
    coalesce(nullif(p_fields->>'priority', ''), 'normal'), nullif(p_fields->>'due_at', '')::timestamptz,
    coalesce(nullif(p_fields->>'visibility', ''), 'project'),
    coalesce((p_fields->>'requires_review')::boolean, false) and assignee is distinct from auth.uid(),
    auth.uid())
  returning id into tid;
  perform private.record_assignment(tid, assignee, 'Created');
  perform private.audit('task.created', 'task', tid, jsonb_build_object('project_id', p_project, 'assigned_to', assignee));
  return tid;
end $$;
grant execute on function api.create_task(uuid, jsonb) to authenticated;

-- A hand-set date is 'manual' from here on: no template recalculation moves it.
create function api.update_task(p_task uuid, p_fields jsonb, p_expected timestamptz default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t record;
  new_due timestamptz := nullif(p_fields->>'due_at', '')::timestamptz;
  who uuid;
begin
  perform private.require_active();
  select * into t from os.tasks where id = p_task for update;
  if not found or private.can_read_task(p_task) is not true then perform private.not_found(); end if;
  if private.can_edit_task(p_task) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  perform private.check_version(p_expected, t.updated_at);
  -- The agreed date on a cross-team task changes only by negotiation.
  if t.is_cross_team and new_due is distinct from t.due_at then
    raise exception 'Propose a new date so the other team can agree to it' using errcode = 'P0409';
  end if;
  update os.tasks set title = p_fields->>'title', description = coalesce(p_fields->>'description', ''),
    deliverables = coalesce(p_fields->>'deliverables', ''),
    priority = coalesce(nullif(p_fields->>'priority', ''), priority),
    visibility = case when is_cross_team then visibility else coalesce(nullif(p_fields->>'visibility', ''), visibility) end,
    due_at = new_due,
    due_source = case when new_due is distinct from t.due_at then 'manual' else due_source end,
    due_was_clamped = case when new_due is distinct from t.due_at then false else due_was_clamped end
  where id = p_task;
  perform private.audit('task.edited', 'task', p_task, jsonb_build_object('due_at', new_due));
  if new_due is distinct from t.due_at then
    for who in select x from unnest(array[t.assigned_to, t.assigned_by]) x where x is not null and x <> auth.uid() loop
      perform private.notify(who, 'task.deadline_changed', 'task', p_task, 'deadline:' || p_task || ':' || coalesce(new_due::text, 'none'));
    end loop;
  end if;
end $$;
grant execute on function api.update_task(uuid, jsonb, timestamptz) to authenticated;

-- Internal assignment. Cross-team tasks are delegated by the receiving VP below.
create function api.assign_task(p_task uuid, p_assignee uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t record;
begin
  perform private.require_active();
  select * into t from os.tasks where id = p_task for update;
  if not found or private.can_read_task(p_task) is not true then perform private.not_found(); end if;
  if t.is_cross_team then
    raise exception 'The receiving team''s lead delegates this one' using errcode = 'P0409';
  end if;
  if private.can_edit_task(p_task) is not true and not (p_assignee = auth.uid() and t.assigned_to is null and private.in_department(t.responsible_department_id)) then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  perform private.check_assignee(p_assignee, t.responsible_department_id);
  update os.tasks set assigned_to = p_assignee, assigned_by = auth.uid(),
    status = case when p_assignee is null then 'unassigned' when status = 'unassigned' then 'todo' else status end
  where id = p_task;
  perform private.record_assignment(p_task, p_assignee, 'Assigned');
  perform private.audit('task.assigned', 'task', p_task, jsonb_build_object('assigned_to', p_assignee));
end $$;
grant execute on function api.assign_task(uuid, uuid) to authenticated;

-- When something finishes, whatever was waiting only on it can move again.
create function private.refresh_dependents(p_task uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare d record;
begin
  for d in
    select t.id, t.assigned_to from os.task_dependencies x join os.tasks t on t.id = x.task_id
    where x.depends_on_task_id = p_task and t.status = 'blocked' and t.blocked_auto
    for update of t
  loop
    if not exists (
      select 1 from os.task_dependencies y join os.tasks b on b.id = y.depends_on_task_id
      where y.task_id = d.id and b.status not in ('done', 'cancelled')
    ) then
      update os.tasks set status = 'todo', blocked_auto = false where id = d.id;
      perform private.notify(d.assigned_to, 'task.unblocked', 'task', d.id, 'unblocked:' || d.id || ':' || now());
    end if;
  end loop;
end $$;

create function private.flag_if_blocked(p_task uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t record;
begin
  select id, status, assigned_to into t from os.tasks where id = p_task for update;
  if t.status in ('todo', 'in_progress', 'revisions_requested') and exists (
    select 1 from os.task_dependencies y join os.tasks b on b.id = y.depends_on_task_id
    where y.task_id = p_task and b.status not in ('done', 'cancelled')
  ) then
    update os.tasks set status = 'blocked', blocked_auto = true where id = p_task;
    perform private.notify(t.assigned_to, 'task.blocked', 'task', p_task, 'blocked:' || p_task || ':' || now()::date);
  end if;
end $$;

-- Working status moves. Review moves have their own functions, so this one
-- refuses 'submitted' on a reviewed task's way to 'done'.
create function api.set_task_status(p_task uuid, p_status text, p_expected timestamptz default null) returns void
language plpgsql security definer set search_path = '' as $$
declare t record;
begin
  perform private.require_active();
  if p_status not in ('todo', 'in_progress', 'blocked', 'done', 'cancelled') then
    raise exception 'That status has its own action' using errcode = 'P0422';
  end if;
  select * into t from os.tasks where id = p_task for update;
  if not found or private.can_read_task(p_task) is not true then perform private.not_found(); end if;
  if private.can_edit_task(p_task) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  perform private.check_version(p_expected, t.updated_at);
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
grant execute on function api.set_task_status(uuid, text, timestamptz) to authenticated;

-- Checks the whole graph, including rows the caller cannot see. The advisory lock
-- stops two simultaneous inserts from each passing and together making a cycle.
create function api.add_task_dependency(p_task uuid, p_depends_on uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_active();
  if private.can_read_task(p_task) is not true or private.can_read_task(p_depends_on) is not true then perform private.not_found(); end if;
  if private.can_edit_task(p_task) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  perform pg_advisory_xact_lock(hashtext('os.task_dependencies'));
  if p_task = p_depends_on or exists (
    with recursive chain as (
      select depends_on_task_id as id from os.task_dependencies where task_id = p_depends_on
      union
      select d.depends_on_task_id from os.task_dependencies d join chain c on d.task_id = c.id
    ) select 1 from chain where id = p_task
  ) then
    raise exception 'That would make these tasks wait on each other forever' using errcode = 'P0409';
  end if;
  insert into os.task_dependencies (task_id, depends_on_task_id, created_by) values (p_task, p_depends_on, auth.uid())
  on conflict do nothing;
  perform private.flag_if_blocked(p_task);
  perform private.audit('task.dependency_added', 'task', p_task, jsonb_build_object('depends_on', p_depends_on));
end $$;
grant execute on function api.add_task_dependency(uuid, uuid) to authenticated;

create function api.remove_task_dependency(p_task uuid, p_depends_on uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_active();
  if private.can_read_task(p_task) is not true then perform private.not_found(); end if;
  if private.can_edit_task(p_task) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  delete from os.task_dependencies where task_id = p_task and depends_on_task_id = p_depends_on;
  if not found then perform private.not_found(); end if;
  perform private.refresh_dependents(p_depends_on);
  perform private.audit('task.dependency_removed', 'task', p_task, jsonb_build_object('depends_on', p_depends_on));
end $$;
grant execute on function api.remove_task_dependency(uuid, uuid) to authenticated;

-- A dependency may point at another team's task. Its title shows only to someone
-- who may read that task; everyone else sees that it exists and whether it is open.
create function api.task_dependencies(p_task uuid)
returns table (task_id uuid, title text, status text, can_open boolean, direction text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.can_read_task(p_task) is not true then return; end if;
  return query
    select t.id,
      case when private.can_read_task(t.id) then t.title else 'Restricted task' end,
      t.status, private.can_read_task(t.id), 'blocked_by'::text
    from os.task_dependencies d join os.tasks t on t.id = d.depends_on_task_id where d.task_id = p_task
    union all
    select t.id,
      case when private.can_read_task(t.id) then t.title else 'Restricted task' end,
      t.status, private.can_read_task(t.id), 'blocks'::text
    from os.task_dependencies d join os.tasks t on t.id = d.task_id where d.depends_on_task_id = p_task;
end $$;
grant execute on function api.task_dependencies(uuid) to authenticated;

create function api.add_comment(p_task uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  t record;
  cid uuid;
  who uuid;
begin
  perform private.require_active();
  select * into t from os.tasks where id = p_task;
  if not found or private.can_read_task(p_task) is not true then perform private.not_found(); end if;
  insert into os.task_comments (task_id, author_id, body) values (p_task, auth.uid(), trim(p_body)) returning id into cid;
  for who in select x from unnest(array[t.assigned_to, t.assigned_by]) x where x is not null and x <> auth.uid() loop
    perform private.notify(who, 'task.commented', 'task', p_task, 'comment:' || cid);
  end loop;
  return cid;
end $$;
grant execute on function api.add_comment(uuid, text) to authenticated;

create function api.save_checklist_item(p_id uuid, p_task uuid, p_label text, p_is_done boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare i uuid := p_id;
begin
  perform private.require_active();
  if private.can_read_task(p_task) is not true then perform private.not_found(); end if;
  if private.can_edit_task(p_task) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  if i is null then
    insert into os.task_checklist_items (task_id, label, is_done, position)
    values (p_task, trim(p_label), coalesce(p_is_done, false),
      (select coalesce(max(position), 0) + 1 from os.task_checklist_items where task_id = p_task))
    returning id into i;
  else
    update os.task_checklist_items set label = trim(p_label), is_done = coalesce(p_is_done, false) where id = i and task_id = p_task;
    if not found then perform private.not_found(); end if;
  end if;
  return i;
end $$;
grant execute on function api.save_checklist_item(uuid, uuid, text, boolean) to authenticated;

create function api.delete_checklist_item(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare tk uuid;
begin
  perform private.require_active();
  select task_id into tk from os.task_checklist_items where id = p_id;
  if not found or private.can_read_task(tk) is not true then perform private.not_found(); end if;
  if private.can_edit_task(tk) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  delete from os.task_checklist_items where id = p_id;
end $$;
grant execute on function api.delete_checklist_item(uuid) to authenticated;

-- ─── Reviewed work, internal and cross-team ────────────────────────────────
create function api.submit_deliverable(p_task uuid, p_note text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare
  t record;
  who uuid;
begin
  perform private.require_active();
  select * into t from os.tasks where id = p_task for update;
  if not found or private.can_read_task(p_task) is not true then perform private.not_found(); end if;
  if t.assigned_to is distinct from auth.uid() and private.is_department_head(t.responsible_department_id) is not true then
    raise exception 'Only the assignee submits the deliverable' using errcode = 'P0403';
  end if;
  if t.status not in ('todo', 'in_progress', 'revisions_requested') then
    raise exception 'This task is not ready to submit' using errcode = 'P0409';
  end if;
  if exists (
    select 1 from os.task_dependencies y join os.tasks b on b.id = y.depends_on_task_id
    where y.task_id = p_task and b.status not in ('done', 'cancelled')
  ) then
    raise exception 'Another task has to finish before this one can' using errcode = 'P0409';
  end if;
  update os.tasks set status = 'submitted', submitted_at = now(), requires_review = true where id = p_task;
  insert into os.task_review_events (task_id, kind, actor_id, note) values (p_task, 'submitted', auth.uid(), coalesce(p_note, ''));
  perform private.audit('task.submitted', 'task', p_task, jsonb_build_object('status', 'submitted'));
  if t.is_cross_team then
    perform private.notify_heads(t.requesting_department_id, 'review.requested', 'task', p_task, 'review:' || p_task || ':' || now());
    if t.created_by is not null then
      perform private.notify(t.created_by, 'review.requested', 'task', p_task, 'review:' || p_task || ':' || now());
    end if;
  else
    who := t.assigned_by;
    perform private.notify(who, 'review.requested', 'task', p_task, 'review:' || p_task || ':' || now());
  end if;
end $$;
grant execute on function api.submit_deliverable(uuid, text) to authenticated;

-- The requester's call, on the same record the assignee is looking at.
create function api.review_deliverable(p_task uuid, p_accept boolean, p_note text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare
  t record;
  allowed boolean;
begin
  perform private.require_active();
  select * into t from os.tasks where id = p_task for update;
  if not found or private.can_read_task(p_task) is not true then perform private.not_found(); end if;
  if t.status <> 'submitted' then
    raise exception 'There is nothing waiting for review' using errcode = 'P0409';
  end if;
  if t.is_cross_team then
    allowed := t.created_by = auth.uid() or private.is_department_head(t.requesting_department_id) or private.is_president();
  else
    allowed := t.assigned_by = auth.uid() or private.is_department_head(t.responsible_department_id) or private.is_president();
  end if;
  if allowed is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  if not p_accept and length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'Say what needs revising' using errcode = 'P0422';
  end if;
  update os.tasks set
    status = case when p_accept then 'done' else 'revisions_requested' end,
    reviewed_by = case when p_accept then auth.uid() end,
    reviewed_at = case when p_accept then now() end,
    completed_at = case when p_accept then now() end
  where id = p_task;
  insert into os.task_review_events (task_id, kind, actor_id, note)
  values (p_task, case when p_accept then 'approved' else 'revisions_requested' end, auth.uid(), coalesce(p_note, ''));
  perform private.audit(case when p_accept then 'task.accepted' else 'task.revisions_requested' end, 'task', p_task);
  perform private.notify(t.assigned_to, case when p_accept then 'review.accepted' else 'review.revisions' end, 'task', p_task, 'reviewed:' || p_task || ':' || now());
  if p_accept then perform private.refresh_dependents(p_task); end if;
end $$;
grant execute on function api.review_deliverable(uuid, boolean, text) to authenticated;

-- ─── Cross-team requests ───────────────────────────────────────────────────
-- One row, in the requester's project. Both teams read the same status.
create function api.create_cross_team_request(p_project uuid, p_receiving uuid, p_fields jsonb) returns uuid
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
    nullif(p_fields->>'due_at', '')::timestamptz, 'project', true, 'pending', true, auth.uid())
  returning id into tid;
  insert into os.task_review_events (task_id, kind, actor_id) values (tid, 'requested', auth.uid());
  perform private.audit('request.created', 'task', tid, jsonb_build_object('receiving', p_receiving));
  perform private.notify_heads(p_receiving, 'request.received', 'task', tid, 'request:' || tid);
  return tid;
end $$;
grant execute on function api.create_cross_team_request(uuid, uuid, jsonb) to authenticated;

-- Accept, decline, or ask for clarification. Only whoever answers for the
-- receiving department, and accepting a request can name the delegate in one move.
create function api.respond_to_request(p_task uuid, p_action text, p_note text default '', p_delegate uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare t record;
begin
  perform private.require_active();
  select * into t from os.tasks where id = p_task and is_cross_team for update;
  if not found or private.can_read_task(p_task) is not true then perform private.not_found(); end if;
  if private.is_department_head(t.responsible_department_id) is not true then
    raise exception 'The receiving team''s lead responds to requests' using errcode = 'P0403';
  end if;
  if t.request_state not in ('pending', 'clarification_requested') then
    raise exception 'That request has already been answered' using errcode = 'P0409';
  end if;
  if p_action = 'accept' then
    if p_delegate is not null and p_delegate <> auth.uid() and private.exec_in_department(p_delegate, t.responsible_department_id) is not true then
      raise exception 'Delegate to someone in your own department' using errcode = 'P0422';
    end if;
    update os.tasks set request_state = 'accepted', assigned_to = p_delegate,
      status = case when p_delegate is null then 'unassigned' else 'todo' end
    where id = p_task;
    insert into os.task_review_events (task_id, kind, actor_id, note) values (p_task, 'accepted', auth.uid(), coalesce(p_note, ''));
    if p_delegate is not null then perform private.record_assignment(p_task, p_delegate, 'Delegated on acceptance'); end if;
  elsif p_action = 'decline' then
    if length(trim(coalesce(p_note, ''))) = 0 then raise exception 'Say why it is being declined' using errcode = 'P0422'; end if;
    update os.tasks set request_state = 'declined', status = 'cancelled' where id = p_task;
    insert into os.task_review_events (task_id, kind, actor_id, note) values (p_task, 'declined', auth.uid(), p_note);
  elsif p_action = 'clarify' then
    if length(trim(coalesce(p_note, ''))) = 0 then raise exception 'Say what you need to know' using errcode = 'P0422'; end if;
    update os.tasks set request_state = 'clarification_requested' where id = p_task;
    insert into os.task_review_events (task_id, kind, actor_id, note) values (p_task, 'clarification_requested', auth.uid(), p_note);
  else
    raise exception 'Unknown action' using errcode = 'P0422';
  end if;
  perform private.audit('request.' || p_action, 'task', p_task, jsonb_build_object('delegate', p_delegate));
  perform private.notify(t.assigned_by, 'request.' || p_action, 'task', p_task, 'request-answer:' || p_task || ':' || p_action || ':' || now());
end $$;
grant execute on function api.respond_to_request(uuid, text, text, uuid) to authenticated;

-- The requester answers a clarification: the request returns to the queue.
create function api.clarify_request(p_task uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare t record;
begin
  perform private.require_active();
  select * into t from os.tasks where id = p_task and is_cross_team for update;
  if not found or private.can_read_task(p_task) is not true then perform private.not_found(); end if;
  if t.request_state <> 'clarification_requested' then
    raise exception 'That request is not waiting on you' using errcode = 'P0409';
  end if;
  if t.created_by is distinct from auth.uid() and private.in_department(t.requesting_department_id) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  update os.tasks set request_state = 'pending' where id = p_task;
  insert into os.task_review_events (task_id, kind, actor_id, note) values (p_task, 'clarified', auth.uid(), coalesce(p_note, ''));
  perform private.notify_heads(t.responsible_department_id, 'request.clarified', 'task', p_task, 'clarified:' || p_task || ':' || now());
end $$;
grant execute on function api.clarify_request(uuid, text) to authenticated;

-- The receiving lead alone decides who inside their team does the work.
create function api.delegate_request(p_task uuid, p_delegate uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t record;
begin
  perform private.require_active();
  select * into t from os.tasks where id = p_task and is_cross_team for update;
  if not found or private.can_read_task(p_task) is not true then perform private.not_found(); end if;
  if private.is_department_head(t.responsible_department_id) is not true then
    raise exception 'The receiving team''s lead delegates requests' using errcode = 'P0403';
  end if;
  if t.request_state <> 'accepted' then
    raise exception 'Accept the request first' using errcode = 'P0409';
  end if;
  if p_delegate is not null and private.exec_is_active(p_delegate) is not true then
    raise exception 'That person does not have an active account' using errcode = 'P0422';
  end if;
  if p_delegate <> auth.uid() and private.exec_in_department(p_delegate, t.responsible_department_id) is not true then
    raise exception 'Delegate to someone in your own department' using errcode = 'P0422';
  end if;
  update os.tasks set assigned_to = p_delegate,
    status = case when status = 'unassigned' then 'todo' else status end
  where id = p_task;
  insert into os.task_review_events (task_id, kind, actor_id) values (p_task, 'delegated', auth.uid());
  perform private.record_assignment(p_task, p_delegate, 'Delegated');
  perform private.audit('request.delegated', 'task', p_task, jsonb_build_object('assigned_to', p_delegate));
end $$;
grant execute on function api.delegate_request(uuid, uuid) to authenticated;

-- ─── Deadline negotiation ──────────────────────────────────────────────────
create function api.propose_deadline(p_task uuid, p_due timestamptz, p_note text default '') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  t record;
  pid uuid;
begin
  perform private.require_active();
  select * into t from os.tasks where id = p_task for update;
  if not found or private.can_read_task(p_task) is not true then perform private.not_found(); end if;
  if not (private.in_department(t.requesting_department_id) or private.in_department(t.responsible_department_id)
          or t.assigned_to = auth.uid() or private.is_president()) then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  begin
    insert into os.deadline_proposals (task_id, proposed_by, proposed_due_at, note) values (p_task, auth.uid(), p_due, coalesce(p_note, ''))
    returning id into pid;
  exception when unique_violation then
    raise exception 'A date proposal is already open on this task' using errcode = 'P0409';
  end;
  if private.in_department(t.responsible_department_id) then
    perform private.notify(t.assigned_by, 'deadline.proposed', 'task', p_task, 'deadline-proposed:' || pid);
  else
    perform private.notify_heads(t.responsible_department_id, 'deadline.proposed', 'task', p_task, 'deadline-proposed:' || pid);
  end if;
  return pid;
end $$;
grant execute on function api.propose_deadline(uuid, timestamptz, text) to authenticated;

-- Decided by the other side: the proposer cannot accept their own date.
create function api.decide_deadline(p_proposal uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d record;
  t record;
begin
  perform private.require_active();
  select * into d from os.deadline_proposals where id = p_proposal and state = 'open' for update;
  if not found or private.can_read_task(d.task_id) is not true then perform private.not_found(); end if;
  select * into t from os.tasks where id = d.task_id for update;
  if d.proposed_by = auth.uid() and private.is_president() is not true then
    raise exception 'The other team decides on your proposal' using errcode = 'P0403';
  end if;
  if not (private.in_department(t.requesting_department_id) or private.in_department(t.responsible_department_id) or private.is_president()) then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  update os.deadline_proposals set state = case when p_accept then 'accepted' else 'rejected' end, decided_by = auth.uid(), decided_at = now()
  where id = p_proposal;
  if p_accept then
    update os.tasks set due_at = d.proposed_due_at, due_source = 'manual', due_was_clamped = false where id = t.id;
    perform private.notify(t.assigned_to, 'task.deadline_changed', 'task', t.id, 'deadline:' || t.id || ':' || d.proposed_due_at);
  end if;
  perform private.notify(d.proposed_by, 'deadline.decided', 'task', t.id, 'deadline-decided:' || p_proposal);
  perform private.audit('deadline.' || case when p_accept then 'accepted' else 'rejected' end, 'task', t.id, jsonb_build_object('due_at', d.proposed_due_at));
end $$;
grant execute on function api.decide_deadline(uuid, boolean) to authenticated;

-- ─── Fixed-column views of things a person may not fully read ──────────────
-- A task's project name and kind. Always available to anyone who can read the
-- task, including the other team on a cross-team request. No other project field.
create function api.task_context(p_task uuid)
returns table (project_id uuid, project_name text, project_kind text, can_open_project boolean, event_id uuid,
  requesting_department text, responsible_department text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.can_read_task(p_task) is not true then return; end if;
  return query
    select p.id, p.name, p.kind, private.can_read_project(p.id),
      case when private.can_read_project(p.id) then p.event_id end,
      req.name, res.name
    from os.tasks t
    join os.projects p on p.id = t.project_id
    join os.departments req on req.id = t.requesting_department_id
    join os.departments res on res.id = t.responsible_department_id
    where t.id = p_task;
end $$;
grant execute on function api.task_context(uuid) to authenticated;

create function api.project_summaries(p_kind text default null, p_department uuid default null, p_event uuid default null, p_include_archived boolean default false)
returns table (id uuid, kind text, name text, status text, approval_status text, starts_on date, due_on date, progress int,
  department_name text, event_id uuid, event_name text, archived_at timestamptz, can_open boolean, lead_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.is_active_exec() is not true then return; end if;
  return query
    select p.id, p.kind, p.name, p.status, p.approval_status, p.starts_on, p.due_on, private.project_progress(p.id),
      d.name, e.id, e.name, p.archived_at, private.can_read_project(p.id), coalesce(x.preferred_name, x.full_name)
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

-- Readiness for the event lead's and President's view.
create function api.event_readiness(p_event uuid) returns int
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.can_read_event(p_event) is not true then return null; end if;
  return private.event_readiness(p_event);
end $$;
grant execute on function api.event_readiness(uuid) to authenticated;

-- What needs the President's attention, as counts and references. Only people
-- holding escalation.view reach it.
create function api.escalations()
returns table (task_id uuid, title text, status text, due_at timestamptz, department_name text, project_name text, is_overdue boolean, is_cross_team boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_perm('escalation.view');
  return query
    select t.id, t.title, t.status, t.due_at, d.name, p.name,
      coalesce(t.due_at < now(), false), t.is_cross_team
    from os.tasks t
    join os.projects p on p.id = t.project_id
    join os.departments d on d.id = t.responsible_department_id
    where p.archived_at is null and private.can_read_task(t.id)
      and t.status not in ('done', 'cancelled')
      and (t.status = 'blocked' or t.due_at < now())
    order by t.due_at nulls last
    limit 200;
end $$;
grant execute on function api.escalations() to authenticated;

create function api.cross_team_dependencies()
returns table (task_id uuid, title text, status text, request_state text, due_at timestamptz, requesting text, responsible text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_perm('escalation.view');
  return query
    select t.id, t.title, t.status, t.request_state, t.due_at, req.name, res.name
    from os.tasks t
    join os.projects p on p.id = t.project_id
    join os.departments req on req.id = t.requesting_department_id
    join os.departments res on res.id = t.responsible_department_id
    where t.is_cross_team and p.archived_at is null and t.status not in ('done', 'cancelled') and private.can_read_task(t.id)
    order by t.due_at nulls last
    limit 200;
end $$;
grant execute on function api.cross_team_dependencies() to authenticated;

create function api.department_progress()
returns table (department_id uuid, department_name text, open_tasks bigint, done_tasks bigint, overdue_tasks bigint, blocked_tasks bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_perm('escalation.view');
  return query
    select d.id, d.name,
      count(t.id) filter (where t.status not in ('done', 'cancelled')),
      count(t.id) filter (where t.status = 'done'),
      count(t.id) filter (where t.status not in ('done', 'cancelled') and t.due_at < now()),
      count(t.id) filter (where t.status = 'blocked')
    from os.departments d
    left join (os.tasks t join os.projects p on p.id = t.project_id and p.archived_at is null) on t.responsible_department_id = d.id
    where d.archived_at is null
    group by d.id, d.name, d.sort_order
    order by d.sort_order;
end $$;
grant execute on function api.department_progress() to authenticated;

-- The admin's unrouted queue: requests with nobody to receive them. References
-- and department names only, no content: the role carries no operational access.
create function api.unrouted_requests()
returns table (task_id uuid, department_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select t.id, d.name, t.created_at
    from os.tasks t join os.departments d on d.id = t.responsible_department_id
    where t.is_cross_team and t.request_state = 'pending'
      and not exists (select 1 from private.department_heads(t.responsible_department_id));
end $$;
grant execute on function api.unrouted_requests() to authenticated;

-- ─── Announcements ─────────────────────────────────────────────────────────
create function api.publish_announcement(p_title text, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  aid uuid;
  who uuid;
begin
  perform private.require_perm('announcement.publish');
  insert into os.announcements (title, body, published_by) values (trim(p_title), trim(p_body), auth.uid()) returning id into aid;
  for who in select id from os.executives where status = 'active' and id <> auth.uid() loop
    perform private.notify(who, 'announcement.published', 'announcement', aid, 'announcement:' || aid);
  end loop;
  perform private.audit('announcement.published', 'announcement', aid);
  return aid;
end $$;
grant execute on function api.publish_announcement(text, text) to authenticated;

create function api.archive_announcement(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_perm('announcement.publish');
  update os.announcements set archived_at = now() where id = p_id and archived_at is null;
  if not found then perform private.not_found(); end if;
  perform private.audit('announcement.archived', 'announcement', p_id);
end $$;
grant execute on function api.archive_announcement(uuid) to authenticated;

-- ─── Notifications ─────────────────────────────────────────────────────────
-- The title comes from the record, through the same read check, at display time.
create function api.my_notifications(p_limit int default 50, p_unread_only boolean default false)
returns table (id uuid, kind text, entity_type text, entity_id uuid, title text, read_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.is_active_exec() is not true then return; end if;
  return query
    select n.id, n.kind, n.entity_type, case when r.ok then n.entity_id end,
      case when r.ok then r.title else 'A record you no longer have access to' end,
      n.read_at, n.created_at
    from os.notifications n
    cross join lateral (
      select
        case n.entity_type
          when 'task' then private.can_read_task(n.entity_id)
          when 'project' then private.can_read_project_summary(n.entity_id)
          when 'event' then private.can_read_event(n.entity_id)
          when 'sop' then private.can_read_sop(n.entity_id)
          when 'meeting' then private.can_read_meeting(n.entity_id)
          when 'announcement' then true
          else false
        end as ok,
        case n.entity_type
          when 'task' then (select t.title from os.tasks t where t.id = n.entity_id)
          when 'project' then (select p.name from os.projects p where p.id = n.entity_id)
          when 'event' then (select e.name from os.events e where e.id = n.entity_id)
          when 'sop' then (select s.title from os.sops s where s.id = n.entity_id)
          when 'meeting' then (select m.title from os.meetings m where m.id = n.entity_id)
          when 'announcement' then (select a.title from os.announcements a where a.id = n.entity_id)
        end as title
    ) r
    where n.recipient_id = auth.uid() and (not p_unread_only or n.read_at is null)
    order by n.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end $$;
grant execute on function api.my_notifications(int, boolean) to authenticated;

create function api.mark_notifications_read(p_ids uuid[] default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_active();
  update os.notifications set read_at = now()
  where recipient_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
end $$;
grant execute on function api.mark_notifications_read(uuid[]) to authenticated;
