import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Button, ButtonText } from "@/components/ui/button";

const classesOf = (html: string) =>
  [...html.matchAll(/data-class="([^"]*)"/g)].map((m) => (m[1] ?? "").split(/\s+/));

// design.md D7: variantes primary/outline/ghost y tamaños sm/md con área táctil ≥ 44 px (FR-078).
describe("Button", () => {
  test.each([
    ["primary", "bg-primary", "text-primary-foreground"],
    ["outline", "bg-card", "text-foreground"],
    ["ghost", "bg-transparent", "text-primary"],
    ["destructive", "bg-destructive", "text-destructive-foreground"],
  ] as const)("la variante %s usa %s y %s", (variant, surface, text) => {
    const [pressable, label] = classesOf(
      renderToStaticMarkup(
        <Button variant={variant}>
          <ButtonText>Ver fuente</ButtonText>
        </Button>,
      ),
    );
    expect(pressable).toContain(surface);
    expect(label).toContain(text);
  });

  test.each([
    ["sm", "px-3", "text-sm"],
    ["md", "px-5", "text-base"],
  ] as const)("el tamaño %s usa %s y %s, con altura mínima táctil", (size, padding, text) => {
    const [pressable, label] = classesOf(
      renderToStaticMarkup(
        <Button size={size}>
          <ButtonText>Guardar</ButtonText>
        </Button>,
      ),
    );
    expect(pressable).toContain("min-h-touch");
    expect(pressable).toContain(padding);
    expect(label).toContain(text);
  });

  test("por defecto es primary y md", () => {
    const [pressable, label] = classesOf(
      renderToStaticMarkup(
        <Button>
          <ButtonText>Guardar</ButtonText>
        </Button>,
      ),
    );
    expect(pressable).toContain("bg-primary");
    expect(pressable).toContain("px-5");
    expect(label).toContain("text-base");
  });
});
