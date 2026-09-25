import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { OptionPicker } from "@/components/registro/option-picker";

const OPTIONS = [
  { value: "macho", label: "Macho" },
  { value: "hembra", label: "Hembra" },
] as const;

function render(isDisabled: boolean) {
  const html = renderToStaticMarkup(
    <OptionPicker
      isDisabled={isDisabled}
      label="Sexo"
      onChange={() => {}}
      options={[...OPTIONS]}
      testID="sex"
      value="macho"
    />,
  );
  const option = (testID: string) => {
    const match = html.match(new RegExp(`<div[^>]*data-testid="${testID}"[^>]*>`));
    if (!match) throw new Error(`no se renderizó ${testID}`);
    return match[0];
  };
  return { html, option };
}

// Regresión de la sustitución de colores inline por variantes (sistema-visual, tarea 1.5 · FR-081).
describe("OptionPicker", () => {
  test.each([false, true])(
    "con isDisabled=%p expone el estado checked de cada opción",
    (disabled) => {
      const { html, option } = render(disabled);
      expect(html).toContain('role="radiogroup"');
      expect(option("sex-macho")).toContain('aria-checked="true"');
      expect(option("sex-hembra")).toContain('aria-checked="false"');
    },
  );

  test.each([false, true])(
    "con isDisabled=%p la opción elegida conserva la variante primary",
    (disabled) => {
      const { option } = render(disabled);
      expect(option("sex-macho")).toContain("bg-primary");
      expect(option("sex-hembra")).not.toContain("bg-primary");
      expect(option("sex-hembra")).toContain("border-input");
    },
  );
});
