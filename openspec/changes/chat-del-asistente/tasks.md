# Tasks

Pruebas primero (Constitución II): cada tarea con código abre con su prueba en rojo. RAM baja:
Playwright con `--workers=1` y un proyecto a la vez. Sin tokens ni colores nuevos
(`tests/unit/theme/tema.test.ts` verde). La verificación nativa es del desarrollador en su teléfono.

## 1. Base

- [ ] 1.1 Orden decidido: mergear #70 primero y actualizar esta rama con `main` por merge fast-forward (sin rebase); revertir en esta rama el retiro de requisitos del shell hecho en `b76bc00` (quedan en la spec de #70) y registrar en `quickstart.md` el estado de #70. Verificación: `git log` con #70 en la base y `openspec validate shell-asistente-tres-zonas --strict` verde.

## 2. Modelo, puerto y respondedores (D1 · D2)

- [x] 2.1 En rojo `tests/unit/asistente/chat-model.test.ts` y luego `Message` y `Part` (`src/features/asistente/chat-model.ts`). Verificación: prueba verde (tipos y reglas de estado).
- [x] 2.2 En rojo y luego el puerto `Responder` con `AsyncIterable`, `BasicResponder`, `KnowledgeResponder` y `Router` (reutiliza `consultas-basicas.ts`). Verificación: `responders.test.ts` con un respondedor falso que emite por trozos y con «Detener» (`AbortSignal`: descarta lo parcial pero no la auditoría de `knowledge_queries` ya lanzada), conocimiento sin paciente y error de red.
- [x] 2.3 En rojo y luego el almacén efímero (borrador por hilo, pendiente, no leído). Verificación: el borrador sobrevive al cambio de hilo y se limpia al cerrar la sesión.

## 3. Persistencia (D3 · D4)

- [x] 3.1 En rojo `tests/integration/asistente-mensajes.test.ts` (suite viva): solo el autor con `is_active_access` lee, inserta y borra; otro veterinario de la clínica y un autor dado de baja no ven; solo se insertan `done`/`error`; sin UPDATE de cliente salvo quitar el audio; `patient_id` de otra clínica rechazado (FK y trigger guardián como `knowledge_queries`). Luego migración `022_asistente_conversacional.sql` y `bun run db:types`. Verificación: `SUPABASE_LIVE_TESTS=1` verde. Hecho: migración 022, `database.types.ts` y `tests/integration/asistente/asistente-mensajes.test.ts` (16 vivas) más pgTAP 003 y 004 actualizados. Desviación: no hay DELETE de cliente (borrado por RPC). Sin prueba de «paciente de otra clínica» por la API: la guarda de atribución impide sembrarlo; el predicado `clinic_id = new.clinic_id` queda cubierto por los casos «inexistente» y «una consulta que no es paciente».
- [x] 3.2 En rojo y luego el servicio y `useInfiniteQuery`: 50 últimos, «Cargar anteriores» sin perder posición. Verificación: prueba con 120 mensajes. Hecho: `message-service.ts` (cursor `(created_at, id)`, filas ilegibles omitidas con log) y `use-conversation.ts`; prueba viva con 120 mensajes (3 páginas, sin huecos ni repetidos).
- [ ] 3.3 Parcial: la RPC `delete_assistant_conversation` y `deleteConversation` están hechas y probadas (no quedan mensajes del autor, los de otros y `knowledge_queries` siguen). Faltan la Edge Function `delete-assistant-conversation` que elimina antes los objetos de Storage (con 7.2, cuando exista el bucket) y la confirmación que declara que `knowledge_queries` permanece (con la UI, 4.x).

## 4. Interfaz del chat (D9 · D10 · D11 · D12)

