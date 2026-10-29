# Diseño de implementación: Asistencia clínica proactiva

**Fecha**: 2026-09-22 | **Especificación**: [asistencia-clinica-proactiva](specs/asistencia-clinica-proactiva/spec.md)

**Entrada**: propuesta y especificación del cambio; [identidad y acceso](../implementar-identidad-y-acceso/design.md),
[registro clínico longitudinal](../implementar-registro-clinico-longitudinal/design.md) y
[base de conocimiento trazable](../implementar-base-conocimiento-trazable/design.md) como
dependencias de construcción (001 está endurecida en `main`; 002 está parcialmente implementada en
esta rama; 003 se recibe con el merge de su rama en la fase de implementación). Este diseño se
aprueba antes de `tasks.md`; su implementación sigue el Rojo-Verde-Refactor obligatorio.

## Context

Las tres capas de las que depende este cambio ya existen o llegan con el merge de 003:

- **Atribución y traza (001, endurecida)**: `public.clinical_records` (tabla polimórfica con
  `record_type`, `content jsonb`, `status` en `draft|approved|corrective`, `supersedes_event_id` y
  columnas de atribución fijadas por el servidor) y `public.clinical_audit_events` con la
  enumeración taxativa de FR-063, que **ya tipifica las entidades de esta funcionalidad**:
  `missing_information` y `hypothesis` entre los `entity_type`, y las acciones
  `missing_information_decided`, `hypothesis_added`, `hypothesis_accepted`,
  `hypothesis_discarded` entre las enumeradas. El mapping `clinical_record_action`
  (`supabase/migrations/003_attribution_hardening.sql`) resuelve ya:
  - `INSERT` de `missing_information` → `missing_information_decided` (también `UPDATE`);
  - `INSERT` de `hypothesis` → `hypothesis_added`;
  - `UPDATE` de `hypothesis` → `hypothesis_accepted` / `hypothesis_discarded` /
    `hypothesis_added` según `content->>'decision'` (`accepted` | `discarded` | otro).
- **Endurecimiento de escritura (001/002)**: los grants conceden a `authenticated` solo
  `update (content)` sobre `clinical_records` (004), la aprobación solo es posible por la RPC
  `approve_clinical_record` (que rechaza todo `record_type` que no sea `epicrisis`), la política
  T055 permite a cualquier veterinario activo de la clínica editar filas no aprobadas —premisa de
  amenaza que exige inmovilidad server-side de la base de las asistencias (D8)— y los triggers
  `deny_attribution_mutation`, `stamp_update_attribution`, `guard_approved_clinical_record` y
  `audit_clinical_record` sellan la atribución. El contrato de mutaciones de cliente vive en
  `src/lib/attribution/clinical-mutations.ts` (`createClinicalRecord`, `updateClinicalContent`,
  `approveClinicalRecord`, `createCorrectiveRecord`; guardas `ATTRIBUTION_CONTROL_FIELDS` y
  respuesta `ClinicalMutationResult` con la atribución releída de la traza):
  [contrato de atribución](../implementar-identidad-y-acceso/contracts/clinical-attribution.md).
- **Registro clínico (002, contratos en esta rama)**: `src/features/registro/schema.ts`
  (vocabulario `Provenance` canónico de FR-021 con sus cuatro valores, `AnamnesisField` con sus
  campos estructurados de US2, `PatientContent`, `EpicrisisContent` cuyo campo `hipotesis` es
  `[{ texto, estado }]` y quedó vacío a propósito: «los poblán las specs 006 y 007»),
  `src/features/registro/summaries.ts` (`ClinicalRecordRow`, `computeMissingFichaFields` con la
  distinción FR-044 «sin dato» ≠ «hallazgo negativo», `buildPatientHistory`,
  `buildFollowUpSummary`), `src/features/registro/ficha-service.ts` (`getPatient`) y
  `diagnosis-service.ts` (el diagnóstico final lo registra el veterinario, atribuido por FR-063).
  El trigger `guard_consultation_sealed` (D5 de 002) sella toda fila cuyo
  `content->>'consultationId'` resuelva a una consulta cerrada e inmoviliza el propio vínculo; la
  RPC de aprobación (D4 de 002) cierra la consulta en la misma transacción.
- **Base de conocimiento (003, contratos declarados en su diseño; llegan con el merge)**:
  `knowledge_documents` (fuentes inmutables salvo retirada), `knowledge_queries` (append-only,
  registro de qué produjo cada respuesta — el material de reconstrucción de FR-020),
  `search_knowledge_fragments` (recuperación léxica española con cobertura de lemas) y el contrato
  de respuesta `KnowledgeAnswer` de su D5: segmentos `evidencia` (cita verbatim
  documento+fragmento, procedencia `recuperada`), `ficha` (con `fichaRef` y snapshot) e
  `inferencia`, más `cobertura` y un vocabulario de `avisos` que ya incluye
  `sin_respaldo_documental`, `cobertura_parcial`, `fuentes_multiples`, `fuente_retirada`. Los
  servicios `consultKnowledge`/`getQuery` de `src/features/conocimiento/` componen y persisten esa
  respuesta, y `buildFragmentContext` muestra el fragmento citado en su contexto.

Restricciones de esta ejecución y de la coordinación entre ramas hermanas:

- Archivos compartidos **prohibidos** (no se tocan; se consumen como contratos): 
  `src/lib/attribution/*`, `src/lib/storage/*`, `src/lib/supabase/*`,
  `src/features/registro/*`, `src/features/conocimiento/*`,
  `src/app/(protected)/consultations/[id].tsx`, `src/app/(protected)/home.tsx`,
  `supabase/migrations/001-012*`, `supabase/tests/001-011*`, `supabase/seed.sql`. Toda necesidad
  de editarlos se reporta como requisito de integración (RI-1/RI-2, ver Riesgos).
