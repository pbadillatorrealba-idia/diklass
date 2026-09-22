# Guía de validación rápida: Retroalimentación clínica

**Creado**: 2026-09-22 · **Cambio**: `implementar-retroalimentacion-clinica` ·
**Diseño**: [design.md](design.md) · **Tareas**: [tasks.md](tasks.md)

Documento vivo: nace con la evidencia de la tarea 1.1 y se llena de forma incremental;
la consolidación final corresponde a la tarea 5.2.

## Prerrequisitos

- Bun 1.4.0 (`.bun-version`) y dependencias con `bun install --frozen-lockfile`.
- Verificación SQL local: clúster PostgreSQL 18 scratch + pgTap 1.3.4 con shims en
  `/tmp/verify-005/` (`run.sh`, `bootstrap.sql` — patrón del quickstart de 002; rutas y
  puerto 55433 propios para no pisar a las ramas hermanas). **Nunca `supabase stop`**.
- Integración viva opcional con el stack local: `export DOCKER_HOST=unix:///run/user/1000/podman/podman.sock`,
  `supabase start`, `supabase db reset`, `bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json`
  y `SUPABASE_LIVE_TESTS=1`. Las suites vivas también se ejecutan en el job `database` de CI.

## Compuertas locales

```sh
bun run typecheck                                   # tsc --noEmit
bunx biome check --write src/features/retroalimentacion src/components/retroalimentacion \
  src/app/\(protected\)/follow-up tests/unit/retroalimentacion tests/integration/retroalimentacion
bun test tests/unit/retroalimentacion tests/integration/retroalimentacion   # vivas se omiten sin SUPABASE_LIVE_TESTS=1
bash /tmp/verify-005/run.sh                         # rojo/verde pgTap 011 + compatibilidad 001-008
```

## Escenarios de validación (mapeo a la spec)

1. **Registro estructurado de evolución** (FR-018, FR-039, FR-057 · US10-AC1/AC7/AC10/AC12):
   registrar una entrada sobre una consulta cerrada con tratamiento aplicado y su modificación
   distinguibles, fechas de registro y consulta separadas, y aceptar tratamiento vacío.
2. **Categorías sin forzar binarias** (FR-040, FR-043 · SC-023 · US10-AC8/AC9): adherencia y
   evolución con `parcial`/`desconocida`; recuperación agregada de los categóricos sin texto libre.
3. **Eventos adversos diferenciados** (FR-041 · SC-035 · US10-AC2): recuperables aparte de la
   evolución, con `grave` destacado.
4. **Aditivo e inmutable** (FR-024 · SC-022 · US10-AC3/AC4/AC5): epicrisis y diagnóstico intactos
   tras registrar; corrección como registro nuevo con el original y las correctivas previas
   recuperables.
5. **Atribución** (FR-063, FR-070 · SC-049 · US10-AC13): cada entrada y corrección atribuida a la
   identidad autenticada de quien la registró, aunque sea distinta del veterinario que atendió.
6. **Antecedentes de seguimiento** (FR-042 · US10-AC6): la evolución previa se presenta en el panel
   de seguimiento; su integración en el resumen de la consulta posterior queda como requisito de
   integración (D9).

## Evidencia de verificación (incremental)

**Suite pgTap 011 — ciclo rojo→verde (Constitución II).** Clúster scratch `/tmp/verify-005/`
(PostgreSQL 18.6 desde los .deb de `/tmp/pgdl`, pgTap 1.3.4, shims de `/tmp/verify-005/bootstrap.sql`).

| Etapa | Dónde | Resultado |
|---|---|---|
| Rojo previo (suite 011 sin migración 012) | `bash /tmp/verify-005/run.sh`, salida en `/tmp/verify-005/011-red.tap` (2026-09-22) | **20 ok / 11 not ok** — fallan exactamente los asserts 14–24 (los que exigen la migración 012: vocabularios, forma cerrada, campos obligatorios, eventos adversos estructurados, consulta abierta, consulta inexistente, uuid malformado, clínica ajena e inmutabilidad ante UPDATE), por la razón prevista |
| Verde (suite 011 con migración 012) | ídem, salida en `/tmp/verify-005/011-green.tap` (2026-09-22) | **31 ok / 0 not ok** |
| Compatibilidad (suites 001–008 + fixtures con 012 aplicada) | ídem, TAP por suite en `/tmp/verify-005/` (2026-09-22) | todas verdes: 001 12/12, 002 17/17, 003 14/14, 004 30/30, 005 18/18, 006 5/5, 007 10/10, 008 26/26, fixtures 3/3 |
| Verde oficial en CI (job `database`) | se registra en 5.1 con la URL de la ejecución | pendiente de registro |

## Mapping `clinical_record_action` sin cambios (tarea 1.3)

Verificado sobre `003_attribution_hardening.sql` y por los asserts 3, 26 y 27 de la suite 011:
el mapping existente cubre esta capacidad sin modificaciones.

1. `INSERT` de `clinical_feedback` → `clinical_feedback_recorded` (ya enumerado en 003).
2. `status = 'corrective'` (cualquier `record_type`) → `corrective_record_created`; la
   corrección de retroalimentación usa ese camino y su evento lleva `supersedes_event_id`
   apuntando al evento de registro del original (D7).
3. `UPDATE` de `clinical_feedback` → en el mapping figura `clinical_feedback_recorded`, pero esa
   rama queda **sin uso práctico**: D4 prohíbe todo `UPDATE` sobre estas filas
   (`CLINICAL_FEEDBACK_IMMUTABLE`) y el trigger propio responde antes que el sello genérico de 009.

## Pendientes de esta funcionalidad (declarados; se consolidan en 5.2)

- Verificación visual de las pantallas nuevas (`/follow-up`, componentes de
  `src/components/retroalimentacion/`).
- Compuerta axe WCAG 2.2 AA + teclado/foco/viewport sobre `/follow-up` (requisito de integración
  sobre `tests/e2e/web/accessibility.spec.ts`; esta rama no toca Playwright).
- Integración de FR-042 en `buildFollowUpSummary` (`src/features/registro/summaries.ts`) y el
  resumen previo de `/consultations/[id]` (requisito de integración D9; SC-036 queda parcial hasta
  entonces).
- Aceptación humana de SC-036 y de SC-037 en su componente de tiempo (< 2 min).
- Ratificación por el equipo clínico de los vocabularios categóricos de D2 (Open Questions).
