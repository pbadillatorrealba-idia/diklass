import { useCallback, useRef } from "react";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

export type ClinicalGuardOutcome = "ok" | "expired" | "error";

/**
 * Plomería común de toda mutación clínica de la interfaz (patrón de la pantalla de
 * consulta de la 001): bloquea sin identidad válida, abre el diálogo de sesión expirada
 * ante un error de autenticación y reporta el resto de fallos (Constitución IV). La
 * pantalla decide los mensajes de estado según el desenlace.
 *
 * Una operación con el mismo nombre que ya está en curso no se vuelve a ejecutar: el segundo
 * toque recibe el desenlace de la primera. Lo registrado es inmutable (D4), así que un doble
 * toque antes del siguiente render no puede duplicarlo.
 */
export function useClinicalGuard() {
  const accessState = useSessionStore((state) => state.accessState);
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);
  // shortcut: se deduplica por nombre, no por payload; si una pantalla lanza la misma operación con
  // datos distintos a la vez, la clave debe pasar a `operación + id`.
  const inFlight = useRef(new Map<string, Promise<ClinicalGuardOutcome>>());

  return useCallback(
    (operation: string, action: () => Promise<void>): Promise<ClinicalGuardOutcome> => {
      const running = inFlight.current.get(operation);
      if (running) {
        return running;
      }
      const outcome = (async (): Promise<ClinicalGuardOutcome> => {
        // Guardar sin identidad queda bloqueado: nada entra al historial sin una sesión activa.
        if (accessState !== "active") {
          openExpiredDialog();
          return "expired";
        }
        try {
          await action();
          return "ok";
        } catch (error) {
          if (isAuthenticationRequired(error)) {
            setAccessState("expired");
            openExpiredDialog();
            return "expired";
          }
          void captureClientError(errorReporter, { error, operation, requestId: makeRequestId() });
          return "error";
        }
      })().finally(() => inFlight.current.delete(operation));
      inFlight.current.set(operation, outcome);
      return outcome;
    },
    [accessState, openExpiredDialog, setAccessState],
  );
}
