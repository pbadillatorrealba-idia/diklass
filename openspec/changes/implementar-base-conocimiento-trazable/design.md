# Diseño de implementación: Base de conocimiento trazable

**Fecha**: 2026-09-22 | **Especificación**: [base-conocimiento-trazable](specs/base-conocimiento-trazable/spec.md)

**Entrada**: propuesta y especificación del cambio; [identidad y acceso](../implementar-identidad-y-acceso/design.md)
y [registro clínico longitudinal](../implementar-registro-clinico-longitudinal/design.md) como
dependencias de construcción (001 ya está endurecida en `main`; 002 es la rama sobre la que se
apila esta). Este diseño se aprueba antes de `tasks.md`; su implementación sigue el
Rojo-Verde-Refactor obligatorio.

## Context

La plataforma que este cambio usa ya existe y está endurecida:

- `public.clinical_records` es la tabla polimórfica de **datos clínicos atribuidos** (D1 de 002:
  `record_type`, `content jsonb`, `status`, `supersedes_event_id`) con triggers de atribución
  (`deny_attribution_mutation`, `stamp_update_attribution`), de inmutabilidad de lo aprobado
  (`guard_approved_clinical_record`), de sellado por consulta cerrada (`guard_consultation_sealed`)
  y de auditoría (`audit_clinical_record`).
- `public.clinical_audit_events` + `clinical_record_action` enumeran taxativamente las acciones de
  FR-063 para las entidades clínicas de las siete funcionalidades (`patient`, `tutor`,
  `consultation`, `anamnesis`, `audio_fact`, `missing_information`, `hypothesis`, `diagnosis`,
  `pharmacological_treatment`, `non_pharmacological_treatment`, `epicrisis`,
  `clinical_feedback`). **No hay ningún tipo `document`/fuente en esa enumeración**: el corpus de
  conocimiento no es dato clínico atribuido (contrato del cambio; ver D1).
- Contratos de cliente reutilizables: `src/features/registro/schema.ts` (vocabulario `Provenance`
  de FR-021 con sus cuatro valores canónicos, `PatientContent`), `src/features/registro/summaries.ts`
  (`ClinicalRecordRow`, `computeMissingFichaFields`), `src/features/registro/ficha-service.ts`
  (`getPatient`), `src/lib/attribution/types.ts` (`Attribution`, `ClinicalMutationResult`,
  `ATTRIBUTION_CONTROL_FIELDS`) y `src/lib/attribution/clinical-mutations.ts` (patrón de mutación
  con guardas y atribución releída). Ver
  [contrato de atribución](../implementar-identidad-y-acceso/contracts/clinical-attribution.md).
- Observabilidad existente: `logEvent`/`captureClientError` en TS y `log_server_event` + `request_id`
  en SQL (solo callable desde funciones *security definer*).

Restricciones de esta ejecución y de la coordinación entre ramas hermanas:

- Sin Playwright. La verificación SQL local usa el stack Supabase compartido (podman) bajo el
  protocolo de reserva por hub («reservo stack» / «stack libre»): la colisión real entre worktrees
  hermanos hizo sustituir el clúster scratch `/tmp/verify-003/` de la primera versión de este
  diseño. La verificación oficial corre en el job `database` de CI. Sin e2e web propio
  (la compuerta de accesibilidad la cubre 002 en `tests/e2e/web/accessibility.spec.ts`).
- Archivos compartidos prohibidos para esta rama: `src/lib/attribution/*`, `src/lib/storage/*`,
  `src/lib/supabase/*`, `src/app/(protected)/consultations/[id].tsx`,
  `supabase/migrations/001-009*`, `supabase/tests/001-008*`, `supabase/seed.sql`. Números propios:
  migración `010_base_conocimiento.sql`, suite `009_base_conocimiento.sql`, código en
  `src/features/conocimiento/**` y `src/components/conocimiento/**`, pruebas en
  `tests/unit/conocimiento/**` y `tests/integration/conocimiento/**`.
- **Corpus documental SINTÉTICO por decisión de usuario**: documentos clínicos ficticios con
  estructura de citas documento+fragmento y metadatos de licencia; el corpus real se integra
  después. La siembra vive en fixtures propios, nunca en `seed.sql`.

Motivación y alcance de producto: ver `proposal.md - Why` y la spec; aquí solo se decide el *cómo*.

## Goals / Non-Goals

**Goals:**

- Colección documental con ingesta y retiro atribuidos (FR-028, FR-030, FR-053, FR-069), corpus
  sintético cargable en un entorno vivo sin tocar archivos compartidos.
