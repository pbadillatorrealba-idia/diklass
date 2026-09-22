#  Apoyo al tratamiento y farmacología

## Purpose

capa de apoyo terapéutico del PoC de CDSS de etología veterinaria canina — sugerencia de alternativas de manejo conductual, ambiental, seguimiento, exámenes complementarios e intervenciones farmacológicas respaldadas por fuentes, con restricciones adicionales para medicamentos: justificación, uso de datos del paciente, advertencia de contraindicaciones, cita obligatoria, y toda dosis presentada como información para validación profesional y nunca como prescripción automática.

**Created**: 2026-09-09

**Status**: Draft — pendiente de aceptación

**Contexto de producto**: [Brief del PoC](../../../../../docs/brief-poc-cdss.md)

**Nota sobre identificadores**: FR/SC conservan su identidad global. Los requisitos transversales comparten ID y pueden especializarse por dominio sin contradecir la obligación canónica del brief.

**Nota de riesgo**: esta es la funcionalidad de mayor riesgo clínico del PoC (R7 del brief). Se
especifica por separado para que reciba revisión propia y sus restricciones no se diluyan entre
otras funcionalidades.

## User Scenarios & Testing

### User Story 9 - Apoyo al tratamiento con restricciones farmacológicas (Priority: P1)

El sistema sugiere alternativas de manejo conductual, modificaciones ambientales, seguimiento,
exámenes complementarios e intervenciones farmacológicas respaldadas por las fuentes. Las
sugerencias de medicamentos llevan restricciones adicionales: identificación del fármaco,
justificación, uso de datos del paciente, advertencias de contraindicaciones o información faltante,
y cita de la fuente. Toda dosis se presenta como información para validación, nunca como
prescripción.

**Why this priority**: Es el punto de mayor riesgo clínico del sistema. Es única historia de esta
spec porque separar el manejo no farmacológico del farmacológico permitiría construir el segundo sin
las salvaguardas del primero; mantenerlos juntos obliga a que toda sugerencia terapéutica pase por
el mismo régimen de citación y validación.

**Independent Test**: Solicitar apoyo terapéutico en un caso con contraindicación conocida en la
ficha y verificar que la advertencia aparece, que toda sugerencia cita su fuente, y que ninguna
dosis se presenta como prescripción ni se registra sin aprobación explícita.

**Acceptance Scenarios**:

1. **Given** un caso con hipótesis registradas, **When** el veterinario solicita alternativas de
   manejo, **Then** el sistema presenta opciones conductuales, ambientales, de seguimiento, de
   exámenes complementarios o farmacológicas, respaldadas por fuentes citadas.
2. **Given** una sugerencia farmacológica, **When** se presenta al veterinario, **Then** incluye
   identificación del medicamento, justificación de su pertinencia, advertencias y fuente.
3. **Given** un paciente con una alergia registrada en su ficha, **When** el sistema sugiere un
   fármaco potencialmente contraindicado, **Then** advierte explícitamente la contraindicación.
4. **Given** una dosis calculada a partir del peso del paciente, **When** se muestra, **Then**
   aparece rotulada como información para validación profesional.
5. **Given** un paciente sin peso registrado, **When** se solicita una sugerencia farmacológica
   dependiente del peso, **Then** el sistema señala la información faltante en lugar de asumir un
   valor.
6. **Given** cualquier sugerencia farmacológica, **When** el veterinario no la aprueba
   explícitamente, **Then** no queda registrada como medicamento prescrito.
7. **Given** una sugerencia farmacológica aprobada por el veterinario, **When** se cierra la
   consulta, **Then** figura en la epicrisis como medicamento prescrito bajo responsabilidad del
   profesional.
8. **Given** una alternativa terapéutica sin respaldo en las fuentes disponibles, **When** se
   presenta, **Then** se declara explícitamente la ausencia de respaldo documental.
9. **Given** una dosis que queda fuera del rango documentado en las fuentes, **When** se muestra,
   **Then** el sistema la señala como fuera de rango.
