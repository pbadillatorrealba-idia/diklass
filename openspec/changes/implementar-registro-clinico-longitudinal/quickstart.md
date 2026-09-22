# Guía de validación rápida: Registro clínico longitudinal

**Creado**: 2026-09-22 · **Cambio**: `implementar-registro-clinico-longitudinal` ·
**Diseño**: [design.md](design.md) · **Tareas**: [tasks.md](tasks.md)

## Prerrequisitos

- Bun 1.4.0 (`.bun-version`) y dependencias con `bun install --frozen-lockfile`.
- Para las suites vivas y pgTap: Supabase CLI 2.117.0 + Docker (`supabase start`,
  `supabase db reset`, `bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json`,
  `SUPABASE_LIVE_TESTS=1`).
- **Restricción de esta ejecución**: el entorno de desarrollo no tuvo Docker/Supabase local ni
  Playwright. Por eso las suites pgTap y de integración viva se ejecutaron en el job `database` de
  CI y el e2e web en el job `web-e2e`; lo verificado localmente queda anotado como tal abajo.

## Compuertas locales

```sh
bun run typecheck        # tsc --noEmit
bun run lint             # biome check .
bun test tests/unit tests/integration   # las vivas se omiten sin SUPABASE_LIVE_TESTS=1
```

## GitHub Actions (compuertas de la PR)

- `quality`: `bun.lock` en sync, `bunx biome ci .`, `tsc --noEmit`.
- `unit`: `bun test tests/unit tests/integration` (suites vivas omitidas).
- `database`: `supabase start` + `supabase db reset` + `supabase test db` (pgTap 001–008) +
  diff de `database.types.ts` + `provision:veterinarians` + integración viva
  (`SUPABASE_LIVE_TESTS=1`).
- `web-e2e`: Playwright Chromium (incluye el escaneo axe WCAG 2.2 AA ampliado a las pantallas de
  pacientes/consulta); Firefox/WebKit solo en corridas de `main`.
- `dependency-audit`: `bun audit` con las excepciones vigentes del repo.

## Escenarios de validación (mapeo a la spec)

1. **Ficha y tutor** (FR-001, FR-027, FR-044 · US1): registrar paciente con campos mínimos y
   tutor; ampliar con enfermedad preexistente y alergia sin pérdida; guardar ficha incompleta y
   ver la señalización de campos sin dato frente a hallazgos negativos; asociar un segundo perro al
   tutor existente.
2. **Consulta con anamnesis** (FR-003, FR-004, FR-021 · US2): abrir consulta; registrar motivo y
   comportamiento problemático en texto libre distinguibles; marcar un antecedente como inferido;
   ver campo sin dato como desconocido; corregir procedencia y recuperar la corrección; registrar
   un antecedente con un segundo veterinario y verificar su atribución.
3. **Epicrisis validada** (FR-010, FR-011, FR-012, FR-024 · US3): generar borrador editable desde
   la sesión; verificar que el borrador no figura como definitivo; aprobar y comprobar aprobador y
   momento; corregir una epicrisis aprobada y verificar registro adicional con el original intacto.
4. **Seguimiento longitudinal** (FR-002, FR-013, FR-024, FR-045 · US4): iniciar segunda consulta y
   ver el resumen previo con pendientes señalados; cerrarla y comprobar que la consulta anterior
   permanece idéntica; listar el historial en orden cronológico con su epicrisis; interrumpir y
   retomar una consulta sin contaminar el historial.

## Evidencia de verificación (incremental)

**Suite pgTap 008 — ciclo rojo→verde (Constitución II).**

