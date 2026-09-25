/**
 * Carga el corpus documental sintético en un entorno vivo, sin tocar `supabase/seed.sql`
 * (D9 del diseño del cambio). Uso:
 *
 *   bun --env-file=.env scripts/cargar-corpus-conocimiento.ts [--allow-remote]
 *
 * Variables de entorno: las del stack local (`supabase status -o env`: SUPABASE_URL y
 * EXPO_PUBLIC_SUPABASE_ANON_KEY o ANON_KEY) y las credenciales de un veterinario
 * provisionado (CORPUS_VET_EMAIL / CORPUS_VET_PASSWORD, obligatorias: sin valor por
 * defecto en el código). Falla cerrado como `provision:veterinarians`: rechaza cualquier
 * Supabase no local salvo `--allow-remote` (ver `scripts/lib/corpus-conocimiento.ts`).
 * La atribución de cada incorporación queda en la fila: nace atribuida al veterinario que
 * ejecuta el guion (FR-069 · US5-AC13).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadSyntheticCorpus } from "@/features/conocimiento/corpus-loader";
import type { Database } from "@/lib/supabase/database.types";
import { resolveCorpusConfig } from "./lib/corpus-conocimiento";

let config: ReturnType<typeof resolveCorpusConfig>;
try {
  config = resolveCorpusConfig(process.env, process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
const { url, anonKey, email, password } = config;
if (config.allowRemote) {
  console.warn(`--allow-remote activo: se cargará el corpus sintético en ${url}.`);
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
