# Diseño de implementación: Retroalimentación clínica

**Fecha**: 2026-09-22 | **Especificación**: [retroalimentacion-clinica](specs/retroalimentacion-clinica/spec.md)

**Entrada**: propuesta y especificación del cambio; [identidad y acceso](../implementar-identidad-y-acceso/design.md)
y [registro clínico longitudinal](../implementar-registro-clinico-longitudinal/design.md) construidos
sobre su rama `feat/002-registro-clinico-longitudinal`, de la que esta rama parte y a la que se
integra antes de implementar. Este diseño se aprueba antes de `tasks.md`; su implementación sigue el
Rojo-Verde-Refactor obligatorio.

## Context

La capa de identidad, atribución y registro clínico ya existe y este cambio se apoya íntegramente en
ella (ver [propuesta](proposal.md) para el porqué):

- `public.clinical_records` es la tabla polimórfica de registros clínicos (`record_type`,
  `content jsonb`, `status` en `draft|approved|corrective`, `supersedes_event_id`) con columnas de
  atribución que el servidor fija y que `deny_attribution_mutation` hace inmutables. **El enumerado
  FR-063 ya contiene la entidad y la acción de este cambio**: `record_type` admite
  `clinical_feedback` y `clinical_record_action` mapea su `INSERT` a `clinical_feedback_recorded`
  (`supabase/migrations/003_attribution_hardening.sql`); `status = 'corrective'` siempre mapea a
  `corrective_record_created`. No hay nada que añadir al mapping.
- `deny_attribution_mutation` rechaza todo `INSERT` con `status = 'approved'`: el camino de
  aprobación está reservado a la epicrisis (`approve_clinical_record` solo aprueba
  `record_type = 'epicrisis'` y, con D4 de 002, cierra su consulta en la misma transacción).
- `guard_consultation_sealed` (009, D5 de 002; alcance acotado tras el fix `2fd95ac`) sella
  ante `INSERT`/`UPDATE` los registros de TRABAJO (anamnesis, diagnosis, epicrisis) cuyo
  `content->>'consultationId'` resuelva a una consulta `closed`, e impide re-apuntar el vínculo
  en TODO tipo. La retroalimentación (`clinical_feedback`) es un registro longitudinal, no de
  trabajo: queda **fuera** del sellado de 002 y su inmutabilidad es exclusivamente el trigger de
  D4 (que era exactamente el objetivo de D4).
- Contrato de cliente en `src/lib/attribution/clinical-mutations.ts`: `createClinicalRecord`,
  `createCorrectiveRecord` (registro adicional `corrective` con `supersedesEventId`), guardas
  `ATTRIBUTION_CONTROL_FIELDS` y respuesta `ClinicalMutationResult` con la atribución leída de la
  traza ([contrato de atribución](../implementar-identidad-y-acceso/contracts/clinical-attribution.md)).
- `src/features/registro/summaries.ts` expone `buildFollowUpSummary` (FR-013 de 002) **anticipado
  para absorber la evolución posterior (FR-042)**, y `effectiveEpicrisis` para la epicrisis efectiva.
  Son archivos compartidos de 002: este cambio los **lee y expone sus datos a su lado**, sin
  modificarlos (ver D9).
- RLS exige sesión de acceso activa y clínica compartida; la política de actualización (T055)
  permite a cualquier veterinario activo de la clínica editar filas no aprobadas — premisa de
  amenaza que este diseño vuelve inocua para su propia entidad (D4) —. La observabilidad usa
  `logEvent`/`captureClientError` en cliente (`src/lib/observability/`) y `log_server_event` en SQL.

