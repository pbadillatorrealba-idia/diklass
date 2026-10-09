# AGENTS.md

Guía común para agentes (Claude, Codex, Oh My Pi u otros) que trabajan en este repositorio.
Este archivo está subordinado a `docs/constitution.md`, que prevalece ante cualquier conflicto.
El arranque del entorno está en [README.md](README.md) y el detalle en [SETUP.md](SETUP.md); aquí
solo viven las reglas de trabajo.

## Antes de trabajar

1. Lee el cambio seleccionado bajo `openspec/changes/` (proposal, specs y, si existen, design y
   tasks) antes de tocar código o artefactos.
2. Lee `docs/constitution.md` (autoridad normativa) y `docs/brief-poc-cdss.md` (producto) cuando
   el cambio toque principios, producto, seguridad o datos clínicos, o ante cualquier duda; en un
   ajuste local basta con el cambio y las reglas de este archivo.
3. Comprueba que las dependencias locales coinciden con `bun.lock`
   (`bun install --frozen-lockfile`). Un `node_modules` desfasado produce errores de herramientas
   (por ejemplo, un esquema de `biome.json` que el CLI instalado no reconoce) que no son del código.

## openspec/changes/ frente a openspec/specs/

- `openspec/changes/`: propuestas activas. Cada cambio contiene su proposal, los deltas de
  especificación y, cuando correspondan, design y tasks. El contenido vive aquí hasta que se
  acepta y sincroniza.
- `openspec/specs/`: capacidades ya aceptadas y sincronizadas (se actualiza solo con el sync de
  OpenSpec, nunca a mano).
- La deuda de tests (casos pendientes o cobertura que falta) se registra como tareas de un cambio
  OpenSpec activo, no como TODOs sueltos en el código ni en comentarios. Omitir un test para
  obtener verde sigue prohibido; solo se admiten omisiones condicionadas al entorno, como las
  suites vivas que requieren Supabase.

## Reglas

- Conserva los IDs globales de requisitos (FR-NNN), historias (US) y criterios (SC) en todo
  artefacto; no los renumeres ni reutilices IDs retirados.
- No interpretes las marcas de tareas, checklists ni estados documentales como aceptación
  demostrada.
- No archives un cambio antes de completar la verificación que exige la constitución; los
  checklists acreditan revisión documental, no implementación.
- Diferencia pendiente / implementado / aceptado en cada afirmación que escribas.
- Commits `tipo(ámbito): resumen` en español y ramas `tipo/descripcion`; las PR usan la plantilla
  de `.github/PULL_REQUEST_TEMPLATE.md`.
- No edites a mano `src/lib/supabase/database.types.ts` (usa `db:types`), `bun.lock` ni `.env`.

## Seguridad y secretos

- **Falla cerrado.** Si falta configuración de autenticación, de RLS o de entorno, el sistema niega
  el acceso o se detiene con un error explícito; nunca queda abierto por omisión. Una variable
  olvidada en un despliegue no puede traducirse en datos clínicos expuestos.
- **Los atajos de desarrollo son explícitos.** Todo bypass (saltar un control, apuntar a un
  entorno remoto, sembrar datos) se activa a propósito con un flag o variable dedicada, avisa por
  consola cuando está activo y, si vive en el cliente, depende además de `__DEV__`. Ningún bypass
  se configura en un entorno accesible desde internet. Ejemplo de fallo cerrado:
  `provision:veterinarians` rechaza cualquier Supabase no local salvo que se pase `--allow-remote`.
- **Ningún secreto en el bundle.** Expo inlinea toda variable `EXPO_PUBLIC_*` en el código del
  cliente, así que solo pueden llevar valores públicos (URL de Supabase y anon key). La
  `SUPABASE_SERVICE_ROLE_KEY` y cualquier clave de proveedor viven únicamente en scripts de
  servidor, en Edge Functions (`supabase/functions/`) y en los tests que preparan datos.
