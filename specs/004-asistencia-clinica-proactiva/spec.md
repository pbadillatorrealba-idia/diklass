# Feature Specification: Asistencia clínica proactiva

**Feature Branch**: `docs/project-constitution` (rama activa; directorio: `specs/004-asistencia-clinica-proactiva`)

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: capa de apoyo a la decisión del PoC de CDSS de etología veterinaria
canina — identificación de antecedentes clínicos relevantes aún no recopilados con sugerencia de
preguntas fundamentadas, y presentación de hipótesis diagnósticas con sus antecedentes a favor, en
contra, información faltante y evidencia documental, siempre como apoyo y nunca como diagnóstico del
sistema.

**Contexto de producto**: [Brief del PoC](../../docs/brief-poc-cdss.md)

**Nota sobre identificadores**: los `FR-NNN` y `SC-NNN` son únicos a nivel de familia de specs. Un
requisito transversal aparece íntegro en cada spec donde aplica, designando siempre el mismo
requisito.

## User Scenarios & Testing *(mandatory)*

### User Story 7 - Identificación de información faltante (Priority: P1)

A medida que avanza la anamnesis, el sistema detecta antecedentes clínicamente importantes que aún
no se han recopilado y le sugiere preguntas al veterinario, fundamentadas cuando corresponda en los
protocolos disponibles.

**Why this priority**: Es el mecanismo que mejora la consistencia de la anamnesis, valor central de
la hipótesis de producto, y aporta valor aun sin las hipótesis diagnósticas de la historia 8.

**Independent Test**: Cargar una anamnesis deliberadamente incompleta y verificar que el sistema
señala los vacíos esperados con preguntas accionables y fundamentadas.

**Acceptance Scenarios**:

1. **Given** una anamnesis sin registrar si el comportamiento ocurre solo cuando el animal queda
   solo, **When** el veterinario revisa las sugerencias, **Then** el sistema propone esa pregunta.
2. **Given** una pregunta sugerida, **When** el veterinario la marca como no aplicable o la ignora,
   **Then** el sistema deja de proponerla en esa consulta y registra la decisión.
3. **Given** una sugerencia derivada de un protocolo, **When** el veterinario la consulta, **Then**
   puede ver en qué fuente se apoya.
4. **Given** una anamnesis que ya cubre un antecedente, **When** el sistema evalúa la completitud,
   **Then** no vuelve a proponerlo como faltante.
5. **Given** una sugerencia sin respaldo en las fuentes disponibles, **When** se presenta, **Then**
   se indica que se apoya en criterio general y no en un protocolo cargado.
6. **Given** una pregunta sugerida, **When** el veterinario la formula al tutor y registra que la
   hizo, **Then** su estado pasa a formulada y deja de aparecer como pendiente.

---

### User Story 8 - Apoyo al diagnóstico diferencial (Priority: P2)

A partir de la anamnesis, el historial y el conocimiento recuperado, el sistema propone hipótesis
clínicas, cada una con los antecedentes que la respaldan, los que la contradicen, qué información
falta para evaluarla y qué evidencia documental la sustenta. El veterinario acepta, descarta, agrega
las suyas y registra su diagnóstico final.

**Why this priority**: Aporta valor clínico alto pero depende de una anamnesis suficientemente
completa, que es justamente lo que la historia 7 ayuda a conseguir. Construida después, se evalúa
sobre casos mejor documentados.

**Independent Test**: Con un caso de anamnesis completa, verificar que se presentan hipótesis con
sus respaldos y contradicciones, y que el diagnóstico final queda registrado como decisión del
profesional.

**Acceptance Scenarios**:

1. **Given** una anamnesis con antecedentes suficientes, **When** el veterinario solicita apoyo
   diagnóstico, **Then** el sistema presenta hipótesis con antecedentes a favor, en contra,
   información faltante y evidencia asociada.
2. **Given** una hipótesis presentada, **When** el veterinario la descarta, **Then** queda
   registrada como descartada y no aparece como diagnóstico.
3. **Given** cualquier conjunto de hipótesis, **When** el veterinario las revisa, **Then** ninguna
   se presenta como diagnóstico definitivo del sistema.
