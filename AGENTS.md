# AGENTS.md

Guía común para agentes (Claude, Codex, Oh My Pi u otros) que trabajan en este repositorio.
Está subordinada a `docs/constitution.md`, que prevalece ante cualquier conflicto. El arranque del
entorno está en [README.md](README.md) y [SETUP.md](SETUP.md); aquí solo viven las reglas de trabajo.

## Antes de trabajar

1. En una funcionalidad, lee el cambio seleccionado bajo `openspec/changes/` (proposal, specs y,
   si existen, design y tasks) antes de tocar código o artefactos.
2. Lee las secciones relevantes de `docs/constitution.md` y `docs/brief-poc-cdss.md` cuando el
   cambio toque principios, producto, seguridad o datos clínicos; en un ajuste local basta con el
   cambio y este archivo.
3. Instala con `bun install --frozen-lockfile`: un `node_modules` desfasado produce errores de
   herramientas que no son del código.

## Carriles de trabajo

La constitución exime de especificación completa a los errores y a las tareas triviales; todo
lo demás sigue el flujo completo. Elige el carril más corto que corresponda:

| Carril | Cuándo | Qué se hace |
|---|---|---|
| Trivial | Typos, formato, actualización de dependencias | Rama, commit y PR; sin cambio OpenSpec ni prerrevisión; revisión por otra persona y CI. |
| Corrección de error | El código no cumple lo que ya dice la spec | Test de regresión que falle (Principio II), el arreglo mínimo y cierre de PR; sin cambio OpenSpec. |
| Funcionalidad | Comportamiento nuevo o que cambia | Cambio OpenSpec completo (`propose` → `apply` → `archive`) y cierre de PR. |

Si un arreglo o una actualización cambia el comportamiento previsto, deja de ser trivial o un error
y es una funcionalidad.

## OpenSpec

- `openspec/changes/` son las propuestas activas; `openspec/specs/` son las capacidades aceptadas y
  solo se actualiza con el sync de OpenSpec, nunca a mano.
- `design.md` es breve por defecto (orientación: ~1.500 palabras); uno más extenso se justifica con la
  complejidad que registra (Principio III).
- La deuda de tests se registra como tareas de un cambio activo, no como TODOs en el código. Solo
  se admiten omisiones condicionadas al entorno, como las suites vivas que requieren Supabase.

## Reglas

- Conserva los IDs globales de requisitos (FR-NNN), historias (US) y criterios (SC) en todo
  artefacto; no los renumeres ni reutilices IDs retirados.
- Las marcas de tareas, los checklists y los estados documentales acreditan revisión documental,
  no aceptación demostrada ni implementación. No archives un cambio sin la verificación que exige
  la constitución.
- Diferencia pendiente / implementado / aceptado en cada afirmación que escribas.
- Commits `tipo(ámbito): resumen` y ramas `tipo/descripcion`; las PR usan la plantilla de
  `.github/PULL_REQUEST_TEMPLATE.md`.
- Los artefactos se escriben en español; los encabezados y las palabras clave de OpenSpec (MUST,
  MUST NOT, Requirement, Scenario, GIVEN/WHEN/THEN) permanecen en inglés.
- No edites a mano `src/lib/supabase/database.types.ts` (usa `db:types`), `bun.lock` ni `.env`.
- No añadas scripts ni dependencias sin justificarlos conforme al Principio III.

## Seguridad y secretos

- **Falla cerrado.** Si falta configuración de autenticación, de RLS o de entorno, el sistema niega
  el acceso o se detiene con un error explícito; nunca queda abierto por omisión. Una variable
  olvidada en un despliegue no puede traducirse en datos clínicos expuestos.
- **Los atajos de desarrollo son explícitos.** Todo bypass (saltar un control, apuntar a un
  entorno remoto, sembrar datos) se activa a propósito con un flag o variable dedicada, avisa por
  consola cuando está activo y, si vive en el cliente, depende además de `__DEV__`. Ningún bypass
  se configura en un entorno accesible desde internet. Ejemplo:
  `provision:veterinarians` rechaza cualquier Supabase no local salvo que se pase `--allow-remote`.
- **Ningún secreto en el bundle.** Expo inlinea toda variable `EXPO_PUBLIC_*` en el cliente, así
  que solo puede llevar valores públicos (URL de Supabase y anon key). La
  `SUPABASE_SERVICE_ROLE_KEY` y cualquier clave de proveedor viven únicamente en scripts de
  servidor, en Edge Functions (`supabase/functions/`) y en los tests que preparan datos. Al
  cambiar una `EXPO_PUBLIC_*`, limpia la caché de Metro (ver `SETUP.md`).
- **`.env` nunca se commitea** ni se copian sus valores en issues, PRs, logs o artefactos. Toda
  variable nueva va a `.env.example` con un valor de ejemplo no sensible y se documenta en
  `SETUP.md`.
- **Los reportes de seguridad no se commitean.** `security-best-practices` y
  `security-threat-model` escriben sus informes fuera del repositorio, en español, y se comparten
  solo por el canal que indique el responsable.

