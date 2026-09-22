# Tasks: Asistencia clínica proactiva

Convención: Rojo-Verde-Refactor obligatorio (Constitución II) — cada tarea de prueba se observa
fallando por la razón prevista antes de la implementación que cubre. Las suites pgTap y de
integración viva se ejecutan en el clúster PostgreSQL scratch `/tmp/verify-006/` (shims de roles
de API, `auth.users`, `auth.uid()`, `auth.jwt()` y pgtap; patrón del
[quickstart de 002](../../implementar-registro-clinico-longitudinal/quickstart.md)) y en el job
`database` de CI: su «rojo» previo se registra con su URL o su salida en `quickstart.md`, que se
crea al comenzar la implementación y se va llenando de forma incremental (consolidación final en
5.3). Las pruebas de unidad corren localmente con `bun test`. Cada tarea indica su criterio
observable de terminación y su trazabilidad. Requisitos de integración ya declarados en
`design.md`: RI-1 (montaje de «hipótesis consideradas» en la epicrisis, edición mínima en
archivos prohibidos que ejecuta el orquestador), RI-2 (enlace de navegación a `/support/**`) y
RI-3 (compuerta de accesibilidad/e2e de las pantallas nuevas).

## 1. Base de datos: garantías de la asistencia (pruebas primero)

- [ ] 1.1 Escribir `supabase/tests/012_asistencia_clinica.sql` (pgTap, patrón de
  `002_attribution_immutability.sql`/`008_registro_clinico.sql`: dos veterinarios con sesión de
  acceso activa, `set_config('request.jwt.claims', …)` y `set local role authenticated`) en rojo.
  Aserciones de reuso de la convención FR-063 (verde ya antes de la migración 013, documentan el
  contrato de 001): INSERT de `hypothesis` emite `hypothesis_added`, UPDATE con
  `content.decision = 'accepted' | 'discarded'` emite `hypothesis_accepted` | `hypothesis_discarded`
  y `missing_information` emite `missing_information_decided` en INSERT y UPDATE (FR-029 · FR-008
  · FR-063 · US7-AC2/AC6 · US8-AC2), atribución fijada por el servidor e inamovible por cliente,
  sellado de las filas al cerrar la consulta por el trigger heredado de 002 (FR-024 heredado ·
  D8), `approve_clinical_record` sigue rechazando no-epicrisis (una hipótesis o sugerencia nunca
  se convierte en registro aprobado, FR-010 · US8-AC3). Aserciones **en rojo por la razón
  prevista** (exigen el trigger 013): INSERT de `hypothesis` con `decision ≠ 'added'` rechazado,
  transición `decision` → `'added'` rechazada (`HYPOTHESIS_DECISION_IRREVERSIBLE`), inmutabilidad
  de la base de la hipótesis (`texto`/`origen`/`reglaId`/`insumos`/`respaldo` — FR-020 · US8-AC8,
  D8), inmutabilidad de la base de la decisión (`pregunta`/`suggestionKey`/`fundamento`), INSERT
  de `missing_information` con estado no decidido rechazado e INSERT de ambos tipos con
  `status ≠ 'draft'` rechazado (FR-010, D8). Verificación: la suite falla exactamente en las
  aserciones del trigger; «rojo» observado en `/tmp/verify-006/` y en el job `database` de CI con
  su URL registrada en `quickstart.md`.
- [ ] 1.2 Escribir `supabase/migrations/013_asistencia_clinica.sql`: función y trigger
  `guard_assistance_decisions` (`BEFORE INSERT OR UPDATE` sobre `clinical_records` acotado a
  `record_type in ('missing_information','hypothesis')`) con los invariantes de D8
  (`ASSISTANCE_STATUS_INVALID`, `ASSISTANCE_CONTENT_INVALID`, `HYPOTHESIS_DECISION_INVALID`,
  `HYPOTHESIS_DECISION_IRREVERSIBLE`, `HYPOTHESIS_BASIS_IMMUTABLE`,
  `MISSING_INFORMATION_STATE_INVALID`, `MISSING_INFORMATION_BASIS_IMMUTABLE`, todos SQLSTATE
  23514, sin duplicar el sellado heredado de 002 ni los guardas de atribución de 001).
  Verificación: suite `012` en verde en el clúster scratch y en el job `database` de CI, suites
  `001`–`009` siguen verdes con la 013 aplicada, y `supabase gen types` sin diff sobre
  `src/lib/supabase/database.types.ts` (sin diff esperado por ser trigger puro, Migration Plan).
