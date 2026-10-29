# Diseño de implementación: Apoyo al tratamiento y farmacología

**Fecha**: 2026-09-22 | **Especificación**: [apoyo-tratamiento-farmacologia](specs/apoyo-tratamiento-farmacologia/spec.md)

**Entrada**: propuesta y especificación del cambio; [identidad y acceso](../implementar-identidad-y-acceso/design.md),
[registro clínico longitudinal](../implementar-registro-clinico-longitudinal/design.md),
[base de conocimiento trazable](../implementar-base-conocimiento-trazable/design.md) y
[asistencia clínica proactiva](../implementar-asistencia-clinica-proactiva/design.md) como
dependencias de construcción (001 está endurecida en `main`; 002 está parcialmente implementada en
esta rama; 003 y 006 se reciben completas con el merge de `feat/006-asistencia-clinica-proactiva`
en la fase de implementación). Este diseño se aprueba antes de `tasks.md`; su implementación sigue
el Rojo-Verde-Refactor obligatorio.

**Principio rector de esta funcionalidad (brief §11.6 — «No prescripción autónoma»)**: ninguna
recomendación farmacológica se convierte automáticamente en prescripción. Toda dosis es
información para validación profesional (FR-035), la adopción de cada fármaco es una acción
explícita e individual del veterinario atribuida a su identidad autenticada (FR-036 · FR-063) y las
sugerencias no adoptadas nunca llegan a la epicrisis como prescritas (FR-058). Todo diseño de este
documento se lee bajo ese principio: donde una alternativa de implementación haga posible —aunque
sea por error de cliente— que una sugerencia se registre sin adopción explícita, esa alternativa se
rechaza.

## Context

Las capas de las que depende este cambio ya existen o llegan con el merge de 006:

- **Atribución y traza (001/002, endurecidas)**: `public.clinical_records` (polimórfica:
  `record_type`, `content jsonb`, `status` en `draft|approved|corrective`, `supersedes_event_id`,
  columnas de atribución fijadas por el servidor) y `public.clinical_audit_events` con la
  enumeración taxativa de FR-063, que **ya tipifica las entidades de esta funcionalidad**:
  `entity_type` `pharmacological_treatment` y `non_pharmacological_treatment`, acciones
  `pharmacological_treatment_adopted` y `non_pharmacological_treatment_adopted`
  (`supabase/migrations/003_attribution_hardening.sql`). El mapping `clinical_record_action` resuelve
  para ambos tipos **`INSERT` y `UPDATE`** a la acción `_adopted` (hecho determinante para D1 y D7:
  un `UPDATE` sobre una fila de tratamiento emitiría un segundo evento «adoptado» falso) y
  `status = 'corrective'` siempre a `corrective_record_created`.
- **Endurecimiento de escritura (001/002/006)**: grants `update (content)` como única concesión de
  actualización, aprobación solo por la RPC `approve_clinical_record` (que rechaza todo
  `record_type` que no sea `epicrisis`), política T055 (cualquier veterinario activo de la clínica
  edita filas no aprobadas — premisa de amenaza de D7) y triggers `deny_attribution_mutation`,
  `stamp_update_attribution`, `guard_approved_clinical_record`, `guard_consultation_sealed` (D5 de
  002: sella todo fila cuyo `content->>'consultationId'` resuelva a una consulta cerrada e
  inmoviliza el vínculo) y `audit_clinical_record`.
- **Contratos de cliente**: `src/lib/attribution/clinical-mutations.ts` (`createClinicalRecord`,
  `updateClinicalContent`, `approveClinicalRecord`, `createCorrectiveRecord`; guardas
  `ATTRIBUTION_CONTROL_FIELDS`; respuesta `ClinicalMutationResult` con la atribución real releída de
  la traza — [contrato de atribución](../implementar-identidad-y-acceso/contracts/clinical-attribution.md)),
  `src/features/registro/schema.ts` (`PatientContent`, `EpicrisisContent` cuyo campo
  **`medicamentosAprobados` es `string[]`** y quedó vacío a propósito —«los poblán las specs 006 y
  007»—, vocabulario `Provenance` de FR-021), `src/features/registro/summaries.ts`
  (`computeMissingFichaFields`: «sin dato» ≠ «hallazgo negativo», FR-044),
  `src/features/registro/ficha-service.ts` (`getPatient`),
  `src/features/registro/epicrisis-draft.ts` (`buildEpicrisisDraft`, archivo compartido), y las
  acciones enumeradas `pharmacological_treatment_adopted` /
  `non_pharmacological_treatment_adopted` que la convención FR-063 reserva exactamente para estas
  entidades.
- **Base de conocimiento (003, contratos declarados en su diseño; llegan con el merge)**:
  `knowledge_documents` (fuentes inmutables salvo retirada), `knowledge_queries` (append-only),
  `search_knowledge_fragments` (recuperación léxica española con cobertura de lemas),
  `consultKnowledge`/`getQuery` (composición y persistencia de respuestas) y el contrato de
  respuesta `KnowledgeAnswer` de su D5, con la **cita documento+fragmento**
  `Cita = { documentoId, ordinal, textoCitado }` (texto verbatim), el vocabulario de `avisos`
  (`sin_respaldo_documental`, `cobertura_parcial`, `fuentes_multiples`, `fuente_retirada`) y
  `buildFragmentContext` (fragmento citado en su contexto, US9-AC14).
- **Asistencia clínica (006, contratos declarados en su diseño; llegan con el merge)**: filas
  `record_type = 'hypothesis'` con `content` `{ consultationId, texto, decision, origen, reglaId,
  insumos, respaldo }` (D2 de 006) y la composición pura `composeHipotesisConsideradas(rows)` que
  deriva `[{ texto, estado }]` («propuesta, aceptada, descartada») — el vocabulario de hipótesis que
  este cambio consume como contexto de la sugerencia terapéutica (US9-AC1) y que 006 ya monta en el
  campo `hipotesis` de la epicrisis (D10/RI-1 de 006).

Restricciones de esta ejecución y de la coordinación entre ramas hermanas:

- Archivos compartidos **prohibidos** (no se tocan; se consumen como contratos):
  `src/lib/attribution/*`, `src/lib/storage/*`, `src/lib/supabase/*`, `src/features/registro/*`,
  `src/features/conocimiento/*`, `src/features/asistencia/*`,
  `src/app/(protected)/consultations/[id].tsx`, `src/app/(protected)/home.tsx`,
  `supabase/migrations/001-013*`, `supabase/tests/001-012*`, `supabase/seed.sql`. Toda necesidad de
  editarlos se reporta como requisito de integración (RI-1…RI-4, ver Riesgos).
- Números propios: migración `supabase/migrations/014_apoyo_tratamiento.sql`, suite pgTap
  `supabase/tests/013_apoyo_tratamiento.sql`, código en `src/features/tratamiento/**` y
  `src/components/tratamiento/**`, rutas propias en `src/app/(protected)/treatment/**`, pruebas en
  `tests/unit/tratamiento/**` e `tests/integration/tratamiento/**` con fixtures en
  `tests/fixtures/tratamiento/`.
