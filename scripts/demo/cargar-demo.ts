import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { recordAnamnesisEntry } from "@/features/registro/anamnesis-service";
import { openConsultation } from "@/features/registro/consultation-service";
import { recordDiagnosis } from "@/features/registro/diagnosis-service";
import {
  approveEpicrisis,
  correctEpicrisis,
  generateEpicrisisDraft,
} from "@/features/registro/epicrisis-service";
import { createPatientFicha } from "@/features/registro/ficha-service";
import type { EpicrisisContent } from "@/features/registro/schema";
import { createTutor } from "@/features/registro/tutor-service";
import {
  correctFeedbackEntry,
  createFeedbackEntry,
} from "@/features/retroalimentacion/feedback-service";
import type { Database } from "@/lib/supabase/database.types";
import { isLocalSupabaseUrl } from "../lib/provisioning";
import { verifyContracts } from "./contratos-demo";
import { CONSULTAS_DEMO, PACIENTES_DEMO, TUTORES_DEMO } from "./datos-demo";
import { DATASET_META, traceFor } from "./metadata-demo";
import { validateDemo } from "./validar-demo";

export const veterinarianFixturesSchema = z
  .array(
    z.object({
      email: z.string().email(),
      password: z.string().min(1),
      displayName: z.string().min(1),
    }),
  )
  .length(3);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export const demoHash = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");

const entitySchema = z.object({ id: z.string().uuid(), hash: z.string().length(64) });
const manifestSchema = z.object({
  datasetId: z.string(),
  version: z.string(),
  revision: z.string(),
  fixtureHash: z.string(),
  target: z.string(),
  clinicId: z.string().regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i),
  status: z.enum(["partial", "complete"]),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  entities: z.record(z.string(), entitySchema),
  events: z.record(z.string(), entitySchema),
});
export type DemoManifest = z.infer<typeof manifestSchema>;
type Row = Database["public"]["Tables"]["clinical_records"]["Row"];
type Vet = { client: SupabaseClient<Database>; clinicId: string; id: string };

export function assertManifestMatches(
  manifest: DemoManifest,
  expected: {
    target: string;
    clinicId: string;
    fixtureHash: string;
    keys: string[];
  },
) {
  manifestSchema.parse(manifest);
  if (manifest.status !== "complete")
    throw new Error(
      "Carga parcial; reconstruye solo una base local desechable de forma explícita.",
    );
  if (
    manifest.datasetId !== DATASET_META.datasetId ||
    manifest.version !== DATASET_META.version ||
    manifest.target !== expected.target ||
    manifest.clinicId !== expected.clinicId ||
    manifest.fixtureHash !== expected.fixtureHash
  ) {
    throw new Error(
      "Dataset de versión, contenido o destino diferente; no se modifica lo existente.",
    );
  }
  if (demoHash(Object.keys(manifest.entities).sort()) !== demoHash(expected.keys.sort())) {
    throw new Error("Grafo incompleto o diferente en el manifiesto.");
  }
}

