# SETUP

Guía del entorno de desarrollo. Para el arranque rápido, ver [README.md](README.md).

## Dependencias

La versión de Bun queda fijada en `.bun-version`, y `bun.lock` es la fuente de verdad de las
dependencias:

```bash
bun install --frozen-lockfile
```

Repite la instalación cada vez que `bun.lock` cambie (después de un pull o un merge). Si
`node_modules` queda desfasado, las herramientas fallan con errores que no vienen del código; por
ejemplo, Biome rechaza un `biome.json` escrito para una versión más nueva de su CLI.

## Variables de entorno

Copia `.env.example` a `.env`. `.env` está en `.gitignore` y no se commitea.

| Variable | Dónde se usa | ¿Pública? |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Cliente (bundle) | Sí |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Cliente (bundle) | Sí: la protegen las políticas RLS |
| `EXPO_PUBLIC_APP_ENV` | Reservada: la define `eas.json`, pero todavía no la lee el código | Sí |
| `SUPABASE_URL` | Scripts de servidor, tests de integración y e2e | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Scripts de servidor, tests de integración y e2e | **No**: nunca como `EXPO_PUBLIC_*` |
| `SUPABASE_LIVE_TESTS` | `bun run test:integration`: `1` activa las suites contra Supabase | — |
| `PLAYWRIGHT_BASE_URL` | Playwright (opcional) | — |

Expo inlinea toda variable `EXPO_PUBLIC_*` en el bundle: cualquier valor con ese prefijo es público.
**Después de cambiar una, limpia la caché de Metro**, o el bundle seguirá usando el valor anterior
sin avisar:

```bash
bun run start -- -c
bunx expo export --clear -p web     # al exportar
```

## Supabase local

```bash
supabase start           # levanta la pila local
supabase status -o env   # API_URL, ANON_KEY y SERVICE_ROLE_KEY para .env
supabase db reset        # aplica migraciones y seed.sql desde cero
supabase test db         # pgTap: RLS, triggers, caducidad de sesión y atribución
bun run db:types         # regenera src/lib/supabase/database.types.ts
```

En `.env`, `EXPO_PUBLIC_SUPABASE_URL` y `SUPABASE_URL` toman `API_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY` toma `ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` toma
`SERVICE_ROLE_KEY`, igual que en CI.

Después de tocar una migración, regenera los tipos y commitéalos: CI falla si
`database.types.ts` no coincide con las migraciones.

### Veterinarios sintéticos

```bash
bun run provision:veterinarians                                   # fixture por defecto
bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json
```

El script falla cerrado: rechaza cualquier `SUPABASE_URL` que no sea local, salvo que se pase
`--allow-remote` de forma explícita. No lo uses contra un entorno con datos reales.

## Tests

| Nivel | Comando | Requisitos |
|---|---|---|
| Unitarios e integración | `bun run test` | Ninguno; las suites vivas se omiten |
| Integración viva | `SUPABASE_LIVE_TESTS=1 bun run test:integration` | Supabase local y veterinarios provisionados |
| Base de datos | `supabase test db` | Supabase local |
| E2E web | `bun --env-file=.env run test:e2e:web` | Supabase local, veterinarios provisionados y navegadores de Playwright |
| E2E nativo | `bun run test:e2e:native` | Build nativo instalado; ver `tests/e2e/native/README.md` |

Playwright corre con Node, que no carga `.env`. Sin `--env-file=.env`, los escenarios de login y la
compuerta de accesibilidad con sesión se omiten y la ejecución sale verde sin haberlos probado.

## CI

`.github/workflows/ci.yml` se ejecuta en cada PR y en cada push a `main`:

- **Quality and types**: comprueba que `bun.lock` está sincronizado, `biome ci --error-on-warnings`
  (los warnings también fallan) y `typecheck`.
- **Unit and integration tests**: `bun run test`, sin Supabase.
- **Supabase database tests**: pgTap, diff de tipos generados e integración viva.
- **Web E2E**: Chromium en cada PR; Firefox y WebKit solo en push a `main`.
- **Dependency audit**: `bun audit`, con las excepciones justificadas en el propio workflow.

`.github/workflows/native-e2e.yml` ejecuta Maestro Cloud en push a `main`, cada noche y a demanda.
Si faltan sus secretos, termina con un aviso y sin producir evidencia.