10. **Given** una recomendación terapéutica ya entregada, **When** se revisa posteriormente,
    **Then** es posible reconstruir qué datos del paciente y qué fuentes la produjeron.
11. **Given** un paciente que ya recibe un medicamento registrado en su ficha, **When** el sistema
    sugiere un fármaco con interacción documentada, **Then** advierte explícitamente la interacción.
12. **Given** un paciente cuya edad o estado reproductivo constituye contraindicación documentada,
    **When** el sistema sugiere ese fármaco, **Then** advierte explícitamente la contraindicación.
13. **Given** una sugerencia farmacológica con una advertencia visible, **When** el veterinario la
    aprueba, **Then** queda registrada la advertencia que estaba visible al momento de aprobar.
14. **Given** una sugerencia terapéutica fundada en una fuente, **When** el veterinario la revisa,
    **Then** puede ver el fragmento concreto del documento que la sustenta, no solo su título.
15. **Given** una sugerencia farmacológica y un paciente con peso y enfermedades registradas,
    **When** se presenta, **Then** la justificación referencia esos datos concretos del paciente.
16. **Given** una sugerencia farmacológica que el veterinario no aprobó, **When** se genera el
    borrador de epicrisis, **Then** no figura como medicamento prescrito.
17. **Given** un borrador de epicrisis con sugerencias farmacológicas no aprobadas, **When** el
    veterinario aprueba la epicrisis, **Then** esa aprobación no convierte esas sugerencias en
    medicamentos prescritos.
18. **Given** un fármaco pertinente sin rango de dosis documentado en las fuentes, **When** el
    sistema responde, **Then** declara la ausencia de rango en lugar de proponer una dosis.
19. **Given** una dosis citada literalmente de una fuente sin cálculo alguno, **When** se muestra,
    **Then** aparece igualmente rotulada como información para validación profesional.

---

### Edge Cases

- **Paciente sin peso registrado**: ante una sugerencia farmacológica dependiente del peso, el
  sistema debe señalar la información faltante en lugar de asumir un valor.
- **Medicamento actual del paciente con interacción potencial**: la interacción debe advertirse
  explícitamente cuando las fuentes la documenten.
- **Fármaco sin cobertura en el vademécum cargado**: no debe sugerirse, o debe indicarse claramente
  que no hay respaldo documental disponible para él.
- **Contraindicación por edad o estado reproductivo**: debe evaluarse contra los datos de la ficha y
  advertirse, no omitirse por estar fuera del cálculo de dosis.
- **Ficha incompleta en campos que condicionan la seguridad**: el sistema debe enumerar qué falta
  antes de sugerir intervención farmacológica.
- **Veterinario que aprueba una sugerencia con advertencia activa**: la aprobación debe registrarse
  junto con la advertencia que estaba visible al momento de aprobar.
- **Retiro de una fuente farmacológica**: las prescripciones ya aprobadas deben conservar la
  referencia a la evidencia con la que se decidieron. Este comportamiento lo provee FR-053 de la
  spec 003.
- **Dosis fuera de rango documentado**: debe señalarse como fuera de rango en lugar de presentarse
  sin observación.

### Trazabilidad de requisitos

Cada requisito funcional se verifica mediante los escenarios de aceptación indicados.

| Requisito | Verificado por |
|---|---|
| FR-034 | US9 / 1 |
| FR-019 | US9 / 2, 15 |
| FR-035 | US9 / 4, 9, 19 |
| FR-036 | US9 / 6, 7, 13 |
| FR-058 | US9 / 16, 17 |
| FR-046 | US9 / 18 |
| FR-037 | US9 / 3, 11, 12 |
| FR-038 | US9 / 5 |
| FR-010 | US9 / 6, 17 |
| FR-007 | US9 / 14 |
| FR-023 | US9 / 8 |
| FR-020 | US9 / 10 |

### Key Entities

