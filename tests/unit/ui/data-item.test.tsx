import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DataItem } from "@/components/ui/data-item";

describe("DataItem", () => {
  test("un texto va en la mono de datos; null dice «Sin dato»", () => {
    expect(renderToStaticMarkup(<DataItem label="Peso" value="4 kg" />)).toContain("4 kg");
    expect(renderToStaticMarkup(<DataItem label="Peso" value={null} />)).toContain("Sin dato");
  });

  test("un nodo se pinta tal cual, sin envolverlo en texto", () => {
    const html = renderToStaticMarkup(<DataItem label="Nombre" value={<a href="/t/1">Ana</a>} />);
    expect(html).toContain('<a href="/t/1">Ana</a>');
    expect(html).not.toContain("Sin dato");
  });
});