- Números propios: migración `supabase/migrations/013_asistencia_clinica.sql`, suite pgTap
  `supabase/tests/012_asistencia_clinica.sql`, código en `src/features/asistencia/**` y
  `src/components/asistencia/**`, rutas propias en `src/app/(protected)/support/**`, pruebas en
  `tests/unit/asistencia/**` e `tests/integration/asistencia/**` con fixtures en
  `tests/fixtures/asistencia/`.
- Verificación SQL local con clúster PostgreSQL scratch + shims (roles de API, `auth.users`,
  `auth.uid()`, `auth.jwt()`, pgtap) en `/tmp/verify-006/` — el patrón documentado en el
  [quickstart de 002](../implementar-registro-clinico-longitudinal/quickstart.md) —; nunca
  `supabase start` (las ramas hermanas compiten por puertos). La verificación oficial vive en el
  job `database` de CI (suites pgTap + `SUPABASE_LIVE_TESTS=1`). Sin Playwright en esta rama (la
  compuerta de accesibilidad web la cubre 002; ver D12 y RI-3).
- Cero dependencias nuevas ni modelos generativos (Principio III y contrato del cambio). Artefactos
  y respuestas en español; identificadores en inglés; claves de `content` en camelCase.

Motivación y alcance de producto: ver `proposal.md - Why` y la spec; aquí solo se decide el *cómo*.

## Goals / Non-Goals

**Goals:**

- Identificación de información faltante (ficha + anamnesis) con preguntas sugeridas
  deterministas, fundamento citado o etiquetado como criterio general, y decisiones del
  veterinario registradas como acciones de FR-063 (FR-008, FR-033).
- Apoyo al diagnóstico diferencial como **candidaturas explícitas** —del sistema por reglas
  transparentes o del propio veterinario— con antecedentes a favor, en contra (o su ausencia
  explícita), información faltante y evidencia citada; estados `added|accepted|discarded`
  registrados; nunca diagnóstico definitivo del sistema (FR-009, FR-029, FR-010, SC-019, SC-031).
- Avisos por construcción: insuficiencia de información que nombra lo faltante (FR-022) y
  declaración de ausencia de respaldo documental sin afirmaciones sin cita (FR-023, SC-030),
  reutilizando el contrato de avisos de 003.
- Reconstrucción verificable de cada hipótesis: qué antecedentes del paciente y qué fuentes la
  produjeron (FR-020), con el fragmento concreto visible (FR-007).
- Disponibilidad de hipótesis y estados para el campo «hipótesis consideradas» de la epicrisis
  (FR-049), con el montaje mínimo como RI-1.

**Non-Goals:**

- Inferencia clínica definitiva automática, generación de lenguaje natural, modelos generativos o
  aprendizaje continuo de las decisiones del veterinario (supuestos de la spec; Principio III).
- Apoyo al tratamiento y farmacología (spec 007): sin recomendaciones de fármacos ni dosis.
- Modificación de los contratos de 001/002/003: se consumen tal cual; una necesidad de
  cambio en ellos es RI, no una edición de esta rama.
- Nuevas tablas, cambios en la enumeración de FR-063 ni regeneración de
  `src/lib/supabase/database.types.ts` (ver D1: la migración 013 solo añade un trigger).
- e2e web propio con Playwright y verificación visual en esta ejecución (D12): quedan como
  pendientes declarados.
- Aceptación humana de SC-017/SC-018 (panel de especialistas) y de SC-029 sobre el conjunto de
  casos del equipo clínico: dependencias externas, pendientes explícitos (D12).

## Decisions

### D1. Las entidades de la asistencia son filas de `clinical_records` con el enum de FR-063 ya existente

Las sugerencias decididas son filas `record_type = 'missing_information'` y las hipótesis, filas
`record_type = 'hypothesis'`, ambas con `status = 'draft'` y el detalle en `content jsonb`
(D2). El mapping `clinical_record_action` de 001 ya emite para ellas exactamente las acciones que
la spec exige registrar (`missing_information_decided`, `hypothesis_added/accepted/discarded`):
esta funcionalidad **reutiliza esa convención sin extender el enum** (el contrato del cambio lo
prescribe). Consecuencias verificables: atribución sellada por los triggers existentes, sellado
automático al cerrar la consulta (`guard_consultation_sealed` de 002 resuelve por
`content->>'consultationId'`, que mis filas llevan), e inmutabilidad de lo aprobado heredada.

*Por qué no tablas propias* (como las de 003): el corpus de 003 no era dato clínico y su contrato
lo declaraba; aquí ocurre lo contrario — el enum de FR-063 tipifica estas entidades como acciones
clínicas atribuidas, y meterlas en tablas nuevas duplicaría atribución, traza y grants, y
exigiría regenerar `database.types.ts` (archivo compartido prohibido, el RI-1 que 003 sí paga).
Con este diseño la migración 013 añade solo un trigger y `supabase gen types` queda sin diff
(comportamiento verificado por 002 con su `guard_consultation_sealed`, también trigger puro).

*Coste aceptado*: integridad referencial dentro de `jsonb` (`consultationId`, `knowledgeQueryId`)
sin FK — el mismo coste que asumieron 002 (D1/D6) y 003 (D6). Mitigación: servicios únicos de
escritura, trigger de base inmutable (D8) y pruebas de integración.

### D2. Forma del contenido por entidad (claves camelCase, Zod en cada frontera)