- Verificación SQL local con clúster PostgreSQL scratch + shims (roles de API, `auth.users`,
  `auth.uid()`, `auth.jwt()`, pgtap) en `/tmp/verify-007/` — el patrón documentado en el
  [quickstart de 002](../implementar-registro-clinico-longitudinal/quickstart.md) —; nunca
  `supabase start` (las ramas hermanas compiten por puertos). La verificación oficial vive en el
  job `database` de CI (suites pgTap + `SUPABASE_LIVE_TESTS=1`). Sin Playwright en esta rama (la
  compuerta de accesibilidad web la cubre 002; ver D12 y RI-4).
- Cero dependencias nuevas ni modelos generativos (Principio III y contrato del cambio). Artefactos
  y respuestas en español; identificadores en inglés; claves de `content` en camelCase.
- **Corpus y sustancias**: el corpus sintético de 003 es la base documental; el conjunto acotado de
  fármacos de demostración vive en fixtures propios (D11, HD6/HD9). Decisiones duras al final del
  documento para que el usuario pueda cambiarlas.

Motivación y alcance de producto: ver `proposal.md - Why` y la spec; aquí solo se decide el *cómo*.

## Goals / Non-Goals

**Goals:**

- Alternativas de manejo no farmacológico (conductual, ambiental, seguimiento, exámenes
  complementarios) con respaldo citado o declaración explícita de ausencia de respaldo (FR-034,
  FR-023, FR-007, SC-034), adoptables como acción atribuida (`non_pharmacological_treatment_adopted`).
- Propuestas farmacológicas con identificación, justificación sobre datos del paciente, dosis
  siempre rotulada para validación profesional y restricciones (contraindicaciones/interacciones del
  conjunto acotado de fuentes) como advertencias citadas y verificables (FR-019, FR-035, FR-037,
  FR-046, FR-038, SC-006, SC-020, SC-032).
- Adopción individual y atribuida de cada fármaco (`pharmacological_treatment_adopted`) con
  snapshot de las advertencias visibles en el momento de aprobar (FR-036, FR-063, SC-021, SC-033);
  sin prescripción autónoma bajo ninguna vía (brief §11.6, FR-010).
- `composeMedicamentosAprobados` propio para FR-058/SC-038: solo los fármacos individualmente
  adoptados llegan a `medicamentosAprobados` de la epicrisis; aprobar la epicrisis nunca adopta
  fármacos. Requisito de integración RI-1 para el montaje mínimo en el flujo de 002.
- Reconstrucción posterior de qué datos del paciente y qué fuentes produjeron cada recomendación
  terapéutica entregada (FR-020, US9-AC10), con el fragmento concreto visible (FR-007, US9-AC14).

**Non-Goals:**

- Prescripción automática, emisión de receta legal, integración con laboratorios o recetas
  electrónicas (supuestos de la spec), ni dispensación/farmacia.
- Generación de lenguaje natural, modelos generativos, scoring probabilístico ni aprendizaje de las
  decisiones del veterinario (Principio III; decisiones duras HD5).
- Conocimiento farmacológico más allá de lo que las fuentes documenten (supuesto de la spec): el
  sistema advierte lo documentado, no inventa farmacología; sin cobertura no hay sugerencia
  farmacológica (FR-046).
- Modificación de los contratos de 001/002/003/006: se consumen tal cual; una necesidad de cambio
  en ellos es RI, no una edición de esta rama.
- Transiciones posteriores del tratamiento adoptado (suspensión, titulación, retirada): fuera del
  alcance de la spec (HD10); la corrección de lo aprobado sigue siendo la epicrisis correctiva de
  002.
- Listado de sugerencias no adoptadas dentro de la epicrisis (lectura de «si acaso» en FR-058 como
  opcional, HD8) y población de `intervencionesPropuestas` de la epicrisis (contrato de 002).
- e2e web propio con Playwright y verificación visual en esta ejecución (D12): quedan como
  pendientes declarados.

## Decisions

### D1. Las adopciones de tratamiento son filas de `clinical_records` con el enum de FR-063 existente; el `INSERT` ES la adopción

Un fármaco adoptado es una fila `record_type = 'pharmacological_treatment'` y una alternativa de
manejo adoptada es una fila `record_type = 'non_pharmacological_treatment'`, ambas con
`status = 'draft'` y el detalle en `content jsonb` (D2). El mapping `clinical_record_action`
existente emite para su `INSERT` exactamente las acciones que la spec exige registrar
(`pharmacological_treatment_adopted`, `non_pharmacological_treatment_adopted`): **la creación de la
fila es la adopción profesional** y su `created_by` es el veterinario que adopta (FR-036 · FR-063 ·
US9-AC6/AC7). No se extiende el enum (el contrato del cambio reutiliza la convención).

*Por qué no tablas propias* (como las de 003): el enum de FR-063 tipifica estas entidades como
acciones clínicas atribuidas; unas tablas nuevas duplicarían atribución, traza y grants, dejarían
sin uso el mapping y exigirían regenerar `src/lib/supabase/database.types.ts` (archivo compartido
prohibido). Con este diseño la migración 014 no cambia el esquema de tipos de tablas del cliente
salvo por la tabla de registro de D4 (ver RI-2) y hereda sin duplicar: atribución sellada,
sellado por consulta cerrada (`guard_consultation_sealed` resuelve por `content->>'consultationId'`,
que estas filas llevan) e inmutabilidad de lo aprobado.

*Coste aceptado*: integridad referencial dentro de `jsonb` (`consultationId`) sin FK — el mismo
coste que asumieron 002 (D1/D6), 003 (D6) y 006 (D1). Mitigación: servicios únicos de escritura,
trigger de D7 y pruebas de integración.

### D2. Forma del contenido por entidad (claves camelCase, Zod en cada frontera)

| `record_type` | `content` |
|---|---|
| `pharmacological_treatment` | `{ consultationId, drugId, nombre, principioActivo, dosis: Dosis, justificacion: string, advertenciasVisibles: Advertencia[], respaldo: { citas: Cita[] }, insumos: Insumos }` |
| `non_pharmacological_treatment` | `{ consultationId, tipo: 'conductual' \| 'ambiental' \| 'seguimiento' \| 'examen_complementario', descripcion: string, respaldo: { kind: 'fuente', citas: Cita[] } \| { kind: 'sin_respaldo' }, insumos: Insumos }` |

- `Insumos = { hipotesis: [{ texto, estado }], ficha: [{ fichaRef, valor }] }` — la reconstrucción
  de FR-020 (qué datos del paciente y qué hipótesis produjeron la recomendación), con la forma de
  los `insumos` de 006 (D2) y `fichaRef` sobre las claves de `PatientContent` (p. ej.
  `weightKg`, `antecedentes.knownAllergies`).
