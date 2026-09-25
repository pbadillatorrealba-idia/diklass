import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  confirmAudioFact,
  createAudioFactDrafts,
  discardAudioFactDraft,
  editAudioFactDraft,
  listAudioFacts,
} from "@/features/voz/audio-fact-service";
import { audioFactContentSchema } from "@/features/voz/schema";
import { ClinicalWriteConflictError } from "@/lib/attribution/clinical-mutations";
import { fakeClient } from "./fakes";

// Tasks.md 3.2 — hechos extraídos del audio (D1 · D5 · FR-016 · FR-017 · FR-021 · SC-027 ·
// SC-048 · US6-AC3 · US6-AC6 · US6-AC9 · US6-AC15).

const propuesta = {
  field: "comportamiento_problematico" as const,
  text: "Destroza el sofá cuando se queda solo",
  excerptStart: 22,
  excerptEnd: 58,
};

const entrada = {
  clinicId: "clinica-1",
  consultationId: "consulta-1",
  transcriptSegmentId: "tramo-1",
  segmentSeq: 1,
  segmentText: "Rocky destroza el sofá cuando se queda solo en casa",
};

const fila = (content: Record<string, unknown>) => ({
  approved_at: null,
  approved_by: null,
  clinic_id: "clinica-1",
  content,
  created_at: "2026-09-22T10:00:00.000Z",
  created_by: "vet-ana",
  id: "hecho-1",
  record_type: "audio_fact",
  status: "draft",
  supersedes_event_id: null,
  updated_at: null,
  updated_by: null,
});

const contenidoBorrador = {
  consultationId: "consulta-1",
  field: "comportamiento_problematico",
  text: "Destroza el sofá cuando se queda solo",
  provenance: "inferida",
  confirmationState: "pending",
  transcriptSegmentId: "tramo-1",
  transcriptExcerpt: "Destroza el sofá cuando se queda solo",
  segmentSeq: 1,
};

describe("createAudioFactDrafts", () => {
  test("FR-016 · FR-017 · SC-005: las propuestas nacen borradores 'pending' con procedencia inferida", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:insert": [{ data: [fila(contenidoBorrador)], error: null }],
    });
    const borradores = await createAudioFactDrafts(client, { ...entrada, drafts: [propuesta] });
    expect(borradores).toHaveLength(1);
    expect(borradores[0]?.content.confirmationState).toBe("pending");
    expect(borradores[0]?.content.provenance).toBe("inferida");
    const alta = calls.find(
      (call) => call.table === "clinical_records" && call.method === "insert",
    );
    expect(alta?.args[0]).toMatchObject([{ record_type: "audio_fact", status: "draft" }]);
  });

  test("SC-027 · US6-AC6: cada borrador conserva el fragmento de transcripción que lo originó", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:insert": [{ data: [fila(contenidoBorrador)], error: null }],
    });
    await createAudioFactDrafts(client, { ...entrada, drafts: [propuesta] });
    const alta = calls.find(
      (call) => call.table === "clinical_records" && call.method === "insert",
    );
    const contenido = z
      .array(z.object({ content: audioFactContentSchema }))
      .parse(alta?.args[0])[0]?.content;
    expect(contenido?.transcriptSegmentId).toBe("tramo-1");
    expect(contenido?.transcriptExcerpt).toBe(
      entrada.segmentText.slice(propuesta.excerptStart, propuesta.excerptEnd).trim(),
    );
  });
});

describe("editAudioFactDraft y discardAudioFactDraft", () => {
  test("US6-AC3: se puede corregir el texto antes de confirmar", async () => {
    const corregido = { ...contenidoBorrador, text: "Destroza el sofá y la mesa" };
    const { client } = fakeClient({
      "clinical_records:select": [{ data: fila(contenidoBorrador), error: null }],
      "clinical_records:update": [{ data: fila(corregido), error: null }],
    });
    const editado = await editAudioFactDraft(client, {
      factId: "hecho-1",
      text: "Destroza el sofá y la mesa",
    });
    expect(editado.content.text).toBe("Destroza el sofá y la mesa");
    expect(editado.content.confirmationState).toBe("pending");
  });

  test("US6-AC3: descartar deja el hecho como discarded, sin tocar la anamnesis", async () => {
    const descartado = { ...contenidoBorrador, confirmationState: "discarded" };
    const { client, calls } = fakeClient({
      "clinical_records:select": [{ data: fila(contenidoBorrador), error: null }],
      "clinical_records:update": [{ data: fila(descartado), error: null }],
    });
    const resultado = await discardAudioFactDraft(client, "hecho-1");
    expect(resultado.content.confirmationState).toBe("discarded");
    expect(
      calls.some((call) => call.table === "clinical_records" && call.method === "insert"),
    ).toBe(false);
  });
});