| `record_type` | `content` |
|---|---|
| `missing_information` | `{ consultationId, suggestionKey, pregunta, estado: 'formulada' \| 'ignorada' \| 'no_aplicable', fundamento: { kind: 'fuente', cita: Cita } \| { kind: 'criterio_general' }, camposRelacionados: string[] }` |
| `hypothesis` | `{ consultationId, texto, decision: 'added' \| 'accepted' \| 'discarded', origen: 'sistema' \| 'veterinario', reglaId: string \| null, insumos: { anamnesis: [{ recordId, field, text, provenance, papel: 'aFavor' \| 'enContra' }], ficha: [{ fichaRef, valor, papel: 'aFavor' \| 'enContra' }], faltante: string[], terminosMatch: string[] }, respaldo: { knowledgeQueryId: string \| null, citas: Cita[], avisos: string[], cobertura: { cubiertos: string[], noCubiertos: string[], estado } \| null } }` |

- `Cita` es la cita documento+fragmento de 003 (`{ documentoId, ordinal, textoCitado }`), con el
  texto citado verbatim: una cita hacia una fuente posteriormente retirada sigue resolviéndose
  (convención `fuente_retirada` de 003).
- `provenance` reutiliza el vocabulario canónico de FR-021 (`reportada | inferida | recuperada |
  desconocida`) de `src/features/registro/schema.ts`; `papel` distingue lo que la regla evaluó a
  favor de lo que la contraría.
- `missing_information.estado` solo admite estados **decididos**: el estado `pendiente` no se
  persiste porque es derivable (D3). `hypothesis.decision` es la única marca de estado persistida
  (D7) porque es exactamente lo que el mapping de FR-063 consume (`content->>'decision'`).
- Toda frontera de entrada valida con Zod (Principio V): formularios, filas leídas y payloads de
  mutación.

### D3. Información faltante: detección pura + registro de la decisión (no de la sugerencia)

`detectMissingInformation({ ficha, anamnesis, decisiones })` es una función pura sobre los
contratos de 002 que devuelve las sugerencias **pendientes**:

- **Ficha**: `computeMissingFichaFields` (FR-044: un hallazgo negativo explícito **cubre** el
  antecedente; solo lo sin dato es faltante) alimenta el registro de sugerencias.
- **Anamnesis**: un campo estructurado de `AnamnesisField` vacío o con valor desconocido es
  faltante; una cobertura por contenido (los términos del antecedente aparecen en cualquier texto
  de la anamnesis, incluido `texto_libre`) también cuenta como cubierto (US7-AC4).
- **Registro de sugerencias** (`reglas.ts`, D5 explica su naturaleza): entradas
  `{ key, pregunta, condicion, camposRelacionados, fundamento: { query } | criterio_general }`;
  `key` estable identifica la sugerencia a lo largo de la consulta. Una sugerencia cuya
  `condicion` no se cumple no se propone (no toda pregunta cabe en todo caso).

El estado `pendiente` es **derivado** (detectada y sin decisión); la fila `missing_information`
se crea cuando el veterinario decide (`formulada`, `ignorada`, `no_aplicable` — US7-AC2/AC6) y
cada revisión posterior de la decisión la actualiza. Así el INSERT emite por el mapping existente
`missing_information_decided`, que es semánticamente exacto: la fila **es** la decisión, no la
sugerencia (el contrato del cambio reutiliza la convención para «la información faltante
decidida»). Las decisiones viven por consulta (`consultationId`): una sugerencia ignorada deja de
proponerse en esa consulta y puede volver a proponerse en una posterior si sigue siendo
pertinente (supuesto de la spec).

*Alternativa rechazada*: crear la fila al proponer (estado `pendiente`) — el INSERT ya emitiría
`missing_information_decided` por el mapping de 001 (una proposición no es una decisión),
persistiría lo derivable y obligaría a distinguir «decidida» de «propuesta» dentro de una acción
que no admite esa distinción.

### D4. Fundamento de la sugerencia: recuperación de 003, con etiqueta honesta de criterio general

Cada sugerencia declara una `query` de recuperación («protocolo de …») que se resuelve con la
recuperación de 003 (`search_knowledge_fragments`/`consultKnowledge`): si hay fragmentos que
califican, el fundamento es `{ kind: 'fuente', cita }` con el fragmento concreto verificable
(US7-AC3, FR-033); si no, el fundamento es `{ kind: 'criterio_general' }` y la interfaz lo declara
explícitamente como criterio general y no como protocolo cargado (US7-AC5). La composición del
fundamento (`composeFundamento`) es pura sobre el resultado de la recuperación: determinista y
unit-testeable con recuperación simulada. FR-023 se cumple por construcción: una sugerencia jamás
muestra una cita que no exista, y la ausencia de respaldo nunca se disfraza de fuente.

### D5. Hipótesis: reglas deterministas transparentes + contrato de respuesta de 003 como respaldo

El mecanismo de apoyo al diagnóstico diferencial tiene dos piezas:

1. **Candidaturas por reglas transparentes** (`reglas.ts`): un registro en código de reglas
   `{ id, hipotesis, consultaRecuperacion, soporte: [{ field, terms }], contra: [{ field, terms }],
   discriminatorios: AnamnesisField[] }`. `matchRegla` evalúa términos (comparación sin
   distinguir mayúsculas ni acentos) sobre los textos de la anamnesis y la ficha y clasifica cada
   insumo como `aFavor` o `enContra`; los `terminosMatch` y las referencias de los insumos
   (`recordId`, `fichaRef`) forman la reconstrucción de FR-020. Una regla con insumos a favor **y**
   en contra se presenta reflejando ambas ramas y marcada como contradictoria (caso límite de la
   spec: nunca se escoge la rama que mejor sostenga una conclusión). El veterinario puede además
   **agregar sus propias hipótesis** (`origen: 'veterinario'`, `reglaId: null`), distinguibles de
   las del sistema (US8-AC9) y sin fricción para un diagnóstico final que ninguna hipótesis
   anticipó (caso límite: el diagnóstico se registra por `diagnosis-service` de 002, sin acoplarse
   a esta funcionalidad).
