# Diseño de implementación: Registro clínico longitudinal

**Fecha**: 2026-09-22 | **Especificación**: [registro-clinico-longitudinal](specs/registro-clinico-longitudinal/spec.md)

**Entrada**: propuesta y especificación del cambio; [identidad y acceso](../implementar-identidad-y-acceso/design.md)
implementada y mergeada (PRs #2–#5, #13). Este diseño se aprueba antes de `tasks.md`; su
implementación sigue el Rojo-Verde-Refactor obligatorio.

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
  `ATTRIBUTION_CONTROL_FIELDS`, respuesta `ClinicalMutationResult`).
- RLS exige sesión de acceso activa y clínica compartida; los logs estructurados usan
  `log_server_event` en SQL y `logEvent`/`captureClientError` en el cliente.

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
- Flujo e2e funcional Playwright nuevo y verificación visual local en esta tanda (ver Riesgos).

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
| `anamnesis` | `{ consultationId, field: AnamnesisField, text, provenance: 'reportada' \| 'inferida' \| 'desconocida', provenanceHistory?: ProvenanceEntry[] }` |
| `diagnosis` | `{ consultationId, text }` |
| `epicrisis` | `{ consultationId, motivoConsulta, antecedentesRelevantes, hallazgosAnamnesis, hipotesis: [{ texto, estado }], diagnostico, examenesSolicitados: string[], intervencionesPropuestas: string[], medicamentosAprobados: string[], recomendacionesTutor, planSeguimiento: { pendientes: string[] }, observaciones }` |

`Item = { text, negative: boolean }`: un ítem `negative: true` es un **hallazgo negativo
explícitamente registrado** y una lista vacía es **campo sin dato** (FR-044 exige distinguirlos;
un peso `null` es «sin dato», nunca un valor por omisión). `AnamnesisField` enumera los campos
estructurados de US2 (`motivo_consulta`, `comportamiento_problematico`, `frecuencia`, `duracion`,
`contexto`, `desencadenantes`, `cambios_recientes`, `ambiente`, `convivencia`, `alimentacion`,
`actividad`, `rutinas`, `tratamientos_anteriores`, `respuesta_tratamientos`) más `texto_libre`
(FR-004: ambos en una misma consulta). Los campos `hipotesis` y `medicamentosAprobados` quedan
vacíos: los poblán 006 y 007 (FR-011 lo permite explícitamente).

### D3. El borrador de epicrisis se arma con una función pura del cliente

`buildEpicrisisDraft(consulta, anamnesis, diagnosticos, ficha)` compone el borrador por ensamblaje
determinista de lo ya registrado en la sesión (US3-AC1), sin inferencia del sistema: quien decide
la procedencia es el veterinario (supuestos de la spec) y ninguna salida propia entra al historial
sin validación (FR-010, FR-021). *Alternativa rechazada*: generación en SQL o Edge Function — sin
ventaja, más difícil de probar y de traducir; el ensamblaje es derivación de datos, no lógica de
servidor.

### D4. Aprobación y cierre de consulta son atómicos

`approve_clinical_record` se extiende (`create or replace`, misma firma y respuesta) para que, al
aprobar una epicrisis con `content.consultationId`, cierre en la misma transacción la consulta
vinculada (`content.status = 'closed'`). Así US3-AC2 (almacena versión aprobada con aprobador y
momento) y el paso de la consulta al historial ocurren juntos, y FR-045 queda bien definido: todo
lo que no está aprobado sigue siendo retomable.

*Alternativa rechazada*: aprobar y cerrar como dos llamadas del cliente — deja el estado intermedio
«epicrisis aprobada + consulta abierta», que rompe la relación SC-014 (toda consulta cerrada con su
epicrisis) y volvería ambiguo el resumen de FR-013. Compatibilidad: una epicrisis sin
`consultationId` (fixtures pgTap de 001) no cierra nada, y las suites 001–007 siguen verdes. La
aprobación conserva su enumeración: `epicrisis_approved` sigue siendo la única acción del cierre
(el mapping de 001 no tiene `consultation_closed` a propósito: el cierre es consecuencia de la
aprobación, y el UPDATE de la fila de consulta emite `null`).

### D5. Las consultas cerradas sellan sus registros de trabajo

