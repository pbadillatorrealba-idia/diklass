## ADDED Requirements

### Requirement: FR-083 (rediseño: breadcrumb de escritorio)

En web, desde 1024 px, el retroceso de las pantallas de detalle MUST pintarse como un breadcrumb
(`nav` con nombre accesible «Ruta») con los ancestros como enlaces y la página actual marcada con
`aria-current="page"`. En pantallas pequeñas MUST conservarse el enlace «‹ Volver a …», y en
iOS/Android, la cabecera nativa. El enlace al padre inmediato MUST seguir siendo operable por
`screen-back`. Una pantalla MAY ofrecer una acción principal: en web desde 768 px MUST ir en la línea del
título; en iOS/Android y por debajo de 768 px, en una barra fija al pie, a todo el ancho, fuera del
desplazamiento para no tapar el contenido.

#### Scenario: breadcrumb de la consulta

- **GIVEN** la consulta de un paciente en una ventana de 1280 px
- **WHEN** se abre
- **THEN** se ve «Pacientes › <nombre del paciente> › Consulta» y no «Volver a …»
- **AND** «<nombre del paciente>» lleva a la ficha.

#### Scenario: acción principal en pantalla pequeña

- **GIVEN** la ficha de un paciente en 375 px
- **WHEN** se abre
- **THEN** «Abrir consulta» está en una barra fija al pie y no en la línea del título
- **AND** a 1280 px está en la línea del título y no hay barra.

#### Scenario: pantalla pequeña

- **GIVEN** la misma consulta en 375 px
- **WHEN** se abre
- **THEN** se ve «‹ Volver a la ficha».

### Requirement: FR-079 (rediseño: ficha y tabla de pacientes)

La ficha del paciente y la consulta (`/consultations/[id]`) MUST usar una sola columna (ancho
`wide`), con el orden del DOM igual al visual: en la consulta, el contexto de solo lectura precede
al registro. `/patients` MUST usar `wide` y adaptar su contenido por ancho: tabla desde 1024 px y
tarjetas apiladas por debajo, sin desplazamiento horizontal desde 320 px. Sustituye, para estas
pantallas, a los escenarios de «2 columnas» de la ficha y de la consulta («lado a lado») y de las
tarjetas de la lista.

#### Scenario: ficha a una columna

- **GIVEN** una ventana de 1280 px
- **WHEN** se abre la ficha de un paciente
- **THEN** las cards se apilan en una columna y ocupan más de 720 px.

#### Scenario: consulta a una columna

- **GIVEN** una ventana de 1280 px
- **WHEN** se abre una consulta
- **THEN** el contexto del paciente (`consultation-aside`) queda sobre el registro
  (`consultation-main`) y ambos ocupan el mismo ancho, sin columnas lado a lado.
