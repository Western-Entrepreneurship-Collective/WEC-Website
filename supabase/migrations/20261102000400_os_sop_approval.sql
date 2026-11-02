-- SOPs: a team's VP or the President creates and edits them, and only the President
-- approves them, every version, with no exceptions for administrators or one-person teams. This is a
-- fixed rule rather than a setting, so the two permissions that used to govern it go.

delete from os.permission_grants where permission_key in ('sop.create', 'sop.publish');
delete from os.permissions where key in ('sop.create', 'sop.publish');
delete from os.permission_grants where permission_key = 'sop.archive' and org_role in ('director', 'coordinator');
update os.sops set approver_position_id = null where approver_position_id is not null;

create function private.is_sop_editor(p_department uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active_exec() and (private.is_president() or exists (
    select 1 from private.exec_positions(auth.uid()) where org_role = 'vp' and department_id = p_department
  ))
$$;

create or replace function private.can_manage_sop(p_sop uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_sop_editor(department_id) from os.sops where id = p_sop
$$;

create or replace function private.can_publish_sop(p_sop uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_president()
$$;

-- The team can follow a draft without being able to change it. Everyone else who can
-- read the SOP sees published history only.
create or replace function private.can_read_sop_version(p_version uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v record;
begin
  select x.sop_id, x.status, s.department_id, s.responsible_executive_id into v
  from os.sop_versions x join os.sops s on s.id = x.sop_id where x.id = p_version;
  if not found or private.can_read_sop(v.sop_id) is not true then return false; end if;
  return v.status in ('published', 'superseded') or private.is_president() or private.is_admin()
    or private.in_department(v.department_id) or v.responsible_executive_id = auth.uid();
end $$;

drop function api.create_sop(text, uuid, text, text, date, uuid, uuid, text);
create function api.create_sop(p_title text, p_department uuid, p_description text, p_visibility text,
  p_review_on date, p_responsible uuid, p_content text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare sid uuid;
begin
  perform private.require_active();
  if private.is_sop_editor(p_department) is not true then
    raise exception 'Only a team''s VP or the President can create its SOPs' using errcode = 'P0403';
  end if;
  insert into os.sops (title, department_id, description, visibility, review_on, responsible_executive_id, created_by)
  values (trim(p_title), p_department, coalesce(p_description, ''), coalesce(p_visibility, 'all_execs'), p_review_on,
    coalesce(p_responsible, auth.uid()), auth.uid())
  returning id into sid;
  insert into os.sop_versions (sop_id, major, minor, content, author_id) values (sid, 1, 0, coalesce(p_content, ''), auth.uid());
  perform private.audit('sop.created', 'sop', sid);
  return sid;
end $$;
grant execute on function api.create_sop(text, uuid, text, text, date, uuid, text) to authenticated;

drop function api.update_sop(uuid, text, text, text, date, uuid, uuid, timestamptz);
create function api.update_sop(p_sop uuid, p_title text, p_description text, p_visibility text, p_review_on date,
  p_responsible uuid, p_expected timestamptz default null) returns void
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  perform private.require_active();
  select * into s from os.sops where id = p_sop for update;
  if not found or private.can_read_sop(p_sop) is not true then perform private.not_found(); end if;
  if private.can_manage_sop(p_sop) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  if s.archived_at is not null then raise exception 'That SOP is archived' using errcode = 'P0409'; end if;
  perform private.check_version(p_expected, s.updated_at);
  update os.sops set title = trim(p_title), description = coalesce(p_description, ''), visibility = coalesce(p_visibility, visibility),
    review_on = p_review_on, responsible_executive_id = p_responsible
  where id = p_sop;
  perform private.audit('sop.edited', 'sop', p_sop);
end $$;
grant execute on function api.update_sop(uuid, text, text, text, date, uuid, timestamptz) to authenticated;

create or replace function api.submit_sop_version(p_version uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v record;
  s record;
begin
  perform private.require_active();
  select * into v from os.sop_versions where id = p_version for update;
  if not found or private.can_read_sop_version(p_version) is not true then perform private.not_found(); end if;
  if private.can_manage_sop(v.sop_id) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  if v.status <> 'draft' then raise exception 'That is not a draft' using errcode = 'P0409'; end if;
  if exists (select 1 from os.sops where id = v.sop_id and archived_at is not null) then
    raise exception 'That SOP is archived' using errcode = 'P0409';
  end if;
  update os.sop_versions set status = 'submitted' where id = p_version;
  insert into os.sop_approvals (sop_version_id, decision, actor_id) values (p_version, 'submitted', auth.uid());
  select * into s from os.sops where id = v.sop_id;
  perform private.notify_presidents('sop.submitted', 'sop', s.id, 'sop-submitted:' || p_version);
  perform private.audit('sop.submitted', 'sop', v.sop_id, jsonb_build_object('version_id', p_version));
end $$;

create or replace function api.publish_sop_version(p_version uuid, p_note text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare
  v record;
  s record;
begin
  perform private.require_active();
  select * into v from os.sop_versions where id = p_version for update;
  if not found or private.can_read_sop_version(p_version) is not true then perform private.not_found(); end if;
  if private.can_publish_sop(v.sop_id) is not true then
    raise exception 'Only the President can approve an SOP' using errcode = 'P0403';
  end if;
  -- The President's own draft has nobody else to go to. Anyone else's has to be sent first.
  if v.status not in ('submitted', 'approved') and not (v.status = 'draft' and v.author_id = auth.uid()) then
    raise exception 'Submit the revision before publishing it' using errcode = 'P0409';
  end if;
  select * into s from os.sops where id = v.sop_id for update;
  if s.archived_at is not null then raise exception 'That SOP is archived' using errcode = 'P0409'; end if;
  update os.sop_versions set status = 'superseded' where id = s.current_version_id;
  update os.sop_versions set status = 'published', published_at = now(), published_by = auth.uid() where id = p_version;
  update os.sops set current_version_id = p_version where id = v.sop_id;
  insert into os.sop_approvals (sop_version_id, decision, actor_id, note) values (p_version, 'published', auth.uid(), coalesce(p_note, ''));
  perform private.audit('sop.published', 'sop', v.sop_id, jsonb_build_object(
    'version', v.major || '.' || v.minor, 'self_approved', v.author_id = auth.uid()));
  if v.author_id is distinct from auth.uid() then
    perform private.notify(v.author_id, 'sop.published', 'sop', v.sop_id, 'sop-published:' || p_version);
  end if;
end $$;

revoke execute on all functions in schema api, private from public;