2. **Respaldo por el contrato de 003**: por cada candidata presentada se consulta la base de
   conocimiento con la `consultaRecuperacion` de la regla más los términos del caso
   (`consultKnowledge`, que persiste además en `knowledge_queries`) y el `KnowledgeAnswer`
   resultante —segmentos `evidencia` con citas documento+fragmento, `ficha` con snapshot e
   `inferencia`, más `cobertura` y `avisos`— viaja como `respaldo` de la hipótesis (D2). Es la
   reutilización literal del contrato D5 de 003: la separación dato/inferencia (FR-021), la
   citación de fragmentos (FR-007 · US8-AC10, con `buildFragmentContext` para el fragmento en su
   contexto), el aviso de cobertura parcial (FR-022) y la declaración de ausencia de respaldo
   (FR-023 · US8-AC7 · SC-030: `sin_respaldo_documental` se propaga a la presentación de la
   hipótesis con el límite de alcance de la colección) llegan probados por las suites de 003.

La presentación (`composeHipotesisSoportada`) garantiza por construcción las tres secciones que
exige SC-019: `aFavor` con los insumos que la regla respaldan, `enContra` con los contradictorios
**o su ausencia explícita** («sin antecedentes en contra registrados»), y `faltante` con los
campos `discriminatorios` aún sin dato (la «información faltante para evaluarla» de US8-AC1) o su
ausencia explícita. Todo lleva chip de procedencia (FR-021) y un descargo fijo de
«apoyo a la decisión, no constituye diagnóstico definitivo» (FR-010 · US8-AC3 · SC-031: el modelo
de presentación no tiene ninguna vía de declararse definitivo y el descargo es constante siempre
presente).

*Alternativas rechazadas y justificadas contra el requisito* (Principio III):

| Alternativa | Por qué se rechaza |
|---|---|
| Generación con LLM (Edge Function + proveedor externo) | Prohibida por el contrato del cambio y por Principio III (dependencia + secreto nuevos); rompe el TDD determinista y hace no verificables SC-019/SC-030/SC-031 y FR-020 (la reconstrucción de un generador no es auditable). Es la decisión dura HD1 de 003 aplicada al mismo problema. |
| Solo candidaturas del veterinario (sin propuestas del sistema) | No satisface US8-AC1 ni FR-009: «el sistema presenta hipótesis con antecedentes a favor, en contra, información faltante y evidencia asociada» cuando el veterinario solicita apoyo. Las candidaturas propias se conservan como complemento (US8-AC9), no como mecanismo único. |
| Recuperación sola (003 propone «hipótesis» desde el corpus) | El contrato de 003 es extractivo: devuelve evidencia citada, no candidaturas diagnósticas con análisis a favor/en contra. Convertiría títulos de fragmentos en hipótesis sin análisis ni reconstrucción. |
| Motor de scoring/probabilidades o clustering sobre la anamnesis | Sin requisito que lo exija, umbrales opacos y resultados difícilmente reconstruibles (FR-020/US8-AC8 exigiría auditar el modelo). YAGNI: si la evaluación (SC-018) lo demanda, la pieza sustituible es `matchRegla`/`reglas.ts`, y el contrato de presentación no cambia. |

### D6. Puerta de suficiencia explícita (FR-022) antes de proponer hipótesis

`evaluateSuficiencia({ anamnesis, ficha })` es pura y precede a toda generación: con anamnesis
vacía o con menos campos estructurados cubiertos que `MIN_CAMPOS_SUFICIENCIA` (constante
transparente, default 3 de los campos de `AnamnesisField`), el resultado es
`{ estado: 'insuficiente', faltantes }` y el sistema **no propone ninguna hipótesis**: muestra el
aviso de información insuficiente nombrando los campos que discriminarían (caso límite «anamnesis
vacía» y US8-AC5: nunca hipótesis débilmente fundadas). Los `faltantes` combinan
`computeMissingFichaFields` con los campos de anamnesis del registro de sugerencias. El umbral es
una constante del módulo, ajustable con la evidencia del arnés de evaluación (D12) sin tocar el
contrato.

*Alternativa rechazada*: proponer siempre con grado de confianza — contradice US8-AC5 («en lugar
de proponer hipótesis débilmente fundadas») y empuja al veterinario a descartar ruido.

### D7. Ciclo de vida de la hipótesis: `decision` como única marca, `estado` derivado para la epicrisis

La hipótesis nace con `decision: 'added'` —el INSERT ya emite `hypothesis_added`, sea del sistema
al presentarla o del veterinario al agregarla— y transiciona a `accepted` o `discarded` por
UPDATE (el mapping emite `hypothesis_accepted`/`hypothesis_discarded`). Las transiciones
legales son `added → accepted|discarded`, `accepted ↔ discarded` (el veterinario puede reconsiderar
mientras la consulta siga abierta) y **ninguna hacia `added`**: una hipótesis presentada no deja
de haberlo estado, y su evento `hypothesis_added` es historia (decisión dura HD5). Al cerrar la
consulta, `guard_consultation_sealed` de 002 sella las filas: los estados quedan como fueron
considerados.

Para FR-049, `composeHipotesisConsideradas(rows)` deriva el vocabulario de la epicrisis de 002
(«propuesta, aceptada, descartada») del persistido: `added → 'propuesta'`, `accepted → 'aceptada'`,
`discarded → 'descartada'`, devolviendo `[{ texto, estado }]` — exactamente la forma del campo
`hipotesis` de `EpicrisisContent`. Un solo vocabulario persistido evita que dos estados se
desincronicen; el mapeo es una función pura unit-testeada.

*Alternativa rechazada*: persistir `estado` en español y mandar `decision` solo en el payload de
UPDATE — duplica el estado (dos fuentes de verdad para lo mismo) y obliga al trigger de 001 a
leer un campo que puede no estar persistido.

