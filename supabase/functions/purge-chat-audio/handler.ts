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
  /** Reloj (ms); entra por parámetro para limitar el registro de rechazos. */
  now?: () => number;
  /** Tamaño de cada tanda que devuelve `listDue`; una tanda llena indica que puede haber más. */
  batchSize?: number;
  /** Audio vencido o de autores sin acceso, aún con ruta en su mensaje. */
  listDue: () => Promise<DueAudio[]>;
  /** Objetos del bucket sin mensaje que los referencie (de más de un día). */
  listOrphans: () => Promise<string[]>;
  /** Borra objetos con la API de Storage; devuelve las rutas que NO se pudieron borrar. */
  removeObjects: (paths: string[]) => Promise<{ failed: string[] }>;
  /** Marca los mensajes: quita su ruta y deja la transcripción con «audio vencido». */
  markPurged: (messageIds: string[]) => Promise<void>;
};

/** Tandas máximas por corrida: evita un bucle sin fin y acota el tiempo de la función. */
const MAX_TANDAS = 20;
const VENTANA_RECHAZOS_MS = 60_000;
const MAX_RUTAS_FALLIDAS = 20;
const estadoRechazos = new WeakMap<object, { at: number; suppressed: number }>();

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
    // Un `rejected` por cada intento inundaría el registro (cualquiera puede probar secretos): se
    // registra uno por minuto con el conteo de los suprimidos.
    const ahora = (deps.now ?? Date.now)();
    const estado = estadoRechazos.get(deps) ?? { at: Number.NEGATIVE_INFINITY, suppressed: 0 };
    if (ahora - estado.at >= VENTANA_RECHAZOS_MS) {
      deps.log(
        JSON.stringify({
          event: "purge_chat_audio_rejected",
          requestId,
          code,
          status,
          ...(estado.suppressed > 0 ? { suppressed: estado.suppressed } : {}),
          timestamp: new Date().toISOString(),
        }),
      );
      estadoRechazos.set(deps, { at: ahora, suppressed: 0 });
    } else {
      estadoRechazos.set(deps, { at: estado.at, suppressed: estado.suppressed + 1 });
    }
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
    const tanda = deps.batchSize ?? 500;
    // Conjuntos: un mensaje que sigue fallando reaparece en cada tanda y no debe contarse otra vez.
    const vistos = new Set<string>();
    const fallidos = new Set<string>();
    const quitados = new Set<string>();
    let truncated = false;
    // Varias tandas: con más de un lote pendiente se repite hasta vaciar (con tope).
    for (let ronda = 0; ronda < MAX_TANDAS; ronda += 1) {
      const lote = await deps.listDue();
      if (lote.length === 0) break;
      for (const d of lote) vistos.add(d.message_id);
      const { failed } = await deps.removeObjects(lote.map((d) => d.audio_path));
      const fallidas = new Set(failed);
      const ok = lote.filter((d) => !fallidas.has(d.audio_path));
      for (const d of ok) {
        quitados.add(d.message_id);
        fallidos.delete(d.message_id);
      }
      for (const d of lote) if (fallidas.has(d.audio_path)) fallidos.add(d.message_id);
      // Solo se marcan los que se pudieron borrar: los demás se reintentan en la siguiente corrida.
      if (ok.length > 0) await deps.markPurged(ok.map((d) => d.message_id));
      if (lote.length < tanda) break; // tanda incompleta: ya no queda más
      if (ok.length === 0) break; // sin avance: lo mismo volvería a aparecer
      if (ronda === MAX_TANDAS - 1) truncated = true; // quedaba más: se avisa, no se pospone en silencio
    }
    const failedMessageIds = [...fallidos];
    const due = vistos.size;
    const removed = quitados.size;

    // Los huérfanos también van en tandas y también avisan si no alcanzó.
    let orphansRemoved = 0;
    const failedOrphans = new Set<string>();
    for (let ronda = 0; ronda < MAX_TANDAS; ronda += 1) {
      const lote = await deps.listOrphans();
      if (lote.length === 0) break;
      const { failed } = await deps.removeObjects(lote);
      const fallidas = new Set(failed);
      const ok = lote.filter((ruta) => !fallidas.has(ruta));
      orphansRemoved += ok.length;
      for (const ruta of fallidas) failedOrphans.add(ruta);
      if (lote.length < tanda) break;
      if (ok.length === 0) break;
      if (ronda === MAX_TANDAS - 1) truncated = true;
    }
    const failedOrphanPaths = [...failedOrphans].slice(0, MAX_RUTAS_FALLIDAS);

    const resumen = {
      due,
      removed,
      failed: failedMessageIds.length,
      orphans: orphansRemoved,
      truncated,
    };
    deps.log(
      JSON.stringify({
        event: "purge_chat_audio_done",
        requestId,
        ...resumen,
        failedMessageIds,
        failedOrphanPaths,
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
