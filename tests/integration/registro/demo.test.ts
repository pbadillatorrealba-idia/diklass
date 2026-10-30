import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadDemo } from "../../../scripts/demo/cargar-demo";
import { readTestActors } from "../../support/test-scope";

const live = process.env.SUPABASE_LIVE_TESTS === "1" && Boolean(process.env.TEST_SUPABASE_URL);

test.skipIf(!live)(
  "el demo conserva originales, autoría cruzada y dos historias longitudinales",
  async () => {
    if (!process.env.TEST_SCOPE_FILE)
      throw new Error("La carga demo viva requiere un scope aislado.");
    const actors = readTestActors();
    await loadDemo({
      url: process.env.TEST_SUPABASE_URL as string,
      anonKey: process.env.TEST_SUPABASE_ANON_KEY as string,
      fixtures: actors,
      allowRemote: false,
      manifestPath: join(
        dirname(process.env.TEST_SCOPE_FILE),
        `${process.env.TEST_SCOPE_FILE.split("/").at(-1)}.demo.json`,
      ),
      revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    });
    const client = createClient(
      process.env.TEST_SUPABASE_URL as string,
      process.env.TEST_SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const [vet] = actors;
    if (!vet) throw new Error("Falta el actor del scope.");
    const { error: authError } = await client.auth.signInWithPassword(vet);
    if (authError) throw authError;
    const { error: sessionError } = await client.rpc("start_access_session");
    if (sessionError) throw sessionError;
    const { data, error } = await client.from("clinical_records").select("*");
    if (error) throw error;
    const rows = data ?? [];
    const consultations = rows.filter((row) => row.record_type === "consultation");
    expect(consultations).toHaveLength(8);
    expect(consultations.filter((row) => row.content.status === "closed")).toHaveLength(3);
    const epicrisis = rows.filter((row) => row.record_type === "epicrisis");
    expect(epicrisis.filter((row) => row.status === "approved")).toHaveLength(3);
    expect(epicrisis.filter((row) => row.status === "draft")).toHaveLength(1);
    expect(epicrisis.filter((row) => row.status === "corrective")).toHaveLength(1);
    const corrected = epicrisis.find((row) => row.status === "corrective");
    const original = epicrisis.find(
      (row) =>
        row.status === "approved" &&
        row.content.consultationId === corrected?.content.consultationId,
    );
    expect(original?.content.observaciones).toContain("tres horas");
    expect(corrected?.content.observaciones).toContain("cuatro horas");
    expect(rows.filter((row) => row.record_type === "clinical_feedback")).toHaveLength(0);
    const patients = new Set(consultations.map((row) => row.content.patientId));
    expect(patients.size).toBe(6);
    for (const correctiva of epicrisis.filter((row) => row.status === "corrective")) {
      const { data: event, error: eventError } = await client
        .from("clinical_audit_events")
        .select("entity_id")
        .eq("id", correctiva.supersedes_event_id)
        .single();
      if (eventError) throw eventError;
      expect(rows.some((row) => row.id === event.entity_id && row.id !== correctiva.id)).toBe(true);
    }
    expect(
      rows.some(
        (row) =>
          row.record_type === "anamnesis" &&
          consultations.some(
            (c) => c.id === row.content.consultationId && c.created_by !== row.created_by,
          ),
      ),
    ).toBe(true);
  },
  // Carga el grafo completo mediante servicios reales; CI supera el límite predeterminado de 5 s.
  60_000,
);
