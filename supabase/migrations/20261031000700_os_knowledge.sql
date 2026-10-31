-- WEC OS knowledge: SOPs, meetings, files, calendar, search, year transitions, restore.

-- ─── SOPs ──────────────────────────────────────────────────────────────────
create function api.create_sop(p_title text, p_department uuid, p_description text, p_visibility text,
  p_review_on date, p_responsible uuid, p_approver_position uuid, p_content text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare sid uuid;
begin
  perform private.require_perm('sop.create');
  if private.in_department(p_department) is not true and private.is_president() is not true then
    raise exception 'You can only create SOPs for your own department' using errcode = 'P0403';
  end if;
  insert into os.sops (title, department_id, description, visibility, review_on, responsible_executive_id, approver_position_id, created_by)
  values (trim(p_title), p_department, coalesce(p_description, ''), coalesce(p_visibility, 'all_execs'), p_review_on,
    coalesce(p_responsible, auth.uid()), p_approver_position, auth.uid())
  returning id into sid;
  insert into os.sop_versions (sop_id, major, minor, content, author_id) values (sid, 1, 0, coalesce(p_content, ''), auth.uid());
  perform private.audit('sop.created', 'sop', sid);
  return sid;
end $$;
grant execute on function api.create_sop(text, uuid, text, text, date, uuid, uuid, text) to authenticated;

create function api.update_sop(p_sop uuid, p_title text, p_description text, p_visibility text, p_review_on date,
  p_responsible uuid, p_approver_position uuid, p_expected timestamptz default null) returns void
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
    review_on = p_review_on, responsible_executive_id = p_responsible, approver_position_id = p_approver_position
  where id = p_sop;
  perform private.audit('sop.edited', 'sop', p_sop);
end $$;
grant execute on function api.update_sop(uuid, text, text, text, date, uuid, uuid, timestamptz) to authenticated;

-- A new draft continues from the current published version: 1.0 → 1.1, or → 2.0
-- for a major revision. One draft at a time.
create function api.start_sop_draft(p_sop uuid, p_major boolean default false, p_from_version uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  s record;
  base record;
  latest record;
  vid uuid;
begin
  perform private.require_active();
  select * into s from os.sops where id = p_sop for update;
  if not found or private.can_read_sop(p_sop) is not true then perform private.not_found(); end if;
  if private.can_manage_sop(p_sop) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  if s.archived_at is not null then raise exception 'That SOP is archived' using errcode = 'P0409'; end if;
  if exists (select 1 from os.sop_versions where sop_id = p_sop and status in ('draft', 'submitted', 'approved')) then
    raise exception 'A draft is already open on this SOP' using errcode = 'P0409';
  end if;
  select major, minor into latest from os.sop_versions where sop_id = p_sop order by major desc, minor desc limit 1;
  select * into base from os.sop_versions
    where id = coalesce(p_from_version, s.current_version_id) and sop_id = p_sop;
  insert into os.sop_versions (sop_id, major, minor, content, author_id, restored_from_version_id, change_note)
  values (p_sop,
    case when p_major then latest.major + 1 else latest.major end,
    case when p_major then 0 else latest.minor + 1 end,
    coalesce(base.content, ''), auth.uid(),
    case when p_from_version is not null then p_from_version end,
    case when p_from_version is not null then 'Restored from ' || base.major || '.' || base.minor else '' end)
  returning id into vid;
  if p_from_version is not null then
    insert into os.sop_approvals (sop_version_id, decision, actor_id, note)
    values (vid, 'restored', auth.uid(), 'From ' || base.major || '.' || base.minor);
  end if;
  perform private.audit('sop.draft_started', 'sop', p_sop, jsonb_build_object('version_id', vid));
  return vid;
end $$;
grant execute on function api.start_sop_draft(uuid, boolean, uuid) to authenticated;

create function api.save_sop_draft(p_version uuid, p_content text, p_change_note text, p_expected timestamptz default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  perform private.require_active();
  select * into v from os.sop_versions where id = p_version for update;
  if not found or private.can_read_sop_version(p_version) is not true then perform private.not_found(); end if;
  if private.can_manage_sop(v.sop_id) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  if v.status <> 'draft' then
    raise exception 'Only an unpublished draft can be edited' using errcode = 'P0409';
  end if;
  perform private.check_version(p_expected, v.updated_at);
  update os.sop_versions set content = coalesce(p_content, ''), change_note = coalesce(p_change_note, '') where id = p_version;
end $$;
grant execute on function api.save_sop_draft(uuid, text, text, timestamptz) to authenticated;

create function api.submit_sop_version(p_version uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v record;
  s record;
  who uuid;
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
  if s.approver_position_id is not null then
    for who in select a.executive_id from os.position_assignments a where a.position_id = s.approver_position_id and a.during @> private.today() loop
      perform private.notify(who, 'sop.submitted', 'sop', s.id, 'sop-submitted:' || p_version);
    end loop;
  else
    perform private.notify_heads(s.department_id, 'sop.submitted', 'sop', s.id, 'sop-submitted:' || p_version);
  end if;
  perform private.audit('sop.submitted', 'sop', v.sop_id, jsonb_build_object('version_id', p_version));
end $$;
grant execute on function api.submit_sop_version(uuid) to authenticated;

create function api.return_sop_version(p_version uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  perform private.require_active();
  select * into v from os.sop_versions where id = p_version for update;
  if not found or private.can_read_sop_version(p_version) is not true then perform private.not_found(); end if;
  if private.can_publish_sop(v.sop_id) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  if v.status <> 'submitted' then raise exception 'That revision is not waiting for a decision' using errcode = 'P0409'; end if;
  if length(trim(coalesce(p_note, ''))) = 0 then raise exception 'Say what needs to change' using errcode = 'P0422'; end if;
  update os.sop_versions set status = 'draft' where id = p_version;
  insert into os.sop_approvals (sop_version_id, decision, actor_id, note) values (p_version, 'changes_requested', auth.uid(), p_note);
  perform private.notify(v.author_id, 'sop.returned', 'sop', v.sop_id, 'sop-returned:' || p_version || ':' || now());
  perform private.audit('sop.returned', 'sop', v.sop_id, jsonb_build_object('version_id', p_version));
end $$;
grant execute on function api.return_sop_version(uuid, text) to authenticated;

-- Publishing supersedes the previous version; it never overwrites or deletes it.
-- An approver who wrote the draft may publish it, because a one-person department
-- has nobody else. The audit row records that it happened.
create function api.publish_sop_version(p_version uuid, p_note text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare
  v record;
  s record;
begin
  perform private.require_active();
  select * into v from os.sop_versions where id = p_version for update;
  if not found or private.can_read_sop_version(p_version) is not true then perform private.not_found(); end if;
  if private.can_publish_sop(v.sop_id) is not true then
    raise exception 'Only a designated approver or an administrator can publish' using errcode = 'P0403';
  end if;
  if v.status not in ('submitted', 'approved') then
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
grant execute on function api.publish_sop_version(uuid, text) to authenticated;

create function api.set_sop_archived(p_sop uuid, p_archived boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  perform private.require_active();
  select * into s from os.sops where id = p_sop for update;
  if not found or private.can_read_sop(p_sop) is not true then perform private.not_found(); end if;
  if private.is_admin() is not true then
    if p_archived is not true or private.has_perm('sop.archive') is not true or
       (private.in_department(s.department_id) is not true and private.is_president() is not true) then
      raise exception 'You do not have permission for that' using errcode = 'P0403';
    end if;
  end if;
  update os.sops set archived_at = case when p_archived then now() end where id = p_sop;
  perform private.audit(case when p_archived then 'sop.archived' else 'sop.restored' end, 'sop', p_sop);
end $$;
grant execute on function api.set_sop_archived(uuid, boolean) to authenticated;

create function api.link_project_sop(p_project uuid, p_version uuid, p_linked boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_active();
  if private.can_read_project(p_project) is not true or private.can_read_sop_version(p_version) is not true then perform private.not_found(); end if;
  if private.can_manage_project(p_project) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  if p_linked then
    insert into os.project_sop_refs (project_id, sop_version_id, linked_by)
    select p_project, v.id, auth.uid() from os.sop_versions v where v.id = p_version and v.status in ('published', 'superseded')
    on conflict do nothing;
  else
    delete from os.project_sop_refs where project_id = p_project and sop_version_id = p_version;
  end if;
  perform private.audit('project.sop_link_changed', 'project', p_project, jsonb_build_object('version_id', p_version, 'linked', p_linked));
end $$;
grant execute on function api.link_project_sop(uuid, uuid, boolean) to authenticated;

-- ─── Meetings ──────────────────────────────────────────────────────────────
-- An archived meeting's attendees, links and action items are read-only with it.
create function private.guard_archived_meeting_child() returns trigger
language plpgsql set search_path = '' as $$
declare r record;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  if exists (select 1 from os.meetings where id = r.meeting_id and archived_at is not null) then
    raise exception 'This meeting is archived and read-only' using errcode = 'P0409';
  end if;
  return r;
end $$;
do $$
declare t text;
begin
  foreach t in array array['meeting_departments', 'meeting_attendees', 'meeting_action_items', 'meeting_project_links'] loop
    execute format('create trigger %I before insert or update or delete on os.%I for each row execute function private.guard_archived_meeting_child()', t || '_archived_guard', t);
  end loop;
end $$;

create function private.can_manage_meeting(p_meeting uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare m record;
begin
  if private.is_active_exec() is not true then return false; end if;
  select department_id, created_by into m from os.meetings where id = p_meeting;
  if not found then return false; end if;
  return private.is_president() or m.created_by = auth.uid()
    or (private.in_department(m.department_id) and private.has_perm('meeting.create'));
end $$;

create function api.save_meeting(p_id uuid, p_fields jsonb, p_departments uuid[], p_attendees uuid[], p_projects uuid[], p_expected timestamptz default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := p_id;
  m record;
  dept uuid := nullif(p_fields->>'department_id', '')::uuid;
begin
  perform private.require_perm('meeting.create');
  if mid is null then
    if private.in_department(dept) is not true and private.is_president() is not true then
      raise exception 'You can only record meetings for your own department' using errcode = 'P0403';
    end if;
    insert into os.meetings (title, starts_at, department_id, agenda, minutes, decisions, academic_year_id, created_by)
    values (p_fields->>'title', (p_fields->>'starts_at')::timestamptz, dept, coalesce(p_fields->>'agenda', ''), coalesce(p_fields->>'minutes', ''),
      coalesce(p_fields->>'decisions', ''), private.current_year(), auth.uid())
    returning id into mid;
  else
    select * into m from os.meetings where id = mid for update;
    if not found or private.can_read_meeting(mid) is not true then perform private.not_found(); end if;
    if private.can_manage_meeting(mid) is not true then
      raise exception 'You do not have permission for that' using errcode = 'P0403';
    end if;
    perform private.check_version(p_expected, m.updated_at);
    update os.meetings set title = p_fields->>'title', starts_at = (p_fields->>'starts_at')::timestamptz,
      agenda = coalesce(p_fields->>'agenda', ''), minutes = coalesce(p_fields->>'minutes', ''), decisions = coalesce(p_fields->>'decisions', '')
    where id = mid;
  end if;
  delete from os.meeting_departments where meeting_id = mid;
  insert into os.meeting_departments (meeting_id, department_id) select mid, x from unnest(coalesce(p_departments, '{}')) x;
  delete from os.meeting_attendees where meeting_id = mid;
  insert into os.meeting_attendees (meeting_id, executive_id) select mid, x from unnest(coalesce(p_attendees, '{}')) x;
  delete from os.meeting_project_links where meeting_id = mid;
  -- A link can only be made to a project the person can already read.
  insert into os.meeting_project_links (meeting_id, project_id)
  select mid, x from unnest(coalesce(p_projects, '{}')) x where private.can_read_project(x);
  perform private.audit('meeting.saved', 'meeting', mid);
  return mid;
end $$;
grant execute on function api.save_meeting(uuid, jsonb, uuid[], uuid[], uuid[], timestamptz) to authenticated;

create function api.save_action_item(p_id uuid, p_meeting uuid, p_title text, p_owner uuid, p_due date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare i uuid := p_id;
begin
  perform private.require_active();
  if private.can_read_meeting(p_meeting) is not true then perform private.not_found(); end if;
  if private.can_manage_meeting(p_meeting) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  if i is null then
    insert into os.meeting_action_items (meeting_id, title, owner_id, due_on) values (p_meeting, trim(p_title), p_owner, p_due) returning id into i;
  else
    update os.meeting_action_items set title = trim(p_title), owner_id = p_owner, due_on = p_due where id = i and meeting_id = p_meeting and converted_task_id is null;
    if not found then perform private.not_found(); end if;
  end if;
  return i;
end $$;
grant execute on function api.save_action_item(uuid, uuid, text, uuid, date) to authenticated;

-- An action item becomes a task in an EXISTING project, under the same rules as
-- creating that task by hand. A new project needs its own permission separately.
create function api.convert_action_item(p_item uuid, p_project uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  i record;
  p record;
  dept uuid;
  tid uuid;
begin
  perform private.require_active();
  select * into i from os.meeting_action_items where id = p_item for update;
  if not found or private.can_read_meeting(i.meeting_id) is not true then perform private.not_found(); end if;
  if private.can_manage_meeting(i.meeting_id) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  if i.converted_task_id is not null then
    raise exception 'That action item is already a task' using errcode = 'P0409';
  end if;
  select * into p from os.projects where id = p_project;
  if not found or private.can_read_project(p_project) is not true then perform private.not_found(); end if;
  select department_id into dept from os.meetings where id = i.meeting_id;
  dept := coalesce(p.owning_department_id, dept);
  if private.can_add_task_to_project(p_project, dept) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  perform private.check_assignee(i.owner_id, dept);
  insert into os.tasks (project_id, title, assigned_by, assigned_to, requesting_department_id, responsible_department_id, status,
    due_at, source, created_by)
  values (p_project, i.title, auth.uid(), i.owner_id, dept, dept, case when i.owner_id is null then 'unassigned' else 'todo' end,
    case when i.due_on is not null then (i.due_on::timestamp + time '17:00') at time zone 'America/Toronto' end, 'meeting', auth.uid())
  returning id into tid;
  update os.meeting_action_items set converted_task_id = tid where id = p_item;
  perform private.record_assignment(tid, i.owner_id, 'From meeting action item');
  perform private.audit('meeting.action_converted', 'task', tid, jsonb_build_object('meeting_id', i.meeting_id));
  return tid;
end $$;
grant execute on function api.convert_action_item(uuid, uuid) to authenticated;

-- ─── Files ─────────────────────────────────────────────────────────────────
-- Private bucket. Objects sit under entity_type/entity_id/, and a row is written
-- before the upload: the server asks here, then asks Storage for a signed upload
-- URL for exactly that path. Downloads go through a short signed URL per click.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('os-attachments', 'os-attachments', false, 26214400, array[
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
])
on conflict (id) do nothing;

create function private.allowed_upload_types() returns text[] language sql immutable set search_path = '' as $$
  select array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation']
$$;

create function api.prepare_attachment(p_type text, p_entity uuid, p_file_name text, p_content_type text, p_size bigint)
returns table (attachment_id uuid, storage_path text)
language plpgsql security definer set search_path = '' as $$
declare
  limit_mb int := coalesce((select (value #>> '{}')::int from os.settings where key = 'upload_limit_mb'), 10);
  aid uuid := gen_random_uuid();
  safe_name text := regexp_replace(coalesce(p_file_name, 'file'), '[^A-Za-z0-9._-]+', '_', 'g');
  path_ text;
begin
  perform private.require_active();
  if private.can_read_attachment_entity(p_type, p_entity) is not true then perform private.not_found(); end if;
  if (p_type = 'task' and private.can_edit_task(p_entity) is not true)
     or (p_type = 'meeting' and private.can_manage_meeting(p_entity) is not true)
     or (p_type = 'sop' and private.can_manage_sop(p_entity) is not true) then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  -- An archive takes no new files, whichever kind of record it is.
  if p_type = 'task' then
    perform private.assert_project_writable((select project_id from os.tasks where id = p_entity));
  elsif (p_type = 'meeting' and exists (select 1 from os.meetings where id = p_entity and archived_at is not null))
     or (p_type = 'sop' and exists (select 1 from os.sops where id = p_entity and archived_at is not null)) then
    raise exception 'That record is archived and read-only' using errcode = 'P0409';
  end if;
  if p_size <= 0 or p_size > limit_mb * 1024 * 1024 then
    raise exception 'Files can be up to % MB', limit_mb using errcode = 'P0422';
  end if;
  if not (p_content_type = any (private.allowed_upload_types())) then
    raise exception 'That file type is not accepted' using errcode = 'P0422';
  end if;
  path_ := p_type || '/' || p_entity || '/' || aid || '/' || right(safe_name, 120);
  insert into os.attachments (id, entity_type, entity_id, storage_path, file_name, content_type, size_bytes, uploaded_by)
  values (aid, p_type, p_entity, path_, p_file_name, p_content_type, p_size, auth.uid());
  attachment_id := aid; storage_path := path_;
  return next;
end $$;
grant execute on function api.prepare_attachment(text, uuid, text, text, bigint) to authenticated;

create function api.confirm_attachment(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a record;
begin
  perform private.require_active();
  select * into a from os.attachments where id = p_id and uploaded_by = auth.uid() for update;
  if not found then perform private.not_found(); end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'os-attachments' and o.name = a.storage_path) then
    raise exception 'The upload did not finish' using errcode = 'P0409';
  end if;
  update os.attachments set confirmed_at = now() where id = p_id;
  perform private.audit('attachment.added', a.entity_type, a.entity_id, jsonb_build_object('attachment_id', p_id));
end $$;
grant execute on function api.confirm_attachment(uuid) to authenticated;

create function api.attachment_path(p_id uuid) returns table (storage_path text, file_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.is_active_exec() is not true then return; end if;
  return query
    select a.storage_path, a.file_name from os.attachments a
    where a.id = p_id and a.confirmed_at is not null and private.can_read_attachment_entity(a.entity_type, a.entity_id);
end $$;
grant execute on function api.attachment_path(uuid) to authenticated;

-- Abandoned uploads. Rows that never confirmed: the route removes the objects,
-- then the rows. Called only with the service key.
create function api.service_claim_orphan_uploads(p_limit int default 100)
returns table (attachment_id uuid, storage_path text)
language sql security definer set search_path = '' as $$
  select id, a.storage_path from os.attachments a
  where a.confirmed_at is null and a.created_at < now() - interval '1 day'
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
$$;
grant execute on function api.service_claim_orphan_uploads(int) to service_role;

create function api.service_forget_upload(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  delete from os.attachments where id = p_id and confirmed_at is null
$$;
grant execute on function api.service_forget_upload(uuid) to service_role;

-- Storage's own policies ask the same question the tables do. The path's second
-- segment is the entity, and all writes go through signed URLs from the server.
create policy os_attachment_read on storage.objects for select to authenticated using (
  bucket_id = 'os-attachments'
  and private.can_read_attachment_entity((storage.foldername(name))[1], ((storage.foldername(name))[2])::uuid)
);

-- ─── Calendar ──────────────────────────────────────────────────────────────
-- One model, many views, no table of its own: every item is read from its source
-- record and passes that record's own read check. Fixed columns only.
create function api.calendar_items(p_from timestamptz, p_to timestamptz, p_scope text, p_department uuid default null)
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
      where p.archived_at is null and t.due_at between p_from and p_to and private.can_read_task(t.id)
        and (t.responsible_department_id = p_department or t.requesting_department_id = p_department);
    return;
  end if;

  if p_scope = 'personal' then
    return query
      select 'task'::text, t.id, t.title, t.due_at, null::timestamptz, t.status, t.priority, d.name, true, t.is_cross_team
      from os.tasks t join os.projects p on p.id = t.project_id join os.departments d on d.id = t.responsible_department_id
      where t.assigned_to = me and p.archived_at is null and t.due_at between p_from and p_to
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
             or exists (select 1 from os.tasks x join os.projects y on y.id = x.project_id where y.event_id = e.id and x.assigned_to = me));
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
      where p.archived_at is null and t.due_at between p_from and p_to and private.can_read_task(t.id);
    return;
  end if;

  raise exception 'Unknown calendar' using errcode = 'P0422';
end $$;
grant execute on function api.calendar_items(timestamptz, timestamptz, text, uuid) to authenticated;

-- ─── Search ────────────────────────────────────────────────────────────────
-- Each hit passes the same read check as opening it. Someone who can see only a
-- project's summary finds it by name, never by what its summary says.
create function api.search(p_query text)
returns table (item_type text, item_id uuid, title text, snippet text, archived boolean)
language plpgsql stable security definer set search_path = '' as $$
declare q tsquery;
begin
  if private.is_active_exec() is not true then return; end if;
  if length(trim(coalesce(p_query, ''))) < 2 then return; end if;
  q := websearch_to_tsquery('english', p_query);
  return query
  select * from (
    select 'event'::text, e.id, e.name, left(e.description, 160), e.archived_at is not null
    from os.events e
    where to_tsvector('english', e.name || ' ' || e.program || ' ' || e.description) @@ q and private.can_read_event(e.id)
    union all
    select 'project', p.id, p.name, left(p.summary, 160), p.archived_at is not null
    from os.projects p
    where to_tsvector('english', p.name || ' ' || p.summary) @@ q and private.can_read_project(p.id)
    union all
    select 'project', p.id, p.name, '', p.archived_at is not null
    from os.projects p
    where to_tsvector('english', p.name) @@ q and private.can_read_project(p.id) is not true and private.can_read_project_summary(p.id)
    union all
    select 'task', t.id, t.title, left(t.description, 160), false
    from os.tasks t
    where to_tsvector('english', t.title || ' ' || t.description || ' ' || t.deliverables) @@ q and private.can_read_task(t.id)
    union all
    select 'sop', s.id, s.title, left(s.description, 160), s.archived_at is not null
    from os.sops s left join os.sop_versions v on v.id = s.current_version_id
    where to_tsvector('english', s.title || ' ' || s.description || ' ' || coalesce(v.content, '')) @@ q and private.can_read_sop(s.id)
    union all
    select 'meeting', m.id, m.title, left(m.decisions, 160), m.archived_at is not null
    from os.meetings m
    where to_tsvector('english', m.title || ' ' || m.agenda || ' ' || m.minutes || ' ' || m.decisions) @@ q and private.can_read_meeting(m.id)
  ) hits
  limit 60;
end $$;
grant execute on function api.search(text) to authenticated;

-- ─── Academic-year transition ──────────────────────────────────────────────
-- Administrator-run and step by step, so nothing happens to the roster until
-- someone looks at it. Starting takes a snapshot; finishing moves the year on.
create function api.start_year_transition(p_new_label text, p_starts date, p_ends date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  cur uuid;
  nxt uuid;
  tid uuid;
begin
  perform private.require_admin();
  select id into cur from os.academic_years where is_current;
  insert into os.academic_years (label, starts_on, ends_on) values (trim(p_new_label), p_starts, p_ends) returning id into nxt;
  insert into os.year_transitions (from_year_id, to_year_id, started_by) values (cur, nxt, auth.uid()) returning id into tid;
  insert into os.roster_snapshots (academic_year_id, executive_id, full_name, department_name, position_title, seat_no)
  select cur, e.id, e.full_name, d.name, p.title, a.seat_no
  from os.position_assignments a
  join os.executives e on e.id = a.executive_id
  join os.positions p on p.id = a.position_id
  join os.departments d on d.id = p.department_id
  where a.during @> private.today() and e.status = 'active';
  perform private.audit('year.transition_started', 'academic_year', nxt, jsonb_build_object('from', cur));
  return tid;
end $$;
grant execute on function api.start_year_transition(text, date, date) to authenticated;

-- One handover project per department, in that department's own private space,
-- from each department's handover template. Safe to run twice.
create function api.generate_handover_projects(p_transition uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  tr record;
  d record;
  yr record;
  pid uuid;
  skey text;
  made int := 0;
  tpl uuid;
  head uuid;
begin
  perform private.require_admin();
  select * into tr from os.year_transitions where id = p_transition and status = 'open' for update;
  if not found then perform private.not_found(); end if;
  select * into yr from os.academic_years where id = tr.from_year_id;
  select t.id into tpl from os.templates t where t.key = 'internal-department-handover' and t.archived_at is null;
  for d in select * from os.departments where archived_at is null order by sort_order loop
    skey := 'handover:' || yr.label || ':' || d.id;
    select h into head from private.department_heads(d.id) h limit 1;
    insert into os.projects (kind, owning_department_id, lead_executive_id, name, summary, starts_on, due_on, status, system_key, academic_year_id)
    values ('INTERNAL', d.id, head, 'Handover ' || yr.label, 'What the next team needs to know, and everything still open.',
      private.today(), private.today() + 30, 'active', skey, tr.from_year_id)
    on conflict (system_key) do nothing
    returning id into pid;
    continue when pid is null;
    if tpl is not null then
      update os.projects set template_id = tpl, template_version_id = (select current_version_id from os.templates where id = tpl) where id = pid;
      perform private.materialize_tasks(pid, (select current_version_id from os.templates where id = tpl));
    end if;
    perform private.notify(head, 'project.generated', 'project', pid, 'handover:' || pid);
    made := made + 1;
  end loop;
  perform private.audit('year.handovers_generated', 'academic_year', tr.from_year_id, jsonb_build_object('projects', made));
  return made;
end $$;
grant execute on function api.generate_handover_projects(uuid) to authenticated;

-- Departing: unfinished work moves, the assignment ends, the account closes.
create function api.transition_departure(p_transition uuid, p_executive uuid, p_reassign_to uuid) returns int
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if not exists (select 1 from os.year_transitions where id = p_transition and status = 'open') then perform private.not_found(); end if;
  return api.deactivate_executive(p_executive, p_reassign_to);
end $$;
grant execute on function api.transition_departure(uuid, uuid, uuid) to authenticated;

-- A returning executive keeps their account and starts a new assignment. Ending
-- every open assignment here is what stops access silently carrying over.
create function api.finish_year_transition(p_transition uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare tr record;
begin
  perform private.require_admin();
  select * into tr from os.year_transitions where id = p_transition and status = 'open' for update;
  if not found then perform private.not_found(); end if;
  update os.academic_years set is_current = false where is_current;
  update os.academic_years set is_current = true where id = tr.to_year_id;
  perform private.end_assignments(null, null, tr.from_year_id);
  update os.year_transitions set status = 'completed', completed_at = now() where id = p_transition;
  perform private.audit('year.transition_finished', 'academic_year', tr.to_year_id);
end $$;
grant execute on function api.finish_year_transition(uuid) to authenticated;

-- Exceptional, administrator-only, with a reason on the record. Deleting is not
-- offered anywhere: restoration is the only way out of an archive.
create function api.restore_archived(p_type text, p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'Give a reason' using errcode = 'P0422'; end if;
  if p_type = 'project' then
    update os.projects set archived_at = null where id = p_id and archived_at is not null;
  elsif p_type = 'event' then
    update os.events set status = 'completed', archived_at = null where id = p_id and archived_at is not null;
    if found then update os.projects set archived_at = null where event_id = p_id and archived_at is not null; end if;
  elsif p_type = 'meeting' then
    update os.meetings set archived_at = null where id = p_id and archived_at is not null;
  elsif p_type = 'sop' then
    update os.sops set archived_at = null where id = p_id and archived_at is not null;
  else
    raise exception 'Unknown record type' using errcode = 'P0422';
  end if;
  if not found then perform private.not_found(); end if;
  perform private.audit('record.restored', p_type, p_id, jsonb_build_object('reason', left(p_reason, 300)));
end $$;
grant execute on function api.restore_archived(text, uuid, text) to authenticated;

create function api.archived_records()
returns table (record_type text, record_id uuid, label text, archived_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select 'event'::text, id, name, e.archived_at from os.events e where e.archived_at is not null
    union all select 'project', id, name, p.archived_at from os.projects p where p.archived_at is not null
    union all select 'sop', id, title, s.archived_at from os.sops s where s.archived_at is not null
    union all select 'meeting', id, title, m.archived_at from os.meetings m where m.archived_at is not null
    order by 4 desc limit 300;
end $$;
grant execute on function api.archived_records() to authenticated;

create function api.archive_meeting(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_active();
  if private.can_read_meeting(p_id) is not true then perform private.not_found(); end if;
  if private.can_manage_meeting(p_id) is not true then
    raise exception 'You do not have permission for that' using errcode = 'P0403';
  end if;
  update os.meetings set archived_at = now() where id = p_id and archived_at is null;
  perform private.audit('meeting.archived', 'meeting', p_id);
end $$;
grant execute on function api.archive_meeting(uuid) to authenticated;
