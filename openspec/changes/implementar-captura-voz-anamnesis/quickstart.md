# Guía de validación rápida: Captura de voz hacia anamnesis

**Creado**: 2026-09-22 · **Cambio**: `implementar-captura-voz-anamnesis` ·
**Diseño**: [design.md](design.md) · **Tareas**: [tasks.md](tasks.md)

## Prerrequisitos

- Bun 1.4.0 (`.bun-version`) y dependencias con `bun install --frozen-lockfile`.
- Para las suites vivas: stack Supabase local (`DOCKER_HOST=unix:///run/user/1000/podman/podman.sock
  supabase start`, `supabase db reset`, `bun run provision:veterinarians -- --fixture
  tests/fixtures/veterinarians.json`, `SUPABASE_LIVE_TESTS=1`). El stack es compartido con los
  worktrees hermanos: se reserva por hub («reservo stack» / «stack libre») y **no** se ejecuta
  `supabase stop`.
- Para el SQL: clúster PostgreSQL 18 scratch con shims en `/tmp/verify-004/` (patrón del
  [quickstart de 002](../../implementar-registro-clinico-longitudinal/quickstart.md)); no usa
  `supabase start` (evita colisiones de puertos con los worktrees hermanos).

## Compuertas locales

```sh
bun run typecheck                      # tsc --noEmit
bunx biome check --write src/features/voz src/components/voz tests/unit/voz tests/integration/voz tests/fixtures/voz
bun test tests/unit/voz                # unidad (determinista)
bun test tests/integration/voz         # integración viva: en skip sin SUPABASE_LIVE_TESTS=1
```

## Verificación SQL local (clúster scratch)

```sh
/tmp/verify-004/run.sh red     # rojo de la suite 010 contra migraciones 001–009
/tmp/verify-004/run.sh         # rojo → aplica 011 → verde → compatibilidad 001–008 + fixtures
```

`run.sh` levanta un clúster PostgreSQL 18 desechable (datos `/tmp/pgdata-004`, socket
`/tmp/pgsock-004`, puerto 56404) desde los `.deb` ya descargados, aplica los shims de
`bootstrap.sql` (roles `anon`/`authenticated`/`service_role`, esquemas `auth`/`extensions`,
`auth.uid()`/`auth.jwt()` sobre `request.jwt.claims`) y pgTap 1.3.4 en el esquema `tap` antes de
las migraciones (005 revoca EXECUTE en `public` y 004 audita su contenido).

## Evidencia de verificación (real)

**Suite pgTap 010 — ciclo rojo→verde local (Constitución II).**

| Etapa | Dónde | Resultado |
|---|---|---|
| Rojo previo (suite 010 sin migración 011) | `/tmp/verify-004/010-red.tap`, clúster scratch | **3 ok / 19 not ok + abort final** (`undefined_table` en el assert de stamping, la razón prevista: faltan `listening_sessions`/`transcript_segments`). Los `not ok` son exactamente el mapping actual emitiendo `audio_fact_confirmed` de más (asserts 1–3), las validaciones de ciclo de vida ausentes (4–6, 10–11), el aterrizaje inexistente (12–14, 16) y los objetos nuevos (17–22) |
| Verde (suite 010 contra 001–009 + 011) | `/tmp/verify-004/010-green.tap` | **28/28 verdes** |
| Compatibilidad de las suites compartidas con 011 aplicada | `/tmp/verify-004/*.tap` | **todas verdes**: 001 (12/12), 002 (17/17), 003 (14/14), **004 (30/30 — la enumeración taxativa de nueve funciones ejecutables se conserva intacta)**, 005 (18/18), 006 (5/5), 007 (10/10), 008 (28/28, con el fix `2fd95ac` de 002 ya integrado) y `fixtures/attribution.sql` (3/3) |

**Modelos, puertos, extracción, servicios y controlador (tareas 2.x–3.x)**: `bun test
tests/unit/voz` — rojo previo por módulos inexistentes (`Cannot find module '@/features/voz/*'`,
la razón prevista) y luego **44 pass / 0 fail** (110 `expect()`), verificado localmente. Cubre:
SC-004 (recall ≥ 70 %) y SC-016 (≤ 30 % de propuestas incorrectas) medidos sobre
`tests/fixtures/voz/conversacion-referencia.json`; FR-031 (tramo no confiable sin hechos);
presupuestos ≤ 300 ms de CPU por tramo y ≤ 2 s por ventana; SC-028 (tramo N procesado antes de
abrir el tramo N+1) por orden de eventos; FR-055 · US6-AC12 (interrupción resuelta con decisión
explícita); FR-054 (estado `no_disponible`); FR-032 (señal de contradicción sin sobrescribir);
D5 (confirmación con `anamnesisEntryId` derivado por el servidor y error explícito si falta).