## Sistema visual

Antes de crear o modificar UI, lee [docs/sistema-visual.md](docs/sistema-visual.md): sus reglas las
hacen cumplir `tema.test.ts` y la compuerta axe, y su justificación está en
`openspec/changes/archive/2026-10-26-sistema-visual/`. Ningún resultado de una skill puede
violarlas.

## Comandos

Bun es el runtime y package manager (versión en `.bun-version`). Los scripts completos están en
`package.json`; estos son los del flujo de trabajo:

| Comando | Descripción |
|---|---|
| `bun run typecheck` | `tsc --noEmit` sobre todo el proyecto. |
| `bunx biome ci --error-on-warnings .` | Biome en modo CI: los warnings también fallan. |
| `bun run gate` | `biome ci`, `tsc` y todos los tests, en secuencia y con tope de 3 GB si hay systemd. **Es la batería pesada**: `--changed` solo acota Biome. |
| `bun run test` | Tests unitarios y de integración. Sin Supabase, las suites vivas se omiten. |
| `bun run test:integration` | Solo integración; con `SUPABASE_LIVE_TESTS=1` y Supabase local ejecuta las suites vivas. |
| `bun run db:start` | `supabase start` sin los servicios que no usan los e2e (ahorra ~300 MB de RAM). |
| `supabase test db` | pgTap: RLS, triggers, caducidad de sesión y atribución. |
| `bun run db:types` | Regenera `src/lib/supabase/database.types.ts`; CI falla si difiere de las migraciones. |
| `bun run test:e2e:smoke` | Solo `login` y `navegacion` en Chromium: iteración rápida. |
| `bun --env-file=.env run test:e2e:web` | Playwright con gate WCAG 2.2 AA. Sin `--env-file` los escenarios con backend se omiten en silencio. Local: un worker y Chromium (`PLAYWRIGHT_ALL_BROWSERS=1` añade Firefox y WebKit). CI: Chromium en cada PR; Firefox y WebKit solo en `main`. |
| `bun run test:e2e:native` | Maestro sobre un build nativo; CI en `native-e2e.yml` (`main`, nightly y a demanda). |

La definición completa de CI está en `.github/workflows/ci.yml`; en cambios que solo tocan
`**.md`, `docs/**` u `openspec/**` CI no corre y no hay nada que ejecutar.

## Desarrollo ligero

La máquina de desarrollo tiene poca RAM: mientras se desarrolla se ejecuta lo mínimo que valida el
cambio y la batería completa se reserva para el cierre de la PR. Los e2e y las exportaciones corren
de uno en uno, con un solo worker.

| Cambio | Durante el desarrollo | Al cerrar la PR |
|---|---|---|
| Código en `src/` | `bunx biome check --write <rutas>` y `bun test <ruta>`; `bun run typecheck` solo si cambian tipos o firmas públicas | `bun run gate` |
| `src/theme/` o clases de UI | lo anterior y `tests/unit/theme/tema.test.ts` | `gate` y `bun run test:e2e:web -- --project=chromium` |
| Login o navegación | como mucho `bun run test:e2e:smoke` | `gate` y `test:e2e:web` |
| `supabase/migrations/` o `database.types.ts` | Biome, `supabase test db`, `db:types` y `typecheck`, sin gate completo | `gate`, `supabase test db` y `db:types` |
| `src/lib/supabase/`, autenticación o atribución | lo de «Código» y `SUPABASE_LIVE_TESTS=1 bun run test:integration` | `gate` y `SUPABASE_LIVE_TESTS=1 bun run test:integration` |
| Solo `**.md`, `docs/**` u `openspec/**` | nada | nada |

Lo pesado (`gate`, `test`, Playwright completo) se ejecuta solo al cerrar la PR, cuando la tabla lo
indica, si un fallo de CI no se reproduce con un test focalizado, o si el usuario lo pide. Al
declarar algo terminado, di qué se ejecutó y qué no: «verificado» solo cubre lo ejecutado.

## Cierre de una PR

Al terminar el trabajo, si el usuario no pidió abrir ni cerrar la PR, haz **una sola pregunta**:
«¿Cierro la PR?». Si ya la pidió, sigue sin preguntar. No ejecutes nada pesado antes de la
confirmación.

1. **Verificación, una vez**, según la columna «Al cerrar la PR» de «Desarrollo ligero».
2. **Si hay cambios de UI:** `impeccable` (`critique` o `audit`) antes de la prerrevisión.
3. **`requesting-code-review`** sobre la rama, **en paralelo con el paso 1** (el revisor no consume
   RAM); publica el reporte en español en la PR, como exige la plantilla, con la sección
   «Sobreingeniería» (criterio de ponytail). Se omite en el carril trivial y en cambios que solo
   tocan `**.md`, `docs/**` u `openspec/**` sin alterar requisitos. Es una prerrevisión de agente:
   la revisión por alguien distinto del autor que exige la constitución sigue siendo obligatoria.
4. **`receiving-code-review`:** aplica los comentarios que sean correctos técnicamente,
   verificando cada uno antes de implementarlo. Sin hallazgos: anótalo y sigue.