Restricciones de esta rama que el diseño absorbe: **archivos compartidos prohibidos**
(`src/lib/attribution/*`, `src/lib/storage/*`, `src/lib/supabase/*`,
`src/app/(protected)/consultations/[id].tsx`, `src/features/registro/*`,
`supabase/migrations/001-009*`, `supabase/tests/001-008*`, `supabase/seed.sql`); números propios:
migración `012_retroalimentacion_clinica.sql`, suite pgTap `011_retroalimentacion_clinica.sql`
(los huecos 010/011 de migraciones y 009/010 de tests están reservados a ramas hermanas);
**sin Playwright** en esta tanda; verificación SQL local con clúster PostgreSQL scratch y shims en
`/tmp/verify-005/` (patrón del [quickstart de 002](../implementar-registro-clinico-longitudinal/quickstart.md)),
nunca `supabase start` (las ramas hermanas compiten por puertos); las integraciones vivas se
ejecutan en CI con `SUPABASE_LIVE_TESTS=1`.

## Goals / Non-Goals

**Goals:**

- Materializar la retroalimentación clínica como entidad estructurada sobre la convención
  `clinical_records`/`clinical_feedback` existente, con los siete contenidos de FR-018 y atribución
  y auditoría reutilizando el enumerado FR-063 (sin una segunda convención de persistencia).
- Garantías estructurales, no solo de servicio: contenido categórico íntegro en el servidor
  (FR-043 · SC-023), inmutabilidad de lo registrado y correcciones solo aditivas (FR-024 · SC-022).
- Exponer la evolución registrada mediante un servicio propio consumible por el futuro resumen
  longitudinal (FR-042 → FR-013), con el requisito de integración documentado (D9).
- Interfaz de registro en menos de dos minutos con campos categóricos sin texto libre (SC-037,
  componente estructural) y eventos adversos diferenciados (FR-041 · SC-035).

**Non-Goals:**

- No se modifica `src/features/registro/summaries.ts`, `src/app/(protected)/consultations/[id].tsx`
  ni ningún archivo de la lista prohibida: la integración de FR-042 en el resumen de 002 es un
  requisito de integración del orquestador (D9), no tarea de este cambio.
- Sin analítica agregada, aprendizaje automático ni reentrenamiento (supuestos de la spec); la
  estructura solo garantiza analizabilidad posterior.
- Sin canal de captura desde el tutor (la evolución la reporta el veterinario) y sin la entidad
  Tratamiento de la spec 007: `tratamientoAplicado` es texto estructurado propio de esta
  retroalimentación.
- Sin e2e Playwright ni compuertas axe ampliadas en esta rama (restricción explícita; ver D11 y
  Riesgos).

## Decisions

### D1. La retroalimentación es una fila de `clinical_records` con `record_type = 'clinical_feedback'`

Reutiliza la convención que 001 construyó y que 002 refinó: detalle en `content jsonb` (claves
`camelCase`), atribución por columnas del servidor y traza por `audit_clinical_record`, cuyo
mapping ya enumera `clinical_feedback_recorded` para su `INSERT` y `corrective_record_created` para
las correctivas (D4). Las lecturas usan los índices de expresión existentes sobre
`content->>'consultationId'` y `content->>'patientId'`; no se crea ningún índice nuevo (ver
presupuestos).

*Alternativa considerada*: tabla relacional dedicada (`clinical_feedback_entries`) con columnas
tipadas. *Rechazada*: crearía una segunda convención de persistencia clínica junto al
`clinical_records` que la 001 hizo exactamente para esto (Principio III), duplicaría triggers de
atribución/auditoría/RLS, y —decisivo— añadiría tablas al esquema expuesto, con lo que
`supabase gen types` dejaría de ser estable sobre `src/lib/supabase/database.types.ts`, archivo
compartido prohibido para esta rama (D6). El coste aceptado (tipos categóricos verificados por
validación en el servidor, D5, en vez de por `check` de columna) queda registrado en Riesgos.

### D2. Forma del contenido: los siete contenidos de FR-018 en ocho campos

Claves `camelCase`; `zod` valida toda frontera de entrada del cliente (Principio V) y el trigger de
D5 replica la validación en el servidor.

