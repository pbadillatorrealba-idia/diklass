import { describe, expect, test } from "bun:test";
import { endListenSession, startListenSession } from "@/features/voz/listen-session-service";
import { fakeClient, fakeConsultation } from "./fakes";

// Tasks.md 3.1 — sesión de escucha (D8 · FR-014 · FR-068 · FR-025).

describe("startListenSession", () => {
  test("FR-014 · US6-AC14: sin consulta abierta no se inicia la captura", async () => {
    const { client, calls } = fakeClient({
      "clinical_records:select": [{ data: fakeConsultation("closed"), error: null }],
    });
    await expect(
      startListenSession(client, { clinicId: "clinica-1", consultationId: "consulta-1" }),
    ).rejects.toThrow(/consulta abierta/i);
    expect(calls.some((call) => call.table === "listening_sessions")).toBe(false);
  });

  test("FR-068 · D8: la activación crea la sesión con estado active (la atribución la sella el servidor)", async () => {
    const fila = {
      id: "sesion-1",
      clinic_id: "clinica-1",
      consultation_id: "consulta-1",
      started_by: "vet-ana",
      started_at: "2026-09-22T10:00:00.000Z",
      ended_at: null,
      state: "active",
    };
    const { client } = fakeClient({
      "clinical_records:select": [{ data: fakeConsultation("open"), error: null }],
      "listening_sessions:insert": [{ data: fila, error: null }],
    });
    const sesión = await startListenSession(client, {
      clinicId: "clinica-1",
      consultationId: "consulta-1",
    });
    expect(sesión.state).toBe("active");
    expect(sesión.startedBy).toBe("vet-ana");
    expect(sesión.consultationId).toBe("consulta-1");
  });
});

describe("endListenSession", () => {
  test("FR-025 · US6-AC5: detener deja la sesión en stopped con término registrado", async () => {
    const fila = {
      id: "sesion-1",
      clinic_id: "clinica-1",
      consultation_id: "consulta-1",
      started_by: "vet-ana",
      started_at: "2026-09-22T10:00:00.000Z",
      ended_at: "2026-09-22T10:05:00.000Z",
      state: "stopped",
    };
    const { client } = fakeClient({ "listening_sessions:update": [{ data: fila, error: null }] });
    const sesión = await endListenSession(client, { sessionId: "sesion-1", state: "stopped" });
    expect(sesión.state).toBe("stopped");
    expect(sesión.endedAt).toBe("2026-09-22T10:05:00.000Z");
  });

  test("US6-AC12: la interrupción registra el estado interrupted", async () => {
    const { client } = fakeClient({
      "listening_sessions:update": [
        {
          data: {
            id: "sesion-1",
            clinic_id: "clinica-1",
            consultation_id: "consulta-1",
            started_by: "vet-ana",
            started_at: "2026-09-22T10:00:00.000Z",
            ended_at: "2026-09-22T10:02:00.000Z",
            state: "interrupted",
          },
          error: null,
        },
      ],
    });
    const sesión = await endListenSession(client, { sessionId: "sesion-1", state: "interrupted" });
    expect(sesión.state).toBe("interrupted");
  });
});