- `Advertencia = { kind: 'contraindicacion' | 'interaccion' | 'informacion_faltante' | 'fuera_de_rango', texto: string, cita?: Cita, campo?: string }` —
  las restricciones documentadas llevan `cita` verificable (FR-037: «las que las fuentes
  documenten»); `informacion_faltante` lleva `campo` (FR-038) y no lleva cita porque declara un
  vacío, no una afirmación. `advertenciasVisibles` es el **snapshot exacto** de lo mostrado al
  adoptar (SC-033 · US9-AC13).
- `Dosis` (D6) es una de tres formas:
  `{ kind: 'calculada', texto, dentroDeRango, calculo: { pesoKg, rangoMgKg: { min, max }, totalMg: { min, max } }, rango: RangoDosis }`,
  `{ kind: 'citada', texto, dentroDeRango, cita: Cita, rango: RangoDosis | null }` o
  `{ kind: 'sin_rango_documentado', declaracion: string }` (FR-046 · US9-AC18).
- `Cita` es la cita documento+fragmento de 003 (`{ documentoId, ordinal, textoCitado }`, texto
  verbatim): una cita hacia una fuente posteriormente retirada sigue resolviéndose (convención
  `fuente_retirada` de 003). Para fármacos, `respaldo.citas` es **no vacío** por esquema (FR-019:
  una sugerencia farmacológica sin fuente citable no se presenta).
- Toda frontera de entrada valida con Zod (Principio V): fixtures, filas leídas y payloads de
  mutación.

### D3. Las propuestas viven fuera de `clinical_records`; solo la adopción se persiste como registro clínico

`buildApoyoTratamiento` (D5) compone las propuestas sobre la marcha y **no** las escribe en
`clinical_records`: una fila de `pharmacological_treatment` solo puede nacer de la acción explícita
de adopción del veterinario (D1/D7). Así SC-021 y SC-038 se cumplen **por construcción**: no existe
ninguna vía —ni de UI, ni de servicio, ni de trigger— por la que una sugerencia no adoptada emita
`pharmacological_treatment_adopted` o figure como prescrita, y aprobar la epicrisis (RPC que solo
toca filas `epicrisis`) es incapaz de crear tratamientos.

*Alternativa rechazada*: persistir la sugerencia con un `estado` interno («propuesta») en una fila
de `clinical_records`. Rechazada porque el mapping existente emite `pharmacological_treatment_adopted`
en **todo** `INSERT` de ese `record_type` (sin ramificación por contenido, a diferencia de
`hypothesis`): la traza registraría «adoptado» por el mero hecho de proponer, que es exactamente lo
que FR-036/SC-021 prohíben. Cambiar el mapping exigiría editar la migración 003 (archivo
compartido prohibido) y extender la enumeración de FR-063.

*Alternativa rechazada*: generación con LLM (Edge Function + proveedor externo) para las
propuestas. Prohibida por el contrato del cambio y por Principio III (dependencia + secreto
nuevos); rompe el TDD determinista y hace no verificables SC-006/SC-020/SC-032/SC-033 (la
reconstrucción de un generador no es auditable). Es la decisión dura HD1 de 003 aplicada al mismo
problema (HD5).

### D4. `treatment_queries`: registro append-only de cada generación de propuestas (FR-020)

Tabla nueva en la migración 014, al modo de `knowledge_queries` de 003 (D6):

| Columna | Forma |
|---|---|
| `id` | `uuid` pk |
| `consultation_id` | `uuid` FK a `clinical_records(id)` |
| `patient_id` | `uuid` FK a `clinical_records(id)`, anulable |
| `request` | `jsonb` — contexto de la solicitud (hipótesis consideradas, snapshot de los campos de ficha usados) |
| `answer` | `jsonb` — `ApoyoTratamiento` completo compuesto (alternativas, propuestas farmacológicas con `insumos`/`respaldo`/`advertencias`, avisos) |
| `created_at` | `timestamptz` |

Solo `grant select, insert` (sin `update`/`delete` ni sus políticas): la traza de qué se entregó y
sobre qué datos no es reescribible. Cada ejecución de `solicitarApoyoTratamiento` persiste una
fila: es la fuente de verdad de FR-020 para **toda** recomendación entregada —también las nunca
adoptadas—, y el material de revisión de SC-006/SC-034 (qué se mostró realmente).

*Alternativa rechazada*: no persistir las generaciones y reconstruir solo lo adoptado (el contenido
de la fila adoptada lleva `insumos`/`respaldo`). Rechazada porque US9-AC10 dice «una recomendación
terapéutica ya entregada», no «una recomendación adoptada»: sin este registro, una sugerencia
entregada y no adoptada sería irreconstruible y FR-020 quedaría a medias.

Sin columnas de atribución: la spec exceptúa las consultas al asistente de la atribución (solo las
decisiones clínicas exigen FR-063, que aquí son las adopciones de D1). *Alternativa*: columna
`requested_by`; queda como decisión dura reversible (HD5 del mismo tenor en 003).

### D5. Composición determinista: catálogo cerrado de propuestas + respaldo documental de 003

`buildApoyoTratamiento({ consulta, hipotesis, ficha, catalogo, respaldos })` es una función pura que
**nunca genera texto clínico libre**: toda afirmación clínica presentada es o bien una cita
verbatim de un fragmento (003) o bien una entrada estructurada del catálogo terapéutico (D11) cuyos
hechos (indicación, rango de dosis, contraindicaciones, interacciones) llevan su `Cita`. El flujo:

1. **Contexto de hipótesis** (US9-AC1): las filas `hypothesis` de la consulta se leen con los
   contratos de 006 y se derivan con `composeHipotesisConsideradas` a `[{ texto, estado }]`; cada
   propuesta referencia las hipótesis que atiende (`insumos.hipotesis`). Sin hipótesis registradas
   el resultado declara `sin_hipotesis_registradas` y no presenta propuestas del catálogo (el
   escenario presupone hipótesis; la hipótesis final la registra el veterinario por 002/006).
2. **Selección por reglas transparentes**: cada entrada del catálogo declara `paraHipotesis`
   (términos comparados sin distinguir mayúsculas ni acentos, patrón `matchRegla` de 006) sobre los
   textos de las hipótesis; los `terminosMatch` y las referencias forman parte de la
   reconstrucción (FR-020).
3. **Alternativas no farmacológicas** (FR-034): cada entrada declara su `consultaRecuperacion`, que
   se resuelve con la recuperación de 003 (`consultKnowledge`): si hay fragmentos que califican, el
   respaldo es `{ kind: 'fuente', citas }` con el fragmento concreto verificable (FR-007); si no,
   `respaldo = { kind: 'sin_respaldo' }` y la presentación declara explícitamente la **ausencia de
   respaldo documental** con el límite de alcance de la colección (FR-023 · US9-AC8 · SC-034, en el
   vocabulario de `avisos` de 003). *Nunca* se muestra una cita que no exista ni se disfraza de
   fuente la ausencia.
