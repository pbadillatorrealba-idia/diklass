# Spec Delta

## ADDED Requirements

### Requirement: Shell de tres zonas

En web desde 1024 px, toda pantalla protegida MUST mostrar tres zonas: navegación global (FR-082) a
la izquierda, el contenido de la pantalla al centro y el panel de asistente a la derecha, en ese
orden en el DOM y a la vista. El panel pertenece al shell: MUST NOT alterar la composición del
contenido de la pantalla, que conserva sus columnas y su orden (FR-079). Por debajo de 1024 px y en
iOS/Android el panel se presenta como dock y hoja.

#### Scenario: tres zonas en escritorio

- **GIVEN** una ventana de 1440 px con la sesión iniciada
- **WHEN** se abre `/patients`
- **THEN** se ven la barra lateral, el contenido y el panel de asistente lado a lado, y el contenido
  conserva su tabla

#### Scenario: la consulta sigue a una columna

- **GIVEN** una ventana de 1440 px y una consulta abierta
- **WHEN** se abre la consulta
- **THEN** el contexto (`consultation-aside`) queda sobre el registro (`consultation-main`) dentro del
  contenido, sin columnas lado a lado, y el panel está fuera de ese contenido

### Requirement: Panel de asistente colapsable

El panel MUST poder colapsarse a un riel y expandirse con un control con nombre accesible y
`aria-expanded`, operable con teclado. Desde 1440 px MUST estar acoplado y expandido por defecto
(360 px) y colapsa a un riel de 56 px; entre 1024 y 1439 px MUST mostrarse el riel y el panel se
abre como cajón superpuesto sin reflujo del contenido. El estado MUST recordarse por dispositivo y
MUST degradar a los valores por defecto si no puede leerse.

#### Scenario: colapsar en escritorio

- **GIVEN** una ventana de 1440 px con el panel expandido
- **WHEN** el veterinario lo colapsa con el control del panel y recarga la página
- **THEN** el panel queda como riel de 56 px y sigue colapsado tras recargar

#### Scenario: cajón en pantalla intermedia

- **GIVEN** una ventana de 1280 px
- **WHEN** el veterinario abre el panel desde el riel
- **THEN** el panel se superpone al contenido y la posición y el ancho del contenido no cambian

### Requirement: Hilos contextuales del panel

El panel MUST ofrecer hilos según la pantalla: «Escucha» solo con una consulta abierta, «Conocimiento»
en toda pantalla protegida y «Asistente» siempre. Cambiar de pantalla MUST conservar el estado del
panel y MUST mantener el hilo activo si sigue disponible, o pasar a «Conocimiento» si no.

#### Scenario: hilo de escucha solo en consulta abierta

- **GIVEN** el hilo «Escucha» activo en una consulta abierta
- **WHEN** el veterinario navega a `/patients`
- **THEN** el panel sigue abierto y muestra «Conocimiento», sin el hilo «Escucha»

### Requirement: Escucha siempre visible

Mientras la escucha esté activa, el panel colapsado y el dock MUST mostrar el estado de la captura,
el tiempo transcurrido, el aviso «Grabando y conservando audio» cuando la captura es real y
«Detener». El aviso MUST NOT depender solo del color y MUST NOT quedar oculto por colapsar el panel
ni por cerrar la hoja. Cerrar o colapsar el panel MUST NOT detener la captura.

#### Scenario: grabando con el panel colapsado

- **GIVEN** la escucha real activa y el panel colapsado a riel
- **WHEN** el veterinario trabaja en el formulario
- **THEN** el riel muestra el estado, el tiempo, el aviso de grabación y «Detener», y «Detener»
  termina la captura

### Requirement: Hilo de escucha

El hilo de escucha MUST mostrar el control de escucha con su estado y una columna cronológica donde
cada tramo transcrito aparece con su hora y, debajo, los borradores extraídos de ese tramo con su
fragmento de origen y Confirmar, Corregir y Descartar. El hilo MUST NOT separar ni atribuir hablantes
ni presentar los borradores como mensajes del sistema.

#### Scenario: borradores bajo su tramo

- **GIVEN** la escucha activa y un tramo del que se extrajeron 2 borradores
- **WHEN** se muestra el hilo
- **THEN** los 2 borradores aparecen bajo ese tramo, con su fragmento y sus tres acciones

### Requirement: La escucha no desplaza el formulario

Activar la escucha, recibir tramos o borradores y abrir o cerrar el panel o su cajón MUST NOT cambiar
la posición ni el tamaño de ningún campo del formulario de la consulta. El contenido nuevo del hilo
MUST crecer dentro del desplazamiento propio del panel.

