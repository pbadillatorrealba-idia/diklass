insert into public.clinics (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Clínica Sintética Diklass')
on conflict (id) do update set name = excluded.name;

-- The attribution fixture is intentionally no-op until the provisioning script creates auth.users.
\ir tests/fixtures/attribution.sql
