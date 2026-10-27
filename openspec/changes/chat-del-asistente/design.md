# Design

## Context

`shell-asistente-tres-zonas` (PR #70) dejó el panel con tres hilos. El hilo «Asistente» es
`AsistenteThread`: un `Input` y un botón con las respuestas apiladas en un almacén de sesión
(`asistente-store`); el paciente de contexto se elige con `SelectorPacienteContexto` dentro de
`ConocimientoThread` y de `/knowledge`. La escucha graba con `WindowRecorder` (`MediaRecorder` en web,
`expo-audio` en nativo) y transcribe con la Edge Function `transcribe-audio`, que exige una sesión de
escucha activa en una consulta abierta. El audio de la escucha vive en el bucket `consultation-audio`
(migración 019) acotado por clínica. Ver `proposal.md` para el porqué y las decisiones del usuario.

Referencias de diseño consultadas: assistant-ui (partición Thread/Message/Composer y partes de mensaje),
patrones de grabación de voz de Stream, Sendbird y Google Messages (grabar, revisar, enviar), guías de
`role="log"` de MDN y de chat con streaming. Se probó `@assistant-ui/react-native` 0.1.50 solo sobre
react-native-web (eso no es evidencia de nativo) y se descartó por joven (0.1.x, API en cambio), por su peso (5
dependencias propias) y porque el diseño sigue siendo propio; se adaptan sus patrones, no la librería.

## Goals / Non-Goals

**Goals:**
- Un chat reconocible (mensajes, composer, lista anclada, estados) que sea la base del agente futuro.
- Conversación persistida y privada; audio conservado 90 días; contexto de paciente automático.
- Una sola superficie de conversación: el chat absorbe «Conocimiento» y `/knowledge`.
- Sin tokens, colores ni animaciones nuevos; WCAG 2.2 AA en claro y oscuro; web y nativo.

**Non-Goals:**
- El agente real, editar/regenerar mensajes, menciones por nombre, varias conversaciones.
- Streaming simulado: el puerto lo admite, la UI no lo finge.

## Decisions

### D1. Modelo de mensaje con partes, independiente de la UI

```
Message { id, role: 'user'|'assistant', createdAt, status: 'sending'|'thinking'|'done'|'error',
          patientId: string|null, parts: Part[] }
Part = { type:'text', text } | { type:'knowledge', queryId, answer } |
       { type:'audio', durationMs, transcript, audioPath|null, audioState:'ready'|'expired'|'deleted' } |
       { type:'proposal', proposal: AgentProposalData } | { type:'notice', text }
```

Un registro `tipo → componente` pinta cada parte; un agente futuro añade tipos sin tocar la lista.
Patrón tomado de assistant-ui y del AI SDK. `proposal` reutiliza `AgentProposal` (confirmación
atribuida, procedencia «Inferida»). Persistir una propuesta no equivale a confirmarla: una propuesta del
historial no se puede aplicar sin una confirmación nueva del veterinario que decide.

`Message.status` se acota en el almacén efímero a los cuatro valores; solo `done` y `error` se persisten (D3).

### D2. Puerto `respond`

```ts
interface Responder { respond(history: Message[], input: Input, signal: AbortSignal): AsyncIterable<ResponseEvent> }
```

Respondedores: `BasicResponder` (fecha, agenda, pacientes de hoy; hoy `consultas-basicas.ts`) y
`KnowledgeResponder` (`consultKnowledge`). Un `Router` elige por `detectIntent`. Cada uno emite un único
evento «listo» (respuesta entera); la interfaz ya consume el iterable, así que el streaming real
cambiará solo al respondedor. `signal` alimenta «Detener».

Errores y «Detener»: una pregunta de conocimiento sin paciente de contexto se responde con los avisos de
cobertura de la base (FR-007), no es un error; sin red el mensaje queda `error` con «Reintentar». «Detener»
descarta la respuesta parcial (no se persiste) pero **no** cancela el registro de `knowledge_queries`: si la
consulta ya se lanzó, FR-020 exige registrarla.

### D3. Persistencia: tabla propia privada

Migración `022_asistente_conversacional.sql`: `assistant_messages (id uuid pk, clinic_id, author_id →
veterinarians, role, parts jsonb, status ('done'|'error'), patient_id uuid null → clinical_records,
audio_path text null, audio_expires_at timestamptz null, created_at)`. `patient_id` lleva FK y el mismo
trigger guardián de clínica que `knowledge_queries` (010), para que un cliente no guarde el id de un
paciente de otra clínica. RLS: solo el autor, dentro de su clínica **y con acceso activo**
(`is_active_access(auth.uid())`, como la 019), lee e inserta. El cliente no tiene DELETE (invariante de
pgTAP 003: `authenticated` no borra de ninguna tabla de `public`): el borrado va por la RPC
`delete_assistant_conversation()` (`SECURITY DEFINER`, acotada a `auth.uid()` con acceso activo).

**Solo se persisten mensajes terminales** (`done` o `error`). `sending` y `thinking` viven en el almacén
efímero, de modo que un cierre de pestaña no deja filas huérfanas y no hay UPDATE de cliente. «Inmutable»
significa «sin edición por el usuario»: la única mutación es `audio_path` a NULL y la marca `audioState` de
la parte de audio, y la hacen la RPC de «Eliminar audio» y la purga (`SECURITY DEFINER`, acotada a esos
dos campos y a una sola vez). Un mensaje de audio se inserta una vez, ya transcrito (D5). El mensaje del
asistente lo inserta el cliente del autor al terminar la respuesta, también terminal. Lectura paginada por
`(created_at, id)` descendente de a 50. En el cliente, TanStack Query (`useInfiniteQuery`) es la fuente; el
almacén zustand conserva solo lo efímero (borrador, pendiente, no leído). *Alternativas rechazadas*: traza
clínica append-only (más sensible y no permite el derecho a retirar la conversación) y persistir desde
`sending` con UPDATE por RPC y máquina de estados (filas huérfanas y más superficie).

### D4. Borrar la conversación

Borrar objetos de Storage no se puede por SQL, así que el borrado lo orquesta una Edge Function
(`delete-assistant-conversation`, JWT del autor) que elimina los objetos de su audio con la API de Storage
—la misma lógica que la purga, extraída a `_shared`— y luego llama a la RPC `delete_assistant_conversation()`
que borra las filas del autor. `knowledge_queries` no se toca (auditoría, FR-020); la confirmación lo dice.

### D5. Audio: grabador, bucket y función

- **Grabador**: se reutiliza `WindowRecorder` (`create-window-recorder(.web).ts`). Una máquina de estados
  `idle → recording → review → sending` (hook `useVoiceMessage`), por toque, con límites 1 s a 2 min; el
  máximo corta solo la grabación y pasa a revisión. El reproductor de revisión usa `expo-audio` (nativo) y
  `HTMLAudioElement` (web) tras una interfaz común.
- **Un solo micrófono**: el estado de la escucha (`useListenMode`) ya es global al panel; si está
  `capturando`, el botón queda deshabilitado con su motivo.
- **Bucket** `assistant-audio`, privado, ruta `{clinic_id}/{author_id}/{message_id}.{ext}`; RLS de
  storage: solo el autor sube y lee (URL firmada de corta vida) y solo mientras `audio_expires_at` no haya
  pasado.
- **Función nueva** `transcribe-chat-audio` (decisión del usuario): mismo proveedor (`gpt-transcribe`);
  autentica el JWT y comprueba la clínica del usuario con acceso activo en vez de una sesión de escucha.
  Responde `{ text, quality }` como `transcribe-audio`. `supabase/functions/_shared` **no existe hoy**: se
  crea al extraer lo común con `transcribe-audio` (cliente del proveedor, cálculo de `quality`, registro).
  Entrada `[functions.transcribe-chat-audio] verify_jwt = true` en `supabase/config.toml`.
- **Límites en servidor**: los 2 min se imponen por **tamaño en bytes** (tope derivado del bitrate
  máximo de `MediaRecorder`/`expo-audio` para 2 min) y por tipo MIME permitido (`audio/webm`, `audio/mp4`);
  la duración que declara el cliente solo es informativa, no un control. El tiempo hacia el proveedor sube
  de 20 s a 60 s para el chat, porque 2 min de audio con 20 s daría `TRANSCRIPTION_TIMEOUT` frecuentes;
  una prueba del handler cubre el tope y el tiempo. Se prueban ambos contenedores (webm y mp4).
- **Flujo de envío**: el mensaje pendiente vive en el almacén efímero (`sending`); se sube el audio, se
  transcribe y, solo entonces, se inserta **un único** mensaje de usuario terminal con la transcripción, y
  el asistente responde sobre ella. Si falla la subida o la transcripción, el pendiente queda en `error`
  en el almacén con «Reintentar» (no se persiste) y el objeto subido, si lo hay, se elimina.
- **Observabilidad** (Constitución IV): `transcribe-chat-audio`, `purge-chat-audio` y
  `delete-assistant-conversation` emiten registros estructurados con `requestId`, sin registrar audio ni
  transcripción; la purga registra cuántos objetos borró y cuáles fallaron. Los errores del cliente
  (subida, transcripción, render de markdown) se reportan a `report-client-error`.

### D6. Vencimiento a 90 días

La fecha `audio_expires_at = created_at + 90 d` decide la lectura: pasada, no se emite URL firmada y el
cliente pinta «audio vencido» al instante. La eliminación real del archivo la hace una Edge Function
programada (`purge-chat-audio`, con service role) invocada a diario con `pg_cron` + `pg_net`: borrar filas
de `storage.objects` por SQL no elimina el archivo del almacenamiento, así que se usa la API de Storage.
«Eliminar audio» llama a la misma lógica para un mensaje. Riesgo: si el job falla, el archivo sobrevive
pero ya es ilegible; la tarea 7.6a lo verifica.

**Retención y acceso.** Se conservan 90 días porque el audio solo sirve para que el veterinario reoiga lo
que dictó; la transcripción, que es lo que usa el asistente, permanece como texto. Lee el audio solo su
autor con acceso activo (URL firmada de corta vida); el único otro acceso es el service role de la purga y
del borrado. Cuando un veterinario pierde el acceso o se da de baja, su audio se purga en la siguiente
corrida (la purga también recorre autores sin acceso activo). Ningún secreto va en el repositorio ni en
registros.

**Autenticación de la purga.** `purge-chat-audio` NO usa el JWT de un usuario: `pg_cron` la invoca con
`pg_net` y un secreto compartido guardado en Vault, que la función compara en tiempo constante (se
configura con `verify_jwt = false` solo para esta función y rechaza cualquier llamada sin el secreto).
`pg_cron` y `pg_net` no están hoy en las migraciones ni en `config.toml`: la migración 022 los habilita si
el Supabase local los admite; si no, el cron queda como configuración de despliegue, declarada en
`quickstart.md`. En local se prueba el handler invocándolo directamente; lo programado se verifica en el
entorno remoto.

### D7. Conocimiento dentro del chat

El `KnowledgeResponder` produce una parte `knowledge` (con `queryId`) y la lista pinta
`RespuestaConocimiento` + «Ver respaldo registrado» (extraídos de `ConocimientoThread`). Se retiran la
pestaña «Conocimiento» y los selectores; `/knowledge` renderiza `ChatThread` a pantalla completa con el
mismo almacén. Las pantallas de colección y visor de `/knowledge` no cambian.

### D8. Paciente de contexto automático

`PatientContextProvider` en el shell expone el contexto actual; ficha y consulta lo fijan con
`usePatientContext(id)` (que ya existe) y lo limpian al desmontar. Sale el efecto «con `null` no toca el
contexto» y `conversation-store.patientId` pasa a derivarse del proveedor. La etiqueta «Contexto: nombre»
la pinta la cabecera del chat; el nombre se lee de la ficha ya cargada, sin consulta extra. El mensaje
guarda `patientId` al enviarse (el de ese instante, no el de la respuesta).

Regla de dueño: **el último en montar gana, y al desmontar limpia solo quien lo fijó** (cada setter guarda
su propio id). Así, pasar de la ficha a una consulta del mismo paciente no parpadea, y una consulta con la
ficha abierta en el panel anidado no se pisa. Una pregunta en vuelo al cambiar de pantalla sigue usando el
paciente con que se envió.

### D9. Markdown con `marked`

`marked` (zero-dependencias, mantenido) tokeniza; un renderizador propio (`MarkdownText`) pinta los
tokens con `Text`/`Heading` y las tablas, listas y código con tokens del sistema, sin estilos externos.
HTML crudo e imágenes se convierten en texto; los enlaces se validan (`http(s)` o ruta interna) y los
externos llevan `rel="noopener"` y el destino visible. *Alternativas rechazadas*: `react-native-marked`
(arrastra `reanimated-table`, `svg-parser` y estilos que chocan con la guarda de tokens) y
`react-native-markdown-display` (sin mantenimiento desde 2023). Se verifica en una pasada corta que
`marked` corre en Metro (web y nativo) antes de construir el renderizador (tarea 4.0). Plan B si no corre
en nativo: `markdown-it` (también sin dependencias de runtime) o un tokenizador mínimo propio para el
subconjunto usado.

**Presupuesto de rendimiento** (Constitución, «Restricciones de Aplicación Web»). Medido en la tarea 4.0
(`marked` 18.1.2, sin dependencias propias, `bun audit` sin hallazgos sobre él):

| Medida | Resultado | Presupuesto |
|---|---|---|
| Peso añadido al bundle web (`expo export`, entrada minificada, gzip) | +14,3 KB (804,7 → 819,0 KB; +50 KB sin comprimir) | ≤ +20 KB gzip |
| Tokenizar 50 mensajes con encabezado, tabla, lista, cita, código, enlace, HTML e imagen | mediana 1,3–1,8 ms, p95 1,8–3,2 ms (Node y Bun, escritorio) | ≤ 16 ms en web (un cuadro) |
| Primer pintado de 50 mensajes completos (React) | se mide en 4.1, con `MarkdownText` | ≤ 100 ms |
| Metro nativo | `expo export` de iOS y Android compila (Hermes) y resuelve `marked` | sin cambios en la configuración de Metro |

Tokenizar es barato; lo que decide es el render, que no se puede medir sin el renderizador. El tope
nativo no se mide aquí (Hermes en un teléfono): se verifica en el dispositivo con la lista de 8.4.
`marked` tokeniza HTML crudo como `html` y las imágenes como `image`, de modo que el renderizador los
vuelve texto sin ejecutarlos. 4.1 y 8.3 verifican contra estos números; si el primer pintado supera el
tope, el plan B (`markdown-it` o tokenizador mínimo) se evalúa antes de integrar.

### D10. Lista y composer

- Lista: en web, `ScrollView` con anclaje al final (observa el crecimiento del contenido y la distancia al
  final); en nativo, el mismo `ScrollView` (se evaluó `FlatList`, pero no virtualiza a propósito —50 mensajes por página— y un solo componente evita dos implementaciones). La decisión de
  anclaje (¿cerca del final?, conteo de nuevos) es una **función pura compartida** por ambas
  implementaciones, con prueba unitaria, para que no diverjan. «Ir al final» se muestra si hay nuevos
  fuera de vista. Desplazamiento instantáneo.
- Composer: `Input` multilínea que crece de 1 a 6 líneas; en web, Enter/Shift+Enter por el manejador de
  teclas de RNW (patrón de `option-picker.tsx`), con guarda de composición IME (probada con eventos
  simulados: el e2e no reproduce una composición real); en nativo Enter inserta un salto y se envía solo
  con el botón «Enviar». «Detener» con el `AbortSignal`. En nativo, el composer vive en la hoja modal; el teclado se maneja con `KeyboardAvoidingView`
  y se revisa en dispositivo (tarea 8.4); `react-native-keyboard-controller` queda como alternativa si falla.

### D11. Estilo y accesibilidad

Mensaje del usuario: bloque `bg-primary-surface`, `rounded-sm`, a la derecha, hasta ~85 % del ancho.
Asistente: sin caja, rótulo `rubric` «Asistente · hora», texto del sistema. Las partes de conocimiento y de
propuesta conservan sus pliegos (`SuggestedBlock`). La lista es `role="log"` con `aria-label`; el cuerpo en
streaming no es región viva; «Pensando», «Respuesta lista» y errores van en `role="status"`/`alert`
aparte. La carga inicial de los 50 mensajes no se anuncia (solo los nuevos). El micrófono anuncia solo inicio
y fin de la grabación, no cada segundo. Sin tokens ni animación; se respeta `prefers-reduced-motion` y el
contraste del texto sobre `bg-primary-surface` en oscuro es criterio de la prueba axe.
`DESIGN.md` documenta el mensaje, el composer y el audio como composición.

### D12. No leído

Un contador en el almacén efímero (`unread`) sube cuando llega una respuesta con el hilo fuera de vista y
se pone a cero al abrirlo; se pinta junto al icono del Asistente en el riel y en el dock y se anuncia con
`role="status"`.

## Risks / Trade-offs

- **Audio como dato clínico en un tercero** (OpenAI transcribe): ya es el caso de la escucha; se mantiene el
  aviso con el plazo de 90 días y el audio nunca sale en claro de Storage sin URL firmada del autor.
- **Purga**: depende de `pg_cron`/`pg_net`, de un secreto en Vault y de una Edge Function programada; en
  local se prueba el handler directo y lo programado se declara como configuración de despliegue (D6).
- **Audio a un tercero**: el chat es de uso libre y puede grabarse cualquier cosa (incluidos datos del
  tutor); el aviso «Grabando y conservando audio» lo dice y la tarea de revisión de seguridad lo revisa.
- **Navegadores**: el e2e de audio usa el micrófono falso de Chromium; Firefox y WebKit prueban el composer
  y los límites con un archivo, y la limitación se declara (Constitución, matriz de navegadores).
- **Duplicación con la escucha**: la grabación del chat y la de la escucha comparten `WindowRecorder` pero no
  su estado; el bloqueo mutuo evita dos usos del micrófono.
- **Fusionar «Conocimiento»** cambia varias pruebas. Orden decidido: **#70 se mergea primero** y esta rama
  se actualiza con `main` por merge fast-forward (sin rebase); los requisitos de #70 que este cambio reemplaza («Conocimiento en el panel»,
  «Hilo del asistente con consultas básicas» y «Conocimiento» en «Hilos contextuales del panel») se
  quedan en la spec de #70 (se revierte su retiro del commit `b76bc00` en esta rama) y aquí se retiran con
  un delta REMOVED/MODIFIED de `sistema-visual`, de modo que #70 se valida y archiva sola.
- **Nativo sin verificar aquí**: la verificación es del desarrollador en su teléfono; hasta entonces, pendiente.

## Migration Plan

1. Mergear #70 y actualizar esta rama con `main` por merge fast-forward (sin rebase). 2. Migración 022 + `db:types`. 3. Desplegar
`transcribe-chat-audio`, `purge-chat-audio` y `delete-assistant-conversation`, guardar el secreto en Vault
y programar la purga. Reversión: revertir el commit y `drop` de la tabla y el bucket (los mensajes son del
chat; las auditorías de conocimiento no se tocan).

## Open Questions

- Ninguna bloqueante: las decisiones de producto están cerradas en `proposal.md`. El presupuesto de
  rendimiento está fijado en D9 (medido en 4.0); falta medir el primer pintado de 50 mensajes (4.1) y el
  comportamiento del teclado nativo. Supuestos a confirmar con la prueba: 60 s hacia el proveedor y el
  tope en bytes para 2 min (D5).
