#  Retroalimentación clínica

## Purpose

captura estructurada del resultado de las decisiones clínicas en el PoC de CDSS de etología veterinaria canina — tratamiento aplicado, adherencia, evolución, mejoría o ausencia de cambios, eventos adversos, cambio de diagnóstico y modificación del tratamiento, registrados sin alterar la epicrisis original y en forma utilizable para investigación y evaluación posterior.

**Created**: 2026-09-09

**Status**: Draft — pendiente de aceptación

**Contexto de producto**: [Brief del PoC](../../../../../docs/brief-poc-cdss.md)

**Nota sobre identificadores**: FR/SC conservan su identidad global. Los requisitos transversales comparten ID y pueden especializarse por dominio sin contradecir la obligación canónica del brief.

## User Scenarios & Testing

### User Story 10 - Retroalimentación clínica estructurada (Priority: P1)

Después de una consulta el veterinario registra qué pasó: tratamiento aplicado, adherencia,
evolución, mejoría o ausencia de cambios, eventos adversos, cambio de diagnóstico o modificación del
tratamiento. Queda estructurado para análisis posterior, sin tocar la epicrisis ya aprobada.

**Why this priority**: No es necesaria para demostrar el flujo clínico, pero sin capturarla desde el
inicio el PoC no genera los datos que justifican las fases siguientes y la postulación a fondos. Es
única historia de esta spec porque su alcance es acotado y homogéneo.

**Independent Test**: Registrar evolución sobre una consulta cerrada y verificar que queda asociada,
estructurada, recuperable, y que la epicrisis original permanece sin cambios.

**Acceptance Scenarios**:

1. **Given** una consulta cerrada con tratamiento indicado, **When** el veterinario registra la
   evolución posterior, **Then** queda asociada a esa consulta de forma estructurada.
2. **Given** un evento adverso registrado, **When** se consulta el historial, **Then** el evento es
   recuperable y distinguible de la evolución esperada.
3. **Given** retroalimentación registrada, **When** se revisa la epicrisis original, **Then** esta
   permanece sin modificaciones.
4. **Given** un cambio de diagnóstico registrado como retroalimentación, **When** se consulta el
   historial, **Then** el diagnóstico original de la consulta sigue siendo recuperable junto con el
   cambio posterior.
5. **Given** retroalimentación ya registrada, **When** el veterinario la corrige, **Then** se genera
   un registro nuevo y la versión anterior permanece recuperable.
6. **Given** una consulta con retroalimentación registrada, **When** el paciente vuelve a consultar,
   **Then** esa evolución forma parte de los antecedentes que el sistema presenta.
7. **Given** una retroalimentación registrada semanas después de la consulta, **When** se consulta el
   historial, **Then** la fecha de registro se distingue de la fecha de la consulta referida.
8. **Given** una adherencia que el tutor no supo precisar, **When** el veterinario la registra,
   **Then** puede consignarla como parcial o desconocida sin forzar una respuesta binaria.
9. **Given** retroalimentación de varias consultas, **When** se recuperan los campos categóricos de
   adherencia y evolución, **Then** se obtienen de forma agregada sin interpretar texto libre.
10. **Given** una consulta con tratamiento indicado, **When** el veterinario registra qué tratamiento
    se aplicó efectivamente y qué modificación se le hizo, **Then** ambos quedan almacenados de forma
    estructurada y distinguibles entre sí.
11. **Given** una consulta que ya tiene retroalimentación registrada, **When** el veterinario agrega
    una segunda entrada, **Then** ambas se conservan en orden cronológico sin sobrescribirse.
12. **Given** una consulta cerrada sin tratamiento indicado, **When** el veterinario registra la
    evolución observada, **Then** el sistema lo acepta con el campo de tratamiento vacío.
13. **Given** una consulta atendida por un veterinario, **When** otro registra la evolución
    posterior, **Then** consta que la retroalimentación la registró el segundo.

---

### Edge Cases

- **Retroalimentación sobre una consulta sin tratamiento indicado**: debe poder registrarse
  igualmente la evolución observada.
- **Evento adverso grave**: debe quedar distinguible del resto de la evolución y no diluirse entre
  observaciones generales.
- **Retroalimentación registrada mucho después de la consulta**: la fecha del registro debe
  distinguirse de la fecha de la consulta a la que se refiere.
- **Varias entradas de retroalimentación sobre la misma consulta**: deben conservarse todas en orden
  cronológico, no sobrescribirse entre sí.
- **Adherencia parcial o desconocida**: debe poder registrarse como tal, sin forzar una respuesta
  binaria.
