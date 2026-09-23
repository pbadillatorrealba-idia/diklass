# Tasks: Captura de voz hacia anamnesis

Convención: Rojo-Verde-Refactor obligatorio (Constitución II) — cada tarea de prueba se observa
fallando por la razón prevista antes de la implementación que cubre. El SQL se verifica
localmente en un clúster PostgreSQL 18 scratch con shims en `/tmp/verify-004/` (patrón del
[quickstart de 002](../../implementar-registro-clinico-longitudinal/quickstart.md)) y en el job
`database` de CI; la integración viva corre solo en CI (`SUPABASE_LIVE_TESTS=1`) y su corrida queda
condicionada al requisito de integración R1 del diseño (tipos generados compartidos) — limitación
declarada, no reducción de alcance. El `quickstart.md` de este cambio existe desde la fase de
implementación y se llena de forma incremental (consolidación final en 5.3). Cada tarea indica su
criterio observable de terminación y su trazabilidad a FR/US/SC del spec del cambio.

## 1. Base integrada y base de datos (pruebas primero)

- [x] 1.1 Integrar la base clínica: `git merge feat/002-registro-clinico-longitudinal` y dejar el
  punto de partida sano (`bun run typecheck` y `bun test tests/unit` en verde sobre la mezcla). No
  es tarea TDD: es el prerrequisito ordenado por el orquestador. Verificación: merge sin conflictos
  de código y compuertas base verdes, registradas en `quickstart.md`.
- [x] 1.2 Escribir `supabase/tests/010_captura_voz.sql` en rojo (pgTap, patrón de
  `008_registro_clinico.sql`) y observarlo fallando en `/tmp/verify-004/`: INSERT de `audio_fact`
  como borrador sin evento de auditoría (D6 · FR-017 · SC-005), edición y descarte de borrador sin
  evento (D6), `pending → confirmed` emite exactamente un `audio_fact_confirmed` cuyo actor es el
  confirmante —distinto del que abrió la consulta— (FR-068 · SC-048 · US6-AC15), la transición a
  `confirmed` aterriza en la misma transacción la entrada de anamnesis y exige contenido válido
  (`AUDIO_FACT_INVALID_CONTENT`, D5 · D6 · FR-017), imposible fabricar
  un `audio_fact` ya confirmado por INSERT (D6), hechos confirmados inmutables (SC-027 · FR-017),
  confirmación rechazada con consulta cerrada (`CLINICAL_RECORD_SEALED` de 002, US6-AC4 · FR-010) y
  sin sesión de acceso (`AUTHENTICATION_REQUIRED`, FR-068), el aterrizaje crea la entrada de
  anamnesis con `provenance = 'inferida'` sin alterarla al confirmar (FR-021 · US6-AC9) y con
  `anamnesisEntryId` derivado por el servidor y enlazado en la traza (SC-027 · US6-AC6), CHECKs de
  `state`/`quality`/`processing_state` (D8 · D10 · FR-031 · US6-AC12), atribución server-stamped de `listening_sessions.started_by`
  imposible de suplantar por el cliente (FR-068 · D8 · FR-063), RLS de `listening_sessions` y
  `transcript_segments` (sesión activa y clínica compartida) y `processing_state` explícito de los
  tramos al interrumpir (FR-055 · US6-AC12 · D10). Verificación: suite 010 con asserts en `not ok`
  por las razones previstas en el clúster scratch.
- [x] 1.3 Escribir `supabase/migrations/011_captura_voz.sql`: refinamiento de
  `clinical_record_action` solo para `audio_fact` conservando firma, `language sql immutable`,
  `set search_path = public, extensions` y privilegios (D6, fijados por `004_function_privileges.sql`),
  trigger `guard_audio_fact_lifecycle` (D6 completo, incluido el aterrizaje atómico de la anamnesis
  de D5), tablas `listening_sessions` y
  `transcript_segments` con columnas de atribución server-stamped, privilegios de columna revocados,
  RLS de clínica compartida con sesión activa y CHECK de `state`/`quality`/`processing_state` (D8,
  D10) — sin ninguna función ejecutable nueva, conservando intacta la enumeración taxativa de
  `004_function_privileges.sql`. Verificación: suite 010 verde en
  `/tmp/verify-004/` y suites 001–008 sin regresión en el mismo clúster; job `database` de CI verde
  en pgTap (suites 001–010) — la compuerta de tipos queda documentada como R1 pendiente.

## 2. Modelos, puertos y extracción (pruebas de unidad primero)