- **`.env` nunca se commitea** ni se copian sus valores en issues, PRs, logs o artefactos. Toda
  variable nueva se añade a `.env.example` con un valor de ejemplo no sensible y se documenta en
  `SETUP.md`.
- **Los reportes de seguridad no se commitean.** Las skills `security-best-practices` y
  `security-threat-model` escriben sus informes fuera del repositorio (por ejemplo, en un
  directorio temporal), en español, y se comparten solo por el canal que indique el responsable.
- **Tras cambiar cualquier `EXPO_PUBLIC_*`, limpia la caché de Metro** (detalle en `SETUP.md`).

## Sistema visual

El catálogo completo (primitivas, texto, botones, ancho, desviaciones de `expo-native-ui`) está en
[docs/sistema-visual.md](docs/sistema-visual.md); su justificación, en `openspec/changes/sistema-visual/`.
Para cualquier UI nueva o modificada, estas reglas hacen fallar una guarda (`tema.test.ts`, axe):

- **Color solo con tokens semánticos** de `src/global.css` (clases `bg-card`, `border-warning`…) o
  `useThemeColors()` de `src/theme/colors.ts`. Nunca hex, `rgb()`, paleta fija de Tailwind,
  escalas numeradas (`text-warning-700`), `text-foreground/70` ni tintes `/N` salvo `scrim`.
  Un token nuevo va en `global.css` (también en los bloques `:root.light`/`:root.dark`), en
  `colors.ts` y en `tema.test.ts` con su par de contraste AA.
- **Texto** con `Text`/`Heading`; sin `text-xs` ni `text-sm` sueltos.
- **Layout:** `rounded-sm` (nunca `rounded-lg|xl|2xl`), sin `border-l-[2-8]`, espaciado de la
  escala y dimensiones con nombre (`max-w-content`, `min-h-touch`), nunca valores `[…]`.
- **Código:** `process.env.EXPO_OS` y no `Platform.OS`; `use` de React 19 y no `useContext`;
  `useColorScheme()` de `src/theme/use-color-scheme.ts`, no el de `react-native`.
- **Navegación:** `<Link href asChild>` con `Button` o `LinkText`; `router.push` solo tras una
  operación. La compuerta axe falla si un control de navegación tiene rol `button`.
- **El color nunca es la única señal:** todo estado lleva texto o icono con nombre.
- **Primitivas obligatorias:** `Screen`, `ScreenList` (nunca `.map` en un `ScrollView`),
  `QueryState` y `ProvenanceMark` para todo dato con procedencia (FR-097).

## Comandos

Usa los scripts ya definidos en `package.json` (Bun es el runtime y package manager; la versión
queda fijada en `.bun-version`). Las filas que no invocan un script de `package.json`
(`bun install`, `bunx biome`, `supabase test db`) son comandos directos de la herramienta:

| Comando | Descripción | En CI |
|---|---|---|
| `bun install --frozen-lockfile` | Instala exactamente lo que fija `bun.lock`. | Sí |
| `bun run start` | Servidor de desarrollo de Expo (Metro). | — |
| `bun run android` / `bun run ios` | Expo abriendo el emulador o simulador correspondiente. | — |
| `bun run web` | Expo en el navegador. | — |
| `bun run typecheck` | `tsc --noEmit` sobre todo el proyecto. | Sí |
| `bun run lint` | `biome check .` en local. | — |
| `bunx biome ci --error-on-warnings .` | Biome en modo CI: los warnings también fallan. | Sí |
| `bun run gate` | `biome ci`, `tsc` y todos los tests, en secuencia y con tope de 3 GB si hay systemd. **Es la batería pesada**: `--changed` solo acota Biome, no `tsc` ni los tests. Se usa al cerrar la PR (ver «Cierre de una PR»). | — |
| `bun run db:start` | `supabase start` sin los servicios que no usan los e2e (realtime, storage, studio, analytics…). Ahorra ~300 MB de RAM. | Sí |
| `bun run test:e2e:smoke` | Solo `login` y `navegacion` en Chromium: iteración rápida. | — |
| `bun run format` | Formatea con Biome. | — |
| `bun run test` | Tests unitarios y de integración (`bun test`). Sin Supabase, las suites vivas se omiten. | Sí |
| `bun run test:integration` | Solo integración; con `SUPABASE_LIVE_TESTS=1` y Supabase local ejecuta las suites vivas. | Sí |
| `supabase test db` | pgTap: RLS, triggers, caducidad de sesión y atribución. | Sí |
| `bun run db:types` | Regenera `src/lib/supabase/database.types.ts` desde el Supabase local. CI falla si difiere de las migraciones. | Sí (diff) |
| `bun run provision:veterinarians` | Provisiona veterinarios sintéticos en el Supabase local. | Sí |
| `bun --env-file=.env run test:e2e:web` | Playwright con gate WCAG 2.2 AA. Sin `--env-file` los escenarios con backend se omiten en silencio. Local: un worker y Chromium (`PLAYWRIGHT_ALL_BROWSERS=1` añade Firefox y WebKit); más detalle en `SETUP.md`. | Sí (Chromium en cada PR; Firefox y WebKit solo en `main`) |
| `bun run test:e2e:native` | Maestro sobre un build nativo instalado. | Workflow `native-e2e.yml`: `main`, nightly y a demanda (Maestro Cloud) |