- **Tratamiento**: intervención registrada para un paciente: conductual, ambiental, de seguimiento,
  examen complementario o farmacológica. Lleva su estado de aprobación profesional.
- **Medicamento**: producto farmacológico asociado a una recomendación o tratamiento, con
  identificación, dosis sugerida, advertencias asociadas, fuente citada y estado de aprobación.
- **Advertencia clínica**: contraindicación, interacción o información faltante señalada respecto de
  una sugerencia farmacológica, conservada junto con la decisión que el veterinario tomó frente a
  ella.
- **Paciente**: definido en la spec 002. Aporta alergias, enfermedades preexistentes, medicamentos
  actuales, peso, edad y estado reproductivo.
- **Hipótesis clínica**: definida en la spec 006. Contexto de la sugerencia terapéutica.
- **Evidencia**, **Fuente clínica**: definidas en la spec 003. Respaldan toda sugerencia.
- **Epicrisis**: definida en la spec 002. Recibe únicamente los medicamentos aprobados
  individualmente por el veterinario; las sugerencias no aprobadas no figuran como prescritas.

## Success Criteria

### Measurable Outcomes

- **SC-006**: El 100% de las sugerencias farmacológicas presentadas incluye fuente citada y rótulo
  de validación profesional requerida.
- **SC-020**: En el conjunto de casos de prueba con contraindicación conocida registrada en la
  ficha, el 100% de las contraindicaciones documentadas en las fuentes es advertido.
- **SC-021**: El número de medicamentos registrados como prescritos sin aprobación explícita del
  veterinario es 0.
- **SC-032**: El 100% de las sugerencias farmacológicas dependientes de datos ausentes en la ficha
  enumera la información faltante en lugar de asumir valores.
- **SC-033**: El 100% de las aprobaciones de medicamentos conserva registro de las advertencias que
  estaban visibles al momento de aprobar.
- **SC-038**: El número de medicamentos que llegan al historial como prescritos por la vía de la
  aprobación global de la epicrisis, sin aprobación individual del fármaco, es 0.
- **SC-034**: El número de alternativas terapéuticas presentadas como respaldadas sin evidencia
  recuperable es 0.

## Assumptions

- **Contraindicaciones documentadas**: el sistema advierte las contraindicaciones e interacciones
  que las fuentes describan; no se le atribuye conocimiento farmacológico más allá de ellas.
- **Sin integración con laboratorios ni recetas electrónicas**: la aprobación del veterinario se
  registra dentro del sistema, sin emisión de receta legal ni integración externa.
- **Datos sintéticos**: se ejercita con casos ficticios que incluyen deliberadamente
  contraindicaciones e información faltante, necesarios para medir SC-020 y SC-032.
- **Cobertura del vademécum**: la seguridad farmacológica que el sistema puede evaluar se limita a
  lo que las fuentes documenten. La regla de no presentar dosis ni fármacos fuera de esa cobertura
  dejó de ser un supuesto y es ahora FR-046.

### Dependencias

- **Spec 003 (base de conocimiento trazable)**: aporta el vademécum y la citación obligatoria. Sin
  ella esta spec no puede cumplir FR-019 ni FR-007.
- **Spec 006 (asistencia clínica proactiva)**: aporta las hipótesis clínicas que dan contexto a la
  sugerencia terapéutica.
- **Spec 002 (registro clínico longitudinal)**: aporta los datos del paciente contra los que se
  evalúa la seguridad, y la epicrisis que recibe los medicamentos aprobados.
- **Spec 001 (identidad y acceso)**: aporta la identidad autenticada a la que se atribuye la
  aprobación de cada fármaco. Es el eslabón que convierte la responsabilidad profesional sobre una
  prescripción en algo verificable.

## ADDED Requirements

### Requirement: FR-034

El sistema MUST poder sugerir alternativas de manejo conductual, modificaciones
  ambientales, seguimiento e exámenes complementarios, respaldadas por las fuentes disponibles.

