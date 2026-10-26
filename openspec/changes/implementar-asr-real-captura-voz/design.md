# Design

## Context

`captura-voz-anamnesis` dejó dos seams con adaptadores simulados: `CaptureSource.windows()`
(`SyntheticCaptureSource`) y `TranscriptionPort.transcribe(window)` (`SimulatedTranscriptionAdapter`);
`AudioWindow.audio` ya existe como campo opaco. `use-listen-mode.ts` los instancia en `start()`.
La tubería posterior (tramo → extracción por reglas → borradores → revisión) y sus garantías (RLS,
triggers `guard_listening_session` / `guard_transcript_segment`, tramos sellados) no cambian.

Estado de la plataforma: no hay `expo-audio`; `supabase/config.toml` tiene `[storage] enabled =
false` y `db:start` excluye `storage-api`; existe una única Edge Function (`report-client-error`) con
el patrón «`index.ts` fino + `handler.ts` puro con dependencias inyectadas», probado sin Deno. Ver
`proposal.md` para el porqué.

## Goals / Non-Goals

**Goals:**
- Voz real de extremo a extremo (web y nativo) detrás de los seams actuales, sin tocar extracción,
  contradicciones ni revisión.
- Credencial del proveedor solo en el servidor; cada escritura sigue «fallando cerrado» en el servidor.
- Pruebas automatizadas sin micrófono, credencial ni red externa (modo simulado y dobles).

**Non-Goals:**
- Política de retención, consentimiento formal o cifrado adicional del audio (pendiente declarado).
- Separación de hablantes, ASR en streaming, otro idioma que no sea español.
- Cambiar la extracción (sigue por reglas, D4) o la UX de revisión.
- Uso con conversaciones reales de clientes: el PoC sigue con voces sintéticas.

## Decisions

### D1. Selección por entorno entre real y simulado

`EXPO_PUBLIC_VOZ_MODO=real` elige micrófono + transcripción remota; cualquier otro valor (por
defecto) mantiene el guion simulado. Un único punto de decisión en `use-listen-mode.ts`.
*Alternativa rechazada*: reemplazar los simulados — rompería los e2e/CI sin micrófono ni clave.
Es una configuración que un requisito actual exige (spec «Modo simulado conservado»).

### D2. Captura: ventanas autocontenidas por plataforma

Una fábrica `crearCaptureSource()` devuelve, por plataforma, una implementación de `CaptureSource`:
- **Web** (`microphone-capture-source.web.ts`): `getUserMedia` + `MediaRecorder` sobre un mismo
  `MediaStream`; al cumplirse `WINDOW_MS` se detiene y se reinicia el grabador para que cada `Blob`
  sea un archivo válido por sí solo (los fragmentos con `timeslice` no lo son). Formato
  `audio/webm;codecs=opus`.
- **Nativo** (`microphone-capture-source.native.ts`): `expo-audio` (`AudioModule.requestRecordingPermissionsAsync`,
  grabadora con preset de alta calidad en `m4a`), mismo ciclo de detener/reiniciar.
- `available()` solicita permiso y devuelve `false` si se deniega o no hay dispositivo (FR-054).
- `AudioWindow.audio` pasa a tipar `{ blob, mimeType, extension }`; el `AbortSignal` detiene el grabador y
  libera el micrófono (US6-AC5, FR-055); el fragmento parcial se entrega como última ventana.

El controlador procesa cada tramo antes de pedir el siguiente, así que la fuente reinicia la
grabación ANTES de entregar la ventana (si no, el micrófono quedaría mudo mientras se transcribe).
La duración se puede acortar con `EXPO_PUBLIC_VOZ_VENTANA_MS` (por defecto 30 000 ms): baja la
latencia sin más código, y el e2e la usa para no esperar 30 s.
*Alternativa rechazada*: una sola grabación larga cortada en el servidor — retrasa el primer
borrador (SC-028) y complica el cierre. *Costo aceptado*: un hueco de pocos milisegundos entre
ventanas puede cortar una palabra (`ponytail`: solapamiento si la calidad lo exige).

### D3. Transcripción: Edge Function `transcribe-audio` + adaptador remoto

`RemoteTranscriptionAdapter` (cliente) envía la ventana por `supabase.functions.invoke` y
`supabase/functions/transcribe-audio/` (`index.ts` fino + `handler.ts` puro, patrón de
`report-client-error`) hace, en orden:
1. valida método, `multipart/form-data`, tamaño ≤ 10 MB, `listeningSessionId` (uuid) y tipo MIME
   permitido (`audio/webm`, `audio/mp4`, `audio/m4a`, y `video/webm`: el mismo contenedor WebM de solo
   audio que algunos runtimes reetiquetan);
