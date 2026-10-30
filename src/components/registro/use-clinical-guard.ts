import { useCallback } from "react";
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
 */
export function useClinicalGuard() {
  const accessState = useSessionStore((state) => state.accessState);
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);

  return useCallback(
    async (operation: string, action: () => Promise<void>): Promise<ClinicalGuardOutcome> => {
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
    },
    [accessState, openExpiredDialog, setAccessState],
  );
}
