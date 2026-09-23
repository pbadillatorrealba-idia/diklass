# Plan de implementación restante y decisiones duras — 2026-09-22

Registro de las decisiones de ejecución tomadas durante la implementación dirigida por agentes
del 2026-09-22, para que puedan revisarse y modificarse. Cada decisión indica cómo cambiarla.
Las decisiones de diseño por funcionalidad viven en el `design.md` de su cambio OpenSpec.

## Topología de ramas y PRs

| Feature | Rama | Base de la PR | Estado |
|---|---|---|---|
| 002 registro clínico | `feat/002-registro-clinico-longitudinal` | `main` (PR #27) | **lista** (27/27 tareas, revisión aplicada íntegra, CI verde) |
| 003 base de conocimiento | `feat/003-base-conocimiento-trazable` | `feat/002-registro-clinico-longitudinal` | PR #30 — revisión publicada (Con correcciones, 2 Importantes); fixes aplicándose |
| 004 captura de voz | `feat/004-captura-voz-anamnesis` | `feat/002-registro-clinico-longitudinal` | PR #29 — revisión publicada (Con correcciones, 2 Importantes); fixes aplicándose |
| 005 retroalimentación clínica | `feat/005-retroalimentacion-clinica` | `feat/002-registro-clinico-longitudinal` | PR #28 — **lista** (revisión aplicada íntegra, CI 6/6 verde, run #35801116495) |
| 006 asistencia proactiva | `feat/006-asistencia-clinica-proactiva` | `feat/003-base-conocimiento-trazable` | pendiente (depende de 003) |
| 007 tratamiento/farmacología | `feat/007-apoyo-tratamiento-farmacologia` | `feat/006-asistencia-clinica-proactiva` | pendiente (depende de 006) |

- **Los agentes NUNCA mergean PRs**: el merge es exclusivamente del usuario (decisión explícita
  del 2026-09-22). Las PRs apiladas se retargetean a `main` cuando su base se mergea.
  *Para cambiar*: editar la base de cada PR con `gh pr edit --base` al momento del merge.
- Commits y push frecuentes por rama (una feature = una rama = una PR).
- Revisión (`requesting-code-review`) por feature al terminarla; hallazgos aplicados con
  `receiving-code-review` y respondidos en los hilos de la PR.

## Verificación y entorno

- **Docker vía podman rootless**: `DOCKER_HOST=unix:///run/user/1000/podman/podman.sock` (el
  socket `/var/run/docker.sock` no es accesible al usuario). Habilitado por el usuario durante la
  sesión; antes, la verificación SQL/viva era solo de CI.
- **Puertos de Supabase local**: `supabase start` usa puertos fijos por `config.toml`, así que
  worktrees hermanos no pueden levantar stacks en paralelo. Regla adoptada: el stack local lo
  orquesta la sesión principal; las ramas hermanas verifican SQL con clúster PostgreSQL scratch
  + shims (`/tmp/verify-NNN/`, técnica documentada en el quickstart de 002) y delegan la
  verificación oficial al job `database` de CI. *Para cambiar*: dar a cada worktree un
  `supabase/config.toml` con puertos propios.
- **Playwright**: no se ejecuta en local (restricción del usuario). La suite web corre solo en CI
  (`web-e2e`, Chromium por PR; Firefox/WebKit en `main`). La verificación visual se hace con el
  navegador del orquestador contra `bun run web` + Supabase local. *Para cambiar*: levantar la
  restricción y correr `bun run test:e2e:web` localmente.
- **Ciclo rojo→verde de las suites SQL**: observado en CI (run #35785252849: 4/26 fallando por la
  razón prevista) y en clúster scratch; verde oficial en CI (run #35785766371: 26/26).

## Decisiones de datos y producto

- **Entidades clínicas en `clinical_records`** (convención de 001; D1 del design de 002). Las
  features hermanas reutilizan los tipos/acciones ya enumerados en FR-063 (`audio_fact`,
  `missing_information`, `hypothesis`, `clinical_feedback`, …). *Para cambiar*: requiere nueva
  convención + regenerar `database.types.ts` con Supabase local (discutido en D1).
- **Vocabulario de procedencia canónico de 4 valores** (`reportada | inferida | recuperada |
 desconocida`, FR-021 del brief §7) desde 002, para no romper el contrato con 003/004.
- **Lecturas tolerantes a filas ajenas**: los servicios de lectura omiten con log estructurado
  (`registro.row_content_skipped`) las filas cuyo `content` no cumple el schema (fixtures de otras
  suites en la clínica compartida); la escritura sigue siendo estricta (Zod en la frontera).
  Corrige el flaky de CI del run #35789226489 (prueba de regresión:
  `tests/unit/registro/read-resilience.test.ts`). *Para cambiar*: endurecer las lecturas y exigir
  schemas válidos a todas las suites.
- **003 corpus sintético** (decisión del usuario): documentos clínicos ficticios con estructura
  de citas documento+fragmento y metadatos de licencia; corpus real post-PoC.
- **004 `TranscriptionPort` determinista por defecto**: ASR simulado para el PoC con datos
  sintéticos; adaptador real documentado como extensión sin dependencias nuevas. *Para cambiar*:
  implementar el adaptador del proveedor elegido.
- **005 solo sobre consultas cerradas** e inmutable por trigger; correcciones vía registros
  correctivos (semántica D8 de 002).

## Numeración preasignada (evita choques entre ramas hermanas)

| Feature | Migración | Suite pgTap | Código |
|---|---|---|---|
| 002 | `009_registro_clinico.sql` | `008_registro_clinico.sql` | `src/features/registro/**` |
| 003 | `010_base_conocimiento.sql` | `009_base_conocimiento.sql` | `src/features/conocimiento/**` |
| 004 | `011_captura_voz.sql` | `010_captura_voz.sql` | `src/features/voz/**` |
| 005 | `012_retroalimentacion_clinica.sql` | `011_retroalimentacion_clinica.sql` | `src/features/retroalimentacion/**` |

## Archivos compartidos vetados a ramas hermanas

`src/lib/attribution/*`, `src/lib/storage/*`, `src/lib/supabase/*`,
`src/app/(protected)/consultations/[id].tsx`, `src/features/registro/*`, migraciones/tests 001–009
y `supabase/seed.sql`. Las ramas hermanas ponen su UI en componentes propios y reportan los
requisitos de integración; la integración de archivos compartidos la realiza la sesión principal.
*Para cambiar*: levantar el veto y coordinar merges entre ramas hermanas.

## Pendientes explícitos (no cumplidos, declarados)

- T045 y T063 de 001 (evidencia e2e web/matriz y Maestro Cloud): pendientes por falta de
  Playwright/Maestro Cloud en el entorno; documentados en el quickstart de 002.
- Flujo e2e funcional web completo del recorrido clínico (solo se amplió la compuerta de
  accesibilidad axe + teclado/foco/viewport).
- Aceptación humana de SC-012 (tiempo de registro de ficha) y SC-013 (utilidad de la epicrisis).
- Integración de `buildFollowUpSummary` con la evolución de 005 y de las citas de 003 en las
  respuestas (requisitos de integración reportados por las ramas hermanas).