- Recuperación de evidencia desde la colección y respuestas citadas documento+fragmento, con el
  fragmento visible en su contexto (FR-005, FR-006, FR-007).
- Contrato de respuesta que garantiza por construcción: separación fuente/ficha/inferencia
  (FR-021), aviso de cobertura insuficiente (FR-022), declaración de ausencia de respaldo sin
  afirmaciones sin cita (FR-023, SC-010, SC-025), sin arbitraje silencioso entre fuentes (FR-052)
  y sin datos de paciente sin seleccionar (FR-051).
- Reconstrucción posterior de qué datos del paciente y qué fuentes produjeron una respuesta
  recomendación (FR-020), verificable por máquina (SC-002, SC-010) y por revisión manual (SC-003).

**Non-Goals:**

- Generación de lenguaje natural con modelos de IA (D5: la respuesta es extractiva y determinista).
- Búsqueda semántica por similitud de vectores (D4), multilenguaje, búsqueda abierta en internet,
  jurisdicciones de las fuentes (supuestos de la spec).
- Modificación de la ficha clínica: esta spec solo la lee como contexto; no escribe en
  `clinical_records` (asunción de la spec).
- Poblado de hipótesis (006) ni recomendaciones farmacológicas (007): aquí «recomendación clínica»
  es la indicación citada que la respuesta entrega.
- Reincorporación de fuentes retiradas y edición de metadatos de una fuente incorporada (HD3: la
  corrección es retirar e incorporar una fuente nueva).
- e2e web propio (sin Playwright en el entorno) y aceptación de SC-002/SC-003/SC-015 sobre el
  corpus real y el conjunto del equipo clínico (queda como pendiente de aceptación).

## Decisions

### D1. El corpus vive en tablas propias, no en `clinical_records`

`knowledge_documents` (una fuente: `content jsonb` con `bibliografia`, `licencia` y `fragmentos`;
`status` en `available|withdrawn`; columnas de atribución `created_by/created_at` y
`withdrawn_by/withdrawn_at`) y `knowledge_queries` (una pregunta con su respuesta persistida:
`question`, `patient_id`, `answer jsonb`, `created_at`). Son tablas nuevas en
`supabase/migrations/010_base_conocimiento.sql`, con RLS y grants propios.

*Por qué no en `clinical_records`*: el contrato del cambio establece que el corpus de
conocimiento **no es dato clínico atribuido**, y la enumeración de FR-063 no tipifica `document`
ni acciones de fuente. Meter el corpus en `clinical_records` forzaría un `record_type` ajeno al
dominio clínico, arrastraría los triggers de sellado/aprobación de 002 sobre entidades que no
tienen consulta ni epicrisis, y exigiría inventar acciones enumeradas que la spec 001 no define.
*Alternativa rechazada*: segundo store documental (S3, base documental separada) — segunda
convención de persistencia y pérdida de RLS/atención compartida; Principio III la prohíbe.

*Coste aceptado*: al ser tablas nuevas, `src/lib/supabase/database.types.ts` debe regenerarse con
`supabase gen types` — archivo compartido **prohibido** para esta rama: quedó como requisito de
integración **RI-1** y el orquestador autorizó expresamente su regeneración dentro de la rama
durante la FASE 2 (junto con **RI-3**, la enumeración de funciones del test 23 de
`supabase/tests/004_function_privileges.sql`). Ambas quedan documentadas como integración
autorizada en `quickstart.md` y en el reporte final; los servicios de 003 validan además cada fila
y cada frontera con Zod (Principio V, D7).

### D2. Forma del documento y de la cita: fragmentos embebidos, cita documento+ordinal

El `content` de `knowledge_documents` usa claves `camelCase` en español (convención de 002 D2):

| Campo | Forma |
|---|---|
| `bibliografia` | `{ titulo, autores: string[], anio?, revista?, editorial?, edicion?, doi?, url? }` (FR-030) |
| `licencia` | `{ tipo, nota? }` (decisión de usuario: metadatos de licencia en todo documento) |
| `fragmentos` | `[{ ordinal, seccion?, texto }]`, `ordinal` consecutivo desde 1, `texto` no vacío |

La **cita** en una respuesta es `{ documentoId, ordinal, textoCitado }`: el texto citado es
verbatim el `texto` del fragmento, lo que hace verificable SC-003/SC-010 por construcción. El
**fragmento en su contexto** (US5-AC7) se compone en cliente con `buildFragmentContext`: la
cabecera bibliográfica del documento más los fragmentos vecinos, con el citado resaltado.

