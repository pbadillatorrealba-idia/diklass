import type { SupabaseClient } from "@supabase/supabase-js";
import { consultKnowledge } from "@/features/conocimiento/consulta-service";
import { listAnamnesisEntries } from "@/features/registro/anamnesis-service";
import { getConsultation } from "@/features/registro/consultation-service";
import { getPatient } from "@/features/registro/ficha-service";
import type { AnamnesisField } from "@/features/registro/schema";
import { createClinicalRecord, updateClinicalContent } from "@/lib/attribution/clinical-mutations";
import type { ClinicalMutationResult } from "@/lib/attribution/types";
import {
  captureClientError,
  type ErrorReporterClient,
  makeRequestId,
} from "@/lib/observability/client-error-reporter";
import { logEvent } from "@/lib/observability/logger";
import type { Database } from "@/lib/supabase/database.types";
import {
  type EntradaAnamnesis,
  type HipotesisSoportada,
  type HypothesisContent,
  hypothesisContentSchema,
} from "./schema";
import {
  evaluarReglas,
  evaluateSuficiencia,
  extraerRespaldo,
  presentarHipotesis,
  type Suficiencia,
} from "./soporte-diferencial";

/**
 * Servicio de soporte diferencial (D5/D6/D7/D9 del diseño del cambio): genera bajo petición
 * del veterinario, con la puerta de suficiencia primero (FR-022) y el respaldo citado del
 * contrato de 003 por candidata (FR-007/FR-023). Toda escritura cruza el contrato de
 * atribución (FR-063 · D9) y la fila persiste su reconstrucción (FR-020).
 */

type ClinicalRecord = Database["public"]["Tables"]["clinical_records"]["Row"];

function camposCubiertos(anamnesis: EntradaAnamnesis[]): Set<AnamnesisField> {
  const cubiertos = new Set<AnamnesisField>();
  for (const entrada of anamnesis) {
    if (entrada.content.text.trim() !== "") {
      cubiertos.add(entrada.content.field);
    }
  }
  return cubiertos;
}

async function listHypothesisRows(
  client: SupabaseClient<Database>,
  consultationId: string,
): Promise<{ recordId: string; content: HypothesisContent }[]> {
  const { data: filas, error } = await client
    .from("clinical_records")
    .select("*")
    .eq("record_type", "hypothesis")
    .eq("content->>consultationId", consultationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    throw error;
  }
  return (filas ?? []).flatMap((fila) => {
    const legible = hypothesisContentSchema.safeParse(fila.content);
    return legible.success ? [{ recordId: fila.id, content: legible.data }] : [];
  });
}

async function cargarContexto(client: SupabaseClient<Database>, consultationId: string) {
  const consulta = await getConsultation(client, consultationId);
  const anamnesis: EntradaAnamnesis[] = (await listAnamnesisEntries(client, consultationId)).map(
    (entrada) => ({ recordId: entrada.record.id, content: entrada.content }),
  );
  const paciente = consulta === null ? null : await getPatient(client, consulta.content.patientId);
  return { consulta, anamnesis, paciente };
}

/**
 * Generación del soporte diferencial bajo petición del veterinario (FR-009 · US8-AC1 ·
 * FR-022 · US8-AC5): candidatas por reglas transparentes, respaldo por `consultKnowledge` y
 * persistencia con su reconstrucción. Una regla ya presentada en la consulta se relee, no se
 * duplica (D7).
 */
