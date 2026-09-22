import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  audioFactContentSchema,
  listeningSessionSchema,
  transcriptSegmentSchema,
} from "@/features/voz/schema";

// Tasks.md 2.1 — modelos de contenido de la captura de voz (D1, D8, D10 del diseño).

describe("audioFactContentSchema", () => {
  const borrador = {
    consultationId: "11111111-0000-0000-0000-000000000001",
    field: "comportamiento_problematico",
    text: "Destroza el sofá cuando se queda solo",
    provenance: "inferida",
    confirmationState: "pending",
    transcriptSegmentId: "99999999-0000-0000-0000-000000000001",
    transcriptExcerpt: "…destroza el sofá cuando se queda solo…",
    segmentSeq: 2,
  };

  test("acepta un borrador completo con traza al fragmento (SC-027)", () => {
    const content = audioFactContentSchema.parse(borrador);
    expect(content.provenance).toBe("inferida");
    expect(content.confirmationState).toBe("pending");
    expect(content.transcriptExcerpt).toContain("destroza el sofá");
  });

  test("la procedencia del flujo de voz es fijamente 'inferida' (FR-021 · US6-AC9)", () => {
    expect(() => audioFactContentSchema.parse({ ...borrador, provenance: "reportada" })).toThrow(
      z.ZodError,
    );
  });

  test("confirmationState solo admite pending | confirmed | discarded (D1)", () => {
    expect(() =>
      audioFactContentSchema.parse({ ...borrador, confirmationState: "landing" }),
    ).toThrow(z.ZodError);
  });

  test("exige el fragmento de transcripción que originó el hecho (FR-021 · US6-AC6)", () => {
    expect(() =>
      audioFactContentSchema.parse({ ...borrador, transcriptExcerpt: "" }),
    ).toThrow(z.ZodError);
    expect(() => audioFactContentSchema.parse({ ...borrador, segmentSeq: -1 })).toThrow(z.ZodError);
  });

  test("anamnesisEntryId y contradiction son opcionales con forma cerrada (D5 · FR-032)", () => {
    const confirmado = audioFactContentSchema.parse({
      ...borrador,
      confirmationState: "confirmed",
      anamnesisEntryId: "33333333-0000-0000-0000-000000000003",
      contradiction: {
        refKind: "ficha",
        refId: "44444444-0000-0000-0000-000000000004",
        note: "Contradice un antecedente ya registrado en la ficha",
      },
    });
    expect(confirmado.anamnesisEntryId).toBe("33333333-0000-0000-0000-000000000003");
    expect(confirmado.contradiction?.refKind).toBe("ficha");
    expect(() =>
      audioFactContentSchema.parse({
        ...borrador,
        contradiction: { refKind: "inventado", refId: "x", note: "y" },
      }),
    ).toThrow(z.ZodError);
  });
});

describe("transcriptSegmentSchema", () => {
  const tramo = {
    listenSessionId: "55555555-0000-0000-0000-000000000005",
    clinicId: "66666666-0000-0000-0000-000000000006",
    seq: 0,
    startedAt: "2026-09-22T10:00:00.000Z",
    endedAt: "2026-09-22T10:00:30.000Z",
    text: "…todos los días ladra…",
    quality: "ok",
    processingState: "pending",
  };

  test("marca de confiabilidad por tramo: ok | insufficient (FR-031 · D10)", () => {
    expect(transcriptSegmentSchema.parse(tramo).quality).toBe("ok");
    expect(transcriptSegmentSchema.parse({ ...tramo, quality: "insufficient" }).quality).toBe(
      "insufficient",
    );
    expect(() => transcriptSegmentSchema.parse({ ...tramo, quality: "inaudible" })).toThrow(
      z.ZodError,
    );
  });

  test("processingState cerrado: pending | processed | discarded (FR-055 · US6-AC12)", () => {
    expect(() =>
      transcriptSegmentSchema.parse({ ...tramo, processingState: "a_medio_procesar" }),
    ).toThrow(z.ZodError);
  });
});

describe("listeningSessionSchema", () => {
  const sesion = {
    clinicId: "66666666-0000-0000-0000-000000000006",
    consultationId: "11111111-0000-0000-0000-000000000001",
    state: "active",
  };

  test("estado de la sesión de escucha: active | stopped | interrupted (D8)", () => {
    expect(listeningSessionSchema.parse(sesion).state).toBe("active");
    for (const state of ["stopped", "interrupted"] as const) {
      expect(listeningSessionSchema.parse({ ...sesion, state }).state).toBe(state);
    }
    expect(() => listeningSessionSchema.parse({ ...sesion, state: "pausada" })).toThrow(z.ZodError);
  });
});
