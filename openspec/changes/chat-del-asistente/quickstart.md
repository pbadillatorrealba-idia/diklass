# Quickstart

Evidencia, despliegue y lo declarado del cambio `chat-del-asistente`.

## Despliegue de la purga del audio (7.6a)

La purga corre fuera del cliente y **no usa el JWT de un usuario**: `pg_cron` invoca la Edge Function
`purge-chat-audio` con `pg_net` y un secreto compartido que la función comprueba en tiempo constante
(sin él rechaza y no borra nada; sin secreto configurado, responde 503).

1. **Secreto de la función** (no va en el repositorio ni en registros):
   `supabase secrets set PURGE_CHAT_AUDIO_SECRET=<secreto largo y aleatorio>`
2. **Desplegar** `supabase functions deploy purge-chat-audio` (`verify_jwt = false` solo aquí, ya en `config.toml`).
3. **Guardar el mismo secreto en Vault** y programar la corrida diaria (SQL en el entorno remoto; el
   Supabase local puede no traer `pg_cron`/`pg_net`, por eso es configuración de despliegue):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select vault.create_secret('<el mismo secreto>', 'purge_chat_audio_secret');
select cron.schedule(
  'purge-chat-audio',
  '17 3 * * *', -- a diario, 03:17 UTC
  $$select net.http_post(
      url := '<URL de las funciones>/purge-chat-audio',
      headers := jsonb_build_object(
        'x-purge-secret',
        (select decrypted_secret from vault.decrypted_secrets where name = 'purge_chat_audio_secret')
      ),
      body := '{}'::jsonb
    )$$
);
```

4. **Verificar**: invocar la función a mano con el secreto y comprobar el registro estructurado
   `purge_chat_audio_done` (`requestId`, `due`, `removed`, `failed`, `failedMessageIds`, `orphans`).

Qué purga: audio vencido (90 días), audio de autores con el usuario bloqueado en Auth (`banned_until`) y
objetos huérfanos de más de un día que ningún mensaje referencia. Si el job falla, el archivo sobrevive
pero ya es ilegible (la lectura no firma URL tras `audio_expires_at`).

En local se prueba el handler directamente (`tests/unit/asistente/purge-chat-audio-handler.test.ts`) y la
lógica SQL con pgTAP (`supabase/tests/011_purga_audio_asistente.sql`); lo programado se verifica en el
entorno remoto.

## Operación de la purga y del audio

- **Rotar el secreto:** generar uno nuevo, `supabase secrets set PURGE_CHAT_AUDIO_SECRET=<nuevo>` y, en
  Vault, `select vault.update_secret((select id from vault.secrets where name = 'purge_chat_audio_secret'),
  '<nuevo>')`. Hasta que coincidan las dos copias la purga responde 401 (y lo registra una vez por minuto).
- **Comprobar que el cron corre en el entorno remoto:** `select * from cron.job_run_details where jobid =
  (select jobid from cron.job where jobname = 'purge-chat-audio') order by start_time desc limit 5;` y el
  registro `purge_chat_audio_done` de la función; si aparece `"truncated": true` hay más de 20 tandas
  pendientes y se vuelve a invocar a mano.
- **Cambiar el aviso de primer uso:** subir `VOICE_CONSENT_VERSION` en `src/features/asistente/voice-consent.ts`
  (los veterinarios lo aceptan de nuevo; la llave `(autor, versión)` conserva la aceptación anterior como constancia).
- **Declarado:** la duración de la URL firmada la elige el cliente (la app pide 60 s; un cliente modificado
  podría pedir más para su propio audio, que muere cuando la purga borra el objeto); «dado de baja» es solo
  `banned_until` de Auth; sin sniffing de bytes del audio.

## Evidencia de las compuertas (8.3)

| Compuerta | Resultado |
|---|---|
| `bunx biome ci --error-on-warnings .` | salida 0 |
| `bun run typecheck` (`tsc --noEmit`) | salida 0 |
| `tests/unit/theme/tema.test.ts` | 369 pass |
| `SUPABASE_LIVE_TESTS=1 bun run test` (sola) | 1674 pass, 4 skip, 0 fail |
| `supabase test db` (pgTAP) | todo en verde (004 con dieciocho funciones, 011 de la purga) |
| `openspec validate chat-del-asistente --strict` | válido |
| e2e `chromium` (`--workers=1`, de a uno) | `chat-asistente`, `chat-voz`, `chat-voz-sin-permiso`, `panel-asistente`, `panel-conocimiento`, `conocimiento`, `estados` y `accessibility` en verde |
| axe WCAG 2.2 AA | `accessibility` y `chat-voz` en `chromium` y `chromium-dark`, con mensajes en markdown, errores, avisos y todos los estados de voz |

Nota sobre un registro anterior: durante el trabajo se descubrió que una comprobación de `biome ci` que
leía solo la última línea de la salida ocultaba 11 diagnósticos de lint heredados de PRs anteriores; se
corrigieron y la salida se verifica ahora por su código de salida.

## Verificación visual (8.2)

Una sola ronda sobre 16 capturas (1440, 1280, 1024 y 375 px; claro y oscuro) y una segunda de confirmación.
Se corrigieron en un lote cuatro defectos: el campo del composer quedaba de ~170 px, el texto de ayuda se
apretaba junto a «Borrar conversación», los «Copiar» del asistente estaban 12 px desalineados y el «Enviar»
del audio se confundía con el del composer. Las definitivas están en `capturas/`:

| Captura | Qué muestra |
|---|---|
| `1440-claro-vacio.png` | chat vacío con las sugerencias |
| `1440-claro-conversacion.png`, `1440-oscuro-conversacion.png` | conversación con markdown, un mensaje de voz vencido y la respuesta |
| `1440-claro-grabando.png`, `1440-claro-revision.png` | grabando y en revisión |
| `1440-claro-aviso-primer-uso.png` | aviso del proveedor externo |
| `1440-claro-error.png` | error al enviar con «Reintentar» |
| `1024-claro-cajon.png` | cajón del panel |
| `375-claro-hoja.png`, `375-oscuro-hoja.png`, `375-claro-hoja-revision.png` | hoja en móvil |

## Desviaciones respecto del plan original

- Un solo `ScrollView` para web y nativo en lugar de `FlatList` (no virtualizamos).
- «Copiar» usa el portapapeles en web y la hoja de compartir en nativo (no hay módulo de portapapeles).
- El borrado de audio y de la conversación va por la API de Storage con la política del autor; no hay Edge
  Function `delete-assistant-conversation`.
- Aviso de primer uso con aceptación persistida por veterinario (no estaba en el plan; lo pidió la revisión
  de seguridad porque el audio va a un proveedor externo).
- «Dado de baja» = usuario bloqueado en Auth (`banned_until`).
- Los e2e de voz interceptan el ASR y Storage.

## Pendientes declarados

- **8.4 (tuyo): verificación nativa** en iOS y Android con la lista de abajo.
- Acuerdo de tratamiento de datos con el proveedor del ASR y revisión legal del texto del aviso.
- Transcripción real con el proveedor (requiere `supabase functions serve` y `OPENAI_API_KEY`; cuesta dinero).
- Archivar `shell-asistente-tres-zonas` **antes** que este cambio: el delta de `sistema-visual` de este
  cambio retira requisitos que ese cambio introduce, y `openspec archive` lo rechaza hasta entonces.
- Sniffing de bytes del audio; «pierde el acceso» sin bloqueo en Auth; `firefox` y `webkit` (sin micrófono
  falso); recuperar la pregunta tras una sesión expirada; pruebas del controlador con
  `@testing-library/react`; el no leído depende de que el panel desmonte el hilo al colapsar; altura fija de
  `/knowledge` con teclado virtual.
- Captura de voz de la consulta (`[id].tsx`): su cleanup al desmontar no corre al cambiar de pestaña
  (la pantalla queda montada); fuera de este cambio.

## Lista de comprobación nativa (8.4)

Para marcar `[x]` en 8.4, ejecútala en un teléfono real (iOS y Android) y anota el resultado:

- [ ] Abrir el panel: el hilo «Asistente» aparece en la hoja desde la cinta; la conversación se conserva.
- [ ] Teclado: al escribir, el composer sube con el teclado y no queda tapado; Enter inserta un salto de línea y
  se envía solo con «Enviar».
- [ ] Mensaje de texto: enviar, respuesta, «Copiar» (abre la hoja de compartir), «Reintentar» en modo avión.
- [ ] Aviso de primer uso: aparece la primera vez, «Cancelar» no graba, «Acepto y grabar» sí; no vuelve.
- [ ] Permiso de micrófono: aceptarlo graba; **denegarlo** muestra el aviso y deja escribir.
- [ ] Grabar: tiempo corriendo, «Cancelar» no deja nada, «Detener» pasa a revisión; menos de 1 s se descarta
  con aviso; a los 2 min se corta sola.
- [ ] Revisión: «Reproducir» suena (`expo-audio`), «Descartar» borra, «Enviar audio» sube, transcribe y responde.
- [ ] Mensaje enviado: muestra la transcripción, «Reproducir audio» suena y «Eliminar audio» pide confirmación
  y deja la transcripción.
- [ ] Un solo micrófono: con la escucha de una consulta activa el botón de grabar está deshabilitado y lo explica.
- [ ] No leído: con la hoja cerrada, una respuesta nueva marca la cinta («Respuesta nueva»).
- [ ] Lector de pantalla (VoiceOver / TalkBack): el panel de voz anuncia el inicio y el fin (no cada segundo) y
  el foco no se pierde al terminar una acción.
- [ ] Borrar la conversación: pide confirmación, declara que la auditoría permanece y vacía el chat.