- **Retroalimentación que contradice la epicrisis**: debe conservarse la contradicción, no ajustarse
  el registro original.

### Trazabilidad de requisitos

Cada requisito funcional se verifica mediante los escenarios de aceptación indicados.

| Requisito | Verificado por |
|---|---|
| FR-018 | US10 / 1, 2, 4, 8, 10 |
| FR-039 | US10 / 7 |
| FR-040 | US10 / 8 |
| FR-041 | US10 / 2 |
| FR-024 | US10 / 3, 4, 5 |
| FR-070 | US10 / 13 |
| FR-056 | US10 / 11 |
| FR-057 | US10 / 12 |
| FR-042 | US10 / 6 |
| FR-043 | US10 / 9 |

### Key Entities

- **Retroalimentación clínica**: resultado posterior asociado a una consulta, con tratamiento
  aplicado, adherencia, evolución, eventos adversos, cambio de diagnóstico y modificación del
  tratamiento, más su fecha de registro.
- **Evento adverso**: incidencia negativa registrada dentro de la retroalimentación, recuperable de
  forma diferenciada.
- **Consulta**, **Epicrisis**, **Diagnóstico**: definidos en la spec 002. La retroalimentación los
  referencia sin modificarlos.
- **Tratamiento aplicado**: descripción de la intervención efectivamente realizada, registrada aquí
  como parte de la retroalimentación. Es independiente de la entidad Tratamiento de la spec 007:
  esta spec no la requiere ni la referencia para ser construible.

## Success Criteria

### Measurable Outcomes

- **SC-022**: El 100% de la retroalimentación registrada queda asociada a su consulta sin alterar la
  epicrisis aprobada ni el diagnóstico original, verificable por comparación.
- **SC-023**: El 100% de los campos categóricos de retroalimentación —adherencia, evolución, eventos
  adversos— es recuperable de forma agregada sin interpretar texto libre.
- **SC-035**: Los eventos adversos registrados son recuperables de forma diferenciada del resto de
  la evolución en el 100% de los casos.
- **SC-049**: El 100% de las entradas de retroalimentación queda atribuido a la identidad
  autenticada de quien las registró.
- **SC-036**: Al iniciar una consulta posterior, la retroalimentación previamente registrada aparece
  entre los antecedentes presentados al veterinario.
- **SC-037**: Un veterinario registra la retroalimentación de una consulta en menos de 2 minutos,
  sin recurrir a texto libre para los campos categóricos.

## Assumptions

- **Sin aprendizaje automático**: la retroalimentación se captura de forma estructurada pero no se
  utiliza para reentrenar ni ajustar automáticamente ningún modelo, según lo establecido en el
  brief.
- **Sin análisis agregado en el PoC**: se garantiza que los datos queden en forma analizable, pero
  la analítica en sí corresponde a fases posteriores.
- **Registro por cualquier profesional de la clínica**: la retroalimentación puede registrarla un
  veterinario distinto del que atendió, y queda atribuida a su identidad autenticada.
- **Sin captura desde el tutor**: la evolución la reporta el veterinario; no se implementa un canal
  para que el tutor reporte directamente.
- **Categorías definidas por el equipo clínico**: se asume que el equipo define el conjunto de
  valores admisibles para adherencia y evolución antes de la implementación.

### Dependencias

- **Spec 002 (registro clínico longitudinal)**: aporta la consulta cerrada, la epicrisis aprobada y
  el diagnóstico a los que la retroalimentación se asocia, y el mecanismo de presentación de
  antecedentes en consultas posteriores.
- **Spec 001 (identidad y acceso)**: aporta la identidad autenticada a la que se atribuye cada
  entrada de retroalimentación.

## ADDED Requirements

### Requirement: FR-018

El veterinario MUST poder registrar la evolución posterior del paciente de forma
  estructurada: tratamiento aplicado, adherencia, evolución, mejoría o ausencia de cambios, eventos
  adversos, cambio de diagnóstico y modificación del tratamiento.

#### Scenario: US10-AC1

- **GIVEN** una consulta cerrada con tratamiento indicado
- **WHEN** el veterinario registra la evolución posterior
- **THEN** queda asociada a esa consulta de forma estructurada.

#### Scenario: US10-AC2

- **GIVEN** un evento adverso registrado
- **WHEN** se consulta el historial
- **THEN** el evento es recuperable y distinguible de la evolución esperada.

#### Scenario: US10-AC4

- **GIVEN** un cambio de diagnóstico registrado como retroalimentación
- **WHEN** se consulta el historial
- **THEN** el diagnóstico original de la consulta sigue siendo recuperable junto con el cambio posterior.