### D8. La base de las asistencias es inmutable en el servidor; la asistencia nunca es registro definitivo

Migración `013_asistencia_clinica.sql`: trigger `guard_assistance_decisions` (`BEFORE INSERT OR
UPDATE` sobre `clinical_records`, acotado a `record_type in ('missing_information','hypothesis')`).
Premisa de amenaza: la política T055 permite a **cualquier** veterinario activo de la clínica hacer
`UPDATE` directo por PostgREST sobre el contenido de filas no aprobadas; sin este trigger, un
cliente podría reescribir `insumos`/`respaldo` y hacer mentir la reconstrucción de FR-020, o
reescribir `pregunta`/`fundamento` tras registrar la decisión. Invariantes (todas con SQLSTATE
23514, patrón de 002/003):

| Transición | Regla | Error |
|---|---|---|
| INSERT de ambos tipos | `status = 'draft'` (la asistencia nunca nace como registro definitivo ni correctivo: FR-010) | `ASSISTANCE_STATUS_INVALID` |
| INSERT de `hypothesis` | `decision = 'added'` (nacer aceptado emitiría `hypothesis_added` mintiendo el contenido), `texto` no vacío y `origen` en enum | `HYPOTHESIS_DECISION_INVALID` / `ASSISTANCE_CONTENT_INVALID` |
| INSERT de `missing_information` | `estado` decidido en enum y `pregunta` no vacía | `MISSING_INFORMATION_STATE_INVALID` / `ASSISTANCE_CONTENT_INVALID` |
| INSERT de ambos tipos | el `consultationId` resuelve a una consulta cerrada | `CLINICAL_RECORD_SEALED` |
| UPDATE de ambos tipos | el `consultationId` de `old` resuelve a una consulta cerrada (sello sobre `old`, como 002) | `CLINICAL_RECORD_SEALED` |
| UPDATE de `hypothesis` | solo puede cambiar `decision` (comparación `new.content - 'decision' = old.content - 'decision'`): `texto`, `origen`, `reglaId`, `insumos`, `respaldo`, `consultationId` son base inmutable | `HYPOTHESIS_BASIS_IMMUTABLE` |
| UPDATE de `missing_information` | solo puede cambiar `estado`: `pregunta`, `suggestionKey`, `fundamento`, `camposRelacionados`, `consultationId` son base inmutable | `MISSING_INFORMATION_BASIS_IMMUTABLE` |
| UPDATE de `hypothesis` | transiciones de D7; volver a `added` | `HYPOTHESIS_DECISION_IRREVERSIBLE` / `HYPOTHESIS_DECISION_INVALID` |

Corregir la base de una hipótesis o de una decisión = crear una fila nueva (convención de HD3 de
003: la corrección es un registro adicional, no una reescritura). Heredado y **no duplicado**:
`consultationId` inmutable (002/009, `CONSULTATION_LINK_IMMUTABLE`), atribución inamovible y
`update (content)` como única concesión de actualización (001/004), aprobación solo por RPC y solo
de epicrisis (001): una hipótesis o sugerencia **no puede** convertirse jamás en `approved` — la
aserción correspondiente vive en la suite 012.

**Corrección de alcance sobre lo heredado (detectada en la suite 012, tarea 1.1)**: el sellado por
consulta cerrada NO hereda para estas entidades — `guard_consultation_sealed` (009) acota su sello
a `('anamnesis', 'diagnosis', 'epicrisis')`, el set de registros de trabajo que fija SC-009 de la
spec 002—. Por eso el trigger 013 implementa el sello de `missing_information`/`hypothesis` con la
misma semántica (evaluado sobre `old`, mismo error `CLINICAL_RECORD_SEALED`, alcance INSERT+UPDATE):
las decisiones de sugerencias e hipótesis son de la consulta en curso (supuesto de la spec 006) y el
conjunto de una consulta cerrada no crece ni se modifica.

### D9. Toda mutación cruza el contrato de atribución

Los servicios de `src/features/asistencia/` escriben solo vía `src/lib/attribution`
(`createClinicalRecord` para la fila de decisión o hipótesis; `updateClinicalContent` para las
transiciones de `decision`/`estado`), que rechaza `ATTRIBUTION_CONTROL_FIELDS` en la frontera y
devuelve `ClinicalMutationResult` con la atribución real releída de la traza (la acción enumerada
de FR-063 llega del evento que escribió el trigger, nunca de una suposición del cliente). Sin
segunda convención de mutación (patrón D9 de 002, contrato de
[atribución](../implementar-identidad-y-acceso/contracts/clinical-attribution.md)).

### D10. FR-049: composición pura propia y montaje mínimo como RI-1

`composeHipotesisConsideradas` (D7) vive en `src/features/asistencia/`; el campo `hipotesis` del
borrador de epicrisis lo puebla **002** en la generación de la epicrisis (FR-011 de 002 dejó el
campo vacío «para que lo pueble 006»). Como el borrador se arma en
`src/features/registro/epicrisis-draft.ts` y su flujo vive en
`src/app/(protected)/consultations/[id].tsx` —ambos archivos prohibidos para esta rama—, el
montaje es una edición mínima de orquestador (**RI-1**, ver Riesgos): pasar las hipótesis de la
consulta a `buildEpicrisisDraft` o fusionar `composeHipotesisConsideradas(...)` sobre su
resultado. Lo que esta rama garantiza y verifica es la disponibilidad y la forma exacta del campo
(US8-AC6: toda hipótesis figura con su estado).

### D11. Interfaz: una ruta propia con dos paneles, WCAG 2.2 AA, descargo y reconstrucción visibles

