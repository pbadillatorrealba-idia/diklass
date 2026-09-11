# Guía de validación rápida

Esta guía valida el flujo universal de identidad y acceso en Expo para móvil y web. US11 se puede
validar de forma independiente; US12 se completa con las entidades de la spec 002.

## Prerrequisitos

- Bun 1.4.0 y Git.
- Docker ejecutándose para Supabase local.
- Expo CLI y, para móvil nativo, Xcode o Android Studio/emulador.
- Playwright instalado para el target web y Maestro CLI para los flows nativos.
- Dos cuentas sintéticas: `vet.ana@example.test` y `vet.bruno@example.test`.

## Preparación local

Desde la raíz:

```bash
bun install
bunx supabase start
cp .env.example .env
bunx supabase db reset
bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json
bun run start:web
```

Completa en `.env` la `SUPABASE_SERVICE_ROLE_KEY` que muestra `supabase status` antes de ejecutar
el provisioning. Esa clave es administrativa y no debe exponerse bajo un nombre `EXPO_PUBLIC_*`.

Para abrir el target nativo:

```bash
bunx expo start
```

Expo Go sirve para exploración temprana; los módulos nativos y la validación final deben usar un
development build. Los secretos administrativos solo viven en `.env` local o GitHub Secrets.

## Compuertas locales

```bash
bun run typecheck       # tsc --noEmit
bunx biome ci .
bun run test            # unitarias; las suites vivas se omiten sin SUPABASE_LIVE_TESTS
bunx supabase test db   # pgTap: RLS, triggers, expiración y atribución

# Playwright y las suites vivas leen el backend local desde el entorno:
set -a; . ./.env; set +a
SUPABASE_LIVE_TESTS=1 bun run test:integration   # requiere supabase start y provisioning
bun run test:e2e:web    # incluye la compuerta axe WCAG 2.2 AA
maestro test tests/e2e/native
```

La matriz web completa ejecuta Chromium, Firefox y WebKit. Los flows Maestro requieren un
development build instalado en un emulador/dispositivo Android o iOS.

## GitHub Actions

El workflow `.github/workflows/ci.yml` se ejecutará en pull requests y pushes a `main` cuando se
incorpore durante la implementación. Debe ejecutar `bun install --frozen-lockfile`,
`tsc --noEmit`, `biome ci`, `bun test`, pruebas Supabase local y Playwright web. Los builds EAS se
reservan para `main`, tags o una ejecución manual.

## Escenarios de validación

### 1. Acceso válido y cierre de sesión

1. Abrir el target web o nativo en `/login`.
2. Autenticar `vet.ana@example.test`.
3. Verificar que se muestra la identidad y que una operación protegida queda habilitada.
4. Cerrar sesión e intentar repetir la operación.

**Resultado esperado**: Ana queda identificada; después del logout, la navegación vuelve a login y
la operación protegida es rechazada por Supabase/RLS.

### 2. Error indistinguible de autenticación

Intentar login con contraseña incorrecta para una cuenta existente y con un identificador inexistente.

**Resultado esperado**: ambos intentos producen el mismo código y mensaje genérico, sin indicar si
falló el identificador o la contraseña.

### 3. Expiración y preservación del borrador

1. Autenticar a Ana y abrir una consulta.
2. Escribir contenido clínico sin guardarlo.
3. En el entorno de prueba, reducir el TTL o avanzar el reloj más allá del límite de inactividad.
4. Intentar guardar.
5. Volver a autenticarse en la misma plataforma y recuperar el borrador.

**Resultado esperado**: la operación expira y es rechazada; el contenido permanece en el storage de
la plataforma, no entra al historial, y puede guardarse tras reautenticación.

### 4. Denegación sin sesión y bypass de UI

Eliminar la sesión de Auth y llamar directamente a las operaciones SQL/API de prueba desde un
cliente no autenticado.

**Resultado esperado**: el 100% de las operaciones clínicas devuelve denegación; ocultar o mostrar
controles en Expo Router no altera el resultado de RLS. El mismo flujo se ejecuta en Playwright web
y en Maestro nativo.

### 5. Clínica compartida y atribución (cierre con spec 002)

1. En el contexto de Ana, registrar el paciente sintético.
2. En otro contexto como Bruno, listar el paciente y abrir una consulta.
3. Revisar los registros desde ambos contextos.
4. Intentar enviar `actorId` de Ana desde Bruno.
5. Intentar modificar atribución o un registro aprobado.

**Resultado esperado**: Bruno puede ver y atender el paciente; los triggers registran a los actores
reales; la suplantación no funciona; el original aprobado queda intacto y una corrección aparece como
registro adicional.

## Evidencia mínima

- `bun run typecheck`, `bunx biome ci .` y `bun test` en verde.
- Pruebas Supabase local de RLS, triggers y expiración.
- Playwright web en Chromium, Firefox y WebKit.
- Flows Maestro nativos en Android y iOS.
- Assertion del borrador restaurado en web y móvil.
- Registro de actor/momento original y evento correctivo separado.