#### Scenario: activar la escucha

- **GIVEN** una consulta abierta a 1440 px con la sección 1 a la vista
- **WHEN** el veterinario activa la escucha y llegan tramos y borradores
- **THEN** la posición vertical y el ancho de los campos de la sección 1 no cambian

### Requirement: Conocimiento en el panel

El hilo «Conocimiento» MUST permitir consultar la base de conocimiento con el mismo contrato de
respuesta, citas y avisos de cobertura que `/knowledge` (FR-007, FR-022, FR-023). Desde una consulta o
una ficha MUST tomar al paciente como contexto (FR-026). La ruta `/knowledge` MUST conservarse.

#### Scenario: pregunta con contexto del paciente

- **GIVEN** una consulta abierta de un paciente
- **WHEN** el veterinario pregunta en el hilo «Conocimiento»
- **THEN** la respuesta lleva citas con fuente y fragmento y declara el paciente de contexto

### Requirement: Hilo del asistente reservado

El hilo «Asistente» MUST reservar los estados en espera, pensando, propone y error. Mientras no
exista un agente MUST declarar que no está disponible y MUST NOT simular respuestas ni propuestas.

#### Scenario: sin agente

- **GIVEN** ninguna capacidad de agente instalada
- **WHEN** el veterinario abre el hilo «Asistente»
- **THEN** ve que el asistente conversacional no está disponible y no aparece ninguna respuesta
  simulada

### Requirement: Las propuestas del agente exigen confirmación

Toda propuesta de un agente MUST mostrarse como sugerencia (pliego `suggested-surface` con contorno
de lo sugerido), con procedencia «Inferida» y su origen. MUST NOT escribir en el registro clínico ni
ejecutar una acción hasta que el veterinario la confirme, y la confirmación MUST quedar atribuida a
quien la hizo, con su momento (FR-010 · FR-021 · FR-063 · FR-076).

#### Scenario: propuesta sin confirmar

- **GIVEN** una propuesta del agente visible en el panel
- **WHEN** el veterinario no la confirma
- **THEN** el registro clínico no cambia y la propuesta sigue distinguida como sugerencia

#### Scenario: propuesta confirmada

- **GIVEN** una propuesta del agente visible en el panel
- **WHEN** el veterinario pulsa Confirmar
- **THEN** el cambio se registra atribuido al veterinario con procedencia «Inferida»

### Requirement: Dock de asistente en compacto

Por debajo de 1024 px y en iOS/Android, el panel MUST presentarse como una cinta persistente al pie,
sobre la barra de pestañas y dentro del área segura, con el nombre del hilo activo, el estado de la
escucha cuando aplique, «Detener» y el número de propuestas por confirmar. Sus controles MUST medir
al menos 44×44 px y la cinta MUST NOT quedar oculta por el teclado.

#### Scenario: grabando en móvil

- **GIVEN** una ventana de 375 px, una consulta abierta y la escucha real activa
- **WHEN** el veterinario desplaza el formulario o escribe en un campo
- **THEN** la cinta sigue visible con el estado, el aviso de grabación y «Detener»

### Requirement: Hoja del asistente en compacto

Por debajo de 1024 px, activar la cinta MUST abrir una hoja con el hilo activo. La hoja MUST llevar
el foco al abrirse, atraparlo mientras está abierta, cerrarse con la tecla Escape y con un control
visible, y devolver el foco a la cinta al cerrarse. Cerrar la hoja MUST NOT detener la captura.

#### Scenario: abrir y cerrar la hoja

- **GIVEN** una ventana de 375 px y la escucha activa
- **WHEN** el veterinario abre la hoja desde la cinta y la cierra con Escape
- **THEN** el foco vuelve a la cinta y la captura sigue activa

### Requirement: El borrador confirmado aterriza en su campo

Al confirmar un borrador, la entrada resultante MUST mostrarse en su campo del formulario, traerse a
la vista y marcarse «Nuevo», con procedencia «Inferida», hasta la siguiente acción del veterinario.
El cambio MUST anunciarse a los lectores de pantalla. MUST NOT añadir una animación: la animación de
autor del sistema es solo la firma (FR-099).

#### Scenario: confirmar un borrador

- **GIVEN** un borrador pendiente en el hilo de escucha
- **WHEN** el veterinario lo confirma
- **THEN** la entrada aparece en el campo correspondiente del formulario, visible y marcada «Nuevo»
  con el código «I», y un lector de pantalla anuncia que se incorporó a la anamnesis
