# Guía de validación rápida: Retroalimentación clínica

**Creado**: 2026-09-22 · **Cambio**: `implementar-retroalimentacion-clinica` ·
**Diseño**: [design.md](design.md) · **Tareas**: [tasks.md](tasks.md)

Documento consolidado al cierre de la implementación (tarea 5.2): registra la evidencia real
acumulada desde la tarea 1.1 y los pendientes explícitos. Diferencia pendiente / implementado /
aceptado en cada afirmación.

## Prerrequisitos

- Bun 1.4.0 (`.bun-version`) y dependencias con `bun install --frozen-lockfile`.
- Verificación SQL local: clúster PostgreSQL 18 scratch + pgTap 1.3.4 con shims en
  `/tmp/verify-005/` (`run.sh`, `bootstrap.sql` — patrón del quickstart de 002; rutas y
  puerto 55433 propios). **Nunca `supabase stop`**.
- Integración viva con el stack compartido: protocolo de reserva por hub («reservo stack» /
  «stack libre») acordado entre ramas hermanas; `export DOCKER_HOST=unix:///run/user/1000/podman/podman.sock`,
  `supabase start`, `supabase db reset`, `bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json`
  y `SUPABASE_LIVE_TESTS=1`.

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
   entrada sobre consulta cerrada con tratamiento aplicado y su modificación distinguibles,
   fechas de registro y consulta separadas, tratamiento vacío aceptado.
2. **Categorías sin forzar binarias** (FR-040, FR-043 · SC-023 · US10-AC8/AC9): adherencia y
   evolución con `parcial`/`desconocida`; agregados por categoría sin texto libre.
3. **Eventos adversos diferenciados** (FR-041 · SC-035 · US10-AC2): recuperables aparte de la
   evolución, con `grave` destacado.
4. **Aditivo e inmutable** (FR-024 · SC-022 · US10-AC3/AC4/AC5): epicrisis y diagnóstico
   intactos tras registrar; corrección como registro nuevo con el original y correctivas
   previas recuperables.
5. **Atribución** (FR-063, FR-070 · SC-049 · US10-AC13): entrada y corrección atribuidas a la
   identidad autenticada de quien las registró, aunque sea distinta del veterinario que atendió.
6. **Antecedentes de seguimiento** (FR-042 · US10-AC6): evolución previa presentada en el panel
   de seguimiento; integración en el resumen de la consulta posterior = requisito de
   integración (D9).

## Evidencia de verificación (real, 2026-09-22)

**Suite pgTap 011 — ciclo rojo→verde (Constitución II).** Clúster scratch `/tmp/verify-005/`
(PostgreSQL 18.6 desde los .deb de `/tmp/pgdl`, pgTap 1.3.4, shims de `bootstrap.sql`).

| Etapa | Dónde | Resultado |
|---|---|---|
| Rojo previo (suite 011 sin migración 012) | `bash /tmp/verify-005/run.sh`, salida `/tmp/verify-005/011-red.tap` | **20 ok / 11 not ok** — fallan exactamente los asserts 14–24 (vocabularios, forma cerrada, campos obligatorios, eventos adversos estructurados, consulta abierta, consulta inexistente, uuid malformado, clínica ajena e inmutabilidad ante UPDATE), por la razón prevista. **Nota histórica** (integración, 2026-09-22): observado con la migración 009 pre-`2fd95ac`; con el sellado acotado a registros de trabajo tras ese fix, el rojo equivalente hoy extiende la cascada a los asserts 14–29 |
| Verde (suite 011 con migración 012) | ídem, `/tmp/verify-005/011-green.tap` | **31 ok / 0 not ok** |
| Compatibilidad (suites 001–008 + fixtures con 012 aplicada) | ídem, TAP por suite en `/tmp/verify-005/` | todas verdes: 001 12/12, 002 17/17, 003 14/14, 004 30/30, 005 18/18, 006 5/5, 007 10/10, 008 26/26, fixtures 3/3 |
| Re-verificación tras el fix `2fd95ac` de 002 (sellado acotado a registros de trabajo; merge `1637afa`) | ídem, 2026-09-22 | suite 011 **31 ok / 0 not ok** con el 009 corregido + 012, y compatibilidad completa: 001 12/12, 002 17/17, 003 14/14, 004 30/30, 005 18/18, 006 5/5, 007 10/10, 008 28/28 (versión nueva de 002), fixtures 3/3 |

**Modelos, vistas puras y servicios (tareas 2.1–3.2)**: `bun test tests/unit/retroalimentacion` —
ciclo rojo→verde por módulos inexistentes antes de cada implementación (razón prevista) y
resultado final **45 pass / 0 fail (129 `expect()`)**, verificado localmente.

**Integración viva (tareas 3.1–3.2)**: `tests/integration/retroalimentacion/feedback.test.ts`
contra el stack local compartido (podman) con `SUPABASE_LIVE_TESTS=1`, migración 012 aplicada y
veterinarios sintéticos provisionados — **8 pass / 0 fail (38 `expect()`)**. Cubre, contra
PostgREST real: registro atribuido al segundo veterinario, epicrisis/diagnóstico idénticos
(comparación), rechazo sobre consulta abierta, rechazo de vocabulario fuera de enumerado por el
trigger del servidor (`23514` `CLINICAL_FEEDBACK_INVALID_CONTENT`), inmutabilidad ante UPDATE
directo (`23514` `CLINICAL_FEEDBACK_IMMUTABLE`), corrección como registro nuevo con el original
intacto, agregados por categoría de varias consultas y eventos adversos diferenciados con
fechas distinguibles. Presupuestos verificados con aserciones: registro/corrección ≤ 2 s y
carga del panel ≤ 2 s (reales: 10–40 ms).