- [ ] 1.3 Confirmar y documentar en `quickstart.md` qué transiciones emiten cada acción de FR-063
  (D1/D7: `missing_information_decided` en INSERT y UPDATE; `hypothesis_added` al nacer;
  `hypothesis_accepted`/`hypothesis_discarded` según `content.decision`) y que las filas de
  asistencia nacen y permanecen en `draft` (FR-010). Verificación: nota presente y suite `012` en
  verde.

## 2. Modelos y lógica determinista (pruebas de unidad primero)

- [ ] 2.1 Escribir en rojo `tests/unit/asistencia/schema.test.ts`: esquemas Zod y tipos de D2 —
  contenido de `missing_information` con `estado` decidido (`formulada|ignorada|no_aplicable`,
  FR-008 · US7-AC2/AC6) y `fundamento` distinguiendo fuente citada (cita documento+fragmento de
  003, FR-033 · US7-AC3) de `criterio_general` (US7-AC5); contenido de `hypothesis` con
  `decision: added|accepted|discarded` (FR-029 · US8-AC2 · D7), `origen: sistema|veterinario`
  (US8-AC9), `insumos` con procedencia canónica de FR-021 y papel `aFavor|enContra`
  (FR-020 · US8-AC8) y `respaldo` con citas, avisos y cobertura del contrato de 003 (FR-007 ·
  FR-023); modelo de presentación con las tres secciones de SC-019 y descargo constante de
  FR-010 (SC-031). Verificación: `bun test tests/unit` en rojo por los esquemas inexistentes;
  luego verde.
- [ ] 2.2 Escribir en rojo `tests/unit/asistencia/deteccion.test.ts` y luego implementar
  `src/features/asistencia/reglas.ts` (registro de sugerencias) y `deteccion.ts`
  (`detectMissingInformation`, `mergeSuggestionStates`, `composeFundamento`): pregunta sobre el
  contexto de «solo cuando el animal queda solo» propuesta ante la anamnesis incompleta del
  escenario (US7-AC1), antecedente ya cubierto no repropropuesto —incluido el hallazgo negativo
  explícito como cubierto (FR-044 heredado · SC-024) y cobertura por texto libre (US7-AC4)—,
  estados de decisión que retiran la sugerencia de las pendientes de la consulta (US7-AC2/AC6),
  fundamento con cita resoluble o etiqueta honesta de criterio general sobre recuperación
  simulada (FR-033 · US7-AC3/AC5 · FR-023) y campo faltante de ficha vía
  `computeMissingFichaFields` como sugerencia pertinente (FR-008). Incluir umbral laxo de
  detección ≤ 100 ms (presupuesto de `design.md`). Verificación: `bun test tests/unit`
  rojo→verde.
- [ ] 2.3 Escribir en rojo `tests/unit/asistencia/soporte-diferencial.test.ts` y luego implementar
  `src/features/asistencia/soporte-diferencial.ts` (`evaluateSuficiencia`, `matchRegla`,
  `composeHipotesisSoportada`, `composeHipotesisConsideradas`) sobre las reglas de `reglas.ts`:
  anamnesis vacía o por debajo de `MIN_CAMPOS_SUFICIENCIA` → aviso de información insuficiente
  nombrando lo faltante y cero hipótesis (FR-022 · US8-AC5, caso límite de anamnesis vacía);
  hipótesis presentada con a favor, en contra o su ausencia explícita, y faltante con sus campos
  discriminatorios (FR-009 · SC-019 · US8-AC1); antecedentes contradictorios reflejados en ambas
  ramas y marcados (caso límite); respaldo del contrato de 003 con citas documento+fragmento
  (FR-007 · US8-AC10) y propagación de `sin_respaldo_documental` con el límite de alcance cuando
  no hay respaldo (FR-023 · SC-030 · US8-AC7); descargo «apoyo a la decisión» siempre presente y
  sin vía de declararse diagnóstico definitivo (FR-010 · SC-031 · US8-AC3); `insumos` con
  snapshot de antecedentes, `fichaRef` y `terminosMatch` para reconstruir qué produjo la hipótesis
  (FR-020 · US8-AC8); `composeHipotesisConsideradas` derivando `propuesta|aceptada|descartada`
  de `added|accepted|discarded` en la forma `[{ texto, estado }]` de la epicrisis (FR-049 ·
  US8-AC6 · D7). Incluir umbral laxo de composición ≤ 300 ms (presupuesto de `design.md`).
  Verificación: `bun test tests/unit` rojo→verde.

