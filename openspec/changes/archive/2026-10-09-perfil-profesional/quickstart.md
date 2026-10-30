# Quickstart y evidencia — perfil-profesional

Stack local con `DOCKER_HOST` apuntando a Podman; veterinarios con `bun run provision:veterinarians`.

## Evidencia (2026-10-09, local)

- `supabase test db`: 16 archivos, 299 pruebas verdes (incluye `014_perfil_profesional.sql` y la
  lista exacta de funciones con `execute` de `004_function_privileges.sql`).
- Unitarias de `src/features/perfil/schema.ts` y la integración viva
  (`SUPABASE_LIVE_TESTS=1 bun test tests/integration/perfil`): verdes, repetibles; el nombre de
  ANA se restaura al terminar.
- e2e web `perfil.spec.ts` + `auth.spec.ts` + `attribution.spec.ts` (Chromium): 14 verdes. Cubre
  el cambio visible en la barra sin recargar, el historial «Cambios de nombre», la validación con
  el texto conservado y axe WCAG 2.2 AA en claro y en oscuro.
- `database.types.ts`: la entrada de `update_own_profile` se añadió a mano; la salida cruda de
  `supabase gen types` no pasa por el formateador del repositorio (Biome ignora el archivo).
- No verificado: Firefox/WebKit y nativo.

## CI

El trabajo de perfil llegó a `main` junto con la rama `feat/sistema-visual-d20` (sin PR propia).
CI en verde sobre `main` en `07a1d7f`, que contiene los commits de perfil:

- CI: https://github.com/pbadillatorrealba-idia/diklass/actions/runs/37940389142
- Native E2E: https://github.com/pbadillatorrealba-idia/diklass/actions/runs/37940388774
