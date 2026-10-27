import { type ReactNode, useEffect, useId, useMemo } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

/**
 * Registro de hilos del panel (design.md D3): cada pantalla declara los hilos que ofrece con
 * `usePanelThreads` y el shell los pinta; al desmontar, su hilo desaparece.
 */
export type PanelThread = {
  id: string;
  label: string;
  /** Icono del riel (nombre de `Icon`); sin él se usa uno genérico. */
  icon?: string;
  element: ReactNode;
  /**
   * Estado compacto del hilo que el shell muestra aunque el panel esté colapsado (riel). Quien
   * declara el hilo es dueño de su estado; el shell solo lo pinta (design.md D8).
   */
  status?: (variant: "rail" | "dock") => ReactNode;
  /** Cuántas cosas del hilo esperan la confirmación del veterinario (borradores, propuestas). */
  pending?: number;
};

/** Hilo al que pasa el panel si el activo deja de estar disponible (spec «Hilos contextuales»). */
export const FALLBACK_THREAD = "conocimiento";

export type ThreadRegistryState = {
  // Un `Map` conserva el orden de la primera aparición de cada dueño.
  owners: ReadonlyMap<string, readonly PanelThread[]>;
  register: (owner: string, threads: readonly PanelThread[]) => void;
  unregister: (owner: string) => void;
  list: () => PanelThread[];
};

export function createThreadRegistry() {
  return createStore<ThreadRegistryState>((set, get) => ({
    owners: new Map(),
    register: (owner, threads) =>
      set(({ owners }) => ({ owners: new Map(owners).set(owner, threads) })),
    unregister: (owner) =>
      set(({ owners }) => {
        const next = new Map(owners);
        next.delete(owner);
        return { owners: next };
      }),
    list: () => [...get().owners.values()].flat(),
  }));
}

export function resolveActiveThread(active: string, available: readonly string[]): string {
  if (available.includes(active)) return active;
  if (available.includes(FALLBACK_THREAD)) return FALLBACK_THREAD;
  return available[0] ?? FALLBACK_THREAD;
}

const threadRegistry = createThreadRegistry();

/** Hilos registrados, en orden de aparición. */
export function usePanelThreadList() {
  // El selector devuelve `owners` (estable): uno que construyera un array nuevo en cada lectura
  // haría que `useSyncExternalStore` no se estabilizara nunca.
  const owners = useStore(threadRegistry, (state) => state.owners);
  return useMemo(() => [...owners.values()].flat(), [owners]);
}

/**
 * Declara los hilos de la pantalla. Se registra en cada render para que el elemento del hilo
 * siga a su estado; quien declara no se suscribe al registro, así que no hay bucle.
 */
export function usePanelThreads(threads: readonly PanelThread[]) {
  const owner = useId();
  useEffect(() => {
    threadRegistry.getState().register(owner, threads);
  });
  useEffect(() => () => threadRegistry.getState().unregister(owner), [owner]);
}