Las reglas de sesión están en [`contracts/auth-session.md`](contracts/auth-session.md), la
atribución en [`contracts/clinical-attribution.md`](contracts/clinical-attribution.md) y las
entidades en [`data-model.md`](data-model.md).

## Estado de implementación de la PoC

La rama de implementación contiene el shell universal Expo, login provisionado, sesión de acceso
con TTL de ocho horas, borradores aislados por veterinario/consulta, RLS/triggers de atribución,
componentes gluestack-ui v3 sobre NativeWind, pantalla de consulta con borrador preservado, pruebas
Bun, pgTap de comportamiento, integración contra Supabase local y E2E web en la matriz completa con
la compuerta axe WCAG 2.2 AA.

- **Docker local**: `/var/run/docker.sock` apunta al socket *rootful* de podman, al que este
  usuario no tiene acceso; el socket *rootless* del propio usuario (`systemctl --user enable
  podman.socket` + `DOCKER_HOST=unix:///run/user/<uid>/podman/podman.sock`) sí funciona y quedó
  habilitado de forma persistente. Con eso, Supabase local corre igual en este entorno.
- **Bug de configuración corregido**: `supabase/config.toml` tenía `[auth.email] enable_signup =
  false` (pensado solo para bloquear autoregistro). En esta versión del CLI esa clave también
  gobierna `GOTRUE_EXTERNAL_EMAIL_ENABLED`, así que además deshabilitaba el login por
  contraseña — nadie pudo iniciar sesión nunca contra un `supabase start` limpio hasta este fix.
  Se corrigió a `enable_signup = true`; el bloqueo de autoregistro real sigue viviendo en que la
  app no expone pantalla de registro y un usuario auto-creado no tiene fila en
  `public.veterinarians`, así que no puede operar. Desde la fase 8 eso ya no descansa en un
  comentario: `tests/integration/auth/self-registration.test.ts` crea una cuenta con `signUp` y
  verifica que no puede iniciar una sesión de acceso, leer ni escribir registros clínicos, ni ver
  a los veterinarios.
- **Test de dos contextos (US12) implementado**: `tests/e2e/web/attribution.spec.ts` solo tenía
  un `test.skip` vacío (no verificaba nada). Se reemplazó por un test real: login de Ana y Bruno
  vía la UI, y verificación contra la API real (RLS/triggers) de que Bruno ve el registro de Ana,
  no puede crear uno a nombre de ella, y no puede modificar la atribución de uno existente.
  Nota para quien escriba más E2E web: `page.locator(...).fill()`/`pressSequentially()` no
  siempre disparan el `onChangeText` de los `TextInput` de React Native Web bajo carga; usar
  `click()` + `page.keyboard.type()` y verificar con `toHaveValue()`.
- **Matriz web (Chromium, Firefox, WebKit) contra backend real**: verificada localmente el
  2026-09-11 con Supabase local (vía podman) y los dos veterinarios sintéticos provisionados:
  pasan 39 de 39 pruebas (13 por motor, `--workers=1`), entre ellas la compuerta axe WCAG 2.2 AA,
  la expiración con restauración del borrador y el test de dos contextos. La intermitencia que
  antes se atribuía a la contención de recursos tenía una causa en la app: en WebKit, lo tecleado
  antes de que React hidratara la página estática se borraba. Con los campos del login de solo
  lectura hasta la hidratación, las dos pruebas afectadas pasan 10 de 10 repeticiones en WebKit
  (antes fallaba 1 de cada 3). El job `web-e2e` de CI ya levanta su propio Supabase, así que la
  pregunta que quedaba abierta está resuelta.
- **Pruebas SQL e integración (Supabase local)**: las 30 aserciones pgTap de comportamiento (tres
  archivos) y las 13 pruebas vivas de `tests/integration` pasan localmente. En CI ambas corren en
  el job `Supabase database tests`. La suite anterior, que solo comprobaba la existencia de
  objetos, pasó en el run `34475556811` del PR #2; la suite de comportamiento se valida por
  primera vez en CI con la PR de convergencia.
- **Flows Maestro nativos**: siguen sin ejecutarse, porque dependen de cuentas del equipo. El
  repositorio ya tiene lo que le corresponde: `eas.json` con el perfil `e2e`,
  `ios.bundleIdentifier`/`android.package` = `com.diklass.app` en `app.json`, y
  `.github/workflows/native-e2e.yml` corregido (`eas-cli` por su nombre de paquete, build local del
  APK y la acción oficial de Maestro Cloud fijada por SHA con `project-id`). Falta enlazar el
  proyecto EAS, registrar `EXPO_TOKEN`, `MAESTRO_CLOUD_API_KEY` y `MAESTRO_PROJECT_ID`, y
  habilitar un Supabase sintético alcanzable desde Maestro Cloud; los pasos están en
  [`tests/e2e/native/README.md`](../../tests/e2e/native/README.md). Hasta entonces el job termina
  con un aviso y no produce evidencia.