2. con el cliente de Supabase **bajo el JWT del solicitante** (RLS vigente) lee la sesión de
   escucha: debe existir, ser de su clínica y estar `active` y su consulta abierta; si no,
   `403` sin llamar al proveedor (fallo cerrado, FR-014);
3. llama a OpenAI `gpt-transcribe` (`/v1/audio/transcriptions`, `language=es`) con tiempo máximo
   de 20 s y la clave de `OPENAI_API_KEY` (secreto de la función);
4. responde `{ text, quality }`. La calidad es `insufficient` si el texto recortado tiene menos de
   3 caracteres o solo puntuación (FR-031; heurística simple, `ponytail`: logprobs si hace falta).

Registro estructurado con `requestId`, duración, tamaño y estado; **nunca** audio ni texto (dato
clínico). El cliente traduce todo error a una excepción con motivo, y la tubería existente descarta
el tramo y cierra la sesión `interrupted` (D10 del diseño anterior, FR-055).
*Alternativa rechazada*: llamar a OpenAI desde el cliente — expone la clave. *Rechazada también*:
ASR en el navegador (Web Speech) — no cubre nativo y no permite conservar el audio de forma uniforme.
Modelo confirmado (tarea 1.1): `gpt-transcribe`, USD 0,0045 por minuto de audio, endpoints
`v1/audio/transcriptions` (archivo) y `v1/realtime/transcription_sessions` (streaming por turnos);
la página no fija formatos ni tamaño máximo, así que `webm` y `m4a` se verifican en la prueba 6.3.

**Streaming evaluado y diferido.** El precio es por minuto de audio, así que el streaming no
abarata nada: solo baja la latencia del primer borrador. Además exige PCM16 mono a 24 kHz por
WebSocket con un secreto efímero acuñado por la función. Es viable en ambas plataformas sin
dependencias nuevas: en web con un `AudioWorklet` y en nativo con `useAudioStream` de `expo-audio`
(PCM `int16`, aunque solo como *hook* y con una tasa de muestreo que puede diferir de la pedida, así
que habría que remuestrear a 24 kHz). Pero exige además acuñar el secreto efímero, manejar el
protocolo Realtime (eventos, turnos y reconexión), partir los turnos en tramos para los guardas y la
extracción, y duplica la ruta de audio (PCM en vivo para el ASR y grabación para conservarlo). Se
mantienen ventanas con petición/respuesta, con la duración como
opción de la fuente (`windowMs`, ya existente), de modo que acortarla (p. ej. 10 s) baja la latencia
sin más código. El streaming queda como mejora detrás del mismo `TranscriptionPort`, a decidir con la
latencia y la calidad medidas con audio real (ver Open Questions).

### D4. Audio en Storage, solo después de un tramo aceptado

Bucket privado `consultation-audio` (límite 10 MB, MIME `audio/webm`, `audio/mp4`, `audio/m4a`),
ruta `{clinic_id}/{listening_session_id}/{seq}.{ext}`. Orden en el cliente, por tramo:
1. `saveTranscriptSegment` con `audio_path` ya calculado (el servidor valida el prefijo contra
   la clínica y la sesión en `guard_transcript_segment`);
2. `upload` del audio a esa ruta.

La política INSERT de `storage.objects` exige que exista un `transcript_segments` de la clínica
con ese `audio_path`: el audio no puede existir sin un tramo aceptado por los guardas (spec
«Conservación del audio»). Si la subida falla, el tramo se resuelve `discarded` y se informa
(fallar cerrado, sin audio huérfano ni tramo sin audio). Políticas SELECT/INSERT por clínica; sin
UPDATE ni DELETE (el audio es evidencia; el borrado queda para la política de retención pendiente).
El audio viaja dos veces (función y Storage): ~100–300 KB por ventana de 30 s, aceptable.
*Alternativa rechazada*: que la función suba el audio — dejaría archivos huérfanos si luego se
rechaza el tramo.

Migración `019_audio_voz.sql`: columna `audio_path text` en `transcript_segments` (inmutable tras el
INSERT, grant de columna), ampliación del guardia, bucket y políticas.

### D5. Aviso de grabación y conservación

`ListenModeSection` muestra, mientras `modo.state === "capturando"` y el modo es real, un aviso
persistente: «Se está grabando y conservando el audio de esta conversación», con texto (no solo
color), `role="status"` y `aria-live="polite"` (patrón de `ListenStatusIndicator`). Sin flujo de
consentimiento (fuera de alcance); queda como pendiente de discovery.

### D6. Stack local, secreto y CI

