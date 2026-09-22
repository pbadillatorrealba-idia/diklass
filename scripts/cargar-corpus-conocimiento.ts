/**
 * Carga el corpus documental sintético en un entorno vivo, sin tocar `supabase/seed.sql`
 * (D9 del diseño del cambio). Uso:
 *
 *   bun scripts/cargar-corpus-conocimiento.ts
 *
 * Variables de entorno: las del stack local (`supabase status -o env`: SUPABASE_URL,
 * EXPO_PUBLIC_SUPABASE_ANON_KEY o ANON_KEY) y las credenciales de un veterinario
 * provisionado (CORPUS_VET_EMAIL / CORPUS_VET_PASSWORD; por omisión, la sintética Ana).
 * La atribución de cada incorporación queda en la fila: nace atribuida al veterinario que
 * ejecuta el guion (FR-069 · US5-AC13).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadSyntheticCorpus } from "@/features/conocimiento/corpus-loader";
import type { Database } from "@/lib/supabase/database.types";

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.ANON_KEY;
const email = process.env.CORPUS_VET_EMAIL ?? "vet.ana@example.test";
const password = process.env.CORPUS_VET_PASSWORD ?? "synthetic-password-ana";

if (!url || !anonKey) {
  console.error(
    "Faltan SUPABASE_URL y la clave anónima del entorno (ver `supabase status -o env`).",
  );
  process.exit(1);
}

const corpus = JSON.parse(
  readFileSync(
    join(import.meta.dir, "../tests/fixtures/conocimiento/corpus-sintetico.json"),
    "utf8",
  ),
);

const client = createClient<Database>(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: sesion, error: errorAcceso } = await client.auth.signInWithPassword({
  email,
  password,
});
if (errorAcceso || !sesion.user) {
  console.error(`No se pudo iniciar sesión como ${email}:`, errorAcceso?.message);
  process.exit(1);
}

const { error: errorSesion } = await client.rpc("start_access_session");
if (errorSesion) {
  console.error("No se pudo abrir la sesión de acceso:", errorSesion.message);
  process.exit(1);
}

const { data: perfil, error: errorPerfil } = await client
  .from("veterinarians")
  .select("clinic_id")
  .eq("id", sesion.user.id)
  .single();
if (errorPerfil || !perfil) {
  console.error("El veterinario no tiene clínica asignada:", errorPerfil?.message);
  process.exit(1);
}

const { claves } = await loadSyntheticCorpus(client, { clinicId: perfil.clinic_id, corpus });
console.log(`Corpus sintético cargado por ${email}:`);
for (const [clave, id] of Object.entries(claves)) {
  console.log(`  ${clave} → ${id}`);
}
