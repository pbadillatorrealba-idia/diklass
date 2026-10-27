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

### Requirement: Ancho del panel elegible

El ancho del panel acoplado y del cajón MUST poder elegirse arrastrando su borde izquierdo con el
mouse y moviéndolo con las flechas izquierda y derecha (separador vertical con nombre accesible y
`aria-valuenow`). MUST acotarse entre 280 y 560 px (360 px por defecto), recordarse por dispositivo
y descontarse del ancho del contenido, que decide su composición por el ancho que le queda.

#### Scenario: cambiar el ancho con el mouse

- **GIVEN** una ventana de 1440 px con el panel acoplado a 360 px
- **WHEN** el veterinario arrastra su borde 100 px a la izquierda y recarga la página
- **THEN** el panel mide 460 px, el contenido cede ese ancho y el panel sigue en 460 px tras recargar

#### Scenario: límites del ancho

- **GIVEN** el borde del panel en arrastre
- **WHEN** el veterinario lo lleva más allá de los límites
- **THEN** el ancho queda en 280 px como mínimo y en 560 px como máximo

### Requirement: Hilos contextuales del panel

El panel MUST ofrecer hilos según la pantalla: «Escucha» solo con una consulta abierta, «Conocimiento»
en toda pantalla protegida salvo el inicio y «Asistente» siempre. El inicio MUST ofrecer solo
«Asistente» (que ya cubre el conocimiento) y, con un único hilo, el panel MUST nombrarlo sin
pestañas. Cambiar de pantalla MUST conservar el estado del panel y MUST mantener el hilo activo si
sigue disponible, o pasar a «Conocimiento» si no (o al primero disponible si tampoco existe).

#### Scenario: el inicio solo ofrece «Asistente»

- **GIVEN** el veterinario en `/home`
- **WHEN** ve el panel
- **THEN** solo está el hilo «Asistente», sin pestañas ni «Conocimiento»

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

### Requirement: Hilo del asistente con consultas básicas

El hilo «Asistente» MUST estar disponible en toda pantalla protegida y responder con reglas
deterministas la fecha de hoy, los eventos agendados (sin fuente, que no hay y por qué) y los
pacientes de hoy (consultas creadas ese día). Lo que no reconozca MUST consultarse a la base de
conocimiento con el paciente de contexto (FR-005, FR-026). MUST NOT escribir en el registro, proponer
cambios ni presentarse como agente, y su conversación MUST NOT sobrevivir a la sesión de acceso.

#### Scenario: la fecha de hoy

- **GIVEN** el hilo «Asistente» abierto
- **WHEN** el veterinario pregunta «¿Qué día es hoy?»
- **THEN** responde con el día de la semana y la fecha completa de hoy

#### Scenario: sin eventos agendados

- **GIVEN** que no existe una fuente de eventos
- **WHEN** el veterinario pregunta «¿Qué eventos tengo agendados?»
- **THEN** responde que no tiene eventos agendados y que la agenda aún no tiene fuente de eventos

#### Scenario: pacientes de hoy

- **GIVEN** consultas creadas hoy para dos pacientes
- **WHEN** el veterinario pregunta «¿Cuáles son los pacientes de hoy?»
- **THEN** lista a cada paciente una sola vez y omite los de otros días

#### Scenario: pregunta de conocimiento

- **GIVEN** una pregunta que no es fecha, agenda ni pacientes de hoy
- **WHEN** el veterinario la envía desde el hilo «Asistente»
- **THEN** la respuesta lleva citas con fuente y fragmento, igual que en «Conocimiento»

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
