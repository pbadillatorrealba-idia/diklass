import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  type AudioWindow,
  SimulatedTranscriptionAdapter,
} from "@/features/voz/transcription-port";
import { SyntheticCaptureSource } from "@/features/voz/capture-source";

// Tasks.md 2.2 — TranscriptionPort determinista por defecto (D2) y captura sintética (D3).

const RUTA_GUIÓN = new URL("../../fixtures/voz/conversacion-referencia.json", import.meta.url);

const tramoGuiónSchema = z.object({
  seq: z.number(),
  calidad: z.enum(["ok", "insufficient"]),
  transcripcion: z.string(),
});
const GUIÓN = z.object({ guion: z.array(tramoGuiónSchema) }).parse(
  JSON.parse(await Bun.file(RUTA_GUIÓN).text()),
);

const ventana = (seq: number): AudioWindow => ({
  listenSessionId: "55555555-0000-0000-0000-000000000005",
  seq,
  startedAt: "2026-09-22T10:00:00.000Z",
  durationMs: 30_000,
});

describe("SimulatedTranscriptionAdapter", () => {
  test("es determinista: la misma ventana produce siempre la misma transcripción (D2)", async () => {
    const adapter = new SimulatedTranscriptionAdapter(GUIÓN);
    const primera = await adapter.transcribe(ventana(0));
    const segunda = await adapter.transcribe(ventana(0));
    expect(segunda).toEqual(primera);
    expect(primera.quality).toBe("ok");
    expect(primera.text).toContain("destroza el sofá");
  });

  test("conserva la marca de calidad del tramo del guion (FR-031 · US6-AC7)", async () => {
    const adapter = new SimulatedTranscriptionAdapter(GUIÓN);
    const tramo = await adapter.transcribe(ventana(2));
    expect(tramo.quality).toBe("insufficient");
  });

  test("una ventana fuera del guion falla de forma explícita (Constitución IV)", async () => {
    const adapter = new SimulatedTranscriptionAdapter(GUIÓN);
    expect(adapter.transcribe(ventana(99))).rejects.toThrow(/guion/i);
  });
});

describe("SyntheticCaptureSource", () => {
  test("produce ventanas de ~30 s con seq correlativo hasta agotar el guion (D3 · FR-014)", async () => {
    const guion = GUIÓN;
    const source = new SyntheticCaptureSource({ guion });
    const ventanas: AudioWindow[] = [];
    for await (const window of source.windows()) {
      ventanas.push(window);
    }
    expect(ventanas).toHaveLength(guion.guion.length);
    expect(ventanas.map((window) => window.seq)).toEqual(guion.guion.map((tramo) => tramo.seq));
    for (const window of ventanas) {
      expect(window.durationMs).toBe(30_000);
    }
  });

  test("expone la indisponibilidad de la captura (FR-054 · US6-AC10)", async () => {
    const guion = GUIÓN;
    expect(await new SyntheticCaptureSource({ guion }).available()).toBe(true);
    const noDisponible = new SyntheticCaptureSource({ guion, unavailable: true });
    expect(await noDisponible.available()).toBe(false);
  });
});