*Alternativa rechazada*: tabla `knowledge_fragments` con offsets sobre un texto íntegro — exige o
bien una RPC de ingesta para la atomicidad documento+fragmentos, o bien escrituras no atómicas;
más objetos, invariantes de offset y riesgo de drift entre texto íntegro y fragmento, sin ventaja
visible sobre un corpus acotado. Con fragmentos embebidos, incorporar una fuente es **una fila =
una transición atómica** y el texto citado no puede desincronizarse jamás del documento.

### D3. Ciclo de vida de la fuente: dos transiciones, sin borrado, atribución sellada

- **Incorporar** = `INSERT` en `knowledge_documents` (vía PostgREST desde el servicio). Trigger
  BEFORE `guard_knowledge_source_lifecycle`: sella `created_by = auth.uid()` (rechaza con
  `ATTRIBUTION_IMMUTABLE` 23514 todo intento de fijarlo por cliente) y valida forma mínima del
  `content`. Trigger AFTER: `log_server_event('knowledge_source_lifecycle', …)`.
- **Retirar** = la **única** `UPDATE` permitida: el trigger solo acepta la transición
  `available → withdrawn` y sella él mismo `withdrawn_by = auth.uid()` y `withdrawn_at`; cualquier
  otra modificación (metadatos, fragmentos, `created_*`, resurrección) fracasa con
  `KNOWLEDGE_SOURCE_IMMUTABLE` (23514).
- **Sin `DELETE`** (ni grant ni política): FR-053 exige que las citas emitidas sigan siendo
  identificables; las filas permanecen legibles para resolver citas y reconstruir respuestas, y la
  retirada solo las excluye de las consultas nuevas (US5-AC12).

La atribución de FR-069 queda en las propias filas (`created_*`, `withdrawn_*`), visibles al
revisar la colección (US5-AC13: quién y cuándo). Las transiciones emiten `Attribution.action = null`
en el resultado de mutación: no hay acción enumerada de FR-063 para fuentes y **no se escribe en
`clinical_audit_events`** (su enumeración no tipifica fuentes; extenderla mezclaría traza clínica
con cambios de corpus). *Alternativa de traza centralizada* (trigger que inserte eventos con un
`entity_type` nuevo): queda como decisión dura reversible (HD4), con cambio acotado al trigger.

### D4. Recuperación: búsqueda léxica con stemming español (no similitud vectorial)

La RPC `search_knowledge_fragments(p_query text, p_limit integer default 25)` (*security definer*
con `search_path` fijado, chequeo explícito `is_active_access(auth.uid())` y acotada a la clínica y
a fuentes `available`) recupera candidatos:

- **Consulta**: la pregunta se reduce a sus lexemas con `ts_debug('spanish', …)` y un fragmento
  concurre si su conjunto de lexemas **cubre** los de la pregunta (intersección de arreglos sobre
  el `texto` de cada fragmento). La recuperación es por cobertura, no por conjunción estricta: una
  palabra no contenida no anula una evidencia que cubre el resto de la pregunta. La primera
  implementación usó `websearch_to_tsquery`, que conjunta todos los términos y devolvía cero
  evidencias ante una sola palabra ausente; el assert 18 de la suite `009` delata esa regresión.
- **Ranking**: `ts_rank_cd` sobre la consulta formada por la unión de lexemas; desempate
  determinista por documento y `ordinal`.
- **Cobertura de lemas**: con `ts_debug('spanish', …)` devuelve `lemasPregunta` (lexemas de la
  pregunta, ya filtrados por el diccionario español) y, por candidato, `lemasCubiertos`
  (intersección con los lexemas del fragmento). La regla de producto —un fragmento **califica** si
  cubre ≥ 50% de los lemas de la pregunta (redondeo hacia arriba) y la respuesta muestra como
  máximo 5 referencias calificadas— vive en `composeAnswer` (TS puro, testeable), no en SQL.
- Cada ejecución emite `log_server_event` (operación, resultado, duración, nº de candidatos).

*Alternativas rechazadas*: (a) **similitud vectorial (pgvector + embeddings)** — exige habilitar una
extensión, un proveedor de embeddings con secreto nuevo y reintroduce no determinismo en una
compuerta que debe ser verificable; el corpus es acotado, monolingüe (español) y el conjunto
anotado permitirá medir si el léxico basta (SC-002) antes de pagar ese coste. (b) **híbrida
léxico+vector** — complejidad de ambos mundos sin requisito que la exija. (c) `ILIKE`/`LIKE` — sin
stemming ni ranking: no cumple SC-002 con léxico clínico flexionado. El cambio a similitud (HD2)
solo tocaría esta RPC y `composeAnswer`; el modelo de datos no cambia.

