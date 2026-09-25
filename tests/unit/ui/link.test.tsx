import { describe, expect, test } from "bun:test";
import { Link } from "expo-router";
import { renderToStaticMarkup } from "react-dom/server";
import { Button, ButtonText } from "@/components/ui/button";
import { LinkText } from "@/components/ui/link-text";

// sistema-visual FR-084 · design.md D13: la navegación es un enlace real, no un botón con
// `router.push`. En web eso es un `<a href>` con rol de enlace, que se abre en otra pestaña y
// anuncia «enlace».
describe("Link asChild", () => {
  test("con Button conserva el aspecto del botón pero es un enlace con href", () => {
    const html = renderToStaticMarkup(
      <Link asChild href="/patients/1">
        <Button variant="outline">
          <ButtonText>Ver ficha</ButtonText>
        </Button>
      </Link>,
    );
    expect(html).toMatch(/^<a [^>]*href="\/patients\/1"/);
    expect(html).not.toContain('role="button"');
    expect(html).toMatch(/data-class="[^"]*bg-card[^"]*"/);
  });

  test("con LinkText es un enlace en línea subrayado en color primary", () => {
    const html = renderToStaticMarkup(
      <Link asChild href="/knowledge/sources/new">
        <LinkText>Incorporar fuente clínica</LinkText>
      </Link>,
    );
    expect(html).toMatch(/^<a [^>]*href="\/knowledge\/sources\/new"/);
    expect(html).toMatch(/data-class="[^"]*underline[^"]*"/);
    // Un solo color de texto: `text-foreground` junto a `text-primary` dejaría el color al azar
    // del orden del CSS.
    expect(html).toMatch(/data-class="[^"]*text-primary[^"]*"/);
    expect(html).not.toContain("text-foreground");
    expect(html).toContain(">Incorporar fuente clínica<");
  });
});
