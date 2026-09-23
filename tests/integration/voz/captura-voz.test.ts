import { beforeAll, describe, expect, test } from "bun:test";
import { listAnamnesisEntries } from "@/features/registro/anamnesis-service";
import { openConsultation } from "@/features/registro/consultation-service";
import { createPatientFicha, getPatient } from "@/features/registro/ficha-service";
import {
  confirmAudioFact,
  createAudioFactDrafts,
  listAudioFacts,
} from "@/features/voz/audio-fact-service";
import { type ContextoContradicciones, detectContradictions } from "@/features/voz/contradictions";
import { extractClinicalFacts } from "@/features/voz/extraction";
import { guionDemo } from "@/features/voz/guion-demo";
import { startListenSession } from "@/features/voz/listen-session-service";
import { saveTranscriptSegment, settleTranscriptSegment } from "@/features/voz/transcript-service";
import {
  ANA,
  BRUNO,
  isLiveSupabase,
  type LiveVeterinarian,
  signedInVeterinarian,
} from "../live-supabase";

/**
 * Captura de voz hacia anamnesis contra Supabase viva (FR-014 · FR-016 · FR-017 · FR-021 ·
 * FR-031 · FR-032 · FR-055 · FR-068 · SC-005 · SC-027 · SC-048 · US6). Corre en el job
 * `database` de CI (`SUPABASE_LIVE_TESTS=1`); localmente queda en skip.
 *
 * ANA abre la consulta, extrae y deja borradores; BRUNO —distinto del que abrió la consulta—
 * confirma (US6-AC15). Presupuestos de `design.md`: `confirmAudioFact` y el listado de
 * borradores ≤ 2 s con red local.
 */