4. **Given** que el veterinario registra su propio diagnóstico, **When** se cierra la consulta,
   **Then** ese diagnóstico queda atribuido al profesional y no al sistema.
5. **Given** una anamnesis con muy pocos antecedentes, **When** se solicita apoyo diagnóstico,
   **Then** el sistema indica que la información es insuficiente en lugar de proponer hipótesis
   débilmente fundadas.
6. **Given** una hipótesis aceptada por el veterinario, **When** se genera la epicrisis, **Then**
   figura entre las hipótesis consideradas junto con su estado.
7. **Given** una hipótesis para la que no hay respaldo en las fuentes disponibles, **When** se
   presenta, **Then** el sistema declara explícitamente esa ausencia de respaldo documental.
8. **Given** una hipótesis ya presentada, **When** se revisa posteriormente, **Then** es posible
   reconstruir qué antecedentes del paciente y qué fuentes documentales la produjeron.
9. **Given** una hipótesis que el veterinario formula por su cuenta, **When** la agrega, **Then**
   queda registrada junto a las propuestas por el sistema, distinguible por su origen.
10. **Given** una hipótesis fundada en una fuente, **When** el veterinario la revisa, **Then** puede
    ver el fragmento concreto del documento que la sustenta, no solo su título.

---

### Edge Cases

- **Anamnesis vacía**: no deben proponerse hipótesis; FR-022 obliga a declarar que la información
  es insuficiente.
- **Todas las sugerencias marcadas como no aplicables**: el sistema debe respetar la decisión sin
  volver a insistir dentro de la misma consulta.
- **Hipótesis sin evidencia documental disponible**: debe presentarse indicando la ausencia de
  respaldo, no omitir la advertencia.
- **Antecedentes contradictorios entre sí**: las hipótesis deben reflejar la contradicción en lugar
  de escoger la rama que mejor sostiene una conclusión.
- **Diagnóstico del veterinario que ninguna hipótesis anticipó**: debe poder registrarse sin
  fricción y quedar como diagnóstico válido.
- **Caso fuera del dominio de etología**: el sistema debe declarar el límite de su alcance. Este
  comportamiento lo provee FR-023 junto con la spec 002.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-008**: El sistema MUST poder sugerir antecedentes adicionales relevantes aún no recopilados,
  y MUST permitir al veterinario formular, ignorar o marcar como no aplicable cada sugerencia,
  registrando esa decisión.
- **FR-033**: Las sugerencias de información faltante MUST indicar si se apoyan en una fuente
  documental cargada o en criterio general, y en el primer caso MUST permitir ver la fuente.
- **FR-009**: El sistema MUST poder presentar hipótesis clínicas con antecedentes a favor, en
  contra, información faltante para evaluarlas y evidencia documental asociada.
- **FR-029**: El sistema MUST permitir al veterinario aceptar, descartar o agregar hipótesis propias
  y registrar su diagnóstico clínico final, quedando este atribuido a su identidad autenticada
  (FR-063, spec 007).
- **FR-010**: El sistema MUST NOT convertir automáticamente ninguna sugerencia propia en decisión
  clínica, y MUST NOT declarar un diagnóstico definitivo.
- **FR-049**: Las hipótesis y su estado (propuesta, aceptada, descartada) MUST quedar disponibles
  para el campo "hipótesis consideradas" de la epicrisis que define FR-011 de la spec 001.
- **FR-022**: El sistema MUST comunicar de forma explícita cuándo la información disponible es
  insuficiente para proponer hipótesis fundadas.
- **FR-007**: Toda hipótesis o sugerencia basada en conocimiento documental MUST mostrar el
  documento fuente y el fragmento utilizado.
- **FR-023**: El sistema MUST declarar explícitamente cuándo una hipótesis no cuenta con respaldo
  documental disponible.
- **FR-020**: El sistema MUST permitir reconstruir qué información del paciente y qué fuentes
  documentales fueron utilizadas para producir cada hipótesis presentada.

### Trazabilidad de requisitos

