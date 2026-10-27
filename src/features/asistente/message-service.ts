import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Message } from "@/features/asistente/chat-model";
import { knowledgeAnswerSchema } from "@/features/conocimiento/schema";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { logEvent } from "@/lib/observability/logger";
import { errorReporter } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Conversación persistida del chat (asistente-conversacional «Conversación continua y privada» ·
 * design.md D3): los últimos 50 mensajes y «Cargar anteriores» por cursor `(created_at, id)`. Solo
 * se persisten mensajes terminales; la RLS deja leer y escribir únicamente al autor.
 */
export const PAGE_SIZE = 50;

export type Cursor = { createdAt: string; id: string };
export type MessagePage = {
  /** Cronológicos (el más antiguo primero) dentro de la página. */
  messages: Message[];
  /** Cursor para pedir lo anterior; `null` si no hay más. */
  next: Cursor | null;
};

const partSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("notice"), text: z.string() }),
  z.object({ type: z.literal("knowledge"), queryId: z.string(), answer: knowledgeAnswerSchema }),
  z.object({
    type: z.literal("audio"),
    durationMs: z.number(),
    transcript: z.string(),
    audioPath: z.string().nullable(),
    audioState: z.enum(["ready", "expired", "deleted"]),
  }),
  z.object({
    type: z.literal("proposal"),
    proposal: z.object({ id: z.string(), summary: z.string(), origin: z.string() }),
  }),
]);

const rowSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  status: z.enum(["done", "error"]),
  parts: z.array(partSchema),
  patient_id: z.string().nullable(),
  created_at: z.string(),
});

/** Fila → mensaje del modelo; una fila ilegible da `null` (se omite, no tumba la conversación). */
export function rowToMessage(row: unknown): Message | null {
  const parsed = rowSchema.safeParse(row);
  if (!parsed.success) return null;
  const { id, role, status, parts, patient_id, created_at } = parsed.data;
  return { id, role, createdAt: created_at, status, patientId: patient_id, parts };
}

/** Filtro de PostgREST para «lo anterior al cursor»; `null` sin cursor. */
export const cursorFilter = (cursor: Cursor | undefined) =>
  cursor
    ? `created_at.lt."${cursor.createdAt}",and(created_at.eq."${cursor.createdAt}",id.lt.${cursor.id})`
    : null;

export async function listMessages(
  client: SupabaseClient<Database>,
  cursor?: Cursor,
  pageSize = PAGE_SIZE,
): Promise<MessagePage> {
  const requestId = makeRequestId();
  try {
    let query = client
      .from("assistant_messages")
      .select("id, role, status, parts, patient_id, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      // Una fila de más dice si hay página anterior sin otra consulta.
      .limit(pageSize + 1);
    const filter = cursorFilter(cursor);
    if (filter) query = query.or(filter);
    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const pageRows = rows.slice(0, pageSize);
    const last = pageRows.at(-1);
    const messages = pageRows.flatMap((row) => {
      const message = rowToMessage(row);
      if (message === null) {
        logEvent(
          "asistente.row_content_skipped",
          { requestId, operation: "listMessages", recordId: row.id, errorName: "ZodError" },
          "error",
        );
      }
      return message ? [message] : [];
    });
    return {
      messages: messages.reverse(),
      next: rows.length > pageSize && last ? { createdAt: last.created_at, id: last.id } : null,
    };
  } catch (error) {
    void captureClientError(errorReporter, { error, operation: "listMessages", requestId });
    throw error;
  }
}

/** Persiste un mensaje terminal con el mismo id que tenía en la sesión (sin duplicarlo al reintentar). */
export async function insertMessage(
  client: SupabaseClient<Database>,
  input: { clinicId: string; message: Message },
): Promise<void> {
  const requestId = makeRequestId();
  const { message, clinicId } = input;
  try {
    const { error } = await client.from("assistant_messages").insert({
      id: message.id,
      clinic_id: clinicId,
      role: message.role,
      status: message.status as "done" | "error",
      parts: message.parts as never,
      patient_id: message.patientId,
    });
    if (error) throw error;
  } catch (error) {
    void captureClientError(errorReporter, { error, operation: "insertMessage", requestId });
    throw error;
  }
}

/** Páginas (de la más nueva a la más antigua) → lista cronológica de toda la conversación cargada. */
export const flattenPages = (pages: readonly MessagePage[]): Message[] =>
  [...pages].reverse().flatMap((page) => page.messages);

/**
 * Borra toda la conversación del autor con la RPC `delete_assistant_conversation` (el cliente no tiene
 * DELETE). `knowledge_queries` no se toca: es la auditoría de las consultas (FR-020) y la confirmación
 * lo declara. Con audio (7.x) la Edge Function `delete-assistant-conversation` elimina antes los
 * objetos de Storage y llama a esto.
 */
export async function deleteConversation(client: SupabaseClient<Database>): Promise<number> {
  const requestId = makeRequestId();
  try {
    const { data, error } = await client.rpc("delete_assistant_conversation");
    if (error) throw error;
    return data;
  } catch (error) {
    void captureClientError(errorReporter, { error, operation: "deleteConversation", requestId });
    throw error;
  }
}
