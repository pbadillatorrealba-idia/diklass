import { describe, expect, test } from "bun:test";
import { listProfileChanges, updateOwnProfile } from "@/features/perfil/profile-service";
import { ANA, BRUNO, isLiveSupabase, signedInVeterinarian } from "../live-supabase";

/** Perfil profesional contra Supabase viva (FR-095). Corre con `SUPABASE_LIVE_TESTS=1`. */
describe.skipIf(!isLiveSupabase)("perfil profesional contra Supabase viva", () => {
  const nombreOriginal = "Dra. Ana Torres";

  test("ANA cambia su nombre y ve el evento", async () => {
    const ana = await signedInVeterinarian(ANA);
    const nuevo = `Dra. Ana Perfil ${Date.now()}`;
    try {
      expect(await updateOwnProfile(ana.client, nuevo)).toEqual({ displayName: nuevo });
      const cambios = await listProfileChanges(ana.client, ana.userId);
      expect(cambios[0]).toMatchObject({ previous: nombreOriginal, current: nuevo });
    } finally {
      // Otras suites buscan «Dra. Ana Torres» (tasks 2.3).
      await updateOwnProfile(ana.client, nombreOriginal);
    }
  });

  test("BRUNO no puede cambiar el nombre de ANA", async () => {
    const bruno = await signedInVeterinarian(BRUNO);
    const { error } = await bruno.client
      .from("veterinarians")
      .update({ display_name: "Intruso" })
      .eq("identifier", ANA.email);
    expect(error).not.toBeNull();

    const { data: ana } = await bruno.client
      .from("veterinarians")
      .select("display_name")
      .eq("identifier", ANA.email)
      .single();
    expect(ana?.display_name).toBe(nombreOriginal);
  });
});