| Campo | Forma | Obligado | Cubre |
|---|---|---|---|
| `consultationId` | `string` (uuid de la consulta referida) | sí | FR-039 · US10-AC1 |
| `adherence` | `completa \| parcial \| ninguna \| desconocida` | sí | adherencia (FR-018, FR-040 · US10-AC8) |
| `evolution` | `mejoria \| mejoriaParcial \| sinCambios \| empeoramiento \| desconocida` | sí | evolución y «mejoría o ausencia de cambios» (FR-018, FR-040) |
| `evolutionNote` | `string \| null` | no | evolución descriptiva; conserva contradicciones con la epicrisis |
| `adverseEvents` | `{ severity: 'leve' \| 'moderado' \| 'grave', description: string }[]` | sí (puede ser `[]`) | eventos adversos (FR-018, FR-041) |
| `treatmentApplied` | `string \| null` | no | tratamiento aplicado (FR-018 · US10-AC10) |
| `treatmentModification` | `string \| null` | no | modificación del tratamiento (FR-018 · US10-AC10) |
| `revisedDiagnosis` | `string \| null` | no | cambio de diagnóstico (FR-018 · US10-AC4) |

Decisiones dentro de la forma:

- **«Evolución, mejoría o ausencia de cambios»**: la lectura del enumerado de FR-018 admite seis o
  siete contenidos según se tome «mejoría o ausencia de cambios» como glosa de «evolución» o como
  ítem propio (el checklist de la spec lo contó como siete). El par `evolution` (categoría del
  desenlace) + `evolutionNote` (descripción libre opcional de la evolución) satisface ambas
  lecturas sin inventar campos: bajo la lectura de siete, `evolutionNote` es «evolución» y
  `evolution` es «mejoría o ausencia de cambios»; bajo la de seis, la categoría es la evolución y la
  nota es su detalle. La tabla de cobertura de arriba deja verificable que **los siete contenidos
  tienen campo propio** (la lección del checklist: ningún contenido de FR-018 sin escenario).
- **Campos categóricos obligatorios con valor `desconocida`** (`adherence`, `evolution`) y lista
  `adverseEvents` obligatoria que puede ser vacía (= «sin eventos adversos en esta entrada»):
  la obligatoriedad es la que hace alcanzable el 100 % de SC-023, y los valores `parcial`/
  `desconocida` son los que impiden forzar falsa precisión (FR-040 · US10-AC8). Ninguna respuesta
  binaria: adherencia no es sí/no y evolución no es mejoría/ausencia.
- **`treatmentApplied` y `treatmentModification` son campos distintos** y ambos anulables: US10-AC10
  exige distinguir lo aplicado de su modificación y FR-057 aceptar el tratamiento vacío cuando no lo
  hubo (US10-AC12). No se condiciona su llenado al tratamiento indicado en la epicrisis: FR-018
  dice «poder registrar», no obligar, y forzarlo contradiría SC-037.
- **`revisedDiagnosis` es el cambio posterior, nunca una edición del diagnóstico original** (la
  fila `diagnosis` de la consulta queda sellada y intacta; US10-AC4 recupera ambos).
- **Fechas (FR-039 · US10-AC7)**: la fecha de registro es el `created_at` (servidor, UTC) del propio
  registro de retroalimentación; la fecha de la consulta referida es la del registro de consulta. Se
  distinguen estructuralmente (son filas y columnas distintas) sin un tercer campo de fecha que
  nadie pide.

*Alternativa considerada*: `evolution` como texto libre con un booleano `mejorado`. *Rechazada*:
rompe FR-040 (binaria) y SC-023 (agregación sin interpretar texto).

### D3. Solo se registra retroalimentación sobre consultas cerradas

