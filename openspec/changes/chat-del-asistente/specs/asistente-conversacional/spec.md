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
distinguirse por alineación y rótulo, no solo por color, sin burbujas: bloques `rounded-sm`.

#### Scenario: usuario y asistente se distinguen

- **GIVEN** una pregunta y su respuesta
- **WHEN** el veterinario lee la conversación
- **THEN** su pregunta va alineada a la derecha y la respuesta lleva el rótulo «Asistente» con su hora

### Requirement: Persistencia de mensajes terminales

Solo los mensajes terminales (listo o error) MUST persistirse; «enviando» y «pensando» MUST vivir solo en
la sesión. Un mensaje persistido MUST ser inmutable para el usuario: sin edición, salvo quitar su audio.

#### Scenario: cerrar la pestaña con una respuesta pendiente

- **GIVEN** una pregunta enviada cuya respuesta aún no llega
- **WHEN** el veterinario cierra la pestaña y vuelve a abrir la conversación
- **THEN** no quedan mensajes «enviando» ni «pensando» persistidos

#### Scenario: un mensaje persistido no se edita

- **GIVEN** un mensaje ya persistido
- **WHEN** su autor intenta modificar su texto por la API
- **THEN** la base lo rechaza

### Requirement: Acciones del mensaje

Cada mensaje MUST ofrecer copiar su texto; uno en error MUST ofrecer «Reintentar»; uno con audio MUST
ofrecer «Eliminar audio». MUST NOT ofrecer editar ni regenerar.

#### Scenario: reintentar tras un error

- **GIVEN** una pregunta cuya respuesta falló por red
- **WHEN** el veterinario pulsa «Reintentar»
- **THEN** se reenvía la misma pregunta sin duplicarla en la conversación

#### Scenario: error de red al enviar texto

- **GIVEN** un mensaje de texto enviado sin red
- **WHEN** el envío falla
- **THEN** el mensaje queda en error con «Reintentar» y no se persiste hasta que se reenvíe

#### Scenario: copiar un mensaje

- **GIVEN** una respuesta del asistente
- **WHEN** el veterinario pulsa «Copiar»
- **THEN** su texto queda en el portapapeles y se confirma con un aviso en una región de estado

### Requirement: Composer del chat

El composer MUST ser un campo multilínea que crece hasta 6 líneas. En web, Enter MUST enviar y
Shift+Enter insertar un salto de línea, sin enviar durante la composición IME. MUST deshabilitar el envío
con el campo vacío, ofrecer «Detener» mientras el asistente responde y devolver el foco al campo tras
enviar. En nativo, Enter MUST insertar un salto de línea y el envío MUST ser solo con el botón «Enviar».
El borrador MUST conservarse al cambiar de hilo.

#### Scenario: teclas de envío

- **GIVEN** texto escrito en el composer
- **WHEN** el veterinario pulsa Shift+Enter y luego Enter
- **THEN** el texto lleva un salto de línea, se envía y el campo queda vacío y enfocado

#### Scenario: el borrador sobrevive al cambio de hilo

- **GIVEN** texto sin enviar en el composer
- **WHEN** el veterinario cambia de hilo y vuelve
- **THEN** el texto sigue en el composer

#### Scenario: detener una respuesta

- **GIVEN** una respuesta en curso
- **WHEN** el veterinario pulsa «Detener»
- **THEN** la respuesta parcial se descarta, no se persiste y, si era una consulta de conocimiento ya lanzada, su registro de auditoría permanece

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

La lista MUST ser un `role="log"` con nombre accesible y anuncio no interruptivo (`aria-live="polite"`) de
los mensajes terminados nuevos; la carga inicial del historial MUST NOT anunciarse. El cuerpo de una respuesta MUST NOT ser una región viva. Los avisos de estado («Pensando», «Respuesta
lista», errores) MUST ir en regiones separadas. Todo MUST ser operable con teclado y sin violaciones axe
WCAG 2.2 AA en claro y oscuro.

#### Scenario: un lector de pantalla anuncia una respuesta una vez

- **GIVEN** una respuesta que llega al chat
- **WHEN** el lector la anuncia
- **THEN** la anuncia una sola vez, completa y no por fragmentos

#### Scenario: la carga inicial no se anuncia

- **GIVEN** una conversación con 50 mensajes
- **WHEN** el veterinario abre el panel
- **THEN** el lector de pantalla no los anuncia uno a uno

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
guardar el paciente vigente al enviarse, no el de cuando llega la respuesta.

#### Scenario: entrar a un paciente

- **GIVEN** el veterinario en el inicio, sin contexto
- **WHEN** abre la ficha de Bruma y pregunta por el apetito
- **THEN** la etiqueta dice «Contexto: Bruma» y la respuesta usa los datos de Bruma

#### Scenario: salir del paciente

- **GIVEN** el contexto de Bruma
- **WHEN** el veterinario vuelve al inicio
- **THEN** la etiqueta desaparece y las preguntas siguientes no usan datos de Bruma

### Requirement: Dueño y validez del contexto de paciente

Si dos pantallas fijan el contexto, MUST valer el último en montarse, y al desmontarse MUST limpiar solo
quien lo fijó. El paciente guardado en un mensaje MUST pertenecer a la clínica del autor.

#### Scenario: cambiar de pantalla con una pregunta en vuelo

- **GIVEN** una pregunta enviada con el contexto de Bruma y sin respuesta aún
- **WHEN** el veterinario vuelve al inicio antes de que llegue
- **THEN** la respuesta usa los datos de Bruma y el mensaje guarda a Bruma

#### Scenario: paciente de otra clínica

- **GIVEN** un cliente que intenta guardar un mensaje con el id de un paciente de otra clínica
- **WHEN** se inserta
- **THEN** la base lo rechaza

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

