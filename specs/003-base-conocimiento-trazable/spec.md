# Feature Specification: Base de conocimiento trazable

**Feature Branch**: `docs/project-constitution` (rama activa; directorio: `specs/003-base-conocimiento-trazable`)

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: capa de conocimiento especializado del PoC de CDSS de etología
veterinaria canina — colección documental acotada, consulta en lenguaje natural, recuperación de
evidencia con citación de documento y fragmento, y separación explícita entre información recuperada
de una fuente, datos de la ficha clínica e inferencias del sistema.

**Contexto de producto**: [Brief del PoC](../../docs/brief-poc-cdss.md)

**Nota sobre identificadores**: los `FR-NNN` y `SC-NNN` son únicos a nivel de familia de specs. Un
requisito transversal aparece íntegro en cada spec donde aplica, designando siempre el mismo
requisito.

## User Scenarios & Testing *(mandatory)*

### User Story 5 - Consulta de conocimiento especializado con evidencia trazable (Priority: P1)

El veterinario le pregunta al asistente en lenguaje natural sobre protocolos, literatura o
medicamentos, y recibe una respuesta fundamentada en el conjunto documental cargado, con
identificación del documento y el fragmento usado. Cuando no hay respaldo, el sistema lo dice.

**Why this priority**: Es el aporte diferencial frente a un registro clínico convencional y el
riesgo técnico principal del PoC (R1, R2, R3). Es única historia de esta spec porque las tres
capacidades —recuperar, citar y declarar ausencia de respaldo— son inseparables: recuperar sin citar
no es utilizable clínicamente, y citar sin declarar ausencia produce falsa confianza.

**Independent Test**: Con el conjunto documental cargado, formular las preguntas del set clínico
anotado y verificar que las respuestas citan documento y fragmento verificables, y que las preguntas
sin cobertura documental producen una declaración explícita de ausencia de evidencia.

**Acceptance Scenarios**:

1. **Given** una base documental cargada, **When** el veterinario pregunta qué antecedentes revisar
   ante un posible cuadro de ansiedad por separación, **Then** el sistema responde citando documento
   fuente y fragmento utilizado.
2. **Given** una pregunta sin respaldo en las fuentes disponibles, **When** el sistema responde,
   **Then** declara explícitamente que no dispone de evidencia documental y no ofrece una afirmación
   clínica como si estuviera respaldada.
3. **Given** una respuesta que combina evidencia documental con datos de la ficha del paciente,
   **When** el veterinario la lee, **Then** puede distinguir qué proviene de la fuente, qué de la
   ficha y qué es inferencia del sistema.
4. **Given** un paciente seleccionado, **When** el veterinario hace varias preguntas seguidas,
   **Then** la conversación mantiene el contexto de ese paciente.
5. **Given** una recomendación clínica ya entregada, **When** se revisa posteriormente, **Then** es
   posible reconstruir qué datos del paciente y qué fuentes documentales se usaron para producirla.
6. **Given** una fuente clínica nueva incorporada a la base documental, **When** el veterinario
   formula una pregunta cubierta por ella, **Then** el sistema puede citarla sin que haya sido
   necesario alterar las fichas ni el historial clínico existente.
7. **Given** una cita mostrada al veterinario, **When** este la abre, **Then** puede ver el
   fragmento en su contexto dentro del documento fuente.
8. **Given** una pregunta que la evidencia disponible responde solo en parte, **When** el sistema
   responde, **Then** señala explícitamente qué parte de la pregunta queda sin cubrir.
9. **Given** una fuente con información bibliográfica registrada, **When** el sistema la cita,
   **Then** muestra esa información bibliográfica junto a la referencia.
10. **Given** que no hay ningún paciente seleccionado, **When** el veterinario formula una pregunta
    clínica, **Then** el sistema responde sobre conocimiento general o pide seleccionar un paciente,
    sin atribuir datos clínicos de ningún paciente.
11. **Given** dos fuentes disponibles con indicaciones distintas sobre lo consultado, **When** el
    sistema responde, **Then** presenta ambas con su cita respectiva.