4. **Propuestas farmacológicas** (FR-019/FR-046): solo de fármacos del catálogo con cobertura
   documental (las citas de su ficha son el «conjunto acotado de fuentes»): identificación,
   justificación que referencia los datos concretos del paciente usados (US9-AC15), dosis (D6),
   advertencias (D6) y citas. Un fármaco sin cobertura en las fuentes **no se sugiere jamás** y, si
   un fármaco del catálogo es pertinente pero carece de rango de dosis documentado, se declara la
   ausencia de rango en lugar de proponer dosis (FR-046 · US9-AC18). FR-023 no admite esta vía para
   fármacos (nota de la spec): sin fuente citable, no hay propuesta farmacológica.
5. **Avisos y separación de procedencia** (FR-021, FR-022): segmentos con chip de procedencia
   reutilizando `Provenance` de 002 (`recuperada` para evidencia citada, `reportada`/`desconocida`
   para datos de ficha, `inferida` solo para derivaciones propias del sistema como la cobertura y
   los `terminosMatch`), e `informacionFaltante` nombrando los campos (FR-038).

*Alternativas rechazadas y justificadas contra el requisito* (Principio III):

| Alternativa | Por qué se rechaza |
|---|---|
| Generación con LLM / scoring probabilístico | Ver D3: dependencias nuevas, TDD no determinista, SC-006/020/032/033/034 no verificables (HD5). |
| Presentar fármacos solo si la recuperación léxica de 003 los encuentra (sin catálogo) | Un falso negativo del matcheo léxico (riesgo conocido de 003/006) **descartaría fármacos con ficha documentada**, violando FR-046 por el lado de la cobertura y haciendo frágil SC-020. La cobertura se prueba con la `Cita` de la ficha (verbatim, resoluble), no con el azar de una consulta. |
| Extraer fármacos de los fragmentos recuperados («lo que menciona el corpus») | Convertiría menciones de prosa en propuestas de dosis sin estructura de rango ni restricciones; irreconstruible y no verificable (FR-035/FR-037/FR-020). |
| Base de fármacos editable en tablas + UI de edición | Nueva tabla + UI + migración sin requisito actual (YAGNI); el catálogo cerrado de D11 basta para el PoC. Queda como reversibilidad de HD4. |

### D6. Dosis y restricciones: rótulo incondicional, rango documentado o declaración, advertencias citadas

- **Rotulación (FR-035 · SC-006 · US9-AC4/AC19)**: toda dosis presentada por el sistema —calculada
  o citada literalmente— aparece junto a la constante `ROTULO_VALIDACION_PROFESIONAL`
  («información para validación profesional»), incluida la que compone `composeMedicamentosAprobados`
  para la epicrisis (HD7: FR-035 es incondicional —«toda dosis que el sistema presente»— y la
  cadena de la epicrisis la compone el sistema).
- **Cálculo (FR-046 · US9-AC18)**: `computeDosis` solo produce dosis a partir de un rango
  documentado (`RangoDosis = { minMgKg, maxMgKg, via, frecuencia, maxAbsolutoMg: number | null }`
  del catálogo, con su `Cita`): `calculada` = rango × peso registrado (total mg min–max, con tope
  absoluto opcional); `citada` = texto literal de un fragmento con su `Cita`. Sin rango documentado,
  la forma es `sin_rango_documentado` con su declaración explícita: **nunca** una dosis inventada ni
  un valor por defecto.
- **Fuera de rango (US9-AC9)**: `dentroDeRango = false` cuando el total calculado excede el tope
  absoluto o la dosis citada cae fuera del rango documentado; la dosis se muestra con la advertencia
  `fuera_de_rango`, nunca oculta ni corregida por el sistema.
- **Seguridad sobre la ficha (FR-037 · FR-038 · SC-020 · SC-032)**: `evaluateSeguridadFicha`
  (pura, sobre `PatientContent`) evalúa el conjunto que la spec enumera —alergias conocidas,
  enfermedades preexistentes, medicamentos actuales, edad, peso y estado reproductivo— contra las
  `contraindicaciones` e `interacciones` documentadas del catálogo (cada una con su `Cita`:
  advertencias **verificables**, no criterio del sistema) y genera `Advertencia[]`
  (`contraindicacion`, `interaccion`). Los campos de seguridad **ausentes** se enumeran como
  advertencias `informacion_faltante` con su `campo` (derivando sobre `computeMissingFichaFields`
  de 002: «sin dato» nunca es «hallazgo negativo») y toda derivación que dependa del dato ausente
  se suspende —p. ej. sin peso no hay dosis calculada (US9-AC5)— en lugar de asumir valores.
- **Advertencias visibles al adoptar (SC-033 · US9-AC13)**: el snapshot `advertenciasVisibles` viaja
  en la fila adoptada exactamente como se mostró (D2/D7).

### D7. Adopción individual y atribuida; el tratamiento adoptado es inmutable en el servidor

`adoptarFarmaco` / `adoptarAlternativa` (en `src/features/tratamiento/`) escriben **solo** vía
`src/lib/attribution` (`createClinicalRecord`, con las guardas `ATTRIBUTION_CONTROL_FIELDS` y
respuesta `ClinicalMutationResult` con la acción enumerada releída de la traza — patrón D9 de 002 y
006, [contrato de atribución](../implementar-identidad-y-acceso/contracts/clinical-attribution.md)).
Cada fármaco se adopta **individualmente** (una llamada por fármaco; nunca una adopción en bloque
que pudiera arrastrar sugerencias no decididas — FR-036).

Migración `014_apoyo_tratamiento.sql`: trigger `guard_treatment_adoptions` (`BEFORE INSERT OR
UPDATE` sobre `clinical_records`, acotado a `record_type in ('pharmacological_treatment',
'non_pharmacological_treatment')`). Premisa de amenaza: la política T055 permite a cualquier
veterinario activo de la clínica hacer `UPDATE` directo por PostgREST sobre filas no aprobadas;
sin este trigger, un cliente podría reescribir `advertenciasVisibles` tras la adopción y mentir
SC-033, o reescribir `insumos`/`respaldo` y hacer mentir la reconstrucción de FR-020. Invariantes
(todas con SQLSTATE 23514, patrón de 002/003/006):

| Transición | Regla | Error |
|---|---|---|
| INSERT de ambos tipos | `status = 'draft'` (la RPC de aprobación solo acepta `epicrisis`; la «aprobación» del fármaco es la adopción atribuida, no un cambio de `status`) | `TREATMENT_STATUS_INVALID` |
| INSERT de `pharmacological_treatment` | `drugId`, `nombre`, `principioActivo` y `justificacion` no vacíos; `advertenciasVisibles` presente como array; `respaldo.citas` array **no vacío** (FR-019/FR-046: sin fuente citable no hay propuesta) | `TREATMENT_CONTENT_INVALID` |
| INSERT de `non_pharmacological_treatment` | `tipo` en enum, `descripcion` no vacía, `respaldo.kind` en `fuente\|sin_respaldo` | `TREATMENT_CONTENT_INVALID` |
| UPDATE de ambos tipos | prohibido en todo contenido: la fila adoptada es inmutable | `TREATMENT_ADOPTION_IMMUTABLE` |