**Compuertas locales de cierre (tarea 5.1)**: `bun run typecheck` **limpio**; `bunx biome check`
sobre los archivos de este cambio **limpio (0 errores, 0 avisos)**; unidades e integración en
skip sin `SUPABASE_LIVE_TESTS`, verdes con ella.

**CI**: pendiente de registro. `ci.yml` solo se dispara en `pull_request` y en `push` a `main`;
esta rama aún no tiene PR (la crea el orquestador, por contrato de este cambio). El job
`database` (`supabase test db` con la suite 011 y diff de `supabase gen types`) y el resto de
compuertas se ejecutarán en esa PR; sus URLs se registran aquí al abrirse. El clúster scratch y
la integración viva local cubren la misma superficie de verificación SQL/RLS en el entorno.

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

## Deviaciones menores del diseño registradas (tarea 6.3)

- El formulario usa el patrón de formularios ya establecido en el repo (valores de control + Zod
  con mensajes en español, al estilo de `ficha-form.tsx`), no TanStack Form: reutilizar la
  convención existente prima sobre el mención del stack (Principio III). La lógica testeable
  vive en `feedback-form-values.ts`.
- `buildFeedbackAntecedents` recibe además las filas de consulta (`{ timeline, consultations, excludeConsultationId }`)
  para exponer las DOS fechas de FR-039/US10-AC7 (registro y consulta) ya distinguidas en el
  antecedente; el diseño la describía como `(timeline, excludeConsultationId?)`.
- La verificación viva se hizo sobre el stack Supabase compartido (podman) además del clúster
  scratch; el clúster scratch cumplió exactamente su rol de observación del ciclo rojo→verde.

## Pendientes declarados (no cumplidos; nada de esto se afirma como aceptado)

- Verificación visual de las pantallas nuevas (`/follow-up`, componentes de
  `src/components/retroalimentacion/`).
- Compuerta axe WCAG 2.2 AA + teclado/foco/viewport sobre `/follow-up` (requisito de integración
  sobre `tests/e2e/web/accessibility.spec.ts`; esta rama no toca Playwright por decisión acordada).
- Integración de FR-042 en `buildFollowUpSummary` (`src/features/registro/summaries.ts`) y el
  resumen previo de `/consultations/[id]` (requisito de integración D9; SC-036 queda parcialmente
  verificado — solo la superficie `/follow-up` — hasta entonces).
- Aceptación humana de SC-036 y de SC-037 en su componente de tiempo (< 2 min); su componente
  estructural (campos categóricos solo por selección) sí está verificado por diseño del formulario.
- Ratificación por el equipo clínico de los vocabularios categóricos de D2 (Open Questions).
- URLs del verde de CI en la PR que cree el orquestador (sección CI de arriba).

## Revisión de la PR #28 (2026-09-24)

Tras integrar `main` (migraciones 010 y 011 de las PR #30 y #29) y renombrar la suite pgTap a
`012_retroalimentacion_clinica.sql`. Detalle por hallazgo en la sección 7 de [tasks.md](tasks.md).

**Rojo observado antes de cada arreglo** (Supabase local compartido, podman):

| Hallazgo | Prueba | Rojo | Verde |
|---|---|---|---|
| 1 · 2 | `supabase/tests/012_retroalimentacion_clinica.sql`, asserts 31–37 | 7 de 38 fallan, «caught: no exception» | 38/38 |
| 3 | e2e «el reporte de eventos adversos muestra una vez…» | 3 ítems (esperado 1) | verde |
| 4 | e2e «solo la versión vigente de una cadena ofrece «Corregir entrada»» | 2 botones (esperado 1) | verde |
| 5 | e2e «dos pulsaciones rápidas…» (dos `click()` en la misma tarea) | 2 filas en la base (esperado 1) | verde |
| 6 | e2e «los antecedentes muestran el vocabulario en español» | «Sin evolución registrada antes de hoy.» | verde |
| 7 | e2e «una lectura rechazada por sesión expirada…» | sin diálogo «Sesión expirada» | verde |
| 8 · 9 | `tests/unit/retroalimentacion/feedback-service.test.ts` | export inexistente; lectura de la traza como lista | verde |
| 10 | refactor sin cambio de comportamiento | — | suites de cronología verdes |

Nota del hallazgo 5: con dos clics de Playwright separados React vuelve a renderizar entre
ambos y el botón ya está deshabilitado (no reproduce); el doble toque real llega en la misma
tarea, así que la prueba dispara los dos `click()` dentro de un único `evaluate`.

**Compuertas locales sobre el head de la revisión**:

| Compuerta | Resultado |
|---|---|
| `bunx biome ci --error-on-warnings .` | limpio (199 archivos) |
| `bun run typecheck` | limpio |
| `supabase db reset && supabase test db` | 14 archivos, 276 tests, PASS (suite 012: 38/38) |
| `bun run db:types` | sin diff |
| `SUPABASE_LIVE_TESTS= bun run test` | 385 pass / 75 skip / 0 fail |
| `bun run test:integration` (vivas) | 69 pass / 0 fail |
| `bunx playwright test --project=chromium` | 26 passed (incluidas las 5 nuevas de `retroalimentacion.spec.ts`) |

La URL de la ejecución de CI en verde se registra en el comentario de la PR #28.
