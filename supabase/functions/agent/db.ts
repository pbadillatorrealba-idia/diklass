import type { SupabaseClient } from "@supabase/supabase-js";
import type { Db } from "./agent.ts";

const MAX_HOY = 50;
const MAX_FRAGMENTOS = 5;
const MAX_TEXTO_FRAGMENTO = 1200;

/** Lecturas del agente con el cliente del solicitante (su JWT): RLS limita cada una a su clínica. */
export const makeDb = (client: SupabaseClient): Db => ({
  patientFicha: async (patientId) => {
    const { data, error } = await client
      .from("clinical_records")
      .select("content")
      .eq("record_type", "patient")
      .eq("id", patientId)
      .limit(1);
    if (error) throw error;
    const c = data?.[0]?.content as Record<string, unknown> | undefined;
    if (!c) return null;
    let tutor: string | null = null;
    if (typeof c.tutorId === "string") {
      const { data: t, error: e2 } = await client
        .from("clinical_records")
        .select("content")
        .eq("record_type", "tutor")
        .eq("id", c.tutorId)
        .limit(1);
      if (e2) throw e2;
      tutor = String((t?.[0]?.content as { name?: string } | undefined)?.name ?? "") || null;
    }
    // Solo lo que el agente necesita (Principio V): sin RUT, teléfono ni correo del tutor.
    return {
      nombre: c.name,
      especie: c.species,
      raza: c.breed,
      edadMeses: c.ageMonths,
      pesoKg: c.weightKg,
      sexo: c.sex,
      estadoReproductivo: c.reproductiveStatus,
      antecedentes: c.antecedentes,
      tutor,
    };
  },
  knowledge: async (question) => {
    const { data, error } = await client.rpc("search_knowledge_fragments", {
      p_query: question,
      p_limit: MAX_FRAGMENTOS,
    });
    if (error) throw error;
    return ((data as Record<string, unknown>[] | null) ?? []).map((f) => ({
      documentoId: String(f.documento_id),
      ordinal: Number(f.fragmento_ordinal),
      titulo: String((f.bibliografia as { titulo?: string } | null)?.titulo ?? ""),
      seccion: (f.seccion as string | null) ?? null,
      texto: String(f.texto ?? "").slice(0, MAX_TEXTO_FRAGMENTO),
    }));
  },
  consultationSummary: async (consultationId) => {
    const { data, error } = await client
      .from("clinical_records")
      .select("content")
      .eq("record_type", "consultation_summary")
      .eq("content->>consultationId", consultationId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    return String((data?.[0]?.content as { text?: string } | undefined)?.text ?? "") || null;
  },
  consultationsSince: async (sinceIso) => {
    const { data, error } = await client
      .from("clinical_records")
      .select("id, created_at, content")
      .eq("record_type", "consultation")
      .gte("created_at", sinceIso)
      // Más recientes primero: si hay más de MAX_HOY, lo que se descarta es lo más antiguo del día.
      .order("created_at", { ascending: false })
      .limit(MAX_HOY + 1);
    if (error) throw error;
    const filas = data ?? [];
    const truncado = filas.length > MAX_HOY;
    const visibles = filas.slice(0, MAX_HOY);
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    const idDe = (r: { content: unknown }) =>
      String((r.content as { patientId?: string }).patientId ?? "");
    const ids = [...new Set(visibles.map(idDe).filter((id) => UUID.test(id)))];
    const nombres = new Map<string, string>();
    if (ids.length > 0) {
      const { data: pacientes, error: e2 } = await client
        .from("clinical_records")
        .select("id, content")
        .eq("record_type", "patient")
        .in("id", ids);
      if (e2) throw e2;
      for (const p of pacientes ?? []) {
        nombres.set(p.id, String((p.content as { name?: string }).name ?? ""));
      }
    }
    return {
      truncado,
      consultas: visibles.map((r) => ({
        paciente: nombres.get(idDe(r)) || "(paciente no disponible)",
        estado: (r.content as { status?: string }).status === "open" ? "abierta" : "cerrada",
      })),
    };
  },
  rpc: (fn, args) => client.rpc(fn, args),
  openConsultations: async (patientId) => {
    const { data, error } = await client
      .from("clinical_records")
      .select("id")
      .eq("record_type", "consultation")
      .eq("content->>patientId", patientId)
      .eq("content->>status", "open")
      .limit(20);
    if (error) throw error;
    return (data ?? []).map((r) => r.id);
  },
});
