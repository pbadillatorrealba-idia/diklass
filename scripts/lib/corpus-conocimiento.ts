import { isLocalSupabaseUrl } from "./provisioning";

export type CorpusConfig = {
  url: string;
  anonKey: string;
  email: string;
  password: string;
  allowRemote: boolean;
};

/**
 * Configuración de `scripts/cargar-corpus-conocimiento.ts`. Falla cerrado como
 * `provision:veterinarians` (AGENTS.md, «Seguridad y secretos»): sin credenciales por
 * defecto en el código y solo contra un Supabase local salvo `--allow-remote` explícito.
 */
export function resolveCorpusConfig(
  env: Record<string, string | undefined>,
  args: string[],
): CorpusConfig {
  let allowRemote = false;
  for (const arg of args) {
    if (arg === "--allow-remote") {
      allowRemote = true;
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }

  const url = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? env.ANON_KEY;
  if (!url) {
    throw new Error("Falta SUPABASE_URL (ver `supabase status -o env`).");
  }
  if (!anonKey) {
    throw new Error("Falta EXPO_PUBLIC_SUPABASE_ANON_KEY (ver `supabase status -o env`).");
  }
  const email = env.CORPUS_VET_EMAIL;
  if (!email) {
    throw new Error("Falta CORPUS_VET_EMAIL: el veterinario provisionado que carga el corpus.");
  }
  const password = env.CORPUS_VET_PASSWORD;
  if (!password) {
    throw new Error("Falta CORPUS_VET_PASSWORD: la contraseña de CORPUS_VET_EMAIL.");
  }
  if (!isLocalSupabaseUrl(url) && !allowRemote) {
    throw new Error(
      `${url} no es un Supabase local. Usa --allow-remote solo para el backend sintético de e2e.`,
    );
  }

  return { url, anonKey, email, password, allowRemote };
}
