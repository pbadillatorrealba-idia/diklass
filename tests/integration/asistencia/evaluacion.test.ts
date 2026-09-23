import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detectMissingInformation } from "@/features/asistencia/deteccion";
import { generateDifferentialSupport, listHypotheses } from "@/features/asistencia/hipotesis-service";
import type { EntradaAnamnesis } from "@/features/asistencia/schema";
import {
  composeHipotesisConsideradas,
  evaluateSuficiencia,
} from "@/features/asistencia/soporte-diferencial";
import { recordAnamnesisEntry } from "@/features/registro/anamnesis-service";
import { openConsultation } from "@/features/registro/consultation-service";
import { createPatientFicha } from "@/features/registro/ficha-service";
import type { AnamnesisField, PatientContent } from "@/features/registro/schema";
import { ANA, isLiveSupabase, type LiveVeterinarian, signedInVeterinarian } from "../live-supabase";

/**
 * Arnés de evaluación sobre casos anotados sintéticos (D12 · HD8 · tasks.md 3.3): ejercita el
 * mecanismo medible de SC-029 y las invariantes SC-019/SC-030/SC-031. NO acepta los criterios
 * (el conjunto del equipo clínico y el panel siguen pendientes).
 */

type CasoAnotado = {
  clave: string;
  descripcion: string;
  anamnesis: { field: AnamnesisField; text: string }[];
  faltantesEsperados: string[];
  hipotesisEsperadas: string[];
};

const fixture = JSON.parse(
  readFileSync(join(import.meta.dir, "../../fixtures/asistencia/casos-anotados.json"), "utf8"),
) as { casos: CasoAnotado[] };

function fichaBase(): Omit<PatientContent, "tutorId"> {
  return {
    name: "Caso Anotado",
    species: "perro",
    breed: "Mestizo",
    birthDate: null,
    ageMonths: null,
    weightKg: null,
    sex: "macho",
    reproductiveStatus: "castrado",
    antecedentes: {
      medicalHistory: [],
      preexistingDiseases: [],
      currentMedications: [],
      knownAllergies: [],
      behavioralHistory: [],
    },
  };
}

function insumosVirtuales(caso: CasoAnotado, consultationId: string): EntradaAnamnesis[] {
  return caso.anamnesis.map((entrada, indice) => ({
    recordId: `virtual-${caso.clave}-${indice}`,
    content: {
      consultationId,
      field: entrada.field,
      text: entrada.text,
      provenance: "reportada" as const,
    },
  }));
}

describe("arnés de evaluación sobre casos anotados (SC-029)", () => {
  test("SC-029: el sistema señala al menos el 70% de los antecedentes faltantes anotados", () => {
    let esperados = 0;
    let señalados = 0;
    for (const caso of fixture.casos) {
      const anamnesis = insumosVirtuales(caso, `virtual-consulta-${caso.clave}`);
      const detectadas = detectMissingInformation({ anamnesis, ficha: null });
      const faltantesNombres = new Set<string>(evaluateSuficiencia({ anamnesis, ficha: null }).faltantes);
      for (const sugerencia of detectadas) {
        for (const campo of sugerencia.camposRelacionados) {
          faltantesNombres.add(campo);
        }
      }
      for (const esperado of caso.faltantesEsperados) {
        esperados += 1;
        if (faltantesNombres.has(esperado)) {
          señalados += 1;
        }
      }
    }
    const cobertura = esperados === 0 ? 1 : señalados / esperados;
    console.log(`SC-029 (casos anotados sintéticos): ${(cobertura * 100).toFixed(0)}% (${señalados}/${esperados})`);
    expect(cobertura).toBeGreaterThanOrEqual(0.7);
  });
});

describe.skipIf(!isLiveSupabase)("arnés de evaluación: hipótesis e invariantes sobre Supabase viva", () => {
  let ana: LiveVeterinarian;

  test("US8-AC1 · SC-019 · SC-030 · SC-031: hipótesis esperadas presentes e invariantes en todas las salidas", async () => {
    ana = await signedInVeterinarian(ANA);
    for (const caso of fixture.casos) {
      const ficha = await createPatientFicha(ana.client, {
        clinicId: ana.clinicId,
        tutor: { newTutor: { name: `Tutor ${caso.clave}`, phone: "+56 9 7777 8888", email: null } },
        ficha: fichaBase(),
      });
      const consulta = await openConsultation(ana.client, {
        clinicId: ana.clinicId,
        patientId: ficha.record.id,
      });
      for (const entrada of caso.anamnesis) {
        await recordAnamnesisEntry(ana.client, {
          clinicId: ana.clinicId,
          consultationId: consulta.record.id,
          field: entrada.field,
          text: entrada.text,
          provenance: "reportada",
        });
      }

      const { suficiencia, hipotesis: generadas } = await generateDifferentialSupport(ana.client, {
        clinicId: ana.clinicId,
        consultationId: consulta.record.id,
      });
      const presentadas = await listHypotheses(ana.client, { consultationId: consulta.record.id });
      const reglasPresentadas = presentadas.map((item) => item.reglaId);

      if (suficiencia.estado === "insuficiente") {
        // FR-022 · US8-AC5: sin información suficiente no se proponen hipótesis (caso límite).
        expect(generadas).toHaveLength(0);
        expect(presentadas).toHaveLength(0);
      } else {
        for (const esperada of caso.hipotesisEsperadas) {
          expect(reglasPresentadas).toContain(esperada);
        }
      }

      for (const item of presentadas) {
        // SC-019: las tres secciones, con sus ausencias explícitas.
        expect(item.analisis.aFavor.items.length > 0 || item.analisis.aFavor.ausencia !== null).toBe(true);
        expect(item.analisis.enContra.items.length > 0 || item.analisis.enContra.ausencia !== null).toBe(true);
        expect(
          item.analisis.faltante.campos.length > 0 || item.analisis.faltante.ausencia !== null,
        ).toBe(true);
        // SC-030: sin respaldo documental → ausencia declarada.
        if (item.respaldo.citas.length === 0) {
          expect(item.respaldo.sinRespaldo).toBe(true);
          expect(item.respaldo.avisos).toContain("sin_respaldo_documental");
        }
        // SC-031: toda salida lleva el descargo y nada se declara diagnóstico definitivo.
        expect(item.descargo).toContain("no constituye un diagnóstico");
        expect(JSON.stringify(item).toLowerCase()).not.toContain("diagnóstico definitivo del sistema");
      }

      // FR-049 · US8-AC6: el resumen de hipótesis consideradas siempre sale con estado derivado.
      const consideradas = composeHipotesisConsideradas(
        presentadas.map((item) => ({
          consultationId: consulta.record.id,
          texto: item.texto,
          decision: item.decision,
          origen: item.origen,
          reglaId: item.reglaId,
          insumos: item.insumos,
          respaldo: item.respaldo,
        })),
      );
      for (const considerada of consideradas) {
        expect(["propuesta", "aceptada", "descartada"]).toContain(considerada.estado);
      }
    }
  });
});