12. **Given** una fuente retirada de la colección, **When** se revisa una respuesta que la citaba,
    **Then** la cita sigue siendo identificable.
13. **Given** una fuente clínica incorporada o retirada, **When** se revisa la colección, **Then**
    consta qué identidad autenticada realizó ese cambio y cuándo.

---

### Edge Cases

- **Pregunta fuera del dominio cubierto**: ante una consulta sobre una especie distinta de perro o
  un tema sin cobertura documental, el sistema debe declarar el límite de su alcance en lugar de
  responder con conocimiento general no respaldado.
- **Base documental sin evidencia para el caso**: el sistema debe decir que no encontró respaldo, no
  producir una recomendación genérica sin cita.
- **Fuentes contradictorias entre sí**: cuando dos documentos cargados sostienen indicaciones
  distintas, ambas deben presentarse con su cita respectiva en lugar de elegir una silenciosamente.
- **Fuente retirada de la colección**: las citas previamente emitidas hacia ese documento deben
  seguir siendo identificables aunque la fuente ya no esté disponible para consultas nuevas.
- **Pregunta sin paciente seleccionado**: el sistema debe responder sobre conocimiento general o
  pedir que se seleccione un paciente, pero no atribuir datos clínicos de otro paciente.
- **Fragmento recuperado que responde parcialmente**: la respuesta debe señalar qué parte de la
  pregunta queda sin cubrir por la evidencia disponible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-006**: El sistema MUST recuperar información desde una colección documental especializada en
  etología veterinaria.
- **FR-005**: El veterinario MUST poder consultar al asistente mediante lenguaje natural en español.
- **FR-026**: La conversación con el asistente MUST preservar el contexto del paciente seleccionado
  a lo largo de la sesión de acceso.
- **FR-007**: Toda respuesta clínica basada en conocimiento documental MUST mostrar el documento
  fuente y el fragmento utilizado, y MUST permitir ver ese fragmento en su contexto.
- **FR-023**: El sistema MUST declarar explícitamente cuándo no dispone de respaldo documental para
  una afirmación clínica, y MUST NOT presentar una recomendación sin cita como si estuviera
  respaldada.
- **FR-022**: El sistema MUST comunicar de forma explícita cuándo la información disponible es
  insuficiente para responder, incluyendo el caso en que la evidencia cubre solo parte de la
  pregunta.
- **FR-021**: El sistema MUST distinguir visiblemente, en cada respuesta, qué información proviene
  de una fuente documental, qué proviene de la ficha clínica del paciente y qué es inferencia del
  sistema.
- **FR-020**: El sistema MUST permitir reconstruir qué información del paciente y qué fuentes
  documentales fueron utilizadas para producir una recomendación clínica relevante.
- **FR-028**: El sistema MUST permitir incorporar nuevas fuentes clínicas a la base de conocimiento
  sin requerir cambios en el modelo de datos clínicos ni en los registros existentes.
- **FR-051**: Cuando no haya un paciente seleccionado, el sistema MUST responder sobre conocimiento
  general o solicitar que se seleccione uno, y MUST NOT atribuir a la consulta datos clínicos de
  ningún paciente.
- **FR-052**: Cuando dos fuentes disponibles sostengan indicaciones distintas sobre lo consultado,
  el sistema MUST presentar ambas con su cita respectiva y MUST NOT elegir una sin declararlo.
- **FR-053**: Las citas ya emitidas hacia una fuente MUST seguir siendo identificables aunque esa
  fuente deje de estar disponible para consultas nuevas.
- **FR-069**: Incorporar una fuente clínica a la colección o retirarla de ella MUST requerir una
  sesión de acceso activa y MUST quedar atribuido a la identidad autenticada que lo hizo (FR-063,
  spec 001), por alterar el corpus del que dependen todas las afirmaciones clínicas del sistema.
- **FR-030**: Cada fuente clínica MUST registrar su información bibliográfica disponible, y el
  sistema MUST mostrarla junto a la referencia cuando la cite.