#### Scenario: US9-AC1

- **GIVEN** un caso con hipótesis registradas
- **WHEN** el veterinario solicita alternativas de manejo
- **THEN** el sistema presenta opciones conductuales, ambientales, de seguimiento, de exámenes complementarios o farmacológicas, respaldadas por fuentes citadas.

### Requirement: FR-019

Las sugerencias farmacológicas MUST identificar el medicamento, justificar su
  pertinencia, utilizar información específica del paciente cuando corresponda, advertir
  contraindicaciones o información faltante relevante y citar la fuente utilizada.

#### Scenario: US9-AC2

- **GIVEN** una sugerencia farmacológica
- **WHEN** se presenta al veterinario
- **THEN** incluye identificación del medicamento, justificación de su pertinencia, advertencias y fuente.

#### Scenario: US9-AC15

- **GIVEN** una sugerencia farmacológica y un paciente con peso y enfermedades registradas
- **WHEN** se presenta
- **THEN** la justificación referencia esos datos concretos del paciente.

### Requirement: FR-035

Toda dosis que el sistema presente MUST aparecer rotulada como información para
  validación profesional, sea calculada por el sistema o citada literalmente de una fuente, y MUST
  señalarse cuando quede fuera del rango documentado.

#### Scenario: US9-AC4

- **GIVEN** una dosis calculada a partir del peso del paciente
- **WHEN** se muestra
- **THEN** aparece rotulada como información para validación profesional.

#### Scenario: US9-AC9

- **GIVEN** una dosis que queda fuera del rango documentado en las fuentes
- **WHEN** se muestra
- **THEN** el sistema la señala como fuera de rango.

#### Scenario: US9-AC19

- **GIVEN** una dosis citada literalmente de una fuente sin cálculo alguno
- **WHEN** se muestra
- **THEN** aparece igualmente rotulada como información para validación profesional.

### Requirement: FR-036

El sistema MUST NOT registrar ninguna sugerencia farmacológica como medicamento
  prescrito sin aprobación explícita e individual del veterinario sobre ese fármaco; la aprobación
  MUST quedar atribuida a la identidad autenticada de quien aprueba (FR-063, spec 001) y MUST
  registrarse junto con las advertencias que estaban visibles al momento de aprobar.

#### Scenario: US9-AC6

- **GIVEN** cualquier sugerencia farmacológica
- **WHEN** el veterinario no la aprueba explícitamente
- **THEN** no queda registrada como medicamento prescrito.

#### Scenario: US9-AC7

- **GIVEN** una sugerencia farmacológica aprobada por el veterinario
- **WHEN** se cierra la consulta
- **THEN** figura en la epicrisis como medicamento prescrito bajo responsabilidad del profesional.

#### Scenario: US9-AC13

- **GIVEN** una sugerencia farmacológica con una advertencia visible
- **WHEN** el veterinario la aprueba
- **THEN** queda registrada la advertencia que estaba visible al momento de aprobar.

### Requirement: FR-058

El borrador de epicrisis MUST NOT incluir como medicamento prescrito ninguna
  sugerencia farmacológica que el veterinario no haya aprobado individualmente, y aprobar la
  epicrisis MUST NOT constituir aprobación de los fármacos que contenga: las sugerencias no
  aprobadas MUST figurar, si acaso, como propuestas no adoptadas.

#### Scenario: US9-AC16

- **GIVEN** una sugerencia farmacológica que el veterinario no aprobó
- **WHEN** se genera el borrador de epicrisis
- **THEN** no figura como medicamento prescrito.

#### Scenario: US9-AC17

- **GIVEN** un borrador de epicrisis con sugerencias farmacológicas no aprobadas
- **WHEN** el veterinario aprueba la epicrisis
- **THEN** esa aprobación no convierte esas sugerencias en medicamentos prescritos.

### Requirement: FR-037

