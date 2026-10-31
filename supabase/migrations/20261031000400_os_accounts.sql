-- WEC OS accounts: invitation, activation, roster, permissions, settings.

-- An account exists only because an administrator invited that address. Public
-- signups are off; this trigger is what turns an invited auth user into an
-- executive, and a user with no open invitation gets no executive row at all.
create function private.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  inv record;
  yr uuid;
begin
  select * into inv from os.invitations
  where email = lower(new.email) and accepted_at is null and revoked_at is null;
  if not found then return new; end if;

  insert into os.executives (id, email, full_name, status)
  values (new.id, lower(new.email), inv.full_name, 'invited');

  if inv.position_id is not null then
    select id into yr from os.academic_years where is_current;
    insert into os.position_assignments (executive_id, position_id, seat_no, academic_year_id, during, created_by)
    values (new.id, inv.position_id, coalesce(inv.seat_no, 1), yr, daterange(private.today(), null), inv.invited_by);
  end if;
  if inv.grant_admin then
    insert into os.system_admins (executive_id, granted_by) values (new.id, inv.invited_by);
  end if;
  update os.invitations set accepted_at = now() where id = inv.id;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.on_auth_user_created();

-- ─── The signed-in executive ───────────────────────────────────────────────
create function api.me() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e record;
begin
  select * into e from os.executives where id = auth.uid();
  if not found then return null; end if;
  return jsonb_build_object(
    'id', e.id, 'email', e.email, 'full_name', e.full_name, 'preferred_name', e.preferred_name, 'status', e.status,
    'is_admin', private.is_admin(),
    'is_president', private.is_president(),
    'positions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', p.title, 'org_role', p.org_role, 'position_id', p.id, 'is_acting', a.is_acting,
        'department_id', d.id, 'department_name', d.name, 'department_slug', d.slug,
        'is_head', d.head_position_id = p.id
      ) order by d.sort_order, p.sort_order)
      from os.position_assignments a
      join os.positions p on p.id = a.position_id
      join os.departments d on d.id = p.department_id
      where a.executive_id = e.id and a.during @> private.today() and e.status = 'active'
    ), '[]'),
    'permissions', case when e.status = 'active' then coalesce((
      select jsonb_agg(k.key order by k.key) from os.permissions k where private.has_perm(k.key)
    ), '[]') else '[]' end
  );
end $$;
grant execute on function api.me() to authenticated;

create function api.activate_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update os.executives set status = 'active', activated_at = now()
  where id = auth.uid() and status = 'invited';
  if found then perform private.audit('account.activated', 'executive', auth.uid()); end if;
end $$;
grant execute on function api.activate_account() to authenticated;

