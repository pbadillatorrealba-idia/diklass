-- 013_cierre_consulta.sql — Una consulta solo se cierra aprobando su epicrisis.
--
-- Cambio: openspec/changes/implementar-registro-clinico-longitudinal (tasks.md 7.10).
-- Cierra el riesgo que la segunda revisión de la PR #27 dejó declarado en design.md: el
-- sellado de 009 impide reabrir una consulta cerrada (D5.4), pero un UPDATE directo por
-- PostgREST aún podía pasar una consulta 'open' a 'closed' sin aprobar su epicrisis, y un
-- INSERT podía crearla ya cerrada. Las dos cosas rompen SC-014 (toda consulta cerrada con su
-- epicrisis) y D4 (el cierre es consecuencia de approve_clinical_record).
--
--   * Una consulta nace 'open' y su estado pertenece a {open, closed}
--     (CONSULTATION_STATUS_INVALID, SQLSTATE 23514, para cualquier otro valor o su ausencia;
--     CONSULTATION_CLOSE_REQUIRES_APPROVAL si nace 'closed').
--   * Pasar a 'closed' exige una epicrisis aprobada de ESA consulta en la misma clínica
--     (CONSULTATION_CLOSE_REQUIRES_APPROVAL, SQLSTATE 23514). approve_clinical_record aprueba
--     la epicrisis antes de cerrar la consulta en la misma transacción (orden de D4), así que
--     la condición se cumple por ese camino sin tocar la función.
--
-- No lleva security definer, igual que guard_consultation_sealed: la consulta de la epicrisis
-- corre con la RLS de quien escribe, que ya puede leer las epicrisis de su clínica, y dentro
-- de approve_clinical_record corre como su propietario. No se modifican grants: una función
-- trigger no es invocable por la Data API (suite 004). Verificación:
-- supabase/tests/013_cierre_consulta.sql (pgTap).

create or replace function public.guard_consultation_close()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  new_status text := new.content ->> 'status';
begin
  if new.record_type <> 'consultation' then
    return new;
  end if;

  if new_status is null or new_status not in ('open', 'closed') then
    raise exception 'CONSULTATION_STATUS_INVALID' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    if new_status = 'closed' then
      raise exception 'CONSULTATION_CLOSE_REQUIRES_APPROVAL' using errcode = '23514';
    end if;
    return new;
  end if;

  -- UPDATE: solo la transición open → closed necesita la epicrisis aprobada. Un UPDATE de una
  -- consulta ya cerrada lo rechaza antes guard_consultation_sealed (009, D5.4).
  if new_status = 'closed' and (old.content ->> 'status') is distinct from 'closed' then
    if not exists (
      select 1
      from public.clinical_records epicrisis
      where epicrisis.record_type = 'epicrisis'
        and epicrisis.status = 'approved'
        and epicrisis.clinic_id = new.clinic_id
        and epicrisis.content ->> 'consultationId' = new.id::text
    ) then
      raise exception 'CONSULTATION_CLOSE_REQUIRES_APPROVAL' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger clinical_records_guard_consultation_close
before insert or update on public.clinical_records
for each row execute function public.guard_consultation_close();
