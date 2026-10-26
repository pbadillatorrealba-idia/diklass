# Tasks

Pruebas primero (Constitución II): cada tarea con código escribe su prueba en rojo y luego lo
implementa. Cuenta de RAM baja: ejecutar las verificaciones pesadas una a la vez (`workers=1`).

## 1. Preparación y plataforma

- [x] 1.1 Confirmar contra la documentación enlazada (gpt-transcribe) el identificador del modelo, el endpoint, los formatos de audio aceptados y el tamaño máximo, y registrarlos en `design.md` D3. Verificación: `GET /v1/models/gpt-transcribe` responde 200 con la clave local y `design.md` D3 registra modelo, precio, endpoints y la evaluación del streaming; formatos y tamaño máximo no figuran en la página y se verifican en 6.3.
- [x] 1.2 Activar Storage local: `[storage] enabled = true` en `supabase/config.toml`, quitar `-x storage-api` de `db:start` y de los comandos de CI que lo excluyan, y documentarlo en `SETUP.md`. Verificación: `supabase status` muestra `storage-api` sano y `curl http://127.0.0.1:54321/storage/v1/` responde. (Pedir al usuario reiniciar el stack: ver memoria de RAM/podman.)
- [x] 1.3 Añadir `expo-audio` con `bunx expo install expo-audio` y su plugin de permisos de micrófono en `app.json` (texto de uso en español). Verificación: `bun run typecheck` limpio y `bunx expo config` muestra el permiso.

## 2. Base de datos (D4)

- [x] 2.1 Escribir en rojo `supabase/tests/019_audio_voz.sql` (pgTap): `audio_path` con prefijo ajeno a la clínica o sesión rechazado, `audio_path` inmutable tras el INSERT, INSERT en `storage.objects` sin tramo previo rechazado, otra clínica sin acceso (SELECT/INSERT), UPDATE y DELETE de audio rechazados. Verificación: `supabase test db` falla solo en los casos nuevos.
- [x] 2.2 Escribir `supabase/migrations/019_audio_voz.sql`: columna `audio_path`, ampliación de `guard_transcript_segment`, bucket privado `consultation-audio` (10 MB, MIME permitidos) y políticas de `storage.objects`. Verificación: `supabase test db` verde (019 y las anteriores) y `bun run db:types` sin diff tras regenerar y commitear los tipos.

## 3. Transcripción remota (D3)

- [x] 3.1 Escribir en rojo `tests/unit/voz/transcribe-audio-handler.test.ts` (patrón de `tests/unit/observability/report-client-error-handler.test.ts`): método/MIME/tamaño inválidos, sin JWT, sesión ajena/cerrada/consulta cerrada → 403 sin llamar al proveedor, tiempo máximo y error del proveedor, calidad `insufficient` (vacío, solo puntuación), la clave no aparece en la respuesta ni en los registros. Verificación: la prueba falla antes de implementar.
- [x] 3.2 Implementar `handler.ts` (puro, dependencias inyectadas) e `index.ts` (cliente bajo el JWT del solicitante, `OPENAI_API_KEY` desde el entorno, registro estructurado sin audio ni texto). Verificación: `handler.test.ts` verde.
- [x] 3.3 Escribir en rojo `tests/unit/voz/remote-transcription-adapter.test.ts` y luego `src/features/voz/remote-transcription-adapter.ts` (implementa `TranscriptionPort`, traduce errores a excepciones con motivo, tiempo máximo de 30 s). Verificación: prueba verde; con función simulada que falla, el tramo se descarta vía la tubería existente.
- [x] 3.4 Registrar la función en `supabase/config.toml` (`verify_jwt = true`) y crear `supabase/functions/.env.example`; ignorar `supabase/functions/.env` en git. Verificación: `supabase functions serve --env-file supabase/functions/.env` sirve la función y una petición sin JWT devuelve 401.

## 4. Captura del micrófono (D2)