create function api.update_profile(p_full_name text, p_preferred_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_active();
  update os.executives
  set full_name = trim(p_full_name), preferred_name = nullif(trim(coalesce(p_preferred_name, '')), '')
  where id = auth.uid();
  perform private.audit('profile.updated', 'executive', auth.uid());
end $$;
grant execute on function api.update_profile(text, text) to authenticated;

create function api.set_notification_preferences(p_email_digest boolean, p_muted_kinds text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_active();
  insert into os.notification_preferences (executive_id, email_digest, muted_kinds)
  values (auth.uid(), p_email_digest, coalesce(p_muted_kinds, '{}'))
  on conflict (executive_id) do update set email_digest = excluded.email_digest, muted_kinds = excluded.muted_kinds;
end $$;
grant execute on function api.set_notification_preferences(boolean, text[]) to authenticated;

-- ─── Invitations ───────────────────────────────────────────────────────────
-- Records who may be invited; the server then asks Supabase Auth to send the
-- email, and the trigger above completes the account.
create function api.create_invitation(p_email text, p_full_name text, p_position uuid, p_seat int, p_grant_admin boolean)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  addr text := lower(trim(p_email));
  inv uuid;
begin
  perform private.require_admin();
  if exists (select 1 from os.executives where email = addr) then
    raise exception 'That address already has an account' using errcode = 'P0409';
  end if;
  insert into os.invitations (email, full_name, position_id, seat_no, grant_admin, invited_by)
  values (addr, trim(p_full_name), p_position, p_seat, coalesce(p_grant_admin, false), auth.uid())
  on conflict (email) where accepted_at is null and revoked_at is null
  do update set full_name = excluded.full_name, position_id = excluded.position_id, seat_no = excluded.seat_no,
    grant_admin = excluded.grant_admin, invited_by = excluded.invited_by
  returning id into inv;
  perform private.audit('invitation.created', 'invitation', inv,
    jsonb_build_object('position_id', p_position, 'grant_admin', coalesce(p_grant_admin, false)));
  return inv;
end $$;
grant execute on function api.create_invitation(text, text, uuid, int, boolean) to authenticated;

create function api.revoke_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update os.invitations set revoked_at = now() where id = p_invitation and accepted_at is null and revoked_at is null;
  if not found then raise exception 'Not found' using errcode = 'P0404'; end if;
  perform private.audit('invitation.revoked', 'invitation', p_invitation);
end $$;
grant execute on function api.revoke_invitation(uuid) to authenticated;

-- The first administrator cannot come from a seed in a public repository, so a
-- script with the service key calls this once. It refuses after that.
create function api.bootstrap_first_admin(p_email text, p_full_name text, p_position_title text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  pos uuid;
  inv uuid;
begin
  if exists (select 1 from os.system_admins) then
    raise exception 'An administrator already exists' using errcode = 'P0409';
  end if;
  if p_position_title is not null then
    select id into pos from os.positions where title = p_position_title;
    if not found then raise exception 'No position called %', p_position_title using errcode = 'P0422'; end if;
  end if;
  insert into os.invitations (email, full_name, position_id, seat_no, grant_admin)
  values (lower(trim(p_email)), trim(p_full_name), pos, 1, true)
  on conflict (email) where accepted_at is null and revoked_at is null
  do update set full_name = excluded.full_name, position_id = excluded.position_id, grant_admin = true
  returning id into inv;
  perform private.audit('admin.bootstrapped', 'invitation', inv);
  return inv;
end $$;
grant execute on function api.bootstrap_first_admin(text, text, text) to service_role;

-- ─── Roster ────────────────────────────────────────────────────────────────
-- Unfinished work goes to the named person, else the department head, else it
-- sits visibly unassigned. Archived projects are left alone: they are history.
create function private.reassign_open_work(p_from uuid, p_to uuid, p_note text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  t record;
  target uuid;
  moved int := 0;
begin
  for t in
    select tk.id, tk.responsible_department_id from os.tasks tk
    join os.projects p on p.id = tk.project_id
    where tk.assigned_to = p_from and tk.status not in ('done', 'cancelled') and p.archived_at is null
    for update of tk
  loop
    target := p_to;
    if target is null then
      select h into target from private.department_heads(t.responsible_department_id) h where h <> p_from limit 1;
    end if;
    update os.tasks set assigned_to = target,
      status = case when target is null then 'unassigned' else status end
    where id = t.id;
    insert into os.task_assignment_history (task_id, assigned_to, assigned_by, note)
    values (t.id, target, auth.uid(), p_note);
    perform private.notify(target, 'task.assigned', 'task', t.id, 'reassigned:' || t.id || ':' || coalesce(target::text, ''));
    moved := moved + 1;
  end loop;
  update os.projects set lead_executive_id = p_to where lead_executive_id = p_from and archived_at is null;
  update os.sops set responsible_executive_id = p_to where responsible_executive_id = p_from and archived_at is null;
  return moved;
end $$;

-- An assignment made today and ended today never really happened: remove it, or the
-- seat stays taken until midnight. Anything older keeps its dates as history.
create function private.end_assignments(p_executive uuid, p_assignment uuid, p_year uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from os.position_assignments
  where upper_inf(during) and lower(during) >= private.today()
    and (p_executive is null or executive_id = p_executive)
    and (p_assignment is null or id = p_assignment)
    and (p_year is null or academic_year_id = p_year);
  update os.position_assignments set during = daterange(lower(during), private.today())
  where upper_inf(during) and lower(during) < private.today()
    and (p_executive is null or executive_id = p_executive)
    and (p_assignment is null or id = p_assignment)
    and (p_year is null or academic_year_id = p_year);
end $$;

-- Status first: from this commit on, every policy refuses them. The server bans
-- the auth user afterwards, which only stops token refresh.
create function api.deactivate_executive(p_executive uuid, p_reassign_to uuid default null) returns int
language plpgsql security definer set search_path = '' as $$
declare moved int;
begin
  perform private.require_admin();
  if p_executive = auth.uid() then
    raise exception 'You cannot deactivate your own account' using errcode = 'P0403';
  end if;
  perform 1 from os.executives where id = p_executive for update;
  if not found then raise exception 'Not found' using errcode = 'P0404'; end if;
  if exists (select 1 from os.system_admins where executive_id = p_executive)
     and not exists (select 1 from os.system_admins s join os.executives e on e.id = s.executive_id
                     where s.executive_id <> p_executive and e.status = 'active') then
    raise exception 'That is the last administrator' using errcode = 'P0409';
  end if;
  if p_reassign_to is not null and private.exec_is_active(p_reassign_to) is not true then
    raise exception 'The person taking over must have an active account' using errcode = 'P0422';
  end if;
  moved := private.reassign_open_work(p_executive, p_reassign_to, 'Reassigned on deactivation');
  perform private.end_assignments(p_executive, null, null);
  update os.executives set status = 'deactivated', deactivated_at = now() where id = p_executive;
  perform private.audit('account.deactivated', 'executive', p_executive, jsonb_build_object('tasks_reassigned', moved));
  return moved;
end $$;
grant execute on function api.deactivate_executive(uuid, uuid) to authenticated;

create function api.reactivate_executive(p_executive uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update os.executives set status = 'active', deactivated_at = null where id = p_executive and status = 'deactivated';
  if not found then raise exception 'Not found' using errcode = 'P0404'; end if;
  perform private.audit('account.reactivated', 'executive', p_executive);
end $$;
grant execute on function api.reactivate_executive(uuid) to authenticated;

-- Nobody edits their own standing. A second administrator has to do it.
create function private.forbid_self_change(p_executive uuid) returns void
language plpgsql stable set search_path = '' as $$
begin
  if p_executive = auth.uid() then
    raise exception 'Another administrator has to change your own access' using errcode = 'P0403';
  end if;
end $$;

-- Positions are the one exception, and only for a sole administrator. Someone who
-- is both President and the only admin would otherwise be locked out of their own
-- seat by the first year transition. The audit log shows it either way.
create function private.check_position_change(p_executive uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_executive = auth.uid() and exists (
    select 1 from os.system_admins s join os.executives e on e.id = s.executive_id
    where s.executive_id <> auth.uid() and e.status = 'active'
  ) then
    raise exception 'Another administrator has to change your own access' using errcode = 'P0403';
  end if;
end $$;

create function api.assign_position(p_executive uuid, p_position uuid, p_seat int, p_is_acting boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  yr uuid;
  id_ uuid;
begin
  perform private.require_admin();
  perform private.check_position_change(p_executive);
  select id into yr from os.academic_years where is_current;
  if yr is null then raise exception 'No academic year is marked current' using errcode = 'P0409'; end if;
  begin
    insert into os.position_assignments (executive_id, position_id, seat_no, academic_year_id, during, is_acting, created_by)
    values (p_executive, p_position, coalesce(p_seat, 1), yr, daterange(private.today(), null), coalesce(p_is_acting, false), auth.uid())
    returning id into id_;
  exception when exclusion_violation then
    raise exception 'That seat is already filled, or this person already holds this position' using errcode = 'P0409';
  end;
  perform private.audit('position.assigned', 'executive', p_executive, jsonb_build_object('position_id', p_position, 'seat', p_seat));
  return id_;
end $$;
grant execute on function api.assign_position(uuid, uuid, int, boolean) to authenticated;

create function api.end_assignment(p_assignment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  perform private.require_admin();
  select * into a from os.position_assignments where id = p_assignment for update;
  if not found then raise exception 'Not found' using errcode = 'P0404'; end if;
  perform private.check_position_change(a.executive_id);
  perform private.end_assignments(null, p_assignment, null);
  perform private.audit('position.ended', 'executive', a.executive_id, jsonb_build_object('position_id', a.position_id));
end $$;
grant execute on function api.end_assignment(uuid) to authenticated;

create function api.set_system_admin(p_executive uuid, p_is_admin boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  perform private.forbid_self_change(p_executive);
  if p_is_admin then
    if private.exec_is_active(p_executive) is not true then
      raise exception 'That person does not have an active account' using errcode = 'P0422';
    end if;
    insert into os.system_admins (executive_id, granted_by) values (p_executive, auth.uid()) on conflict do nothing;
  else
    delete from os.system_admins where executive_id = p_executive;
  end if;
  perform private.audit(case when p_is_admin then 'admin.granted' else 'admin.revoked' end, 'executive', p_executive);
end $$;
grant execute on function api.set_system_admin(uuid, boolean) to authenticated;

-- ─── Structure, without code changes ───────────────────────────────────────
create function api.upsert_department(p_id uuid, p_name text, p_slug text, p_description text, p_head_position uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare d uuid := p_id;
begin
  perform private.require_admin();
  if d is null then
    insert into os.departments (name, slug, description, head_position_id)
    values (trim(p_name), p_slug, coalesce(p_description, ''), p_head_position) returning id into d;
  else
    update os.departments set name = trim(p_name), slug = p_slug, description = coalesce(p_description, ''), head_position_id = p_head_position
    where id = d;
    if not found then raise exception 'Not found' using errcode = 'P0404'; end if;
  end if;
  perform private.audit('department.saved', 'department', d, jsonb_build_object('slug', p_slug));
  return d;
end $$;
grant execute on function api.upsert_department(uuid, text, text, text, uuid) to authenticated;

create function api.upsert_position(p_id uuid, p_department uuid, p_title text, p_org_role text, p_reports_to uuid, p_seats int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare i uuid := p_id;
begin
  perform private.require_admin();
  if i is null then
    insert into os.positions (department_id, title, org_role, reports_to_position_id, seat_count)
    values (p_department, trim(p_title), p_org_role, p_reports_to, coalesce(p_seats, 1)) returning id into i;
  else
    if exists (
      select 1 from os.position_assignments
      where position_id = i and seat_no > coalesce(p_seats, 1) and during @> private.today()
    ) then
      raise exception 'People still hold seats above that number' using errcode = 'P0409';
    end if;
    update os.positions set department_id = p_department, title = trim(p_title), org_role = p_org_role,
      reports_to_position_id = p_reports_to, seat_count = coalesce(p_seats, 1)
    where id = i;
    if not found then raise exception 'Not found' using errcode = 'P0404'; end if;
  end if;
  perform private.audit('position.saved', 'position', i, jsonb_build_object('org_role', p_org_role, 'seats', p_seats));
  return i;
end $$;
grant execute on function api.upsert_position(uuid, uuid, text, text, uuid, int) to authenticated;

create function api.archive_position(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if exists (select 1 from os.position_assignments where position_id = p_id and during @> private.today()) then
    raise exception 'Someone still holds that position' using errcode = 'P0409';
  end if;
  update os.positions set archived_at = now() where id = p_id and archived_at is null;
  if not found then raise exception 'Not found' using errcode = 'P0404'; end if;
  perform private.audit('position.archived', 'position', p_id);
end $$;
grant execute on function api.archive_position(uuid) to authenticated;

-- Grants may target a role, a position, a department, or a person. An
-- administrator cannot aim one at themselves.
create function api.set_permission_grant(p_permission text, p_org_role text, p_position uuid, p_department uuid, p_executive uuid, p_granted boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  perform private.forbid_self_change(p_executive);
  if num_nonnulls(p_org_role, p_position, p_department, p_executive) <> 1 then
    raise exception 'Choose exactly one recipient' using errcode = 'P0422';
  end if;
  if p_granted then
    insert into os.permission_grants (permission_key, org_role, position_id, department_id, executive_id)
    values (p_permission, p_org_role, p_position, p_department, p_executive)
    on conflict do nothing;
  else
    delete from os.permission_grants g where g.permission_key = p_permission
      and g.org_role is not distinct from p_org_role and g.position_id is not distinct from p_position
      and g.department_id is not distinct from p_department and g.executive_id is not distinct from p_executive;
  end if;
  perform private.audit(case when p_granted then 'permission.granted' else 'permission.revoked' end, 'permission', null,
    jsonb_build_object('permission', p_permission, 'org_role', p_org_role, 'position_id', p_position, 'department_id', p_department, 'executive_id', p_executive));
end $$;
grant execute on function api.set_permission_grant(text, text, uuid, uuid, uuid, boolean) to authenticated;

create function api.set_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_key = 'sweep_heartbeat' then
    raise exception 'That value is written by the system' using errcode = 'P0403';
  end if;
  update os.settings set value = p_value, updated_by = auth.uid(), updated_at = now() where key = p_key;
  if not found then raise exception 'Not found' using errcode = 'P0404'; end if;
  perform private.audit('setting.changed', 'setting', null, jsonb_build_object('key', p_key));
end $$;
grant execute on function api.set_setting(text, jsonb) to authenticated;