Cada requisito funcional se verifica mediante los escenarios de aceptación indicados.

| Requisito | Verificado por |
|---|---|
| FR-008 | US7 / 1, 2, 4, 6 |
| FR-033 | US7 / 3, 5 |
| FR-009 | US8 / 1 |
| FR-049 | US8 / 6 |
| FR-029 | US8 / 2, 4, 9 |
| FR-010 | US8 / 3 |
| FR-022 | US8 / 5 |
| FR-007 | US8 / 10 |
| FR-023 | US8 / 7 |
| FR-020 | US8 / 8 |

### Key Entities *(include if feature involves data)*

- **Hipótesis clínica**: posible explicación propuesta durante el apoyo a la decisión, con
  antecedentes a favor y en contra, información faltante, evidencia asociada, origen (propuesta por
  el sistema o por el veterinario) y estado (propuesta, aceptada, descartada).
- **Sugerencia de información faltante**: pregunta propuesta al veterinario, con su fundamento
  (fuente documental o criterio general) y su estado (pendiente, formulada, ignorada, no aplicable).
- **Diagnóstico**: definido en la spec 001. Registrado explícitamente por el veterinario.
- **Anamnesis**, **Consulta**, **Paciente**: definidos en la spec 001. Entradas de esta spec.
- **Evidencia**, **Fuente clínica**: definidas en la spec 002. Fundamentan hipótesis y sugerencias.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-017**: En la evaluación por al menos 3 especialistas sobre al menos 5 casos, la pertinencia
  de las preguntas sugeridas obtiene al menos 3 de 5 en promedio.
- **SC-018**: En la evaluación por al menos 3 especialistas sobre al menos 5 casos, la utilidad de
  los diagnósticos diferenciales obtiene al menos 3 de 5 en promedio.
- **SC-019**: El 100% de las hipótesis presentadas incluye antecedentes a favor, antecedentes en
  contra o su ausencia explícita, e información faltante para evaluarla.
- **SC-029**: En el conjunto de casos de prueba con anamnesis incompleta, al menos el 70% de los
  antecedentes faltantes definidos por el equipo clínico es señalado por el sistema.
- **SC-030**: El 100% de las hipótesis sin respaldo documental disponible se presenta con esa
  ausencia declarada de forma explícita.
- **SC-031**: En el 100% de los casos evaluados, ninguna salida del sistema se presenta como
  diagnóstico definitivo.

## Assumptions

- **Alcance clínico acotado**: la evaluación se realiza sobre las categorías clínicas que cubra el
  conjunto documental seleccionado, no sobre toda la etología canina.
- **Conjunto de casos anotado**: se asume que el equipo clínico define, para un conjunto de casos de
  prueba, cuáles son los antecedentes faltantes esperados y las hipótesis razonables, necesario para
  medir SC-029.
- **Panel de especialistas**: SC-017 y SC-018 requieren evaluación por al menos 3 especialistas
  sobre al menos 5 casos. El brief la declara como dependencia externa del PoC.
- **Sin aprendizaje continuo**: las decisiones del veterinario sobre sugerencias e hipótesis se
  registran, pero no ajustan automáticamente el comportamiento del sistema.
- **Sugerencias dentro de la consulta**: el estado de una sugerencia descartada aplica a la consulta
  en curso; una consulta posterior puede volver a proponerla si sigue siendo pertinente.

### Dependencias

- **Spec 001 (registro clínico longitudinal)**: aporta anamnesis, historial, el registro del
  diagnóstico del veterinario y el campo "hipótesis consideradas" de la epicrisis (FR-011).
- **Spec 002 (base de conocimiento trazable)**: aporta la evidencia documental que fundamenta
  sugerencias e hipótesis, incluida la declaración de límite de alcance ante casos fuera de dominio.
  Sin ella, esta spec opera sin respaldo citable y SC-030 no es evaluable.
- **Spec 007 (identidad y acceso)**: aporta la identidad autenticada a la que se atribuye el
  diagnóstico registrado por el veterinario.
- **Externa — panel de especialistas**: necesario para SC-017 y SC-018.
