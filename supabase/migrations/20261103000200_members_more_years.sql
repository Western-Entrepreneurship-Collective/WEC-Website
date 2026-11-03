-- Two more years for the member list, for rows added outside the sign up form:
-- executives are members by being executives, and some are past fourth year or
-- have not told us their year yet.
--
--   'Year 5+'   fifth year and beyond
--   'Unknown'   not on record yet; replace it once someone confirms
--
-- The form's own six options do not change, so a sign up can never send these.
-- A row with 'Unknown' does not count toward the USC's member list, which needs a
-- year of study.

alter table members.members drop constraint members_year_check;
alter table members.members add constraint members_year_check
  check (year in ('Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5+', 'Graduate', 'Alumni', 'Unknown'));
