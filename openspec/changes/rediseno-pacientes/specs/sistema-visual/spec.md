## ADDED Requirements

### Requirement: FR-083 (rediseño: breadcrumb de escritorio)

En web, desde 1024 px, el retroceso de las pantallas de detalle MUST pintarse como un breadcrumb
(`nav` con nombre accesible «Ruta») con los ancestros como enlaces y la página actual marcada con
`aria-current="page"`. En pantallas pequeñas MUST conservarse el enlace «‹ Volver a …», y en
iOS/Android, la cabecera nativa. El enlace al padre inmediato MUST seguir siendo operable por
`screen-back`. Una pantalla MAY ofrecer una acción principal, que en web MUST ir en la línea del
título.

#### Scenario: breadcrumb de la consulta

- **GIVEN** la consulta de un paciente en una ventana de 1280 px
- **WHEN** se abre
- **THEN** se ve «Pacientes › <nombre del paciente> › Consulta» y no «Volver a …»
- **AND** «<nombre del paciente>» lleva a la ficha.

#### Scenario: pantalla pequeña

- **GIVEN** la misma consulta en 375 px
- **WHEN** se abre
- **THEN** se ve «‹ Volver a la ficha».

### Requirement: FR-079 (rediseño: ficha y tabla de pacientes)

La ficha del paciente MUST usar una sola columna (ancho `wide`), con el orden del DOM igual al
visual. `/patients` MUST usar `wide` y adaptar su contenido por ancho: tabla desde 1024 px y
tarjetas apiladas por debajo, sin desplazamiento horizontal desde 320 px. Sustituye, para estas
dos pantallas, a los escenarios de «2 columnas» de la ficha y de las tarjetas de la lista.

#### Scenario: ficha a una columna

- **GIVEN** una ventana de 1280 px
- **WHEN** se abre la ficha de un paciente
- **THEN** las cards se apilan en una columna y ocupan más de 720 px.
