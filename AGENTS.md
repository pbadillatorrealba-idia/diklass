# AGENTS.md

Guía común para agentes (Claude, Codex, Oh My Pi u otros) que trabajan en este repositorio.
Este archivo está subordinado a `docs/constitution.md`, que prevalece ante cualquier conflicto.
El arranque del entorno está en [README.md](README.md) y el detalle en [SETUP.md](SETUP.md); aquí
solo viven las reglas de trabajo.

## Antes de trabajar

1. Lee `docs/constitution.md` — autoridad normativa del proyecto.
2. Lee `docs/brief-poc-cdss.md` — documento canónico de producto.
3. Lee el cambio seleccionado bajo `openspec/changes/` (proposal, specs y, si existen, design y
   tasks) antes de tocar código o artefactos.
4. Comprueba que las dependencias locales coinciden con `bun.lock`
   (`bun install --frozen-lockfile`). Un `node_modules` desfasado produce errores de herramientas
   (por ejemplo, un esquema de `biome.json` que el CLI instalado no reconoce) que no son del código.

## openspec/changes/ frente a openspec/specs/

- `openspec/changes/`: propuestas activas. Cada cambio contiene su proposal, los deltas de
  especificación y, cuando correspondan, design y tasks. El contenido vive aquí hasta que se
  acepta y sincroniza.
- `openspec/specs/`: capacidades ya aceptadas y sincronizadas. Está vacío al inicio: ninguna
  capability está publicada todavía.
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
- **Tras cambiar cualquier `EXPO_PUBLIC_*`, limpia la caché de Metro** (`bun run start -- -c` o
  `bunx expo export --clear`). Metro cachea la transformación que inlinea el valor y, sin limpiar,
  el bundle sale con el valor anterior sin avisar.

## Sistema visual

El detalle y su justificación viven en el cambio `openspec/changes/sistema-visual/` (design.md).
Reglas para cualquier UI nueva o modificada:

- **Color:** solo tokens semánticos de `src/global.css` (claro y oscuro), vía clases
  (`bg-card`, `text-muted-foreground`, `border-warning`…). `src/theme/colors.ts` es su espejo
  para props que no aceptan `className` (`useThemeColors()`). Un token nuevo va en ambos y en
  `tests/unit/theme/tema.test.ts` con su par de contraste AA. Nunca hex, `rgb()`, paleta fija de
  Tailwind ni escalas numeradas de gluestack (`text-warning-700`): la guarda de ese test falla.
- **Primitivas** (`src/components/ui/`):
  - Pantalla: `Screen` (`width="wide"` solo para la consulta).
  - Superficie: `Card`.
  - Estado: `Callout tone="error|warning|success|info"`.
  - Contenido del sistema sin validar: `SuggestedBlock`.
  - Severidad clínica: `SeverityBadge`.
  - Iconos: `Icon` (`label` o `decorative`, obligatorio).
  - Persona: `Avatar` con iniciales; es decorativo, así que el nombre siempre va al lado como
    texto o como nombre accesible del control que lo contiene.
  - Calendario: `MonthCalendar` (`src/components/calendar/`), único punto de uso de
    `react-native-calendars`; recibe `CalendarEvent[]` (`src/features/agenda/`), nunca
    `markedDates` directamente.
- **Texto:** `Text variant="body|caption|label|strong"` y `tone`; títulos con
  `Heading level={1|2|3}`. Nada de `text-sm`/`text-xs` sueltos ni `text-foreground/70`. La
  variante `nav` (12 px) es exclusiva de las etiquetas de navegación.
- **Tema:** la preferencia (`system|light|dark`, por defecto `system`) se lee y cambia con
  `useThemePreference()`, y el esquema efectivo con `useColorScheme()` de
  `src/theme/use-color-scheme.ts`, nunca el de `react-native`. Un token nuevo va también en los
  bloques `:root.light`/`:root.dark` de `global.css`, que `tema.test.ts` compara con claro y
  oscuro.
- **Botones:** `primary` para la acción principal de la pantalla; `outline` para las
  secundarias y las acciones por fila; `ghost` para las terciarias; `destructive` solo para
  detener algo en curso.
- **Layout:** espaciado de la escala (`gap`/`p` 1, 2, 3, 4, 6, 8), `rounded-xl` para controles y
  superficies y `rounded-lg` para lo anidado, y dimensiones con nombre (`max-w-content`,
  `min-h-touch`, `min-h-textarea`), nunca valores arbitrarios `[…]`.
- **El color nunca es la única señal:** todo estado lleva texto o icono con nombre.

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
| `bun run format` | Formatea con Biome. | — |
| `bun run test` | Tests unitarios y de integración (`bun test`). Sin Supabase, las suites vivas se omiten. | Sí |
| `bun run test:integration` | Solo integración; con `SUPABASE_LIVE_TESTS=1` y Supabase local ejecuta las suites vivas. | Sí |
| `supabase test db` | pgTap: RLS, triggers, caducidad de sesión y atribución. | Sí |
| `bun run db:types` | Regenera `src/lib/supabase/database.types.ts` desde el Supabase local. CI falla si difiere de las migraciones. | Sí (diff) |
| `bun run provision:veterinarians` | Provisiona veterinarios sintéticos en el Supabase local. | Sí |
| `bun --env-file=.env run test:e2e:web` | Playwright (incluye el gate de accesibilidad WCAG 2.2 AA). Playwright corre con Node y no lee `.env` por sí solo: sin `--env-file`, los escenarios con backend se omiten en silencio. CI ejecuta `bun run test:e2e:web` y pasa las variables por `GITHUB_ENV`. | Sí |
| `bun run test:e2e:native` | Maestro sobre un build nativo instalado. | `main`, nightly y a demanda (Maestro Cloud) |

Antes de hacer push, reproduce al menos los pasos de CI que toca tu cambio: `typecheck`,
`biome ci --error-on-warnings` y `test`; si tocas migraciones, también `supabase test db` y
`db:types`. La definición completa está en `.github/workflows/ci.yml`.

No añadas scripts ni dependencias sin justificarlos conforme al Principio III de la constitución.

## Skills de agentes

- `.claude/skills/` es la fuente de las skills del proyecto; `.agents/skills/` es su espejo para
  Codex y Oh My Pi. Cualquier alta, baja o edición se aplica en ambos directorios en el mismo
  commit. Las skills `openspec-*` las genera OpenSpec por herramienta y pueden diferir entre ambos.
- Uso esperado:
  - `test-driven-development`: al implementar cualquier funcionalidad o corrección.
  - `systematic-debugging`: ante un bug, un test roto o un comportamiento inesperado, antes de
    proponer un arreglo.
  - `verification-before-completion`: antes de declarar algo terminado, hacer commit o abrir un PR.
  - `requesting-code-review` / `receiving-code-review`: al cerrar un bloque de trabajo y al
    procesar comentarios de revisión.
  - `security-best-practices` / `security-threat-model`: cuando se pida explícitamente una
    revisión de seguridad o un modelo de amenazas.
  - `playwright`: para automatizar el navegador desde terminal (depurar flujos de UI, capturas).
  - `frontend-design`: al crear o rediseñar UI.
  - `using-git-worktrees`: cuando un cambio necesita aislarse del espacio de trabajo actual.
  - `openspec-*`: flujo de propuestas, aplicación, sincronización y archivo de cambios.

## Idioma

El contenido de los artefactos se escribe en español; los encabezados y las palabras clave
estructurales de OpenSpec (MUST, MUST NOT, Requirement, Scenario, GIVEN/WHEN/THEN) permanecen en
inglés.
