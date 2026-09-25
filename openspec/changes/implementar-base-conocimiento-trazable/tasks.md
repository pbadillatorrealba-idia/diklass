# Tasks: Base de conocimiento trazable

Convención: Rojo-Verde-Refactor obligatorio (Constitución II) — cada tarea de prueba se observa
fallando por la razón prevista antes de la implementación que cubre. Las suites pgTap y de
integración viva se ejecutan en el stack Supabase local (podman) bajo el protocolo de reserva por
hub —«reservo stack» / «stack libre»— y en el job `database` de CI: su «rojo» previo se registra
con su salida en `quickstart.md`, que se crea al comenzar la implementación y se va llenando de
forma incremental (consolidación final en 5.3). Las pruebas de unidad corren localmente con
`bun test`. Cada tarea indica su criterio observable de terminación y su trazabilidad.
Integraciones autorizadas por el orquestador en FASE 2 y documentadas en `quickstart.md`: **RI-1**,
la regeneración de `src/lib/supabase/database.types.ts` con `supabase gen types`; y **RI-3**, el
ajuste de la enumeración de funciones del test 23 de `supabase/tests/004_function_privileges.sql`.

## 1. Base de datos: garantías de la spec (pruebas primero)

- [x] 1.1 Escribir `supabase/tests/009_base_conocimiento.sql` (pgTap, patrón de
  `002_attribution_immutability.sql`/`008_registro_clinico.sql`: dos veterinarios con sesión de
  acceso activa, `set_config('request.jwt.claims', …)` y `set local role authenticated`) en rojo:
  atribución de la incorporación y de la retirada sellada por el servidor e inamovible por cliente
  (FR-069 · US5-AC13, D3), inmutabilidad de la fuente incorporada —solo la transición
  `available → withdrawn`, sin editar metadatos, sin resurrección— y ausencia total de `DELETE`
  (FR-053 · US5-AC12, D3), retirada excluida de búsquedas nuevas pero legible para resolver citas,
  RPC `search_knowledge_fragments`: stemming y ranking en español («ansiedad por separación»
  recupera el fragmento anotado), solo fuentes `available` de la clínica, orden determinista por
  `ts_rank_cd` con tope `p_limit`, `lemasPregunta`/`lemasCubiertos` correctos en un caso concreto
  (FR-006 · US5-AC1, D4), `AUTHENTICATION_REQUIRED` sin sesión activa, privilegios
  (`function_privs_are`/`table_privs_are` de `004_function_privileges.sql`: sin `update`/`delete`
  sobre `knowledge_queries`, sin `delete` sobre `knowledge_documents`, RPC ejecutable solo por
  `authenticated`) e insert-only del registro de consultas (FR-020 · US5-AC5, D6). Verificación:
  la suite falla por los objetos inexistentes y las aserciones nuevas; «rojo» observado en el
  stack local y registrado con su salida en `quickstart.md`.
- [x] 1.2 Escribir `supabase/migrations/010_base_conocimiento.sql`: tablas `knowledge_documents`
  (`content jsonb` con `bibliografia`/`licencia`/`fragmentos`, `status`, columnas de atribución y
  comprobación de forma mínima) y `knowledge_queries` (`question`, `patient_id` FK a
  `clinical_records(id)`, `answer jsonb`, `created_at`) con RLS y grants (D1/D2/D6), trigger
  `guard_knowledge_source_lifecycle` (sellado `created_by`/`withdrawn_*`, única transición de
  retirada, `ATTRIBUTION_IMMUTABLE`/`KNOWLEDGE_SOURCE_IMMUTABLE` con SQLSTATE 23514) y trigger de
  log con `log_server_event` (D3 · IV), y RPC `search_knowledge_fragments(p_query, p_limit)`
  (*security definer* con `search_path` fijado, `is_active_access`, acotada a la clínica y a
  fuentes `available`, `ts_rank_cd` + cobertura de lemas con `ts_debug` y `log_server_event`, D4).
  Verificación: suite `009` en verde en el stack local y en el job `database` de CI, suites
  `001`–`008` siguen verdes con la 010 aplicada (el test 23 de la suite `004` se ajusta bajo la
  integración autorizada RI-3) y `supabase gen types` sin diff tras la regeneración autorizada de
  `database.types.ts` (RI-1).
