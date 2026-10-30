import { describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AudioFactEntry } from "@/features/voz/audio-fact-service";
import type { ConfirmationState } from "@/features/voz/schema";
import type { ListenModeApi } from "@/features/voz/use-listen-mode";

// La insignia de atribución resuelve el nombre con Supabase: aquí solo importa que aparezca.
mock.module("@/features/clinical/use-veterinarian-display-name", () => ({
  useVeterinarianDisplayName: () => ({ data: "Dra. Prueba" }),
}));
// Después de sustituir el hook: un import estático se evaluaría antes que `mock.module`.
const { DraftFactCard } = await import("@/components/voz/draft-fact-card");
const { ListenThread } = await import("@/components/voz/listen-thread");
const { ListenLiveStatus } = await import("@/components/voz/listen-live-status");
const { PanelDockView } = await import("@/components/asistente/panel-dock");
const { ListenModeButton } = await import("@/components/voz/listen-mode-button");

const render = (node: ReactNode) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>,
  );

function fact(state: ConfirmationState, contradiction?: string): AudioFactEntry {
  return {
    record: {
      id: `f-${state}`,
      created_by: "00000000-0000-4000-8000-000000000001",
      created_at: "2026-09-25T10:00:00Z",
      updated_by: state === "confirmed" ? "00000000-0000-4000-8000-000000000002" : null,
      updated_at: state === "confirmed" ? "2026-09-25T10:05:00Z" : null,
    } as AudioFactEntry["record"],
    content: {
      consultationId: "c1",
      field: "motivo_consulta",
      text: "Vocaliza de noche",
      provenance: "inferida",
      confirmationState: state,
      transcriptSegmentId: "t1",
      transcriptExcerpt: "llora cuando se va",
      segmentSeq: 0,
      contradiction: contradiction ? { refKind: "ficha", refId: "x", note: contradiction } : null,
    },
  };
}

const panel = (entry: AudioFactEntry) =>
  render(
    <DraftFactCard
      busy={false}
      fact={entry}
      onConfirm={() => {}}
      onDiscard={() => {}}
      onEdit={() => {}}
    />,
  );

// FR-076 · escenario «Sugerencia aprobada» · design.md D7 (sistema-visual 4.5).
describe("DraftFactCard", () => {
  test("un hecho pendiente se muestra como sugerencia del sistema", () => {
    const html = panel(fact("pending"));
    expect(html).toContain('aria-label="Sugerencia del sistema');
    expect(html).toContain("border-suggested");
    expect(html).not.toContain('data-testid="attribution-badge"');
  });

  // sistema-visual D20 (12.9): la procedencia del hecho va al margen como código con nombre.
  test("la procedencia del hecho es un código al margen con nombre", () => {
    const html = panel(fact("pending"));
    expect(html).toContain('aria-label="Procedencia: Inferida"');
    expect(html).not.toContain(">Procedencia: Inferida<");
  });

  test("un hecho confirmado deja de ser sugerencia y muestra su atribución", () => {
    const html = panel(fact("confirmed"));
    expect(html).not.toContain("Sugerencia del sistema");
    expect(html).toContain('data-testid="attribution-badge"');
    expect(html).toContain(">Confirmado<");
    // D20 · FR-076: lo aprobado lleva el timbre de firma, no la atribución neutra.
    expect(html).toContain("border-stamp");
  });

  test("la contradicción es un aviso con estado, no solo texto de color", () => {
    const html = panel(fact("pending", "La ficha dice que no vocaliza"));
    const box = html.match(/<div[^>]*data-testid="draft-fact-contradiction"[^>]*>/)?.[0] ?? "";
    expect(box).toContain("bg-warning-surface");
    expect(box).toContain('aria-live="polite"');
    expect(html).toContain("La ficha dice que no vocaliza");
  });
});

