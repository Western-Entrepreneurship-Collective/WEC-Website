-- When a team is added to a project, everyone on it hears about it: a notification on
-- the site and an email naming the project and the team. This covers a team chosen for
-- a shared project, a team added later, and a team's project made by an approved event.

-- Everyone holding a position on the team today, including anyone yet to sign in.
create function private.team_members(p_department uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct a.executive_id
  from os.position_assignments a
  join os.positions p on p.id = a.position_id
  join os.executives e on e.id = a.executive_id
  where p.department_id = p_department and a.during @> private.today() and e.status in ('active', 'invited')
$$;

-- The dedupe keys make this safe to repeat: re-saving a project's teams, or removing and
-- re-adding one, never tells anyone twice. The person who added the team is skipped.
-- For an event's generated project, the team's head already gets "New project for your
-- team", so they get the email but not a second notification.
create function private.announce_team_added(p_project uuid, p_department uuid, p_generated boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare
  who uuid;
  key_ text;
begin
  if p_department is null then return; end if;
  for who in select private.team_members(p_department) loop
    continue when who = auth.uid();
    key_ := 'team-added:' || p_project || ':' || p_department || ':' || who;
    if not (p_generated and who in (select private.department_heads(p_department))) then
      perform private.notify(who, 'project.team_added', 'project', p_project, key_);
    end if;
    perform private.enqueue('email.team_added', 'executive', who,
      jsonb_build_object('project_id', p_project, 'department_id', p_department), key_);
  end loop;
end $$;

create function private.team_added_on_link() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.announce_team_added(new.project_id, new.department_id);
  return new;
end $$;
create trigger project_departments_announce after insert on os.project_departments
  for each row execute function private.team_added_on_link();

-- An approved event makes one project per team, owned by that team.
create function private.team_added_on_generate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.event_id is not null and new.template_id is not null then
    perform private.announce_team_added(new.id, new.owning_department_id, true);
  end if;
  return new;
end $$;
create trigger projects_announce_generated after insert on os.projects
  for each row execute function private.team_added_on_generate();

-- What the email route may send for these: the address, the team and the project's name.
-- Claiming marks that project's notifications as emailed, so the daily digest doesn't
-- send a second email about the same thing.
create function api.service_claim_team_emails(p_limit int default 40)
returns table (job_id uuid, email text, preferred_name text, team_name text, project_id uuid, project_name text)
language plpgsql security definer set search_path = '' as $$
declare
  j record;
  addr text;
  nm text;
  team_ text;
  proj text;
  wants boolean;
begin
  for j in
    select * from os.jobs where kind = 'email.team_added' and state in ('pending', 'failed') and next_run_at <= now()
    order by next_run_at limit least(greatest(coalesce(p_limit, 40), 1), 100) for update skip locked
  loop
    select e.email, coalesce(nullif(e.preferred_name, ''), split_part(e.full_name, ' ', 1)) into addr, nm
    from os.executives e where e.id = j.entity_id and e.status in ('active', 'invited');
    select d.name into team_ from os.departments d where d.id = (j.payload->>'department_id')::uuid;
    select p.name into proj from os.projects p where p.id = (j.payload->>'project_id')::uuid and p.archived_at is null;
    select coalesce((select n.email_digest from os.notification_preferences n where n.executive_id = j.entity_id), true) into wants;
    if addr is null or team_ is null or proj is null or not wants then
      update os.jobs set state = 'done', finished_at = now() where id = j.id;
      continue;
    end if;
    update os.jobs set state = 'running', attempts = attempts + 1 where id = j.id;
    update os.notifications n set emailed_at = now()
    where n.recipient_id = j.entity_id and n.entity_id = (j.payload->>'project_id')::uuid and n.emailed_at is null;
    job_id := j.id; email := addr; preferred_name := nm; team_name := team_; project_id := (j.payload->>'project_id')::uuid; project_name := proj;
    return next;
  end loop;
end $$;
grant execute on function api.service_claim_team_emails(int) to service_role;

revoke execute on all functions in schema api, private from public;