## 3. Servicios de dominio (unidad local + integración viva en CI)

- [ ] 3.1 Escribir en rojo pruebas de `tests/unit/asistencia/asistencia-service.test.ts` y
  `tests/integration/asistencia/asistencia.test.ts` y luego implementar
  `src/features/asistencia/asistencia-service.ts` (`listSuggestions`, `decideMissingInformation`):
  sugerencias pendientes de la consulta con fundamento resuelto por la recuperación de 003
  (`consultKnowledge`/`search_knowledge_fragments` de `src/features/conocimiento`, contrato
  consumido sin editarlo) — cita con fragmento o etiqueta de criterio general (FR-033 · FR-008 ·
  US7-AC1/AC3/AC5) —, decisión `formulada | ignorada | no_aplicable` registrada como fila
  `missing_information` que emite `missing_information_decided` con atribución releída de la traza
  y rechazo de `ATTRIBUTION_CONTROL_FIELDS` (FR-008 · FR-063 · US7-AC2/AC6 · D9 · contrato de
  [`../../implementar-identidad-y-acceso/contracts/clinical-attribution.md`](../../implementar-identidad-y-acceso/contracts/clinical-attribution.md)),
  revisión posterior de una decisión como UPDATE que reemite la acción (D3/D7) y retiro de las
  pendientes sin insistir en la consulta (US7-AC2/AC4). Incluir aserciones de tiempo ≤ 500 ms por
  resolución de fundamento y ≤ 2 s por decisión (presupuestos de `design.md`). Verificación:
  `bun test tests/unit` verde local; `bun test tests/integration` con `SUPABASE_LIVE_TESTS=1`
  verde en el job `database` de CI.
- [ ] 3.2 Escribir en rojo pruebas de `tests/unit/asistencia/hipotesis-service.test.ts` y
  `tests/integration/asistencia/hipotesis.test.ts` y luego implementar
  `src/features/asistencia/hipotesis-service.ts` (`generateDifferentialSupport`, `decideHypothesis`,
  `addVetHypothesis`, `listHypotheses`): generación bajo petición del veterinario con la puerta de
  suficiencia primero (FR-022 · US8-AC5), ≤ `MAX_HIPOTESIS_PRESENTADAS` candidatas de reglas con
  respaldo compuesto por `consultKnowledge` por candidata (FR-009 · FR-007 · US8-AC1/AC10),
  persistencia de la fila `hypothesis` con `insumos`/`respaldo`/`knowledgeQueryId` que permite
  reconstruir posteriormente antecedentes y fuentes (FR-020 · US8-AC8, verificado por lectura de
  vuelta), ausencia de respaldo propagada como declaración explícita (FR-023 · SC-030 · US8-AC7),
  transiciones `accepted|discarded` con las acciones enumeradas y rechazo de volver a `added`
  (FR-029 · FR-063 · US8-AC2 · D7/HD5), hipótesis propia del veterinario registrada con
  `origen: 'veterinario'` y sin respaldo documental declarado si no lo hay (US8-AC9), ninguna
  salida convertida en diagnóstico ni en registro aprobado (FR-010 · US8-AC3/AC4) y un diagnóstico
  del veterinario ajeno a toda hipótesis registrable sin fricción vía `diagnosis-service` de 002
  (caso límite). Incluir aserción de tiempo ≤ 8 s por generación completa y ≤ 2 s por decisión
  (presupuestos de `design.md`). Verificación: ídem 3.1.
- [ ] 3.3 Escribir y ejecutar `tests/integration/asistencia/evaluacion.test.ts` sobre
  `tests/fixtures/asistencia/casos-anotados.json` (D12/HD8: casos sintéticos de anamnesis
  incompleta con antecedentes faltantes esperados e hipótesis razonables anotadas): SC-029 por
  mecanismo (≥ 70 % de los antecedentes faltantes anotados señalados, métrica impresa) sobre
  todos los casos del arnés, SC-019 (100 % de las hipótesis con las tres secciones o sus ausencias
  explícitas), SC-030 (100 % de las hipótesis sin respaldo con la ausencia declarada) y SC-031
  (ninguna salida del arnés presentada como diagnóstico definitivo; descargo siempre presente)
  como invariantes sobre todas las salidas. Verificación: el arnés pasa sobre el clúster scratch y
  en el job `database` de CI con las métricas en su salida; resultados y alcance (casos sintéticos)
  registrados en `quickstart.md` sin presentarlos como aceptación de SC-029/SC-017/SC-018/SC-031.