- `/support/consultations/[id]` (`src/app/(protected)/support/consultations/[id].tsx`), con los
  componentes de `src/components/asistencia/` (`panel-informacion-faltante`, `tarjeta-sugerencia`,
  `panel-soporte-diferencial`, `tarjeta-hipotesis`, `ver-respaldo`):
  - **Información faltante** (US7): sugerencias pendientes con su pregunta y su fundamento —
    cita con título y fragmento navegable al visor de 003 (`buildFragmentContext`) o etiqueta
    «criterio general» (FR-033 · US7-AC3/AC5) — y las acciones `Marcar como formulada` /
    `No aplicable` / `Ignorar`, cuya decisión queda registrada y visible (FR-008 · US7-AC2/AC6);
    lo ya cubierto no se propone (US7-AC4). Cada ítem muestra su procedencia (FR-021).
  - **Apoyo al diagnóstico diferencial** (US8): botón explícito «Solicitar apoyo diagnóstico»
    (la presentación ocurre cuando el veterinario lo solicita, US8-AC1); aviso de información
    insuficiente nombrando lo faltante (FR-022 · US8-AC5); tarjetas de hipótesis con origen
    (sistema/veterinario, US8-AC9), secciones a favor / en contra (con ausencia explícita) /
    faltante (SC-019), evidencia citada con el fragmento concreto (FR-007 · US8-AC10) o la
    declaración de ausencia de respaldo (FR-023 · US8-AC7 · SC-030), descargo constante «apoyo a
    la decisión, no diagnóstico definitivo» (FR-010 · US8-AC3 · SC-031), acciones
    `Aceptar` / `Descartar` / `Agregar hipótesis` (FR-029 · US8-AC2/AC9) y «Ver respaldo» con los
    antecedentes y fuentes que produjeron la hipótesis (FR-020 · US8-AC8). Cierra con el resumen
    «hipótesis consideradas» con sus estados (FR-049 · US8-AC6).
- Etiquetas programáticas, operación completa por teclado, foco visible y contraste del paletín
  vigente (WCAG 2.2 AA); `testID` estables. La entrada de navegación a `/support/**` desde
  `/home` y desde la consulta vive en archivos prohibidos: **RI-2** (ver Riesgos), con el diff
  mínimo (1–2 líneas por archivo) documentado en `quickstart.md`.

### D12. Sin dependencias nuevas; verificación por clúster scratch, CI y arnés de evaluación

Cero cambios en `package.json` (Principio III). Verificación SQL local en `/tmp/verify-006/`
(migraciones 001–013 y suites 001–012 sobre el shims del patrón de 002) y verificación oficial en
el job `database` de CI; pruebas de unidad con `bun test` localmente y de integración viva con
`SUPABASE_LIVE_TESTS=1` en CI. Sin Playwright propio (restricción de la rama; la compuerta de
accesibilidad la cubre 002): la interfaz se verifica con `bun run typecheck` y Biome sobre los
archivos propios, y la verificación visual y el e2e funcional de estas pantallas quedan como
**pendiente declarado** — incluida la ampliación de la compuerta axe/teclado a `/support/**`
(**RI-3**).

Además, `tests/fixtures/asistencia/casos-anotados.json` (casos sintéticos de anamnesis incompleta
con los antecedentes faltantes esperados y las hipótesis razonables anotadas) y el arnés
`tests/integration/asistencia/evaluacion.test.ts` ejercitan el mecanismo medible de SC-029
(señalamiento ≥ 70 % de los antecedentes faltantes esperados sobre el conjunto sintético) y las
invariantes de SC-019/SC-030/SC-031 sobre todas las salidas del arnés, imprimiendo sus métricas.
Es el sustituto provisional del conjunto del equipo clínico (supuesto de la spec, decisión dura
HD8): evidencia del mecanismo, **no** aceptación de los criterios.

## Seguimiento de complejidad (Principio III)

| Complejidad nueva | Justificación exigida por el requisito | Se elimina cuando |
|---|---|---|
| Trigger `guard_assistance_decisions` (013) | FR-020 (reconstrucción fiel), FR-010 (nunca registro definitivo) frente a la premisa T055 de escritura directa (D8) | Nunca mientras la spec exija reconstrucción y validación profesional |
| Registro de sugerencias (`reglas.ts`) | FR-008 (sugerir antecedentes) y FR-033 (fundamento por sugerencia) (D3/D4) | Si se sustituye por una fuente de reglas editable (HD9) |
| Registro de reglas de hipótesis + `matchRegla` | FR-009/US8-AC1 (el sistema presenta hipótesis con análisis) de forma determinista (D5) | Si se adopta un motor semántico (fuera del PoC), conservando el contrato de presentación |
| `evaluateSuficiencia` + `MIN_CAMPOS_SUFICIENCIA` | FR-022/US8-AC5 (declarar insuficiencia antes que proponer débilmente) (D6) | Nunca mientras la spec exija el aviso |
| `composeHipotesisConsideradas` | FR-049/US8-AC6 (hipótesis + estado en la epicrisis) (D7/D10) | No aplica |
| Tope `MAX_HIPOTESIS_PRESENTADAS` (3) | Presupuesto de generación verificable (abajo): acota las consultas a 003 | Si se acepta latencia mayor por más candidatas |
| Arnés de evaluación + casos anotados | SC-029 mecanismo medible y invariantes SC-019/030/031 (D12) | Al aceptar con el conjunto del equipo clínico, se reemplazan los fixtures |

Dependencias de ejecución nuevas: **ninguna**. Capas arquitectónicas nuevas: **ninguna**
(`features/asistencia` y `components/asistencia` sobre los patrones de `features/registro`,
`features/conocimiento` y `lib/attribution`). Archivos compartidos modificados: **ninguno**
(RI-1/RI-2 quedan para el orquestador).

## Presupuestos de rendimiento (verificables antes de integrar)