**Suites completas e integración viva sobre el stack local (tarea 5.1)**: ventana de stack
reservada por hub («reservo stack» / «stack libre», protocolo de los worktrees hermanos) con
`DOCKER_HOST=unix:///run/user/1000/podman/podman.sock`, `supabase db reset` con las migraciones
001–009 (fix `2fd95ac` incluido) + 011, `NOTIFY pgrst 'reload schema'` y
`bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json`. Resultado real:

| Verificación | Resultado |
|---|---|
| `supabase test db` (suites pgTap 001–010 completas sobre el stack) | **All tests successful — Files=10, Tests=165** (`/tmp/verify-004/testdb-final4.log`) |
| `SUPABASE_LIVE_TESTS=1 bun test tests/integration/voz` (ANA abre consulta y escucha; BRUNO confirma) | **6 pass / 0 fail** (70 `expect()`): activación atribuida y rechazo sin consulta abierta (FR-014 · FR-068), borradores de los primeros tramos conservados con fragmento (FR-055 · US6-AC11 · SC-027), tramo no confiable sin hechos e interrupción con estado definido (FR-031 · US6-AC12), contradicción con la ficha señalada sin sobrescribir (FR-032 · US6-AC8), confirmación por BRUNO con aterrizaje en la anamnesis `inferida` y presupuestos ≤ 2 s (FR-068 · US6-AC15 · SC-048 · SC-027 · FR-021 · US6-AC9) y nada no confirmado en la anamnesis (FR-017 · SC-005) |
| Ciclo rojo→verde de la integración viva | el rojo previo corresponde a los módulos inexistentes observado en la unidad (documentado arriba); la corrida viva del stack fue 6/6 en verde sobre la implementación completa. El rojo→verde en CI queda pendiente hasta R1 (abajo) |

**Interfaz (tarea 4.x)**: `bun run typecheck` en verde; `bunx biome check` sin diagnósticos sobre
los archivos propios; revisión estática WCAG 2.2 AA (etiquetas programáticas, operación por
teclado, foco visible, avisos `role="status"`/`aria-live` nunca solo por color, `testID`
estables). La verificación visual/e2e queda pendiente y declarada abajo.

## Montaje mínimo en el workspace de consulta (requisito R2)

En `src/app/(protected)/consultations/[id].tsx` (archivo compartido, no tocado):

```tsx
import { ListenModeSection } from "@/components/voz/listen-mode-section";
// …
<ListenModeSection consultationId={id} />
```

Sin ese montaje el botón «Modo de escucha» no aparece en la app; el componente aislado y sus
garantías existen y están verificadas. Con la captura caída (FR-054) el indicador lo dice y el
registro manual de anamnesis de 002 sigue expedito: nada de esta spec lo bloquea.

## Transiciones de `audio_fact` sin acción enumerada (D6)

Con el refinamiento de `clinical_record_action` (migración 011, `create or replace` que conserva
firma, `search_path` y privilegios) las transiciones que devuelven `null` son:

1. `INSERT` de `audio_fact`: una extracción nace borrador; su alta no es acción clínica enumerada.
2. `UPDATE` de un `audio_fact` no confirmado (edición o descarte del borrador).
3. `UPDATE` de `consultation` (cierre, consecuencia de la aprobación — sin cambios) y `INSERT` de
   `epicrisis` (borrador — sin cambios).

La única transición enumerada de `audio_fact` es el paso a `confirmationState = 'confirmed'` →
`audio_fact_confirmed`, que ocurre exactamente una vez (los estados terminales quedan sellados por
`guard_audio_fact_lifecycle`).

## Correcciones de revisión (PR #29, veredicto «Con correcciones»)

