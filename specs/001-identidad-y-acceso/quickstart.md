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
bun test
bun run test:integration
bun run test:e2e:web
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
