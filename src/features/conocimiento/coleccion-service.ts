import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { assertNoClientAttributionFields } from "@/lib/attribution/guards";
import type { Attribution, ClinicalMutationResult } from "@/lib/attribution/types";
import {
  captureClientError,
  type ErrorReporterClient,
  makeRequestId,
} from "@/lib/observability/client-error-reporter";
import { logEvent } from "@/lib/observability/logger";
import type { Database } from "@/lib/supabase/database.types";
import { type FuenteContent, fuenteContentSchema } from "./schema";

type KnowledgeDocumentRow = Database["public"]["Tables"]["knowledge_documents"]["Row"];

/**
 * Puerta de escritura y lectura de la colección documental (D1/D3/D7 del diseño del
 * cambio). Incorporar y retirar son las únicas mutaciones del ciclo de vida de una fuente:
 * el servidor sella la atribución (FR-069 · US5-AC13) y la única transición de UPDATE es la
 * retirada (FR-053 · US5-AC12); lo demás lo rechaza el trigger `guard_knowledge_source_lifecycle`.
 */

/** Fuente leída de la colección: fila cruda y contenido ya validado. */
export type FuenteEntry = { record: KnowledgeDocumentRow; content: FuenteContent };

const fuenteIdSchema = z.string().trim().min(1, "Identifica la fuente.");

/**
 * Atribución real de una transición de fuente, releída de la fila (D3 · D7): sin acción
 * enumerada de FR-063 para fuentes (`action: null`) y, en la retirada, el actor y el momento
 * son los del retiro, no los de la incorporación.
 */
function leerAtribucionFuente(record: KnowledgeDocumentRow): Attribution {
  const esRetirada = record.status === "withdrawn" && record.withdrawn_by !== null;
  return {
    actorId: esRetirada ? (record.withdrawn_by ?? record.created_by) : record.created_by,
    occurredAt: esRetirada ? (record.withdrawn_at ?? record.created_at) : record.created_at,
    action: null,
    supersedesEventId: null,
  };
}

/** Valida el contenido de una fila leída y arma su entrada (una sola convención de lectura). */
function construirEntradaFuente(record: KnowledgeDocumentRow): FuenteEntry | null {
  const legible = fuenteContentSchema.safeParse(record.content);
  return legible.success ? { record, content: legible.data } : null;
}

export async function incorporateSource(
  client: SupabaseClient<Database>,
  input: { clinicId: string; fuente: FuenteContent },
): Promise<ClinicalMutationResult<FuenteEntry>> {
  const requestId = makeRequestId();
  try {
    assertNoClientAttributionFields({ ...input });
    const fuente = fuenteContentSchema.parse(input.fuente);
    const { data, error } = await client
      .from("knowledge_documents")
      .insert({ clinic_id: input.clinicId, status: "available", content: fuente } as never)
      .select("*")
      .single();
    if (error || !data) {
      throw error ?? new Error("No se pudo incorporar la fuente clínica.");
    }
    const record = data as KnowledgeDocumentRow;
    const entrada = construirEntradaFuente(record);
    if (entrada === null) {
      throw new Error("La fuente incorporada volvió con un contenido ilegible.");
    }
    logEvent("conocimiento.source_incorporated", { requestId, operation: "incorporateSource" });
    return { record: entrada, attribution: leerAtribucionFuente(record) };
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "incorporateSource",
      requestId,
    });
    throw error;
  }
}

export async function withdrawSource(
  client: SupabaseClient<Database>,
  input: { documentId: string },
): Promise<ClinicalMutationResult<FuenteEntry>> {
  const requestId = makeRequestId();
  try {
    const documentId = fuenteIdSchema.parse(input.documentId);
    assertNoClientAttributionFields({ ...input });
    // Solo se pide la transición; `withdrawn_by`/`withdrawn_at` los sella el servidor (D3).
    const { data, error } = await client
      .from("knowledge_documents")
      .update({ status: "withdrawn" })
      .eq("id", documentId)
      .select("*")
      .single();
    if (error || !data) {
      throw error ?? new Error("No se pudo retirar la fuente clínica.");
    }
    const record = data as KnowledgeDocumentRow;
    const entrada = construirEntradaFuente(record);
    if (entrada === null) {
      throw new Error("La fuente retirada volvió con un contenido ilegible.");
    }
    logEvent("conocimiento.source_withdrawn", { requestId, operation: "withdrawSource" });
    return { record: entrada, attribution: leerAtribucionFuente(record) };
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "withdrawSource",
      requestId,
    });
    throw error;
  }
}

export async function listSources(client: SupabaseClient<Database>): Promise<FuenteEntry[]> {
  const requestId = makeRequestId();
  try {
    const { data, error } = await client
      .from("knowledge_documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      throw error;
    }
    return (data ?? []).flatMap((row) => {
      const entrada = construirEntradaFuente(row as KnowledgeDocumentRow);
      if (entrada === null) {
        logEvent(
          "conocimiento.row_content_skipped",
          { requestId, operation: "listSources", recordId: row.id, errorName: "ZodError" },
          "error",
        );
        return [];
      }
      return [entrada];
    });
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "listSources",
      requestId,
    });
    throw error;
  }
}

export async function getSource(
  client: SupabaseClient<Database>,
  documentId: string,
): Promise<FuenteEntry | null> {
  const requestId = makeRequestId();
  try {
    const id = fuenteIdSchema.parse(documentId);
    const { data, error } = await client
      .from("knowledge_documents")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }
    const entrada = construirEntradaFuente(data as KnowledgeDocumentRow);
    if (entrada === null) {
      logEvent(
        "conocimiento.row_content_skipped",
        { requestId, operation: "getSource", recordId: id, errorName: "ZodError" },
        "error",
      );
    }
    return entrada;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "getSource",
      requestId,
    });
    throw error;
  }
}