- [x] 4.1 Escribir en rojo `tests/unit/voz/microphone-capture-source.test.ts` con `MediaRecorder` y `getUserMedia` falsos: ventanas autocontenidas por `WINDOW_MS`, `seq` correlativo, permiso denegado y falta de formato soportado → `available() === false`, `AbortSignal` libera el micrófono y entrega el fragmento parcial. Verificación: falla antes de implementar.
- [x] 4.2 Implementar `src/features/voz/microphone-capture-source.web.ts` y la fábrica `crearCaptureSource()`; tipar `AudioWindow.audio` (`{ blob, mimeType }`). Verificación: prueba 4.1 verde y `bun run typecheck` limpio.
- [x] 4.3 Escribir en rojo la prueba de la fuente nativa con `expo-audio` simulado y luego `microphone-capture-source.native.ts` (permiso, grabadora `m4a`, mismo ciclo). Verificación: prueba verde; la ejecución en dispositivo queda como verificación manual (ver 7.3).

## 5. Almacenamiento del audio y cableado (D1 · D4 · D5)

- [x] 5.1 Escribir en rojo `tests/unit/voz/audio-storage.test.ts` y luego `src/features/voz/audio-storage.ts`: ruta `{clinic}/{sesión}/{seq}.{ext}`, subida tras guardar el tramo y descarte del tramo si la subida falla. Verificación: pruebas verdes, incluido el caso de fallo.
- [x] 5.2 Cablear `use-listen-mode.ts`: `EXPO_PUBLIC_VOZ_MODO=real` usa la fuente de micrófono, el adaptador remoto y la subida; otro valor mantiene el guion simulado. Documentar la variable en `.env.example`. Verificación: pruebas del controlador y de `listen-mode-pipeline` siguen verdes y una nueva prueba cubre la selección.
- [x] 5.3 Escribir en rojo y luego implementar el aviso de grabación/conservación en `ListenModeSection` (texto, `role="status"`, `aria-live`), visible solo con el modo real y la captura activa. Verificación: prueba de componente y `tests/e2e/web/accessibility.spec.ts` sin violaciones nuevas.

## 6. Verificación integrada

- [x] 6.1 Escribir `tests/integration/voz/audio-storage.test.ts` (vivo): subida y lectura reales con dos clínicas, audio sin tramo rechazado, UPDATE/DELETE rechazados. Verificación: con `SUPABASE_LIVE_TESTS=1` y Storage activo, verde.
- [x] 6.2 Escribir `tests/e2e/web/modo-escucha-real.spec.ts` (`E2E_CLEAR_CACHE=1 EXPO_PUBLIC_VOZ_MODO=real EXPO_PUBLIC_VOZ_VENTANA_MS=2000`; paso propio en CI) (Chromium con dispositivo de medios falso, `route` de Playwright que intercepta `transcribe-audio`): aviso visible, tramo y borrador aparecen, el audio queda en Storage, permiso denegado → «captura no disponible» y anamnesis manual. Verificación: pasa con `--project=chromium --workers=1`.
- [x] 6.3 Prueba opt-in `tests/integration/voz/asr-openai.test.ts` (`skipIf(!OPENAI_API_KEY)`) con una grabación sintética breve en español contra la función real. Verificación: con clave, la transcripción contiene las palabras esperadas; sin clave, queda en skip.
- [x] 6.4 Ejecutar las compuertas: `bunx biome ci --error-on-warnings .`, `bun run typecheck`, `supabase test db`, `bun run db:types` sin diff, unitarias e integración vivas (de a una) y `openspec validate implementar-asr-real-captura-voz`. Verificación: salidas pegadas en `quickstart.md`.

## 7. Cierre

- [x] 7.1 Escribir `quickstart.md` del cambio: cómo activar el modo real localmente (stack, secreto, función, variable), evidencia real de las compuertas y pendientes declarados (política de retención y consentimiento, cuota por usuario, base legal del proveedor).
- [ ] 7.2 Reconciliar con `captura-voz-anamnesis` al archivar: actualizar su supuesto «Sin retención de audio» y D10 «sin audio» para que apunten a esta capacidad. Verificación: no quedan afirmaciones contradictorias en las specs principales tras `/opsx:archive`.
- [ ] 7.3 Verificación manual en dispositivo (iOS y Android) del permiso, la grabación, el aviso y la transcripción real, con evidencia en `quickstart.md`. Verificación: checklist completado; mientras no se haga, el cambio NO declara soporte nativo verificado.

## Workflow follow-up

- Archivar primero `implementar-captura-voz-anamnesis` y luego este cambio.