El sistema MUST evaluar las sugerencias farmacológicas contra los datos de la ficha
  del paciente —alergias conocidas, enfermedades preexistentes, medicamentos actuales, edad, peso y
  estado reproductivo— y MUST advertir las contraindicaciones e interacciones que las fuentes
  documenten.

#### Scenario: US9-AC3

- **GIVEN** un paciente con una alergia registrada en su ficha
- **WHEN** el sistema sugiere un fármaco potencialmente contraindicado
- **THEN** advierte explícitamente la contraindicación.

#### Scenario: US9-AC11

- **GIVEN** un paciente que ya recibe un medicamento registrado en su ficha
- **WHEN** el sistema sugiere un fármaco con interacción documentada
- **THEN** advierte explícitamente la interacción.

#### Scenario: US9-AC12

- **GIVEN** un paciente cuya edad o estado reproductivo constituye contraindicación documentada
- **WHEN** el sistema sugiere ese fármaco
- **THEN** advierte explícitamente la contraindicación.

### Requirement: FR-038

Cuando falte información de la ficha necesaria para evaluar la seguridad de una
  intervención farmacológica, el sistema MUST enumerar qué falta y MUST NOT asumir valores por
  omisión.

#### Scenario: US9-AC5

- **GIVEN** un paciente sin peso registrado
- **WHEN** se solicita una sugerencia farmacológica dependiente del peso
- **THEN** el sistema señala la información faltante en lugar de asumir un valor.

### Requirement: FR-010

El sistema MUST NOT convertir automáticamente ninguna sugerencia propia en decisión
  clínica; la administración o prescripción de medicamentos MUST requerir aprobación explícita del
  médico veterinario.

#### Scenario: US9-AC6

- **GIVEN** cualquier sugerencia farmacológica
- **WHEN** el veterinario no la aprueba explícitamente
- **THEN** no queda registrada como medicamento prescrito.

#### Scenario: US9-AC17

- **GIVEN** un borrador de epicrisis con sugerencias farmacológicas no aprobadas
- **WHEN** el veterinario aprueba la epicrisis
- **THEN** esa aprobación no convierte esas sugerencias en medicamentos prescritos.

### Requirement: FR-046

El sistema MUST NOT presentar una dosis que no derive de un rango documentado en las
  fuentes disponibles, y MUST NOT sugerir un fármaco sin cobertura en ellas; cuando no exista rango
  documentado para un fármaco pertinente, MUST declararlo en lugar de proponer una dosis.

#### Scenario: US9-AC18

- **GIVEN** un fármaco pertinente sin rango de dosis documentado en las fuentes
- **WHEN** el sistema responde
- **THEN** declara la ausencia de rango en lugar de proponer una dosis.

### Requirement: FR-007

Toda sugerencia terapéutica basada en conocimiento documental MUST mostrar el
  documento fuente y el fragmento utilizado.

#### Scenario: US9-AC14

- **GIVEN** una sugerencia terapéutica fundada en una fuente
- **WHEN** el veterinario la revisa
- **THEN** puede ver el fragmento concreto del documento que la sustenta, no solo su título.

### Requirement: FR-023

El sistema MUST declarar explícitamente cuándo una alternativa terapéutica **no
  farmacológica** no cuenta con respaldo documental disponible. Las sugerencias farmacológicas no
  admiten esta vía: por FR-019 y FR-046, una sugerencia farmacológica sin fuente citable no se
  presenta.

#### Scenario: US9-AC8

- **GIVEN** una alternativa terapéutica sin respaldo en las fuentes disponibles
- **WHEN** se presenta
- **THEN** se declara explícitamente la ausencia de respaldo documental.

### Requirement: FR-020

El sistema MUST permitir reconstruir qué información del paciente y qué fuentes
  documentales fueron utilizadas para producir cada recomendación terapéutica.

#### Scenario: US9-AC10

- **GIVEN** una recomendación terapéutica ya entregada
- **WHEN** se revisa posteriormente
- **THEN** es posible reconstruir qué datos del paciente y qué fuentes la produjeron.
