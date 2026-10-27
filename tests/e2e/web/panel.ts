import { expect, type Page, request } from "@playwright/test";
import { readSupabaseSession, SUPABASE_ANON_KEY, SUPABASE_URL } from "./fixtures";

/**
 * Abre un hilo del panel de asistente: desde su pestaña si el panel está acoplado y expandido con
 * varios hilos, desde su icono del riel (que abre el cajón) si está colapsado o es un riel
 * (1024–1439 px), o ya a la vista cuando es el único hilo (sin pestañas).
 */
export async function abrirHilo(page: Page, id: string) {
  const pestana = page.getByTestId(`assistant-thread-${id}`);
  const riel = page.getByTestId(`assistant-rail-${id}`);
  // El chat es el hilo de respaldo: siempre está, así que como único hilo ya está a la vista. Los
  // demás (p. ej. «escucha») se registran después de montar la pantalla: hay que esperar su pestaña
  // o su icono, no el contenedor, que aparece antes y haría volver sin abrir nada.
  const unico = id === "asistente" ? page.getByTestId("assistant-thread") : pestana;
  await expect(pestana.or(riel).or(unico).first()).toBeVisible({ timeout: 15_000 });
  if (await pestana.isVisible()) {
    await pestana.click();
  } else if (await riel.isVisible()) {
    await riel.click();
  }
}

/**
 * Vacía la conversación del chat de quien tiene la sesión abierta en `page`. El chat persiste, así que
 * las pruebas que dependen de «el primer mensaje» o de un conteo parten de una conversación vacía.
 */
export async function limpiarConversacion(page: Page) {
  const { accessToken } = await readSupabaseSession(page);
  const api = await request.newContext({
    baseURL: SUPABASE_URL,
    extraHTTPHeaders: {
      apikey: SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  try {
    await api.post("/rest/v1/rpc/delete_assistant_conversation", { data: {} });
  } finally {
    await api.dispose();
  }
  await page.reload();
}

/**
 * Deja aceptado el aviso de primer uso de la voz (el audio va a un proveedor externo) para quien tiene
 * la sesión abierta en `page`, o lo retira con `aceptado: false`. Retirarlo exige el service role: el
 * cliente solo puede aceptar, no editar ni borrar.
 */
export async function consentimientoDeVoz(page: Page, aceptado: boolean) {
  const { accessToken, userId } = await readSupabaseSession(page);
  const claveDeServicio = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const api = await request.newContext({
    baseURL: SUPABASE_URL,
    extraHTTPHeaders: {
      apikey: SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${aceptado ? accessToken : claveDeServicio}`,
      "Content-Type": "application/json",
    },
  });
  try {
    if (aceptado) {
      await api.post("/rest/v1/assistant_voice_consent?on_conflict=author_id,version", {
        data: { version: "v1" },
        headers: { Prefer: "resolution=ignore-duplicates" },
      });
    } else {
      await api.delete(`/rest/v1/assistant_voice_consent?author_id=eq.${userId}`, {
        headers: { apikey: claveDeServicio },
      });
    }
  } finally {
    await api.dispose();
  }
}
