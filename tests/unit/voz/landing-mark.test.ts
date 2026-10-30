import { describe, expect, test } from "bun:test";
import { keepLanding, landAt } from "@/features/voz/landing-mark";

const estado = (text: string) => ({ text, attribution: null });

// sistema-visual «El borrador confirmado aterriza en su campo»: la marca «Nuevo» dura hasta la
// siguiente acción del veterinario.
describe("marca «Nuevo» del borrador confirmado", () => {
  test("aterriza con el id de la entrada y el mensaje que la anuncia", () => {
    const anuncio = estado("Antecedente incorporado a la anamnesis.");
    expect(landAt("anamnesis-9", anuncio).entryId).toBe("anamnesis-9");
  });

  test("se conserva mientras el estado siga siendo el del aterrizaje", () => {
    const anuncio = estado("Antecedente incorporado a la anamnesis.");
    const marca = landAt("anamnesis-9", anuncio);
    expect(keepLanding(marca, anuncio)).toBe(marca);
  });

  test("se quita con la siguiente acción, que deja otro estado", () => {
    const marca = landAt("anamnesis-9", estado("Antecedente incorporado a la anamnesis."));
    // Mismo texto pero otro objeto: es otra operación, no el anuncio del aterrizaje.
    expect(keepLanding(marca, estado("Antecedente incorporado a la anamnesis."))).toBeNull();
    expect(keepLanding(marca, estado("Antecedente de anamnesis registrado."))).toBeNull();
    expect(keepLanding(marca, null)).toBeNull();
  });

  test("sin marca no hay nada que conservar", () => {
    expect(keepLanding(null, estado("cualquiera"))).toBeNull();
  });

  test("una confirmación nueva reemplaza a la anterior", () => {
    const primero = estado("uno");
    const segundo = estado("dos");
    const marca = landAt("anamnesis-2", segundo);
    expect(keepLanding(marca, segundo)?.entryId).toBe("anamnesis-2");
    expect(keepLanding(landAt("anamnesis-1", primero), segundo)).toBeNull();
  });
});
