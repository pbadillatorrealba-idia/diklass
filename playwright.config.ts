import { defineConfig, devices, type PlaywrightTestProject } from "@playwright/test";

import { resolveTestConfig, resolveWebConfig } from "./tests/support/test-config";

const testConfig = resolveTestConfig(process.env);
const { webPort, baseURL } = resolveWebConfig(process.env);

const projects: PlaywrightTestProject[] = [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  { name: "webkit", use: { ...devices["Desktop Safari"] } },
  // The theme follows `prefers-color-scheme`: the WCAG gate also runs against the dark palette.
  {
    name: "chromium-dark",
    // El chat de voz también se verifica en oscuro (axe de sus estados, tarea 8.1).
    testMatch: ["accessibility.spec.ts", "chat-voz.spec.ts"],
    use: { ...devices["Desktop Chrome"], colorScheme: "dark" },
  },
];

export default defineConfig({
  testDir: "./tests/e2e/web",
  fullyParallel: true,
  // Una instancia de testing y un worker, también en CI.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer:
    process.env.TEST_WEB_SERVER_READY === "1"
      ? undefined
      : {
          command: `sh scripts/e2e-web-server.sh ${webPort}`,
          url: baseURL,
          env: {
            EXPO_PUBLIC_SUPABASE_URL: testConfig?.url ?? "",
            EXPO_PUBLIC_SUPABASE_ANON_KEY: testConfig?.anonKey ?? "",
            EXPO_NO_DOTENV: "1",
            // Evita reutilizar un backend horneado en una exportación anterior.
            E2E_CLEAR_CACHE: "1",
          },
          reuseExistingServer: false,
          timeout: 240_000, // incluye el export estático de la app
        },
  // Local: solo Chromium (con su variante oscura). Firefox y WebKit corren en CI al hacer push
  // a main; en local se piden con PLAYWRIGHT_ALL_BROWSERS=1.
  projects: projects.filter(
    (project) =>
      process.env.CI || process.env.PLAYWRIGHT_ALL_BROWSERS || project.name?.startsWith("chromium"),
  ),
});