| Etapa | Dónde | Resultado |
|---|---|---|
| Rojo previo (suite 008 sin migración 009) | CI run [#35785252849](https://github.com/pbadillatorrealba-idia/diklass/actions/runs/35785252849), job [Supabase database tests](https://github.com/pbadillatorrealba-idia/diklass/actions/runs/35785252849/job/106940381816) (2026-09-22) | **4/26 fallan exactamente** los asserts 14 (cierre atómico D4), 20 (`CONSULTATION_LINK_IMMUTABLE`), 21 (`CLINICAL_RECORD_SEALED`) y 25 (segunda consulta cerrada) por la razón prevista; suites 001–007 verdes |
| Reproducción local (evidencia complementaria) | clúster PostgreSQL 18 scratch con pgTap 1.3.4, fuera del repo (`/tmp/verify`) | rojo 22 ok / 4 not-ok (mismos 4 asserts); verde 26/26 con la migración 009; suites 001–007 verdes con 009 aplicada (12/12, 17/17, 14/14, 30/30, 18/18, 5/5, 10/10) |
| Verde oficial (con migración 009 + modelos TS) | CI run [#35785766371](https://github.com/pbadillatorrealba-idia/diklass/actions/runs/35785766371), job [Supabase database tests](https://github.com/pbadillatorrealba-idia/diklass/actions/runs/35785766371/job/106942064048) (2026-09-22) | **26/26 verdes** en la suite 008 y suites 001–007 verdes; `supabase gen types` sin diff |

**Modelos TS (tareas 2.1–2.3)**: `bun test tests/unit/registro` — rojo previo por módulos inexistentes
(la razón prevista) y luego **56 pass / 0 fail** (125 `expect()`), verificado localmente.

<!-- Verde de CI con migración 009 + TS y el resto de compuertas: se registra en 5.2. -->

## Transiciones sin acción enumerada (D4 · tarea 1.3)

`clinical_record_action` devuelve `null` (sin evento de auditoría propio) en exactamente tres
transiciones — verificado en `003_attribution_hardening.sql` y por el assert 16 de la suite 008:

1. `INSERT` de `epicrisis`: el borrador nace sin acción enumerada; solo su aprobación lo es.
2. `UPDATE` de `epicrisis`: la edición del borrador (y el propio `UPDATE` que ejecuta la aprobación:
   su evento `epicrisis_approved` lo inserta la RPC, no el trigger).
3. `UPDATE` de `consultation`: el cierre es consecuencia de la aprobación (D4) y
   `epicrisis_approved` es su única acción enumerada.

Ninguna otra transición da `null`: el `INSERT` cubre los 12 `record_type` salvo `epicrisis`; el
`UPDATE` los cubre salvo `consultation` y `epicrisis`; `status='corrective'` siempre mapea a
`corrective_record_created`.

## Tareas pendientes de 001 (identidad y acceso) — estado documental

Las dos tareas restantes del cambio `implementar-identidad-y-acceso` quedan **pendientes** y no se
cierran en esta tanda (decisión explícita del 2026-09-22). Su evidencia exige herramientas fuera
del entorno de esta ejecución (Playwright con matriz de navegadores y Maestro Cloud con
`EXPO_TOKEN`/`MAESTRO_CLOUD_API_KEY`, además de Docker/Supabase local):

- **T045**: ejecutar la matriz web completa y los flows Maestro nativos, registrando la evidencia
  que exige el `quickstart.md` de 001 («Evidencia mínima»).
- **T063**: dejar obtenible la evidencia e2e nativa: perfil `e2e` en `eas.json`, secretos
  documentados y registrados, ejecución de `tests/e2e/native/*.yaml` y registro del resultado.

Ninguna de las dos bloquea la construcción de registro clínico longitudinal; la aceptación conjunta
de la historia de atribución (US12, SC-040/041/042/044) se ejercita con las entidades que esta
funcionalidad define y se registra en esta guía.

## Pendientes de esta funcionalidad (declarados)

- Verificación visual de las pantallas nuevas (el entorno no permitió levantar la app contra
  Supabase local).
- Flujo e2e funcional web del recorrido clínico completo (solo se amplió el escaneo de
  accesibilidad; el resto lo cubren pgTap e integración viva).
- Aceptación humana de SC-012 (registro de ficha < 3 min sin asistencia) y SC-013 (utilidad de la
  epicrisis, ≥ 3 especialistas sobre ≥ 5 casos, ≥ 3/5 en promedio).