#### Scenario: audio de más de 2 minutos

- **GIVEN** una grabación que llega a 2 min
- **WHEN** se alcanza el máximo
- **THEN** la grabación se corta sola y pasa a revisión

#### Scenario: sin permiso de micrófono

- **GIVEN** un navegador o teléfono sin permiso o sin micrófono
- **WHEN** el veterinario pulsa grabar
- **THEN** se le dice que no hay acceso al micrófono y se le ofrece escribir

#### Scenario: descartar una grabación

- **GIVEN** una grabación en revisión
- **WHEN** el veterinario pulsa «Descartar»
- **THEN** el audio se descarta, no se sube y el composer queda como antes

### Requirement: Aviso de primer uso del audio

Antes de la primera grabación, el veterinario MUST aceptar un aviso que diga que su audio y su
transcripción se envían a un proveedor externo para transcribirse, cuánto se conserva y que puede
eliminarlo. La aceptación MUST persistirse por veterinario con la versión del aviso, fijando el servidor
el autor y el momento; si el aviso cambia de versión, MUST pedirse de nuevo. Sin aceptación MUST NOT
grabarse.

#### Scenario: la primera vez

- **GIVEN** un veterinario que nunca aceptó el aviso
- **WHEN** pulsa grabar
- **THEN** ve el aviso con el proveedor externo y los 90 días, no empieza a grabar y, al aceptar, graba

#### Scenario: la segunda vez

- **GIVEN** un veterinario que ya aceptó la versión vigente
- **WHEN** pulsa grabar
- **THEN** empieza a grabar sin pedirlo de nuevo

#### Scenario: rechazar el aviso

- **GIVEN** el aviso abierto
- **WHEN** el veterinario cancela
- **THEN** no se graba nada y el foco vuelve al botón de grabar

### Requirement: Transcripción del audio del chat

El audio MUST transcribirse en una función que exija solo un usuario autenticado de la clínica con acceso
activo, sin sesión de escucha, con el mismo proveedor. El servidor MUST imponer el límite de 2 min por
tamaño en bytes y tipo MIME, sin fiarse de la duración que declare el cliente. Si la transcripción es
insuficiente MUST decir «No se entendió» y ofrecer grabar de nuevo, sin responder.

#### Scenario: no se entendió

- **GIVEN** un audio sin habla inteligible
- **WHEN** se transcribe
- **THEN** el mensaje dice «No se entendió», ofrece grabar de nuevo y el asistente no responde

#### Scenario: audio demasiado grande

- **GIVEN** un archivo que excede el tamaño máximo para 2 min, aunque declare una duración menor
- **WHEN** se envía a transcribir
- **THEN** el servidor lo rechaza

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

### Requirement: Acceso y purga del audio

Solo su autor con acceso activo MUST poder leer un audio; el único otro acceso MUST ser el de la purga y
el borrado, con credenciales de servicio. El audio de un veterinario que pierde el acceso o se da de baja
MUST purgarse también. La purga programada MUST autenticarse con un secreto compartido, no con el JWT de
un usuario, y MUST NOT dejar secretos en el repositorio ni en registros.

#### Scenario: eliminar con la confirmación negada

- **GIVEN** un mensaje con audio vigente
- **WHEN** el veterinario pulsa «Eliminar audio» y cancela la confirmación
- **THEN** el audio sigue disponible

#### Scenario: reproducir un audio vencido

- **GIVEN** un mensaje cuyo `audio_expires_at` ya pasó
- **WHEN** el veterinario intenta reproducirlo
- **THEN** no se emite ninguna URL firmada y el mensaje muestra «audio vencido» con su transcripción

#### Scenario: purga de un veterinario dado de baja

- **GIVEN** un veterinario sin acceso activo con audio guardado
- **WHEN** corre la purga programada
- **THEN** su audio se elimina aunque no haya vencido

#### Scenario: purga sin secreto

- **GIVEN** una llamada a la función de purga sin el secreto compartido
- **WHEN** se invoca
- **THEN** se rechaza y no se elimina nada

#### Scenario: borrar la conversación con audio

- **GIVEN** una conversación con mensajes de audio
- **WHEN** el veterinario confirma «Borrar conversación»
- **THEN** no quedan mensajes ni objetos de audio suyos, y si cancela la confirmación no se borra nada

### Requirement: Registro estructurado del chat

Las funciones de transcripción, purga y borrado MUST emitir registros estructurados con `requestId`, sin
incluir audio ni transcripción, y la purga MUST registrar cuántos objetos eliminó y cuáles fallaron. Los
errores del cliente en subida, transcripción y renderizado MUST reportarse al canal de errores de cliente.

#### Scenario: purga con un fallo

- **GIVEN** una corrida de purga en la que un objeto no se puede eliminar
- **WHEN** termina
- **THEN** el registro indica el total eliminado y el objeto que falló, sin silenciarlo

### Requirement: Aviso de respuesta nueva

Si llega una respuesta con el panel cerrado (riel, dock o colapsado), el icono del asistente MUST mostrar
una marca de no leído, anunciada con `role="status"`, hasta que se abre el hilo. MUST NOT usar sonido ni
animación.

#### Scenario: respuesta con el panel cerrado

- **GIVEN** una consulta en curso y el panel colapsado
- **WHEN** llega la respuesta
- **THEN** el riel muestra la marca de no leído hasta que el veterinario abre el asistente

#### Scenario: respuesta con el dock en compacto

- **GIVEN** una consulta en curso, el ancho compacto y el asistente fuera de vista
- **WHEN** llega la respuesta
- **THEN** el icono del asistente en el dock muestra la marca de no leído, anunciada con `role="status"`
