-- The 2026-27 positions as the club confirmed them. 22 seats. Titles only: real names
-- never go in this public repository.
update os.positions set title = 'Director of Financial Operations' where title = 'Director of Finance';
update os.positions set seat_count = 2 where title = 'Director of Logistics';

update os.positions set archived_at = now() where title = 'Sponsorship Coordinator';
insert into os.positions (department_id, title, org_role, seat_count, sort_order, reports_to_position_id)
select vp.department_id, 'Director of Sponsorship', 'director', 1, 2, vp.id
from os.positions vp where vp.title = 'VP Sponsorship';
