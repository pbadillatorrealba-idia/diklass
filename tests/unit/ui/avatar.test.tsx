import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Avatar, initialsOf } from "@/components/ui/avatar";

// sistema-visual FR-092 · design.md D17.
describe("Avatar", () => {
  test.each([
    ["Dra. Ana Torres", "AT"],
    ["Dr. Bruno Díaz Soto", "BD"],
    ["ángela", "Á"],
    ["  maría   josé  ", "MJ"],
    ["", "?"],
  ])("las iniciales de «%s» son %s", (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });

  test("es decorativo, circular, con min-h-touch y los tokens de superficie", () => {
    const html = renderToStaticMarkup(<Avatar name="Dra. Ana Torres" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toMatch(/data-class="[^"]*rounded-full[^"]*bg-primary-surface[^"]*"/);
    expect(html).toMatch(/data-class="[^"]*min-h-touch[^"]*min-w-touch[^"]*"/);
    expect(html).toMatch(/text-foreground[^"]*"[^>]*>AT</);
  });
});
