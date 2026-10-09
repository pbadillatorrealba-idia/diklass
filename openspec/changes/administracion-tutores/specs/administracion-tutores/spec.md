## ADDED Requirements

### Requirement: FR-119 Lista de tutores

El sistema MUST ofrecer `/tutors` con los tutores de la clínica: nombre completo, teléfono, correo,
nº de pacientes y una acción «Ver ficha». En pantallas anchas (≥ 1024 px) MUST ser una tabla con
roles de accesibilidad de tabla; en pantallas pequeñas, tarjetas apiladas con las mismas etiquetas
y sin desplazamiento horizontal. «Ver ficha» MUST ser un enlace a `/tutors/<id>` (FR-084). Un
contacto ausente MUST decir «Sin dato». «Registrar tutor» MUST ser la acción principal (FR-083)
y `/patients` MUST ofrecer un enlace «Tutores» a esta lista.

#### Scenario: tabla en escritorio

- **GIVEN** una ventana de 1280 px y una clínica con tutores
- **WHEN** se abre `/tutors`
- **THEN** se ve una tabla con nombre, teléfono, correo, pacientes y acción.

#### Scenario: tarjetas en pantalla pequeña

- **GIVEN** una ventana de 375 px
- **WHEN** se abre `/tutors`
- **THEN** cada tutor es una tarjeta con «Teléfono», «Correo» y «Pacientes» rotulados
- **AND** no hay desplazamiento horizontal.

#### Scenario: sin tutores

- **GIVEN** una clínica sin tutores y sin filtros
- **WHEN** se abre `/tutors`
- **THEN** el estado vacío lo dice y ofrece «Registrar tutor» dentro del aviso (FR-085).

### Requirement: FR-120 Búsqueda, orden y paginación en el servidor

El sistema MUST filtrar los tutores en el servidor por nombre (sobre «nombre apellido») y por
contacto (teléfono o correo), sin distinguir mayúsculas y tratando `%`, `_` y `\` como texto
literal, y MUST devolver solo los de la clínica de quien consulta. MUST ordenar por nombre
o nº de pacientes, ascendente o descendente, con un desempate estable, y paginar de
25 en 25 con el total filtrado. Filtros, orden y página MUST vivir en la URL, y cambiar un filtro
MUST volver a la página 1.

#### Scenario: filtro por nombre y apellido

- **GIVEN** un tutor «Marta Soto» y otro «Pablo Rojas»
- **WHEN** se busca «marta so»
- **THEN** solo aparece «Marta Soto».

#### Scenario: filtro por contacto

- **GIVEN** un tutor con correo `marta@example.test` y otro con teléfono `+56 9 5550 0101`
- **WHEN** se busca «5550» por contacto
- **THEN** solo aparece el segundo.

#### Scenario: orden por pacientes

- **GIVEN** tutores con 2, 1 y 0 pacientes
- **WHEN** se ordena por pacientes descendente
- **THEN** el orden es 2, 1, 0.

#### Scenario: comodín literal

- **GIVEN** tutores sin «%» en el nombre
- **WHEN** se busca «%»
- **THEN** no hay resultados.

### Requirement: FR-121 Alta de tutor

El sistema MUST ofrecer `/tutors/new` con un formulario cuyos campos obligatorios son el nombre y
al menos un medio de contacto (teléfono o correo); apellidos, dirección, población y código postal
MUST ser opcionales. Los obligatorios MUST rotularse en el texto, y los errores MUST salir junto al
campo. Un alta válida MUST crear el tutor y abrir su ficha; un fallo MUST decirlo sin perder lo
escrito, y una sesión vencida MUST abrir el diálogo de sesión expirada.

#### Scenario: alta válida

- **GIVEN** el formulario con nombre y un teléfono
- **WHEN** se envía
- **THEN** el tutor se crea y se abre `/tutors/<id>`.

#### Scenario: falta el contacto

- **GIVEN** el formulario con nombre y sin teléfono ni correo
- **WHEN** se envía
- **THEN** no se crea nada y el error pide al menos un medio de contacto.

### Requirement: FR-122 Aviso de posible duplicado

Antes de crear un tutor, el sistema MUST buscar otro de la clínica con el mismo teléfono o correo
(sin mayúsculas ni espacios en los extremos) y, si existe, MUST avisarlo con su nombre y un enlace a
su ficha. El aviso MUST NOT bloquear el alta: el segundo envío MUST crear el tutor. Si la búsqueda
falla, el alta MUST continuar.

#### Scenario: teléfono repetido

- **GIVEN** un tutor con el teléfono `+56 9 5550 0101`
- **WHEN** se envía un alta con ese teléfono
- **THEN** se ve un aviso con el nombre del tutor existente y no se crea nada todavía
- **AND** un segundo envío crea el tutor.

### Requirement: FR-123 Edición del tutor y validación en el servidor

`/tutors/<id>` (FR-116) MUST permitir editar el contacto del tutor con el mismo formulario y las
mismas reglas que el alta, guardando con el contrato de atribución. La base de datos MUST rechazar
un tutor sin nombre y MUST NOT exigir contacto, porque existen tutores sin él. La búsqueda por
tutor de los pacientes MUST apoyarse en un índice sobre `content->>'tutorId'`.

#### Scenario: edición

- **GIVEN** la ficha de un tutor
- **WHEN** se cambia el teléfono y se guarda
- **THEN** la ficha muestra el nuevo teléfono y la lista de tutores también.

#### Scenario: nombre vacío en el servidor

- **GIVEN** un cliente que escribe directo en `clinical_records`
- **WHEN** inserta un tutor con nombre vacío
- **THEN** la base lo rechaza.