- [x] 2.1 Escribir en rojo `tests/unit/voz/schema.test.ts` y luego `src/features/voz/schema.ts`:
  esquemas Zod de `AudioFactContent` (D1 completo: `provenance` fijado a `inferida`
  FR-021 · US6-AC9, estados `pending | confirmed | discarded`, traza `transcriptSegmentId` +
  `transcriptExcerpt` + `segmentSeq` SC-027, `anamnesisEntryId` opcional, `contradiction` opcional
  FR-032), `TranscriptSegment` con `quality: 'ok' | 'insufficient'` (FR-031 · D10) y
  `ListeningSession` con `state: 'active' | 'stopped' | 'interrupted'` (D8). Verificación:
  `bun test tests/unit/voz` en rojo por módulos inexistentes; luego verde.
- [x] 2.2 Escribir en rojo `tests/unit/voz/transcription-port.test.ts` y luego
  `src/features/voz/transcription-port.ts` (`TranscriptionPort`, `AudioWindow`, `TranscriptResult`)
  con `SimulatedTranscriptionAdapter` determinista sobre
  `tests/fixtures/voz/conversacion-referencia.json` (D2: mismo tramo → mismo texto; tramos marcados
  `insufficient` reproducibles), y `src/features/voz/capture-source.ts` con `CaptureSource` +
  `SyntheticCaptureSource` de ventanas de 30 000 ms con reloj inyectado y escenario `unavailable`
  (D3 · FR-014 · FR-054 · US6-AC10). El fixture de referencia incluye ground truth etiquetado
  (≥ 10 antecedentes, un tramo no confiable, una autocorrección del tutor y una mención a otro
  animal) para SC-004/SC-016. Verificación: ídem 2.1.
- [x] 2.3 Escribir en rojo `tests/unit/voz/extraction.test.ts` y luego
  `src/features/voz/extraction.ts`: `extractClinicalFacts(segmentText)` determinista por reglas en
  español (D4 · FR-016 · US6-AC2), sin salida para tramos no confiables (FR-031 · US6-AC7), con
  medición sobre el guion de referencia: recall ≥ 70 % (SC-004) y propuestas incorrectas ≤ 30 %
  (SC-016), más aserción de tiempo ≤ 300 ms de CPU por tramo (presupuesto de `design.md`).
  Verificación: ídem 2.1.
- [x] 2.4 Escribir en rojo `tests/unit/voz/contradictions.test.ts` y luego
  `src/features/voz/contradictions.ts`: `detectContradictions` frente a borradores de la sesión
  (autocorrección del tutor), anamnesis registrada y antecedentes de la ficha (D4 · FR-032 ·
  US6-AC8 · edge de contradicción intraconversación), señalando sin resolver ni sobrescribir nunca.
  Verificación: ídem 2.1.

## 3. Servicios de dominio y controlador (unidad local + integración viva en CI)

- [x] 3.1 Escribir en rojo `tests/unit/voz/listen-session-service.test.ts` y
  `tests/unit/voz/transcript-service.test.ts` y luego `src/features/voz/listen-session-service.ts`
  y `src/features/voz/transcript-service.ts` sobre el seam `src/features/voz/db-types.ts` (R1):
  activación atribuida server-side y denegada sin consulta abierta (FR-014 · US6-AC14, FR-068 · D8),
  detención con estado `stopped` e indicación asociada (FR-025 · US6-AC5), persistencia de tramos
  con `quality` (FR-031 · D10) y transiciones explícitas de `processing_state` al interrumpir a
  mitad de tramo (FR-055 · US6-AC12). Verificación: `bun test tests/unit/voz` rojo→verde.
- [x] 3.2 Escribir en rojo `tests/unit/voz/audio-fact-service.test.ts` y luego
  `src/features/voz/audio-fact-service.ts`: alta de borradores desde la extracción (FR-016 ·
  FR-017 · SC-005), edición y descarte por antecedente (US6-AC3), `confirmAudioFact` como
  confirmación vía `updateClinicalContent` que aterriza la anamnesis en la misma transacción
  (D5 · FR-068 · SC-048 · US6-AC15) con la atribución real de la
  respuesta, procedencia `inferida` que no cambia al confirmar (FR-021 · US6-AC9) y listado con
  fragmento de origen para la revisión (SC-027 · US6-AC6). Toda mutación cruza
  `src/lib/attribution` (D8 · FR-063). Verificación: ídem 3.1.
- [x] 3.3 Escribir en rojo `tests/unit/voz/listen-mode-controller.test.ts` y luego
  `src/features/voz/listen-mode-controller.ts`: ciclo de ventanas de ~30 s con reloj inyectado
  (D3 · FR-014 · FR-015 · US6-AC2), procesamiento por tramo con SC-028 verificado por orden de
  eventos (tramo N en el borrador antes del cierre del tramo N+1) y presupuesto ≤ 2 s por ventana
  (presupuestos de `design.md`), estado `no_disponible` con manual expedito (FR-054 · US6-AC10),
  interrupción con estado definido y tramos nunca a medio procesar (FR-055 · US6-AC11 · US6-AC12) y
  borradores conservados desde los primeros tramos en sesiones largas (US6-AC11). Verificación:
  ídem 3.1.

