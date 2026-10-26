# Tasks

Pruebas primero (Constitución II): cada tarea con código abre con su prueba en rojo. RAM baja:
Playwright con `--workers=1` y un proyecto a la vez. Sin tokens ni colores nuevos
(`tests/unit/theme/tema.test.ts` verde). La verificación nativa es del desarrollador en su teléfono.

## 1. Base

- [ ] 1.1 Confirmar que la rama sale de `feat/shell-asistente-tres-zonas` (PR #70) y registrar en `quickstart.md` el estado de #70. Verificación: `git log` con #70 en la base.

## 2. Modelo, puerto y respondedores (D1 · D2)

- [ ] 2.1 En rojo `tests/unit/asistente/chat-model.test.ts` y luego `Message` y `Part` (`src/features/asistente/chat-model.ts`). Verificación: prueba verde (tipos y reglas de estado).
- [ ] 2.2 En rojo y luego el puerto `Responder` con `AsyncIterable`, `BasicResponder`, `KnowledgeResponder` y `Router` (reutiliza `consultas-basicas.ts`). Verificación: `responders.test.ts` con un respondedor falso que emite por trozos y con «Detener» (`AbortSignal`).
- [ ] 2.3 En rojo y luego el almacén efímero (borrador por hilo, pendiente, no leído). Verificación: el borrador sobrevive al cambio de hilo y se limpia al cerrar la sesión.

## 3. Persistencia (D3 · D4)

- [ ] 3.1 En rojo `tests/integration/asistente-mensajes.test.ts` (suite viva): solo el autor lee, inserta y borra; otro veterinario de la clínica no ve; sin UPDATE salvo el audio. Luego migración `022_asistente_conversacional.sql` y `bun run db:types`. Verificación: `SUPABASE_LIVE_TESTS=1` verde.
- [ ] 3.2 En rojo y luego el servicio y `useInfiniteQuery`: 50 últimos, «Cargar anteriores» sin perder posición. Verificación: prueba con 120 mensajes.
- [ ] 3.3 En rojo y luego «Borrar conversación» (`delete_assistant_conversation`, confirmación que declara que `knowledge_queries` permanece). Verificación: prueba viva: no quedan mensajes ni audio y las filas de `knowledge_queries` siguen.

## 4. Interfaz del chat (D9 · D10 · D11 · D12)

- [ ] 4.1 Pasada corta: `marked` corre en Metro web y nativo; medir el aporte al bundle. En rojo `markdown-text.test.tsx` y luego `MarkdownText` (énfasis, listas, tablas, código, citas; HTML e imágenes como texto; enlaces `http(s)`/internos, externos con `rel="noopener"` y destino visible). Verificación: prueba verde, `tema.test.ts` verde.
- [ ] 4.2 En rojo y luego `MessageItem` y el registro de partes (texto, conocimiento con «Ver respaldo registrado», audio, propuesta), con rótulo, hora, estados y acciones (copiar, reintentar, eliminar audio). Sin burbujas. Verificación: pruebas por parte y por estado.
- [ ] 4.3 En rojo y luego `Composer` (multilínea 1–6 líneas, Enter/Shift+Enter con guarda IME, «Detener», foco tras enviar, envío deshabilitado vacío). Verificación: prueba de teclas y e2e.
- [ ] 4.4 En rojo y luego `MessageList` anclada al final con «Ir al final» y conteo de nuevos; `role="log"`; «Pensando…» en `role="status"`. Verificación: e2e «no arrastra a quien lee» y axe.
- [ ] 4.5 En rojo y luego el aviso de no leído en el riel y el dock. Verificación: e2e con el panel colapsado.
- [ ] 4.6 Reemplazar `AsistenteThread` por `ChatThread` en el panel y en la hoja; migrar el contenido de `asistente-store`. Verificación: e2e de `panel-asistente` adaptados.

## 5. Contexto de paciente automático (D8)

- [ ] 5.1 En rojo y luego `PatientContextProvider`: ficha y consulta fijan y limpian al salir; etiqueta «Contexto: nombre»; el mensaje guarda `patientId`. Verificación: unitarias y e2e «entrar a Bruma / volver al inicio».
- [ ] 5.2 Retirar `SelectorPacienteContexto` y sus consultas de `ConocimientoThread` y de `/knowledge`; ajustar `conocimiento.spec.ts` (el e2e «el contexto de paciente se busca sin tildes» deja de existir con el selector). Verificación: e2e de conocimiento verdes y la desviación declarada.

## 6. Fusión de Conocimiento (D7)

- [ ] 6.1 Eliminar el hilo «Conocimiento» del shell y hacer que `/knowledge` muestre el chat a pantalla completa. Verificación: e2e `panel-conocimiento` y `conocimiento` adaptados; el panel ya no tiene pestañas en el Inicio ni en las demás pantallas con un solo hilo.

## 7. Audio (D5 · D6)

- [ ] 7.1 En rojo `supabase/functions/transcribe-chat-audio/handler.test.ts` y luego la función (usuario autenticado de la clínica, sin sesión de escucha; límites de tiempo, tamaño y 2 min; mismo proveedor). Verificación: pruebas del handler y llamada local.
- [ ] 7.2 En rojo y luego bucket `assistant-audio` y su RLS (en la migración 022). Verificación: suite viva (solo el autor sube y lee; no se firma URL tras el vencimiento).
- [ ] 7.3 En rojo `use-voice-message.test.ts` y luego la máquina `idle → recording → review → sending` (reutiliza `WindowRecorder`; 1 s a 2 min; permiso denegado; bloqueada con la escucha activa). Verificación: pruebas con grabador falso.
- [ ] 7.4 En rojo y luego la interfaz del micrófono en el composer: grabando (punto, tiempo, Cancelar, Detener), revisión (reproducir, Descartar, Enviar), aviso «Grabando y conservando audio» con el plazo de 90 días. Verificación: e2e con el micrófono falso de Chromium y axe.
- [ ] 7.5 En rojo y luego el envío: subir, transcribir, completar el mensaje y responder sobre la transcripción; «No se entendió» y «Reintentar». Verificación: e2e con audio de prueba y con ASR insuficiente.
- [ ] 7.6 En rojo y luego `purge-chat-audio` (Edge Function programada con `pg_cron` + `pg_net`) y «Eliminar audio». Verificación: prueba viva con un mensaje de 91 días: archivo eliminado, transcripción conservada y marcada «audio vencido».

## 8. Verificación integrada

- [ ] 8.1 Extender `accessibility.spec.ts` (axe WCAG 2.2 AA, `chromium` y `chromium-dark`) al chat con mensajes, audio en revisión y estados de error. Verificación: sin violaciones.
- [ ] 8.2 Verificación visual en bloque, una sola ronda: capturas a 1440, 1280, 1024 y 375 px, claro y oscuro, del chat vacío, con conversación, con audio y en error; corregir todo en un lote y confirmar con una ronda más. Verificación: capturas en `quickstart.md`.
- [ ] 8.3 Compuertas: `bunx biome ci --error-on-warnings .`, `bun run typecheck`, `tema.test.ts`, `SUPABASE_LIVE_TESTS=1 bun run test` (sola), `openspec validate chat-del-asistente --strict`. Verificación: salidas en `quickstart.md`.
- [ ] 8.4 Lista de comprobación nativa en `quickstart.md` (grabar, revisar, enviar, permiso denegado, teclado y composer en la hoja, reproducir, no leído en el dock) y ejecución por el desarrollador en su teléfono. Se marca solo con su confirmación; si no, queda declarada pendiente.

## 9. Docs y reconciliación de specs

- [ ] 9.1 `DESIGN.md` (mensaje, composer, audio, marca de no leído como composición, sin tokens nuevos), `PRODUCT.md`, brief de superficie de `impeccable` y `docs/brief-poc-cdss.md` si cambia la interacción con el asistente. Verificación: coherentes con lo construido.
- [ ] 9.2 Confirmar que `sistema-visual` (delta de #70) ya no contiene «Conocimiento en el panel» ni «Hilo del asistente con consultas básicas» y que «Hilos contextuales del panel» no lista «Conocimiento». Verificación: `openspec validate shell-asistente-tres-zonas --strict`.
- [ ] 9.3 `quickstart.md` con evidencia, desviaciones y pendientes declarados.

## Workflow follow-up

- Archivar `shell-asistente-tres-zonas` y luego este cambio.
- Cambio futuro aparte: **agente real** (LLM, herramientas, seguridad, revisión de HD1), editar/regenerar, menciones por nombre y varias conversaciones.
