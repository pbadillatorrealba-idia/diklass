import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  approveClinicalRecord,
  createClinicalRecord,
  createCorrectiveRecord,
  updateClinicalContent,
} from "@/lib/attribution/clinical-mutations";
import { AttributionInputError } from "@/lib/attribution/guards";
import type { Database } from "@/lib/supabase/database.types";

type FakeCall = { table: string; method: string; args: unknown[] };
type FakeResult = { data: unknown; error: unknown };

function makeClient(config: { record?: FakeResult; event?: FakeResult; rpc?: FakeResult }) {
  const calls: FakeCall[] = [];
  const results: Record<string, FakeResult> = {
    clinical_records: config.record ?? { data: null, error: null },
    clinical_audit_events: config.event ?? { data: null, error: null },
  };
  const from = (table: string) => {
    const result = results[table] ?? { data: null, error: null };
    const chain =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ table, method, args });
        return query;
      };
    const query = {
      insert: chain("insert"),
      update: chain("update"),
      select: chain("select"),
      eq: chain("eq"),
      order: chain("order"),
      limit: chain("limit"),
      single: async () => result,
      maybeSingle: async () => result,
    };
    return query;
  };
  const rpc = async (name: string, args?: unknown) => {
    calls.push({ table: "rpc", method: name, args: [args] });
    return config.rpc ?? { data: null, error: null };
  };
  return { client: { from, rpc } as unknown as SupabaseClient<Database>, calls };
}

function registro(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    approved_at: null,
    approved_by: null,
    clinic_id: "clinica-1",
    content: { consultationId: "c-1" },
    created_at: "2026-09-22T09:00:00.000Z",
    created_by: "vet-ana",
    id: "record-1",
    record_type: "anamnesis",
    status: "draft",
    supersedes_event_id: null,
    updated_at: null,
    updated_by: null,
    ...overrides,
  };
}

const contenidoAnamnesis = {
  consultationId: "c-1",
  field: "frecuencia",
  text: "A diario",
  provenance: "reportada",
};

describe("createClinicalRecord (contrato conservado · FR-063)", () => {
  test("crea el registro y devuelve la atribución real leída de la traza", async () => {
    const { client, calls } = makeClient({
      record: { data: registro(), error: null },
      event: {
        data: {
          action: "anamnesis_recorded",
          actor_id: "vet-ana",
          occurred_at: "2026-09-22T10:00:00.000Z",
          supersedes_event_id: null,
        },
        error: null,
      },
    });

    const result = await createClinicalRecord(client, {
      clinic_id: "clinica-1",
      record_type: "anamnesis",
      content: contenidoAnamnesis,
      status: "draft",
    });

    expect(result.record.id).toBe("record-1");
    expect(result.attribution).toEqual({
      actorId: "vet-ana",
      occurredAt: "2026-09-22T10:00:00.000Z",
      action: "anamnesis_recorded",
      supersedesEventId: null,
    });
    expect(calls.some((call) => call.method === "insert")).toBe(true);
  });

  test("rechaza campos de atribución enviados por el cliente", async () => {
    const { client, calls } = makeClient({});
    const payload = { clinic_id: "clinica-1", record_type: "epicrisis", created_by: "otro" };

    try {
      await createClinicalRecord(client, payload);
      throw new Error("se esperaba el rechazo de created_by");
    } catch (error) {
      expect(error).toBeInstanceOf(AttributionInputError);
      expect((error as AttributionInputError).fields).toEqual(["created_by"]);
    }
    expect(calls).toEqual([]);
  });
});

describe("updateClinicalContent (D9 · FR-063)", () => {
  test("actualiza solo el contenido y relee la atribución de la traza", async () => {
    const { client, calls } = makeClient({
      record: {
        data: registro({ updated_at: "2026-09-22T11:00:00.000Z", updated_by: "vet-beto" }),
        error: null,
      },
      event: {
        data: {
          action: "anamnesis_corrected",
          actor_id: "vet-beto",
          occurred_at: "2026-09-22T11:00:00.000Z",
          supersedes_event_id: null,
        },
        error: null,
      },
    });

    const result = await updateClinicalContent(client, "record-1", contenidoAnamnesis);

    const updates = calls.filter((call) => call.method === "update");
    expect(updates).toHaveLength(1);
    expect(updates[0]?.args[0]).toEqual({ content: contenidoAnamnesis });
    expect(
      calls.some(
        (call) =>
          call.table === "clinical_audit_events" &&
          call.method === "eq" &&
          call.args[0] === "entity_id" &&
          call.args[1] === "record-1",
      ),
    ).toBe(true);
    expect(result.record.id).toBe("record-1");
    expect(result.attribution).toEqual({
      actorId: "vet-beto",
      occurredAt: "2026-09-22T11:00:00.000Z",
      action: "anamnesis_corrected",
      supersedesEventId: null,
    });
  });

  test("sin evento en la traza, la atribución de reserva viene del registro", async () => {
    const { client } = makeClient({
      record: { data: registro(), error: null },
      event: { data: null, error: null },
    });

    const result = await updateClinicalContent(client, "record-1", contenidoAnamnesis);

    expect(result.attribution).toEqual({
      actorId: "vet-ana",
      occurredAt: "2026-09-22T09:00:00.000Z",
      action: null,
      supersedesEventId: null,
    });
  });

  test("un UPDATE sin evento propio atribuye a quien editó, no a quien creó (revisión de la PR #27)", async () => {
    const { client } = makeClient({
      record: {
        data: registro({
          record_type: "epicrisis",
          updated_at: "2026-09-22T11:00:00.000Z",
          updated_by: "vet-beto",
        }),
        error: null,
      },
      event: { data: null, error: null },
    });

    const result = await updateClinicalContent(client, "record-1", contenidoAnamnesis);

    expect(result.attribution).toEqual({
      actorId: "vet-beto",
      occurredAt: "2026-09-22T11:00:00.000Z",
      action: null,
      supersedesEventId: null,
    });
  });

  test("un evento anterior al UPDATE no se atribuye a la edición (revisión de la PR #27)", async () => {
    const { client } = makeClient({
      record: {
        data: registro({
          record_type: "epicrisis",
          updated_at: "2026-09-22T11:00:00.000Z",
          updated_by: "vet-beto",
        }),
        error: null,
      },
      event: {
        data: {
          action: "epicrisis_drafted",
          actor_id: "vet-ana",
          occurred_at: "2026-09-22T09:00:00.000Z",
          supersedes_event_id: null,
        },
        error: null,
      },
    });

    const result = await updateClinicalContent(client, "record-1", contenidoAnamnesis);

    expect(result.attribution).toEqual({
      actorId: "vet-beto",
      occurredAt: "2026-09-22T11:00:00.000Z",
      action: null,
      supersedesEventId: null,
    });
  });

  test("rechaza contenido con campos de atribución sin tocar el servidor", async () => {
    const { client, calls } = makeClient({});
    const content = { ...contenidoAnamnesis, updated_by: "vet-beto" };

    try {
      await updateClinicalContent(client, "record-1", content);
      throw new Error("se esperaba el rechazo de updated_by");
    } catch (error) {
      expect(error).toBeInstanceOf(AttributionInputError);
      expect((error as AttributionInputError).fields).toEqual(["updated_by"]);
    }
    expect(calls).toEqual([]);
  });

  test("propaga el error real del servidor", async () => {
    const failure = new Error("registro inalcanzable");
    const { client } = makeClient({
      record: { data: null, error: failure },
    });

    try {
      await updateClinicalContent(client, "record-1", contenidoAnamnesis);
      throw new Error("se esperaba un fallo del servidor");
    } catch (error) {
      expect(error).toBe(failure);
    }
  });
});