La **inmutabilidad total tras el `INSERT`** (y no un subconjunto de campos mutables) se justifica
por el propio mapping existente: `clinical_record_action` emite `pharmacological_treatment_adopted`
también en el `UPDATE` de esas filas, de modo que permitir cualquier actualización escribiría un
segundo evento «adoptado» falso en la traza — y no hay acción enumerada que represente una
modificación de tratamiento (extender el enum exige tocar la migración 003, compartida y
prohibida). Corregir lo adoptado queda fuera del alcance (HD10): la corrección de lo aprobado
conserva la epicrisis correctiva de 002.

Heredado y **no duplicado**: `consultationId` inmutable y sellado al cerrar la consulta
(`guard_consultation_sealed` de 002), atribución inamovible (`deny_attribution_mutation`),
`update (content)` como única concesión de actualización (001/004) e inmutabilidad de lo aprobado
(001). La suite 013 aserta que toda fila de tratamiento tiene su evento `_adopted` y que
`approve_clinical_record` no crea ni modifica filas de tratamiento (SC-021/SC-038).

### D8. FR-058: `composeMedicamentosAprobados` como servicio propio y montaje mínimo como RI-1

`composeMedicamentosAprobados(rows: PharmacologicalTreatmentContent[]): string[]` vive en
`src/features/tratamiento/epicrisis-tratamiento.ts` y deriva el campo `medicamentosAprobados`
(`string[]`, contrato de 002) **solo** de las filas `pharmacological_treatment` ya adoptadas en la
consulta (una por cada adopción individual de D7). La forma de cada entrada es determinista
(HD2 del final): `"{principioActivo} ({nombre}) — {dosis.texto} · {ROTULO_VALIDACION_PROFESIONAL}"`,
o `"{principioActivo} ({nombre}) — sin rango de dosis documentado en las fuentes"` para las
adopciones sin rango (US9-AC18 también adoptables con la declaración a la vista).

FR-058 queda cumplido por dos vías independientes:

- **US9-AC16/SC-038 · exclusión**: como las sugerencias no adoptadas jamás se persisten (D3), el
  único insumo posible del compositor son adopciones individuales; ninguna sugerencia no aprobada
  puede aparecer como prescrita.
- **US9-AC17 · la aprobación de la epicrisis no adopta**: `approve_clinical_record` solo modifica
  filas `epicrisis` (su RPC rechaza otros `record_type`) y el trigger de D7 prohíbe todo `UPDATE`
  de tratamientos; aprobar una epicrisis que contenga cadenas de propuestas es incapaz de convertir
  ninguna en fármaco adoptado (aserción pgTap en la suite 013).

**RI-1 (montaje mínimo, patrón de servicio propio + requisito de integración: D10/RI-1 de 006 y D9
de 005)**: el borrador de epicrisis se arma en `src/features/registro/epicrisis-draft.ts` y su flujo
vive en `src/app/(protected)/consultations/[id].tsx` — ambos archivos prohibidos para esta rama.
Esta rama entrega y verifica el compositor con la forma exacta del campo; la edición mínima del
flujo de 002 (pasar las filas de tratamiento de la consulta a `buildEpicrisisDraft` o fusionar
`composeMedicamentosAprobados(...)` sobre su resultado — 1–2 líneas, con diff propuesto en
`quickstart.md`, coordinado con el montaje de `hipotesis` que aporta 006 por el mismo archivo) la
ejecuta el orquestador. Sin ella, US9-AC7/AC16/AC17 quedan **pendientes de integración**, no
cumplidas.

*Orden de flujo aceptado*: el campo se compone al generar el borrador, de modo que las adopciones
deben preceder a la generación de la epicrisis (el workspace de D10 muestra el estado y el flujo lo
facilita). Si el flujo de 002 permitiese adoptar tras generar el borrador, el diff de RI-1
recompondría el campo al aprobar; queda registrado como parte del alcance de la RI.

### D9. Contexto de hipótesis y de ficha: contratos de 006 y 002, sin reinvención

`propuesta-service` lee las filas `hypothesis` de la consulta (select por
`content->>'consultationId'`, lectura simple sobre los índices de expresión de 002) y las deriva
con `composeHipotesisConsideradas` de `src/features/asistencia/` (contrato de D7/D10 de 006) al
vocabulario `[{ texto, estado }]` que viaja como contexto (US9-AC1) y en `insumos.hipotesis`. La
ficha se lee con `getPatient` (`src/features/registro/ficha-service.ts`) y los campos de seguridad
se evalúan con `computeMissingFichaFields`/`PatientContent` de 002 (D6). Todo se consume; nada de
002/006 se edita («los contratos de 002 están en `src/features/registro/*`»: obligación, no
permiso).

Si el código mergeado de 003/006 difiere en firmas de `consultKnowledge`, `buildFragmentContext` o
`composeHipotesisConsideradas`, la adaptación se hace **dentro de los archivos propios** (nunca
editando sus módulos) y se documenta en `quickstart.md` (mismo riesgo declarado que 006).

### D10. Interfaz: rutas `/treatment/**`, componentes propios, WCAG 2.2 AA

- `/treatment/consultations/[id]` (`src/app/(protected)/treatment/consultations/[id].tsx`): el
  workspace de apoyo terapéutico de la consulta. Botón explícito **«Solicitar apoyo terapéutico»**
  (la presentación ocurre cuando el veterinario lo solicita, US9-AC1) con:
  - **Contexto**: hipótesis consideradas con estado (D9) y chips de procedencia (FR-021).
  - **Alternativas de manejo** (`panel-alternativas`, `tarjeta-alternativa`): tipo
    (conductual/ambiental/seguimiento/examen complementario, FR-034), respaldo con cita
    navegable al fragmento en su contexto (FR-007 · US9-AC14, `buildFragmentContext` de 003) o la
    declaración explícita «sin respaldo documental disponible» con el límite de alcance (FR-023 ·
    US9-AC8), y acción individual **«Adoptar»** (→ `non_pharmacological_treatment_adopted`).
  - **Propuestas farmacológicas** (`tarjeta-propuesta-farmacologica`, `panel-advertencias`):
    identificación, justificación con los datos del paciente usados (FR-019 · US9-AC2/AC15), dosis
    con su rótulo y, si aplica, la marca `fuera_de_rango` o la declaración de ausencia de rango
    (FR-035/FR-046 · US9-AC4/AC9/AC18/AC19), advertencias de contraindicación/interacción con su
    cita verificable e información faltante enumerada (FR-037/FR-038 · US9-AC3/AC5/AC11/AC12), y
    acción individual **«Adoptar fármaco»** con confirmación que muestra las advertencias activas:
    la adopción registra el snapshot visible (FR-036 · US9-AC6/AC13 · SC-033).
  - Descargo constante «apoyo a la decisión; toda dosis es información para validación
    profesional, no prescripción» (brief §11.6 · FR-010/FR-035).