«Entre consultas» (US10 y la misión de la capacidad) significa tras el cierre: la retroalimentación
es el resultado de lo decidido en una consulta ya terminada, y su registro es aditivo respecto de la
epicrisis aprobada que ese cierre selló. El servicio rechaza registrar contra una consulta que no
esté `closed`, y el trigger de D5 lo vuelve a exigir en el servidor.

*Alternativa considerada*: aceptar la consulta abierta. *Rechazada*: dejaría el registro editable
(el sello de 002 solo muerde consultas cerradas), permitiría que la «evolución posterior» preceda a
la epicrisis que dice seguir, y ningún escenario de la spec lo ejercita: los trece usan consulta
cerrada (los casos límite dicen explícitamente «consulta cerrada sin tratamiento indicado»).

### D4. Inmutabilidad estructural: el feedback nunca se actualiza; corregir es crear

Dos mecanismos, ambos deliberados:

1. **Nada de lo registrado se edita.** Trigger `guard_clinical_feedback_immutable`
   (`BEFORE UPDATE`) que rechaza todo `UPDATE` de `record_type = 'clinical_feedback'` con
   `CLINICAL_FEEDBACK_IMMUTABLE` (SQLSTATE 23514). Tras el fix `2fd95ac` el sellado de 002 NO
   cubre `clinical_feedback` (solo los registros de trabajo), de modo que esta inmutabilidad es
   **estructural y única** para esta entidad —el objetivo de D4—: si una consulta cerrada fuera
   reabierta por un `UPDATE` directo (agujero heredado del modelo de amenazas de T055, ver
   Riesgos), la retroalimentación seguiría intocable. Ninguna operación legítima necesita
   `UPDATE` sobre estas filas: corregir es crear (punto 2). El original permanece recuperable por
   construcción (FR-024 · SC-022 · US10-AC5).
2. **Corregir crea un registro nuevo.** `createCorrectiveRecord` (contrato existente) inserta una
   fila `status = 'corrective'` cuyo `supersedes_event_id` apunta al evento
   `clinical_feedback_recorded` del original — misma semántica que la correctiva de epicrisis (D8 de
   002): las correctivas sucesivas apuntan al **mismo** evento original y la efectiva es la más
   reciente. El original y toda correctiva quedan en la cronología (FR-056 convive: nada se
   sobrescribe).

El original nace con `status = 'draft'` porque `deny_attribution_mutation` rechaza `INSERT`
`approved` y el camino de aprobación está reservado a la epicrisis (D5 de 002): aquí «draft» es solo
el único estado de inserción legítimo, y la inmutabilidad la aporta el trigger, no el estado.
*Alternativa considerada*: extender `deny_attribution_mutation` para admitir `INSERT` `approved` de
`clinical_feedback`. *Rechazada*: tocaría el contrato de atribución compartido de 001/002 (archivo
prohibido, y además una desviación del patrón) para una diferencia semántica sin efecto práctico.

### D5. Validación del contenido también en el servidor

Trigger `validate_clinical_feedback` (`BEFORE INSERT OR UPDATE`) que exige, para
`record_type = 'clinical_feedback'`: claves conocidas y solo ellas (forma cerrada), tipos y
vocabularios exactos de D2 (incluidos `parcial`/`desconocida`), `adverseEvents` como arreglo de
objetos con `severity` en vocabulario y `description` no vacía, y `consultationId` que resuelve —
con cast defensivo del uuid, patrón de 009 — a una consulta `closed` de la misma clínica (D3 hecha
estructural). Viola la validación → `CLINICAL_FEEDBACK_INVALID_CONTENT` (SQLSTATE 23514).

*Justificación* (Principio III y V): SC-023 afirma que el 100 % de los campos categóricos se
recupera agregado sin interpretar texto libre; eso es verificable solo si el vocabulario lo garantiza
el servidor. La validación Zod del servicio es una comodidad del cliente y **nunca un control**
(Constitución V): PostgREST acepta `INSERT` directo de cualquier veterinario autenticado con
`content` arbitrario. Sin este trigger, una escritura directa con `adherence: "quizas"` rompería
SC-023 sin que ninguna prueba pudiera negarlo.

