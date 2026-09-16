# Maestro (e2e nativo)

Los flujos de esta carpeta (`auth.yaml`, `attribution.yaml`) se ejecutan sobre un build nativo
instalado. El `appId` es `com.diklass.app`, fijado en `app.json` (`ios.bundleIdentifier` y
`android.package`).

## Local

Con un development build instalado en un emulador o dispositivo y el backend apuntando al Supabase
local o al entorno sintético de integración:

```sh
bun run test:e2e:native
```

## CI (`.github/workflows/native-e2e.yml`)

Corre en push a `main`, cada noche y a demanda. Mientras falte cualquiera de los secretos, el job
termina con un aviso y no construye nada: no falla, pero **tampoco produce evidencia**.

Configuración única, que requiere las cuentas del equipo:

1. **Proyecto EAS** — hecho: el repositorio está enlazado a `@idia/diklass` (`extra.eas.projectId`
   y `owner` en `app.json`). `eas build --local` lo necesita para resolver las credenciales de firma.
2. **`EXPO_TOKEN`** — token de acceso creado en expo.dev, guardado como GitHub Secret.
3. **`MAESTRO_CLOUD_API_KEY`** y **`MAESTRO_PROJECT_ID`** — de Maestro Cloud, como GitHub Secrets
   (la acción v3 exige `project-id`).
4. **Backend sintético alcanzable** — los dispositivos de Maestro Cloud no llegan a un Supabase
   levantado dentro del runner. Crear un proyecto Supabase de integración con datos sintéticos,
   aplicar `supabase/migrations/`, provisionar `tests/fixtures/veterinarians.json` y guardar su URL
   y su anon key como variables de repositorio `E2E_SUPABASE_URL` y `E2E_SUPABASE_ANON_KEY`. La
   anon key es pública por diseño; la service-role key nunca entra en un build.

```sh
gh secret set EXPO_TOKEN
gh secret set MAESTRO_CLOUD_API_KEY
gh secret set MAESTRO_PROJECT_ID
gh variable set E2E_SUPABASE_URL
gh variable set E2E_SUPABASE_ANON_KEY
```

El perfil de build es `e2e` en `eas.json`: APK instalable para Android y build de simulador para
iOS. El job de CI construye Android; iOS requiere un runner macOS y queda para una ejecución
seleccionada.
