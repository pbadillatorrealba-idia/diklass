# Diseño de implementación: Registro clínico longitudinal

**Fecha**: 2026-09-22 | **Especificación**: [registro-clinico-longitudinal](specs/registro-clinico-longitudinal/spec.md)

**Entrada**: propuesta y especificación del cambio; [identidad y acceso](../implementar-identidad-y-acceso/design.md)
implementada y mergeada (PRs #2–#5, #13). Este diseño se aprueba antes de `tasks.md`; su
implementación sigue el Rojo-Verde-Refactor obligatorio.

**Revisión del plan (2026-09-22)**: revisión cruzada spec↔diseño↔tareas con veredicto «Con
correcciones»; hallazgos aplicados a D2, D4, D5, D7, D8, D10, D12, presupuestos y riesgos.

## Context

La capa de identidad y atribución ya existe y está endurecida en `main`:

- `public.clinical_records` es la tabla polimórfica de registros clínicos (`record_type`,
  `content jsonb`, `status` en `draft|approved|corrective`, `supersedes_event_id`) con columnas de
  atribución que el servidor fija (`created_by`, `created_at`, `updated_by`, `updated_at`,
  `approved_by`, `approved_at`).
- `public.clinical_audit_events` registra la traza con enumeración taxativa de FR-063
  (`entity_type`, `action`) que ya contiene las entidades de las siete funcionalidades:
  `patient`, `tutor`, `consultation`, `anamnesis`, `audio_fact`, `missing_information`,
  `hypothesis`, `diagnosis`, `pharmacological_treatment`, `non_pharmacological_treatment`,
  `epicrisis`, `clinical_feedback`, y acciones como `patient_created`, `consultation_opened`,
  `anamnesis_recorded`, `anamnesis_corrected`, `diagnosis_recorded`, `epicrisis_approved`,
  `corrective_record_created`.
- Triggers `deny_attribution_mutation`, `stamp_update_attribution`, `guard_approved_clinical_record`
  y `audit_clinical_record` hacen cumplir la atribución y la inmutabilidad de lo aprobado; la
  función `clinical_record_action` mapea cada transición a la acción enumerada y devuelve `null`
  cuando la transición no tiene acción (edición de borradores, cierre de consulta). El comentario
  del propio mapping dice: «Spec 002 refines this mapping as it introduces the concrete clinical
  entities».
- RPC `approve_clinical_record(uuid)` aprueba solo `record_type = 'epicrisis'`, deriva el aprobador
  de la sesión y emite `epicrisis_approved`.
- Contrato de cliente en `src/lib/attribution/` (`createClinicalRecord`, guardas
  `ATTRIBUTION_CONTROL_FIELDS`, respuesta `ClinicalMutationResult`); su especificación vive en
  [`../implementar-identidad-y-acceso/contracts/clinical-attribution.md`](../implementar-identidad-y-acceso/contracts/clinical-attribution.md).
- RLS exige sesión de acceso activa y clínica compartida; la política de actualización (T055)
  permite a cualquier veterinario activo de la clínica editar filas no aprobadas — premisa de
  amenaza de D5 —; los logs estructurados usan `log_server_event` en SQL y
  `logEvent`/`captureClientError` en el cliente.

Restricción de esta ejecución: no hay Docker/Supabase local ni Playwright disponibles. Las suites
pgTap y las de integración viva solo **se ejecutan** en el job `database` de CI; el ciclo
rojo-verde de esas suites se observa por tanto en ejecuciones de CI (se registran sus URLs), y las
pruebas de unidad con `bun test` localmente. Es una limitación de verificación declarada, no una
reducción de alcance.

## Goals / Non-Goals

**Goals:**

- Materializar las entidades de la spec (Paciente, Tutor, Consulta, Anamnesis/Observación,
  Diagnóstico, Epicrisis) sobre la infraestructura existente, sin una segunda convención de
  persistencia.
- Los cuatro flujos de usuario de la spec (ficha, consulta con anamnesis, epicrisis validada,
  seguimiento longitudinal) operativos en la app.
- Las garantías de FR-024, FR-010, FR-012, FR-021 y FR-063 verificadas por pruebas (pgTap e
  integración viva), no solo por UI.

**Non-Goals:**

- Extracción automática de antecedentes (spec 004), hipótesis pobladas (006), medicamentos
  prescritos (007) y evolución posterior (005): FR-011 y FR-013 reservan sus campos vacíos.
- Gestión de cuentas, multi-tenancy, multi-especie, i18n, voz.
- Flujo e2e funcional Playwright completo en esta tanda (ver D12 y Riesgos).

## Decisions

### D1. Las entidades de 002 son filas de `clinical_records` (convención existente)

Paciente, Tutor, Consulta, Anamnesis, Diagnóstico y Epicrisis se persisten como filas de
`clinical_records` con el `record_type` ya enumerado y el detalle en `content jsonb`. El cierre de
consulta y la aprobación usan los caminos ya endurecidos.

*Alternativa considerada*: tablas relacionales dedicadas (`patients`, `tutors`, …) con las mismas
columnas de atribución. *Rechazada*: crearía una segunda convención de persistencia clínica junto
al `clinical_records` que la 001 construyó exactamente para esto (Principio III y regla de
«reutilizar el patrón existente»), duplicaría triggers/grants/RLS, y exigiría regenerar
`src/lib/supabase/database.types.ts` con `supabase gen types`, imposible sin Supabase local: la
compuerta de CI que diff-a los tipos quedaría roja por un cambio de forma innecesario. El coste
aceptado (integencia referencial dentro de `jsonb`) se mitiga en D6 y queda registrado en Riesgos.

### D2. Forma del contenido por entidad (vocabulario de la interfaz y el contrato)

Claves `camelCase`; `zod` valida toda frontera de entrada (Principio V).

| `record_type` | `content` |
|---|---|
| `patient` | `{ name, species, breed, birthDate \| null, ageMonths \| null, weightKg \| null, sex, reproductiveStatus, antecedentes: { medicalHistory: Item[], preexistingDiseases: Item[], currentMedications: Item[], knownAllergies: Item[], behavioralHistory: Item[] }, tutorId }` |
| `tutor` | `{ name, phone: string \| null, email: string \| null }` (al menos un medio de contacto, FR-027) |
| `consultation` | `{ patientId, status: 'open' \| 'closed' }` |
| `anamnesis` | `{ consultationId, field: AnamnesisField, text, provenance: Provenance, provenanceHistory?: { provenance: Provenance }[] }` |
| `diagnosis` | `{ consultationId, text }` |
| `epicrisis` | `{ consultationId, motivoConsulta, antecedentesRelevantes, hallazgosAnamnesis, hipotesis: [{ texto, estado }], diagnostico, examenesSolicitados: string[], intervencionesPropuestas: string[], medicamentosAprobados: string[], recomendacionesTutor, planSeguimiento: { pendientes: string[] }, observaciones }` |

`Item = { text, negative: boolean }`: un ítem `negative: true` es un **hallazgo negativo
explícitamente registrado** y una lista vacía es **campo sin dato** (FR-044 y SC-024 exigen
distinguirlos; un peso `null` es «sin dato», nunca un valor por omisión). `AnamnesisField` enumera
los campos estructurados de US2 (`motivo_consulta`, `comportamiento_problematico`, `frecuencia`,
`duracion`, `contexto`, `desencadenantes`, `cambios_recientes`, `ambiente`, `convivencia`,
`alimentacion`, `actividad`, `rutinas`, `tratamientos_anteriores`, `respuesta_tratamientos`) más
`texto_libre` (FR-004: ambos en una misma consulta). Los campos `hipotesis` y
`medicamentosAprobados` quedan vacíos: los poblán 006 y 007 (FR-011 lo permite explícitamente).

`Provenance` sigue el **vocabulario canónico de FR-021** (brief §7): `'reportada' | 'inferida' |
'recuperada' | 'desconocida'`. Los escenarios de 002 ejercitan `reportada`, `inferida` y
`desconocida`; `'recuperada'` (información recuperada de una fuente) queda admitida desde ya porque
las specs 003 y 004 aterrizan hechos con esa procedencia en esta misma anamnesis y una
especialización no puede contradecir el enunciado canónico. Cerrar el enum en tres valores forzaría
a romper el contrato después.

### D3. El borrador de epicrisis se arma con una función pura del cliente

`buildEpicrisisDraft(consulta, anamnesis, diagnosticos, ficha)` compone el borrador por ensamblaje
determinista de lo ya registrado en la sesión (US3-AC1), sin inferencia del sistema: quien decide
la procedencia es el veterinario (supuestos de la spec) y ninguna salida propia entra al historial
sin validación (FR-010, FR-021). *Alternativa rechazada*: generación en SQL o Edge Function — sin
ventaja, más difícil de probar y de traducir; el ensamblaje es derivación de datos, no lógica de
servidor.

### D4. Aprobación y cierre de consulta son atómicos, en este orden

**El cierre solo ocurre por la aprobación** (migración 013, tarea 7.10): el trigger
`guard_consultation_close` exige que una consulta nazca `open`, que su estado pertenezca a
{`open`, `closed`} (`CONSULTATION_STATUS_INVALID`) y que la transición `open → closed` encuentre una
epicrisis `approved` de esa misma consulta y clínica (`CONSULTATION_CLOSE_REQUIRES_APPROVAL`). Como
`approve_clinical_record` aprueba la epicrisis antes de cerrar la consulta, la condición se cumple
por ese camino sin tocar la función, y un `UPDATE` o `INSERT` directo por la Data API ya no puede
dejar una consulta cerrada sin epicrisis (SC-014). Los fixtures pgTap de 004 y 005 cierran sus
consultas aprobando una epicrisis, como la aplicación.

`approve_clinical_record` se extiende (`create or replace`, misma firma y respuesta) para que, al
aprobar una epicrisis con `content.consultationId`, cierre en la misma transacción la consulta
vinculada (`content.status = 'closed'`). Así US3-AC2 (almacena versión aprobada con aprobador y
momento) y el paso de la consulta al historial ocurren juntos, y FR-045 queda bien definido: todo
lo que no está aprobado sigue siendo retomable.

**Orden de escritura obligatorio**: primero el `UPDATE` de la epicrisis (`approved_by`,
`approved_at`, `status`) y **después** el `UPDATE` que cierra la consulta. El trigger de sellado de
D5 evalúa sobre `old` y mataría la propia aprobación con `CLINICAL_RECORD_SEALED` si el cierre
viniera antes (la epicrisis apunta a esa consulta y pasaría a estar «cerrada»). La suite pgTap
incluye una aserción que delata la inversión del orden.

*Alternativa rechazada*: aprobar y cerrar como dos llamadas del cliente — deja el estado intermedio
«epicrisis aprobada + consulta abierta», que rompe la relación SC-014 (toda consulta cerrada con su
epicrisis) y volvería ambiguo el resumen de FR-013. Compatibilidad: una epicrisis sin
`consultationId` (fixtures pgTap de 001) no cierra nada, y las suites 001–007 siguen verdes. La
aprobación conserva su enumeración: `epicrisis_approved` sigue siendo la única acción del cierre
(el mapping de 001 no tiene `consultation_closed` a propósito: el cierre es consecuencia de la
aprobación, y el UPDATE de la fila de consulta emite `null`).

### D5. Las consultas cerradas sellan sus registros de trabajo (evaluado sobre `old`, sin repunteo)

Trigger `guard_consultation_sealed` (`BEFORE INSERT OR UPDATE` sobre `clinical_records`;
tras el Problema 2 de la revisión de la PR #27 el sellado también cubre el INSERT —salvo la
epicrisis correctiva de D8—, y tras la segunda revisión sella también la fila de la consulta y
serializa con el cierre, puntos 4 y 5):

1. Evalúa el sellado sobre **`old.content->>'consultationId'`**: si esa referencia resuelve a una
   consulta `closed`, todo `UPDATE` fracasa con `CLINICAL_RECORD_SEALED` (SQLSTATE 23514).
2. **Rechaza además todo cambio del propio vínculo**: si `old.content->>'consultationId'` no es
   nulo, `new.content->>'consultationId'` debe ser igual (ni repuntear a otra consulta, ni
   anularse). Sin esto, un `UPDATE` con payload que reescribiera `consultationId` burlaría un
   sellado evaluado sobre `new` — y la política T055 permite a cualquier veterinario de la clínica
   hacer `UPDATE` directo por PostgREST sobre filas no aprobadas, que son exactamente las anamnesis
   y diagnósticos que este sellado promete proteger.

3. **Cubre también el INSERT** (corrección de la revisión de la PR #27): una fila de trabajo
   cuyo `content.consultationId` resuelve a una consulta `closed` no puede crearse por el
   camino directo de PostgREST (premisa de amenaza T055), salvo la **epicrisis** con
   `status='corrective'` — la correctiva de D8 se anexa legítimamente a la consulta cerrada. La
   exención es solo de la epicrisis (segunda revisión de la PR #27): una anamnesis o un
   diagnóstico `corrective` haría crecer el workspace sellado. Los `consultationId` que no
   resuelven a ninguna consulta se toleran (huérfanos: riesgo documentado de D1/D6).

   **Alcance: el conjunto de registros de TRABAJO** (`record_type` en `anamnesis`, `diagnosis`,
   `epicrisis` — el set que fija SC-009). Los registros longitudinales que solo referencian la
   consulta —`clinical_feedback` de la spec 005, que se registra legítimamente entre consultas
   sobre una consulta cerrada (US10-AC1), y en general datos nuevos de specs futuras— no quedan
   sellados por esta 002: su inmutabilidad y vocabulario los fija su propia spec (D4/D5 de 005).
   El guard de inmutabilidad del vínculo (`consultationId` inmutable) sí se aplica a TODO tipo.

4. **La fila de la consulta cerrada también es inmutable** (segunda revisión de la PR #27): todo
   `UPDATE` de una fila `consultation` cuyo `old.content->>'status'` es `closed` fracasa con
   `CLINICAL_RECORD_SEALED`. Sin esto, un `UPDATE` directo por PostgREST devolvía el estado a
   `open` (RLS lo permite: la consulta no tiene `approved_at`) y los puntos 1–3 dejaban de
   aplicar. Cerrar es irreversible; `approve_clinical_record` solo cierra consultas `open`, así
   que ningún camino legítimo actualiza una consulta ya cerrada.
5. **Serializa con el cierre**: la lectura del estado de la consulta se hace con `FOR SHARE`. Bajo
   READ COMMITTED, sin el bloqueo, un INSERT concurrente con la aprobación leía el `open` ya
   confirmado y entraba en una consulta que se estaba cerrando. Con él espera al cierre y, tras
   su confirmación, ve `closed` y fracasa. Verificado con dos sesiones concurrentes contra
   Supabase local (sin el bloqueo entra 1 fila; con él, 0).

Cumple FR-024, SC-009 y US4-AC2 («los registros de la consulta anterior permanecen idénticos»)
también sobre anamnesis y diagnósticos, no solo sobre epicrisis, y con ello el conjunto del
workspace de una consulta cerrada queda estable (SC-009).

*Alternativa rechazada*: marcar como `approved` los registros de trabajo al cerrar — `approved`
significa «validado como registro definitivo» y su camino (RPC de aprobación) está reservado a la
epicrisis; crear un segundo camino de aprobación lo contradiría. Las fichas (`patient`, `tutor`)
carecen de `consultationId` y siguen editables: la ficha se amplía entre consultas sin alterar
epicrisis aprobadas (caso límite de la spec, ejercitado en las pruebas de integración).

### D6. Tutor sin duplicar: referencia por `tutorId` en la ficha

US1-AC4: un segundo paciente puede asociarse al tutor existente; la ficha guarda `tutorId` y el
formulario ofrece buscar/crear tutor. Sin FK posible dentro de `jsonb`, la integridad la aseguran
el servicio de fichas (única puerta de escritura) y una prueba de integración que verifica dos
pacientes apuntando a un único `tutor` (la deduplicación es de UI/servicio, no de constraint; ver
Riesgos).

**Edición compartida sin pérdida (T055, segunda revisión de la PR #27).** Dos veterinarios de la
clínica editan la misma ficha. `updatePatientFicha` actualiza solo los datos de la ficha: el tutor
y los antecedentes se toman de la fila recién leída, porque los antecedentes crecen solo con
`addAntecedentItem` y tomarlos de la lectura de quien llama borraba los añadidos entretanto. Las
dos escrituras releen la ficha y la actualizan solo si `updated_at` no cambió (control optimista,
hasta 3 intentos): dos antecedentes añadidos a la vez se conservan los dos. Los datos escalares
de la ficha (nombre, peso…) siguen siendo «gana la última edición».

### D7. Corrección de procedencia en anamnesis: corrección recuperable

US2-AC5 («queda registrado como reportado y la corrección es recuperable»): el UPDATE del registro
de anamnesis actualiza `content.provenance` y **agrega** la procedencia anterior a
`content.provenanceHistory`; el trigger de auditoría emite `anamnesis_corrected` con autor y
momento. La recuperación del estado previo vive en `content.provenanceHistory` (dentro de la fila);
la traza acredita **que** hubo una corrección, **quién** y **cuándo**, pero no conserva el valor
superado (el metadata del evento es `{recordType, status}`). FR-024 exige registro adicional para
corregir **registros clínicos aprobados** (US3-AC4), que se cubre con la epicrisis correctiva (D8);
extender ese mecanismo a la corrección de procedencia en curso sería una lectura más fuerte que la
que pide el escenario.

### D8. Epicrisis correctiva: registro adicional que conserva el original

US3-AC4/FR-024: corregir una epicrisis aprobada crea una fila nueva (`status = 'corrective'`,
`supersedes_event_id` = evento `epicrisis_approved` original, acción enumerada
`corrective_record_created`), con el contenido corregido. El original permanece legible e
intocable (`guard_approved_clinical_record`); `CorrectionHistory` presenta la cadena. Si hubiera
varias correcciones de la misma epicrisis, todas apuntan al **mismo** evento `epicrisis_approved`
original y `effectiveEpicrisis` elige la correctiva más reciente (la última en el tiempo que
supersede a la original).

### D9. Toda mutación cruza el contrato de atribución

Los servicios de `src/features/registro/` escriben solo vía `src/lib/attribution`
(`createClinicalRecord` y las extensiones `updateClinicalContent`, `approveClinicalRecord`,
`createCorrectiveRecord`), que rechazan campos de control (`ATTRIBUTION_CONTROL_FIELDS`) y devuelven
`ClinicalMutationResult` con la atribución real leída de la traza (contrato de
[`../implementar-identidad-y-acceso/contracts/clinical-attribution.md`](../implementar-identidad-y-acceso/contracts/clinical-attribution.md):
respuesta verificable sin estado efímero de la UI).

Tras un `UPDATE`, un evento de la traza anterior a `updated_at` describe otra escritura (el alta):
no todos los `UPDATE` emiten evento (editar el borrador de la epicrisis emite `null`), así que la
atribución de reserva es `updated_by`/`updated_at` y no el creador. `updateClinicalContent` acepta
`expectedUpdatedAt` para el control optimista de D6 y lanza `ClinicalWriteConflictError` si la
fila cambió.

### D10. Lecturas como funciones puras + consultas simples

`buildPatientHistory` (FR-002/US4-AC4, orden cronológico), `buildFollowUpSummary`
(FR-013/US4-AC1/AC3: diagnóstico previo, intervenciones, recomendaciones, exámenes y pendientes
señalados, a partir de las epicrisis efectivas), `effectiveEpicrisis` (approved + correctivas que
la superseden) y `computeMissingFichaFields` (FR-044/SC-024) son funciones puras unit-testeadas.
Las consultas Supabase son lecturas por `content->>` con índices de expresión (`patientId`,
`consultationId`) agregados en la migración; el listado de fichas de la pantalla `/patients` usa
`listPatients` (con presupuesto de rendimiento verificado en 3.1). El historial de la ficha usa
`listPatientTimeline`, que lee las epicrisis de todas las consultas en una sola consulta (`in`), no
una por consulta. Las listas comparten una frontera de lectura tolerante, `parseRows`: una fila
fuera de contrato se omite con log `registro.row_content_skipped` en vez de tumbar la lista.

### D11. Interfaz: rutas nuevas, componentes de `src/components/registro`, WCAG 2.2 AA

`/patients` (lista), `/patients/new` (ficha + tutor con selector de tutor existente),
`/patients/[id]` (ficha con panel de campos faltantes y antecedentes, historial cronológico,
abrir consulta), `/consultations/[id]` (resumen previo automático, editor de anamnesis por campo
con procedencia y corrección, diagnóstico, generación/aprobación de epicrisis y corrección
posterior). Etiquetas programáticas (`FormControlLabel`), operabilidad completa por teclado, foco
visible y contraste del paletín vigente; `testID` estables para la suite web. Reutiliza
`AttributionBadge`, `CorrectionHistory` y `useDraftPreserver`; al cerrar la consulta se añade la
transición `discard` al ciclo del borrador local que la 001 dejó anticipada en
`src/lib/storage/drafts.ts`. Se conserva el `testID` `authenticated-identity` de `/home`, que la
suite e2e de 001 consulta.

Tras cada escritura, las pantallas invalidan todo el prefijo `['registro']` de React Query
(`invalidateRegistro`): una escritura cambia a la vez la ficha, los tutores, el historial y el
workspace, y el `staleTime` global de 30 s los dejaba desfasados al navegar. Los campos de lista
de la epicrisis (un ítem por línea) conservan el texto tal como se escribe y entregan al contenido
la lista limpia; si mostraran la lista recortada, cada pulsación borraría el espacio o el salto de
línea recién escrito.

### D12. Sin dependencias nuevas; alcance de e2e acotado y declarado

Cero cambios en `package.json` (Principio III). La suite web se amplía en `accessibility.spec.ts`
con: (a) el escaneo axe WCAG 2.2 AA de las pantallas nuevas, (b) un recorrido mínimo por teclado
con aserción de foco visible en cada control interactivo y (c) una comprobación de adaptabilidad a
viewport (375 px y 1280 px sin desbordamiento horizontal). Para que el escaneo ejerza las
superficies con más riesgo (procedencia por antecedente, negativo vs. sin dato, `CorrectionHistory`,
resumen de seguimiento), la tarea 5.1 provisiona un caso clínico sintético (paciente, tutor, dos
consultas, anamnesis, epicrisis aprobada y correctiva) por API con las credenciales provisionadas,
siguiendo el patrón de `tests/e2e/web/attribution.spec.ts`. Lo que **no** se cubre en esta tanda es
el flujo funcional e2e completo del recorrido clínico: su verificación funcional la cargan pgTap y
las pruebas de integración viva en CI, y el aplazamiento queda como pendiente declarado del cambio
(no como compuerta cumplida). La aceptación de SC-012 y SC-013 es humana y queda explícitamente
pendiente.

Tras la segunda revisión de la PR #27 se añade `tests/e2e/web/registro-epicrisis.spec.ts` con dos
recorridos funcionales acotados, los que delataron defectos que las otras suites no veían:
escribir exámenes de varias palabras en varias líneas y guardarlos, y volver a la ficha tras
cerrar la consulta y ver el historial al día. El recorrido clínico completo sigue pendiente.

## Seguimiento de complejidad (Principio III)

| Complejidad nueva | Justificación exigida por el requisito | Se elimina cuando |
|---|---|---|
| Trigger `guard_consultation_sealed` | FR-024 / SC-009 / US4-AC2: registros de consultas cerradas idénticos | Nunca mientras la spec exija inmutabilidad |
| Extensión de `approve_clinical_record` | FR-012 + SC-014: aprobación y cierre en un paso | Nunca; es refinamiento del camino de aprobación existente |
| Índices de expresión sobre `content->>` | FR-002 / FR-013 con carga realista (presupuestos abajo) | Si el modelo deja `jsonb` |
| `provenanceHistory` en el contenido | US2-AC5: corrección recuperable | Si se exige registro adicional para anamnesis (ver Riesgos) |
| `discard` en el ciclo del borrador | Cierre explícito de consulta; la 001 lo dejó anticipado | No aplica |
| Capa `src/features/registro` | FR-063: una sola puerta de escritura con guardas de atribución | No aplica |
| Control optimista en escrituras de ficha (`expectedUpdatedAt`) | T055 + FR-001 · US1-AC2: edición compartida sin perder antecedentes | Si los antecedentes pasan a filas propias o a un apéndice en el servidor |

Dependencias de ejecución nuevas: **ninguna**. Capas arquitectónicas nuevas: **ninguna** (servicios
y pantallas sobre los patrones de `features/auth`, `features/clinical` y `lib/attribution`).

## Presupuestos de rendimiento (verificables antes de integrar)

| Operación | Presupuesto | Cómo se verifica |
|---|---|---|
| Crear/actualizar ficha o antecedente | ≤ 2 s por operación (red local incluida) | aserción de tiempo en `tests/integration/registro/ficha.test.ts` (tarea 3.1) |
| Listar fichas (≤ 200 pacientes) | ≤ 2 s | aserción de tiempo sobre `listPatients` en `tests/integration/registro/ficha.test.ts` (tarea 3.1) |
| Abrir consulta con resumen (≤ 3 consultas previas) | ≤ 2 s | aserción de tiempo en `tests/integration/registro/anamnesis.test.ts` (tarea 3.2) |
| Ensamblar borrador de epicrisis | ≤ 300 ms CPU cliente | prueba unitaria con temporización amplia (tarea 2.2) |

SC-012 (registro de ficha < 3 min sin asistencia) y SC-008/SC-013 son medición con usuarios o
especialistas: quedan como **pendiente de aceptación**, no como verificados.

## Verificación de principios constitucionales

- **I (especificación primero)**: este diseño y `tasks.md` preceden a cualquier código; los cambios
  de comportamiento pasarán primero por la spec (`openspec-update-change`).
- **II (pruebas primero)**: cada grupo de `tasks.md` abre con sus pruebas en rojo —pgTap e
  integración vía CI, unidad local— observadas fallando por la razón prevista antes de implementar;
  evidencia incremental en `quickstart.md` desde la tarea 1.1 y consolidada en 5.3.
- **III (simplicidad/YAGNI)**: sin dependencias ni capas nuevas; complejidad justificada arriba.
- **IV (observabilidad)**: servicios con `logEvent` + `requestId` y `captureClientError` en fallos;
  SQL con `log_server_event` (patrón `approve_clinical_record`); ninguna excepción silenciada.
- **V (seguridad)**: RLS y triggers del servidor siguen siendo el control; validación Zod en cada
  formulario; ningún campo de atribución aceptado del cliente; sin secretos nuevos.
- **Accesibilidad web (WCAG 2.2 AA)**: etiquetas programáticas, operación por teclado, foco visible
  y contraste; compuerta en CI con axe + recorrido por teclado/foco + viewport (D12).

## Risks / Trade-offs

- **E2E funcional parcial**: desde la segunda revisión de la PR #27, Supabase local (vía podman
  rootless) y Playwright corren en el entorno de desarrollo, y `registro-epicrisis.spec.ts` cubre
  dos recorridos (D12). El e2e funcional web del recorrido clínico completo sigue **pendiente y
  declarado**; la verificación visual manual, también.
- **`jsonb` sin FK** (D1/D6): un cliente que escriba fuera de los servicios puede dejar referencias
  huérfanas; RLS no lo impide. Mitigación: servicios únicos de escritura, pruebas de integración y
  este registro explícito. Es el coste de no crear una segunda convención de persistencia.
- **`provenanceHistory` dentro de contenido editable** (D7): un `UPDATE` directo podría borrarla;
  el sellado de D5 lo impide en consultas cerradas y la traza `anamnesis_corrected` acredita la
  corrección (autor/momento) aunque no el valor superado. Si la revisión exige que el valor previo
  viva también en la traza, el cambio se acota a `anamnesis-service`, el trigger de auditoría y
  pgTap.
- **Lectura de US2-AC5** (D7): si la revisión exige que toda corrección —incluida la de
  procedencia— cree registro adicional, el cambio se acota a `anamnesis-service` (+ pgTap).
- **Ciclos TDD para SQL**: el rojo/verde de pgTap y de la integración viva ya se observa en local
  (`supabase test db`, `SUPABASE_LIVE_TESTS=1`); CI sigue siendo la evidencia de referencia.
- **SC-012 y SC-013** requieren evaluación humana: no se afirman como cumplidos.
