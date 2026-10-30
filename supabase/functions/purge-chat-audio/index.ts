import { createClient } from "@supabase/supabase-js";
import { handlePurgeChatAudio, type PurgeDependencies } from "./handler.ts";

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get: (name: string) => string | undefined };
};

const BUCKET = "assistant-audio";
const LOTE = 100;

/** Secretos de la función (Principio V): nunca en el repositorio ni en registros. */
const SECRETO = Deno.env.get("PURGE_CHAT_AUDIO_SECRET") ?? "";

// Service role: la purga corre sin usuario. La autenticación es el secreto compartido de `pg_cron`.
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Las dependencias se crean UNA vez (no por petición): el limitador de rechazos guarda su estado por este
// objeto, y uno nuevo en cada petición lo dejaría sin memoria.
const deps: PurgeDependencies = {
  secret: SECRETO,
  log: (line) => console.error(line),
  randomId: () => crypto.randomUUID(),
  listDue: async () => {
    const { data, error } = await admin.rpc("assistant_audio_due", { p_limit: 500 });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ message_id: string; audio_path: string }>;
  },
  listOrphans: async () => {
    const { data, error } = await admin.rpc("assistant_audio_orphans", { p_limit: 500 });
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<{ name: string }>).map((fila) => fila.name);
  },
  // La API de Storage: borrar filas de `storage.objects` por SQL no elimina el archivo físico.
  removeObjects: async (paths) => {
    const failed: string[] = [];
    for (let i = 0; i < paths.length; i += LOTE) {
      const lote = paths.slice(i, i + LOTE);
      const { error } = await admin.storage.from(BUCKET).remove(lote);
      if (error) failed.push(...lote);
    }
    return { failed };
  },
  markPurged: async (messageIds) => {
    const { error } = await admin.rpc("assistant_audio_mark_purged", {
      p_message_ids: messageIds,
    });
    if (error) throw new Error(error.message);
  },
};

Deno.serve((request) => handlePurgeChatAudio(request, deps));
