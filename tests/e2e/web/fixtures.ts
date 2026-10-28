import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { resolveTestConfig } from "../../support/test-config";
import { checkpointConversation } from "../../support/test-network";
import { readTestActors } from "../../support/test-scope";

export const test = base;
export { expect };

const config = resolveTestConfig(process.env);
if (config && !process.env.TEST_SCOPE_FILE)
  throw new Error("Los e2e con backend requieren el runner aislado y TEST_SCOPE_FILE.");
export const SUPABASE_URL = config?.url;
export const SUPABASE_ANON_KEY = config?.anonKey;
export const SERVICE_ROLE_KEY = config?.serviceRoleKey;
export const hasBackend = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

base.beforeEach(async ({ page }) => {
  if (!SUPABASE_URL) return;
  await page.route(
    (url) =>
      url.origin === new URL(SUPABASE_URL).origin &&
      [
        "/rest/v1/rpc/delete_assistant_conversation",
        "/functions/v1/delete-assistant-conversation",
      ].includes(url.pathname),
    async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await checkpointConversation(route.request().url(), await route.request().allHeaders());
      const response = await route.fetch();
      await route.fulfill({ response });
    },
  );
});

const actors = readTestActors();
export const ANA = actors[0] as { email: string; password: string; displayName: string };
export const BRUNO = actors[1] as { email: string; password: string; displayName: string };

/**
 * React Native Web's TextInput does not reliably react to `.fill()`: a real click plus
 * keystrokes per field is what sticks, and `toHaveValue` waits for each one to land.
 */
export async function submitLogin(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/login");
  const emailField = page.getByLabel("Correo de acceso");
  const passwordField = page.getByLabel("Contraseña", { exact: true });
  // Se escribe con React ya hidratado (el botón se habilita entonces): así cada tecla pasa por
  // el estado del formulario (sistema-visual D16).
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
  await emailField.click();
  await page.keyboard.type(credentials.email, { delay: 15 });
  await expect(emailField).toHaveValue(credentials.email);
  await passwordField.click();
  await page.keyboard.type(credentials.password, { delay: 15 });
  await expect(passwordField).toHaveValue(credentials.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

export async function readSupabaseSession(
  page: Page,
): Promise<{ accessToken: string; userId: string }> {
  const raw = await page.evaluate(() => {
    const key = Object.keys(window.sessionStorage).find((candidate) =>
      candidate.includes("auth-token"),
    );
    return key ? window.sessionStorage.getItem(key) : null;
  });
  if (!raw) {
    throw new Error("No Supabase session was found in sessionStorage after login.");
  }
  const parsed = JSON.parse(raw) as { access_token?: string; user?: { id?: string } };
  if (!parsed.access_token || !parsed.user?.id) {
    throw new Error("Captured session is missing an access token or user id.");
  }
  return { accessToken: parsed.access_token, userId: parsed.user.id };
}

/**
 * Texto de un `Callout` sin el glifo de su icono: `@expo/vector-icons` pinta el icono como un
 * carácter de uso privado dentro del mismo nodo (sistema-visual FR-075).
 */
export async function calloutText(locator: Locator): Promise<string> {
  const text = (await locator.textContent()) ?? "";
  return text.replace(/[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/gu, "").trim();
}
