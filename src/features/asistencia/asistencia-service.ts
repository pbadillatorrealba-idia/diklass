import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { CandidatoFragmento } from "@/features/conocimiento/answer";
import { fragmentoRecuperadoSchema } from "@/features/conocimiento/schema";
import { listAnamnesisEntries } from "@/features/registro/anamnesis-service";
import { getConsultation } from "@/features/registro/consultation-service";
import { getPatient } from "@/features/registro/ficha-service";
import {
  createClinicalRecord,
  updateClinicalContent,
} from "@/lib/attribution/clinical-mutations";
import type { ClinicalMutationResult } from "@/lib/attribution/types";
import {
  captureClientError,
  type ErrorReporterClient,
  makeRequestId,
} from "@/lib/observability/client-error-reporter";
import { logEvent } from "@/lib/observability/logger";
import type { Database } from "@/lib/supabase/database.types";
import {
  composeFundamento,
  type DecisionRegistrada,
  detectMissingInformation,
  mergeSuggestionStates,
} from "./deteccion";
import { SUGERENCIAS } from "./reglas";
import {
  type DecisionSugerencia,
  type EntradaAnamnesis,
  type Fundamento,
  type MissingInformationContent,
  missingInformationContentSchema,
} from "./schema";

/**
 * Servicio de información faltante (D3/D4/D9 del diseño del cambio): la detección es pura y
 * la resolución del fundamento usa la recuperación de 003; la única escritura es la decisión
 * del veterinario como fila `missing_information` que cruza el contrato de atribución (FR-063).
 */

type ClinicalRecord = Database["public"]["Tables"]["clinical_records"]["Row"];

const CANDIDATOS_POR_CONSULTA = 10;

export type SugerenciaPresentada = {
  key: string;
  pregunta: string;
  estado: "pendiente" | DecisionSugerencia;
  fundamento: Fundamento;
  camposRelacionados: string[];
  decisionRecordId: string | null;
};

async function recuperarCandidatos(
  client: SupabaseClient<Database>,
  query: string,
): Promise<CandidatoFragmento[]> {
  const { data, error } = await client.rpc("search_knowledge_fragments", {
    p_query: query,
    p_limit: CANDIDATOS_POR_CONSULTA,
  });
  if (error) {
    throw error;
  }
  return z.array(fragmentoRecuperadoSchema).parse(data ?? []).map((fila) => ({
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
}

/**
 * Sugerencias de la consulta con su fundamento resuelto (FR-008 · FR-033 · US7-AC1/AC3/AC5):
 * pendientes detectadas sobre ficha y anamnesis, más las decisiones ya registradas (D3 · HD3).
 */
export async function listSuggestions(
  client: SupabaseClient<Database>,
  input: { consultationId: string },
): Promise<SugerenciaPresentada[]> {
  const requestId = makeRequestId();
  try {
    const consulta = await getConsultation(client, input.consultationId);
    const anamnesis: EntradaAnamnesis[] = (await listAnamnesisEntries(client, input.consultationId)).map(
      (entrada) => ({ recordId: entrada.record.id, content: entrada.content }),
    );
    const paciente =
      consulta === null ? null : await getPatient(client, consulta.content.patientId);
    const { data: filas, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("record_type", "missing_information")
      .eq("content->>consultationId", input.consultationId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) {
      throw error;
    }
    const decisiones: DecisionRegistrada[] = (filas ?? []).flatMap((fila) => {
      const legible = missingInformationContentSchema.safeParse(fila.content);
      if (!legible.success) {
        logEvent(
          "asistencia.row_content_skipped",
          { requestId, operation: "listSuggestions", recordId: fila.id, errorName: "ZodError" },
          "error",
        );
        return [];
      }
      return [{ recordId: fila.id, content: legible.data }];
    });

    const detectadas = detectMissingInformation({
      anamnesis,
      ficha: paciente?.content ?? null,
    });
    const estados = mergeSuggestionStates(detectadas, decisiones);

    const fundamentoPorQuery = new Map<string, Fundamento>();
    const presentadas: SugerenciaPresentada[] = [];
    for (const estado of estados) {
      let fundamento = estado.fundamento;
      if (fundamento === null) {
        const regla = SUGERENCIAS.find((candidata) => candidata.key === estado.key);
        const query = regla?.fundamento?.query ?? null;
        if (query === null) {
          fundamento = { kind: "criterio_general" };
        } else {
          const cache = fundamentoPorQuery.get(query);
          if (cache !== undefined) {
            fundamento = cache;
          } else {
            fundamento = composeFundamento(query, await recuperarCandidatos(client, query));
            fundamentoPorQuery.set(query, fundamento);
          }
        }
      }
      presentadas.push({
        key: estado.key,
        pregunta: estado.pregunta,
        estado: estado.estado,
        fundamento,
        camposRelacionados: estado.camposRelacionados,
        decisionRecordId: estado.decisionRecordId,
      });
    }
    logEvent("asistencia.suggestions_listed", {
      requestId,
      operation: "listSuggestions",
      sugerencias: presentadas.length,
    });
    return presentadas;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "listSuggestions",
      requestId,
    });
    throw error;
  }
}

/**
 * Decisión del veterinario sobre una sugerencia (FR-008 · US7-AC2/AC6 · D3): crea la fila
 * `missing_information` o revisa su estado; la acción enumerada `missing_information_decided`
 * llega releída de la traza (FR-063 · D9).
 */
export async function decideMissingInformation(
  client: SupabaseClient<Database>,
  input: {
    clinicId: string;
    consultationId: string;
    suggestionKey: string;
    estado: DecisionSugerencia;
    fundamento: Fundamento;
  },
): Promise<ClinicalMutationResult<ClinicalRecord>> {
  const requestId = makeRequestId();
  try {
    const regla = SUGERENCIAS.find((candidata) => candidata.key === input.suggestionKey);
    if (regla === undefined) {
      throw new Error("La sugerencia no pertenece al registro de la consulta.");
    }
    const { data: filas, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("record_type", "missing_information")
      .eq("content->>consultationId", input.consultationId)
      .eq("content->>suggestionKey", input.suggestionKey);
    if (error) {
      throw error;
    }
    const existente = (filas ?? [])[0] ?? null;
    if (existente !== null) {
      const previo = missingInformationContentSchema.parse(existente.content);
      const content = missingInformationContentSchema.parse({
        ...previo,
        estado: input.estado,
      });
      const actualizada = await updateClinicalContent(client, existente.id, content);
      logEvent("asistencia.suggestion_decided", {
        requestId,
        operation: "decideMissingInformation",
        revision: true,
      });
      return actualizada;
    }

    const content: MissingInformationContent = missingInformationContentSchema.parse({
      consultationId: input.consultationId,
      suggestionKey: regla.key,
      pregunta: regla.pregunta,
      estado: input.estado,
      fundamento: input.fundamento,
      camposRelacionados: regla.camposRelacionados,
    });
    const creada = await createClinicalRecord(client, {
      clinic_id: input.clinicId,
      record_type: "missing_information",
      content,
      status: "draft",
    });
    logEvent("asistencia.suggestion_decided", {
      requestId,
      operation: "decideMissingInformation",
      revision: false,
    });
    return creada;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "decideMissingInformation",
      requestId,
    });
    throw error;
  }
}
