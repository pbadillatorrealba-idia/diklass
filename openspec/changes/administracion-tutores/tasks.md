Estado: lo marcado `[x]` está **implementado y verificado con la prueba indicada**; ninguna marca
es aceptación. Lo pendiente queda sin marcar.

## 1. Base de datos (FR-120, FR-123)

- [x] 1.1 `supabase/tests/017_administracion_tutores.sql` (pgTap): alcance por clínica, filtro por
  nombre+apellido y por contacto, comodín literal, orden por nombre/pacientes, `patient_count`,
  `total_count`, rechazo de un tutor sin nombre. Verificación: 10/10 en verde, y la suite completa (18 archivos, 320) en verde.
- [x] 1.2 Migración `017_administracion_tutores.sql`: `search_tutors`, índice
  `clinical_records_tutor_idx` y `check` de nombre `not valid`. Verificación: 1.1 en verde y
  pgTap 004, 008, 010 y 015 sin regresión.
- [x] 1.3 `database.types.ts` con `search_tutors` (editado a mano con el estilo del archivo; el contenido
  coincide con `supabase gen types`; CLI local con otro formato). Verificación: `tsc` limpio.

## 2. Servicio (FR-120, FR-122)

- [x] 2.1 `tests/unit/registro/tutor-search.test.ts`: argumentos del RPC, página y total, error
  propagado, y `findDuplicateTutors` (exacto sin mayúsculas, ignora lo que no coincide, el error no
  rompe). Verificación: en verde (primero en rojo).
- [x] 2.2 `src/features/registro/tutor-search.ts` (`searchTutors`, `TUTOR_SORT_COLUMNS`,
  `findDuplicateTutors`). Verificación: 2.1.

## 3. Interfaz (FR-119, FR-121–FR-123)

- [x] 3.1 `TutorForm` extraído de `patients/new.tsx` con los mismos `testID`; `tests/unit/registro/
  tutor-form.test.ts` (errores por campo, contacto obligatorio). Verificación: en verde y
  `patients/new.tsx` usándolo.
- [x] 3.2 `tutors-table` (tabla ↔ tarjetas) y `tutors/index.tsx` con filtros, orden y página en la
  URL, `action` «Registrar tutor» y enlace «Tutores» en `/patients`. Verificación:
  `tests/unit/registro/tutors-table.test.tsx`, Biome y `tsc`.
- [x] 3.3 `tutors/new.tsx` con aviso de duplicado y «Registrar de todos modos»; `tutors/[id].tsx`
  con card «Contacto» editable. Verificación: Biome y `tsc`.
- [x] 3.4 e2e `tutores.spec.ts` (alta, contacto obligatorio, duplicado, edición, búsqueda, axe) en
  Chromium, workers=1: en verde; también `ficha-etologica`, `estados` y `accesibilidad`.
- [ ] 3.5 Verificar a mano en navegador a 1280, 768 y 375 px, y axe en modo oscuro.

## 4. Cierre

- [ ] 4.1 `bun run lint`, `tsc --noEmit`, unit, pgTap y e2e web completos; registrar evidencia y URL
  de CI. Hasta entonces este cambio no está aceptado.
- [x] 4.2 Nota de revisión de FR-116 en `rediseno-pacientes` (ahora editable). Verificación: lectura.
