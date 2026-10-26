# Quickstart — ASR real en el modo de escucha

Cómo ejercer el cambio y qué evidencia hay. Solo datos y voces sintéticos.

## Activar el modo real localmente

1. Supabase con Storage: `bun run db:start` (ya no excluye `storage-api`) y `supabase migration up --local`
   (o `supabase db reset --local` si no importa perder los datos locales) para aplicar la 019.
2. Secreto de la función: `cp supabase/functions/.env.example supabase/functions/.env` y poner
   `OPENAI_API_KEY` (el archivo está ignorado por git).
3. Servir la función: `supabase functions serve --env-file supabase/functions/.env`.
4. App: `EXPO_PUBLIC_VOZ_MODO=real` (opcional `EXPO_PUBLIC_VOZ_VENTANA_MS=10000` para latencia menor) y
   limpiar la caché de Metro (`bun run start -- -c`). El navegador pide el micrófono en `localhost`.
5. Abrir una consulta, pulsar «Modo de escucha»: aparece el aviso «Se está grabando y conservando el
   audio». Cada ventana se transcribe y puebla los borradores; el audio queda en el bucket
   `consultation-audio` con la ruta `{clínica}/{sesión}/{seq}.{ext}` en `transcript_segments.audio_path`.

Sin `EXPO_PUBLIC_VOZ_MODO=real` todo sigue como antes (guion simulado, sin micrófono ni terceros).

## Evidencia (local, 2026-10-26)

| Qué | Cómo | Resultado |
|---|---|---|
| Esquema y políticas (D4) | `supabase test db supabase/tests/019_audio_voz.sql` y `021_audio_voz_revision.sql` | **rojo antes** de la 019 (10/11 fallan) y de la 021 (5/7); **11/11** y **7/7** después |
| Resto de pgTap | `supabase test db` | **All tests successful** (21 archivos, 355 pruebas) |
| Handler de la función | `bun test tests/unit/voz/transcribe-audio-handler.test.ts` | 9/9; rojo antes (módulo inexistente) |
| Adaptador remoto, fuente de micrófono, grabadores web/nativo, Storage, entradas | `bun test tests/unit/voz` | **122 pass / 0 fail** |
| Transcripción real (OpenAI `gpt-transcribe`), WebM y M4A | `SUPABASE_LIVE_TESTS=1 VOZ_ASR_LIVE=1 bun test tests/integration/voz/asr-openai.test.ts` | **3/3**: ambos formatos se transcriben en español con calidad `ok` y la sesión inexistente da 403 sin llamar al proveedor |
| Storage real | `tests/integration/voz/audio-storage.test.ts` (vivo) | 5/5 |
| e2e web con micrófono real (Chromium, dispositivo falso, función interceptada) | `E2E_CLEAR_CACHE=1 EXPO_PUBLIC_VOZ_MODO=real EXPO_PUBLIC_VOZ_VENTANA_MS=2000 bunx playwright test modo-escucha-real.spec.ts --project=chromium --workers=1` | 2/2 (captura, aviso, audio en Storage, permiso denegado) |
| e2e web en modo simulado | `E2E_CLEAR_CACHE=1 bunx playwright test modo-escucha.spec.ts --project=chromium --workers=1` | 1/1 |
| Compuertas | `bunx biome ci --error-on-warnings .`, `bun run typecheck`, `openspec validate --strict`, `SUPABASE_LIVE_TESTS=1 bun run test` | sin diagnósticos; verde; válido; **1158 pass / 4 skip / 0 fail** |

`database.types.ts`: se añadió `audio_path` a mano porque el CLI local formatea distinto que el de CI;
el campo coincide con la salida de `supabase gen types --local` (comprobado), y el job de CI lo verifica.

## Desviaciones respecto del plan

- La prueba del handler vive en `tests/unit/voz/` (patrón del repositorio), no junto a la función.
- La función acepta `video/webm` (mismo contenedor WebM de solo audio): Bun y algunos navegadores lo
  reetiquetan al armar el `FormData`.
- Se añadieron `EXPO_PUBLIC_VOZ_VENTANA_MS` y `E2E_CLEAR_CACHE` (ver complejidad en `design.md`).
- Streaming evaluado y diferido (`design.md` D3): el costo es por minuto, no cambia el precio.
- `supabase db reset` no se ejecutó en el stack compartido (borra datos locales); se aplicó la 019
  con `migration up`. La revisión de la PR #66 es la **021** (no 020: `chore/depurar-suite-tests` ya
  usa `020_*` y su versión está aplicada en la base compartida, así que el CLI se niega a aplicar
  migraciones nuevas); se aplicó su SQL directamente en el contenedor y se registró la versión.
- Revisión de la PR #66: el audio pasa a `ArrayBuffer`/`uri` (React Native) y se endurecieron la
  política de Storage y el descarte por fallo de subida (tareas 8.1–8.7).

## Pendientes declarados

- **Dispositivo iOS/Android**: el grabador nativo (`expo-audio`) se prueba con un módulo simulado; el
  permiso, la grabación y el aviso reales no se han ejercido (tarea 7.3). Hay que confirmar allí que
  la parte `{uri,name,type}` del multipart sube bien, que storage-js sube el `ArrayBuffer` y que el
  archivo sigue disponible tras `release()`. **No se afirma soporte nativo
  verificado.**
- **Retención y consentimiento del audio**: sin política (PoC sintético); sin UPDATE/DELETE del audio.
- **Cuota por usuario** en la función (cualquier veterinario autenticado puede disparar transcripciones).
- **Base legal / retención del proveedor** antes de cualquier uso con datos reales.
- **Palabras cortadas entre ventanas** y calidad del extractor por reglas con habla real: sin medir.
- **Firefox/WebKit**: el e2e con micrófono falso es solo de Chromium.
