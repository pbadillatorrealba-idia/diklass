# Asistente conversacional

## Purpose

El chat del asistente del panel: conversación continua con mensajes, composer, audio y paciente de
contexto automático, que responde consultas básicas y la base de conocimiento, sin escribir en el registro
clínico. Es la base para un agente futuro, que solo propone.

## ADDED Requirements

### Requirement: Conversación continua y privada

El asistente MUST mantener una única conversación por veterinario, persistida y visible solo para su
autor dentro de su clínica, que continúa entre pantallas y sesiones. MUST cargar los últimos 50
mensajes y permitir «Cargar anteriores». MUST NOT formar parte de la traza clínica.

#### Scenario: la conversación sigue tras volver a entrar

- **GIVEN** una conversación con mensajes y la sesión cerrada
- **WHEN** el veterinario inicia sesión y abre el panel
- **THEN** ve sus últimos mensajes y nadie más de la clínica los ve

#### Scenario: historial largo

- **GIVEN** una conversación de más de 50 mensajes
- **WHEN** el veterinario abre el panel y pulsa «Cargar anteriores»
- **THEN** ve primero los 50 más recientes y luego los anteriores sin perder su posición

### Requirement: Borrar la conversación

El veterinario MUST poder borrar toda su conversación, texto y audio, tras una confirmación que declare
que los registros de auditoría de las consultas de conocimiento (FR-020) permanecen.

#### Scenario: borrar con confirmación

- **GIVEN** una conversación con respuestas de conocimiento
- **WHEN** el veterinario confirma «Borrar conversación»
- **THEN** no quedan mensajes ni audio suyos y las filas de `knowledge_queries` siguen existiendo

### Requirement: Mensajes del chat

Cada mensaje MUST tener autor (veterinario o asistente), hora, estado (enviando, pensando, listo o
error) y partes (texto, respuesta de conocimiento, audio, propuesta). El usuario y el asistente MUST
distinguirse por alineación y rótulo, no solo por color, sin burbujas: bloques `rounded-sm`. Un mensaje
enviado MUST ser inmutable.

#### Scenario: usuario y asistente se distinguen

- **GIVEN** una pregunta y su respuesta
- **WHEN** el veterinario lee la conversación
- **THEN** su pregunta va alineada a la derecha y la respuesta lleva el rótulo «Asistente» con su hora

### Requirement: Acciones del mensaje

Cada mensaje MUST ofrecer copiar su texto; uno en error MUST ofrecer «Reintentar»; uno con audio MUST
ofrecer «Eliminar audio». MUST NOT ofrecer editar ni regenerar.

#### Scenario: reintentar tras un error

- **GIVEN** una pregunta cuya respuesta falló por red
- **WHEN** el veterinario pulsa «Reintentar»
- **THEN** se reenvía la misma pregunta sin duplicarla en la conversación

### Requirement: Composer del chat

El composer MUST ser un campo multilínea que crece hasta 6 líneas. En web, Enter MUST enviar y
Shift+Enter insertar un salto de línea, sin enviar durante la composición IME. MUST deshabilitar el envío
con el campo vacío, ofrecer «Detener» mientras el asistente responde y devolver el foco al campo tras
enviar. El borrador MUST conservarse al cambiar de hilo.

#### Scenario: teclas de envío

- **GIVEN** texto escrito en el composer
- **WHEN** el veterinario pulsa Shift+Enter y luego Enter
- **THEN** el texto lleva un salto de línea, se envía y el campo queda vacío y enfocado

### Requirement: Lista de mensajes anclada

La lista MUST mostrar lo más nuevo abajo y mantenerse anclada al final mientras llegan mensajes, salvo
que el veterinario haya subido a leer: entonces MUST NOT arrastrarlo y MUST ofrecer «Ir al final» con el
conteo de nuevos. El desplazamiento MUST ser instantáneo, sin animación.

#### Scenario: no arrastrar a quien lee

- **GIVEN** el veterinario leyendo mensajes antiguos
- **WHEN** llega una respuesta nueva
- **THEN** la lista no se mueve y «Ir al final» muestra «1 nuevo»

### Requirement: Respuesta entera y estado «Pensando»

La respuesta MUST pintarse completa cuando exista, con «Pensando…» como texto estático con
`role="status"` mientras tanto. MUST NOT simular tipeo ni revelado progresivo. El asistente MUST
responder a través de un puerto capaz de emitir por trozos, para que un agente con streaming entre sin
cambiar la interfaz.

#### Scenario: espera sin simulación

- **GIVEN** una consulta de conocimiento en curso
- **WHEN** el veterinario mira el chat
- **THEN** ve «Pensando…» estático y, al terminar, la respuesta entera

### Requirement: Accesibilidad de la conversación

La lista MUST ser un `role="log"` con nombre accesible y anuncio educado de los mensajes terminados. El
cuerpo de una respuesta MUST NOT ser una región viva. Los avisos de estado («Pensando», «Respuesta
lista», errores) MUST ir en regiones separadas. Todo MUST ser operable con teclado y sin violaciones axe
WCAG 2.2 AA en claro y oscuro.

#### Scenario: un lector de pantalla anuncia una respuesta una vez

- **GIVEN** una respuesta que llega al chat
- **WHEN** el lector la anuncia
- **THEN** la anuncia una sola vez, completa y no por fragmentos

### Requirement: Consultas básicas

El asistente MUST responder con reglas deterministas la fecha de hoy, los eventos agendados (sin fuente
de eventos, que no hay y por qué) y los pacientes de hoy (consultas creadas ese día, hora local). Lo que no
reconozca MUST consultarse a la base de conocimiento. MUST NOT escribir en el registro clínico.

