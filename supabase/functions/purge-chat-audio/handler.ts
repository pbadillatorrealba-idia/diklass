/**
 * Purga programada del audio del chat (cambio chat-del-asistente, D6 · tarea 7.6a). La invoca `pg_cron`
 * con `pg_net` y un secreto compartido guardado en Vault: NO usa el JWT de un usuario (`verify_jwt =
 * false` solo aquí). Elimina el audio vencido (90 días), el de autores cuyo acceso se bloqueó y los
 * objetos huérfanos que ningún mensaje referencia. Handler puro con dependencias inyectadas. Registra
 * con `requestId` cuántos objetos eliminó y cuáles fallaron; nunca el secreto ni el contenido.
 */

export type DueAudio = { message_id: string; audio_path: string };

export type PurgeDependencies = {
  /** Secreto compartido con `pg_cron`; vacío = no configurado (la función no opera). */
  secret: string;
  log: (line: string) => void;
  randomId: () => string;
  /** Audio vencido o de autores sin acceso, aún con ruta en su mensaje. */
  listDue: () => Promise<DueAudio[]>;
  /** Objetos del bucket sin mensaje que los referencie (de más de un día). */
  listOrphans: () => Promise<string[]>;
  /** Borra objetos con la API de Storage; devuelve las rutas que NO se pudieron borrar. */
  removeObjects: (paths: string[]) => Promise<{ failed: string[] }>;
  /** Marca los mensajes: quita su ruta y deja la transcripción con «audio vencido». */
  markPurged: (messageIds: string[]) => Promise<void>;
};

const respond = (body: Record<string, unknown>, status: number) => Response.json(body, { status });

/** Comparación en tiempo constante (no revela cuántos caracteres coinciden). */
function iguales(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diferencia = x.length ^ y.length;
  const largo = Math.max(x.length, y.length);
  for (let i = 0; i < largo; i += 1) diferencia |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diferencia === 0;
}

export async function handlePurgeChatAudio(
  request: Request,
  deps: PurgeDependencies,
): Promise<Response> {
  const requestId = deps.randomId();
  const fallo = (code: string, status: number) => {
    deps.log(
      JSON.stringify({
        event: "purge_chat_audio_rejected",
        requestId,
        code,
        status,
        timestamp: new Date().toISOString(),
      }),
    );
    return respond({ code, requestId }, status);
  };

  if (request.method !== "POST") return fallo("METHOD_NOT_ALLOWED", 405);
  // Falla cerrado: sin secreto configurado la función no opera, aunque llegue una petición válida.
  if (deps.secret === "") return fallo("NOT_CONFIGURED", 503);
  if (!iguales(request.headers.get("x-purge-secret") ?? "", deps.secret)) {
    return fallo("UNAUTHENTICATED", 401);
  }

  const inicio = Date.now();
  try {
    const due = await deps.listDue();
    const failedMessageIds: string[] = [];
    let removed = 0;
    if (due.length > 0) {
      const { failed } = await deps.removeObjects(due.map((d) => d.audio_path));
      const fallidas = new Set(failed);
      const ok = due.filter((d) => !fallidas.has(d.audio_path));
      removed = ok.length;
      for (const d of due) if (fallidas.has(d.audio_path)) failedMessageIds.push(d.message_id);
      // Solo se marcan los que se pudieron borrar: los demás se reintentan en la siguiente corrida.
      if (ok.length > 0) await deps.markPurged(ok.map((d) => d.message_id));
    }

    const orphans = await deps.listOrphans();
    let orphansRemoved = 0;
    if (orphans.length > 0) {
      const { failed } = await deps.removeObjects(orphans);
      orphansRemoved = orphans.length - failed.length;
    }

    const resumen = {
      due: due.length,
      removed,
      failed: failedMessageIds.length,
      orphans: orphansRemoved,
    };
    deps.log(
      JSON.stringify({
        event: "purge_chat_audio_done",
        requestId,
        ...resumen,
        failedMessageIds,
        durationMs: Date.now() - inicio,
        timestamp: new Date().toISOString(),
      }),
    );
    return respond({ ...resumen, requestId }, 200);
  } catch (error) {
    // Solo el nombre de la clase: no se arrastran mensajes con datos.
    deps.log(
      JSON.stringify({
        event: "purge_chat_audio_failed",
        requestId,
        error: { name: error instanceof Error ? error.name : "Error" },
        durationMs: Date.now() - inicio,
        timestamp: new Date().toISOString(),
      }),
    );
    return respond({ code: "PURGE_FAILED", requestId }, 500);
  }
}