describe("ListenModeButton", () => {
  test.each([
    [false, "bg-primary", "false"],
    [true, "bg-destructive", "true"],
  ] as const)("activo=%p usa %s y aria-pressed=%s", (active, surface, pressed) => {
    const html = render(<ListenModeButton active={active} onToggle={() => {}} />);
    const button =
      html.match(/<(?:div|button)[^>]*data-testid="listen-mode-button"[^>]*>/)?.[0] ?? "";
    expect(button.split('data-class="')[1]?.split('"')[0]?.split(" ")).toContain(surface);
    expect(button).toContain(`aria-pressed="${pressed}"`);
  });
});

// Cambio implementar-asr-real-captura-voz · D5: aviso de grabación y conservación del audio.
describe("RecordingNotice", () => {
  test("activo: avisa en texto que se graba y se conserva el audio", async () => {
    const { RecordingNotice } = await import("@/components/voz/recording-notice");
    const html = render(<RecordingNotice active />);
    expect(html).toContain('data-testid="recording-notice"');
    expect(html).toContain("Se está grabando y conservando el audio de esta conversación");
    // El color nunca es la única señal: el Callout trae título y región `polite`.
    expect(html).toContain('aria-live="polite"');
  });

  test("inactivo: no muestra nada", async () => {
    const { RecordingNotice } = await import("@/components/voz/recording-notice");
    expect(render(<RecordingNotice active={false} />)).toBe("");
  });
});

function segment(seq: number, id: string, text: string, quality: "ok" | "insufficient" = "ok") {
  return {
    id,
    listenSessionId: "s1",
    clinicId: "k1",
    seq,
    startedAt: `2026-09-25T10:0${seq}:00Z`,
    endedAt: `2026-09-25T10:0${seq}:30Z`,
    text,
    quality,
    processingState: "processed" as const,
    audioPath: null,
    createdAt: "2026-09-25T10:00:00Z",
  };
}

const withSegment = (entry: AudioFactEntry, segmentId: string, text: string): AudioFactEntry => ({
  ...entry,
  record: { ...entry.record, id: `${entry.record.id}-${text}` } as AudioFactEntry["record"],
  content: { ...entry.content, transcriptSegmentId: segmentId, text },
});

const thread = (segments: ReturnType<typeof segment>[], facts: AudioFactEntry[]) =>
  render(
    <ListenThread
      busy={false}
      facts={facts}
      onConfirm={() => {}}
      onDiscard={() => {}}
      onEdit={() => {}}
      segments={segments}
    />,
  );

