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
| `CORPUS_VET_EMAIL` / `CORPUS_VET_PASSWORD` | `scripts/cargar-corpus-conocimiento.ts`: veterinario sintético que incorpora el corpus | **No**: nunca como `EXPO_PUBLIC_*` |
| `EXPO_PUBLIC_VOZ_MODO` | `real` activa micrófono y transcripción reales en el modo de escucha; vacío usa el guion simulado | Sí |
| `EXPO_PUBLIC_VOZ_VENTANA_MS` | Duración de cada ventana de captura (por defecto 30 000 ms); acortarla baja la latencia | Sí |
| `OPENAI_API_KEY` | Solo en `supabase/functions/.env` (secreto de la función `transcribe-audio`) | **No**: nunca en `.env` del cliente ni como `EXPO_PUBLIC_*` |
| `E2E_CLEAR_CACHE` | `1` limpia la caché de Metro en el export del e2e (al cambiar de modo de voz) | — |
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

### Voz real (micrófono + transcripción)

`bun run db:start` ya levanta Storage (el audio de cada tramo vive en el bucket privado
`consultation-audio`). La transcripción usa la Edge Function `transcribe-audio` con OpenAI
`gpt-transcribe`; su clave va solo en un secreto de la función:

```bash
cp supabase/functions/.env.example supabase/functions/.env   # ignorado por git; pon OPENAI_API_KEY
supabase functions serve --env-file supabase/functions/.env  # sirve las funciones locales
```

Para usar la app con voz real, exporta `EXPO_PUBLIC_VOZ_MODO=real` (y limpia la caché de Metro). El
navegador solo da micrófono en `localhost` o HTTPS. Sin esa variable el modo de escucha usa el guion
simulado. Es un PoC con voces sintéticas: el audio sale a un tercero (OpenAI) y no hay política de
retención ni consentimiento formal todavía.

### Veterinarios sintéticos

```bash
bun run provision:veterinarians                                   # fixture por defecto
bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json
```

El script falla cerrado: rechaza cualquier `SUPABASE_URL` que no sea local, salvo que se pase
`--allow-remote` de forma explícita. No lo uses contra un entorno con datos reales.

### Clínica de demostración (datos de prueba)

```sh
bun run demo:check       # contratos, esquema y cobertura; sin DB ni PDF
bun run provision:demo   # veterinarios provisionados; 15 tutores, 25 mascotas y 8 consultas
bun run demo:reset       # BORRA TODA la base local; solo para una instancia desechable
```

El elenco de `scripts/demo/datos-demo.ts` usa nombres habituales en Chile y claves estables
independientes de nombres/posiciones: 17 perros y 8 gatos con ficha administrativa. Las ocho
consultas caninas incluyen tres cerradas, dos historias longitudinales, un borrador, seis entradas
de evolución (una correctiva) y una epicrisis correctiva adicional. Son relatos y aprobaciones
editoriales simulados por cuentas de prueba, sin decisiones automáticas del asistente ni
validación veterinaria del contenido.

`metadata-demo.ts` relaciona cada clave con fuente estructural, FR, escenario, prueba, autoría y
procedencia clínica. Los SHA-256/páginas de las fichas son referencias históricas: no se verifican
PDF localmente ni en CI. Los correos usan `@example.test`; teléfonos y RUT válidos inventados
pueden coincidir por azar con valores reales: no usarlos para contactar ni verificar identidades.

La carga pasa por las sesiones y servicios reales. Deja un manifiesto progresivo en
`test-results/demo/` (ignorado, modo 0600), con versión, revisión Git, huella del fixture y mapeo
clave → registro/eventos; no guarda contraseñas, RUT ni contactos. Puede elegirse otra ruta con
`bun run provision:demo -- --manifest <ruta>`. Para repetir, conservar el manifiesto original:
solo un grafo completo, idéntico y con auditoría intacta permite omitir escrituras. Si falta el
manifiesto pero hay datos previos, cambia la versión o queda una carga parcial, falla sin borrar
ni reanudar. Reconstruir requiere decidir expresamente que la base local es desechable. El bloqueo
remoto solo se levanta mediante `--allow-remote`, con aviso, para un backend sintético autorizado.

`demo:reset` comprueba que el CLI y el entorno apunten a la misma base local antes de reiniciar.
Solo tras un reset exitoso archiva el manifiesto activo como `.before-reset-<instante>` y carga
de nuevo. Con manifiesto personalizado, repetir su ruta: `bun run demo:reset -- --manifest <ruta>`.
No se retiran manifiestos durante una carga ordinaria ni se reinicia un destino remoto.

Las fechas de auditoría son las reales de carga; los intervalos del relato son simulados. No
se acreditan semanas transcurridas, agenda histórica ni eficacia clínica por cargar el demo.

Si cambia un contrato vigilado, `demo:check` falla con las rutas afectadas. Revisar datos y cobertura,
registrar motivo/requisitos afectados y actualizar explícitamente las huellas/inventario de
`scripts/demo/contratos-demo.json`; no renovarlas automáticamente para acallar la compuerta.
Los contratos vigilados y sus altas/bajas se enumeran en ese archivo; al crear una capacidad
clínica, ampliar inventario, matriz y filtros de `.github/workflows/dataset-demo.yml`. Ese workflow
cubre también cambios de especificaciones y corre sin Supabase. Pasar sus tests demuestra forma y
cobertura técnica, no aceptación clínica.

### Integración y e2e web con datos aislados

