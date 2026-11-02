-- VPs, Directors and Coordinators hold the same permissions. What sets a VP apart is
-- the lead seat, which is not a permission: requests to a team go to whoever holds it.
-- Administrators can still grant more per position or person in Admin, Permissions.
insert into os.permission_grants (permission_key, org_role)
select v.permission_key, r.role from os.permission_grants v
cross join (values ('director'), ('coordinator')) as r (role)
where v.org_role = 'vp'
on conflict do nothing;
delete from os.permission_grants g
where g.org_role in ('director', 'coordinator')
  and not exists (select 1 from os.permission_grants v where v.org_role = 'vp' and v.permission_key = g.permission_key);
