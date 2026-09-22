insert into public.clinics (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Clínica Sintética Diklass')
on conflict (id) do update set name = excluded.name;

-- Clinical records are never seeded: the attribution trigger requires an authenticated
-- veterinarian (auth.uid()), and seed.sql runs before any account is provisioned.