5. **Pregunta al usuario ante una decisión difícil:** sugerencias contradictorias entre sí o con la
   constitución, cambios de alcance o de diseño, hallazgos que exigen tocar migraciones o
   contratos, o una sugerencia que no se comparte. No las decidas en silencio ni ignores un
   hallazgo sin decirlo.
6. **Máximo 2 rondas** de revisión; si aún quedan hallazgos, para y pregunta. Repite la
   verificación solo sobre lo cambiado y resume qué se aplicó, qué se descartó y por qué.

## Worktrees

- Todos los worktrees viven en `.claude/worktrees/<nombre>` (ignorado por git). Créalos con
  `EnterWorktree` o con `git worktree add .claude/worktrees/<nombre> -b tipo/descripcion origin/main`;
  si la herramienta nombra la rama `worktree-<nombre>`, renómbrala a `tipo/descripcion` antes del
  primer push.
- No crees worktrees fuera del repo (por ejemplo `~/.omp/wt/`). Si una herramienta exige otra ruta,
  crea el worktree allí y enlázalo desde `.claude/worktrees/<nombre>` con `ln -s`.
- Un worktree no hereda `node_modules` ni `.env`. Si la rama no cambia dependencias, enlázalos en
  vez de reinstalar: `ln -s ../../../node_modules node_modules` y `ln -s ../../../.env .env`
  (ambos ignorados por git, symlink incluido). Ejecútalos dentro del worktree y, si este vive fuera
  del repo, usa rutas absolutas. Nunca ejecutes `bun install` en un worktree enlazado.
- Al integrar la rama, elimina el worktree (`git worktree remove .claude/worktrees/<nombre>`).

## Skills de agentes

- `.claude/skills/` es la fuente de las skills del proyecto; `.agents/skills/` es su espejo para
  Codex y Oh My Pi. Cualquier alta, baja o edición se aplica en ambos directorios en el mismo
  commit. Las diferencias de `openspec-*` e `impeccable` (invocación `/` frente a `$`, y `agents/`
  solo en `.agents`) son intencionadas.
- `security-best-practices` y `security-threat-model`: solo cuando se pidan expresamente.
- UI: `expo-native-ui` y `expo-router` para crearla; `impeccable` para evaluarla y pulirla.
  `sistema-visual` manda sobre ellas. No se usan `frontend-design` ni `expo-design-system` (ni la
  `expo-design-system` del plugin `expo` global).
- `impeccable` asesora, no dicta. La identidad visual es la de `sistema-visual`, el brief y la
  constitución; `DESIGN.md`, `PRODUCT.md` y `.impeccable/` la describen y están subordinados a ellos.
  Un cambio de identidad se propone por OpenSpec, nunca con un comando de impeccable.
  - Permitido: `critique`, `audit`, `polish`, `harden` y `document` (este solo para actualizar
    `DESIGN.md`).
  - Con confirmación del usuario y paso por OpenSpec: `bolder`, `colorize`, `overdrive`, `delight`,
    `typeset` y `shape` de una identidad nueva.
  - Sus subagentes (`impeccable-finish-reviewer` y `-documenter`, en `.claude/agents/`) solo se
    invocan desde esta skill. Solo se usa la copia del repo, no el plugin global.
  - El hook de `.codex/hooks.json` es informativo (no sustituye a `bun run gate`) y opt-in: solo
    corre si el binario ya está en `.agents/skills/impeccable/scripts/bin/` (ignorado por git).
    Instalarlo es una decisión explícita: es código de terceros; `scripts/impeccable context` lo
    descarga de `github.com/pbakaus/impeccable` y verifica su sha256.

## Ponytail

Ponytail (plugin global, modo `full`) gobierna **cuánto** se escribe: la menor solución que
funciona. No decide **qué** se hace ni **qué** se verifica. Precedencia ante conflicto:
constitución > este archivo > cambio OpenSpec > ponytail.

- **Lo que ponytail no puede recortar:** requisitos y criterios del cambio activo (cuentan como
  «pedido explícito»), los IDs FR/US/SC, validación en fronteras de confianza, fallo cerrado,
  accesibilidad, RLS y la verificación que exige la constitución.
- **OpenSpec:** en `propose` y `update-change` no propongas lo que nadie pidió y deja `design.md`
  para decisiones reales (ponytail acota el alcance, nunca quita un artefacto exigido); en
  `apply-change`, el mínimo código por tarea. Una simplificación con techo conocido lleva un
  comentario `ponytail:`, que no sustituye a la deuda de tests (sigue siendo una tarea). No
  interviene en `explore`, `sync-specs` ni `archive-change`.
- **`test-driven-development` sigue vigente** para toda funcionalidad y corrección; ponytail solo
  fija el tamaño (el test fallido más pequeño). Su excepción para «one-liners triviales» no aplica.
- **Revisión:** la sección «Sobreingeniería» de `requesting-code-review` es la única pasada de
  ponytail al cerrar una PR; no lances además `ponytail-review` ni `simplify`.