### Trazabilidad de requisitos

Cada requisito funcional se verifica mediante los escenarios de aceptación indicados.

| Requisito | Verificado por |
|---|---|
| FR-006 | US5 / 1 |
| FR-005 | US5 / 1, 4 |
| FR-026 | US5 / 4 |
| FR-007 | US5 / 1, 7 |
| FR-023 | US5 / 2 |
| FR-022 | US5 / 8 |
| FR-021 | US5 / 3 |
| FR-020 | US5 / 5 |
| FR-028 | US5 / 6 |
| FR-030 | US5 / 9 |
| FR-051 | US5 / 10 |
| FR-052 | US5 / 11 |
| FR-053 | US5 / 12 |
| FR-069 | US5 / 13 |

### Key Entities *(include if feature involves data)*

- **Fuente clínica**: documento o recurso incorporado a la base de conocimiento, con información
  bibliográfica y estado de disponibilidad para consultas nuevas.
- **Evidencia**: fragmento de una Fuente clínica utilizado para fundamentar una respuesta,
  referenciable desde la afirmación que sustenta y localizable dentro de su documento.
- **Consulta de conocimiento**: pregunta formulada por el veterinario, con el contexto de paciente
  aplicable y las Evidencias que la respondieron.
- **Paciente**: definido en la spec 002. Aquí se usa solo como contexto de la conversación.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-002**: En al menos el 80% de las preguntas del conjunto clínico anotado, la evidencia
  relevante aparece entre las primeras 5 referencias que el sistema muestra al veterinario.
- **SC-003**: Al menos el 90% de las referencias mostradas al usuario corresponde efectivamente al
  contenido citado, verificado por revisión manual sobre el conjunto anotado.
- **SC-010**: Sobre el conjunto clínico anotado, la proporción de afirmaciones clínicas presentadas como
  respaldadas sin evidencia recuperable es 0.
- **SC-015**: En la evaluación por al menos 3 especialistas sobre al menos 5 casos, la utilidad de
  la información recuperada obtiene al menos 3 de 5 en promedio.
- **SC-025**: El 100% de las preguntas sin cobertura documental produce una declaración explícita de
  ausencia de evidencia, verificado sobre un conjunto de preguntas fuera de dominio.
- **SC-026**: Incorporar una fuente clínica nueva y verla citada en una respuesta requiere 0
  modificaciones a fichas o registros clínicos existentes.

## Assumptions

- **Conjunto documental acotado**: el PoC opera sobre una colección controlada de documentos
  previamente seleccionados por el equipo clínico, no sobre búsqueda abierta en internet.
- **Idioma único**: fuentes y consultas en español. No se implementa recuperación multilenguaje.
- **Conjunto anotado de evaluación**: se asume que el equipo clínico produce un conjunto pequeño de
  preguntas clínicas con respuesta esperada y evidencia esperada, necesario para medir SC-002 y
  SC-003.
- **Sin jurisdicciones**: el PoC no modela la jurisdicción de las fuentes. El brief la contempla
  como necesidad de fases posteriores; introducirla ahora sería generalidad especulativa, que el
  Principio III de la constitución prohíbe.
- **Consulta de solo lectura sobre la ficha**: esta spec no modifica la ficha clínica; solo la lee
  como contexto, por lo que las preguntas al asistente no requieren atribución. La gestión de la
  colección documental sí la requiere: es escritura sobre el corpus (FR-069).

### Dependencias

- **Spec 002 (registro clínico longitudinal)**: se requiere un paciente seleccionable para dar
  contexto a la conversación y para distinguir datos de ficha de evidencia documental.
- **Spec 001 (identidad y acceso)**: la consulta al asistente exige sesión activa, y la
  incorporación o retiro de fuentes clínicas queda atribuida a quien la realiza.
- **Externa — fuentes clínicas**: depende de disponer de documentos de etología veterinaria
  legalmente utilizables. Sin ellos esta spec no es evaluable aunque esté construida. Es la
  dependencia crítica del PoC según el brief.
