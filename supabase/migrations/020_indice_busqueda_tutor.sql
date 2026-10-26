-- search_patients compara tutor.id::text con tutorId: la PK UUID no cubre esa expresión.
-- Evita recorrer y reevaluar la RLS de todos los tutores por cada paciente; conserva la RPC.
create index clinical_records_tutor_text_id_idx
  on public.clinical_records ((id::text))
  where record_type = 'tutor';