- [x] 4.0 Pasada de medición **antes de cerrar el diseño**: `marked` corre en Metro web y nativo (si no, plan B `markdown-it` o tokenizador mínimo); medir el aporte al bundle web (gzip) y el render de 50 mensajes con tablas y markdown; escribir el presupuesto con números en `design.md` D9; `bun audit` de `marked`. Verificación: presupuesto escrito en D9. Medido el 27-oct-2026: ver D9 (+14,3 KB gzip web; iOS y Android compilan; `bun audit` sin hallazgos sobre `marked`).
- [ ] 4.1 Con el presupuesto de 4.0 fijado, en rojo `markdown-text.test.tsx` y luego `MarkdownText` (énfasis, listas, tablas, código, citas; HTML e imágenes como texto; enlaces `http(s)`/internos, externos con `rel="noopener"` y destino visible). Verificación: prueba verde, `tema.test.ts` verde y dentro del presupuesto de D9.
- [ ] 4.2 En rojo y luego `MessageItem` y el registro de partes (texto, conocimiento con «Ver respaldo registrado», audio, propuesta), con rótulo, hora, estados y acciones (copiar, reintentar, eliminar audio). Sin burbujas. Verificación: pruebas por parte y por estado.
- [ ] 4.3 En rojo y luego `Composer` (multilínea 1–6 líneas, Enter/Shift+Enter con guarda IME solo en web, en nativo envío solo con el botón, «Detener», foco tras enviar, envío deshabilitado vacío). Verificación: prueba de teclas con eventos IME simulados y e2e.
- [ ] 4.4 En rojo y luego `MessageList` anclada al final con «Ir al final» y conteo de nuevos; la lógica de anclaje como función pura compartida por la lista web (`ScrollView`) y la nativa (`FlatList`); `role="log"` que no anuncia la carga inicial; «Pensando…» en `role="status"`. Verificación: prueba unitaria de la función de anclaje, e2e «no arrastra a quien lee» y axe.
- [ ] 4.5 En rojo y luego el aviso de no leído en el riel y el dock. Verificación: e2e con el panel colapsado.
- [ ] 4.6 Reemplazar `AsistenteThread` por `ChatThread` en el panel y en la hoja; migrar el contenido de `asistente-store`. Verificación: e2e de `panel-asistente` adaptados.

## 5. Contexto de paciente automático (D8)

- [ ] 5.1 En rojo y luego `PatientContextProvider`: ficha y consulta fijan y limpian al salir (el último en montar gana; al desmontar limpia solo quien lo fijó); etiqueta «Contexto: nombre»; el mensaje guarda el `patientId` del instante de envío. Verificación: unitarias (ficha→consulta del mismo paciente sin parpadeo, dos setters, mensaje en vuelo al cambiar de pantalla) y e2e «entrar a Bruma / volver al inicio».
- [ ] 5.2 Retirar `SelectorPacienteContexto` y sus consultas de `ConocimientoThread` y de `/knowledge`; ajustar `conocimiento.spec.ts` (el e2e «el contexto de paciente se busca sin tildes» deja de existir con el selector). Verificación: e2e de conocimiento verdes y la desviación declarada.

## 6. Fusión de Conocimiento (D7)

- [ ] 6.1 Eliminar el hilo «Conocimiento» del shell (`src/features/asistente/panel-threads.ts`: `FALLBACK_THREAD` pasa de `conocimiento` a `asistente`; `shell-threads.tsx`, `assistant-panel.tsx` y las pruebas de `panel-threads`) y hacer que `/knowledge` muestre el chat a pantalla completa. Verificación: prueba de que `FALLBACK_THREAD` ya no es `conocimiento`; e2e `panel-conocimiento` y `conocimiento` adaptados; el panel ya no tiene pestañas en el Inicio ni en las demás pantallas con un solo hilo.

## 7. Audio (D5 · D6)

