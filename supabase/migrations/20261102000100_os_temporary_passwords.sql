-- Accounts created in a batch with a temporary password. Until that password is
-- replaced the account stays 'invited', and every policy and function already refuses
-- anyone who is not active. So the rule holds in the database, not just on a screen.

alter table os.executives add column must_change_password boolean not null default false;
alter table os.invitations add column temporary_password boolean not null default false;

create or replace function private.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  inv record;
  yr uuid;
begin
  select * into inv from os.invitations
  where email = lower(new.email) and accepted_at is null and revoked_at is null;
  if not found then return new; end if;

  insert into os.executives (id, email, full_name, status, must_change_password)
  values (new.id, lower(new.email), inv.full_name, 'invited', inv.temporary_password);

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

-- Watches the stored password itself, so there is no call a client could make to
-- claim it changed. An emailed reset counts too: that also proves the address.
create function private.on_auth_password_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update os.executives set must_change_password = false,
      activated_at = case when status = 'invited' then now() else activated_at end,
      status = case when status = 'invited' then 'active' else status end
    where id = new.id and must_change_password;
    if found then perform private.audit('account.password_replaced', 'executive', new.id); end if;
  end if;
  return new;
end $$;
create trigger on_auth_password_changed after update of encrypted_password on auth.users
  for each row execute function private.on_auth_password_changed();

create or replace function api.activate_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update os.executives set status = 'active', activated_at = now()
  where id = auth.uid() and status = 'invited' and not must_change_password;
  if found then perform private.audit('account.activated', 'executive', auth.uid()); end if;
end $$;

create or replace function api.me() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e record;
begin
  select * into e from os.executives where id = auth.uid();
  if not found then return null; end if;
  return jsonb_build_object(
    'id', e.id, 'email', e.email, 'full_name', e.full_name, 'preferred_name', e.preferred_name, 'status', e.status,
    'must_change_password', e.must_change_password,
    'onboarding', e.onboarding,
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

-- Called by scripts/os-create-accounts.mjs with the service key, once per person, just
-- before it creates their login. Checks the seat first, so a mistake in the list comes
-- back as a sentence rather than a failed login creation.
create function api.service_provision_account(p_email text, p_full_name text, p_position_title text, p_grant_admin boolean default false)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  addr text := lower(trim(p_email));
  pos record;
  seat int;
begin
  if exists (select 1 from os.executives where email = addr) then
    raise exception 'That address already has an account' using errcode = 'P0409';
  end if;
  if p_position_title is not null then
    select * into pos from os.positions where title = p_position_title and archived_at is null;
    if not found then raise exception 'No position called %', p_position_title using errcode = 'P0422'; end if;
    select s into seat from generate_series(1, pos.seat_count) s
    where not exists (
      select 1 from os.position_assignments a
      where a.position_id = pos.id and a.seat_no = s and a.during @> private.today()
    ) order by s limit 1;
    if seat is null then raise exception 'Every % seat is already filled', p_position_title using errcode = 'P0409'; end if;
  end if;
  insert into os.invitations (email, full_name, position_id, seat_no, grant_admin, temporary_password)
  values (addr, trim(p_full_name), pos.id, seat, coalesce(p_grant_admin, false), true)
  on conflict (email) where accepted_at is null and revoked_at is null
  do update set full_name = excluded.full_name, position_id = excluded.position_id, seat_no = excluded.seat_no,
    grant_admin = excluded.grant_admin, temporary_password = true;
  perform private.audit('account.provisioned', 'invitation', null, jsonb_build_object('position', p_position_title, 'grant_admin', coalesce(p_grant_admin, false)));
  return seat;
end $$;
grant execute on function api.service_provision_account(text, text, text, boolean) to service_role;

-- The script checks the whole list against this before it creates anyone.
create function api.service_position_seats() returns table (title text, seat_count int)
language sql stable security definer set search_path = '' as $$
  select p.title, p.seat_count from os.positions p where p.archived_at is null
$$;
grant execute on function api.service_position_seats() to service_role;

revoke execute on all functions in schema api, private from public;
