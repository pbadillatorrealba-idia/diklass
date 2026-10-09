import { defineConfig, devices, type PlaywrightTestProject } from "@playwright/test";

const projects: PlaywrightTestProject[] = [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  { name: "webkit", use: { ...devices["Desktop Safari"] } },
  // The theme follows `prefers-color-scheme`: the WCAG gate also runs against the dark palette.
  {
    name: "chromium-dark",
    testMatch: "accessibility.spec.ts",
    use: { ...devices["Desktop Chrome"], colorScheme: "dark" },
  },
];

export default defineConfig({
  testDir: "./tests/e2e/web",
  fullyParallel: true,
  // Equipo local con poca RAM: un worker. En CI cada shard ya corre en su propia máquina.
  workers: process.env.CI ? undefined : 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8083",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run web -- --port 8083",
    url: "http://127.0.0.1:8083",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  // Local: solo Chromium (con su variante oscura). Firefox y WebKit corren en CI al hacer push
  // a main; en local se piden con PLAYWRIGHT_ALL_BROWSERS=1.
  projects: projects.filter(
    (project) =>
      process.env.CI || process.env.PLAYWRIGHT_ALL_BROWSERS || project.name?.startsWith("chromium"),
  ),
});
