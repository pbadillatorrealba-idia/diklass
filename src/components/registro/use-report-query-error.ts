import { useEffect } from "react";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

/**
 * Efecto común de las pantallas que leen con `useQuery`: un error de autenticación abre el
 * diálogo de sesión expirada y el resto se reporta (Constitución IV). El aviso de carga lo
 * deriva cada pantalla del error vigente, así que desaparece al recuperarse.
 */
export function useReportQueryError(error: unknown, operation: string) {
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);

  useEffect(() => {
    if (!error) {
      return;
    }
    if (isAuthenticationRequired(error)) {
      setAccessState("expired");
      openExpiredDialog();
      return;
    }
    void captureClientError(errorReporter, { error, operation, requestId: makeRequestId() });
  }, [error, operation, openExpiredDialog, setAccessState]);
}