### D5. Respuesta extractiva y determinista: contrato cerrado de segmentos, cobertura y avisos

`composeAnswer(input): KnowledgeAnswer` es una función pura que **nunca genera texto clínico
libre**: toda afirmación clínica de la respuesta es una cita verbatim de un fragmento. La respuesta
es `{ pregunta, patientId, segmentos, cobertura, avisos, citas }` con:

| `kind` de segmento | Contenido | Procedencia (FR-021 canónico) |
|---|---|---|
| `evidencia` | texto verbatim del fragmento + cita documento+ordinal+bibliografía | `recuperada` |
| `ficha` | valor de la ficha del paciente con su `fichaRef` (o «sin dato» explícito) | `reportada` / `desconocida` |
| `inferencia` | **solo** derivaciones de cobertura/concordancia del propio sistema (qué conceptos cubre la evidencia, qué fuentes aportan qué) | `inferida` |

Las reglas del contrato (todas unit-testeadas):

- **FR-023 · SC-010 · SC-025**: 0 fragmentos calificados → `cobertura.estado = 'sin_evidencia'`,
  aviso `sin_respaldo_documental` con el límite de alcance («colección de etología veterinaria
  canina»), y **cero** segmentos con contenido clínico. Como los únicos segmentos con contenido
  clínico son citas verbatim, la proporción de afirmaciones respaldadas sin evidencia recuperable
  es 0 por construcción.
- **FR-022 · US5-AC8**: `cobertura = { cubiertos: string[], noCubiertos: string[], estado }` con
  `estado ∈ 'sin_evidencia' | 'parcial' | 'cubre'`, derivado de la cobertura de lemas; cuando
  `noCubiertos` no está vacío, aviso `cobertura_parcial` que **nombra** qué parte queda sin cubrir.
- **FR-021 · US5-AC3**: los tres orígenes van en grupos visiblemente distintos con su chip de
  procedencia (reutilizando `Provenance` de 002).
- **FR-051 · US5-AC10**: sin `patientId` → cero segmentos de ficha + aviso
  `sin_paciente_seleccionado` («conocimiento general»); jamás datos de otro paciente.
- **FR-052 · US5-AC11**: nunca se fusiona una sola indicación: cada evidencia se presenta con su
  cita, agrupada por documento, y si ≥ 2 documentos aportan evidencia se añade el aviso
  `fuentes_multiples` («se muestran todas las recuperadas, sin arbitraje»). Nunca se elige una en
  silencio.
- **FR-053 · US5-AC12**: al reconstruir una respuesta guardada, una cita hacia una fuente retirada
  sigue resolviéndose (bibliografía + fragmento) y se marca con el aviso `fuente_retirada`.
- **FR-020 · US5-AC5**: cada segmento de ficha lleva `fichaRef` y snapshot del valor usado; cada
  evidencia, su cita. Lo persistido (D6) **es** la reconstrucción.

Preguntas sin términos consultables (la pregunta son solo palabras vacías para el diccionario
español): se tratan como `sin_evidencia` con el mismo aviso `sin_respaldo_documental`, que es
verdadero en ambos casos de ausencia. La implementación descartó el aviso separado
`sin_terminos_consultables` que preveía esta primera versión (YAGNI: ningún FR distingue los dos
motivos de la ausencia).

*Alternativa rechazada* (**decisión dura HD1**): generación con LLM en una Edge Function con
proveedor externo. Rechazada porque añade dependencia de ejecución + secreto nuevo, rompe el TDD
determinista y, sobre todo, hace **no verificable** SC-010/FR-023 (toda afirmación clínica sin cita):
un generador puede emitir contenido clínico no respaldado aunque se le ancle el contexto. Los
criterios medibles de la spec (SC-002 recuperación, SC-003 fidelidad de cita, SC-015 utilidad de la
información **recuperada**) evalúan recuperación y citación, no fluidez de prosa. Si el usuario
invierte esta decisión (HD1), el contrato de `KnowledgeAnswer` se conserva íntegro: el generador
solo redactaría dentro de los segmentos `inferencia`, que quedarían como única superficie de
alucinación posible y con la misma validación de citas.

### D6. `knowledge_queries`: registro append-only de lo que produjo cada respuesta

Cada consulta guarda `question`, `patient_id` (FK a `clinical_records(id)`, anulable) y `answer`
(el `KnowledgeAnswer` completo: segmentos con snapshot de ficha, citas y cobertura). Es la fuente
de verdad de FR-020 y el material de auditoría de SC-003/SC-010 (revisión manual sobre las
referencias efectivamente mostradas). Es **append-only**: solo `grant select, insert` (sin
`update`/`delete` ni sus políticas), de modo que la traza no es reescribible.

