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