// sistema-visual «Hilo de escucha» (shell-asistente-tres-zonas, design.md D4).
describe("ListenThread", () => {
  test("los borradores aparecen bajo su tramo, con fragmento y las tres acciones", () => {
    const html = thread(
      [segment(0, "t1", "llora cuando se va"), segment(1, "t2", "come bien")],
      [
        withSegment(fact("pending"), "t1", "Vocaliza de noche"),
        withSegment(fact("pending"), "t1", "Se inquieta al salir"),
        withSegment(fact("pending"), "t2", "Apetito normal"),
      ],
    );
    const tramos = html.split('data-testid="transcript-segment"').slice(1);
    expect(tramos).toHaveLength(2);
    // Primer tramo: sus 2 borradores, y solo esos.
    expect(tramos[0]?.match(/data-testid="draft-fact-card"/g)).toHaveLength(2);
    expect(tramos[0]).toContain("Vocaliza de noche");
    expect(tramos[0]).toContain("Se inquieta al salir");
    expect(tramos[0]).not.toContain("Apetito normal");
    expect(tramos[1]?.match(/data-testid="draft-fact-card"/g)).toHaveLength(1);
    // Fragmento y Confirmar / Corregir / Descartar en cada borrador.
    expect(html).toContain("Fragmento de origen");
    expect(html.match(/data-testid="draft-fact-confirm"/g)).toHaveLength(3);
    expect(html.match(/data-testid="draft-fact-edit"/g)).toHaveLength(3);
    expect(html.match(/data-testid="draft-fact-discard"/g)).toHaveLength(3);
  });

  test("cada tramo lleva su hora y van en orden cronológico", () => {
    const html = thread([segment(1, "t2", "segundo"), segment(0, "t1", "primero")], []);
    expect(html.match(/<time /g)).toHaveLength(2);
    expect(html.indexOf("primero")).toBeLessThan(html.indexOf("segundo"));
  });

  test("sin tramos dice que no hay y no pinta tramos", () => {
    const html = thread([], []);
    expect(html).toContain("Todavía no hay tramos transcritos.");
    expect(html).not.toContain('data-testid="transcript-segment"');
  });

  test("con contradicción, el aviso queda bajo el borrador de su tramo", () => {
    const html = thread(
      [segment(0, "t1", "llora cuando se va")],
      [withSegment(fact("pending", "La ficha dice que no vocaliza"), "t1", "Vocaliza de noche")],
    );
    expect(html).toContain('data-testid="draft-fact-contradiction"');
    expect(html).toContain("La ficha dice que no vocaliza");
  });

  test("un tramo no confiable se señala y no se mezcla con borradores", () => {
    const html = thread([segment(0, "t1", "ruido", "insufficient")], []);
    expect(html).toContain("Tramo no confiable");
  });

  test("un borrador cuyo tramo aún no se cargó no se pierde", () => {
    const html = thread([], [withSegment(fact("pending"), "t-desconocido", "Vocaliza de noche")]);
    expect(html).toContain("Vocaliza de noche");
    expect(html).toContain('data-testid="draft-fact-card"');
  });

  test("no separa hablantes ni usa burbujas de mensaje", () => {
    const html = thread(
      [segment(0, "t1", "llora cuando se va")],
      [withSegment(fact("pending"), "t1", "Vocaliza de noche")],
    );
    expect(html).not.toMatch(/Tutor:|Veterinari[oa]:|Hablante|speaker|bubble/i);
  });
});

const modoDe = (
  state: ListenModeApi["state"],
  over: Partial<ListenModeApi> = {},
): ListenModeApi => ({
  state,
  startedAt: null,
  modoReal: true,
  facts: [],
  segments: [],
  isBusy: false,
  start: async () => {},
  stop: async () => {},
  confirmFact: async () => {},
  discardFact: async () => {},
  editFact: async () => {},
  ...over,
});

// sistema-visual «Escucha siempre visible» (design.md D7/D8): el riel y la cinta muestran la
// captura aunque el panel esté colapsado o la hoja cerrada, y el aviso nunca depende solo del color.
describe("ListenLiveStatus en el riel", () => {
  const riel = (modo: ListenModeApi) => render(<ListenLiveStatus modo={modo} variant="rail" />);

  test("capturando en modo real: estado, tiempo, aviso de grabación y Detener, todo en texto", () => {
    const html = riel(modoDe("capturando"));
    expect(html).toContain('data-testid="listen-status-rail"');
    expect(html).toContain("Grabando");
    expect(html).toContain("00:00");
    // El aviso completo es el nombre accesible del estado; el texto corto cabe en 56 px.
    expect(html).toContain('aria-label="Grabando y conservando audio"');
    expect(html).toContain('aria-label="Detener el modo de escucha clínica"');
    expect(html).toContain(">Detener<");
  });

  test("el tiempo cuenta desde el inicio de la captura, no desde que se monta el riel", () => {
    // El riel se monta al colapsar el panel, con la captura ya en curso: 65 s después del inicio.
    const html = riel(modoDe("capturando", { startedAt: Date.now() - 65_500 }));
    expect(html).toContain("01:05");
    expect(html).not.toContain("00:00");
  });

  test("capturando en modo simulado no afirma que se graba audio", () => {
    const html = riel(modoDe("capturando", { modoReal: false }));
    expect(html).toContain("Escuchando");
    expect(html).not.toContain("Grabando");
    expect(html).not.toContain("conservando audio");
  });

  test.each(["inactivo", "detenido", "no_disponible"] as const)(
    "sin captura (%s) no muestra nada",
    (estado) => {
      expect(riel(modoDe(estado))).toBe("");
    },
  );
});