### D6. Migración solo con triggers: ninguna función callable nueva

`012_retroalimentacion_clinica.sql` añade únicamente funciones `returns trigger`, sus triggers y
comentarios. *Por qué es una decisión y no un detalle*: `supabase gen types` incluye en
`src/lib/supabase/database.types.ts` toda función no-trigger del esquema expuesto (verificado: están
`clinical_record_action`, `log_server_event`, `request_id`, etc., y no está ninguna `guard_*`/
`deny_*`/`audit_*`), y ese archivo es compartido y prohibido para esta rama. Una RPC nueva
(por ejemplo `record_clinical_feedback`) rompería la compuerta de diff de tipos de CI y obligaría a
tocar archivo prohibido. Las escrituras usan por tanto el contrato de `clinical-mutations` sobre
PostgREST (como el resto de 002) y las garantías nuevas viven en triggers. Compatibilidad: no se
modifican grants (004/005) ni el mapping (003); las suites 001–008 siguen verdes.

### D7. Corrección: cadena apuntando al evento del original

`correctFeedbackEntry(feedbackRecordId, content)` resuelve el evento `clinical_feedback_recorded`
del registro original (lectura de `clinical_audit_events` por `entity_id` + acción) y llama a
`createCorrectiveRecord` con ese `supersedesEventId`. Corregir una correctiva resuelve también al
original (por su `supersedes_event_id → entity_id`), como en D8 de 002. La corrección conserva el
`consultationId` del original: un registro asociado a otra consulta no es una corrección, es otra
entrada (el servicio lo impone; ver Riesgos para la escritura directa).

### D8. Lecturas como funciones puras + consultas simples

Cuatro funciones puras unit-testeadas en `src/features/retroalimentacion/feedback-summary.ts`, con
el mismo criterio de orden que 002 (`created_at` ascendente, `id` como desempate):

- `buildFeedbackTimeline(entries, consultationId?)` → cronología sin sobrescritura (FR-056 ·
  US10-AC11) con marcas de corrección (`corrects`, `supersededBy`, entrada efectiva) y el original
  siempre presente (FR-024 · US10-AC5).
- `collectAdverseEvents(timeline)` → eventos adversos **diferenciados** del resto de la evolución,
  con su consulta, fecha y severidad; `grave` destacable (FR-041 · SC-035 · US10-AC2).
- `aggregateFeedback(timeline)` → recuentos por categoría de `adherence` y `evolution` y por
  severidad de `adverseEvents`, sin interpretar texto libre (FR-043 · SC-023 · US10-AC9).
- `buildFeedbackAntecedents({ timeline, consultations, excludeConsultationId? })` → la evolución
  previa en forma de antecedentes presentables (FR-042 · US10-AC6); recibe también las filas de
  consulta para distinguir en cada antecedente la fecha de registro de la fecha de la consulta
  referida (FR-039 · US10-AC7). Ver D9.

Las consultas Supabase son lecturas simples: entradas por `content->>'consultationId'` (índice
existente) y, para el agregado por paciente, las consultas por `content->>'patientId'` (índice
existente) y luego sus entradas. Sin índice nuevo (Principio III): los dos caminos de lectura ya
están cubiertos por los índices de 009 y los presupuestos de abajo lo verifican con carga
realista.

### D9. FR-042 se entrega como servicio propio + requisito de integración documentado

`buildFollowUpSummary` y la pantalla `/consultations/[id]` son de 002 y están **prohibidos** para
esta rama, pero son donde FR-042 dice que la evolución previa se presenta al iniciar la consulta
posterior (SC-036). Este cambio entrega:

1. **El dato**: `listFeedbackByPatient`, `listFeedbackByConsultation` y `buildFeedbackAntecedents`
   (D8) exponen la evolución ya en forma de antecedentes, con la firma pensada para que una
   extensión futura de `buildFollowUpSummary` la consuma sin reformatear.
