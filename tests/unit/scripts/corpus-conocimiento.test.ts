import { describe, expect, test } from "bun:test";
import { resolveCorpusConfig } from "../../../scripts/lib/corpus-conocimiento";

/**
 * Configuración del guion de carga del corpus (revisión de la PR #30): falla cerrado igual
 * que `provision:veterinarians` (AGENTS.md, «Seguridad y secretos»).
 */

const entornoLocal = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon-local",
  CORPUS_VET_EMAIL: "vet.ana@example.test",
  CORPUS_VET_PASSWORD: "synthetic-password-ana",
};

describe("resolveCorpusConfig", () => {
  test("acepta el Supabase local con credenciales explícitas", () => {
    expect(resolveCorpusConfig(entornoLocal, [])).toEqual({
      url: "http://127.0.0.1:54321",
      anonKey: "anon-local",
      email: "vet.ana@example.test",
      password: "synthetic-password-ana",
      allowRemote: false,
    });
  });

  test("rechaza un Supabase no local sin --allow-remote", () => {
    expect(() =>
      resolveCorpusConfig({ ...entornoLocal, SUPABASE_URL: "https://abcd.supabase.co" }, []),
    ).toThrow("--allow-remote");
  });

  test("admite un Supabase remoto solo con --allow-remote explícito", () => {
    const config = resolveCorpusConfig(
      { ...entornoLocal, SUPABASE_URL: "https://abcd.supabase.co" },
      ["--allow-remote"],
    );
    expect(config.allowRemote).toBe(true);
  });

  test.each(["CORPUS_VET_EMAIL", "CORPUS_VET_PASSWORD"])(
    "sin %s se detiene: no hay credenciales por defecto en el código",
    (variable) => {
      const entorno: Record<string, string | undefined> = { ...entornoLocal };
      delete entorno[variable];
      expect(() => resolveCorpusConfig(entorno, [])).toThrow(variable);
    },
  );

  test("sin URL o sin clave anónima se detiene", () => {
    expect(() => resolveCorpusConfig({ ...entornoLocal, SUPABASE_URL: undefined }, [])).toThrow(
      "SUPABASE_URL",
    );
    expect(() =>
      resolveCorpusConfig({ ...entornoLocal, EXPO_PUBLIC_SUPABASE_ANON_KEY: undefined }, []),
    ).toThrow("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  });

  test("rechaza argumentos desconocidos", () => {
    expect(() => resolveCorpusConfig(entornoLocal, ["--remote"])).toThrow("--remote");
  });
});
