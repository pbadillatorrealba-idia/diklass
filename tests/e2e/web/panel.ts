import { expect, type Page } from "@playwright/test";

/**
 * Abre un hilo del panel de asistente: desde su pestaña si el panel está acoplado y expandido, o
 * desde su icono del riel (que abre el cajón) si está colapsado o es un riel (1024–1439 px).
 */
export async function abrirHilo(page: Page, id: string) {
  const pestana = page.getByTestId(`assistant-thread-${id}`);
  const riel = page.getByTestId(`assistant-rail-${id}`);
  await expect(pestana.or(riel)).toBeVisible({ timeout: 15_000 });
  if (await pestana.isVisible()) {
    await pestana.click();
  } else {
    await riel.click();
  }
}