2. **La presentación en superficie propia**: el panel de seguimiento `/follow-up/[patientId]` (D10)
   muestra la evolución registrada como antecedente del paciente, que es lo que SC-036 pide para el
   momento de retomar al paciente.

**Requisito de integración (para el orquestador)**: extender `buildFollowUpSummary`
(`src/features/registro/summaries.ts`) y el resumen previo de `src/app/(protected)/consultations/[id].tsx`
para incluir `buildFeedbackAntecedents({ timeline: buildFeedbackTimeline(feedbackDelPaciente), consultations: consultasDelPaciente, excludeConsultationId })`.
Hasta esa integración, SC-036 queda
**parcialmente verificado** (superficie de seguimiento) y se declara pendiente en su parte de
«al iniciar una consulta posterior» — declararlo no lo convierte en compuerta cumplida.

*Alternativa considerada*: editar `summaries.ts` y `/consultations/[id]` en este cambio.
*Rechazada*: archivos compartidos prohibidos (ramas hermanas 003/004 en paralelo) y encargo
explícito del orquestador de exponer el dato en servicio propio.

### D10. Interfaz: `src/components/retroalimentacion/` + ruta propia `/follow-up`

Montaje mínimo documentado por ruta propia (lo permitido para esta rama):

- `src/app/(protected)/follow-up/index.tsx` — selector de paciente (reutiliza `listPatients` y
  `getPatient` de `src/features/registro/ficha-service`, importados, no editados).
- `src/app/(protected)/follow-up/[patientId].tsx` — panel de evolución del seguimiento: selector de
  consulta cerrada del paciente (con lo indicado en su epicrisis efectiva como contexto, vía
  `effectiveEpicrisis`/`listEpicrisisByConsultation` importados), formulario de nueva entrada,
  cronología con correcciones y reporte diferenciado de eventos adversos.
- Componentes: `feedback-form.tsx` (TanStack Form + Zod), `feedback-timeline.tsx` (reutiliza
  `AttributionBadge` y `CorrectionHistory` de `src/components/clinical/`) y
  `adverse-event-report.tsx` (sección propia; `grave` destacado).

SC-037 («sin recurrir a texto libre para los campos categóricos») es estructural en el formulario:
`adherence`, `evolution` y `severity` se registran con controles de selección; el texto libre solo
describe (`evolutionNote`, `treatmentApplied`, `treatmentModification`, `revisedDiagnosis`,
descripción del evento adverso). Etiquetas programáticas, operabilidad por teclado, foco visible y
contraste del paletín vigente (WCAG 2.2 AA), `testID` estables.

**Requisito de integración (para el orquestador)**: añadir la entrada de navegación a `/follow-up`
desde `/home` (compartido y en edición por 002) y la llamada a `buildFeedbackAntecedents` en el
resumen previo. El montaje alcanzable hoy es la ruta documentada por URL directa.

### D11. Sin dependencias nuevas, sin Playwright; verificación declarada

Cero cambios en `package.json` (Principio III). La restricción de esta rama excluye Playwright: la
compuerta axe WCAG 2.2 AA + recorrido por teclado/foco/viewport sobre `/follow-up` queda como
**requisito de integración** sobre `tests/e2e/web/accessibility.spec.ts` (patrón que D12 de 002 ya
establece para sus pantallas) y como pendiente declarado. Lo verificable sin Playwright se verifica:
`bun run typecheck`, Biome sobre los archivos de este cambio, pruebas unitarias de lógica de
formulario y esquema, pruebas de servicio e integración viva. La verificación visual local y la
aceptación humana de SC-037 quedan explícitamente pendientes.

## Seguimiento de complejidad (Principio III)