El dataset debe estar implementado antes de este ciclo. El runner utiliza sus plantillas, pero
crea una clínica y tres cuentas exclusivas por fixture de archivo/suite; las suites que comparten
`beforeAll` conservan ese alcance. Nombres visibles naturales, UUID y RUT nuevos por intento.
Una secuencia privada reserva bloques de 10.000 cuerpos de RUT por scope y un contador durable
impide reutilizarlos al reiniciar un worker. Al agotarse el bloque o el espacio reservado, falla
antes de crear un tutor; no vuelve a usar valores.

```sh
bun run test:backend:start
bun --env-file=test-results/backend.env run test:integration
bun --env-file=test-results/backend.env run test:e2e:smoke
bun --env-file=test-results/backend.env run test:e2e:web -- --project=chromium
bun --env-file=test-results/backend.env run test:backend:stop
```

El arranque deriva configuración/migraciones/seed/funciones/tests del repo en
`test-results/backend/`, proyecto `diklass-testing`, API 55321, DB 55322; nunca edita `.env` ni
configuración de desarrollo. Rechaza otro stack Supabase activo: detener desarrollo exige una
decisión explícita y debe volver a levantarse al terminar. `stop` conserva los volúmenes.
`test-results/backend.env` es privado (0600); no subirlo ni copiar sus valores a PR/logs.

Variables sobrescribibles: `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_DATABASE_URL`,
`TEST_SUPABASE_SERVICE_ROLE_KEY` y `TEST_SUPABASE_PROJECT_ID`, con ejemplos no sensibles en
`.env.example`. `E2E_WEB_PORT` controla servidor/navegación/espera (8083 por defecto). No hay
fallback a las variables de desarrollo. El runner verifica contenedores/puertos/credenciales,
marca privada de instancia y exclusión mutua en PostgreSQL antes de escribir. No admite remoto.

Las pruebas vivas se ejecutan mediante el runner; pedirlas sin configuración completa o sin
scope falla. Las unitarias normales siguen omitiendo integración viva. Puede elegirse un archivo,
por ejemplo `bun --env-file=test-results/backend.env run test:integration -- tests/integration/registro/epicrisis.test.ts`.
Los e2e aceptan nombres cortos y `--project=chromium|chromium-dark|firefox|webkit`; mantienen la
matriz de Playwright. Cada lote exporta una sola vez, limpia caché y dirige app/helpers al mismo
backend, sin inyectar claves privadas en el bundle.

Antes de provisionar o enviar escrituras se guardan raíces/identidades de recuperación en un
registro durable (fsync, 0600). Los recursos se reconcilian por padres propios e identidades
exactas, nunca por nombres. El teardown privado conserva el error original, elimina solo IDs
propios en orden de dependencias y verifica ausencia y centinelas. Auth, Storage, auditoría,
correctivas y cuotas por autor forman parte del grafo. Las RPC de borrado de conversación usan
cuentas exclusivas y un checkpoint previo registra los mensajes/rutas que elimina el producto.

Reportes sin contraseñas: `test-results/scopes/*.scope.json`, con versión/claves del dataset,
raíces, recursos, eliminaciones del producto/teardown, estado y residuos. Los archivos
`*.actors.json` contienen credenciales efímeras: no publicarlos. CI conserva solo reportes scope.
Ante SIGKILL queda intención pendiente, no se promete finally. Para recuperar:

```sh
bun --env-file=test-results/backend.env run test:recover -- test-results/scopes/<id>.scope.json
```

La recuperación exige la misma identidad durable de la base y verifica Docker/puertos actuales;
permite reiniciar contenedores conservando volúmenes, pero no adoptar una base distinta o resetada.
El siguiente runner bloquea scopes pendientes. No ejecuta reset para ocultar fallos de limpieza.
La prueba del propio ciclo se ejecuta fuera del runner para no anidar locks:
`TEST_LIFECYCLE_TESTS=1 bun --env-file=test-results/backend.env test tests/integration/testing/test-scope.test.ts`.

Maestro Cloud y `tests/e2e/native/` conservan su flujo y backend remoto. Por decisión explícita del usuario, la cuota global de observabilidad por IP se captura antes del
caso y se restaura por claves exactas bajo el lock del runner, solo en la DB de testing verificada.
El snapshot privado `*.quota.json` no se publica; el reporte acredita captura/restauración sin
buckets. No se cambia la función del producto ni se simula el endpoint real.

### Corpus inicial de la base de conocimiento

```bash
bun --env-file=.env scripts/cargar-corpus-conocimiento.ts
```

Incorpora `tests/fixtures/conocimiento/corpus-miedo.json` (la presentación «Problemas de miedo en
perros y gatos», de S. Le Brech, AWEC-UAB; licencia por confirmar) con la identidad de
`CORPUS_VET_EMAIL`/`CORPUS_VET_PASSWORD` (un veterinario ya provisionado; ambas variables son
obligatorias). Igual que el provisioning, falla cerrado: rechaza cualquier Supabase no local salvo
`--allow-remote`, y avisa por consola cuando ese flag está activo.

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

En local, Playwright corre con un worker y solo Chromium (`PLAYWRIGHT_ALL_BROWSERS=1` añade Firefox
y WebKit). La app se exporta una vez (`expo export`, pico de ~1,2 GB) y se sirve estática en vez de
mantener Metro; `E2E_DEV_SERVER=1` vuelve a `expo start`. En CI, Chromium corre dentro del job
`database` (un solo Supabase, tras un `db reset`) y las variables pasan por `GITHUB_ENV`.
`bun run gate` ejecuta `biome ci`, `tsc` y todos los tests en secuencia, con tope de 3 GB si hay
systemd; `--changed` solo acota Biome.

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
