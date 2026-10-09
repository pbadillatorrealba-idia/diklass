## ADDED Requirements

### Requirement: FR-113 Lista de pacientes en tabla

El sistema MUST presentar los pacientes de la clínica con nombre, especie, raza, fecha de la
última visita y tutor, y una acción «Ver ficha». En pantallas anchas (≥ 1024 px) MUST ser una
tabla con roles de accesibilidad de tabla; en pantallas pequeñas, tarjetas apiladas con las mismas
etiquetas y sin desplazamiento horizontal. El tutor MUST ser un enlace a su ficha y «Ver ficha»,
un enlace a `/patients/<id>` (FR-084). Un paciente sin consultas MUST mostrar «Sin visitas», no una
fecha inventada.

#### Scenario: tabla en escritorio

- **GIVEN** una ventana de 1280 px y una clínica con pacientes
- **WHEN** se abre `/patients`
- **THEN** se ve una tabla con las columnas nombre, especie, raza, última visita, tutor y acción
- **AND** el tutor es un enlace a `/tutors/<id>`.

#### Scenario: tarjetas en pantalla pequeña

- **GIVEN** una ventana de 375 px
- **WHEN** se abre `/patients`
- **THEN** cada paciente es una tarjeta con «Última visita» y «Tutor» rotulados
- **AND** no hay desplazamiento horizontal.

### Requirement: FR-114 Búsqueda y filtro en el servidor

El sistema MUST filtrar los pacientes en el servidor por nombre, por raza y por rango de fecha de
la última consulta, y por tutor. Los filtros de texto MUST ignorar mayúsculas y tratar `%`, `_` y
`\` como texto literal. El rango MUST ser `[desde, hasta]` por día completo y MUST excluir a los
pacientes sin consultas. Solo MUST devolver pacientes de la clínica de quien consulta.

#### Scenario: filtro por nombre

- **GIVEN** pacientes «Luna», «Rocky» y «Nube»
- **WHEN** se busca «LUN» por nombre
- **THEN** solo aparece «Luna».

#### Scenario: rango de última visita

- **GIVEN** pacientes con última consulta en enero, febrero y ninguna
- **WHEN** se filtra de febrero a febrero
- **THEN** solo aparece el de febrero y no el que carece de consultas.

#### Scenario: comodín literal

- **GIVEN** pacientes sin «%» en el nombre
- **WHEN** se busca «%»
- **THEN** no hay resultados.

#### Scenario: otra clínica

- **GIVEN** un paciente de otra clínica con el mismo nombre
- **WHEN** se busca ese nombre
- **THEN** no aparece.

### Requirement: FR-115 Orden, paginación y estado en la URL

El sistema MUST ordenar en el servidor por nombre, especie, raza, tutor o última visita,
ascendente o descendente, con un desempate estable; los pacientes sin visitas MUST ir al final en
ambos sentidos. MUST paginar de 25 en 25 con el total filtrado. Filtros, orden y página MUST
vivir en la URL, y cambiar un filtro MUST volver a la página 1. Los encabezados de orden y el
paginador MUST ser enlaces.

#### Scenario: orden por última visita

- **GIVEN** Luna (última visita en marzo), Rocky (febrero) y Nube (sin visitas)
- **WHEN** se ordena por última visita descendente y luego ascendente
- **THEN** el orden es Luna, Rocky, Nube; y Rocky, Luna, Nube.

#### Scenario: enlace compartible

- **GIVEN** una búsqueda con filtros, orden y página 2
- **WHEN** se abre su URL en otra pestaña
- **THEN** la vista muestra el mismo resultado.

#### Scenario: estados

- **GIVEN** filtros sin coincidencias
- **WHEN** se abre la lista
- **THEN** el estado vacío lo dice y ofrece «Limpiar filtros» (FR-085).

### Requirement: FR-116 Ficha mínima del tutor

El sistema MUST ofrecer `/tutors/<id>` con el contacto del tutor y la tabla de sus pacientes, y
MUST decir cuando el tutor no existe. No MUST permitir editar al tutor desde esa pantalla.

> Nota de revisión (`administracion-tutores`, FR-123): la ficha del tutor pasa a permitir editar su
> contacto; la oración anterior queda redefinida por ese cambio.

#### Scenario: tutor con dos pacientes

- **GIVEN** un tutor con Luna y Rocky
- **WHEN** se abre su ficha
- **THEN** se ven su contacto y ambos pacientes, y «Volver a pacientes» lleva a `/patients`.