describe.skipIf(!isLiveSupabase)("captura de voz hacia anamnesis (integración viva)", () => {
  let ana: LiveVeterinarian;
  let bruno: LiveVeterinarian;
  let consultationId: string;
  let patientId: string;
  let sessionId: string;

  beforeAll(async () => {
    ana = await signedInVeterinarian(ANA);
    bruno = await signedInVeterinarian(BRUNO);
    const ficha = await createPatientFicha(ana.client, {
      clinicId: ana.clinicId,
      ficha: {
        name: "Rocky Voz",
        species: "perro",
        breed: "Mestizo",
        birthDate: "2021-05-01",
        ageMonths: 24,
        weightKg: 12.4,
        sex: "macho",
        reproductiveStatus: "entero",
        antecedentes: {
          medicalHistory: [],
          preexistingDiseases: [],
          currentMedications: [{ text: "Fluoxetina 20 mg diaria", negative: false }],
          knownAllergies: [],
          behavioralHistory: [],
        },
      },
      tutor: { newTutor: { name: "Sra. Integración Voz", phone: "+56 9 5550 0099", email: null } },
    });
    const consulta = await openConsultation(ana.client, {
      clinicId: ana.clinicId,
      patientId: ficha.record.id,
    });
    consultationId = consulta.record.id;
    patientId = ficha.record.id;
    const sesión = await startListenSession(ana.client, {
      clinicId: ana.clinicId,
      consultationId,
    });
    sessionId = sesión.id;
  });

  test("FR-014 · FR-068: la activación queda atribuida a quien activó, y sin consulta abierta no inicia", async () => {
    const sesión = await startListenSession(ana.client, {
      clinicId: ana.clinicId,
      consultationId,
    });
    expect(sesión.state).toBe("active");
    expect(sesión.startedBy).toBe(ana.userId);
    await expect(
      startListenSession(ana.client, {
        clinicId: ana.clinicId,
        consultationId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow(/consulta abierta/i);
  });

  test("FR-016 · FR-017 · FR-055 · US6-AC11: los borradores de los primeros tramos se conservan con su fragmento", async () => {
    const tramo0 = guionDemo.guion[0];
    const tramo1 = guionDemo.guion[1];
    if (!tramo0 || !tramo1) throw new Error("Faltan tramos del guion de demostración");
    const guardado0 = await saveTranscriptSegment(ana.client, {
      listenSessionId: sessionId,
      clinicId: ana.clinicId,
      seq: 0,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      text: tramo0.transcripcion,
      quality: tramo0.calidad,
    });
    const propuestas0 = extractClinicalFacts({
      text: tramo0.transcripcion,
      quality: tramo0.calidad,
    });
    await createAudioFactDrafts(ana.client, {
      clinicId: ana.clinicId,
      consultationId,
      transcriptSegmentId: guardado0.id,
      segmentSeq: 0,
      segmentText: tramo0.transcripcion,
      drafts: propuestas0.map((propuesta) => ({ ...propuesta, contradiction: null })),
    });
    const guardado1 = await saveTranscriptSegment(ana.client, {
      listenSessionId: sessionId,
      clinicId: ana.clinicId,
      seq: 1,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      text: tramo1.transcripcion,
      quality: tramo1.calidad,
    });
    await createAudioFactDrafts(ana.client, {
      clinicId: ana.clinicId,
      consultationId,
      transcriptSegmentId: guardado1.id,
      segmentSeq: 1,
      segmentText: tramo1.transcripcion,
      drafts: extractClinicalFacts({ text: tramo1.transcripcion, quality: tramo1.calidad }).map(
        (propuesta) => ({ ...propuesta, contradiction: null }),
      ),
    });
    const inicio = performance.now();
    const hechos = await listAudioFacts(ana.client, consultationId);
    expect(performance.now() - inicio).toBeLessThanOrEqual(2_000);
    expect(hechos.length).toBeGreaterThanOrEqual(2);
    for (const hecho of hechos) {
      expect(hecho.content.confirmationState).toBe("pending");
      expect(hecho.content.provenance).toBe("inferida");
      expect(hecho.content.transcriptExcerpt.length).toBeGreaterThan(0);
      // SC-027 · US6-AC6: la traza apunta al tramo REAL que originó cada hecho.
      const tramoOrigen = hecho.content.segmentSeq === 0 ? guardado0.id : guardado1.id;
      expect(hecho.content.transcriptSegmentId).toBe(tramoOrigen);
    }
  });

  test("FR-031 · US6-AC7 · US6-AC12: tramo no confiable sin hechos, e interrupción con estado definido", async () => {
    const tramoRuidoso = guionDemo.guion[2];
    if (!tramoRuidoso) throw new Error("Falta el tramo ruidoso del guion");
    const guardado = await saveTranscriptSegment(ana.client, {
      listenSessionId: sessionId,
      clinicId: ana.clinicId,
      seq: 2,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      text: tramoRuidoso.transcripcion,
      quality: tramoRuidoso.calidad,
    });
    expect(
      extractClinicalFacts({ text: tramoRuidoso.transcripcion, quality: tramoRuidoso.calidad }),
    ).toEqual([]);
    const resuelto = await settleTranscriptSegment(ana.client, {
      segmentId: guardado.id,
      processingState: "discarded",
    });
    expect(resuelto.processingState).toBe("discarded");
  });

  test("FR-032 · US6-AC8: lo extraído que contradice la ficha se señala, sin sobrescribir", async () => {
    const ficha = await getPatient(ana.client, patientId);
    const antecedentes = ficha?.content.antecedentes ?? null;
    const contexto: ContextoContradicciones = {
      previos: [],
      anamnesis: [],
      ficha: (antecedentes?.currentMedications ?? []).map((item, index) => ({
        refId: `currentMedications-${index}`,
        group: "currentMedications",
        text: item.text,
        negation: item.negative,
      })),
    };
    const señales = detectContradictions(
      {
        id: "propuesta-fluoxetina",
        field: "tratamientos_anteriores",
        text: "Ahora ya no toma fluoxetina, la suspendimos",
        negation: true,
      },
      contexto,
    );
    expect(señales.some((señal) => señal.refKind === "ficha")).toBe(true);
    const fichaDespués = await getPatient(ana.client, patientId);
    expect(fichaDespués?.content.antecedentes?.currentMedications).toEqual(
      antecedentes?.currentMedications,
    );
  });

  test("FR-068 · US6-AC15 · SC-048 · SC-027 · FR-021 · US6-AC9: BRUNO confirma y el hecho aterriza en la anamnesis con inferida", async () => {
    const hechos = await listAudioFacts(ana.client, consultationId);
    const pendiente = hechos.find((hecho) => hecho.content.confirmationState === "pending");
    if (!pendiente) throw new Error("Falta un borrador pendiente para confirmar");
    const inicio = performance.now();
    const { fact, landedEntryId } = await confirmAudioFact(bruno.client, pendiente.record.id);
    expect(performance.now() - inicio).toBeLessThanOrEqual(2_000);
    expect(fact.content.confirmationState).toBe("confirmed");
    expect(fact.content.anamnesisEntryId).toBe(landedEntryId);
    expect(fact.content.provenance).toBe("inferida");
    const anamnesis = await listAnamnesisEntries(bruno.client, consultationId);
    const aterrizada = anamnesis.find((entrada) => entrada.record.id === landedEntryId);
    expect(aterrizada).toBeDefined();
    expect(aterrizada?.content.provenance).toBe("inferida");
    expect(aterrizada?.content.text).toBe(fact.content.text);
  });

  test("FR-017 · SC-005: lo no confirmado no forma parte de la anamnesis y no se confirma dos veces", async () => {
    const hechos = await listAudioFacts(ana.client, consultationId);
    const confirmados = hechos.filter((hecho) => hecho.content.confirmationState === "confirmed");
    const pendientes = hechos.filter((hecho) => hecho.content.confirmationState === "pending");
    const anamnesis = await listAnamnesisEntries(ana.client, consultationId);
    expect(anamnesis.length).toBe(confirmados.length);
    for (const pendiente of pendientes) {
      expect(pendiente.content.anamnesisEntryId ?? null).toBeNull();
      expect(
        anamnesis.some((entrada) => entrada.record.id === pendiente.content.anamnesisEntryId),
      ).toBe(false);
    }
    const yaConfirmado = confirmados[0];
    if (yaConfirmado) {
      await expect(confirmAudioFact(bruno.client, yaConfirmado.record.id)).rejects.toThrow();
    }
  });
});