- [x] 1.3 Confirmar y documentar en `quickstart.md` que las transiciones de fuente emiten
  `Attribution.action = null` (sin acción enumerada de FR-063 para fuentes, el enum no tipifica
  `document`) y que no se escribe en `clinical_audit_events` (D3 · FR-069 · US5-AC13). Verificación:
  nota presente y suite `009` en verde.

## 2. Modelos, composición de respuestas y conversación (pruebas de unidad primero)

- [x] 2.1 Escribir en rojo `tests/unit/conocimiento/schema.test.ts`: esquemas Zod de `design.md`
  D2/D5/D6 — fuente con `bibliografia` (FR-030 · US5-AC9) y `licencia`, fragmentos con `ordinal`
  consecutivo y texto no vacío, cita documento+fragmento con `textoCitado` (FR-007 · US5-AC1/AC7),
  segmentos de respuesta con el vocabulario `Provenance` reutilizado de 002 y su mapeo
  evidencia→`recuperada`, inferencia→`inferida`, ficha→`reportada`/`desconocida` (FR-021 ·
  US5-AC3), cobertura y avisos (`sin_respaldo_documental`, `cobertura_parcial`, `fuentes_multiples`,
  `sin_paciente_seleccionado`, `fuente_retirada`, `evidencia_truncada`, `cita_irresoluble`,
  `ficha_no_disponible`) y forma persistida
  de `knowledge_queries` (FR-020 · US5-AC5). Verificación: `bun test tests/unit` en rojo por los
  esquemas inexistentes; luego verde.
- [x] 2.2 Escribir en rojo `tests/unit/conocimiento/answer.test.ts` y luego implementar
  `src/features/conocimiento/answer.ts` (`composeAnswer`, `splitIntoFragments`,
  `buildFragmentContext`): sin fragmentos calificados → declaración explícita de ausencia de
  respaldo con el límite de alcance y cero afirmaciones clínicas sin cita (FR-023 · SC-025 ·
  SC-010 · US5-AC2); cobertura parcial que nombra lo no cubierto (FR-022 · US5-AC8) y cobertura
  completa sin aviso; los tres orígenes visiblemente distintos con sus segmentos (FR-021 · US5-AC3);
  sin `patientId` → cero segmentos de ficha y aviso de conocimiento general (FR-051 · US5-AC10);
  ≥ 2 fuentes con evidencia → todas sus citas presentadas sin arbitraje y aviso `fuentes_multiples`
  (FR-052 · US5-AC11); máximo 5 referencias calificadas con umbral de cobertura de lemas ≥ 50%
  (SC-002, D4); citas con `textoCitado` verbatim del fragmento (SC-003 · D5); segmentos de ficha con
  `fichaRef` y snapshot de lo usado (FR-020 · US5-AC5); cita a fuente retirada resoluble y marcada
  al reconstruir (FR-053 · US5-AC12); `buildFragmentContext` con vecinos y resaltado del citado
  (FR-007 · US5-AC7); `splitIntoFragments` determinista sobre texto con encabezados de sección.
  Incluir umbral laxo de composición ≤ 200 ms (presupuesto de `design.md`). Verificación:
  `bun test tests/unit` rojo→verde.
- [x] 2.3 Escribir en rojo `tests/unit/conocimiento/conversation-store.test.ts` y luego implementar
  `src/features/conocimiento/conversation-store.ts` (Zustand): el contexto del paciente
  seleccionado y los turnos de la conversación se conservan a lo largo de la sesión de acceso y
  entre navegaciones (FR-026 · US5-AC4), cambiar de paciente marca el contexto sin atribuir datos
  del anterior, y el modo sin paciente queda explícito (FR-051 · US5-AC10). Verificación:
  `bun test tests/unit` rojo→verde.