describe("approveClinicalRecord (D4 · FR-012, US3-AC2)", () => {
  test("aprueba por la RPC del servidor y devuelve record y atribución", async () => {
    const { client, calls } = makeClient({
      rpc: {
        data: {
          record: { id: "e-1", status: "approved" },
          attribution: {
            actorId: "vet-ana",
            occurredAt: "2026-09-22T12:00:00.000Z",
            action: "epicrisis_approved",
          },
        },
        error: null,
      },
    });

    const result = await approveClinicalRecord(client, "e-1");

    expect(result.record).toEqual({ id: "e-1", status: "approved" });
    expect(result.attribution).toEqual({
      actorId: "vet-ana",
      occurredAt: "2026-09-22T12:00:00.000Z",
      action: "epicrisis_approved",
    });
    expect(calls).toEqual([
      { table: "rpc", method: "approve_clinical_record", args: [{ p_record_id: "e-1" }] },
    ]);
  });

  test("propaga el error real del servidor", async () => {
    const failure = new Error("APPROVED_RECORD_IMMUTABLE");
    const { client } = makeClient({ rpc: { data: null, error: failure } });

    try {
      await approveClinicalRecord(client, "e-1");
      throw new Error("se esperaba un fallo del servidor");
    } catch (error) {
      expect(error).toBe(failure);
    }
  });

  test("lanza ante una respuesta ilegible en lugar de inventar atribución", async () => {
    const { client } = makeClient({ rpc: { data: { record: { id: 42 } }, error: null } });

    try {
      await approveClinicalRecord(client, "e-1");
      throw new Error("se esperaba un error de lectura");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/aprobación del registro clínico/);
    }
  });
});

describe("createCorrectiveRecord (D8 · FR-024, US3-AC4)", () => {
  test("inserta la corrección con status corrective y el evento superseded", async () => {
    const contenido = { ...contenidoAnamnesis, text: "Corregido" };
    const { client, calls } = makeClient({
      record: {
        data: registro({
          id: "correctiva-1",
          record_type: "epicrisis",
          status: "corrective",
          supersedes_event_id: "evento-1",
        }),
        error: null,
      },
      event: {
        data: {
          action: "corrective_record_created",
          actor_id: "vet-beto",
          occurred_at: "2026-09-22T13:00:00.000Z",
          supersedes_event_id: "evento-1",
        },
        error: null,
      },
    });

    const result = await createCorrectiveRecord(client, {
      clinicId: "clinica-1",
      recordType: "epicrisis",
      content: contenido,
      supersedesEventId: "evento-1",
    });

    const inserts = calls.filter((call) => call.method === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.args[0]).toEqual({
      clinic_id: "clinica-1",
      record_type: "epicrisis",
      content: contenido,
      status: "corrective",
      supersedes_event_id: "evento-1",
    });
    expect(result.record.id).toBe("correctiva-1");
    expect(result.attribution.action).toBe("corrective_record_created");
    expect(result.attribution.supersedesEventId).toBe("evento-1");
  });

  test("rechaza campos de atribución en la petición sin tocar el servidor", async () => {
    const { client, calls } = makeClient({});
    const payload = {
      clinicId: "clinica-1",
      recordType: "epicrisis",
      content: contenidoAnamnesis,
      supersedesEventId: "evento-1",
      approved_by: "vet-ana",
    };

    try {
      await createCorrectiveRecord(client, payload);
      throw new Error("se esperaba el rechazo de approved_by");
    } catch (error) {
      expect(error).toBeInstanceOf(AttributionInputError);
      expect((error as AttributionInputError).fields).toEqual(["approved_by"]);
    }
    expect(calls).toEqual([]);
  });
});
