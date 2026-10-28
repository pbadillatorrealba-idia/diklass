import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const live = process.env.SUPABASE_LIVE_TESTS === "1" && Boolean(process.env.TEST_SUPABASE_URL);

test.skipIf(!live)(
  "el demo conserva originales, autoría cruzada y dos historias longitudinales",
  async () => {
    const client = createClient(
      process.env.TEST_SUPABASE_URL as string,
      process.env.TEST_SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const [vet] = JSON.parse(readFileSync("tests/fixtures/veterinarians.json", "utf8"));
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
    const feedback = rows.filter((row) => row.record_type === "clinical_feedback");
    expect(feedback).toHaveLength(6);
    expect(feedback.filter((row) => row.status === "corrective")).toHaveLength(1);
    const patients = new Set(consultations.map((row) => row.content.patientId));
    expect(patients.size).toBe(6);
    for (const correctiva of [...epicrisis, ...feedback].filter(
      (row) => row.status === "corrective",
    )) {
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
);
