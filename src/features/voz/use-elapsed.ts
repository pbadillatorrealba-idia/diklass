import { useEffect, useState } from "react";
import type { ListenModeState } from "@/features/voz/listen-mode-controller";

/**
 * Tiempo transcurrido de la captura, `mm:ss` (sistema-visual «Escucha siempre visible»). La lógica
 * es pura y recibe el reloj para probarla; el hook solo la conecta con un temporizador.
 */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Instante de inicio: se fija al pasar a `capturando`, se conserva y se limpia en cualquier otro estado. */
export function startedAtFor(
  previous: number | null,
  state: ListenModeState,
  now: number,
): number | null {
  if (state !== "capturando") return null;
  return previous ?? now;
}

export function elapsedSince(startedAt: number | null, now: number): string {
  return startedAt === null ? "00:00" : formatElapsed(now - startedAt);
}

/**
 * Reloj de la captura. El instante de inicio es de la captura (`ListenModeApi.startedAt`), no de
 * quien lo muestra: el riel y la cinta se montan cuando el panel se colapsa o la hoja se cierra,
 * con la captura ya en curso, y deben seguir contando desde su inicio y no desde cero.
 */
export function useElapsed(startedAt: number | null, clock: () => number = Date.now): string {
  const [now, setNow] = useState(() => clock());

  useEffect(() => {
    if (startedAt === null) return;
    setNow(clock());
    const timer = setInterval(() => setNow(clock()), 1000);
    return () => clearInterval(timer);
  }, [startedAt, clock]);

  return elapsedSince(startedAt, now);
}