Trigger `guard_consultation_sealed` (`BEFORE UPDATE` sobre `clinical_records`): si la fila
`content.consultationId` apunta a una consulta `closed`, cualquier UPDATE fracasa con
`CLINICAL_RECORD_SEALED` (SQLSTATE 23514). Cumple FR-024 y US4-AC2 («los registros de la consulta
anterior permanecen idénticos») también sobre anamnesis y diagnósticos, no solo sobre epicrisis.

*Alternativa rechazada*: marcar como `approved` los registros de trabajo al cerrar — `approved`
significa «validado como registro definitivo» y su camino (RPC de aprobación) está reservado a la
epicrisis; crear un segundo camino de aprobación lo contradiría. Las fichas (`patient`, `tutor`)
carecen de `consultationId` y siguen editables: la ficha se amplía entre consultas sin alterar
epicrisis aprobadas (caso límite de la spec).

### D6. Tutor sin duplicar: referencia por `tutorId` en la ficha

US1-AC4: un segundo paciente puede asociarse al tutor existente; la ficha guarda `tutorId` y el
formulario ofrece buscar/crear tutor. Sin FK posible dentro de `jsonb`, la integridad la aseguran
el servicio de fichas (única puerta de escritura) y una prueba de integración que verifica dos
pacientes apuntando a un único `tutor` (la deduplicación es de UI/servicio, no de constraint; ver
Riesgos).

### D7. Corrección de procedencia en anamnesis: corrección recuperable

US2-AC5 («queda registrado como reportado y la corrección es recuperable»): el UPDATE del registro
de anamnesis actualiza `content.provenance` y **agrega** la procedencia anterior a
`content.provenanceHistory`; el trigger de auditoría ya emite `anamnesis_corrected` con autor y
momento. El estado previo queda recuperable desde la fila y desde la traza. FR-024 exige registro
adicional para corregir **registros clínicos aprobados** (US3-AC4), que se cubre con la epicrisis
correctiva (D8); extender ese mecanismo a la corrección de procedencia en curso sería una lectura
más fuerte que la que pide el escenario.

### D8. Epicrisis correctiva: registro adicional que conserva el original

US3-AC4/FR-024: corregir una epicrisis aprobada crea una fila nueva (`status = 'corrective'`,
`supersedes_event_id` = evento `epicrisis_approved` original, acción enumerada
`corrective_record_created`), con el contenido corregido. El original permanece legible e
intocable (`guard_approved_clinical_record`); `CorrectionHistory` presenta la cadena.

### D9. Toda mutación cruza el contrato de atribución

Los servicios de `src/features/registro/` escriben solo vía `src/lib/attribution`
(`createClinicalRecord` y las extensiones `updateClinicalContent`, `approveClinicalRecord`,
`createCorrectiveRecord`), que rechazan campos de control (`ATTRIBUTION_CONTROL_FIELDS`) y devuelven
`ClinicalMutationResult` con la atribución real leída de la traza (contrato de
`contracts/clinical-attribution.md`: respuesta verificable sin estado efímero de la UI).

### D10. Lecturas como funciones puras + consultas simples

`buildPatientHistory` (FR-002/US4-AC4, orden cronológico), `buildFollowUpSummary`
(FR-013/US4-AC1/AC3: diagnóstico previo, intervenciones, recomendaciones, exámenes y pendientes
señalados, a partir de las epicrisis efectivas), `effectiveEpicrisis` (approved + correctivas que
las superseden) y `computeMissingFichaFields` (FR-044) son funciones puras unit-testeadas; las
consultas Supabase son lecturas por `content->>` con índices de expresión
(`patientId`, `consultationId`) agregados en la migración.

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

### D12. Sin dependencias nuevas; alcance de e2e acotado y declarado

Cero cambios en `package.json` (Principio III). La suite web solo se amplía con el escaneo de
accesibilidad axe de las pantallas nuevas (`accessibility.spec.ts`, compuerta WCAG existente). No se
escribe flujo funcional Playwright nuevo en esta tanda porque el entorno no permite ejecutarlo ni
depurarlo; la verificación funcional la cargan pgTap y las pruebas de integración viva en CI. La
aceptación de SC-012 y SC-013 es humana y queda explícitamente pendiente.

## Seguimiento de complejidad (Principio III)

