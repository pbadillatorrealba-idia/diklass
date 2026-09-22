import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getPatient } from "@/features/registro/ficha-service";
import {
  captureClientError,
  type ErrorReporterClient,
  makeRequestId,
} from "@/lib/observability/client-error-reporter";
import { logEvent } from "@/lib/observability/logger";
import type { Database } from "@/lib/supabase/database.types";
import { type CandidatoFragmento, type ContextoPaciente, composeAnswer, resolveCitations } from "./answer";
import {
  type KnowledgeAnswer,
  type KnowledgeQueryRow,
  fragmentoRecuperadoSchema,
  knowledgeQueryRowSchema,
} from "./schema";

/**
 * Consulta al asistente de la base de conocimiento (D4–D7 del diseño del cambio): recupera
 * evidencia por FTS española, lee la ficha solo como contexto, compone la respuesta y la
 * registra para poder reconstruir qué datos y qué fuentes la produjeron (FR-020 · US5-AC5).
 */

type KnowledgeQueryInsert = Database["public"]["Tables"]["knowledge_queries"]["Insert"];

const preguntaSchema = z
  .string()
  .trim()
  .min(1, "Escribe tu pregunta al asistente.")
  .max(1000, "La pregunta es demasiado larga.");

const queryIdSchema = z.string().trim().min(1, "Identifica la consulta.");

const CANDIDATOS_POR_DEFECTO = 25;

export async function consultKnowledge(
  client: SupabaseClient<Database>,
  input: { clinicId: string; pregunta: string; patientId: string | null },
): Promise<{ queryId: string; answer: KnowledgeAnswer }> {
  const requestId = makeRequestId();
  try {
    const pregunta = preguntaSchema.parse(input.pregunta);
    const { data, error } = await client.rpc("search_knowledge_fragments", {
      p_query: pregunta,
      p_limit: CANDIDATOS_POR_DEFECTO,
    });
    if (error) {
      throw error;
    }
    const recuperados = z.array(fragmentoRecuperadoSchema).parse(data ?? []);
    const candidatos: CandidatoFragmento[] = recuperados.map((fila) => ({
      documentoId: fila.documento_id,
      fragmentoOrdinal: fila.fragmento_ordinal,
      texto: fila.texto,
      seccion: fila.seccion,
      bibliografia: fila.bibliografia,
      licencia: fila.licencia,
      estado: fila.estado,
      lemasCubiertos: fila.lemas_cubiertos,
      lemasPregunta: fila.lemas_pregunta,
      rankCd: fila.rank_cd,
    }));

    let paciente: ContextoPaciente = null;
    if (input.patientId !== null) {
      const ficha = await getPatient(client, input.patientId);
      if (ficha !== null) {
        paciente = { id: input.patientId, content: ficha.content };
      }
    }

    const answer = composeAnswer({
      pregunta,
      lemasPregunta: candidatos[0]?.lemasPregunta ?? [],
      candidatos,
      paciente,
    });

    const registro: KnowledgeQueryInsert = {
      clinic_id: input.clinicId,
      question: pregunta,
      patient_id: input.patientId,
      answer: answer as never,
    };
    const { data: fila, error: errorRegistro } = await client
      .from("knowledge_queries")
      .insert(registro as never)
      .select("*")
      .single();
    if (errorRegistro || !fila) {
      throw errorRegistro ?? new Error("No se pudo registrar la consulta de conocimiento.");
    }
    logEvent("conocimiento.query_recorded", { requestId, operation: "consultKnowledge" });
    return { queryId: (fila as KnowledgeQueryRow).id, answer };
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "consultKnowledge",
      requestId,
    });
    throw error;
  }
}

export async function listQueries(client: SupabaseClient<Database>): Promise<KnowledgeQueryRow[]> {
  const requestId = makeRequestId();
  try {
    const { data, error } = await client
      .from("knowledge_queries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      throw error;
    }
    return (data ?? []).flatMap((row) => {
      const legible = knowledgeQueryRowSchema.safeParse(row);
      if (!legible.success) {
        logEvent(
          "conocimiento.row_content_skipped",
          { requestId, operation: "listQueries", recordId: row.id, errorName: "ZodError" },
          "error",
        );
        return [];
      }
      return [legible.data];
    });
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "listQueries",
      requestId,
    });
    throw error;
  }
}

/**
 * Reconstrucción de una consulta registrada (FR-020 · US5-AC5): lo que se respondió, con sus
 * citas resueltas contra el estado actual de la colección —una fuente retirada sigue siendo
 * identificable y queda marcada (FR-053 · US5-AC12).
 */
export async function getQuery(
  client: SupabaseClient<Database>,
  queryId: string,
): Promise<{ row: KnowledgeQueryRow; answer: KnowledgeAnswer } | null> {
  const requestId = makeRequestId();
  try {
    const id = queryIdSchema.parse(queryId);
    const { data, error } = await client
      .from("knowledge_queries")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }
    const fila = knowledgeQueryRowSchema.parse(data);

    const documentoIds = [
      ...new Set(
        fila.answer.segmentos
          .filter((segmento) => segmento.kind === "evidencia")
          .map((segmento) => segmento.cita.documentoId),
      ),
    ];
    const estados: Record<string, "available" | "withdrawn"> = {};
    if (documentoIds.length > 0) {
      const { data: documentos, error: errorDocumentos } = await client
        .from("knowledge_documents")
        .select("id, status")
        .in("id", documentoIds);
      if (errorDocumentos) {
        throw errorDocumentos;
      }
      for (const documento of documentos ?? []) {
        estados[documento.id] = documento.status === "withdrawn" ? "withdrawn" : "available";
      }
    }

    return { row: fila, answer: resolveCitations(fila.answer, estados) };
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "getQuery",
      requestId,
    });
    throw error;
  }
}