| Hallazgo | Fij | Evidencia |
|---|---|---|
| 1 [Importante] FR-025 · US6-AC5: el botón quedaba deshabilitado durante toda la captura y `stop()` era inalcanzable | `toggleListenMode` (módulo propio sin React Native) con prioridad de DETENER cuando hay captura y `pending` solo durante la activación; `start()` resuelve en cuanto la sesión existe y la captura corre en segundo plano | `tests/unit/voz/toggle-listen-mode.test.ts` (3 tests: detener sin bloqueo, ocupación transitoria, estados que activan) |
| 2 [Importante] FR-032 · US6-AC8: las propuestas de un tramo no se veían entre sí (autocorrección intra-tramo sin insignia) | `flagContradictions`: el lote se acumula en un contexto LOCAL (función pura) y cada propuesta detecta contra las anteriores del mismo tramo | `tests/unit/voz/contradictions.test.ts` — caso del guion («de noche» vs «en realidad es de día…») + pureza del contexto |
| 3 [Menor] sesión sin cerrar al fin natural y estados `interrupted`/`processed` inalcanzables | el fin del ciclo cierra la sesión con `stopped`, o `interrupted` si hubo tramo interrumpido (`wasInterrupted`); `stop(decision)` lleva la decisión explícita del tramo en curso | `tests/unit/voz/listen-mode-controller.test.ts` (interrupción `processed`, `wasInterrupted` true/false) |
| 4 [Menor] traza inconsistente en la integración (`segmentSeq: 1` sobre el tramo 0) | cada lote de borradores se ata al tramo REAL guardado (`guardado1`) y el assert verifica `transcriptSegmentId` por `segmentSeq` | `tests/integration/voz/captura-voz.test.ts` — re-corrida viva **6 pass / 0 fail** |
| 5 [Nitpick] rechazos de UI con `void` sin manejar | `setSubmitError` (patrón del `login-form`) en las cuatro acciones con el motivo visible (`testID="listen-mode-error"`) | `bun run typecheck` verde; flujo cubierto por las pruebas de los servicios que ahora se capturan |
| 6 [Nitpick] tarea 4.3 sin marcar | marcada `[x]` en `tasks.md` (snippet de montaje y manual expedito documentados) | `tasks.md` |
| Nota del revisor (etiquetas de tarjeta sin estado ni procedencia) | `accessibilityLabel` de `draft-fact-card` ahora nombra estado y procedencia | revisión estática de `draft-facts-panel.tsx` |

## Revisión de la PR #29 (`/code-review high`, 2026-09-24)

