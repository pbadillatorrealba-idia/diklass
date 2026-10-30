import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Rail } from "@/components/asistente/assistant-panel";
import { PanelDockView } from "@/components/asistente/panel-dock";
import type { PanelThread } from "@/features/asistente/panel-threads";

const hilo = (over: Partial<PanelThread> = {}): PanelThread => ({
  id: "asistente",
  label: "Asistente",
  element: null,
  ...over,
});
const rail = (threads: PanelThread[]) =>
  renderToStaticMarkup(
    <Rail covered={false} onOpen={() => {}} threads={threads} toggleRef={null} />,
  );
const dock = (threads: PanelThread[]) =>
  renderToStaticMarkup(<PanelDockView activeId="asistente" onOpen={() => {}} threads={threads} />);

// asistente-conversacional «Aviso de respuesta nueva» (design.md D12): sin sonido ni animación, en
// `role="status"` y nunca solo color.
describe("marca de no leído", () => {
  test("el riel la muestra junto al icono del Asistente, con texto y estado", () => {
    const html = rail([hilo({ unread: true })]);
    expect(html).toContain('data-testid="assistant-rail-unread-asistente"');
    expect(html).toContain('role="status"');
    expect(html).toContain("Respuesta nueva en Asistente");
    expect(html).toContain("Nuevo");
  });

  test("el riel no la muestra si no hay respuesta sin leer", () => {
    expect(rail([hilo()])).not.toContain("assistant-rail-unread");
  });

  test("el dock la muestra en compacto, con texto y estado", () => {
    const html = dock([hilo({ unread: true })]);
    expect(html).toContain('data-testid="panel-dock-unread"');
    expect(html).toContain("Respuesta nueva");
    expect(html).toContain('role="status"');
  });

  test("el dock no la muestra si no hay respuesta sin leer", () => {
    expect(dock([hilo()])).not.toContain("panel-dock-unread");
  });
});
