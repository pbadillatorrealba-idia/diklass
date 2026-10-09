# Spec Delta

## Purpose

Define el corpus documental real con el que arranca la base de conocimiento trazable: una fuente
única con bibliografía, licencia y fragmentos citables, y el conjunto anotado que lo evalúa.

## ADDED Requirements

### Requirement: FR-097 Corpus inicial real

El corpus inicial de la base de conocimiento MUST ser el documento «Problemas de miedo en perros y
gatos» (S. Le Brech, AWEC-UAB) y MUST NOT incluir documentos sintéticos o ficticios.

#### Scenario: US5-AC14

- **GIVEN** un entorno con el corpus inicial cargado
- **WHEN** se lista la colección de fuentes activas
- **THEN** contiene exactamente una fuente, la del documento indicado, y ninguna fuente ficticia.

### Requirement: FR-098 Fragmentos fieles y citables

Cada fragmento MUST reproducir solo lo que dice el documento, indicar la sección y las
diapositivas de origen, y no añadir dosis, indicaciones ni conclusiones ausentes del original.

#### Scenario: US5-AC15

- **GIVEN** una respuesta que cita un fragmento del corpus
- **WHEN** se compara el fragmento con las diapositivas indicadas en su sección
- **THEN** el contenido coincide con el original y no contiene datos ajenos a él.

#### Scenario: US5-AC16

- **GIVEN** una diapositiva cuyo contenido es solo imagen, gráfico o vídeo
- **WHEN** se prepara el corpus
- **THEN** solo se transcribe su texto legible y no se infieren cifras ni conclusiones del gráfico.

### Requirement: FR-099 Bibliografía y licencia sin invenciones

La fuente MUST registrar la bibliografía que consta en el documento (título, autora, institución) y
MUST dejar vacío todo dato que el documento no aporta, incluido el año; la licencia MUST declararse
pendiente de confirmación mientras no exista una confirmada.

#### Scenario: US5-AC17

- **GIVEN** que el documento no indica año, editorial ni licencia
- **WHEN** se revisa la fuente en la colección
- **THEN** el año, el DOI y la URL constan vacíos y la licencia consta como «por confirmar».

### Requirement: FR-100 Conjunto anotado alineado al corpus

El conjunto anotado MUST contener solo preguntas cuya evidencia esperada es un fragmento del corpus
inicial, y las preguntas fuera de dominio que ese corpus no cubre MUST producir la declaración de
ausencia de cobertura (FR-022).

#### Scenario: SC-025 sobre el corpus real

- **GIVEN** una pregunta sobre un tema que el documento no trata, como la anestesia en caballos
- **WHEN** se consulta la base de conocimiento
- **THEN** la respuesta declara la ausencia de cobertura y no cita ningún fragmento.

#### Scenario: SC-002 sobre el corpus real

- **GIVEN** una pregunta del conjunto anotado, como la prevalencia de miedo y ansiedad en perros
- **WHEN** se consulta la base de conocimiento
- **THEN** la evidencia esperada figura entre las citas devueltas.