Qué ejecutar y cuándo: ver «Desarrollo ligero» y «Cierre de una PR». La definición completa de CI
está en `.github/workflows/ci.yml`; en cambios que solo tocan `**.md`, `docs/**` u `openspec/**`
CI no corre y no hay nada que ejecutar.

No añadas scripts ni dependencias sin justificarlos conforme al Principio III de la constitución.

## Desarrollo ligero

La máquina de desarrollo tiene poca RAM: mientras se desarrolla, se ejecuta lo mínimo que valida
el cambio, y la batería completa se reserva para el cierre de la PR.

- **Durante el desarrollo** (cada iteración y cada commit):
  - Biome solo sobre lo tocado: `bunx biome check --write <rutas>`.
  - Tests: el archivo o directorio afectado (`bun test <ruta>`); si cambian `src/theme/` o las
    clases de UI, también `tests/unit/theme/tema.test.ts`.
  - `bun run typecheck` solo si cambian tipos o firmas públicas.
  - E2E: como mucho `bun run test:e2e:smoke`, y solo si el cambio toca login o navegación.
- **Lo pesado** (`bun run gate`, `bun run test`, Playwright completo) se ejecuta únicamente
  cuando: (1) se cierra la PR; (2) el cambio toca `supabase/migrations/` o `database.types.ts`
  (basta `supabase test db` + `db:types`, sin gate); (3) toca `src/lib/supabase/`, autenticación
  o atribución (añade `SUPABASE_LIVE_TESTS=1 bun run test:integration`); (4) un fallo de CI no se
  reproduce con un test focalizado; (5) el usuario lo pide.
- Los e2e y las exportaciones se ejecutan de uno en uno, con un solo worker.
- Ejemplos: un ajuste en un `Button` de `src/components/ui/` → Biome sobre el archivo y
  `tema.test.ts`; una migración con RLS → Biome, `supabase test db` y `db:types`; una función en
  `src/features/<x>` sin cambiar tipos públicos → `bun test` de ese directorio y Biome.
- Al declarar algo terminado, di qué se ejecutó y qué no. «Verificado» solo cubre lo ejecutado;
  `verification-before-completion` aplica a ese alcance.

## Cierre de una PR

Al terminar el trabajo, haz **una sola pregunta**: «¿Cierro la PR?». No ejecutes nada pesado
antes de la respuesta. Si el usuario confirma:

1. **Verificación, una vez.** Solo docs/openspec: ninguna (CI no corre). Código: `bun run gate`;
   con migraciones, además `supabase test db` y `db:types`; con autenticación o atribución,
   `SUPABASE_LIVE_TESTS=1 bun run test:integration`; con UI o navegación,
   `bun run test:e2e:web -- --project=chromium`.