## 3. Servicios de dominio (unidad local + integración viva en CI)

- [x] 3.1 Escribir en rojo `tests/unit/conocimiento/coleccion-service.test.ts` y
  `tests/integration/conocimiento/coleccion.test.ts` y luego implementar
  `src/features/conocimiento/coleccion-service.ts` (`incorporateSource`, `withdrawSource`,
  `listSources`, `getSource`) y `corpus-loader.ts` (`loadSyntheticCorpus`) con el guion
  `scripts/cargar-corpus-conocimiento.ts`: incorporación con bibliografía, licencia y fragmentos
  atribuida a la identidad autenticada con su momento y visible al revisar la colección
  (FR-028 · FR-030 · FR-069 · US5-AC6/AC9/AC13), rechazo de `ATTRIBUTION_CONTROL_FIELDS` y
  respuesta `ClinicalMutationResult` con atribucción releída (`action: null`, D3/D7 · contrato de
  [`../../implementar-identidad-y-acceso/contracts/clinical-attribution.md`](../../implementar-identidad-y-acceso/contracts/clinical-attribution.md)),
  retirada que deja la cita identificable (FR-053 · US5-AC12), inmutabilidad (corregir = retirar +
  incorporar fuente nueva, HD3), y SC-026: incorporar una fuente nueva y verla citable **no
  modifica** fichas ni registros clínicos (snapshot de `clinical_records` idéntico antes/después).
  Incluir aserciones de tiempo ≤ 2 s por operación (presupuestos de `design.md`). Verificación:
  `bun test tests/unit` verde local; `bun test tests/integration` con `SUPABASE_LIVE_TESTS=1` verde
  en el job `database` de CI.
- [x] 3.2 Escribir en rojo `tests/unit/conocimiento/consulta-service.test.ts` y
  `tests/integration/conocimiento/consulta.test.ts` y luego implementar
  `src/features/conocimiento/consulta-service.ts` (`consultKnowledge`, `listQueries`,
  `getQuery`): pregunta en lenguaje natural sobre la colección con respuesta citada
  documento+fragmento (FR-005 · FR-006 · FR-007 · US5-AC1), persistencia de la consulta con
  segmentos de ficha y citas que permite reconstruir qué datos y qué fuentes produjeron la
  recomendación (FR-020 · US5-AC5), cita resoluble a su fragmento en contexto (FR-007 · US5-AC7),
  sin paciente seleccionado: respuesta sobre conocimiento general sin datos de ningún paciente
  (FR-051 · US5-AC10) y contexto de paciente conservado entre preguntas (FR-026 · US5-AC4).
  Incluir aserciones de tiempo ≤ 500 ms (recuperación), ≤ 3 s (consulta completa) y ≤ 1 s
  (resolución de cita). Verificación: ídem 3.1.
- [x] 3.3 Escribir en rojo y luego completar `tests/integration/conocimiento/evaluacion.test.ts`
  sobre `tests/fixtures/conocimiento/{corpus-sintetico.json, conjunto-anotado.json}` (D9): SC-002
  (la evidencia esperada figura entre las primeras 5 referencias en ≥ 80% de las preguntas
  anotadas · US5-AC1), SC-025 (100% de `preguntasFueraDeDominio` produce aviso
  `sin_respaldo_documental` y cero segmentos de evidencia · US5-AC2), SC-010 (sobre todas las
  respuestas del arnés: 0 afirmaciones clínicas presentadas como respaldadas sin evidencia
  recuperable, toda cita resoluble y verbatim · US5-AC2) y SC-003 (fidelidad automática por texto
  verbatim; su revisión manual queda pendiente de aceptación). Verificación: el arnés pasa contra
  Supabase viva (stack local y job `database` de CI) con las métricas impresas en su salida; resultados
  y alcance (corpus/conjunto sintéticos) registrados en `quickstart.md` sin presentarlos como
  aceptación de SC-002/SC-003/SC-015.

## 4. Interfaz (WCAG 2.2 AA; verificación visual pendiente y declarada)

