import { describe, expect, test } from "bun:test";
import { displayNameSchema } from "@/features/perfil/schema";

describe("displayNameSchema — mismas reglas que update_own_profile", () => {
  test("recorta y colapsa espacios", () => {
    expect(displayNameSchema.parse("  Dra.   Ana   Nueva ")).toBe("Dra. Ana Nueva");
  });

  test.each(["", "A", "     ", " A "])("rechaza %p", (valor) => {
    expect(displayNameSchema.safeParse(valor).success).toBe(false);
  });

  test("admite 80 caracteres y rechaza 81", () => {
    expect(displayNameSchema.safeParse("a".repeat(80)).success).toBe(true);
    expect(displayNameSchema.safeParse("a".repeat(81)).success).toBe(false);
  });
});