`config.toml` `[storage] enabled = true`; `db:start` deja de excluir `storage-api`; el secreto
local va en `supabase/functions/.env` (ignorado por git, con `.env.example`); `supabase functions
serve` lo carga. CI corre las pruebas con el modo simulado y un doble del proveedor, así que no
necesita la clave; sí necesita `storage-api` para las pruebas vivas de Storage.

### D7. Estrategia de pruebas

- Unitarias: `handler.ts` con proveedor y Supabase falsos (validación, 403, tiempo máximo, calidad,
  sin fuga de credencial); fuentes de captura con `MediaRecorder`/`expo-audio` falsos (ventanas
  autocontenidas, permiso denegado, abortar libera).
- pgTap: guardia con `audio_path` (prefijo inválido, inmutabilidad) y políticas de Storage
  (otra clínica, sin tramo previo, UPDATE/DELETE).
- Integración viva: subida y lectura reales de Storage con dos clínicas.
- e2e web (Chromium con `--use-fake-device-for-media-stream`): captura real del micrófono falso
  y `route` de Playwright que intercepta `transcribe-audio`; no depende de OpenAI.
- Prueba opt-in contra OpenAI real (`OPENAI_API_KEY`), fuera de CI, con una grabación sintética.
- **Nativo**: pruebas unitarias con módulo simulado; el flujo en dispositivo (permisos, grabación)
  queda **sin verificar** aquí y se declara como verificación manual pendiente.

## Seguimiento de complejidad (Principio III)

| Elemento | Requisito que lo exige | Se elimina cuando |
|---|---|---|
| `expo-audio` (dependencia de ejecución, solo nativo) | Captura en iOS/Android (spec «Captura real del micrófono») | Nunca mientras se soporte voz nativa |
| Edge Function `transcribe-audio` (servicio nuevo) | Credencial fuera del cliente (spec «sin exponer credenciales») | Si el proveedor ofrece tokens efímeros de cliente |
| `EXPO_PUBLIC_VOZ_MODO` (configuración) | Pruebas sin micrófono ni clave (spec «Modo simulado») | Si el e2e y CI pasan a usar siempre el modo real con dobles |
| `EXPO_PUBLIC_VOZ_VENTANA_MS` (configuración opcional) | Ventanas de ~30 s (brief §5) que el e2e y la demo deben poder acortar | Si la duración se fija como decisión de producto |
| `E2E_CLEAR_CACHE` (interruptor del script e2e) | Metro hornea `EXPO_PUBLIC_*` en su caché: cambiar de modo exige limpiarla | Nunca mientras haya dos modos de e2e |
| Bucket y políticas de Storage, columna `audio_path` | Conservación del audio por tramo | Al decidir una política que lo reemplace |
| `storage-api` en el stack local y CI | Pruebas vivas de Storage | Con la anterior |

Capas arquitectónicas nuevas: ninguna (adaptadores tras los seams existentes).

## Risks / Trade-offs

- **Audio de consultas a un tercero** → solo voces sintéticas en el PoC; hay que revisar la
  retención del proveedor y la base legal antes de cualquier uso con datos reales (pendiente de
  discovery, documentado en el aviso y en el quickstart).
- **Coste/abuso**: cualquier veterinario autenticado puede disparar transcripciones → tope de
  10 MB, sesión activa exigida en el servidor y ventanas de 30 s; cuota por usuario (patrón
  `consume_client_error_quota`) queda como seguimiento.
- **Palabras cortadas entre ventanas** → aceptado (D2); medir con la prueba opt-in.
- **Calidad del español real/ruido de consulta** → el extractor por reglas puede rendir peor que
  con el guion; SC-004/SC-016 no se reafirman con audio real (siguen medidos sobre el guion).
- **Navegador**: el micrófono exige `localhost` o HTTPS; Safari/Firefox difieren en MIME de
  `MediaRecorder` → se detecta con `isTypeSupported`, y si no hay formato soportado `available()`
  devuelve `false`.
- **Nativo sin verificar en esta máquina** → verificación manual declarada, no se afirma como hecha.
- **Subida fallida tras aceptar el tramo** → el tramo se descarta y se informa (D4); nunca queda
  audio sin tramo.

## Open Questions

- ¿Hace falta streaming en vivo? Depende de si la latencia de la ventana (30 s por defecto, brief
  §5) es aceptable en la demo; no cambia specs ni tareas, porque se enchufa detrás de
  `TranscriptionPort`.

## Migration Plan

Aditivo: nueva migración y función; sin cambios en datos existentes (las filas previas quedan con
`audio_path` nulo). Despliegue: aplicar la migración, publicar la función y crear el secreto
`OPENAI_API_KEY`; activar `EXPO_PUBLIC_VOZ_MODO=real` por entorno. Reversión: quitar la variable
(vuelve el modo simulado); el audio ya guardado permanece.