describe("ListenLiveStatus en la cinta", () => {
  const cinta = (modo: ListenModeApi) => render(<ListenLiveStatus modo={modo} variant="dock" />);

  test("lleva el aviso completo en texto visible, el tiempo y Detener de al menos 44×44", () => {
    const html = cinta(modoDe("capturando"));
    expect(html).toContain('data-testid="listen-status-dock"');
    expect(html).toContain("Grabando y conservando audio");
    expect(html).toContain("00:00");
    const detener = html.match(/<[^>]*data-testid="listen-stop-dock"[^>]*>/)?.[0] ?? "";
    expect(detener).toContain('aria-label="Detener el modo de escucha clínica"');
    expect(detener).toContain("min-h-touch");
    expect(detener).toContain("min-w-touch");
  });

  test("el tiempo cuenta desde el inicio de la captura, no desde que se monta la cinta", () => {
    const html = cinta(modoDe("capturando", { startedAt: Date.now() - 125_500 }));
    expect(html).toContain("02:05");
  });

  test("en modo simulado no afirma que se graba audio", () => {
    const html = cinta(modoDe("capturando", { modoReal: false }));
    expect(html).toContain("Escuchando");
    expect(html).not.toContain("conservando audio");
  });

  test("sin captura no muestra nada", () => {
    expect(cinta(modoDe("inactivo"))).toBe("");
  });
});

// sistema-visual «Dock de asistente en compacto» (design.md D7).
describe("PanelDockView", () => {
  const hilos = (pending: number) => [
    {
      id: "escucha",
      label: "Escucha",
      element: null,
      pending,
      status: (variant: "rail" | "dock") => (
        <ListenLiveStatus modo={modoDe("capturando")} variant={variant} />
      ),
    },
    { id: "conocimiento", label: "Conocimiento", element: null },
  ];
  const dock = (active: string, pending: number) =>
    render(<PanelDockView activeId={active} onOpen={() => {}} threads={hilos(pending)} />);

  test("mantiene el nombre Asistente aunque el hilo activo sea otro y conserva el área táctil", () => {
    const html = dock("conocimiento", 0);
    const abrir = html.match(/<[^>]*data-testid="panel-dock-open"[^>]*>/)?.[0] ?? "";
    expect(abrir).toContain("min-h-touch");
    expect(abrir).toContain('aria-haspopup="dialog"');
    expect(abrir).toContain('aria-label="Abrir el asistente: Conocimiento"');
    expect(html).toContain(">Asistente</");
    expect(html).not.toContain(">Conocimiento</");
  });

  test("muestra la escucha aunque el hilo activo sea otro", () => {
    const html = dock("conocimiento", 0);
    expect(html).toContain('data-testid="listen-status-dock"');
    expect(html).toContain("Grabando y conservando audio");
  });

  test("cuenta las propuestas y borradores por confirmar", () => {
    const html = dock("escucha", 3);
    expect(html).toContain('data-testid="panel-dock-pending"');
    expect(html).toContain("3 por confirmar");
  });

  test("sin pendientes no muestra contador", () => {
    expect(dock("escucha", 0)).not.toContain("panel-dock-pending");
  });

  test("sin hilos conserva Iniciar consulta y no ofrece abrir el asistente", () => {
    const html = render(<PanelDockView activeId="x" onOpen={() => {}} threads={[]} />);
    expect(html).toContain('href="/patients"');
    expect(html).toContain("Iniciar consulta");
    expect(html).not.toContain('data-testid="panel-dock-open"');
  });
});
