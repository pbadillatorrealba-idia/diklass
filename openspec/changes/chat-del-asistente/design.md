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
`role="log"` de MDN y de chat con streaming. Se probó `@assistant-ui/react-native` 0.1.50 sobre
react-native-web y funciona, pero se descartó por joven (0.1.x, API en cambio), por su peso (5
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
atribuida, procedencia «Inferida»).

### D2. Puerto `respond`

```ts
interface Responder { respond(history: Message[], input: Input, signal: AbortSignal): AsyncIterable<ResponseEvent> }
```

Respondedores: `BasicResponder` (fecha, agenda, pacientes de hoy; hoy `consultas-basicas.ts`) y
`KnowledgeResponder` (`consultKnowledge`). Un `Router` elige por `detectIntent`. Cada uno emite un único
evento «listo» (respuesta entera); la interfaz ya consume el iterable, así que el streaming real
cambiará solo al respondedor. `signal` alimenta «Detener».

### D3. Persistencia: tabla propia privada

Migración `022_asistente_conversacional.sql`: `assistant_messages (id uuid pk, clinic_id, author_id →
veterinarians, role, parts jsonb, status, patient_id uuid null, audio_path text null, audio_expires_at
timestamptz null, created_at)`. RLS: solo el autor, dentro de su clínica, lee, inserta y borra; sin UPDATE
salvo `audio_path` a NULL y `parts` para marcar el audio (función `SECURITY DEFINER` acotada). Los
mensajes son inmutables para el cliente. Lectura paginada por `(created_at, id)` descendente de a 50. En el
cliente, TanStack Query (`useInfiniteQuery`) es la fuente; el almacén zustand conserva solo lo efímero
(borrador, pendiente, no leído). *Alternativa rechazada*: traza clínica append-only (más sensible y no
permite el derecho a retirar la conversación).

### D4. Borrar la conversación

`delete_assistant_conversation()` borra las filas del autor y los objetos de su audio. `knowledge_queries`
no se toca (auditoría, FR-020); la confirmación lo dice.

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
- **Función nueva** `transcribe-chat-audio` (decisión del usuario): mismo proveedor (`gpt-transcribe`) y
  tope de 20 s al proveedor; autentica el JWT y comprueba la clínica del usuario en vez de una sesión de
  escucha; rechaza más de 2 min o tamaño excesivo. Responde `{ text, quality }` como `transcribe-audio`.
  Comparte con ella la lógica que se pueda extraer a un módulo (`supabase/functions/_shared`).
- **Flujo de envío**: se inserta el mensaje del usuario (`sending`), se sube el audio, se transcribe, se
  actualiza la parte con la transcripción y el asistente responde sobre ella. Si falla la subida o la
  transcripción, el mensaje queda en `error` con «Reintentar».

### D6. Vencimiento a 90 días

La fecha `audio_expires_at = created_at + 90 d` decide la lectura: pasada, no se emite URL firmada y el
cliente pinta «audio vencido» al instante. La eliminación real del archivo la hace una Edge Function
programada (`purge-chat-audio`, con service role) invocada a diario con `pg_cron` + `pg_net`: borrar filas
de `storage.objects` por SQL no elimina el archivo del almacenamiento, así que se usa la API de Storage.
«Eliminar audio» llama a la misma lógica para un mensaje. Riesgo: si el job falla, el archivo sobrevive
pero ya es ilegible; la tarea 7.6 lo verifica.

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
guarda `patientId` al enviarse (el de ese instante).

### D9. Markdown con `marked`

`marked` (zero-dependencias, mantenido) tokeniza; un renderizador propio (`MarkdownText`) pinta los
tokens con `Text`/`Heading` y las tablas, listas y código con tokens del sistema, sin estilos externos.
HTML crudo e imágenes se convierten en texto; los enlaces se validan (`http(s)` o ruta interna) y los
externos llevan `rel="noopener"` y el destino visible. *Alternativas rechazadas*: `react-native-marked`
(arrastra `reanimated-table`, `svg-parser` y estilos que chocan con la guarda de tokens) y
`react-native-markdown-display` (sin mantenimiento desde 2023). Se verifica en una pasada corta que
`marked` corre en Metro (web y nativo) antes de construir el renderizador (tarea 4.1).

### D10. Lista y composer

- Lista: en web, `ScrollView` con anclaje al final (observa el crecimiento del contenido y la distancia al
  final); en nativo, `FlatList` sin virtualizar a propósito (50 mensajes por página). «Ir al final» se
  muestra si hay nuevos fuera de vista. Desplazamiento instantáneo.
- Composer: `Input` multilínea que crece de 1 a 6 líneas; Enter/Shift+Enter por el manejador de teclas de
  RNW (patrón de `option-picker.tsx`), con guarda de composición IME; envío con «Enviar», «Detener» con el
  `AbortSignal`. En nativo, el composer vive en la hoja modal; el teclado se maneja con `KeyboardAvoidingView`
  y se revisa en dispositivo (tarea 8.4); `react-native-keyboard-controller` queda como alternativa si falla.

### D11. Estilo y accesibilidad

Mensaje del usuario: bloque `bg-primary-surface`, `rounded-sm`, a la derecha, hasta ~85 % del ancho.
Asistente: sin caja, rótulo `rubric` «Asistente · hora», texto del sistema. Las partes de conocimiento y de
propuesta conservan sus pliegos (`SuggestedBlock`). La lista es `role="log"` con `aria-label`; el cuerpo en
streaming no es región viva; «Pensando», «Respuesta lista» y errores van en `role="status"`/`alert`
aparte. El micrófono anuncia solo inicio y fin de la grabación, no cada segundo. Sin tokens ni animación.
`DESIGN.md` documenta el mensaje, el composer y el audio como composición.

### D12. No leído

Un contador en el almacén efímero (`unread`) sube cuando llega una respuesta con el hilo fuera de vista y
se pone a cero al abrirlo; se pinta junto al icono del Asistente en el riel y en el dock y se anuncia con
`role="status"`.

## Risks / Trade-offs

- **Audio como dato clínico en un tercero** (OpenAI transcribe): ya es el caso de la escucha; se mantiene el
  aviso con el plazo de 90 días y el audio nunca sale en claro de Storage sin URL firmada del autor.
- **Purga**: depende de `pg_cron`/`pg_net` y de una Edge Function programada; verificar en local y declarar
  cómo se programa en el entorno remoto (la config es de despliegue, no del cliente).
- **Duplicación con la escucha**: la grabación del chat y la de la escucha comparten `WindowRecorder` pero no
  su estado; el bloqueo mutuo evita dos usos del micrófono.
- **Fusionar «Conocimiento»** cambia varias pruebas; los requisitos de #70 que lo describían se movieron a este cambio, así que #70 queda sin requisito para lo que su código aún construye hasta que este cambio se mergee.
- **Nativo sin verificar aquí**: la verificación es del desarrollador en su teléfono; hasta entonces, pendiente.

## Migration Plan

1. Mergear #70 (o apilar). 2. Migración 022 + `db:types`. 3. Desplegar `transcribe-chat-audio` y programar
`purge-chat-audio`. Reversión: revertir el commit y `drop` de la tabla y el bucket (los mensajes son del
chat; las auditorías de conocimiento no se tocan).

## Open Questions

- Ninguna bloqueante: las decisiones de producto están cerradas en `proposal.md`. Pendientes de medir:
  tamaño real del bundle con `marked` y comportamiento del teclado nativo.
