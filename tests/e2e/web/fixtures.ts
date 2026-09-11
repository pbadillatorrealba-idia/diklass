import { test as base, expect, type Page } from "@playwright/test";

export const test = base;
export { expect };

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const hasBackend = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const BRUNO = { email: "vet.bruno@example.test", password: "synthetic-password-bruno" };

export const ANA = {
  email: "vet.ana@example.test",
  password: "synthetic-password-ana",
  displayName: "Dra. Ana Torres",
};

/**
 * React Native Web's TextInput does not reliably react to `.fill()`: a real click plus
 * keystrokes per field is what sticks, and `toHaveValue` waits for each one to land.
 */
export async function submitLogin(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/login");
  const emailField = page.getByLabel("Correo de acceso");
  const passwordField = page.getByLabel("Contraseña");
  // The fields stay read-only until React hydrates; keystrokes sent earlier would be lost.
  await expect(emailField).toBeEditable();
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
