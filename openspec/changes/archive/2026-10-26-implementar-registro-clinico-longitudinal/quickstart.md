# Guía de validación rápida: Registro clínico longitudinal

**Creado**: 2026-09-22 · **Cambio**: `implementar-registro-clinico-longitudinal` ·
**Diseño**: [design.md](design.md) · **Tareas**: [tasks.md](tasks.md)

## Prerrequisitos

- Bun 1.4.0 (`.bun-version`) y dependencias con `bun install --frozen-lockfile`.
- Para las suites vivas y pgTap: Supabase CLI 2.117.0 + Docker (vía podman rootless:
  `export DOCKER_HOST=unix:///run/user/1000/podman/podman.sock`), luego `supabase start`,
  `supabase db reset`, `bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json`
  y `SUPABASE_LIVE_TESTS=1`.

## Compuertas locales

```sh
bun run typecheck                       # tsc --noEmit
bun run lint                            # biome check .
bun test tests/unit tests/integration   # vivas omitidas sin SUPABASE_LIVE_TESTS=1
supabase test db                        # pgTap 001–008
SUPABASE_LIVE_TESTS=1 bun test tests/integration   # integración viva (tras provisionar)
```

## GitHub Actions (compuertas de la PR #27)

- `quality`: `bun.lock` en sync, `bunx biome ci .`, `tsc --noEmit`.
- `unit`: `bun test tests/unit tests/integration` (suites vivas omitidas).
- `database`: `supabase start` + `db reset` + `supabase test db` (pgTap 001–008) + diff de
  `database.types.ts` + `provision:veterinarians` + integración viva (`SUPABASE_LIVE_TESTS=1`).
- `web-e2e`: Playwright Chromium — accesibilidad axe WCAG 2.2 AA (login, home, pacientes, ficha,
  consulta), recorrido por teclado con foco visible, viewport 375/1280 px y el ciclo del borrador
  US11/AC5; Firefox/WebKit solo en corridas de `main`.
- `dependency-audit`: `bun audit` con las excepciones vigentes del repo.

## Escenarios de validación (mapeo a la spec)

1. **Ficha y tutor** (FR-001, FR-027, FR-044 · US1): alta con tutor nuevo o existente sin
   duplicar; ampliación con antecedentes sin pérdida; ficha incompleta aceptada con señalización
   de campos sin dato vs hallazgos negativos; consulta con medicamentos y conductuales.
2. **Consulta con anamnesis** (FR-003, FR-004, FR-021 · US2): apertura con profesional; motivo y
   comportamiento problemático distinguibles; procedencia por antecedente (4 valores canónicos);
   campo sin dato como desconocido; corrección de procedencia recuperable; atribución al segundo
   veterinario.
3. **Epicrisis validada** (FR-010, FR-011, FR-012, FR-024 · US3): borrador editable desde la
   sesión (no definitivo); aprobación con aprobador y momento que cierra la consulta en la misma
   transacción; corrección posterior como registro adicional con el original intacto.
4. **Seguimiento longitudinal** (FR-002, FR-013, FR-024, FR-045 · US4): resumen previo automático
   con pendientes señalados; registros anteriores idénticos tras cerrar la segunda consulta;
   historial cronológico con epicrisis; retoma de consulta interrumpida sin contaminar el historial.

## Evidencia de verificación (2026-09-22)

**Suite pgTap 008 — ciclo rojo→verde (Constitución II).**