| Complejidad nueva | Justificación exigida por el requisito | Se elimina cuando |
|---|---|---|
| Trigger `guard_consultation_sealed` | FR-024 / US4-AC2: registros de consultas cerradas idénticos | Nunca mientras la spec exija inmutabilidad |
| Extensión de `approve_clinical_record` | FR-012 + SC-014: aprobación y cierre en un paso | Nunca; es refinamiento del camino de aprobación existente |
| Índices de expresión sobre `content->>` | FR-002 / FR-013 con carga realista (presupuestos abajo) | Si el modelo deja `jsonb` |
| `provenanceHistory` en el contenido | US2-AC5: corrección recuperable | Si se exige registro adicional para anamnesis (ver Riesgos) |
| `discard` en el ciclo del borrador | Cierre explícito de consulta; la 001 lo dejó anticipado | No aplica |
| Capa `src/features/registro` | FR-063: una sola puerta de escritura con guardas de atribución | No aplica |

Dependencias de ejecución nuevas: **ninguna**. Capas arquitectónicas nuevas: **ninguna** (servicios
y pantallas sobre los patrones de `features/auth`, `features/clinical` y `lib/attribution`).

## Presupuestos de rendimiento (verificables antes de integrar)

| Operación | Presupuesto | Cómo se verifica |
|---|---|---|
| Crear/actualizar ficha o antecedente | ≤ 2 s por operación (red local incluida) | umbral laxo en integración viva (detecta regresiones groseras) |
| Abrir consulta con resumen (≤ 3 consultas previas) | ≤ 2 s | umbral laxo en integración viva |
| Ensamblar borrador de epicrisis | ≤ 300 ms CPU cliente | prueba unitaria con temporización amplia (función pura) |
| Listar fichas (≤ 200 pacientes) | ≤ 2 s | umbral laxo en integración viva |

SC-012 (registro de ficha < 3 min sin asistencia) y SC-008/SC-013 son medición con usuarios o
especialistas: quedan como **pendiente de aceptación**, no como verificados.

## Verificación de principios constitucionales

- **I (especificación primero)**: este diseño y `tasks.md` preceden a cualquier código; los cambios
  de comportamiento pasarán primero por la spec (`openspec-update-change`).
- **II (pruebas primero)**: cada grupo de `tasks.md` abre con sus pruebas en rojo —pgTap e
  integración vía CI, unidad local— observadas fallando por la razón prevista antes de implementar;
  evidencia con URLs de ejecución en `quickstart.md`.
- **III (simplicidad/YAGNI)**: sin dependencias ni capas nuevas; complejidad justificada arriba.
- **IV (observabilidad)**: servicios con `logEvent` + `requestId` y `captureClientError` en fallos;
  SQL con `log_server_event` (patrón `approve_clinical_record`); ninguna excepción silenciada.
- **V (seguridad)**: RLS y triggers del servidor siguen siendo el control; validación Zod en cada
  formulario; ningún campo de atribución aceptado del cliente; sin secretos nuevos.
- **Accesibilidad web (WCAG 2.2 AA)**: etiquetas programáticas, teclado, foco visible y contraste;
  compuerta axe en CI sobre las pantallas nuevas.

## Risks / Trade-offs

- **Verificación visual y e2e local imposibles** (sin Supabase local ni Playwright): las pantallas
  se verifican por typecheck, lint, compilación y el escaneo axe en CI; el flujo funcional lo cubre
  la integración viva de CI. Se declara en la PR y en `quickstart.md`; queda pendiente una pasada
  manual/e2e cuando el entorno lo permita.
- **`jsonb` sin FK** (D1/D6): un cliente que escriba fuera de los servicios puede dejar referencias
  huérfanas; RLS no lo impide. Mitigación: servicios únicos de escritura, pruebas de integración y
  este registro explícito. Es el coste de no crear una segunda convención de persistencia.
- **Lectura de US2-AC5** (D7): si la revisión exige que toda corrección —incluida la de
  procedencia— cree registro adicional, el cambio se acota a `anamnesis-service` (+ pgTap).
- **Ciclos TDD lentos para SQL** (rojo/verde por CI): se mitigan con suites pequeñas y enfocadas;
  las URLs de las ejecuciones quedan como evidencia.
- **SC-012 y SC-013** requieren evaluación humana: no se afirman como cumplidos.
