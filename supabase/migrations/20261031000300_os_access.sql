-- WEC OS access rules: helpers, row level security, read grants.
--
-- Every helper starts from a live check of the executive's status, so a
-- deactivated person's still-valid JWT gets nothing, immediately. Helpers are
-- SECURITY DEFINER so policies on projects and tasks can consult each other
-- without recursing through RLS.

create function private.today() returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Toronto')::date
$$;

create function private.is_active_exec() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from os.executives where id = auth.uid() and status = 'active')
$$;

create function private.exec_is_active(p_exec uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from os.executives where id = p_exec and status = 'active')
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active_exec() and exists (select 1 from os.system_admins where executive_id = auth.uid())
$$;

create function private.exec_positions(p_exec uuid)
returns table (position_id uuid, department_id uuid, org_role text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.department_id, p.org_role
  from os.position_assignments a
  join os.positions p on p.id = a.position_id
  join os.executives e on e.id = a.executive_id
  where a.executive_id = p_exec and e.status = 'active' and a.during @> private.today()
$$;

create function private.is_president() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.exec_positions(auth.uid()) where org_role = 'president')
$$;

create function private.exec_in_department(p_exec uuid, p_department uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.exec_positions(p_exec) where department_id = p_department)
$$;

create function private.in_department(p_department uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.exec_in_department(auth.uid(), p_department)
$$;

-- Who answers for a department right now: whoever holds its head seat, walking
-- up the reporting line while seats are vacant. Empty when even the President's
-- seat is vacant, which puts a request in the admin's unrouted queue.
create function private.department_heads(p_department uuid) returns setof uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  pos uuid;
  hops int := 0;
begin
  select head_position_id into pos from os.departments where id = p_department;
  while pos is not null and hops < 10 loop
    if exists (
      select 1 from os.position_assignments a join os.executives e on e.id = a.executive_id
      where a.position_id = pos and e.status = 'active' and a.during @> private.today()
    ) then
      return query
        select a.executive_id from os.position_assignments a join os.executives e on e.id = a.executive_id
        where a.position_id = pos and e.status = 'active' and a.during @> private.today();
      return;
    end if;
    select reports_to_position_id into pos from os.positions where id = pos;
    hops := hops + 1;
  end loop;
end $$;

create function private.is_department_head(p_department uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active_exec() and auth.uid() in (select private.department_heads(p_department))
$$;

create function private.has_perm(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active_exec() and exists (
    select 1 from os.permission_grants g
    where g.permission_key = p_key and (
      g.executive_id = auth.uid()
      or g.org_role in (select org_role from private.exec_positions(auth.uid()))
      or g.position_id in (select position_id from private.exec_positions(auth.uid()))
      or g.department_id in (select department_id from private.exec_positions(auth.uid()))
    )
  )
$$;

-- ─── Read rules ────────────────────────────────────────────────────────────
create function private.can_read_event(p_event uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare e record;
begin
  if private.is_active_exec() is not true then return false; end if;
  select id, status, submitted_by into e from os.events where id = p_event;
  if not found then return false; end if;
  if e.status in ('approved', 'in_progress', 'completed', 'archived') then return true; end if;
  return private.is_president()
    or e.submitted_by is not distinct from auth.uid()
    or private.has_perm('event.submit')
    or exists (select 1 from os.event_leads where event_id = p_event and executive_id = auth.uid());
end $$;

-- Full access to the project's own row. See can_read_project_summary for less.
create function private.can_read_project(p_project uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare p record;
begin
  if private.is_active_exec() is not true then return false; end if;
  select id, kind, owning_department_id, lead_executive_id, visibility, approval_status, submitted_by
    into p from os.projects where id = p_project;
  if not found then return false; end if;
  if private.is_president() then return true; end if;
  if p.submitted_by is not distinct from auth.uid() and p.kind = 'GLOBAL' then return true; end if;
  if p.kind = 'GLOBAL' and p.approval_status <> 'approved' then return false; end if;
  if p.lead_executive_id is not distinct from auth.uid() then return true; end if;
  if p.owning_department_id is not null and private.in_department(p.owning_department_id) then return true; end if;
  if exists (select 1 from os.project_participants where project_id = p_project and executive_id = auth.uid()) then return true; end if;
  -- An INTERNAL project is never opened to another department by a link to an
  -- event, a shared flag, or a participating-department row.
  if p.kind = 'INTERNAL' then return false; end if;
  if p.visibility = 'organization' then return true; end if;
  return exists (
    select 1 from os.project_departments d
    where d.project_id = p_project and private.in_department(d.department_id)
  );
end $$;

-- Name, kind, status, dates, progress. Never tasks.
create function private.can_read_project_summary(p_project uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare p record;
begin
  if private.is_active_exec() is not true then return false; end if;
  if private.can_read_project(p_project) then return true; end if;
  select id, kind, event_id, approval_status, share_progress_with_event_lead
    into p from os.projects where id = p_project;
  if not found then return false; end if;
  if p.kind = 'GLOBAL' then return p.approval_status = 'approved'; end if;
  -- Administrators see the schedule: names, dates, status.
  if private.is_admin() then return true; end if;
  if p.kind = 'EVENT' then
    return private.has_perm('event.submit')
      or exists (select 1 from os.event_leads where event_id = p.event_id and executive_id = auth.uid());
  end if;
  -- INTERNAL: only when the owning team opted to share with the event lead.
  return p.share_progress_with_event_lead
    and exists (select 1 from os.event_leads where event_id = p.event_id and executive_id = auth.uid());
end $$;

create function private.can_read_task(p_task uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare t record;
begin
  if private.is_active_exec() is not true then return false; end if;
  select id, project_id, assigned_to, assigned_by, requesting_department_id, responsible_department_id,
         visibility, is_cross_team, request_state
    into t from os.tasks where id = p_task;
  if not found then return false; end if;
  if private.is_president() then return true; end if;
  if t.assigned_to = auth.uid() or t.assigned_by = auth.uid() then return true; end if;
  if private.is_department_head(t.responsible_department_id) then return true; end if;
  if t.is_cross_team then
    if private.in_department(t.requesting_department_id) then return true; end if;
    -- The receiving team's queue belongs to its VP until the request is accepted.
    if t.request_state = 'accepted' and private.in_department(t.responsible_department_id) then return true; end if;
    return private.can_read_project(t.project_id);
  end if;
  if t.visibility = 'restricted' then return false; end if;
  if private.in_department(t.responsible_department_id) or private.in_department(t.requesting_department_id) then
    return true;
  end if;
  return t.visibility = 'project' and private.can_read_project(t.project_id);
end $$;

-- Who may change a task's working fields. Workflow moves have their own checks.
create function private.can_edit_task(p_task uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare t record;
begin
  if private.is_active_exec() is not true then return false; end if;
  select tk.assigned_to, tk.assigned_by, tk.responsible_department_id, p.lead_executive_id
    into t from os.tasks tk join os.projects p on p.id = tk.project_id where tk.id = p_task;
  if not found then return false; end if;
  return private.is_president()
    or t.assigned_to = auth.uid() or t.assigned_by = auth.uid() or t.lead_executive_id = auth.uid()
    or private.is_department_head(t.responsible_department_id);
end $$;

create function private.can_read_sop(p_sop uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare s record;
begin
  if private.is_active_exec() is not true then return false; end if;
  select department_id, visibility, responsible_executive_id, approver_position_id, current_version_id
    into s from os.sops where id = p_sop;
  if not found then return false; end if;
  if private.is_president() or private.is_admin() or private.in_department(s.department_id) then return true; end if;
  if s.responsible_executive_id = auth.uid() then return true; end if;
  if exists (select 1 from private.exec_positions(auth.uid()) where position_id = s.approver_position_id) then return true; end if;
  if s.visibility = 'all_execs' and s.current_version_id is not null then return true; end if;
  return exists (
    select 1 from os.project_sop_refs r join os.sop_versions v on v.id = r.sop_version_id
    where v.sop_id = p_sop and private.can_read_project(r.project_id) and s.visibility <> 'restricted'
  );
end $$;

create function private.can_manage_sop(p_sop uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare s record;
begin
  if private.is_active_exec() is not true then return false; end if;
  select department_id, responsible_executive_id, approver_position_id into s from os.sops where id = p_sop;
  if not found then return false; end if;
  return private.is_president() or private.is_admin() or private.in_department(s.department_id)
    or s.responsible_executive_id = auth.uid();
end $$;

-- Drafts are for the owning department and approvers. Everyone else who can read
-- the SOP sees published history only.
create function private.can_read_sop_version(p_version uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v record;
begin
  select sop_id, status into v from os.sop_versions where id = p_version;
  if not found or private.can_read_sop(v.sop_id) is not true then return false; end if;
  return v.status in ('published', 'superseded') or private.can_manage_sop(v.sop_id)
    or exists (
      select 1 from os.sops s join private.exec_positions(auth.uid()) ep on ep.position_id = s.approver_position_id
      where s.id = v.sop_id
    );
end $$;

create function private.can_publish_sop(p_sop uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare s record;
begin
  if private.is_active_exec() is not true then return false; end if;
  if private.is_admin() then return true; end if;
  select department_id, approver_position_id into s from os.sops where id = p_sop;
  if not found then return false; end if;
  if s.approver_position_id is not null then
    return exists (select 1 from private.exec_positions(auth.uid()) where position_id = s.approver_position_id);
  end if;
  return private.has_perm('sop.publish') and (private.in_department(s.department_id) or private.is_president());
end $$;

create function private.can_read_meeting(p_meeting uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare m record;
begin
  if private.is_active_exec() is not true then return false; end if;
  select department_id, created_by into m from os.meetings where id = p_meeting;
  if not found then return false; end if;
  return private.is_president()
    or private.in_department(m.department_id)
    or m.created_by = auth.uid()
    or exists (select 1 from os.meeting_attendees where meeting_id = p_meeting and executive_id = auth.uid())
    or exists (select 1 from os.meeting_departments d where d.meeting_id = p_meeting and private.in_department(d.department_id));
end $$;

create function private.can_read_attachment_entity(p_type text, p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'task' then private.can_read_task(p_id)
    when 'meeting' then private.can_read_meeting(p_id)
    when 'sop' then private.can_read_sop(p_id)
    else false
  end
$$;

create function private.project_progress(p_project uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(round(100.0 * count(*) filter (where status = 'done') / nullif(count(*), 0))::int, 0)
  from os.tasks where project_id = p_project and status <> 'cancelled'
$$;

create function private.event_readiness(p_event uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(round(avg(private.project_progress(id)))::int, 0)
  from os.projects where event_id = p_event and kind = 'EVENT' and status <> 'cancelled'
$$;

-- ─── Small functions every write goes through ──────────────────────────────
create function private.require_active() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.is_active_exec() is not true then
    raise exception 'Not signed in with an active account' using errcode = 'P0401';
  end if;
end $$;

create function private.require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.is_admin() is not true then
    raise exception 'Not found' using errcode = 'P0404';
  end if;
end $$;

create function private.require_perm(p_key text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.has_perm(p_key) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
end $$;

create function private.audit(p_action text, p_type text, p_id uuid, p_changes jsonb default '{}') returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into os.audit_log (actor_id, actor_kind, action, entity_type, entity_id, changes)
  values (auth.uid(), case when auth.uid() is null then 'system' else 'executive' end, p_action, p_type, p_id, coalesce(p_changes, '{}'));
end $$;

-- One notification per recipient per dedupe key, and never to someone who could
-- not read the thing it points at. The key carries anything that should allow a
-- new notice: a moved deadline includes its new date.
create function private.notify(p_recipient uuid, p_kind text, p_type text, p_id uuid, p_dedupe text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_recipient is null or private.exec_is_active(p_recipient) is not true then return; end if;
  if exists (select 1 from os.notification_preferences where executive_id = p_recipient and p_kind = any (muted_kinds)) then return; end if;
  insert into os.notifications (recipient_id, kind, entity_type, entity_id, dedupe_key)
  values (p_recipient, p_kind, p_type, p_id, p_dedupe)
  on conflict (recipient_id, dedupe_key) do nothing;
end $$;

-- ─── RLS ───────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'os' loop
    execute format('alter table os.%I enable row level security', t);
    execute format('grant select on os.%I to authenticated', t);
  end loop;
end $$;

-- Helpers a policy calls run as the querying role, so they need EXECUTE. They
-- answer only about the caller, and private is not exposed through the API.
grant execute on function
  private.is_active_exec(), private.is_admin(), private.is_president(), private.in_department(uuid),
  private.is_department_head(uuid), private.has_perm(text), private.can_read_event(uuid), private.can_read_project(uuid),
  private.can_read_project_summary(uuid), private.can_read_task(uuid), private.can_read_sop(uuid),
  private.can_read_sop_version(uuid), private.can_read_meeting(uuid), private.can_read_attachment_entity(text, uuid)
to authenticated;

-- Readable by every active executive
create policy active_read on os.academic_years for select to authenticated using ((select private.is_active_exec()));
create policy active_read on os.departments for select to authenticated using ((select private.is_active_exec()));
create policy active_read on os.positions for select to authenticated using ((select private.is_active_exec()));
create policy active_read on os.executives for select to authenticated using ((select private.is_active_exec()));
create policy active_read on os.position_assignments for select to authenticated using ((select private.is_active_exec()));
create policy active_read on os.templates for select to authenticated using ((select private.is_active_exec()));
create policy active_read on os.template_versions for select to authenticated using ((select private.is_active_exec()));
create policy active_read on os.announcements for select to authenticated using ((select private.is_active_exec()));

-- Someone mid-activation must still be able to read their own row.
create policy self_read on os.executives for select to authenticated using (id = (select auth.uid()));

-- Administrators only
create policy admin_read on os.invitations for select to authenticated using ((select private.is_admin()));
create policy admin_read on os.system_admins for select to authenticated using ((select private.is_admin()));
create policy admin_read on os.permissions for select to authenticated using ((select private.is_admin()));
create policy admin_read on os.permission_grants for select to authenticated using ((select private.is_admin()));
create policy admin_read on os.audit_log for select to authenticated using ((select private.is_admin()));
create policy admin_read on os.settings for select to authenticated using ((select private.is_admin()));
create policy admin_read on os.automation_rules for select to authenticated using ((select private.is_admin()));
create policy admin_read on os.automation_runs for select to authenticated using ((select private.is_admin()));
create policy admin_read on os.jobs for select to authenticated using ((select private.is_admin()));
create policy admin_read on os.year_transitions for select to authenticated using ((select private.is_admin()));
create policy roster_read on os.roster_snapshots for select to authenticated
  using ((select private.is_admin()) or (select private.is_president()));

-- Events
create policy read_event on os.events for select to authenticated using (private.can_read_event(id));
create policy read_event on os.event_leads for select to authenticated using (private.can_read_event(event_id));
create policy read_event on os.event_departments for select to authenticated using (private.can_read_event(event_id));
create policy read_event on os.event_guests for select to authenticated using (private.can_read_event(event_id));
create policy read_entity on os.approvals for select to authenticated using (
  case entity_type when 'event' then private.can_read_event(entity_id) else private.can_read_project(entity_id) end
);

-- Projects
create policy read_project on os.projects for select to authenticated using (private.can_read_project(id));
create policy read_project on os.project_departments for select to authenticated using (private.can_read_project(project_id));
create policy read_project on os.project_participants for select to authenticated using (private.can_read_project(project_id));
create policy read_project on os.project_sop_refs for select to authenticated using (private.can_read_project(project_id));
create policy read_parent on os.milestones for select to authenticated using (
  core_visible and (select private.is_active_exec())
  or (project_id is not null and private.can_read_project(project_id))
  or (event_id is not null and private.can_read_event(event_id))
);

-- Tasks. Dependencies are read through api.task_dependencies, which shows a
-- hidden task as "restricted", so a link can never reveal another team's title.
create policy read_task on os.tasks for select to authenticated using (private.can_read_task(id));
create policy read_task on os.task_checklist_items for select to authenticated using (private.can_read_task(task_id));
create policy read_task on os.task_comments for select to authenticated using (private.can_read_task(task_id));
create policy read_task on os.task_assignment_history for select to authenticated using (private.can_read_task(task_id));
create policy read_task on os.task_review_events for select to authenticated using (private.can_read_task(task_id));
create policy read_task on os.deadline_proposals for select to authenticated using (private.can_read_task(task_id));
create policy read_both on os.task_dependencies for select to authenticated
  using (private.can_read_task(task_id) and private.can_read_task(depends_on_task_id));

-- SOPs
create policy read_sop on os.sops for select to authenticated using (private.can_read_sop(id));
create policy read_version on os.sop_versions for select to authenticated using (private.can_read_sop_version(id));
create policy read_version on os.sop_approvals for select to authenticated using (private.can_read_sop_version(sop_version_id));

-- Meetings
create policy read_meeting on os.meetings for select to authenticated using (private.can_read_meeting(id));
create policy read_meeting on os.meeting_departments for select to authenticated using (private.can_read_meeting(meeting_id));
create policy read_meeting on os.meeting_attendees for select to authenticated using (private.can_read_meeting(meeting_id));
create policy read_meeting on os.meeting_action_items for select to authenticated using (private.can_read_meeting(meeting_id));
create policy read_meeting on os.meeting_project_links for select to authenticated
  using (private.can_read_meeting(meeting_id) and private.can_read_project(project_id));

-- Files, confirmed uploads only
create policy read_entity on os.attachments for select to authenticated
  using (confirmed_at is not null and private.can_read_attachment_entity(entity_type, entity_id));

-- Your own
create policy own on os.notifications for select to authenticated
  using (recipient_id = (select auth.uid()) and (select private.is_active_exec()));
create policy own on os.notification_preferences for select to authenticated
  using (executive_id = (select auth.uid()) and (select private.is_active_exec()));