- [ ] 7.1 En rojo `supabase/functions/transcribe-chat-audio/handler.test.ts` y luego la función (usuario autenticado de la clínica con acceso activo, sin sesión de escucha; tope en bytes para 2 min y MIME `webm`/`mp4`, sin fiarse de la duración del cliente; 60 s al proveedor; mismo proveedor; registros con `requestId` sin audio ni transcripción). Crear `supabase/functions/_shared` extrayendo lo común con `transcribe-audio` y añadir `[functions.transcribe-chat-audio] verify_jwt = true` en `supabase/config.toml`. Verificación: pruebas del handler (tope, MIME, tiempo) y llamada local.
- [ ] 7.2 En rojo y luego bucket `assistant-audio` y su RLS (en la migración 022; autor con acceso activo). Verificación: suite viva (solo el autor sube y lee; no se firma URL tras el vencimiento).
- [ ] 7.3 En rojo `use-voice-message.test.ts` y luego la máquina `idle → recording → review → sending` (reutiliza `WindowRecorder`; 1 s a 2 min; permiso denegado; bloqueada con la escucha activa). Verificación: pruebas con grabador falso.
- [ ] 7.4 En rojo y luego la interfaz del micrófono en el composer: grabando (punto, tiempo, Cancelar, Detener), revisión (reproducir, Descartar, Enviar), aviso «Grabando y conservando audio» con el plazo de 90 días. Verificación: e2e con el micrófono falso de Chromium y axe; en Firefox y WebKit (sin micrófono falso) el composer y los límites con un archivo; limitación declarada en `quickstart.md`.
- [ ] 7.5 En rojo y luego el envío: subir, transcribir, completar el mensaje y responder sobre la transcripción; «No se entendió» y «Reintentar». Verificación: e2e con audio de prueba y con ASR insuficiente.
- [ ] 7.6a En rojo y luego `purge-chat-audio`: Edge Function autenticada con un secreto compartido guardado en Vault (sin JWT de usuario; `verify_jwt = false` solo aquí y rechaza llamadas sin el secreto), que borra audio vencido y el de autores sin acceso activo con la API de Storage y registra totales y fallos con `requestId`; `pg_cron` + `pg_net` en la migración 022 si el Supabase local los admite, si no, declarado como configuración de despliegue en `quickstart.md`. Verificación: handler invocado directo con un mensaje de 91 días (archivo eliminado, transcripción conservada y marcada «audio vencido»), un autor dado de baja y una llamada sin secreto rechazada.
- [ ] 7.6b En rojo y luego «Eliminar audio» de un mensaje (misma lógica de borrado de `_shared`, con confirmación). Verificación: prueba viva: el archivo desaparece y la transcripción permanece; confirmación cancelada no borra.
- [ ] 7.7 Revisión de seguridad del audio y de la purga: retención de 90 días, acceso, secreto en Vault, datos a un tercero y `bun audit` de las dependencias nuevas, registrada en `quickstart.md`. Verificación: informe sin hallazgos críticos abiertos.

## 8. Verificación integrada

- [ ] 8.1 Extender `accessibility.spec.ts` (axe WCAG 2.2 AA, `chromium` y `chromium-dark`) al chat con mensajes, audio en revisión y estados de error. Verificación: sin violaciones.
- [ ] 8.2 Verificación visual en bloque, una sola ronda: capturas a 1440, 1280, 1024 y 375 px, claro y oscuro, del chat vacío, con conversación, con audio y en error; corregir todo en un lote y confirmar con una ronda más. Verificación: capturas en `quickstart.md`.
- [ ] 8.3 Compuertas: `bunx biome ci --error-on-warnings .`, `bun run typecheck`, `tema.test.ts`, `SUPABASE_LIVE_TESTS=1 bun run test` (sola), `openspec validate chat-del-asistente --strict`. Verificación: salidas en `quickstart.md`.
- [ ] 8.4 Lista de comprobación nativa en `quickstart.md` (grabar, revisar, enviar, permiso denegado, teclado y composer en la hoja, reproducir, no leído en el dock) y ejecución por el desarrollador en su teléfono. Se marca solo con su confirmación; si no, queda declarada pendiente.

## 9. Docs y reconciliación de specs

- [ ] 9.1 `DESIGN.md` (mensaje, composer, audio, marca de no leído como composición, sin tokens nuevos), `PRODUCT.md`, brief de superficie de `impeccable` y `docs/brief-poc-cdss.md` (el cambio altera la interacción con el asistente —voz y persistencia—, así que se actualiza antes de implementar, no «si cambia»). Verificación: coherentes con lo construido.
- [ ] 9.2 El delta MODIFIED/REMOVED de `sistema-visual` (`specs/sistema-visual/spec.md`, ya escrito) retira «Conocimiento en el panel» y «Hilo del asistente con consultas básicas» y quita «Conocimiento» de «Hilos contextuales del panel», porque esos requisitos se quedan en la spec de #70 (1.1); `openspec archive` solo lo acepta tras archivar #70. Verificación: `openspec validate shell-asistente-tres-zonas --strict` y `openspec validate chat-del-asistente --strict`.
- [ ] 9.3 `quickstart.md` con evidencia, desviaciones y pendientes declarados.

## Workflow follow-up

- Archivar `shell-asistente-tres-zonas` y luego este cambio.
- Cambio futuro aparte: **agente real** (LLM, herramientas, seguridad, revisión de HD1), editar/regenerar, menciones por nombre y varias conversaciones.