#### Scenario: US10-AC8

- **GIVEN** una adherencia que el tutor no supo precisar
- **WHEN** el veterinario la registra
- **THEN** puede consignarla como parcial o desconocida sin forzar una respuesta binaria.

#### Scenario: US10-AC10

- **GIVEN** una consulta con tratamiento indicado
- **WHEN** el veterinario registra qué tratamiento se aplicó efectivamente y qué modificación se le hizo
- **THEN** ambos quedan almacenados de forma estructurada y distinguibles entre sí.

### Requirement: FR-039

La retroalimentación MUST quedar asociada a una consulta concreta, con fecha de
  registro distinguible de la fecha de la consulta a la que se refiere.

#### Scenario: US10-AC7

- **GIVEN** una retroalimentación registrada semanas después de la consulta
- **WHEN** se consulta el historial
- **THEN** la fecha de registro se distingue de la fecha de la consulta referida.

### Requirement: FR-040

El sistema MUST permitir registrar adherencia y evolución en categorías que admitan el
  valor desconocido o parcial, sin forzar respuestas binarias.

#### Scenario: US10-AC8

- **GIVEN** una adherencia que el tutor no supo precisar
- **WHEN** el veterinario la registra
- **THEN** puede consignarla como parcial o desconocida sin forzar una respuesta binaria.

### Requirement: FR-041

Los eventos adversos MUST ser recuperables de forma diferenciada del resto de la
  evolución registrada.

#### Scenario: US10-AC2

- **GIVEN** un evento adverso registrado
- **WHEN** se consulta el historial
- **THEN** el evento es recuperable y distinguible de la evolución esperada.

### Requirement: FR-024

El sistema MUST preservar la epicrisis aprobada y el diagnóstico original sin
  modificarlos al registrar retroalimentación; toda corrección posterior MUST generar un registro
  adicional que conserve el original.

#### Scenario: US10-AC3

- **GIVEN** retroalimentación registrada
- **WHEN** se revisa la epicrisis original
- **THEN** esta permanece sin modificaciones.

#### Scenario: US10-AC4

- **GIVEN** un cambio de diagnóstico registrado como retroalimentación
- **WHEN** se consulta el historial
- **THEN** el diagnóstico original de la consulta sigue siendo recuperable junto con el cambio posterior.

#### Scenario: US10-AC5

- **GIVEN** retroalimentación ya registrada
- **WHEN** el veterinario la corrige
- **THEN** se genera un registro nuevo y la versión anterior permanece recuperable.

### Requirement: FR-056

El sistema MUST permitir varias entradas de retroalimentación sobre una misma
  consulta, conservándolas todas en orden cronológico sin que una sobrescriba a otra.

#### Scenario: US10-AC11

- **GIVEN** una consulta que ya tiene retroalimentación registrada
- **WHEN** el veterinario agrega una segunda entrada
- **THEN** ambas se conservan en orden cronológico sin sobrescribirse.

### Requirement: FR-057

El sistema MUST permitir registrar retroalimentación sobre una consulta sin
  tratamiento indicado, dejando ese campo vacío sin impedir el registro de la evolución observada.

#### Scenario: US10-AC12

- **GIVEN** una consulta cerrada sin tratamiento indicado
- **WHEN** el veterinario registra la evolución observada
- **THEN** el sistema lo acepta con el campo de tratamiento vacío.

### Requirement: FR-070

Cada entrada de retroalimentación MUST quedar atribuida a la identidad autenticada de
  quien la registró (FR-063, spec 001), que puede ser distinta de la del veterinario que atendió la
  consulta.

#### Scenario: US10-AC13

- **GIVEN** una consulta atendida por un veterinario
- **WHEN** otro registra la evolución posterior
- **THEN** consta que la retroalimentación la registró el segundo.

### Requirement: FR-042

La retroalimentación registrada MUST incorporarse a los antecedentes que el sistema
  presenta al iniciar una consulta posterior del mismo paciente.

#### Scenario: US10-AC6

- **GIVEN** una consulta con retroalimentación registrada
- **WHEN** el paciente vuelve a consultar
- **THEN** esa evolución forma parte de los antecedentes que el sistema presenta.

### Requirement: FR-043

La retroalimentación MUST quedar almacenada en una estructura que permita su
  recuperación y análisis agregado posterior, sin requerir interpretación de texto libre para los
  campos categóricos.

#### Scenario: US10-AC9

- **GIVEN** retroalimentación de varias consultas
- **WHEN** se recuperan los campos categóricos de adherencia y evolución
- **THEN** se obtienen de forma agregada sin interpretar texto libre.
