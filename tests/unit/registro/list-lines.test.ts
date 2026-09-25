import { describe, expect, test } from "bun:test";
import { linesToItems, visibleListText } from "@/components/registro/list-lines";

describe("linesToItems", () => {
  test("parte por línea, recorta y descarta líneas vacías", () => {
    expect(linesToItems("  hemograma completo \n\n perfil bioquímico\n")).toEqual([
      "hemograma completo",
      "perfil bioquímico",
    ]);
  });
});

describe("visibleListText (revisión de la PR #27)", () => {
  test("conserva el espacio final mientras se escribe un ítem de varias palabras", () => {
    expect(visibleListText("hemograma ", ["hemograma"])).toBe("hemograma ");
  });

  test("conserva el salto de línea que abre el siguiente ítem", () => {
    expect(visibleListText("hemograma completo\n", ["hemograma completo"])).toBe(
      "hemograma completo\n",
    );
  });

  test("muestra la lista del contenido cuando cambió desde fuera", () => {
    expect(visibleListText("hemograma", ["radiografía", "ecografía"])).toBe(
      "radiografía\necografía",
    );
  });
});