describe("confirmAudioFact", () => {
  test("D5 · FR-068 · SC-048 · US6-AC15: confirmar marca el hecho y enlaza el aterrizaje derivado por el servidor", async () => {
    const confirmado = {
      ...contenidoBorrador,
      confirmationState: "confirmed",
      anamnesisEntryId: "anamnesis-7",
    };
    const { client } = fakeClient({
      "clinical_records:select": [{ data: fila(contenidoBorrador), error: null }],
      "clinical_records:update": [{ data: fila(confirmado), error: null }],
    });
    const resultado = await confirmAudioFact(client, "hecho-1");
    expect(resultado.fact.content.confirmationState).toBe("confirmed");
    expect(resultado.landedEntryId).toBe("anamnesis-7");
  });

  test("FR-021 · US6-AC9: confirmar no altera la procedencia inferida", async () => {
    const confirmado = {
      ...contenidoBorrador,
      confirmationState: "confirmed",
      anamnesisEntryId: "anamnesis-7",
    };
    const { client } = fakeClient({
      "clinical_records:select": [{ data: fila(contenidoBorrador), error: null }],
      "clinical_records:update": [{ data: fila(confirmado), error: null }],
    });
    const { fact } = await confirmAudioFact(client, "hecho-1");
    expect(fact.content.provenance).toBe("inferida");
  });

  test("SC-027: sin el id del aterrizaje en la respuesta hay una violación de la garantía del servidor", async () => {
    const sinAterrizaje = { ...contenidoBorrador, confirmationState: "confirmed" };
    const { client } = fakeClient({
      "clinical_records:select": [{ data: fila(contenidoBorrador), error: null }],
      "clinical_records:update": [{ data: fila(sinAterrizaje), error: null }],
    });
    await expect(confirmAudioFact(client, "hecho-1")).rejects.toThrow(/anamnesisEntryId/i);
  });
});

// Revisión de la PR #29, hallazgo 4: editar, descartar y confirmar no pisan escrituras ajenas.
describe("control optimista de las escrituras del hecho (revisión de la PR #29)", () => {
  const leido = { ...fila(contenidoBorrador), updated_at: "2026-09-22T10:05:00.000Z" };
  const guardaDeUpdate = (calls: { table: string; method: string; args: unknown[] }[]) =>
    calls.filter(
      (call) =>
        call.table === "clinical_records" &&
        (call.method === "eq" || call.method === "is") &&
        call.args[0] === "updated_at",
    );

  test.each([
    [
      "editar",
      (client: Parameters<typeof editAudioFactDraft>[0]) =>
        editAudioFactDraft(client, { factId: "hecho-1", text: "Destroza el sofá y la mesa" }),
    ],
    [
      "descartar",
      (client: Parameters<typeof editAudioFactDraft>[0]) =>
        discardAudioFactDraft(client, "hecho-1"),
    ],
    [
      "confirmar",
      (client: Parameters<typeof editAudioFactDraft>[0]) => confirmAudioFact(client, "hecho-1"),
    ],
  ])("%s solo escribe si la fila sigue como se leyó", async (_nombre, escribir) => {
    const { client, calls } = fakeClient({
      "clinical_records:select": [{ data: leido, error: null }],
      "clinical_records:update": [{ data: null, error: null }],
    });
    await expect(escribir(client)).rejects.toBeInstanceOf(ClinicalWriteConflictError);
    expect(guardaDeUpdate(calls)).toEqual([
      { table: "clinical_records", method: "eq", args: ["updated_at", "2026-09-22T10:05:00.000Z"] },
    ]);
  });

  test("una fila nunca editada se guarda con updated_at IS NULL", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:select": [{ data: fila(contenidoBorrador), error: null }],
      "clinical_records:update": [
        { data: fila({ ...contenidoBorrador, confirmationState: "discarded" }), error: null },
      ],
    });
    await discardAudioFactDraft(client, "hecho-1");
    expect(guardaDeUpdate(calls)).toEqual([
      { table: "clinical_records", method: "is", args: ["updated_at", null] },
    ]);
  });
});

// Revisión de la PR #29, hallazgo 9: una fila fuera de contrato no tumba la lista.
describe("listAudioFacts (lectura tolerante, revisión de la PR #29)", () => {
  test("omite la fila malformada y devuelve las legibles", async () => {
    const { client } = fakeClient({
      "clinical_records:select": [
        {
          data: [
            fila(contenidoBorrador),
            {
              ...fila({ ...contenidoBorrador, confirmationState: "cualquier-cosa" }),
              id: "hecho-2",
            },
          ],
          error: null,
        },
      ],
    });
    const hechos = await listAudioFacts(client, "consulta-1");
    expect(hechos.map((hecho) => hecho.record.id)).toEqual(["hecho-1"]);
  });
});

// Revisión de la PR #29, hallazgo 10: los borradores de un tramo se insertan en bloque.
describe("createAudioFactDrafts en bloque (revisión de la PR #29)", () => {
  test("un único INSERT para todas las propuestas del tramo, sin relecturas de la traza", async () => {
    const segunda = { ...propuesta, field: "contexto" as const, text: "Cuando se queda solo" };
    const { client, calls } = fakeClient({
      "clinical_records:insert": [
        {
          data: [
            fila(contenidoBorrador),
            { ...fila({ ...contenidoBorrador, field: "contexto" }), id: "hecho-2" },
          ],
          error: null,
        },
      ],
    });
    const hechos = await createAudioFactDrafts(client, {
      ...entrada,
      drafts: [propuesta, segunda],
    });
    expect(hechos.map((hecho) => hecho.record.id)).toEqual(["hecho-1", "hecho-2"]);
    const altas = calls.filter((call) => call.method === "insert");
    expect(altas).toHaveLength(1);
    expect(altas[0]?.args[0]).toHaveLength(2);
    expect(calls.some((call) => call.table === "clinical_audit_events")).toBe(false);
  });

  test("sin propuestas no hay escritura", async () => {
    const { client, calls } = fakeClient();
    expect(await createAudioFactDrafts(client, { ...entrada, drafts: [] })).toEqual([]);
    expect(calls).toEqual([]);
  });
});