| Complejidad nueva | Justificación exigida por el requisito | Se elimina cuando |
|---|---|---|
| Trigger `guard_clinical_feedback_immutable` | FR-024 · SC-022 · US10-AC5: el original permanece sin modificación | Nunca mientras la spec exija inmutabilidad |
| Trigger `validate_clinical_feedback` | FR-040 · FR-043 · SC-023 en el servidor (Constitución V); D3 estructural | Si SC-023 dejara de exigir integridad categórica garantizable |
| Cuatro funciones puras de lectura (D8) | Una por garantía recuperable: FR-056, FR-041/SC-035, FR-043/SC-023, FR-042 | Si cada garantía se verifica de otro modo |
| Capa `src/features/retroalimentacion` | FR-063/FR-070: una sola puerta de escritura con guardas de atribución | No aplica (misma razón que la capa de 002) |
| Rutas `/follow-up` + tres componentes | Montaje mínimo permitido para US10 completa | No aplica |

Dependencias de ejecución nuevas: **ninguna**. Capas arquitectónicas nuevas: **ninguna** (servicios y
pantallas sobre los patrones de `features/registro`, `lib/attribution` y `components/clinical`).
Complejidad rechazada explícitamente: tabla dedicada (D1), RPC propia (D6), campo de fecha extra
(D2), índice nuevo (D8), extensión del mapping de auditoría (D4).

## Presupuestos de rendimiento (verificables antes de integrar)

| Operación | Presupuesto | Cómo se verifica |
|---|---|---|
| Registrar o corregir una entrada | ≤ 2 s por operación (red local incluida) | aserción de tiempo en `tests/integration/retroalimentacion/feedback.test.ts` (tarea 3.1) |
| Cargar el panel de seguimiento (≤ 5 consultas, ≤ 30 entradas) | ≤ 2 s | aserción de tiempo en `tests/integration/retroalimentacion/feedback.test.ts` (tarea 3.2) |
| `buildFeedbackTimeline` + `aggregateFeedback` sobre 100 entradas | ≤ 300 ms CPU cliente | prueba unitaria con temporización amplia (tarea 2.2) |

SC-037 (registro < 2 min sin texto libre en categóricos) tiene componente estructural verificable
(selects, tarea 4.1) y componente humano: su medición de tiempo es **aceptación pendiente**, como
SC-012/SC-013 lo fueron en 002.

## Verificación de principios constitucionales

- **I (especificación primero)**: este diseño y `tasks.md` preceden a cualquier código; los cambios
  de comportamiento pasarán primero por la spec (`openspec-update-change`).
- **II (pruebas primero)**: cada grupo de `tasks.md` abre con sus pruebas en rojo —pgTap y
  integración vía CI y clúster scratch, unidad local— observadas fallando por la razón prevista
  antes de implementar; evidencia incremental en `quickstart.md` desde la tarea 1.1 y consolidada
  en 5.2.
- **III (simplicidad/YAGNI)**: sin dependencias ni capas nuevas; complejidad justificada arriba,
  con su regla de eliminación; alternativas rechazadas por escrito en cada decisión.
- **IV (observabilidad)**: servicios con `logEvent` + `requestId` y `captureClientError` en fallos
  (patrón de `epicrisis-service`); el trigger de validación no loguea contenido clínico y la traza
  FR-063 ya emite `clinical_feedback_recorded`/`corrective_record_created` con autor y momento;
  ninguna excepción silenciada.
- **V (seguridad)**: RLS y triggers del servidor siguen siendo el control; atribución derivada de la
  sesión en el servidor (ningún campo de atribución aceptado del cliente, guardas existentes);
  validación Zod en el cliente y **réplica en el servidor** (D5); sin secretos nuevos.
- **Accesibilidad web (WCAG 2.2 AA)**: etiquetas programáticas, operación por teclado, foco visible
  y contraste en los componentes nuevos (D10); su compuerta automatizada (axe + teclado/foco +
  viewport) queda como requisito de integración al no admitir esta rama Playwright (D11): declarado,
  no cumplido.