- `/treatment/consultations/[id]/respaldo` (o panel «Ver respaldo»): reconstrucción de cada
  recomendación entregada (FR-020 · US9-AC10) desde `treatment_queries`: qué hipótesis, qué campos
  de ficha (`fichaRef` + snapshot) y qué citas la produjeron, con el fragmento concreto en su
  contexto (FR-007 · US9-AC14) y los `terminosMatch` visibles. Además, el estado de lo adoptado.

Componentes kebab-case en `src/components/tratamiento/`, reutilizando `ui/*`,
`attribution-badge` y `correction-history` de `src/components/clinical/`. Etiquetas programáticas,
operación por teclado, foco visible y contraste del paletín vigente (WCAG 2.2 AA); `testID`
estables. La entrada de navegación a `/treatment/**` desde `/home` y desde el workspace de consulta
vive en archivos prohibidos: **RI-3** (diff mínimo de 1–2 líneas por archivo documentado en
`quickstart.md`).

### D11. Catálogo terapéutico de demostración en fixtures propios + arnés de seguridad sintético

- `tests/fixtures/tratamiento/farmacos-demo.json`: el **conjunto acotado de fármacos de
  demostración** (HD6: fluoxetina, sertralina, clomipramina, trazodona y gabapentina — esta última
  sin rango de dosis documentado para ejercitar US9-AC18), como extracto estructurado de fichas
  farmacológicas **ficticias**: por fármaco, `paraHipotesis` (términos para el matcheo de D5),
  `indicacion` con `Cita`, `dosis` (`RangoDosis` con `Cita`, o `null` + declaración, FR-046),
  `contraindicaciones` e `interacciones` (cada una con `match` sobre la ficha del paciente y su
  `Cita`, FR-037). Cargado por `src/features/tratamiento/farmacos-loader.ts`
  (`loadFarmacosDemo`, validado con Zod — patrón `corpus-loader` de 003): el corpus de 003 sigue
  siendo la base documental y este fixture es el vademécum de demostración que sobre él cita.
- **Alineación de citas con el corpus sintético de 003 (HD9)**: hasta el merge, las `Cita` del
  fixture usan claves simbólicas (`documentoClave`, `ordinal`); una tarea de implementación las
  alinea a los `documentoId`/`ordinal` reales de `tests/fixtures/conocimiento/corpus-sintetico.json`
  (sección de fichas farmacológicas ficticias) una vez mergeada 003. Si el corpus no cubriera un
  fármaco del catálogo: default — retirar ese fármaco del conjunto de demostración (nunca se sugiere
  sin cobertura, FR-046); alternativa — incorporar una ficha farmacológica propia con el servicio
  `incorporateSource` de 003 desde un fixture de este cambio (HD9).
- `tests/fixtures/tratamiento/casos-seguridad.json` + `tests/integration/tratamiento/evaluacion.test.ts`:
  **arnés de evaluación** con casos sintéticos que incluyen deliberadamente contraindicaciones
  registradas y campos de seguridad ausentes (asunción de la spec: necesario para medir SC-020 y
  SC-032). Asevera las invariantes medibles sobre el conjunto sintético: SC-020 (100 % de las
  contraindicaciones documentadas en las fuentes es advertido), SC-032 (100 % de las sugerencias
  dependientes de datos ausentes enumera lo faltante), SC-006 (100 % con cita y rótulo), SC-034
  (0 alternativas respaldadas sin evidencia recuperable), SC-021 y SC-038 (= 0), e imprime sus
  métricas. Es evidencia del **mecanismo**, no aceptación de los criterios: la aceptación de
  SC-020/SC-032 sobre casos reales y de SC-006/SC-033/SC-034 por revisión clínica queda como
  **pendiente explícita** (mismo régimen que 003 y 006).

### D12. Sin dependencias nuevas; verificación por clúster scratch, CI y arnés

Cero cambios en `package.json` (Principio III). Verificación SQL local en `/tmp/verify-007/`
(migraciones 001–014 y suites 001–013 sobre los shims del patrón de 002) y verificación oficial en
el job `database` de CI; pruebas de unidad con `bun test` localmente y de integración viva con
`SUPABASE_LIVE_TESTS=1` en CI. Sin Playwright propio (restricción de la rama; la compuerta de
accesibilidad la cubre 002): la interfaz se verifica con `bun run typecheck` y Biome 2.5 sobre los
archivos propios, y la verificación visual y el e2e funcional de estas pantallas quedan como
**pendiente declarado** — incluida la ampliación de la compuerta axe/teclado a `/treatment/**`
(**RI-4**).

## Seguimiento de complejidad (Principio III)

| Complejidad nueva | Justificación exigida por el requisito | Se elimina cuando |
|---|---|---|
| Trigger `guard_treatment_adoptions` (014) | FR-036/SC-033 (advertencias visibles preservadas) y FR-020 (reconstrucción fiel) frente a la premisa T055 de escritura directa; sin UPDATE falso de `_adopted` (D7) | Nunca mientras la spec exija adopción verificable |
| Tabla `treatment_queries` (append-only) | FR-020 para toda recomendación entregada, también las no adoptadas (D4) | Si se acepta reconstruir solo lo adoptado (HD2 invierta) |
| Catálogo terapéutico cerrado + loader Zod | FR-019/FR-046 (cobertura citable obligatoria) y FR-037 (restricciones documentadas) de forma determinista (D5/D11) | Si se adopta una base de fármacos editable (HD4) |
| `computeDosis` + `evaluateSeguridadFicha` | FR-035/FR-038/FR-037/SC-020/SC-032: rótulo, rango documentado y advertencias verificables (D6) | No aplica (funciones puras sin estado) |
| `composeMedicamentosAprobados` | FR-058/US9-AC7: solo adoptados en la epicrisis (D8) | No aplica |
| Arnés + casos de seguridad sintéticos | SC-020/SC-032 medibles por máquina sobre el conjunto sintético (D11) | Al aceptar con el conjunto del equipo clínico, se reemplazan los fixtures |

Dependencias de ejecución nuevas: **ninguna**. Capas arquitectónicas nuevas: **ninguna**
(`features/tratamiento` y `components/tratamiento` sobre los patrones de `features/registro`,
`features/conocimiento`, `features/asistencia` y `lib/attribution`). Archivos compartidos
modificados: **ninguno** (RI-1/RI-3/RI-4 quedan para el orquestador).

## Presupuestos de rendimiento (verificables antes de integrar)

| Operación | Presupuesto | Cómo se verifica |
|---|---|---|
| Composición de propuestas (catálogo ≤ 8 entradas, ≤ 3 hipótesis, respaldo 003 ≤ 25 candidatos) | ≤ 300 ms CPU cliente | temporización laxa en `tests/unit/tratamiento/compose.test.ts` (2.3) |
| Cálculo de dosis y evaluación de seguridad por fármaco | ≤ 100 ms CPU cliente | temporización laxa en `tests/unit/tratamiento/seguridad.test.ts` (2.2) |
| Solicitud completa de apoyo (contexto + ≤ 8 recuperaciones de 003 + composición + persistencia en `treatment_queries`) | ≤ 8 s | aserción de tiempo en `tests/integration/tratamiento/apoyo.test.ts` (3.1) |
| Adopción de un fármaco o alternativa (escritura atribuida) | ≤ 2 s por operación | aserciones de tiempo en `tests/integration/tratamiento/adopcion.test.ts` (3.2) |
| `composeMedicamentosAprobados` (≤ 10 filas adoptadas) | ≤ 100 ms CPU cliente | temporización laxa en `tests/unit/tratamiento/epicrisis.test.ts` (2.4) |