- [x] 4.1 Implementar la ruta `/knowledge` con componentes de `src/components/conocimiento`:
  conversación con selector de paciente como contexto y persistencia en la sesión (FR-026 ·
  US5-AC4), pregunta en lenguaje natural (FR-005 · US5-AC1), respuesta con los tres grupos de
  procedencia visiblemente distintos y chip de procedencia (FR-021 · US5-AC3), citas con
  bibliografía navegables al visor (FR-007 · FR-030 · US5-AC1/AC7/AC9), avisos de ausencia de
  respaldo con el límite de alcance (FR-023 · US5-AC2), de cobertura parcial nombrando lo no
  cubierto (FR-022 · US5-AC8) y de múltiples fuentes sin arbitraje (FR-052 · US5-AC11), modo sin
  paciente sin datos de ningún paciente (FR-051 · US5-AC10) y «ver respaldo» de cada turno con los
  datos y fuentes usados (FR-020 · US5-AC5). Añadir el enlace de navegación a `/knowledge` en
  `src/app/(protected)/home.tsx` como edición mínima de 1–2 líneas (pendiente como RI-2: el
  orquestador mantuvo el veto sobre ese archivo en FASE 2; queda documentada en `quickstart.md`;
  aplicado después en la tarea 8.1).
  Etiquetas
  programáticas, operación por teclado y foco visible en cada control; `testID` estables.
  Verificación: `bunx biome check --write` sobre los archivos propios y `bun run typecheck`
  verdes y `expo export --platform web` compila las cuatro rutas nuevas; verificación visual
  interactiva declarada pendiente (el daemon de Chromium del entorno no arranca).
- [x] 4.2 Implementar `/knowledge/sources`, `/knowledge/sources/new` y `/knowledge/sources/[id]`:
  colección con bibliografía, licencia, estado y atribución de quién y cuándo (FR-030 · FR-069 ·
  US5-AC9/AC13), ingesta de fuente con vista previa de fragmentos sin tocar el modelo clínico
  (FR-028 · SC-026 · US5-AC6), retiro de la fuente con la cita previa identificable (FR-053 ·
  US5-AC12) y visor con el fragmento citado en su contexto dentro del documento (FR-007 · US5-AC7).
  Verificación: ídem 4.1.

## 5. Compuertas y evidencia

- [x] 5.1 Crear `quickstart.md` del cambio al comenzar la implementación y mantenerlo incremental:
  guion reproducible de la verificación local (stack Supabase con protocolo de reserva por hub:
  reset de migraciones 001–010, suites 001–009, provision de veterinarios sintéticos y corrida
  viva con `SUPABASE_LIVE_TESTS=1`), «rojo» previo de 1.1 y comandos de las tareas siguientes.
  Verificación: documento con guion ejecutable y resultados reales desde la tarea 1.1.
- [x] 5.2 Ejecutar las compuertas locales acotadas (`bunx biome check --write` sobre los archivos
  propios de este cambio —jamás sobre todo el repo—, `bun run typecheck` y
  `bun test tests/unit/conocimiento tests/integration/conocimiento`) y dejar el job `database` de
  CI en verde en la rama para las suites 001–009, el diff de tipos y la integración viva.
  Verificación: lista de comandos y resultados + URLs de CI en `quickstart.md`.
- [x] 5.3 Consolidar `quickstart.md` con la evidencia real acumulada desde 1.1 (ciclos rojo→verde
  por tarea, comandos, URLs, métricas del arnés de evaluación y alcance de lo verificado) y los
  pendientes explícitos: RI-2 (enlace de navegación en `home.tsx`; cerrado después en 8.1), corpus real y conjunto anotado
  del equipo clínico, revisión manual de SC-003, evaluación de especialistas de SC-015 y
  aceptación de SC-002 sobre el conjunto real, verificación visual y e2e funcional web. Verificación:
  documento completo y sin afirmar como aceptado nada que no lo esté.

## 6. Cierre