export async function generateDifferentialSupport(
  client: SupabaseClient<Database>,
  input: { clinicId: string; consultationId: string },
): Promise<{ suficiencia: Suficiencia; hipotesis: HipotesisSoportada[] }> {
  const requestId = makeRequestId();
  try {
    const { anamnesis, paciente } = await cargarContexto(client, input.consultationId);
    const ficha = paciente?.content ?? null;
    const suficiencia = evaluateSuficiencia({ anamnesis, ficha });
    if (suficiencia.estado === "insuficiente") {
      logEvent("asistencia.support_insufficient", {
        requestId,
        operation: "generateDifferentialSupport",
      });
      return { suficiencia, hipotesis: [] };
    }

    const existentes = await listHypothesisRows(client, input.consultationId);
    const presentadas: HipotesisSoportada[] = [];
    for (const match of evaluarReglas({ anamnesis, ficha })) {
      const previa = existentes.find((fila) => fila.content.reglaId === match.regla.id);
      if (previa !== undefined) {
        presentadas.push(presentarHipotesis(previa.recordId, previa.content));
        continue;
      }
      const { queryId, answer } = await consultKnowledge(client, {
        clinicId: input.clinicId,
        pregunta: match.regla.consultaRecuperacion,
        patientId: paciente?.record.id ?? null,
      });
      const cubiertos = camposCubiertos(anamnesis);
      const content = hypothesisContentSchema.parse({
        consultationId: input.consultationId,
        texto: match.regla.hipotesis,
        decision: "added",
        origen: "sistema",
        reglaId: match.regla.id,
        insumos: {
          anamnesis: match.insumos.anamnesis,
          ficha: match.insumos.ficha,
          faltante: match.regla.discriminatorios.filter((campo) => !cubiertos.has(campo)),
          terminosMatch: match.terminosMatch,
        },
        respaldo: extraerRespaldo(answer, queryId),
      });
      const creada = await createClinicalRecord(client, {
        clinic_id: input.clinicId,
        record_type: "hypothesis",
        content,
        status: "draft",
      });
      presentadas.push(presentarHipotesis(creada.record.id, content));
    }
    logEvent("asistencia.support_generated", {
      requestId,
      operation: "generateDifferentialSupport",
    });
    return { suficiencia, hipotesis: presentadas };
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "generateDifferentialSupport",
      requestId,
    });
    throw error;
  }
}

/**
 * Decisión del veterinario sobre una hipótesis (FR-029 · US8-AC2 · D7): aceptar o descartar;
 * las acciones `hypothesis_accepted`/`hypothesis_discarded` llegan releídas de la traza
 * (FR-063 · D9).
 */
export async function decideHypothesis(
  client: SupabaseClient<Database>,
  input: { hypothesisId: string; decision: "accepted" | "discarded" },
): Promise<ClinicalMutationResult<ClinicalRecord>> {
  const requestId = makeRequestId();
  try {
    const { data, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("id", input.hypothesisId)
      .eq("record_type", "hypothesis")
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error("No se encontró la hipótesis.");
    }
    const previa = hypothesisContentSchema.parse(data.content);
    const content = hypothesisContentSchema.parse({
      ...previa,
      decision: input.decision,
    });
    const actualizada = await updateClinicalContent(client, input.hypothesisId, content);
    logEvent(
      input.decision === "accepted"
        ? "asistencia.hypothesis_accepted"
        : "asistencia.hypothesis_discarded",
      { requestId, operation: "decideHypothesis" },
    );
    return actualizada;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "decideHypothesis",
      requestId,
    });
    throw error;
  }
}

/**
 * Hipótesis propia del veterinario (FR-029 · US8-AC9): se registra junto a las del sistema,
 * distinguible por su origen y con la ausencia de respaldo documental declarada (SC-030).
 */
export async function addVetHypothesis(
  client: SupabaseClient<Database>,
  input: { clinicId: string; consultationId: string; texto: string },
): Promise<ClinicalMutationResult<ClinicalRecord>> {
  const requestId = makeRequestId();
  try {
    const content = hypothesisContentSchema.parse({
      consultationId: input.consultationId,
      texto: input.texto,
      decision: "added",
      origen: "veterinario",
      reglaId: null,
      insumos: { anamnesis: [], ficha: [], faltante: [], terminosMatch: [] },
      respaldo: {
        knowledgeQueryId: null,
        citas: [],
        avisos: ["sin_respaldo_documental"],
        cobertura: null,
      },
    });
    const creada = await createClinicalRecord(client, {
      clinic_id: input.clinicId,
      record_type: "hypothesis",
      content,
      status: "draft",
    });
    logEvent("asistencia.hypothesis_added_by_vet", {
      requestId,
      operation: "addVetHypothesis",
    });
    return creada;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "addVetHypothesis",
      requestId,
    });
    throw error;
  }
}

/**
 * Hipótesis de la consulta reconstruidas desde su registro (FR-020 · US8-AC8): los insumos y
 * el respaldo persistidos se presentan tal cual.
 */
export async function listHypotheses(
  client: SupabaseClient<Database>,
  input: { consultationId: string },
): Promise<HipotesisSoportada[]> {
  const requestId = makeRequestId();
  try {
    const filas = await listHypothesisRows(client, input.consultationId);
    logEvent("asistencia.hypotheses_listed", {
      requestId,
      operation: "listHypotheses",
    });
    return filas.map((fila) => presentarHipotesis(fila.recordId, fila.content));
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "listHypotheses",
      requestId,
    });
    throw error;
  }
}
