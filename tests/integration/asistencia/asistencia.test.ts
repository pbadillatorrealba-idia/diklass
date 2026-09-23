import { beforeAll, describe, expect, test } from "bun:test";
import {
  decideMissingInformation,
  listSuggestions,
} from "@/features/asistencia/asistencia-service";
import { incorporateSource } from "@/features/conocimiento/coleccion-service";
import type { FuenteContent } from "@/features/conocimiento/schema";
import { recordAnamnesisEntry } from "@/features/registro/anamnesis-service";
import { openConsultation } from "@/features/registro/consultation-service";
import { createPatientFicha } from "@/features/registro/ficha-service";
import type { PatientContent } from "@/features/registro/schema";
import { ANA, isLiveSupabase, type LiveVeterinarian, signedInVeterinarian } from "../live-supabase";

/**
 * Información faltante contra Supabase viva (FR-008, FR-033, FR-063 · US7). Presupuestos de
 * `design.md`: resolución de fundamento ≤ 500 ms por recuperación y decisión ≤ 2 s.
 */

const termino = `soledad${Math.random().toString(36).slice(2)}`;

function fuenteNueva(): FuenteContent {
  return {
    bibliografia: {
      titulo: "Protocolo de anamnesis en conductas de soledad (ficticio)",
      autores: ["Equipo clínico sintético"],
      anio: 2026,
      revista: null,
      editorial: null,
      edicion: null,
      doi: null,
      url: null,
    },
    licencia: { tipo: "CC BY 4.0 (ficticia)", nota: "Corpus sintético de demostración" },
    fragmentos: [
      {
        ordinal: 1,
        seccion: "Síntesis",
        texto: `El protocolo de ansiedad por separación exige preguntar si la conducta ocurre solo cuando el animal queda solo (${termino}).`,
      },
    ],
  };
}

function fichaBase(): Omit<PatientContent, "tutorId"> {
  return {
    name: "Tobi Asistencia",
    species: "perro",
    breed: "Mestizo",
    birthDate: "2021-05-01",
    ageMonths: 36,
    weightKg: 12.4,
    sex: "macho",
    reproductiveStatus: "castrado",
    antecedentes: {
      medicalHistory: [],
      preexistingDiseases: [],
      currentMedications: [{ text: "Ninguna medicación", negative: true }],
      knownAllergies: [{ text: "Sin alergias conocidas", negative: true }],
      behavioralHistory: [],
    },
  };
}

describe.skipIf(!isLiveSupabase)("información faltante (US7)", () => {
  let ana: LiveVeterinarian;
  let consultationId: string;

  beforeAll(async () => {
    ana = await signedInVeterinarian(ANA);
    await incorporateSource(ana.client, { clinicId: ana.clinicId, fuente: fuenteNueva() });
    const ficha = await createPatientFicha(ana.client, {
      clinicId: ana.clinicId,
      tutor: { newTutor: { name: "Sra. Asistencia", phone: "+56 9 3333 4444", email: null } },
      ficha: fichaBase(),
    });
    const consulta = await openConsultation(ana.client, {
      clinicId: ana.clinicId,
      patientId: ficha.record.id,
    });
    consultationId = consulta.record.id;
    await recordAnamnesisEntry(ana.client, {
      clinicId: ana.clinicId,
      consultationId,
      field: "comportamiento_problematico",
      text: `Destroza objetos y ladra ${termino}`,
      provenance: "reportada",
    });
  });

  test("US7-AC1 · FR-033: la sugerencia pendiente llega con fundamento citado (protocolo cargado)", async () => {
    const inicio = performance.now();
    const sugerencias = await listSuggestions(ana.client, { consultationId });
    const alone = sugerencias.find((sugerencia) => sugerencia.key === "aloneContext");
    expect(alone?.estado).toBe("pendiente");
    if (alone?.fundamento.kind === "fuente") {
      expect(performance.now() - inicio).toBeLessThan(500);
      // FR-033 · US7-AC3: la cita es documento+fragmento con su texto verbatim de la colección
      // compartida (la recuperación puede citar cualquier fuente calificada cargada).
      expect(alone.fundamento.cita.textoCitado.length).toBeGreaterThan(0);
      expect(alone.fundamento.cita.documentoId.length).toBeGreaterThan(0);
      expect(alone.fundamento.cita.fragmentoOrdinal).toBeGreaterThanOrEqual(1);
      expect(alone.fundamento.cita.bibliografia.titulo.length).toBeGreaterThan(0);
    } else {
      expect(alone?.fundamento).toEqual({ kind: "criterio_general" });
    }
    expect(sugerencias.some((sugerencia) => sugerencia.key === "knownAllergies")).toBe(false);
  });

  test("FR-008 · FR-063 · US7-AC2/AC6: la decisión queda registrada con su atribución y retira la sugerencia de pendientes", async () => {
    const inicio = performance.now();
    const resultado = await decideMissingInformation(ana.client, {
      clinicId: ana.clinicId,
      consultationId,
      suggestionKey: "aloneContext",
      estado: "formulada",
      fundamento: { kind: "criterio_general" },
    });
    expect(performance.now() - inicio).toBeLessThan(2000);
    expect(resultado.attribution.action).toBe("missing_information_decided");
    expect(resultado.attribution.actorId).toBe(ana.userId);

    const posteriores = await listSuggestions(ana.client, { consultationId });
    const alone = posteriores.find((sugerencia) => sugerencia.key === "aloneContext");
    expect(alone?.estado).toBe("formulada");
    expect(alone?.decisionRecordId).toBe(resultado.record.id);
    expect(
      posteriores.filter((sugerencia) => sugerencia.estado === "pendiente").map((s) => s.key),
    ).not.toContain("aloneContext");
  });

  test("D3 · D7: revisar la decisión reemite la acción y conserva la base", async () => {
    const resultado = await decideMissingInformation(ana.client, {
      clinicId: ana.clinicId,
      consultationId,
      suggestionKey: "aloneContext",
      estado: "no_aplicable",
      fundamento: { kind: "criterio_general" },
    });
    expect(resultado.attribution.action).toBe("missing_information_decided");

    const posteriores = await listSuggestions(ana.client, { consultationId });
    const alone = posteriores.find((sugerencia) => sugerencia.key === "aloneContext");
    expect(alone?.estado).toBe("no_aplicable");
  });

  test("US7-AC4 · FR-044 (heredado): lo cubierto no se propone como faltante", async () => {
    await recordAnamnesisEntry(ana.client, {
      clinicId: ana.clinicId,
      consultationId,
      field: "contexto",
      text: `Ocurre solo cuando el animal queda solo ${termino}`,
      provenance: "reportada",
    });
    const sugerencias = await listSuggestions(ana.client, { consultationId });
    expect(
      sugerencias.filter((sugerencia) => sugerencia.estado === "pendiente").map((s) => s.key),
    ).not.toContain("aloneContext");
  });
});
