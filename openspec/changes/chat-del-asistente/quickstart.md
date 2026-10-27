# Quickstart

Evidencia, despliegue y lo declarado del cambio `chat-del-asistente`. Se completa con 9.3.

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
