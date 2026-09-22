import { describe, expect, test } from "bun:test";
import {
  saveTranscriptSegment,
  settleTranscriptSegment,
} from "@/features/voz/transcript-service";
import { fakeClient } from "./fakes";

// Tasks.md 3.1 — tramos de transcripción (D10 · FR-031 · US6-AC12).

const tramo = {
  listenSessionId: "sesion-1",
  clinicId: "clinica-1",
  seq: 3,
  startedAt: "2026-09-22T10:01:30.000Z",
  endedAt: "2026-09-22T10:02:00.000Z",
  text: "…todos los días ladra…",
  quality: "insufficient" as const,
};

describe("saveTranscriptSegment", () => {
  test("FR-031 · D10: conserva la marca de confiabilidad y nace pending", async () => {
    const { client } = fakeClient({
      "transcript_segments:insert": [
        {
          data: {
            id: "tramo-3",
            listening_session_id: "sesion-1",
            clinic_id: "clinica-1",
            seq: 3,
            started_at: tramo.startedAt,
            ended_at: tramo.endedAt,
            text: tramo.text,
            quality: "insufficient",
            processing_state: "pending",
            created_at: "2026-09-22T10:02:00.000Z",
          },
          error: null,
        },
      ],
    });
    const guardado = await saveTranscriptSegment(client, tramo);
    expect(guardado.quality).toBe("insufficient");
    expect(guardado.processingState).toBe("pending");
  });
});

describe("settleTranscriptSegment", () => {
  test("US6-AC12 · D10: un tramo queda processed o discarded, nunca a medio procesar", async () => {
    const { client } = fakeClient({
      "transcript_segments:update": [
        {
          data: {
            id: "tramo-3",
            listening_session_id: "sesion-1",
            clinic_id: "clinica-1",
            seq: 3,
            started_at: tramo.startedAt,
            ended_at: tramo.endedAt,
            text: tramo.text,
            quality: "insufficient",
            processing_state: "discarded",
            created_at: "2026-09-22T10:02:00.000Z",
          },
          error: null,
        },
      ],
    });
    const resuelto = await settleTranscriptSegment(client, {
      segmentId: "tramo-3",
      processingState: "discarded",
    });
    expect(resuelto.processingState).toBe("discarded");
  });

  test("rechaza estados fuera del vocabulario cerrado (US6-AC12)", async () => {
    const { client } = fakeClient();
    await expect(
      settleTranscriptSegment(client, {
        segmentId: "tramo-3",
        processingState: "a_medio_procesar" as "processed",
      }),
    ).rejects.toThrow();
  });
});
