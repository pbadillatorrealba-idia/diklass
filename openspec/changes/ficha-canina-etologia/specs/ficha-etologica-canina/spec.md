## ADDED Requirements

### Requirement: FR-001 (ampliación etológica)

El sistema MUST permitir registrar en la ficha del perro, además de los campos de FR-001 original,
número de expediente, fecha de la primera visita, procedencia, edad de adopción, estado al adoptar,
edad de gonadectomía y datos de progenitores o camada, todos opcionales.

#### Scenario: ficha etológica completa

- **GIVEN** un perro sin ficha
- **WHEN** el veterinario completa los datos básicos y los de procedencia y adopción
- **THEN** la ficha queda guardada con esos valores y disponible para consultas.

#### Scenario: datos de procedencia vacíos

- **GIVEN** una ficha con procedencia y edad de adopción vacías
- **WHEN** el veterinario la guarda
- **THEN** se acepta y el panel de faltantes los señala como «sin dato» (FR-044).

### Requirement: FR-027 (ampliación etológica)

El sistema MUST registrar del tutor además apellidos, dirección, población y código postal, sin
exigirlos, y MUST seguir exigiendo nombre y al menos un medio de contacto.

#### Scenario: tutor con dirección

- **GIVEN** un tutor nuevo con nombre y teléfono
- **WHEN** se añaden apellidos, dirección, población y CP
- **THEN** se guardan y el tutor sigue asociable a varios perros.

### Requirement: FR-110 Veterinario derivante

El sistema MUST registrar si el caso es referido y, si lo es, nombre, centro, teléfono, si el perro
tiene seguro veterinario y la opinión del derivante sobre el problema.

#### Scenario: caso referido

- **GIVEN** una ficha
- **WHEN** el veterinario marca «refiere: sí» y completa centro y opinión
- **THEN** el bloque queda guardado y visible en el resumen de la ficha.

#### Scenario: no referido

- **GIVEN** una ficha con «refiere: no»
- **WHEN** se consulta
- **THEN** los demás campos del bloque aparecen como «sin dato», no como negativos.

### Requirement: FR-004 (anamnesis por secciones de la hoja)

El sistema MUST estructurar la anamnesis en las secciones de la hoja canina (motivo y otros
problemas, historia del problema, entorno y familia, rutina, alimentación, eliminación, soledad,
actividad, conducta social con familia/desconocidos/visitas/otros perros, manejo y educación,
otras conductas, tratamientos anteriores, historial médico), conservando procedencia por campo
(FR-021), atribución al autor y texto libre.

#### Scenario: registrar campo de sección

- **GIVEN** una consulta abierta
- **WHEN** el veterinario registra «Orina dentro de casa: desde cuándo» en eliminación
- **THEN** queda una entrada con ese campo, su texto, procedencia y autor.

#### Scenario: campo previo

- **GIVEN** una anamnesis antigua con el campo `desencadenantes`
- **WHEN** se consulta
- **THEN** se muestra bajo «Campo previo» sin modificarse y no se ofrece para nuevas entradas.

### Requirement: FR-111 Respuestas Sí/No/A veces

El sistema MUST registrar las preguntas cerradas de la hoja con los valores Sí, No o A veces, y MUST
mantener una pregunta sin responder como «sin dato», nunca como «No».

#### Scenario: respuesta tri-estado

- **GIVEN** la pregunta «¿Ladra, llora o aúlla cuando se queda solo?»
- **WHEN** el veterinario elige «A veces»
- **THEN** se guarda `a_veces`.

#### Scenario: sin responder

- **GIVEN** una pregunta cerrada sin respuesta
- **WHEN** se consulta la anamnesis
- **THEN** aparece como desconocida (SC-024), no como negativa.

#### Scenario: valor inválido

- **WHEN** se intenta guardar «quizás» en una pregunta cerrada
- **THEN** el sistema lo rechaza con un mensaje de validación.

### Requirement: FR-112 Plan de la consulta

El sistema MUST permitir al veterinario registrar protocolo diagnóstico (exploración física y
neurológica, análisis de sangre, urianálisis, coprológico, ecografía, radiografía, resonancia,
otras, grabación en vídeo), hasta tres diagnósticos diferenciales de conducta, diagnóstico
presuntivo, medidas de tratamiento (pautas generales, específicas y complementarias, castración
quirúrgica o médica, hasta dos principios activos con su pauta) y seguimiento. El sistema MUST NOT
proponer ni completar automáticamente ninguno de ellos.

#### Scenario: protocolo y diferenciales

- **GIVEN** una consulta abierta
- **WHEN** el veterinario marca análisis de sangre y radiografía y escribe dos diferenciales
- **THEN** quedan registrados con su autor y se incluyen en la epicrisis como propuesta del veterinario.

#### Scenario: medicación

- **GIVEN** una consulta abierta
- **WHEN** el veterinario registra un principio activo con su pauta
- **THEN** se guarda como texto del veterinario, sin validación clínica automática.

#### Scenario: consulta cerrada

- **GIVEN** una consulta cerrada
- **WHEN** se intenta modificar el plan
- **THEN** se rechaza por el sellado de FR-024.
