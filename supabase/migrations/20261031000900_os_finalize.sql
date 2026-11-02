-- Keep this the last step of any migration that adds functions. A function is
-- callable only where a GRANT line says so; supabase/tests/00_lockdown.sql checks.
revoke execute on all functions in schema api, private from public;
