import { readFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { recordAnamnesisEntry } from "@/features/registro/anamnesis-service";
import { openConsultation } from "@/features/registro/consultation-service";
import { createPatientFicha } from "@/features/registro/ficha-service";
import type { AnamnesisField } from "@/features/registro/schema";
import { findTutorByRut } from "@/features/registro/tutor-search";
import { createTutor } from "@/features/registro/tutor-service";
import type { Database } from "@/lib/supabase/database.types";
import { antecedentItems, CONSULTAS_DEMO, PACIENTES_DEMO, TUTORES_DEMO } from "./demo/datos-demo";
import { isLocalSupabaseUrl, parseArgs } from "./lib/provisioning";

/**
 * Carga la clínica de demostración (tutores, pacientes y consultas) escribiendo con la sesión de
 * cada veterinario del fixture, igual que la interfaz: los triggers de atribución y las
 * validaciones de contenido corren como siempre. Los veterinarios deben estar provisionados
 * (`bun run provision:veterinarians`). Para empezar de cero: `bun run demo:reset`.
 */

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error("SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY son obligatorios.");
}

const { fixturePath, allowRemote } = parseArgs(process.argv.slice(2));
if (!isLocalSupabaseUrl(url) && !allowRemote) {
  throw new Error(
    `${url} no es un Supabase local. Usa --allow-remote solo para un backend sintético.`,
  );
}

type Fixture = { email: string; password: string; displayName: string };
type Vet = { client: SupabaseClient<Database>; clinicId: string; name: string };

const fixtures = JSON.parse(await readFile(fixturePath, "utf8")) as Fixture[];

async function signIn(fixture: Fixture): Promise<Vet> {
  const client = createClient<Database>(url as string, anonKey as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: fixture.email,
    password: fixture.password,
  });
  if (error || !data.user) throw error ?? new Error(`No se pudo iniciar sesión: ${fixture.email}`);
  const { error: sessionError } = await client.rpc("start_access_session");
  if (sessionError) throw sessionError;
  const { data: profile, error: profileError } = await client
    .from("veterinarians")
    .select("clinic_id")
    .eq("id", data.user.id)
    .single();
  if (profileError) throw profileError;
  return { client, clinicId: profile.clinic_id, name: fixture.displayName };
}

const vets = await Promise.all(fixtures.map(signIn));
const vetFor = (index: number) => vets[index % vets.length] as Vet;

const first = TUTORES_DEMO[0];
if (first && (await findTutorByRut(vetFor(0).client, first.rut))) {
  console.log(
    "La clínica de demostración ya está cargada. Para empezar de cero: bun run demo:reset",
  );
  process.exit(0);
}

const tutorIds: string[] = [];
for (const [index, tutor] of TUTORES_DEMO.entries()) {
  const vet = vetFor(index);
  const { record } = await createTutor(vet.client, { clinicId: vet.clinicId, tutor });
  tutorIds.push(record.id);
}

const patientIds = new Map<string, { id: string; vet: Vet }>();
for (const [index, paciente] of PACIENTES_DEMO.entries()) {
  const vet = vetFor(index);
  const tutorId = tutorIds[paciente.tutor];
  if (!tutorId) throw new Error(`Tutor ${paciente.tutor} inexistente para ${paciente.name}.`);
  const { record } = await createPatientFicha(vet.client, {
    clinicId: vet.clinicId,
    tutor: { existingTutorId: tutorId },
    ficha: {
      name: paciente.name,
      species: paciente.species,
      breed: paciente.breed,
      sex: paciente.sex,
      reproductiveStatus: paciente.reproductiveStatus,
      birthDate: paciente.birthDate,
      ageMonths: null,
      weightKg: paciente.weightKg,
      origin: paciente.origin ?? null,
      fileNumber: `D-${String(index + 1).padStart(4, "0")}`,
      antecedentes: {
        medicalHistory: antecedentItems(paciente.antecedentes?.medicalHistory),
        preexistingDiseases: antecedentItems(paciente.antecedentes?.preexistingDiseases),
        currentMedications: antecedentItems(paciente.antecedentes?.currentMedications),
        knownAllergies: antecedentItems(paciente.antecedentes?.knownAllergies),
        behavioralHistory: antecedentItems(paciente.antecedentes?.behavioralHistory),
      },
    },
  });
  patientIds.set(paciente.name, { id: record.id, vet });
}

let consultations = 0;
for (const consulta of CONSULTAS_DEMO) {
  const target = patientIds.get(consulta.paciente);
  if (!target) throw new Error(`Paciente inexistente: ${consulta.paciente}`);
  const { record } = await openConsultation(target.vet.client, {
    clinicId: target.vet.clinicId,
    patientId: target.id,
  });
  for (const entry of consulta.anamnesis) {
    await recordAnamnesisEntry(target.vet.client, {
      clinicId: target.vet.clinicId,
      consultationId: record.id,
      field: entry.field as AnamnesisField,
      text: entry.text,
      provenance: "reportada",
    });
  }
  consultations += 1;
}

console.log(
  `Clínica de demostración cargada: ${TUTORES_DEMO.length} tutores, ${PACIENTES_DEMO.length} pacientes y ${consultations} consultas, por ${vets.length} veterinarios.`,
);
