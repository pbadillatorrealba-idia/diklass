import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PanelBody } from "@/components/asistente/assistant-panel";
import type { PanelThread } from "@/features/asistente/panel-threads";

const AVISO = "Grabando y conservando audio";
const escucha: PanelThread = {
  id: "escucha",
  label: "Escucha",
  element: <span>hilo escucha</span>,
  status: () => <span data-testid="estado-escucha">{AVISO}</span>,
};
const asistente: PanelThread = { id: "asistente", label: "Asistente", element: <span>hilo</span> };
const render = (active: PanelThread) =>
  renderToStaticMarkup(
    <PanelBody active={active} control={null} onSelect={() => {}} threads={[escucha, asistente]} />,
  );

// sistema-visual «Escucha siempre visible»: el aviso de grabación no depende del hilo activo.
describe("PanelBody", () => {
  test("con otro hilo activo, el estado de la escucha sigue a la vista", () => {
    expect(render(asistente)).toContain(AVISO);
  });

  test("con el hilo de la escucha activo, su estado no se repite en la cabecera", () => {
    expect(render(escucha)).not.toContain(AVISO);
  });
});