## 4. Interfaz accesible del modo de escucha (WCAG 2.2 AA)

- [x] 4.1 Implementar `src/components/voz/`: `ListenModeButton` e indicador de captura con
  `role="status"`/`aria-live`, estados visible de captura, detención y indisponibilidad (FR-025 ·
  FR-054 · US6-AC1 · US6-AC5 · US6-AC10), operables por teclado con foco visible y `testID`
  estables; sin consulta abierta el botón no inicia captura (FR-014 · US6-AC14). Verificación:
  `bun run typecheck` y `bunx biome check` sobre los archivos propios en verde; revisión estática
  WCAG 2.2 AA (etiquetas programáticas, teclado, foco, contraste, avisos no solo por color).
- [x] 4.2 Implementar el panel de revisión de `ListenModeSection`: transcripción visible durante la
  consulta (FR-015 · US6-AC13), tarjeta por borrador con fragmento de origen (FR-021 · US6-AC6),
  procedencia `inferida` visible antes y después de confirmar (US6-AC9), insignia de contradicción
  sin sobrescritura (FR-032 · US6-AC8), marca de tramo no confiable sin derivar hechos
  (FR-031 · US6-AC7) y acciones Confirmar / Corregir / Descartar por antecedente (FR-017 ·
  US6-AC3). Verificación: ídem 4.1 más `bun test tests/unit/voz` en verde.
- [x] 4.3 Documentar el montaje mínimo como requisito de integración R2 (una importación y
  `<ListenModeSection consultationId={…} />` en `src/app/(protected)/consultations/[id].tsx`, no
  tocado por estar compartido) y dejar expedito el registro manual de anamnesis de 002 con la
  escucha caída (FR-054 · US6-AC10). Verificación: snippet exacto en `quickstart.md` y
  `bun run typecheck` en verde.

## 5. Compuertas y evidencia

- [x] 5.1 Escribir en rojo `tests/integration/voz/captura-voz.test.ts` (patrón
  `tests/integration/live-supabase.ts`, ANA abre consulta y activa escucha; BRUNO confirma) y
  verificar en CI: borradores por tramo conservados en consulta larga (FR-055 · US6-AC11),
  confirmación de BRUNO atribuida y aterrizada en anamnesis con `inferida` (FR-068 · US6-AC15 ·
  SC-048 · SC-027 · US6-AC6 · US6-AC9), nada confirmado entra sin confirmación y lo no confirmado
  queda fuera al cerrar (FR-017 · FR-010 · US6-AC4 · SC-005), contradicción señalada frente a la
  ficha (FR-032 · US6-AC8) y presupuestos de `confirmAudioFact` y listado ≤ 2 s. Su rojo→verde se
  observa en la ejecución de CI del job `database` una vez aplicado R1; mientras, queda como
  pendiente declarado con su razón (archivo compartido) en `quickstart.md`.
- [x] 5.2 Ejecutar las compuertas locales disponibles y dejar la rama revisable: `bun run
  typecheck`, `bunx biome check --write` sobre `src/features/voz/**`, `src/components/voz/**`,
  `tests/unit/voz/**`, `tests/integration/voz/**`, `supabase/migrations/011_captura_voz.sql`,
  `supabase/tests/010_captura_voz.sql`, y `bun test tests/unit/voz tests/integration/voz` (vivas
  omitidas sin `SUPABASE_LIVE_TESTS=1`). Verificación: lista de comandos y resultados reales en
  `quickstart.md`.
- [x] 5.3 Consolidar `quickstart.md` del cambio con la evidencia real acumulada desde 1.2
  (comandos, salidas del clúster `/tmp/verify-004/` con el rojo previo de 1.2, URLs de las
  ejecuciones de CI, alcance de lo verificado) y los pendientes explícitos: R1 (regenerar
  `database.types.ts` y eliminar el seam `db-types.ts`), R2 (montaje en `[id].tsx`), R3 (nota del
  quickstart de 002), rojo→verde de integración viva tras R1, verificación visual/e2e sin
  Playwright y extensiones de micrófono/ASR real no implementadas. Verificación: documento
  completo y sin afirmar como aceptado nada que no lo esté.

## 6. Coherencia de artefactos y reporte

- [x] 6.1 Si la implementación desvía `design.md` o estas tareas, actualizar los artefactos antes
  de entregar (mismo ciclo de revisión de artefactos). Verificación: artefactos coherentes entre sí
  y con el código.
- [x] 6.2 Preparar el reporte final en español para el orquestador: mapa tarea ↔ FR/US/SC, mapa de
  decisiones duras (ASR simulado por defecto, procedencia `inferida`, confirmación atómica por
  trigger de dominio, refinamiento del mapping) y lista de requisitos de integración R1–R3. Verificación: reporte
  entregado; sin PRs ni merges (restricción de esta rama).