SC-006, SC-020, SC-032, SC-033 y SC-034 se miden por máquina sobre el conjunto **sintético** (D11):
sus resultados son evidencia del mecanismo, no aceptación de los criterios. SC-021 y SC-038 son
conteos «= 0» verificables por construcción y por pruebas (D3/D8). La aceptación clínica de los
criterios sobre casos reales queda como **pendiente explícita**.

## Verificación de principios constitucionales

- **I (especificación primero)**: este diseño y `tasks.md` preceden a cualquier código; todo cambio
  de comportamiento pasa primero por la spec (`openspec-update-change`).
- **II (pruebas primero)**: cada grupo de `tasks.md` abre con sus pruebas en rojo —pgTap e
  integración viva observadas en `/tmp/verify-007/` y en CI (URLs en `quickstart.md`), unidad
  local— fallando por la razón prevista antes de implementar.
- **III (simplicidad/YAGNI)**: sin dependencias ni capas nuevas; complejidad justificada arriba;
  generación con LLM, scoring, tablas de fármacos editables y «recuperación léxica como única
  puerta de cobertura» rechazados por escrito (D3/D5).
- **IV (observabilidad)**: los servicios emiten `logEvent` con `requestId` y `captureClientError`
  en fallos; la solicitud de apoyo registra operación, duración y conteos; las adopciones quedan en
  `clinical_audit_events` por los triggers de 001; ninguna excepción silenciada.
- **V (seguridad y protección de datos)**: RLS y triggers del servidor siguen siendo el control; el
  trigger 014 inmoviliza lo adoptado frente a la escritura directa (D7); `treatment_queries` es
  append-only y restringido a sesión activa; Zod valida cada frontera; ningún campo de atribución
  aceptado del cliente; sin secretos nuevos. **Seguridad clínica (brief §11.6)**: sin prescripción
  autónoma por construcción — la sugerencia no es registro (D3), la adopción es acción individual
  atribuida (D7) y la epicrisis solo recibe adopciones (D8).
- **Accesibilidad web (WCAG 2.2 AA)**: etiquetas programáticas, operación por teclado, foco visible
  y contraste en todas las superficies nuevas (D10); la compuerta automatizada axe/teclado sobre
  `/treatment/**` queda como RI-4 y la verificación visual como pendiente declarado (D12).

## Migration Plan

Una única migración aditiva `supabase/migrations/014_apoyo_tratamiento.sql`: la función y el
trigger `guard_treatment_adoptions` (D7) y la tabla `treatment_queries` con sus grants y políticas
RLS de sesión activa (D4, solo `select`/`insert`). Sin DDL sobre tablas existentes, sin cambios en
la enumeración de FR-063 y sin grants nuevos sobre `clinical_records`. `supabase gen types` mostrará
diff por la tabla nueva → **RI-2**: la regeneración de `src/lib/supabase/database.types.ts` la
ejecuta el orquestador al integrar (mismo régimen que RI-1 de 003); hasta entonces los servicios
tipan su superficie nueva en frontera propia validando cada fila con Zod (patrón HD8 de 003) y el
paso de diff de tipos del job `database` queda en rojo **declarado**. Rollback = revertir el commit
(no hay datos que migrar). Las suites 001–012 deben seguir verdes con la 014 aplicada; las de las
ramas hermanas se verifican en la integración del orquestador.

## Risks / Trade-offs

- **[RI-1] Montaje de `medicamentosAprobados` en la epicrisis (FR-058 · US9-AC7/AC16/AC17)** → el
  campo se compone en el flujo de 002 (`src/features/registro/epicrisis-draft.ts` y/o
  `src/app/(protected)/consultations/[id].tsx`), archivos prohibidos. Mitigación: esta rama entrega
  `composeMedicamentosAprobados` con la forma exacta del campo y sus pruebas; el diff mínimo (1–2
  líneas, propuesto en `quickstart.md`, coordinado con el montaje de `hipotesis` de 006 por el mismo
  archivo) lo ejecuta el orquestador. Sin ello, esos escenarios quedan **pendientes de
  integración**, no cumplidos.
- **[RI-2] `database.types.ts` exige regeneración por `treatment_queries`** → la migración 014 añade
  una tabla y el tipo generado no la conoce; el archivo está prohibido. Mitigación: servicios con
  tipado en frontera propia + Zod (patrón HD8 de 003), `supabase gen types` listo para el
  orquestador, y endurecimiento de firmas documentado como paso posterior. Hasta entonces, diff de
  tipos en rojo **declarado**.
- **[RI-3] Entrada de navegación a `/treatment/**`** → `/home` y el workspace de consulta son
  archivos prohibidos; sin el enlace (1–2 líneas por archivo), la ruta es accesible solo por URL.
  Mitigación: diff propuesto documentado en `quickstart.md`; coordinación por hub con las ramas
  hermanas antes de que el orquestador aplique.
- **[RI-4] Compuerta de accesibilidad y e2e de `/treatment/**`** → esta rama no escribe Playwright;
  la compuerta axe/teclado/viewport de 002 no cubre las pantallas nuevas. Mitigación: WCAG 2.2 AA por
  diseño (D10), typecheck + lint, y pendiente declarado para la ampliación de
  `tests/e2e/web/accessibility.spec.ts` que ejecutará el orquestador.
- **Alineación de citas con el corpus de 003 (D11/HD9)** → hasta el merge, el fixture usa claves
  simbólicas; si el corpus real no cubre un fármaco, su ficha no puede citarse y FR-046 prohíbe
  sugerirlo. Mitigación: tarea explícita de alineación post-merge; default retirar el fármaco del
  conjunto de demostración; alternativa documentada (ficha propia por `incorporateSource`).
- **Matching léxico de catálogo sobre textos de hipótesis (D5)** → falsos positivos/negativos del
  matcheo de términos (una hipótesis con léxico no previsto puede no disparar una propuesta
  pertinente o disparar una impertinente). Mitigación: transparencia total (los `terminosMatch` y
  las referencias son visibles en «ver respaldo», FR-020), términos en constantes ajustables y
  medición con el arnés (SC-020/SC-032) y la revisión clínica pendiente. Detección semántica fuera
  del PoC (mismo coste declarado que HD2/HD6 de 003).
- **`jsonb` sin FK (D1)** → referencias huérfanas posibles si se escribe fuera de los servicios
  (`consultationId`). Mitigación: servicios únicos de escritura, trigger 014 y pruebas de
  integración; coste ya aceptado por 002/003/006.