- [x] 6.1 Publicar el reporte final en español (en la PR que crea el orquestador): mapa
  tarea↔FR/US/SC de este documento, evidencia de rojo→verde acumulada, decisiones duras (HD1–HD8 de
  `design.md`) y requisitos de integración (RI-2 pendiente; RI-1 y RI-3 como integración
  autorizada). Verificación: reporte publicado y coherente con `quickstart.md`.
- [x] 6.2 Si la implementación desvía `design.md` o estas tareas, actualizar los artefactos con
  `openspec-update-change` antes del merge. Verificación: artefactos coherentes entre sí.

## 7. Revisión de la PR #30 (2026-09-24)

Hallazgos de `/code-review high` publicados en la PR (10 comentarios en línea sobre `cfe1a2a`).
Numeración de esta sección: 1 re-talado de `to_tsquery`, 2 corte `p_limit` antes de calificar,
3 fuente malformada que tumba la consulta, 4 `patient_id` sin acotar, 5 invalidación de caché,
6 doble consulta con Enter, 7 cobertura nombrada con tallos, 8 coste O(corpus) por pregunta,
9 visor de fuente colgado en «Cargando…», 10 guion del corpus sin fallo cerrado. Cada rojo se
observó en local antes del arreglo (evidencia en `quickstart.md`).

- [x] 7.1 Construir el `tsquery` de la RPC sin normalizar (cast de texto), de modo que `ts_rank_cd` puntúe los lexemas tal cual (FR-006 · SC-002 · D4). Verificación: aserción pgTap «el ranking puntúa el lexema «ansied»» en `supabase/tests/010_base_conocimiento_revision.sql`, roja (rank 0) → verde.
- [x] 7.2 Ordenar los candidatos por lemas cubiertos antes que por `rank_cd` para que el corte `p_limit` no descarte evidencia que califica (FR-052 · FR-022 · D4). Verificación: aserción pgTap con `p_limit = 1` (have `…0002`, want `…0003`) roja → verde.
- [x] 7.3 Cerrar en el trigger la forma del `content` que exige la lectura y leer los fragmentos de la RPC fila a fila, omitiendo el ilegible con log estructurado (FR-006 · FR-030 · Principio V · D2/D3). Verificación: cinco aserciones pgTap de forma (rojas «no exception» → verdes) y prueba unitaria en `tests/unit/conocimiento/consulta-service.test.ts` (ZodError → evidencia del fragmento legible y `conocimiento.row_content_skipped`).
- [x] 7.4 Exigir que `patient_id` sea un paciente de la misma clínica, con un único error para ajeno, inexistente o de otro tipo (FR-020 · FR-051 · Principio V · D6). Verificación: tres aserciones pgTap (rojas: dos «no exception» y una 23503 de la FK) → verdes; aserción de la suite 009 ajustada al nuevo error; prueba viva en `tests/integration/conocimiento/consulta.test.ts`.
- [x] 7.5 Invalidar `['conocimiento']` tras incorporar y retirar, y colgar el selector de pacientes de la clave del registro (FR-028 · FR-053 · US5-AC6/AC12 · D10). Verificación: `tests/unit/conocimiento/query-cache.test.ts` y el e2e «la colección refleja al momento…» de `tests/e2e/web/conocimiento.spec.ts`, rojo (fuente nueva ausente a los 5 s) → verde.
- [x] 7.6 Un solo envío por consulta: Enter respeta la consulta en curso y la pregunta vacía (FR-020 · D6/D10). Verificación: e2e «pulsar Enter otra vez con la consulta en curso…», rojo (2 turnos) → verde (1 turno, 1 fila).
- [x] 7.7 Nombrar la cobertura con las palabras de la pregunta: la RPC devuelve `terminos_pregunta` y `composeAnswer` los usa (FR-022 · US5-AC8 · D4/D5). Verificación: aserción pgTap de `terminos_pregunta`, pruebas unitarias en `answer.test.ts` y `consulta-service.test.ts` (rojas con tallos → verdes) y prueba viva de cobertura parcial.
- [x] 7.8 Materializar los fragmentos al incorporar en `knowledge_fragments` con `tsvector` precalculado e índice GIN, sin privilegios para la API (FR-006 · presupuestos de rendimiento · D4). Verificación: aserciones pgTap de materialización, índice GIN y privilegios; `EXPLAIN` con 10 000 fragmentos (`Bitmap Index Scan`, 78,6 ms → 4,3 ms) en `quickstart.md`.
- [x] 7.9 Visor de fuente con estados de carga, no encontrada y error, diálogo de sesión caducada y confirmación del retiro (FR-007 · FR-053 · US5-AC7/AC12 · D10). Verificación: e2e «una fuente inexistente o ilegible…» rojo («Cargando…» indefinido) → verde, y paso de confirmación en el e2e de la colección.
- [x] 7.10 Guion del corpus con fallo cerrado (`--allow-remote`), sin credenciales por defecto y con sus variables en `.env.example` y `SETUP.md` (AGENTS.md · Principio V · D9). Verificación: `tests/unit/scripts/corpus-conocimiento.test.ts` (rojo por módulo inexistente → 7 pass) y ejecución real del guion (rechazo remoto, falta de variables y carga local).
- [x] 7.11 Actualizar `design.md` (D2, D3, D4, D5, D6, D9, D10, D11, complejidad y riesgos), este archivo y `quickstart.md`. Verificación: `openspec validate implementar-base-conocimiento-trazable` y artefactos coherentes con el código de la rama.
- [x] 7.12 Distinguir en el visor de fuente la sesión caducada de la fuente inexistente: con la sesión de acceso caducada, la RLS devuelve cero filas (no un error) y el visor mostraba «no encontrada»; el diálogo solo aparecía si lo abría el rastreador de actividad del layout (`useSessionActivity`). `getSource` consulta `is_active_access` (ya concedida a `authenticated` en la 005, sin SQL nuevo) solo cuando no hay fila y, si la sesión no está activa, lanza `AuthenticationRequiredError` (SQLSTATE 42501, como `AUTHENTICATION_REQUIRED` del servidor), que el visor ya traduce en el diálogo (FR-007 · US5-AC7 · D10). Verificación: tres pruebas de unidad de `getSource` en `tests/unit/conocimiento/coleccion-service.test.ts` (rojo: devolvía `null` sin consultar la sesión → verde) y e2e «con la sesión de acceso caducada el visor pide reautenticación…» de `tests/e2e/web/conocimiento.spec.ts`, que envejece la sesión con la service role y aísla el rastreador (rojo: «No se encontró la fuente…» sin diálogo → verde). Commit `cb25ae1`.

