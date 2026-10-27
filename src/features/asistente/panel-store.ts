import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

/**
 * Estado del panel de asistente por dispositivo (sistema-visual «Panel de asistente colapsable» ·
 * design.md D2/D3). Como el tema, no viaja al servidor; un almacenamiento ilegible o bloqueado
 * deja los valores por defecto sin error visible.
 */
export const PANEL_STORAGE_KEY = "diklass.panel";

/** Desde este ancho de ventana el panel va acoplado a la derecha (D2). */
export const PANEL_DOCKED_FROM = 1440;
/** Desde este ancho y hasta el acoplado, riel visible y cajón superpuesto (D2). */
export const PANEL_RAIL_FROM = 1024;

export type PanelPresentation = "docked" | "rail" | "dock";

export function presentationFor(windowWidth: number): PanelPresentation {
  if (windowWidth >= PANEL_DOCKED_FROM) return "docked";
  return windowWidth >= PANEL_RAIL_FROM ? "rail" : "dock";
}

/** Anchos de las zonas del shell en web (`w-sidebar` de tailwind.config.js, D2). */
export const SIDEBAR_WIDTH = 240;
export const PANEL_WIDTH = 360;
export const RAIL_WIDTH = 56;
/** Límites del ancho que el veterinario elige arrastrando el borde del panel. */
export const PANEL_MIN_WIDTH = 280;
export const PANEL_MAX_WIDTH = 560;

export function clampPanelWidth(width: number): number {
  if (!Number.isFinite(width)) return PANEL_WIDTH;
  return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.round(width)));
}

/** Ancho que le queda al contenido de la pantalla en web, según el panel (D2). */
export function contentWidthFor(
  windowWidth: number,
  expanded: boolean,
  panelWidth: number = PANEL_WIDTH,
): number {
  switch (presentationFor(windowWidth)) {
    case "docked":
      return windowWidth - SIDEBAR_WIDTH - (expanded ? panelWidth : RAIL_WIDTH);
    case "rail":
      return windowWidth - SIDEBAR_WIDTH - RAIL_WIDTH;
    default:
      return windowWidth;
  }
}

export type PanelStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type PanelState = {
  /** Panel acoplado expandido (≥ 1440 px) o colapsado a riel. */
  expanded: boolean;
  activeThread: string;
  /** Ancho del panel acoplado y del cajón, en px (acotado). */
  width: number;
  setExpanded: (expanded: boolean) => void;
  setActiveThread: (thread: string) => void;
  setWidth: (width: number) => void;
};

const DEFAULTS = { expanded: true, activeThread: "asistente", width: PANEL_WIDTH } as const;

function read(
  storage: PanelStorage | null,
): Pick<PanelState, "expanded" | "activeThread" | "width"> {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(PANEL_STORAGE_KEY) ?? "null");
    if (typeof parsed !== "object" || parsed === null) return { ...DEFAULTS };
    const { expanded, activeThread, width } = parsed as Record<string, unknown>;
    return {
      expanded: typeof expanded === "boolean" ? expanded : DEFAULTS.expanded,
      activeThread: typeof activeThread === "string" ? activeThread : DEFAULTS.activeThread,
      width: typeof width === "number" ? clampPanelWidth(width) : DEFAULTS.width,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** `storage` es `null` donde no hay almacenamiento (nativo): el estado dura la sesión. */
export function createPanelStore(storage: PanelStorage | null) {
  return createStore<PanelState>((set, get) => {
    const update = (patch: Partial<Pick<PanelState, "expanded" | "activeThread" | "width">>) => {
      set(patch);
      const { expanded, activeThread, width } = get();
      try {
        storage?.setItem(PANEL_STORAGE_KEY, JSON.stringify({ expanded, activeThread, width }));
      } catch {
        // Sin persistencia el estado dura la sesión: no es un error para el usuario.
      }
    };
    return {
      ...read(storage),
      setExpanded: (expanded) => update({ expanded }),
      setActiveThread: (activeThread) => update({ activeThread }),
      setWidth: (width) => update({ width: clampPanelWidth(width) }),
    };
  });
}

const deviceStorage = (): PanelStorage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const panelStore = createPanelStore(deviceStorage());

export const usePanelStore = <T>(selector: (state: PanelState) => T): T =>
  useStore(panelStore, selector);