- **Duplicación de payloads entre `treatment_queries.answer` y `knowledge_queries` (D4)** → cada
  recuperación de 003 persiste su respuesta y el registro de la generación conserva el conjunto
  compuesto. Coste aceptado: la agrupación por generación es lo que hace reconstruible la
  recomendación entregada; el corpus es acotado y el registro append-only.
- **`medicamentosAprobados` como `string[]` (D8/HD7)** → el contrato de 002 es un array de
  cadenas: la representación es textual y su formato es una convención de este compositor.
  Mitigación: formato determinista documentado (HD2 del final) y unit-testeado; si la revisión
  exige estructura, el cambio de `EpicrisisContent` es RI sobre 002 (fuera de esta rama).
- **Rótulo en la cadena de la epicrisis (D6/HD7)** → una lectura de revisión podría preferir que el
  rótulo desaparezca tras la validación profesional. Mitigación: FR-035/US9-AC19 son incondicionales
  («toda dosis que el sistema presente») y así se asertó; la inversión es una línea en el compositor
  (alternativa documentada en HD7).
- **Orden de flujo adopción → epicrisis (D8)** → adoptar tras generar el borrador dejaría el campo
  desactualizado. Mitigación: el workspace muestra el estado y el diff de RI-1 puede recomponer al
  aprobar; documentado en el alcance de la RI.
- **Dependencia del contrato final de 003/006 (D9)** → si las firmas mergeadas difieren de los
  diseños, la adaptación es interna a los archivos propios y se documenta (mismo régimen que 006).
- **Ciclos TDD lentos para SQL** (rojo/verde por clúster scratch y CI) → suites pequeñas y
  enfocadas; URLs de ejecución como evidencia.
- **SC-020/SC-032 sobre casos reales y SC-006/SC-033/SC-034 en lectura clínica** → dependencias
  externas (equipo clínico, revisión): no se afirman como cumplidas; el arnés sintético acredita
  solo el mecanismo.

### Decisiones duras (reversibles por el usuario)

| # | Decisión (default elegido) | Alternativa | Qué cambia si se invierte |
|---|---|---|---|
| HD1 | **Las propuestas nunca viven en `clinical_records`**; solo la adopción se persiste como registro (D3) | Persistir sugerencias con estado «propuesta» en `clinical_records` | El mapping existente emitiría `pharmacological_treatment_adopted` al proponer (SC-021/SC-038 se rompen); exigiría extender el mapping (migración 003 compartida) con una acción nueva tipo `pharmacological_treatment_suggested` |
| HD2 | **`treatment_queries` append-only** para reconstruir toda recomendación entregada (D4) | Sin tabla: reconstruir solo lo adoptado (contenido de la fila) | FR-020 queda limitado a lo adoptado; US9-AC10 sobre sugerencias no adoptadas no es verificable; se elimina la tabla y RI-2 |
| HD3 | **Tratamientos adoptados inmutables** (sin UPDATE alguno) (D7) | Campos mutables acotados (p. ej. suspendido con historia) | El UPDATE volvería a emitir `_adopted` (traza falsa) salvo extender el enum de FR-063 (migración compartida); hay que definir qué campos mutan y su historia |
| HD4 | **Catálogo terapéutico cerrado** en `tests/fixtures/tratamiento/farmacos-demo.json` + loader Zod (D11) | Registro en código (patrón `reglas.ts` de 006) o tabla editable de fármacos con UI | Código: cambia solo el loader; tabla: migración + UI de edición + RI de tipos |
| HD5 | **Composición determinista sin modelos generativos ni scoring** (D3/D5) | LLM en Edge Function con proveedor externo | Nueva función Edge + secreto + validación de anclaje de citas; SC-006/020/032/033/034 y FR-020 dejan de ser verificables por construcción |
| HD6 | **Conjunto de fármacos de demostración**: fluoxetina, sertralina, clomipramina, trazodona y gabapentina (esta última sin rango documentado), con contraindicaciones por alergia/edad/estado reproductivo e interacción ISRS–trazodona documentadas (D11) | Otro conjunto o más fármacos | Solo cambia el fixture y los casos del arnés; ningún contrato se mueve |
| HD7 | **Dosis como rango (min–max × peso con tope absoluto opcional) o cita literal, con rótulo incondicional — también en la cadena de la epicrisis** (D6/D8) | Dosis puntual sin rango; o sin rótulo una vez validada la epicrisis | `computeDosis` y el compositor de epicrisis cambian de formato; sin rótulo en la epicrisis contradice FR-035/US9-AC19 tal como están escritos (exigiría aclarar la spec primero) |
| HD8 | **FR-058 «si acaso» leído como opcional**: las sugerencias no adoptadas **no** se listan en la epicrisis (solo se excluyen de `medicamentosAprobados`) (D8) | Añadir un `composePropuestasNoAdoptadas` que vierta texto en `observaciones` | Un compositor extra (puro, ~1 tarea) y una línea más en el diff de RI-1; la exclusión de `medicamentosAprobados` no cambia |
| HD9 | **Citas del catálogo alineadas al corpus sintético de 003** (claves simbólicas hasta el merge); default ante huecos: retirar el fármaco del conjunto de demostración (D11) | Fichas farmacológicas propias ingeniadas con `incorporateSource` de 003 desde fixtures de este cambio | Fixtures propios de documentos + carga en el stack vivo; el catálogo deja de depender del contenido del corpus de 003 |
| HD10 | **Sin transiciones posteriores del tratamiento adoptado** (sin suspensión/titulación/retiro) (D7) | Estado mutable tipo `suspended` + acción enumerada | Exige extender el enum de FR-063 (migración 003 compartida → RI mayor) o aceptar UPDATE con evento `_adopted` falso (traza mentirosa) |

## Open Questions

Ninguna cambia el enfoque, la spec ni el desglose de tareas; todas tienen default documentado arriba:

1. **Formato de `medicamentosAprobados`** (HD7): ¿el orquestador/la revisión acepta la cadena
  `"{principioActivo} ({nombre}) — {dosis} · {rótulo}"` o exige estructura (RI sobre 002)? Default:
  la cadena determinista.
2. **Listado de propuestas no adoptadas en la epicrisis** (HD8): ¿«si acaso» se leerá como
  obligatorio? Default: no; la reconstrucción completa vive en `treatment_queries`.
3. **`treatment_queries` con actor** (D4): ¿la revisión exigirá `requested_by` además del registro
  de adopción atribuida? Default: sin actor (régimen de `knowledge_queries` de 003).
4. **Cobertura real del corpus de 003** (HD9): ¿las fichas farmacológicas ficticias cubren los cinco
  fármacos de demostración? Default: alinear y retirar los no cubiertos; decisión tomable tras el
  merge.
5. **Agenda de la aceptación clínica** (SC-020/SC-032 sobre casos reales; SC-006/SC-033/SC-034 en
  revisión de especialistas): pendiente externo al cambio, declarado en `quickstart.md`.
