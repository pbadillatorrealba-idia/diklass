insert into public.clinics (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Clínica Sintética Diklass')
on conflict (id) do update set name = excluded.name;

-- The attribution fixture is intentionally no-op until the provisioning script creates auth.users.
insert into public.clinical_records (
  clinic_id, record_type, content, status, created_by
)
select
  '00000000-0000-0000-0000-000000000001', 'patient', '{"name":"Luna"}', 'draft', id
from public.veterinarians
where identifier = 'vet.ana@example.test'
limit 1;