export async function loadDemo(input: {
  url: string;
  anonKey: string;
  fixtures: unknown;
  allowRemote: boolean;
  manifestPath: string;
  revision: string;
}): Promise<{ manifest: DemoManifest; reused: boolean }> {
  validateDemo();
  verifyContracts();
  const parsed = veterinarianFixturesSchema.safeParse(input.fixtures);
  if (!parsed.success || new Set(parsed.data.map((v) => v.email.toLowerCase())).size !== 3) {
    throw new Error("El fixture de veterinarios debe contener tres cuentas distintas y válidas.");
  }
  if (!isLocalSupabaseUrl(input.url) && !input.allowRemote)
    throw new Error("Backend no local: requiere --allow-remote explícito.");
  if (input.allowRemote && !isLocalSupabaseUrl(input.url))
    console.warn("DEMO: --allow-remote habilitado deliberadamente para un backend sintético.");
  const vets: Vet[] = [];
  for (const fixture of parsed.data) {
    const client = createClient<Database>(input.url, input.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword(fixture);
    if (error || !data.user)
      throw error ?? new Error("No se pudo autenticar el veterinario del fixture.");
    const session = await client.rpc("start_access_session");
    if (session.error) throw session.error;
    const profile = await client
      .from("veterinarians")
      .select("clinic_id")
      .eq("id", data.user.id)
      .single();
    if (profile.error) throw profile.error;
    vets.push({ client, clinicId: profile.data.clinic_id, id: data.user.id });
  }
  if (new Set(vets.map((v) => v.clinicId)).size !== 1)
    throw new Error("Los veterinarios pertenecen a clínicas distintas.");
  const primary = vets[0] as Vet;
  const keys = [...TUTORES_DEMO, ...PACIENTES_DEMO].map((e) => e.key);
  for (const c of CONSULTAS_DEMO) {
    keys.push(c.key, ...c.anamnesis.map((a) => a.key), ...c.feedback.map((f) => f.key));
    for (const e of [c.diagnosis, c.epicrisis, c.correction]) if (e) keys.push(e.key);
  }
  keys.forEach(traceFor);
  const expected = {
    target: new URL(input.url).origin,
    clinicId: primary.clinicId,
    fixtureHash: demoHash({ TUTORES_DEMO, PACIENTES_DEMO, CONSULTAS_DEMO, DATASET_META }),
    keys,
  };
  let manifest: DemoManifest = {
    datasetId: DATASET_META.datasetId,
    version: DATASET_META.version,
    revision: input.revision,
    ...expected,
    status: "partial",
    startedAt: new Date().toISOString(),
    entities: {},
    events: {},
  };
  const save = () => {
    mkdirSync(dirname(input.manifestPath), { recursive: true });
    writeFileSync(`${input.manifestPath}.tmp`, JSON.stringify(manifest, null, 2), { mode: 0o600 });
    renameSync(`${input.manifestPath}.tmp`, input.manifestPath);
  };
  const snapshot = async (verify: boolean) => {
    const entries = Object.entries(manifest.entities);
    const ids = entries.map(([, e]) => e.id);
    if (!ids.length) return;
    const result = await primary.client.from("clinical_records").select("*").in("id", ids);
    if (result.error) throw result.error;
    const rows = new Map(result.data.map((row) => [row.id, row]));
    for (const [key, e] of entries) {
      const row = rows.get(e.id);
      if (!row || row.clinic_id !== primary.clinicId || (verify && e.hash !== demoHash(row))) {
        throw new Error(`Registro ausente o alterado: ${key}.`);
      }
      if (!verify) e.hash = demoHash(row);
    }
    const eventResult = await primary.client
      .from("clinical_audit_events")
      .select("*")
      .in("entity_id", ids)
      .order("id");
    if (eventResult.error) throw eventResult.error;
    const events = Object.fromEntries(
      eventResult.data.map((event) => [event.id, { id: event.id, hash: demoHash(event) }]),
    );
    if (verify && demoHash(events) !== demoHash(manifest.events))
      throw new Error("Eventos de auditoría ausentes o alterados.");
    manifest.events = events;
    if (verify) {
      for (const [field, parentIds] of [
        ["tutorId", TUTORES_DEMO.map((t) => manifest.entities[t.key]?.id)],
        ["patientId", PACIENTES_DEMO.map((p) => manifest.entities[p.key]?.id)],
        ["consultationId", CONSULTAS_DEMO.map((c) => manifest.entities[c.key]?.id)],
      ] as const) {
        const related = await primary.client
          .from("clinical_records")
          .select("id")
          .in(`content->>${field}`, parentIds as string[]);
        if (related.error) throw related.error;
        if (related.data.some((r) => !ids.includes(r.id)))
          throw new Error(`Grafo alterado: registros adicionales en ${field}.`);
      }
    }
  };
  if (existsSync(input.manifestPath)) {
    manifest = manifestSchema.parse(JSON.parse(readFileSync(input.manifestPath, "utf8")));
    assertManifestMatches(manifest, expected);
    await snapshot(true);
    return { manifest, reused: true };
  }
  const existing = await primary.client
    .from("clinical_records")
    .select("id")
    .eq("record_type", "tutor")
    .in(
      "content->>rut",
      TUTORES_DEMO.map((t) => t.rut),
    );
  if (existing.error) throw existing.error;
  if (existing.data.length)
    throw new Error(
      "Dataset previo sin manifiesto: carga parcial o no verificable. No se escribe; reconstruye explícitamente solo una base local desechable.",
    );
  save();
  const vet = (author: number) => {
    const v = vets[author];
    if (!v) throw new Error(`Autor inexistente: ${author}.`);
    return v;
  };
  const remember = async (key: string, row: Pick<Row, "id">) => {
    manifest.entities[key] = { id: row.id, hash: "" };
    await snapshot(false);
    save();
  };
  const id = (key: string) => {
    const e = manifest.entities[key];
    if (!e) throw new Error(`Referencia pendiente: ${key}.`);
    return e.id;
  };
  for (const tutor of TUTORES_DEMO) {
    const v = vet(0);
    const result = await createTutor(v.client, { clinicId: v.clinicId, tutor });
    await remember(tutor.key, result.record);
  }
  for (const patient of PACIENTES_DEMO) {
    const v = vet(0);
    const result = await createPatientFicha(v.client, {
      clinicId: v.clinicId,
      ficha: patient.ficha,
      tutor: { existingTutorId: id(patient.tutorKey) },
    });
    await remember(patient.key, result.record);
  }
  console.info(
    "DEMO: estados clínicos y aprobaciones son actos simulados del guion editorial, sin decisiones del asistente.",
  );
  for (const c of CONSULTAS_DEMO) {
    const v = vet(c.author);
    const consultation = await openConsultation(v.client, {
      clinicId: v.clinicId,
      patientId: id(c.paciente),
    });
    await remember(c.key, consultation.record);
    for (const entry of c.anamnesis) {
      const author = vet(entry.author);
      const result = await recordAnamnesisEntry(author.client, {
        clinicId: v.clinicId,
        consultationId: id(c.key),
        ...entry,
      });
      await remember(entry.key, result.record);
    }
    if (c.diagnosis) {
      const result = await recordDiagnosis(v.client, {
        clinicId: v.clinicId,
        consultationId: id(c.key),
        ...c.diagnosis,
      });
      await remember(c.diagnosis.key, result.record);
    }
    if (c.epicrisis) {
      const author = vet(c.epicrisis.author);
      const result = await generateEpicrisisDraft(author.client, {
        clinicId: v.clinicId,
        consultationId: id(c.key),
      });
      await remember(c.epicrisis.key, result.record);
      if (c.epicrisis.status === "approved") {
        await approveEpicrisis(author.client, result.record.id);
        await snapshot(false);
        save();
      }
      if (c.correction) {
        const correction = await correctEpicrisis(
          vet(c.correction.author).client,
          result.record.id,
          {
            ...(result.record.content as EpicrisisContent),
            observaciones: c.correction.observaciones,
          },
        );
        await remember(c.correction.key, correction.record);
      }
    }
    for (const f of c.feedback) {
      const content = { ...f.content, consultationId: id(c.key) };
      const result = f.corrects
        ? await correctFeedbackEntry(vet(f.author).client, id(f.corrects), content)
        : await createFeedbackEntry(vet(f.author).client, { clinicId: v.clinicId, content });
      await remember(f.key, result.record);
    }
  }
  await snapshot(false);
  manifest.status = "complete";
  manifest.finishedAt = new Date().toISOString();
  save();
  await snapshot(true);
  return { manifest, reused: false };
}