| Operación | Presupuesto | Cómo se verifica |
|---|---|---|
| Detección de sugerencias (ficha + ≤ 50 entradas de anamnesis, registro ≤ 20) | ≤ 100 ms CPU cliente | temporización laxa en `tests/unit/asistencia/deteccion.test.ts` (2.2) |
| Composición de soporte diferencial (≤ 3 hipótesis, respaldo 003 ≤ 25 candidatos) | ≤ 300 ms CPU cliente | temporización laxa en `tests/unit/asistencia/soporte-diferencial.test.ts` (2.3) |
| Resolución de fundamento (1 recuperación de 003 por sugerencia, ≤ 8 sugerencias) | ≤ 500 ms por recuperación | aserción de tiempo en `tests/integration/asistencia/asistencia.test.ts` (3.1) |
| Generación completa de soporte (suficiencia + reglas + ≤ 3 consultas a 003 + composición + persistencia) | ≤ 8 s | aserción de tiempo en `tests/integration/asistencia/hipotesis.test.ts` (3.2) |
| Decidir sugerencia o hipótesis (escritura) | ≤ 2 s por operación | aserciones de tiempo en 3.1 y 3.2 |

SC-017, SC-018, SC-029 y SC-031 en su alcance de evaluación humana son medición con especialistas
y casos clínicos: quedan como **pendiente de aceptación**, no como verificados (el arnés de D12
acredita el mecanismo de SC-029 y las invariantes de SC-019/SC-030/SC-031 por construcción).

## Verificación de principios constitucionales

- **I (especificación primero)**: este diseño y `tasks.md` preceden a cualquier código; todo
  cambio de comportamiento pasa primero por la spec (`openspec-update-change`).
- **II (pruebas primero)**: cada grupo de `tasks.md` abre con sus pruebas en rojo —pgTap y
  integración viva observadas en `/tmp/verify-006/` y en CI (URLs en `quickstart.md`), unidad
  local— fallando por la razón prevista antes de implementar.
- **III (simplicidad/YAGNI)**: sin dependencias ni capas nuevas; complejidad justificada arriba;
  generación con LLM, motor de scoring y «solo candidaturas del veterinario» rechazados por
  escrito (D5).
- **IV (observabilidad)**: los servicios emiten `logEvent` con `requestId` y
  `captureClientError` en fallos; la generación de soporte registra operación, duración y
  conteos; las acciones clínicas quedan en `clinical_audit_events` por los triggers de 001;
  ninguna excepción silenciada.
- **V (seguridad)**: RLS y triggers del servidor siguen siendo el control; el trigger 013
  inmoviliza la base de las asistencias frente a la escritura directa (D8); Zod valida cada
  frontera; ningún campo de atribución aceptado del cliente; sin secretos nuevos.
- **Accesibilidad web (WCAG 2.2 AA)**: etiquetas programáticas, operación por teclado, foco visible
  y contraste en todas las superficies nuevas (D11); la compuerta automatizada axe/teclado sobre
  `/support/**` queda como RI-3 y la verificación visual como pendiente declarado (D12).

## Migration Plan

Una única migración aditiva `supabase/migrations/013_asistencia_clinica.sql`: la función y el
trigger `guard_assistance_decisions` (D8). Sin DDL sobre tablas, sin cambios en la enumeración de
FR-063 y sin grants nuevos (`update (content)` de 004 basta para las transiciones de
`decision`/`estado`): `supabase gen types` debe confirmarse sin diff sobre
`src/lib/supabase/database.types.ts` (comportamiento que 002 verificó para su trigger puro; si
apareciera diff, se reporta como RI y no se toca el archivo). Rollback = revertir el commit (no
hay datos que migrar). Las suites 001–009 (tras el merge de 003) deben seguir verdes con la 013
aplicada; las suites de las ramas hermanas se verifican en la integración del orquestador.

## Risks / Trade-offs

- **[RI-1] Montaje de «hipótesis consideradas» en la epicrisis (FR-049)** → el campo se puebla en
  el flujo de 002 (`src/features/registro/epicrisis-draft.ts` o
  `src/app/(protected)/consultations/[id].tsx`), archivos prohibidos. Mitigación: esta rama
  entrega `composeHipotesisConsideradas` con la forma exacta `[{ texto, estado }]` y su prueba;
  la edición mínima (llamada/fusión de 1–2 líneas, con diff propuesto en `quickstart.md`) la
  ejecuta el orquestador. Sin ella, US8-AC6 queda **pendiente de integración**, no cumplida.
- **[RI-2] Entrada de navegación a `/support/**`** → `/home` y el workspace de consulta son
  archivos prohibidos; sin el enlace (1–2 líneas por archivo), la ruta es accesible solo por URL.
  Mitigación: diff propuesto documentado; coordinación por hub con las ramas hermanas antes de
  que el orquestador aplique.
- **[RI-3] Compuerta de accesibilidad y e2e de `/support/**`** → esta rama no escribe
  Playwright; la compuerta axe/teclado/viewport de 002 no cubre las pantallas nuevas. Mitigación:
  WCAG 2.2 AA por diseño (D11), typecheck + lint, y pendiente declarado para la ampliación de
  `tests/e2e/web/accessibility.spec.ts` que ejecutará el orquestador.
- **Reglas léxicas sobre texto libre (D5/D3)** → falsos positivos/negativos del matcheo de
  términos (una anamnesis que cubre un antecedente con léxico no previsto puede recibir la
  pregunta, o una regla puede no dispararse). Mitigación: transparencia total (los `terminosMatch`
  y las referencias son visibles en «ver respaldo», FR-020), umbrales y registros en constantes
  ajustables, y medición con el arnés (SC-029) y el panel (SC-017/SC-018). La detección semántica
  queda fuera del PoC (mismo coste declarado que HD2/HD6 de 003).
