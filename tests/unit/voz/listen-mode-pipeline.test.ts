import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import type { ListenModeController } from "@/features/voz/listen-mode-controller";
import {
  confirmarHecho,
  crearCargadorContexto,
  ejecutarEscucha,
  procesarTramo,
  resolverTramoInterrumpido,
  type TramoDeps,
} from "@/features/voz/listen-mode-pipeline";
import type { AudioWindow, TranscriptResult } from "@/features/voz/transcription-port";
import type { Database } from "@/lib/supabase/database.types";

// Revisión de la PR #29 — orquestación del modo de escucha fuera del hook (hallazgos 1, 2, 3,
// 6 y 10). La sección no está montada en la pantalla de consulta (riesgo R2), así que el
// comportamiento se fija con unitarias sobre un cliente falso que enruta por tabla, operación
// y filtros (las lecturas paralelas no tienen un orden de llamada fiable).

type Peticion = {
  table: string;
  op: "select" | "insert" | "update";
  filtros: Record<string, unknown>;
  payload: unknown;
};
type Respuesta = { data: unknown; error: unknown };

function clienteEnrutado(responder: (peticion: Peticion) => Respuesta) {
  const peticiones: Peticion[] = [];
  let enVuelo = 0;
  let maxEnVuelo = 0;
  const from = (table: string) => {
    const peticion: Peticion = { table, op: "select", filtros: {}, payload: null };
    const builder = {
      select: () => builder,
      insert: (payload: unknown) => {
        peticion.op = "insert";
        peticion.payload = payload;
        return builder;
      },
      update: (payload: unknown) => {
        peticion.op = "update";
        peticion.payload = payload;
        return builder;
      },
      eq: (columna: string, valor: unknown) => {
        peticion.filtros[columna] = valor;
        return builder;
      },
      is: (columna: string, valor: unknown) => {
        peticion.filtros[columna] = valor;
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      single: () => builder,
      maybeSingle: () => builder,
      // biome-ignore lint/suspicious/noThenProperty: las cadenas de PostgREST son awaitables.
      then: (resolver: (valor: Respuesta) => unknown, rechazar?: (razon: unknown) => unknown) => {
        peticiones.push(peticion);
        enVuelo += 1;
        maxEnVuelo = Math.max(maxEnVuelo, enVuelo);
        return new Promise<Respuesta>((resolve) => {
          setTimeout(() => {
            enVuelo -= 1;
            resolve(responder(peticion));
          }, 1);
        }).then(resolver, rechazar);
      },
    };
    return builder;
  };
  const functions = { invoke: async () => ({ data: null, error: null }) };
  return {
    client: { from, functions } as unknown as SupabaseClient<Database>,
    peticiones,
    maxEnVuelo: () => maxEnVuelo,
  };
}

const fila = (id: string, record_type: string, content: Record<string, unknown>) => ({
  approved_at: null,
  approved_by: null,
  clinic_id: "clinica-1",
  content,
  created_at: "2026-09-22T10:00:00.000Z",
  created_by: "vet-ana",
  id,
  record_type,
  status: "draft",
  supersedes_event_id: null,
  updated_at: null,
  updated_by: null,
});

const hecho = (id: string, text: string, confirmationState: string) =>
  fila(id, "audio_fact", {
    consultationId: "consulta-1",
    field: "tratamientos_anteriores",
    text,
    provenance: "inferida",
    confirmationState,
    transcriptSegmentId: "tramo-0",
    transcriptExcerpt: text,
    segmentSeq: 0,
  });

const consulta = fila("consulta-1", "consultation", {
  patientId: "paciente-1",
  status: "open",
});

const paciente = fila("paciente-1", "patient", {
  name: "Rocky",
  species: "canino",
  breed: "Mestizo",
  birthDate: null,
  ageMonths: null,
  weightKg: null,
  sex: "macho",
  reproductiveStatus: "castrado",
  antecedentes: {
    medicalHistory: [],
    preexistingDiseases: [],
    currentMedications: [{ text: "Fluoxetina 20 mg diaria", negative: false }],
    knownAllergies: [],
    behavioralHistory: [],
  },
  tutorId: "tutor-1",
});

const tramoGuardado = (seq: number, processing_state = "pending") => ({
  id: `tramo-${seq}`,
  listening_session_id: "sesion-1",
  clinic_id: "clinica-1",
  seq,
  started_at: "2026-09-22T10:00:00.000Z",
  ended_at: "2026-09-22T10:00:30.000Z",
  text: "texto",
  quality: "ok",
  processing_state,
  created_at: "2026-09-22T10:00:30.000Z",
});

/** Responde lo mínimo coherente de un Supabase real para el flujo del modo de escucha. */
function responderPorDefecto(
  extra: (peticion: Peticion) => Respuesta | undefined = () => undefined,
) {
  return (peticion: Peticion): Respuesta => {
    const propia = extra(peticion);
    if (propia) {
      return propia;
    }
    if (peticion.table === "clinical_audit_events") {
      return { data: null, error: null };
    }
    if (peticion.table === "transcript_segments" && peticion.op === "insert") {
      const payload = peticion.payload as { seq: number };
      return { data: tramoGuardado(payload.seq), error: null };
    }
    if (peticion.table === "transcript_segments" && peticion.op === "update") {
      const payload = peticion.payload as { processing_state: string };
      return { data: tramoGuardado(0, payload.processing_state), error: null };
    }
    if (peticion.table === "clinical_records" && peticion.op === "insert") {
      const payload = peticion.payload as Array<{ content: Record<string, unknown> }>;
      return {
        data: payload.map((alta, indice) => fila(`hecho-${indice}`, "audio_fact", alta.content)),
        error: null,
      };
    }
    if (peticion.table === "clinical_records" && peticion.filtros.record_type === "consultation") {
      return { data: consulta, error: null };
    }
    if (peticion.table === "clinical_records" && peticion.filtros.record_type === "patient") {
      return { data: paciente, error: null };
    }
    if (peticion.table === "listening_sessions" && peticion.op === "update") {
      const payload = peticion.payload as { state: string };
      return {
        data: {
          id: "sesion-1",
          clinic_id: "clinica-1",
          consultation_id: "consulta-1",
          started_by: "vet-ana",
          started_at: "2026-09-22T10:00:00.000Z",
          ended_at: "2026-09-22T10:05:00.000Z",
          state: payload.state,
        },
        error: null,
      };
    }
    return { data: [], error: null };
  };
}

const ventana = (seq: number): AudioWindow => ({
  listenSessionId: "sesion-1",
  seq,
  startedAt: "2026-09-22T10:00:00.000Z",
  durationMs: 30_000,
});

const conHechos: TranscriptResult = {
  text: "Le dimos fluoxetina durante un mes, pero no hubo mejoría",
  quality: "ok",
};

const deps = (client: SupabaseClient<Database>): TramoDeps => ({
  client,
  clinicId: "clinica-1",
  consultationId: "consulta-1",
  cargarContexto: async () => ({ previos: [], anamnesis: [], ficha: [] }),
});

const resoluciones = (peticiones: Peticion[]) =>
  peticiones
    .filter((peticion) => peticion.table === "transcript_segments" && peticion.op === "update")
    .map((peticion) => (peticion.payload as { processing_state: string }).processing_state);

const altasDeHechos = (peticiones: Peticion[]) =>
  peticiones.filter(
    (peticion) => peticion.table === "clinical_records" && peticion.op === "insert",
  );

describe("procesarTramo", () => {
  test("SC-028 · FR-016: guarda el tramo, crea sus borradores en un único alta y lo marca procesado", async () => {
    const { client, peticiones } = clienteEnrutado(responderPorDefecto());
    await procesarTramo(deps(client), ventana(0), conHechos);
    expect(altasDeHechos(peticiones)).toHaveLength(1);
    expect(resoluciones(peticiones)).toEqual(["processed"]);
  });

  test("hallazgo 1 · FR-055: si crear los borradores falla, el tramo queda descartado (nunca pending) y el error se propaga", async () => {
    const { client, peticiones } = clienteEnrutado(
      responderPorDefecto((peticion) =>
        peticion.table === "clinical_records" && peticion.op === "insert"
          ? { data: null, error: new Error("RLS") }
          : undefined,
      ),
    );
    await expect(procesarTramo(deps(client), ventana(0), conHechos)).rejects.toThrow("RLS");
    expect(resoluciones(peticiones)).toEqual(["discarded"]);
  });
});

describe("resolverTramoInterrumpido", () => {
  test("hallazgo 2 · US6-AC12: con 'processed' el tramo interrumpido SÍ se procesa (extrae sus borradores)", async () => {
    const { client, peticiones } = clienteEnrutado(responderPorDefecto());
    await resolverTramoInterrumpido(deps(client), ventana(1), conHechos, "processed");
    expect(altasDeHechos(peticiones)).toHaveLength(1);
    expect(resoluciones(peticiones)).toEqual(["processed"]);
  });

  test("US6-AC12: con 'discarded' el tramo se guarda y se descarta sin derivar hechos", async () => {
    const { client, peticiones } = clienteEnrutado(responderPorDefecto());
    await resolverTramoInterrumpido(deps(client), ventana(1), conHechos, "discarded");
    expect(altasDeHechos(peticiones)).toHaveLength(0);
    expect(resoluciones(peticiones)).toEqual(["discarded"]);
  });
});

describe("ejecutarEscucha", () => {
  const controlador = (run: () => Promise<unknown>, interrumpido = false) =>
    ({ run, wasInterrupted: interrumpido }) as unknown as ListenModeController;

  const cierres = (peticiones: Peticion[]) =>
    peticiones
      .filter((peticion) => peticion.table === "listening_sessions" && peticion.op === "update")
      .map((peticion) => (peticion.payload as { state: string }).state);

  test("D8: el fin natural cierra la sesión como 'stopped'", async () => {
    const { client, peticiones } = clienteEnrutado(responderPorDefecto());
    const errores: unknown[] = [];
    await ejecutarEscucha({
      client,
      controller: controlador(async () => "detenido"),
      sessionId: "sesion-1",
      onError: (error) => errores.push(error),
    });
    expect(cierres(peticiones)).toEqual(["stopped"]);
    expect(errores).toEqual([]);
  });

  test("hallazgo 1 · US6-AC12: si el ciclo falla, la sesión se cierra 'interrupted' y el error se reporta", async () => {
    const { client, peticiones } = clienteEnrutado(responderPorDefecto());
    const errores: unknown[] = [];
    const fallo = new Error("RLS");
    await ejecutarEscucha({
      client,
      controller: controlador(() => Promise.reject(fallo), true),
      sessionId: "sesion-1",
      onError: (error) => errores.push(error),
    });
    expect(cierres(peticiones)).toEqual(["interrupted"]);
    expect(errores).toEqual([fallo]);
  });
});

describe("crearCargadorContexto", () => {
  const responder = responderPorDefecto((peticion) => {
    if (peticion.table !== "clinical_records" || peticion.op !== "select") {
      return undefined;
    }
    if (peticion.filtros.record_type === "audio_fact") {
      return {
        data: [
          hecho("previo-pendiente", "Ya no toma fluoxetina", "pending"),
          hecho("previo-descartado", "Toma fluoxetina", "discarded"),
          hecho("previo-confirmado", "Le dimos trazodona", "confirmed"),
        ],
        error: null,
      };
    }
    if (peticion.filtros.record_type === "anamnesis") {
      return {
        data: [
          fila("anamnesis-1", "anamnesis", {
            consultationId: "consulta-1",
            field: "alimentacion",
            text: "Nunca come croquetas",
            provenance: "reportada",
          }),
        ],
        error: null,
      };
    }
    return undefined;
  });

  test("hallazgo 6: solo los borradores pendientes cuentan como previos, con su polaridad real", async () => {
    const { client } = clienteEnrutado(responder);
    const contexto = await crearCargadorContexto(client, "consulta-1")();
    expect(contexto.previos).toEqual([
      {
        id: "previo-pendiente",
        field: "tratamientos_anteriores",
        text: "Ya no toma fluoxetina",
        negation: true,
      },
    ]);
    expect(contexto.anamnesis.map((entrada) => entrada.negation)).toEqual([true]);
    expect(contexto.ficha.map((item) => item.text)).toEqual(["Fluoxetina 20 mg diaria"]);
  });

  test("hallazgo 10 · SC-028: las lecturas independientes van en paralelo y consulta y ficha se leen una vez por sesión", async () => {
    const { client, peticiones, maxEnVuelo } = clienteEnrutado(responder);
    const cargar = crearCargadorContexto(client, "consulta-1");
    await cargar();
    await cargar();
    expect(maxEnVuelo()).toBeGreaterThanOrEqual(3);
    const lecturasDe = (tipo: string) =>
      peticiones.filter((peticion) => peticion.filtros.record_type === tipo).length;
    expect(lecturasDe("consultation")).toBe(1);
    expect(lecturasDe("patient")).toBe(1);
    expect(lecturasDe("audio_fact")).toBe(2);
    expect(lecturasDe("anamnesis")).toBe(2);
  });
});

describe("confirmarHecho", () => {
  test("hallazgo 3: confirmar invalida también el registro (la anamnesis aterrizada aparece en el workspace)", async () => {
    const confirmado = {
      ...hecho("hecho-1", "Le dimos fluoxetina", "confirmed"),
      content: {
        ...hecho("hecho-1", "Le dimos fluoxetina", "confirmed").content,
        anamnesisEntryId: "anamnesis-9",
      },
    };
    const { client } = clienteEnrutado(
      responderPorDefecto((peticion) => {
        if (peticion.table !== "clinical_records") {
          return undefined;
        }
        return peticion.op === "update"
          ? { data: confirmado, error: null }
          : { data: hecho("hecho-1", "Le dimos fluoxetina", "pending"), error: null };
      }),
    );
    const queryClient = new QueryClient();
    const workspace = ["registro", "consultation-workspace", "consulta-1"];
    const hechos = ["voz", "audio-facts", "consulta-1"];
    queryClient.setQueryData(workspace, { entradas: [] });
    queryClient.setQueryData(hechos, []);
    await confirmarHecho({ client, queryClient }, "hecho-1");
    expect(queryClient.getQueryState(workspace)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(hechos)?.isInvalidated).toBe(true);
  });
});
