insert into public.clinical_records (
  clinic_id, record_type, content, status, created_by
)
select
  '00000000-0000-0000-0000-000000000001', 'synthetic_patient', '{"name":"Luna"}', 'draft', id
from public.veterinarians
where identifier = 'vet.ana@example.test'
limit 1;
