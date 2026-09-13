create table public.clinical_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  record_type text not null,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'approved', 'corrective')),
  supersedes_event_id uuid references public.clinical_audit_events(id),
  created_by uuid not null default auth.uid() references public.veterinarians(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.veterinarians(id),
  updated_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.veterinarians(id)
);

create index clinical_records_clinic_idx on public.clinical_records(clinic_id, created_at);

create or replace function public.guard_approved_clinical_record()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.approved_at is not null then
    raise exception 'APPROVED_RECORD_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.audit_clinical_record()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.clinical_audit_events(entity_type, entity_id, action, actor_id, metadata, supersedes_event_id)
  values (
    'clinical_record',
    new.id,
    case when tg_op = 'INSERT' then 'clinical_record_created' else 'clinical_record_updated' end,
    coalesce(new.updated_by, auth.uid(), new.created_by),
    jsonb_build_object('recordType', new.record_type, 'status', new.status),
    new.supersedes_event_id
  );
  return new;
end;
$$;

create trigger clinical_records_guard_attribution
before insert or update on public.clinical_records
for each row execute function public.deny_attribution_mutation();

create trigger clinical_records_guard_approval
before update on public.clinical_records
for each row execute function public.guard_approved_clinical_record();

create trigger clinical_records_stamp_update
before update on public.clinical_records
for each row execute function public.stamp_update_attribution();

create trigger clinical_records_audit
after insert or update on public.clinical_records
for each row execute function public.audit_clinical_record();

alter table public.clinical_records enable row level security;

create policy "active clinic veterinarians can read shared clinical records"
on public.clinical_records for select to authenticated
using (
  public.is_active_access(auth.uid())
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid() and veterinarian.clinic_id = clinical_records.clinic_id
  )
);

create policy "active clinic veterinarians can create clinical records"
on public.clinical_records for insert to authenticated
with check (
  public.is_active_access(auth.uid())
  and created_by = auth.uid()
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid() and veterinarian.clinic_id = clinical_records.clinic_id
  )
);

create policy "active clinic veterinarians can update draft records"
on public.clinical_records for update to authenticated
using (
  public.is_active_access(auth.uid())
  and approved_at is null
  and exists (
    select 1 from public.veterinarians veterinarian
    where veterinarian.id = auth.uid() and veterinarian.clinic_id = clinical_records.clinic_id
  )
)
with check (created_by = (select auth.uid()));

grant select, insert, update on public.clinical_records to authenticated;
