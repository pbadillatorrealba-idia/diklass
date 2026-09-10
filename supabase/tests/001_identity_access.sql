begin;
select plan(6);

select has_table('public', 'clinics', 'clinics table exists');
select has_table('public', 'veterinarians', 'veterinarians table exists');
select has_table('public', 'access_sessions', 'access_sessions table exists');
select has_table('public', 'clinical_audit_events', 'audit table exists');
select has_function('public', 'is_active_access', ARRAY['uuid'], 'active access helper exists');
select has_function('public', 'start_access_session', ARRAY[]::text[], 'session RPC exists');

select * from finish();
rollback;