## 8. Pendientes declarados cerrados tras el merge de 001–005 (2026-09-25)

Con todas las specs en `main`, los archivos compartidos vetados en FASE 2 ya se pueden tocar.

- [x] 8.1 **RI-2**: enlace de navegación a `/knowledge` en `src/app/(protected)/home.tsx` con el patrón del enlace a Pacientes (`testID` `home-knowledge`, etiqueta accesible «Ir a la base de conocimiento»), con `authenticated-identity` intacto (D10 · FR-005 · US5-AC1). Verificación: e2e «el panel clínico enlaza con la base de conocimiento» de `tests/e2e/web/conocimiento.spec.ts` (rojo: `getByTestId('home-knowledge')` inexistente → verde, navega a `/knowledge`). Commit `28d9084`.
- [x] 8.2 Revisar el resto de requisitos de integración de la 003: RI-1 (`database.types.ts`) y RI-3 (test 23 de `004_function_privileges.sql`) ya estaban resueltos en `main`; `bun run db:types` sigue sin diff y la suite `004` verde. No queda ningún RI abierto. Verificación: compuertas de `quickstart.md` («Pendientes cerrados, 2026-09-25»).
- [x] 8.3 Actualizar `design.md` (D10, D11, riesgos), este archivo y `quickstart.md`. Verificación: `openspec validate implementar-base-conocimiento-trazable`.