Sin columnas de atribución: la spec exceptúa las preguntas de la atribución («las preguntas al
asistente no requieren atribución»; solo la gestión del corpus la exige, FR-069). *Alternativa*:
registrar `asked_by`; queda como decisión dura reversible (HD5) con cambio acotado a la tabla y al
servicio.

### D7. Contexto de paciente: contratos de 002, sin reinvención

`consulta-service` lee la ficha con `getPatient` (`src/features/registro/ficha-service.ts`) y
construye los segmentos de ficha reutilizando `PatientContent`, `computeMissingFichaFields`
(«sin dato» ≠ negativo, FR-044 de 002 visible en el contexto) y el vocabulario `Provenance` de
`src/features/registro/schema.ts` (cuyo valor `recuperada` existe exactamente para esta spec). Las
mutaciones de corpus respetan el contrato de
[atribución](../implementar-identidad-y-acceso/contracts/clinical-attribution.md): rechazan
`ATTRIBUTION_CONTROL_FIELDS` en la frontera y devuelven `ClinicalMutationResult` con la atribución
releída de la fila (con `action: null`, D3), sin reimplementar guardas.

Tipado: los servicios de 003 reciben `SupabaseClient<Database>` y validan además cada fila y cada
frontera con Zod (Principio V). Como RI-1 (regeneración de `database.types.ts`) se resolvió dentro
de la rama con la autorización expresa del orquestador al empezar la FASE 2, la alternativa de
«frontera propia sin el parámetro `Database`» (HD8) quedó obsoleta antes del primer servicio:
las firmas quedaron endurecidas contra el tipo generado desde el inicio.

### D8. Conversación con contexto de paciente por sesión de acceso (FR-026)

Un store de Zustand (`src/features/conocimiento/conversation-store.ts`) conserva, durante la sesión
de acceso, el `patientId` seleccionado y los turnos pregunta/respuesta de la conversación; las
rutas de `/knowledge` lo leen y escriben. Así, preguntas sucesivas mantienen el contexto
(US5-AC4) sin persistir estado conversacional derivado: la persistencia es solo la de D6 (por si
hay que reconstruir). *Alternativa rechazada*: estado de componente — se pierde al navegar; tabla
`conversations` — estado conversacional duplicado sin requisito.

### D9. Corpus sintético y conjunto anotado como fixtures propios + carga por servicio

- `tests/fixtures/conocimiento/corpus-sintetico.json`: 6–10 documentos clínicos **ficticios** de
  etología canina (protocolos, guías de modificación de conducta, fichas farmacológicas
  ficticias…), cada uno con `bibliografia`, `licencia` y `fragmentos` — la estructura de citas
  documento+fragmento que exige el contrato del cambio. Es el sustituto provisional del corpus
  real (HD7).
- `tests/fixtures/conocimiento/conjunto-anotado.json`: conjunto de evaluación con
  `{ preguntas: [{ pregunta, evidenciaEsperada: { documentoClave, ordinal } }], preguntasFueraDeDominio: [] }`
  — el sustituto provisional del conjunto del equipo clínico (asunción de la spec), con el formato
  que la hará intercambiable.
- `src/features/conocimiento/corpus-loader.ts` (`loadSyntheticCorpus`) incorpora el corpus por el
  mismo camino que la UI (`incorporateSource`), validado con Zod. Un guion delgado
  `scripts/cargar-corpus-conocimiento.ts` (ejecutable con `bun scripts/cargar-corpus-conocimiento.ts`,
  sin tocar `package.json` ni `seed.sql`) lo carga en un entorno vivo para demostración y
  evaluación. La suite pgTap 009 lleva sus propios fixtures SQL en línea.

### D10. Interfaz: rutas `/knowledge/**`, componentes propios, WCAG 2.2 AA

- `/knowledge` — conversación: selector de paciente como contexto (FR-051/FR-026), campo de
  pregunta en lenguaje natural (FR-005), respuesta con los tres grupos de procedencia (FR-021),
  citas navegables con su bibliografía (FR-007/FR-030) y avisos de cobertura/ausencia/múltiples
  fuentes (FR-022/FR-023/FR-052); cada turno permite «ver respaldo» (reconstrucción de FR-020).
- `/knowledge/sources` (colección con bibliografía, licencia, estado y atribución de quién y
  cuándo — FR-069/US5-AC13), `/knowledge/sources/new` (ingesta con vista previa de fragmentos,
  FR-028/FR-030) y `/knowledge/sources/[id]` (visor con el fragmento citado en su contexto,
  FR-007/US5-AC7, y retiro de la fuente, FR-053).