## Migración y reversión

`012_retroalimentacion_clinica.sql` es aditiva y sin backfill: dos funciones `returns trigger` y sus
triggers sobre `clinical_records`; no toca datos, grants, policies ni funciones existentes. Su
reversión es eliminar los dos triggers y sus funciones; ningún dato queda ilegible (la
retroalimentación ya registrada son filas de `clinical_records` que siguen siendo consultables con
la validación e inmunidad retiradas). El orden de aplicación lo garantiza el prefijo numérico
(012 tras 009; los huecos 010/011 pertenecen a ramas hermanas y su merge es del orquestador).

## Risks / Trade-offs

- **`jsonb` sin FK** (heredado de D1 de 002): una escritura fuera de los servicios puede dejar
  `consultationId` huérfano o una correctiva apuntando mal. Mitigación: el trigger de D5 exige que
  `consultationId` resuelva a una consulta cerrada de la misma clínica (la referencia peor queda
  cortada en el servidor) y los servicios son la única puerta de escritura. Queda sin cerrar la
  escritura directa que corrija apuntando a otra consulta (D7 la impone solo en servicio): registrado
  como coste aceptado, igual que en 002.
- **Vocabularios categóricos sin ratificación del equipo clínico** (supuesto de la spec): los valores
  de D2 son el **default propuesto** y viven en un único punto (`schema.ts` + el vocabulario del
  trigger de D5 + su assert pgTap). Si el equipo define otros, el cambio se acota a esos tres
  lugares sin reestructurar tareas. Ver Open Questions.
- **SC-036/FR-042 depende de una integración futura** (D9): hasta que el orquestador extienda
  `summaries.ts` y `/consultations/[id]`, la evolución se presenta solo en `/follow-up` y el criterio
  queda parcialmente verificado. Declarar pendiente no es cumplirlo.
- **Reabrir consultas cerradas** (agujero heredado del modelo de amenazas T055): un `UPDATE` directo
  sobre la fila de consulta podría devolverla a `open` y desactivar el sello de 002 para anamnesis y
  diagnósticos. Para esta entidad el impacto es nulo por el trigger de D4; para el resto queda como
  nota de integración a 002 (un guard de no-reapertura cerraría el agujero).
- **Verificación visual y axe automatizado imposibles en esta rama** (sin Playwright, restricción
  explícita): las pantallas se verifican por typecheck, Biome, pruebas unitarias de lógica y
  compilación; falta una pasada visual/axe cuando el entorno y el alcance lo permitan. Pendiente
  declarado, no compuerta cumplida.
- **Ciclos TDD lentos para SQL** (rojo/verde por CI + clúster scratch `/tmp/verify-005/`): se mitigan
  con una suite enfocada; las URLs de ejecución y la salida del clúster quedan como evidencia en
  `quickstart.md`.
- **SC-037 en su componente de tiempo** y cualquier medición con usuarios requiere evaluación
  humana: no se afirma como cumplido.

## Open Questions

- **Vocabularios categóricos (D2)**: la spec asume que el equipo clínico define los valores
  admisibles de adherencia y evolución antes de la implementación. *Default propuesto* (bloqueante
  solo en su enumeración exacta, no en el diseño): `adherence = completa | parcial | ninguna |
  desconocida`, `evolution = mejoria | mejoriaParcial | sinCambios | empeoramiento | desconocida`,
  `severity = leve | moderado | grave`. Si se ratifican otros, cambian únicamente los vocabularios
  de `schema.ts`, del trigger de D5 y de su assert pgTap; la estructura de tareas no se mueve.
- **Corrección que reasocie la consulta (D7)**: *default propuesto* — no se permite; una entrada
  mal asociada se corrige con nota (`evolutionNote`) y la asociación correcta se registra como
  entrada nueva. Si la revisión exige reasociación, se acota a `feedback-service` + trigger de D5 +
  pgTap.
