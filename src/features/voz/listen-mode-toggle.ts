import type { ListenModeApi } from "@/features/voz/use-listen-mode";

/**
 * Entrada única del botón «Modo de escucha» (FR-025 · US6-AC5: detener en CUALQUIER momento).
 * Con la captura activa el botón tiene prioridad de DETENER y jamás queda ocupado: la activación
 * resuelve en cuanto la sesión existe y la captura corre en segundo plano. Vive en módulo propio
 * —sin imports de React Native— para que la entrada de UI sea unit-testeable directamente.
 */
export async function toggleListenMode(
  api: ListenModeApi,
  setPending: (pending: boolean) => void,
): Promise<void> {
  if (api.state === "capturando") {
    await api.stop();
    return;
  }
  setPending(true);
  try {
    await api.start();
  } finally {
    setPending(false);
  }
}