- **Umbral `MIN_CAMPOS_SUFICIENCIA` (D6)** → un valor mal calibrado declara insuficiencia con
  anamnesis suficiente (falso negativo de US8-AC1) o propone con poco (US8-AC5). Mitigación:
  constante única con default documentado (3), ajustada con la evidencia del arnés; el contrato
  de salida no cambia con el valor.
- **Contradicción solo por términos (D5)** → el caso límite «antecedentes contradictorios» se
  refleja cuando los términos opuestos matchean, sin detección semántica de contradicción:
  conservador (nunca se elige una rama en silencio) pero limitado. Documentado.
- **`jsonb` sin FK (D1)** → referencias huérfanas posibles si se escribe fuera de los servicios
  (`consultationId`, `recordId`, `knowledgeQueryId`). Mitigación: servicios únicos de escritura,
  trigger 013 (la base no se reescribe) y pruebas de integración; el mismo coste ya aceptado por
  002 y 003.
- **Dependencia del contrato final de 003 (D5)** → el diseño de 003 declara `KnowledgeAnswer`,
  `consultKnowledge` y `buildFragmentContext`; si el código mergeado difiere en firmas, la
  adaptación se hace **dentro de los archivos propios** (nunca editando 003) y se documenta en
  `quickstart.md`.
- **SC-017/SC-018 (panel de ≥ 3 especialistas sobre ≥ 5 casos) y SC-029 sobre el conjunto del
  equipo clínico** → dependencias externas: no se afirman como cumplidos; el arnés sintético
  acredita solo el mecanismo.
- **SC-019/SC-030/SC-031** → verificables por construcción y por pruebas (toda hipótesis lleva
  las tres secciones con ausencias explícitas; toda ausencia de respaldo se declara; el modelo no
  puede declararse definitivo); su lectura clínica final requiere la evaluación humana pendiente.
- **Ciclos TDD lentos para SQL** (rojo/verde por clúster scratch y CI) → suites pequeñas y
  enfocadas; URLs de ejecución como evidencia.

### Decisiones duras (reversibles por el usuario)

| # | Decisión (default elegido) | Alternativa | Qué cambia si se invierte |
|---|---|---|---|
| HD1 | **Sin modelos generativos ni scoring**: reglas deterministas transparentes + respaldo por recuperación de 003 (D5) | LLM en Edge Function con proveedor externo | Nueva función Edge + secreto + validación de anclaje de citas; el contrato de presentación y la reconstrucción se conservan, pero SC-019/SC-030/SC-031 y FR-020 dejan de ser verificables por construcción y exigen auditoría por afirmación |
| HD2 | Entidades en **`clinical_records`** con el enum existente de FR-063 (D1) | Tablas propias `missing_information`/`hypothesis` | Duplica atribución/traza/grants y exige regenerar `database.types.ts` (RI nueva); el mapping de 001 quedaría sin uso |
| HD3 | La fila `missing_information` **es la decisión**; `pendiente` es derivado (D3) | Fila por sugerencia propuesta con estado `pendiente` | El INSERT emitiría `missing_information_decided` al proponer; hay que persistir lo derivable y redefinir la acción |
| HD4 | **`decision` (added/accepted/discarded) como única marca persistida**; `estado` (propuesta/aceptada/descartada) derivado para la epicrisis (D7) | Persistir ambos vocabularios | Dos fuentes de verdad para el estado; el mapping de 001 sigue exigiendo `content->>'decision'` |
| HD5 | **`added` es irreversible** (aceptar ↔ descartar reversible) (D7) | Permitir volver a «sin decidir» | Amplía el trigger 013 y la suite 012; el evento `hypothesis_added` ya registrado no se borra de la traza |
| HD6 | **Base inmutable server-side** de sugerencias e hipótesis; corregir = fila nueva (D8) | Editar la base con historia (como `provenanceHistory` de 002) | Amplía el trigger y exige definir la historia de la reconstrucción; FR-020 deja de ser fiel por construcción |
| HD7 | **`MIN_CAMPOS_SUFICIENCIA = 3`** y `MAX_HIPOTESIS_PRESENTADAS = 3` como constantes (D6/D12) | Otros umbrales o sin tope | Solo cambian constantes y los presupuestos asociados; ningún contrato se mueve |
| HD8 | **Casos anotados sintéticos** como sustituto provisional del conjunto del equipo clínico (D12) | Esperar al conjunto clínico real | Reemplazo de fixtures; el arnés y su formato se conservan |
| HD9 | Reglas de sugerencias e hipótesis **en código** (`reglas.ts`) | Tabla editable de reglas en la base | Nueva tabla + UI de edición + migración; se justificaría si el equipo clínico exige editar sin despliegue |

## Open Questions

Ninguna cambia el enfoque, la spec ni el desglose de tareas; todas tienen default documentado arriba:

1. **Calibración de los umbrales** (HD7): ¿`MIN_CAMPOS_SUFICIENCIA = 3` y tope de 3 hipótesis
  bastan para la pertinencia que mide SC-017? Default: esos valores, ajustables con las métricas
  del arnés y la evaluación del panel.
2. **Reconsideración de decisiones** (HD5): ¿el flujo clínico exigirá volver una hipótesis a «sin
  decidir» o editar la base de una sugerencia? Default: no; aceptar ↔ descartar y fila nueva para
  correcciones.
3. **Firma del conjunto anotado del equipo clínico** (HD8): ¿adoptará el formato de
  `tests/fixtures/asistencia/casos-anotados.json` (caso + antecedentes faltantes esperados +
  hipótesis razonables)? Default: ese formato provisional.
4. **Agenda de la aceptación humana** (SC-017/SC-018 con el panel, SC-029 con el conjunto real,
  SC-031 en lectura clínica): pendiente externo al cambio, declarado en `quickstart.md`.