Diez hallazgos en línea sobre `a5e2812`, todos verificados contra el código y corregidos (tareas
7.1–7.11). La rama se puso al día con `main` (`e23bba0`, PR #30 con la migración 010); el conflicto
de `database.types.ts` se resolvió regenerando tras `supabase db reset` (sin diff posterior).

| Hallazgo | Corrección | Prueba (rojo → verde) |
|---|---|---|
| 1 `run()` rechazado dejaba la sesión `active` y el tramo `pending` | controlador a `detenido`; `ejecutarEscucha` cierra `interrupted`; `procesarTramo` descarta el tramo | controlador 1 caso, pipeline 2 casos |
| 2 `stop('processed')` no procesaba | `resolverTramoInterrumpido` delega en `procesarTramo` | pipeline 1 caso |
| 3 confirmar no invalidaba el registro | `confirmarHecho` + `invalidateRegistro` | pipeline 1 caso (`QueryClient` real) |
| 4 lost update al editar/descartar/confirmar | `expectedUpdatedAt` + `ClinicalWriteConflictError` | 4 casos unitarios |
| 5 `anamnesisEntryId` en INSERT y vocabulario en UPDATE | trigger de la 011 | pgTap 4 casos |
| 6 polaridad falsa y descartados en previos | `esNegativo` compartido, previos pendientes | 2 unitarias + cargador |
| 7 `no,` muerto y `sin parar` negado | marcas y `NEGACION` corregidas | 2 unitarias |
| 8 sesiones y tramos sin validar en el servidor | triggers `guard_listening_session` / `guard_transcript_segment` con `FOR SHARE`, grant de UPDATE solo `processing_state` | pgTap 13 casos, 2 vivos, carrera `psql` |
| 9 `listAudioFacts` sin lectura tolerante | `parseRows` | 1 unitaria |
| 10 lecturas secuenciales y 2N escrituras | `Promise.all`, caché por sesión, `createClinicalRecords` | 2 unitarias |

**Rojos observados antes de cada arreglo**:

- pgTap `011_captura_voz_revision.sql` con la 011 anterior: **12/17 fallan** (1–3, 5–7, 9, 11, 13,
  15–17; la 2 muere en `AUDIO_FACT_ANAMNESIS_FORGED`, la razón del hallazgo 5).
- Unitarias: contradicciones 3 fallos, `audio-fact-service` 6, controlador 1, pipeline 6/9 (con el
  código del hook extraído tal cual antes de corregirlo).
- Integración viva con la 011 anterior: **2/8 fallan** (sesión sin consulta aceptada; tramo
  procesado re-resuelto).
- Carrera (dos sesiones `psql`: A cierra la consulta y espera 3 s sin confirmar; B activa la
  escucha sobre ella): con el guarda sin `FOR SHARE`, B crea la sesión (**1** sesión sobre la
  consulta cerrada); con `FOR SHARE`, B espera a A y falla con `CONSULTATION_NOT_OPEN` (**0**).

**Compuertas locales tras la revisión** (stack compartido, `supabase db reset` desde este worktree):

| Compuerta | Resultado |
|---|---|
| `bunx biome ci --error-on-warnings .` | sin diagnósticos |
| `bun run typecheck` | verde |
| `supabase test db` | **All tests successful — Files=13, Tests=238** |
| `bun run db:types` | sin diff |
| `SUPABASE_LIVE_TESTS= bun run test` | **338 pass / 66 skip / 0 fail** |
| `bun run test:integration` (vivas) | **61 pass / 0 fail** |
| `SUPABASE_LIVE_TESTS=1 bun run test` | **395 pass / 0 fail** |
| `bunx playwright test --project=chromium` | **20 pass / 1 fail**: `auth.spec.ts` «unsaved notes survive an expired session…», fallo conocido solo en local (en CI pasa) |

## Requisitos de integración (archivos compartidos, fuera de esta rama)

| ID | Requisito | Comando / acción |
|---|---|---|
| R1 | **APLICADA** (autorización RI-1 del orquestador, fix post-cierre) — tipos regenerados y seam eliminado | `bun run db:types` (`supabase gen types --lang=typescript --local`, añade `listening_sessions` y `transcript_segments`, 472 → 571 líneas) + eliminación de `src/features/voz/db-types.ts` (`asVozClient`) con los servicios usando el cliente tipado directo. Cerraba el único fallo del CI run [#35803072019](https://github.com/pbadillatorrealba-idia/diklass/actions/runs/35803072019) (diff de tipos); batería mínima: typecheck limpio, biome sin diagnósticos, unidades 51/51 |
| R2 | Montar `<ListenModeSection consultationId={…} />` en `src/app/(protected)/consultations/[id].tsx` | ver snippet de arriba |
| R3 | Actualizar la nota de transiciones del quickstart de 002 | su «INSERT cubre los 12 `record_type` salvo `epicrisis`» ya no incluye `audio_fact` (D6) |

Solo se han tocado, de los archivos compartidos, `src/lib/supabase/database.types.ts`
(regeneración autorizada como RI-1) y, en la revisión de la PR #29, `src/lib/attribution/clinical-mutations.ts`
(nueva función `createClinicalRecords`, sin cambios en las existentes). El resto sigue intocado:
`src/features/registro/*`, `src/lib/storage/*`, el resto de `src/lib/supabase/*`,
`supabase/tests/001-008*`, `supabase/migrations/001-009*` y `seed.sql`.

## Pendientes explícitos (declarados, no cumplidos)

- **Compuerta de tipos de CI**: resuelta con R1 aplicada (regen de `database.types.ts` + seam
  eliminado, autorización RI-1). La integración viva local corrió en verde (arriba).
- **Verificación visual/e2e de la UI**: la sección no está montada (R2), así que no hay e2e del
  modo de escucha; los arreglos de la revisión de la PR #29 se prueban con unitarias de
  `listen-mode-pipeline.ts` (tarea 7.13).
- **Carrera de cierre automatizada**: verificada a mano con dos sesiones `psql` (arriba), sin
  prueba automatizada (tarea 7.12).
- **Micrófono real y ASR real**: extensiones documentadas del diseño (D2 · D3), sin implementar y
  sin dependencias nuevas. FR-054 se ejercita por la señal de indisponibilidad de `CaptureSource`;
  el flujo real de permisos de micrófono no está verificado.
- **Aceptación humana de SC-004/SC-016 sobre conversaciones reales**: aquí se miden sobre la
  conversación simulada de referencia (SC-004 y SC-016 medidos por test, no aceptados).
