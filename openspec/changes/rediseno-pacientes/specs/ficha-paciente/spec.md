## ADDED Requirements

### Requirement: FR-117 Ficha del paciente por cards

La ficha del paciente MUST presentarse en una sola columna de cards, en este orden visual, del DOM
y del foco: cabecera con el nombre del paciente como título; tutor; procedencia y adopción;
derivante y seguro; antecedentes; historial de consultas. La cabecera MUST mostrar especie, raza,
sexo, estado reproductivo, edad, peso, fecha de nacimiento, nº de expediente, 1ª visita, última
visita y nº de consultas; la edad MUST calcularse desde la fecha de nacimiento y, sin ella, desde
los meses registrados. Cada card de datos MUST poder editarse por separado, y guardar una card MUST
fusionar solo sus campos sobre la ficha vigente, sin pisar los de otra. «Abrir consulta» MUST estar
en la línea del título de la pantalla.

#### Scenario: edición de una card

- **GIVEN** una ficha abierta con la card «Derivante y seguro» en edición
- **WHEN** el veterinario guarda esa card
- **THEN** solo cambian los campos del derivante y el resto de la ficha se conserva.

#### Scenario: ediciones en cards distintas

- **GIVEN** dos cards abiertas en edición, la segunda abierta antes de guardar la primera
- **WHEN** se guardan ambas
- **THEN** la segunda no revierte los campos de la primera.

#### Scenario: edad calculada

- **GIVEN** un paciente nacido hace 4 años y 2 meses
- **WHEN** se abre su ficha
- **THEN** la edad se muestra como «4 años 2 meses».

### Requirement: FR-118 Antecedentes en una card

Los antecedentes MUST mostrarse en una sola card con un bloque por grupo (antecedentes médicos,
enfermedades preexistentes, medicamentos actuales, alergias conocidas, antecedentes
conductuales), cada uno con su conteo. Cada ítem MUST llevar un chip «Dato» o «Negativo», y la
fecha de alta cuando exista. El alta MUST abrirse por grupo, aceptar un hallazgo negativo con un
control de alternancia, enviarse con Enter y MUST apendizar sin modificar los ítems previos. Un
grupo sin ítems MUST decir «Sin registrar».

#### Scenario: alta de un hallazgo negativo

- **GIVEN** el grupo «Alergias conocidas» sin ítems
- **WHEN** el veterinario abre el alta, activa «Negativo», escribe «Sin alergias» y pulsa Enter
- **THEN** el ítem aparece con el chip «Negativo» y la fecha de hoy
- **AND** el grupo ya no dice «Sin registrar».

#### Scenario: ítem anterior sin fecha

- **GIVEN** un ítem registrado antes de existir la fecha de alta
- **WHEN** se abre la ficha
- **THEN** el ítem se muestra sin fecha, sin error.

### Requirement: FR-002 (historial como línea de tiempo)

El historial de consultas de FR-002 MUST presentarse como una línea de tiempo vertical que marca
si cada consulta está cerrada o abierta, muestra el diagnóstico de su epicrisis efectiva y enlaza
la consulta. El orden cronológico y el resto de FR-002 no cambian.

#### Scenario: consulta abierta y cerrada

- **GIVEN** un paciente con una consulta cerrada y otra abierta
- **WHEN** se abre su ficha
- **THEN** cada una aparece en la línea de tiempo con su estado y un enlace «Ver consulta».

### Requirement: FR-044 (rediseño: sin aviso por antecedentes vacíos)

El sistema MUST seguir aceptando una ficha con campos sin completar y MUST señalar, en la cabecera
de la ficha, cuáles de sus campos de datos (fecha de nacimiento, edad, peso, procedencia, edad de
adopción) no tienen información. El sistema MUST NOT señalar como faltante un grupo de
antecedentes sin ítems: un paciente sin antecedentes registrados es válido. Un hallazgo negativo
registrado MUST distinguirse visiblemente de un campo sin dato y MUST NOT contarse como faltante.

#### Scenario: antecedentes vacíos

- **GIVEN** una ficha con todos los datos y sin ningún antecedente
- **WHEN** se abre
- **THEN** la cabecera no muestra aviso de datos sin completar y los grupos dicen «Sin registrar».

#### Scenario: campos sin dato

- **GIVEN** una ficha sin peso ni procedencia
- **WHEN** se abre
- **THEN** la cabecera dice «2 datos sin completar» y nombra «Peso (kg)» y «Procedencia».

#### Scenario: negativo no es falta

- **GIVEN** una alergia registrada como hallazgo negativo
- **WHEN** se abre la ficha
- **THEN** el ítem lleva el chip «Negativo» y no figura entre los datos sin completar.