#### Scenario: pacientes de hoy

- **GIVEN** consultas creadas hoy para dos pacientes
- **WHEN** el veterinario pregunta «¿Cuáles son los pacientes de hoy?»
- **THEN** lista a cada paciente una sola vez y omite los de otros días

### Requirement: Conocimiento dentro del chat

Una pregunta de conocimiento MUST responderse con el contrato de respuesta, citas y avisos de cobertura
de la base de conocimiento (FR-005, FR-007, FR-022, FR-023) y MUST ofrecer «Ver respaldo registrado»
(FR-020). La pestaña «Conocimiento» MUST NOT existir y `/knowledge` MUST mostrar este mismo chat.

#### Scenario: respuesta con citas

- **GIVEN** una pregunta que no es fecha, agenda ni pacientes de hoy
- **WHEN** el veterinario la envía
- **THEN** la respuesta lleva citas con fuente y fragmento y su «Ver respaldo registrado»

### Requirement: Paciente de contexto automático

El paciente de contexto MUST fijarlo la navegación: al abrir la ficha o una consulta de un paciente, y
limpiarse al salir a una pantalla sin paciente. MUST mostrarse como etiqueta de solo lectura («Contexto:
nombre»). MUST NOT existir un selector de pacientes en el chat ni en `/knowledge`. Cada mensaje MUST
guardar el paciente con el que se respondió.

#### Scenario: entrar a un paciente

- **GIVEN** el veterinario en el inicio, sin contexto
- **WHEN** abre la ficha de Bruma y pregunta por el apetito
- **THEN** la etiqueta dice «Contexto: Bruma» y la respuesta usa los datos de Bruma

#### Scenario: salir del paciente

- **GIVEN** el contexto de Bruma
- **WHEN** el veterinario vuelve al inicio
- **THEN** la etiqueta desaparece y las preguntas siguientes no usan datos de Bruma

### Requirement: Markdown seguro

El texto del asistente MUST renderizar markdown (énfasis, listas, tablas, código, citas y enlaces) con los
tokens del sistema. MUST NOT interpretar HTML ni cargar imágenes: los muestra como texto. Los enlaces MUST
ser solo `http(s)` o rutas internas, y los externos MUST abrirse con `rel="noopener"` indicando el destino.

#### Scenario: HTML e imágenes como texto

- **GIVEN** una respuesta con `<script>` y una imagen markdown
- **WHEN** se pinta
- **THEN** se ven como texto, sin ejecutar ni cargar nada

### Requirement: Grabar, revisar y enviar audio

El composer MUST permitir grabar un audio tocando (sin exigir gestos de puntero), con tiempo visible,
«Cancelar» y «Detener»; luego revisarlo (reproducir, «Descartar», «Enviar»). La duración MUST estar entre 1 s
y 2 min. Sin permiso de micrófono o dispositivo MUST declararlo y ofrecer escribir (FR-054). El botón MUST
quedar deshabilitado, indicando por qué, mientras la escucha de consulta use el micrófono.

#### Scenario: grabar y enviar

- **GIVEN** un micrófono disponible
- **WHEN** el veterinario graba 5 s, lo revisa y pulsa «Enviar»
- **THEN** aparece su mensaje con reproductor y transcripción, y el asistente responde sobre esa transcripción

#### Scenario: micrófono ocupado por la escucha

- **GIVEN** la escucha de una consulta activa
- **WHEN** el veterinario mira el composer
- **THEN** el botón de grabar está deshabilitado y explica que la escucha usa el micrófono

#### Scenario: audio demasiado corto

- **GIVEN** una grabación de menos de 1 s
- **WHEN** el veterinario la detiene
- **THEN** no se envía y se le indica que es demasiado corta

### Requirement: Transcripción del audio del chat

El audio MUST transcribirse en una función que exija solo un usuario autenticado de la clínica, sin sesión
de escucha, con el mismo proveedor y los mismos límites de tiempo y tamaño que la transcripción de la
escucha. Si la transcripción es insuficiente MUST decir «No se entendió» y ofrecer grabar de nuevo, sin
responder.

#### Scenario: no se entendió

- **GIVEN** un audio sin habla inteligible
- **WHEN** se transcribe
- **THEN** el mensaje dice «No se entendió», ofrece grabar de nuevo y el asistente no responde

### Requirement: Conservación del audio por 90 días

El audio enviado MUST conservarse en almacenamiento privado acotado por clínica y autor durante 90 días y
luego eliminarse, quedando la transcripción como texto del mensaje marcada «audio vencido». El
veterinario MUST poder eliminar el audio de un mensaje antes. El aviso «Grabando y conservando audio»
MUST ser visible al grabar, con el plazo de conservación.

#### Scenario: vencimiento

- **GIVEN** un mensaje con audio de hace 91 días
- **WHEN** el veterinario abre la conversación
- **THEN** el archivo ya no existe y el mensaje conserva su transcripción marcada «audio vencido»

#### Scenario: eliminar antes

- **GIVEN** un mensaje con audio vigente
- **WHEN** el veterinario pulsa «Eliminar audio» y confirma
- **THEN** el audio se elimina y la transcripción permanece

### Requirement: Aviso de respuesta nueva

Si llega una respuesta con el panel cerrado (riel, dock o colapsado), el icono del asistente MUST mostrar
una marca de no leído, anunciada con `role="status"`, hasta que se abre el hilo. MUST NOT usar sonido ni
animación.

#### Scenario: respuesta con el panel cerrado

- **GIVEN** una consulta en curso y el panel colapsado
- **WHEN** llega la respuesta
- **THEN** el riel muestra la marca de no leído hasta que el veterinario abre el asistente