Componentes kebab-case en `src/components/conocimiento/` (`cita-fragmento`, `segmento-respuesta`,
`avisos-cobertura`, `respuesta-conocimiento`, `formulario-fuente`, `visor-documento`,
`selector-paciente-contexto`), reutilizando `ui/*` y `attribution-badge`. Etiquetas
programáticas, operación por teclado, foco visible y `testID` estables (WCAG 2.2 AA). La única
edición sobre un archivo existente es un enlace de navegación a `/knowledge` en
`src/app/(protected)/home.tsx` (1–2 líneas, documentada en `quickstart.md`, coordinada por hub con
las ramas hermanas); nada más sale de los namespaces propios.

### D11. Sin dependencias nuevas; verificación local con el stack Supabase y CI

Cero cambios en `package.json` (Principio III). Verificación SQL local sobre el stack Supabase
compartido (podman) con **protocolo de reserva por hub** («reservo stack» / «stack libre»): la
primera versión de este diseño preveía un clúster scratch `/tmp/verify-003/` para evitar
colisiones entre worktrees hermanos; una colisión real (un `db reset` ajeno borró las tablas en
mitad de una corrida viva) confirmó el riesgo y motivó el protocolo acordado con el orquestador.
El clúster scratch queda como alternativa si el stack está ocupado. La verificación oficial vive en
el job `database` de CI (suites pgTap +
`SUPABASE_LIVE_TESTS=1`); las pruebas de unidad corren localmente con `bun test`. Sin e2e web
propio (restricción del entorno; la compuerta de accesibilidad la cubre 002): queda como pendiente
declarado, no como compuerta cumplida.

## Seguimiento de complejidad (Principio III)

| Complejidad nueva | Justificación exigida por el requisito | Se elimina cuando |
|---|---|---|
| Tablas `knowledge_documents` y `knowledge_queries` | FR-006 (corpus), FR-020 (reconstrucción); el corpus no es dato clínico (D1) | No aplica |
| Trigger `guard_knowledge_source_lifecycle` + log AFTER | FR-069 (atribución sellada), FR-053 (retirada única, sin borrado), IV (log estructurado) | Nunca mientras la spec exija trazabilidad del corpus |
| RPC `search_knowledge_fragments` | FR-006/SC-002: stemming y ranking de FTS en el servidor (D4) | Si se adopta similitud vectorial (HD2) |
| Cobertura de lemas (`ts_debug`) en la RPC | FR-022/FR-023/SC-025: umbral de respaldo y aviso de qué queda sin cubrir (D4/D5) | Si se adopta un clasificador semántico (HD6) |
| `composeAnswer` extractivo + avisos | FR-021/022/023/051/052 y SC-010 por construcción (D5) | Si se adopta generación con LLM (HD1), conservando el contrato |
| Store de conversación (Zustand) | FR-026: contexto del paciente en la sesión (D8) | No aplica |
| `corpus-loader` + `scripts/cargar-corpus-conocimiento.ts` | Decisión de usuario: corpus sintético en fixtures propios, sin tocar `seed.sql` (D9) | Al integrar el corpus real |

Dependencias de ejecución nuevas: **ninguna**. Capas arquitectónicas nuevas: **ninguna**
(`features/conocimiento` y `components/conocimiento` sobre los patrones de `features/registro` y
`lib/attribution`). Archivos compartidos modificados: solo los dos de la **integración autorizada**
por el orquestador en FASE 2 — `src/lib/supabase/database.types.ts` (RI-1) y el test 23 de
`supabase/tests/004_function_privileges.sql` (RI-3) —, documentados en `quickstart.md`.

## Presupuestos de rendimiento (verificables antes de integrar)

| Operación | Presupuesto | Cómo se verifica |
|---|---|---|
| Recuperación de candidatos (pregunta → ≤ 25 candidatos, corpus ≤ 20 fuentes / ≤ 200 fragmentos) | ≤ 500 ms (red local incluida) | aserción de tiempo en `tests/integration/conocimiento/consulta.test.ts` (3.2) |
| Composición de respuesta (≤ 25 candidatos, función pura) | ≤ 200 ms CPU cliente | temporización laxa en `tests/unit/conocimiento/answer.test.ts` (2.2) |
| Consulta completa (pregunta → respuesta compuesta y persistida) | ≤ 3 s | aserción de tiempo en `tests/integration/conocimiento/consulta.test.ts` (3.2) |
| Incorporar fuente (≤ 30 fragmentos) / retirar fuente | ≤ 2 s por operación | aserción de tiempo en `tests/integration/conocimiento/coleccion.test.ts` (3.1) |
| Resolver cita y componer el fragmento en su contexto | ≤ 1 s | aserción de tiempo en `tests/integration/conocimiento/consulta.test.ts` (3.2) |