| Etapa | Dónde | Resultado |
|---|---|---|
| Rojo previo (008 sin migración 009) | CI [#35785252849](https://github.com/pbadillatorrealba-idia/diklass/actions/runs/35785252849) · [job database](https://github.com/pbadillatorrealba-idia/diklass/actions/runs/35785252849/job/106940381816) | **4/26 fallan exactamente** los asserts 14 (cierre atómico D4), 20 (`CONSULTATION_LINK_IMMUTABLE`), 21 (`CLINICAL_RECORD_SEALED`) y 25 (segunda consulta cerrada) por la razón prevista; 001–007 verdes |
| Reproducción local complementaria | clúster PostgreSQL 18 scratch con pgTap 1.3.4 (`/tmp/verify`) | rojo 22/4 (mismos 4 asserts); verde 26/26 con 009; 001–007 verdes con 009 aplicada |
| Verde oficial | CI [#35785766371](https://github.com/pbadillatorrealba-idia/diklass/actions/runs/35785766371) · [job database](https://github.com/pbadillatorrealba-idia/diklass/actions/runs/35785766371/job/106942064048) | **26/26** en 008; 001–007 verdes; `supabase gen types` sin diff |

**Pruebas de TypeScript (rojo→verde observado en cada capa).**

| Capa | Rojo previo | Verde |
|---|---|---|
| Modelos y contrato (2.1–2.3) | `Cannot find module '@/features/registro/…'` y export faltante (razón prevista) | 56 pass / 0 fail (125 `expect()`) |
| Servicios (3.1–3.3) | `Cannot find module` de los servicios (razón prevista) | 99 pass / 0 fail (225 `expect()`) |
| Regresión de lecturas tolerantes | 3 fail por `ZodError` sobre filas ajenas (flaky del run #35789226489) | 3 pass / 0 fail con `registro.row_content_skipped` |
| Ciclo del borrador con `discard` (4.3) | `TypeError: session.discard is not a function` (razón prevista) | verde |
| Total unitario final | — | **184 pass / 0 fail** (377 `expect()`), `tsc --noEmit` y `bunx biome ci .` limpios |

**Integración viva local** (stack podman + provision ANA/BRUNO, en el mismo orden que rompía en
CI): **35 pass / 0 fail** (tests/integration completos, `SUPABASE_LIVE_TESTS=1`).

**Compulta completa de la PR — CI [#35791139550](https://github.com/pbadillatorrealba-idia/diklass/actions/runs/35791139550): TODOS los jobs en verde**
(`quality`, `unit`, `database`, `dependency-audit`, `web-e2e` con axe WCAG 2.2 AA + teclado/foco +
viewport + US11/AC5 sobre la superficie 002).

**Correcciones de compuerta incluidas en la evidencia**: lecturas tolerantes a filas ajenas
(regresión con test propia), `aria-checked` en los radios del selector de opciones, indicador
global de foco visible (`:focus-visible` en `src/global.css`), exclusión documentada del overlay
de desarrollo `#error-toast` de `@expo/log-box` en el escaneo axe (solo existe con
`NODE_ENV=development`; su marcado no es superficie de la aplicación), y reencuadre del test
US11/AC5 de la 001 sobre la superficie 002 conservando todas sus aserciones de contrato
(provisionando ficha y consulta reales con el token de ANA).

## Evidencia de la segunda revisión de la PR #27 (2026-09-24, tareas 7.x)

Ejecutado en local sobre la rama con Supabase local (`DOCKER_HOST` al socket rootless de podman) y
los veterinarios sintéticos provisionados con `bun run provision:veterinarians -- --fixture
tests/fixtures/veterinarians.json`:

| Compuerta | Comando | Resultado |
|---|---|---|
| Lint estricto | `bunx biome ci --error-on-warnings .` | verde |
| Tipos | `bun run typecheck` | verde |
| pgTap | `supabase db reset && supabase test db` | 140/140 en 9 suites (008: 31 aserciones) |
| Unidad | `bun run test` | 195 pass, 38 skip (vivas), 0 fail |
| Integración viva | `SUPABASE_LIVE_TESTS=1 bun run test:integration` | 37 pass, 0 fail |
| Web e2e (Chromium) | `bunx playwright test --project=chromium` | 17 pass, 1 fail (ver nota) |

Rojos observados antes de cada arreglo: 3 aserciones pgTap nuevas (7.1–7.2), la carrera con dos
sesiones (7.3: 1 fila frente a 0), el e2e de la epicrisis (7.4), las dos pruebas vivas de
concurrencia (7.5, 3 de 3 corridas), las dos unitarias de atribución (7.6) y el e2e del historial
(7.7).

Nota sobre el e2e: `auth.spec.ts` «unsaved notes survive an expired session…» falla en local
también sobre el commit anterior a esta tanda (`6b04a5d`), cuyo job `Web E2E` de CI pasó. Es un
fallo del entorno local, no de estos cambios; el job de CI de la rama es la referencia.

## Evidencia del cierre solo por aprobación (2026-09-25, tarea 7.10)

Migración `013_cierre_consulta.sql`, en local con Supabase local:

| Compuerta | Resultado |
|---|---|
| `supabase/tests/013_cierre_consulta.sql` sin la 013 | 7 de 8 en rojo (y 4 más en rojo con la primera versión de la 013, revisión de la PR #33) |
| `supabase db reset && supabase test db` con la 013 | 288/288 en 15 suites |
| Chequeo de datos existentes de la 013 | aborta con `CONSULTATION_DATA_VIOLATES_013` ante una consulta cerrada sin epicrisis |
| `bun run db:types` | sin diff (solo un trigger) |
| `bun run test` con las suites vivas | 450 pass, 0 fail |
| `bun run test:integration` | 69 pass, 0 fail |
| `bunx playwright test --project=chromium` | 25 pass, 1 fail (el `auth.spec.ts` que solo falla en local) |

## Transiciones sin acción enumerada (D4 · tarea 1.3)

`clinical_record_action` devuelve `null` (sin evento de auditoría propio) en exactamente tres
transiciones — verificado en `003_attribution_hardening.sql` y por el assert 16 de la suite 008:

1. `INSERT` de `epicrisis`: el borrador nace sin acción enumerada; solo su aprobación lo es.
2. `UPDATE` de `epicrisis`: la edición del borrador (y el propio `UPDATE` que ejecuta la
   aprobación: su evento `epicrisis_approved` lo inserta la RPC, no el trigger).
3. `UPDATE` de `consultation`: el cierre es consecuencia de la aprobación (D4) y
   `epicrisis_approved` es su única acción enumerada.

Ninguna otra transición da `null`: el `INSERT` cubre los 12 `record_type` salvo `epicrisis`; el
`UPDATE` los cubre salvo `consultation` y `epicrisis`; `status='corrective'` siempre mapea a
`corrective_record_created`.

## Tareas pendientes de 001 (identidad y acceso) — estado documental

Las dos tareas restantes del cambio `implementar-identidad-y-acceso` quedan **pendientes** y no se
cierran en esta tanda (decisión explícita del 2026-09-22). Su evidencia exige herramientas fuera
del entorno de esta ejecución (Playwright con matriz de navegadores y Maestro Cloud con
`EXPO_TOKEN`/`MAESTRO_CLOUD_API_KEY`):

- **T045**: matriz web completa y flows Maestro nativos con la evidencia mínima del quickstart de 001.
- **T063**: perfil `e2e` en `eas.json`, secretos documentados y ejecución de `tests/e2e/native/*.yaml`.

Ninguna bloquea registro clínico longitudinal; la aceptación conjunta de la historia de atribución
(US12, SC-040/041/042/044) se ejercita con las entidades de esta funcionalidad y queda registrada
aquí.

## Pendientes de esta funcionalidad (declarados)

- **Verificación visual**: no hubo inspección visual humana ni del navegador del orquestador sobre
  las pantallas nuevas en esta tanda; la verificación de superficie es la suite web de CI (axe +
  teclado + viewport). Queda una pasada visual/aceptación cuando el entorno lo permita.
- **Flujo e2e funcional web completo** del recorrido clínico. `registro-epicrisis.spec.ts` cubre
  dos recorridos acotados (tareas 7.4 y 7.7); el resto lo cargan pgTap y la integración viva.
- **Aceptación humana** de SC-012 (registro de ficha < 3 min sin asistencia) y SC-013 (utilidad de
  la epicrisis: ≥ 3 especialistas sobre ≥ 5 casos, ≥ 3/5 en promedio).