2. **Si hay cambios de UI:** `impeccable` (`critique` o `audit`) antes de la revisión.
3. **`requesting-code-review`** sobre la rama; publica el reporte en español en la PR, como exige
   la plantilla. Es una prerrevisión de agente: la revisión por alguien distinto del autor que
   exige la constitución sigue siendo obligatoria.
4. **`receiving-code-review`:** aplica los comentarios, sugerencias y nitpicks que sean
   correctos técnicamente, verificando cada uno antes de implementarlo. Sin hallazgos: anótalo y
   sigue.
5. **Pregunta al usuario siempre que haya una decisión difícil:** sugerencias contradictorias
   entre sí o con la constitución, cambios de alcance o de diseño, hallazgos que exigen tocar
   migraciones o contratos, o una sugerencia que no se comparte. No decidas esos casos en
   silencio ni ignores un hallazgo sin decirlo.
6. **Máximo 2 rondas** de revisión; si aún quedan hallazgos, para y pregunta. Repite la
   verificación solo sobre lo cambiado y resume qué se aplicó, qué se descartó y por qué.

## Skills de agentes

- `.claude/skills/` es la fuente de las skills del proyecto; `.agents/skills/` es su espejo para
  Codex y Oh My Pi. Cualquier alta, baja o edición se aplica en ambos directorios en el mismo
  commit. Las skills `openspec-*` las genera OpenSpec por herramienta y pueden diferir entre ambos.
- Uso esperado:
  - `test-driven-development`: al implementar cualquier funcionalidad o corrección.
  - `systematic-debugging`: ante un bug, un test roto o un comportamiento inesperado, antes de
    proponer un arreglo.
  - `verification-before-completion`: antes de declarar algo terminado, hacer commit o abrir un PR,
    con el alcance de «Desarrollo ligero».
  - `requesting-code-review` / `receiving-code-review`: en el flujo de «Cierre de una PR».
  - `security-best-practices` / `security-threat-model`: cuando se pida explícitamente una
    revisión de seguridad o un modelo de amenazas.
  - `playwright`: para automatizar el navegador desde terminal (depurar flujos de UI, capturas).
  - `frontend-design` y las `expo-*` que quedan (`expo-native-ui`, `expo-router`,
    `expo-design-system`): al crear UI nueva; `impeccable` es para evaluarla y pulirla.
  - `impeccable`: asesora, no dicta. La identidad visual (D20) es la de `sistema-visual`, el
    brief y la constitución; `DESIGN.md`, `PRODUCT.md` y `.impeccable/` la describen y están
    subordinados a ellos. Un cambio de identidad se propone por OpenSpec, nunca con un comando
    de impeccable.
    - Permitido: `critique`, `audit`, `polish`, `harden` y `document` (este solo para actualizar
      `DESIGN.md`). Se usa en el cierre de una PR que toque UI.
    - Con confirmación del usuario y paso por OpenSpec: `bolder`, `colorize`, `overdrive`,
      `delight`, `typeset` y `shape` de una identidad nueva.
    - Sus subagentes (`.claude/agents/`: `impeccable-finish-reviewer`, `-documenter`,
      `-asset-producer`, `-manual-edit-applier`) solo se invocan desde esta skill.
    - El hook de `.codex/hooks.json` revisa los cambios de UI tras cada edición; es informativo
      y no sustituye a `bun run gate`. No hay hook de cierre de turno versionado; los hooks de
      Claude son configuración local (`.claude/settings.local.json`, ignorado por git).
    - Ningún resultado puede violar las reglas de «Sistema visual» ni `tema.test.ts`.
  - `using-git-worktrees`: cuando un cambio necesita aislarse del espacio de trabajo actual.
  - `openspec-*`: flujo de propuestas, aplicación, sincronización y archivo de cambios.

## Idioma

El contenido de los artefactos se escribe en español; los encabezados y las palabras clave
estructurales de OpenSpec (MUST, MUST NOT, Requirement, Scenario, GIVEN/WHEN/THEN) permanecen en
inglés.