SC-002, SC-003 y SC-015 son medición sobre el conjunto anotado y con especialistas: el arnés de
evaluación (3.3) los ejercita sobre el corpus y el conjunto **sintéticos** y sus resultados son
evidencia del mecanismo, no aceptación de los criterios. La aceptación de SC-002/SC-003/SC-015
sobre corpus y conjunto reales queda como **pendiente explícita**.

## Verificación de principios constitucionales

- **I (especificación primero)**: este diseño y `tasks.md` preceden a cualquier código; todo cambio
  de comportamiento pasa primero por la spec (`openspec-update-change`).
- **II (pruebas primero)**: cada grupo de `tasks.md` abre con sus pruebas en rojo —pgTap e
  integración viva observadas en el stack local y en CI (evidencias en `quickstart.md`), unidad
  local— fallando por la razón prevista antes de implementar.
- **III (simplicidad/YAGNI)**: sin dependencias ni capas nuevas; complejidad justificada arriba;
  generación con LLM y similitud vectorial rechazadas por escrito (D4/D5).
- **IV (observabilidad)**: la RPC de búsqueda y los triggers del ciclo de vida de la fuente emiten
  `log_server_event` (patrón `approve_clinical_record`); los servicios usan `logEvent` con
  `requestId` (`makeRequestId`) y `captureClientError` en fallos; ninguna excepción silenciada.
- **V (seguridad)**: RLS + triggers del servidor son el control; las dos funciones SQL (*security
  definer* con `search_path` fijado) revalidan `is_active_access` y acotan a la clínica; Zod valida
  ingesta, búsqueda y lectura de respuestas; ningún campo de atribución aceptado del cliente; sin
  secretos nuevos.
- **Accesibilidad web (WCAG 2.2 AA)**: etiquetas programáticas, operación por teclado, foco visible
  y contraste en todas las superficies nuevas; compuerta axe + teclado/foco/viewport de 002 sigue
  en pie para lo compartido y la verificación visual de estas pantallas queda declarada pendiente
  (sin Playwright en el entorno).

## Migration Plan

Una única migración aditiva `supabase/migrations/010_base_conocimiento.sql`: tablas nuevas con
RLS/grants, triggers de ciclo de vida y log, y la RPC de búsqueda. Cero cambios destructivos sobre
objetos existentes y cero escritura en `clinical_audit_events` ni en su enumeración (D3). Rollback =
revertir el commit (no hay datos que migrar). RI-1 (`supabase gen types` sobre
`src/lib/supabase/database.types.ts`) quedó ejecutada dentro de la rama con la autorización
expresa del orquestador y se re-verifica sin diff tras cada merge.

## Risks / Trade-offs

- **[RI-1 · resuelta] `database.types.ts` exige regeneración compartida** → la migración 010 añade
  tablas que el tipo generado no conocía y el archivo está prohibido para esta rama: el orquestador
  autorizó su regeneración en FASE 2 y quedó commiteada como integración autorizada, con el diff
  de tipos del job `database` en verde y re-verificado tras el merge de 002.
- **[RI-2 · pendiente] Enlace de navegación en `home.tsx`** → el orquestador mantuvo el veto sobre
  ese archivo en FASE 2: el enlace a `/knowledge` queda como requisito de integración (1–2 líneas
  en `src/app/(protected)/home.tsx`, con el `testID` `authenticated-identity` intacto); las rutas
  son alcanzables por URL mientras tanto.
- **Umbral léxico de respaldo (D4/D5)** → una pregunta con léxico divergente del corpus puede
  declararse «sin respaldo» pese a existir evidencia semánticamente cercana (falso negativo de
  FR-023) o vivir en cobertura parcial crónica. Mitigación: medido por SC-002/SC-025 sobre el
  conjunto anotado; el ajuste del umbral es una constante del compositor; el cambio a semántica es
  HD6.
- **FR-052 por sobre-declaración (D5)** → el aviso de múltiples fuentes se emite siempre que ≥ 2
  documentos aportan evidencia, sin detectar contradicción semántica: conservador (nunca elige en
  silencio) pero ruidoso. Documentado; la detección semántica de contradicción queda fuera del PoC.