## 4. Interfaz (WCAG 2.2 AA; verificación visual pendiente y declarada)

- [ ] 4.1 Implementar la ruta `/support/consultations/[id]` con los componentes de
  `src/components/asistencia` para el panel de información faltante: sugerencias pendientes con su
  pregunta, fundamento citado con fragmento navegable al visor de 003 o etiqueta «criterio
  general» (FR-033 · FR-007 heredado · US7-AC1/AC3/AC5), acciones `Marcar como formulada`,
  `No aplicable` e `Ignorar` con la decisión registrada y visible (FR-008 · US7-AC2/AC6),
  ausencia de reproposición de lo cubierto (US7-AC4) y chips de procedencia (FR-021). Etiquetas
  programáticas, operación por teclado y foco visible en cada control; `testID` estables.
  Verificación: `bunx biome check --write` sobre los archivos propios y `bun run typecheck`
  verdes; verificación visual declarada pendiente (RI-3).
- [ ] 4.2 Implementar el panel de soporte diferencial en la misma ruta: botón explícito «Solicitar
  apoyo diagnóstico» (US8-AC1), aviso de información insuficiente nombrando lo faltante (FR-022 ·
  US8-AC5), tarjetas de hipótesis con origen (sistema/veterinario, US8-AC9), secciones a favor /
  en contra con ausencia explícita / faltante (FR-009 · SC-019), evidencia citada con el fragmento
  concreto en su contexto (FR-007 · US8-AC10) o declaración de ausencia de respaldo con el límite
  de alcance (FR-023 · SC-030 · US8-AC7), descargo constante «apoyo a la decisión, no diagnóstico
  definitivo» (FR-010 · SC-031 · US8-AC3), acciones `Aceptar`/`Descartar`/`Agregar hipótesis`
  (FR-029 · US8-AC2/AC9), «Ver respaldo» con los antecedentes y fuentes que produjeron cada
  hipótesis (FR-020 · US8-AC8) y resumen «hipótesis consideradas» con estados (FR-049 · US8-AC6,
  con `composeHipotesisConsideradas`; el montaje en el borrador de epicrisis es RI-1).
  Documentar en `quickstart.md` los diffs mínimos de montaje propuestos para RI-1 y RI-2
  (1–2 líneas por archivo prohibido). Verificación: ídem 4.1.

## 5. Compuertas y evidencia

- [ ] 5.1 Crear `quickstart.md` del cambio al comenzar la implementación y mantenerlo
  incremental: guion reproducible del clúster scratch `/tmp/verify-006/` (roles de API, shims de
  `auth.*`, pgtap, migraciones 001–013 y suites 001–012), «rojo» previo de 1.1 y comandos de las
  tareas siguientes. Verificación: documento con guion ejecutable y resultados reales desde la
  tarea 1.1.
- [ ] 5.2 Ejecutar las compuertas locales acotadas (`bunx biome check --write` sobre los archivos
  propios de este cambio —jamás sobre todo el repo—, `bun run typecheck` y
  `bun test tests/unit/asistencia tests/integration/asistencia`) y dejar el job `database` de CI
  en verde en la rama para las suites 001–012 y la integración viva. Verificación: lista de
  comandos y resultados + URLs de CI en `quickstart.md`.
- [ ] 5.3 Consolidar `quickstart.md` con la evidencia real acumulada desde 1.1 (ciclos
  rojo→verde por tarea, comandos, URLs y métricas del arnés de evaluación) y los pendientes
  explícitos: RI-1, RI-2 y RI-3 (con sus diffs propuestos), SC-017/SC-018 (panel de ≥ 3
  especialistas sobre ≥ 5 casos), SC-029 sobre el conjunto del equipo clínico, lectura clínica de
  SC-019/SC-030/SC-031 y verificación visual y e2e funcional web de `/support/**`. Verificación:
  documento completo y sin afirmar como aceptado nada que no lo esté.

## 6. Cierre

- [ ] 6.1 Publicar el reporte final en español (en la PR que crea el orquestador): mapa
  tarea↔FR/US/SC de este documento, evidencia de rojo→verde acumulada, decisiones duras
  (HD1–HD9 de `design.md`) y requisitos de integración (RI-1, RI-2, RI-3). Verificación: reporte
  publicado y coherente con `quickstart.md`.
- [ ] 6.2 Si la implementación desvía `design.md` o estas tareas, actualizar los artefactos con
  `openspec-update-change` antes del merge. Verificación: artefactos coherentes entre sí.