- **Corpus y conjunto anotado sintéticos (D9/HD7)** → SC-002/SC-003/SC-015 no son aceptables hasta
  corpus real, conjunto del equipo clínico y revisión/evaluación humanas. Se diferencia en todo
  artefacto entre verificado por máquina y aceptado.
- **Citas como referencias dentro de `answer jsonb` (D6)** → sin FK de las citas hacia el fragmento
  (mismo coste `jsonb` que asumió 002 en D1). Mitigación: el registro es append-only, el corpus es
  inmutable salvo retirada y el texto citado viaja verbatim en la propia cita (siempre resoluble).
- **Ciclos TDD lentos para SQL** (rojo/verde por el stack local con reserva y CI) → suites
  pequeñas y enfocadas; salidas de ejecución como evidencia.
- **Verificación visual interactiva y e2e funcional web** → el daemon de Chromium del entorno no
  arranca (`omp.browser.headed` falla con exit=21) y no hay Playwright: la verificación visual
  interactiva queda **pendiente declarado** (D11), no compuerta cumplida. La compilación web
  completa sí quedó verificada (`expo export --platform web` exporta las cuatro rutas de
  `/knowledge`) y el shell responde HTTP 200 con el título de la app.

### Decisiones duras (reversibles por el usuario)

| # | Decisión (default elegido) | Alternativa | Qué cambia si se invierte |
|---|---|---|---|
| HD1 | Respuesta **extractiva sin modelo generativo** (D5) | LLM en Edge Function con proveedor externo | Nueva función Edge + secreto + validación de anclaje; el contrato `KnowledgeAnswer` y las citas se conservan; SC-010 deja de ser «por construcción» y exige validación de respaldo por afirmación |
| HD2 | Recuperación **léxica FTS** española (D4) | pgvector + embeddings (o híbrida) | Extensión + proveedor de embeddings + reescritura de `search_knowledge_fragments`; tablas y citas intactas |
| HD3 | Fuentes **inmutables**: la corrección es retirar + incorporar fuente nueva (D3) | Edición de metadatos/fragmentos con historia | Amplía el trigger de ciclo de vida y exige definir historia de versiones del fragmento citado |
| HD4 | Atribución del corpus **solo en columnas de fila**, sin `clinical_audit_events` (D3) | Trigger que inserte eventos con `entity_type` nuevo | Trigger nuevo + decisión sobre la enumeración de FR-063 (¿extenderla o aceptar eventos no enumerados?) |
| HD5 | `knowledge_queries` **sin actor** (supuesto de la spec) (D6) | Columna `asked_by` + guarda | Columna + trigger + consulta de «quién preguntó» en la reconstrucción |
| HD6 | Cobertura por **lemas** (`ts_debug`) para FR-022/FR-023/SC-025 (D4/D5) | Clasificador semántico de cobertura | Sustituye el análisis de cobertura de `composeAnswer`; el resto del contrato no cambia |
| HD7 | Corpus y conjunto anotado **sintéticos** como sustitutos provisionales (D9) | Esperar al corpus real y al conjunto del equipo clínico | Reemplazo de fixtures; el loader y el arnés de evaluación (formato) se conservan |
| HD8 | Servicios 003 **sin parámetro `Database`** en `SupabaseClient` hasta RI-1 (D7) — **aplicó la alternativa**: firmas tipadas contra `database.types.ts` desde el inicio (D7) | Tipar contra `database.types.ts` regenerado ya | Alternativa aplicada; la opción inicial quedó obsoleta al resolverse RI-1 dentro de la rama |

## Open Questions

Ninguna cambia el enfoque, la spec ni el desglose de tareas; todas tienen default documentado arriba:

1. **Formato de fragmentación del corpus real**: el corte en fragmentos de los documentos reales
  ¿seguirá el criterio por párrafos/secciones del corpus sintético? La ingesta acepta listas de
  fragmentos arbitrarias (D2), así que el ajuste no toca el modelo.
2. **Traza centralizada de cambios del corpus** (HD4): ¿la revisión exigirá además eventos en
  `clinical_audit_events`, o basta la atribución por fila que US5-AC13 describe? Default: fila.
3. **Firma del conjunto anotado definitivo**: ¿el equipo clínico adoptará el formato de
  `conjunto-anotado.json` (pregunta + evidencia esperada + preguntas fuera de dominio)? Default:
  ese formato provisional.
4. **Agenda de la aceptación humana** (SC-015 con ≥ 3 especialistas sobre ≥ 5 casos, SC-003 por
  revisión manual, SC-002 sobre el conjunto real): pendiente externo al cambio, declarado en
  `quickstart.md`.
