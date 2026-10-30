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

El carril más corto que corresponda (la constitución exime de especificación completa a los errores
y a las tareas triviales). Si un arreglo o una actualización cambia el comportamiento previsto, es
una funcionalidad.

| Carril | Cuándo | Qué se hace |
|---|---|---|
| Trivial | Typos, formato, actualización de dependencias | Rama, commit y PR; sin cambio OpenSpec ni prerrevisión; revisión por otra persona y CI. |
| Corrección de error | El código no cumple lo que ya dice la spec | Test de regresión que falle (Principio II), el arreglo mínimo y cierre de PR; sin cambio OpenSpec. |
| Funcionalidad | Comportamiento nuevo o que cambia | Cambio OpenSpec completo (`propose` → `apply` → `archive`) y cierre de PR. |

## OpenSpec

- `openspec/changes/` son las propuestas activas; `openspec/specs/` son las capacidades aceptadas y
  solo se actualiza con el sync de OpenSpec, nunca a mano.
- `design.md` es breve por defecto (orientación: ~1.500 palabras); uno más extenso se justifica con la
  complejidad que registra (Principio III).
- La deuda de tests se registra como tareas de un cambio activo, no como TODOs en el código. Solo
  se admiten omisiones condicionadas al entorno, como las suites vivas que requieren Supabase.

## Reglas

- Conserva los IDs globales de requisitos (FR-NNN), historias (US) y criterios (SC) en todo
  artefacto, incluidas sus especializaciones por dominio; no los renumeres ni reutilices IDs retirados.
- Las marcas de tareas, los checklists y los estados documentales acreditan revisión documental,
  no aceptación demostrada ni implementación. Diferencia pendiente / implementado / aceptado en cada
  afirmación que escribas.
- Commits `tipo(ámbito): resumen` y ramas `tipo/descripcion`; las PR usan la plantilla de
  `.github/PULL_REQUEST_TEMPLATE.md`.
- Los artefactos se escriben en español; los encabezados y las palabras clave de OpenSpec (MUST,
  MUST NOT, Requirement, Scenario, GIVEN/WHEN/THEN) permanecen en inglés.
- No edites a mano `src/lib/supabase/database.types.ts` (usa `db:types`), `bun.lock` ni `.env`.

## Seguridad y secretos

Los principios (falla cerrado, secretos) están en la constitución; aquí lo operativo:

- Todo bypass de desarrollo se activa a propósito con un flag, avisa por consola y, en el cliente,
  depende de `__DEV__`; p. ej. `provision:veterinarians` rechaza un Supabase no local sin `--allow-remote`.
- Solo valores públicos en `EXPO_PUBLIC_*` (Expo los inlinea en el bundle); `SUPABASE_SERVICE_ROLE_KEY`
  y claves de proveedor solo en scripts de servidor, Edge Functions y tests. Al cambiar una
  `EXPO_PUBLIC_*`, limpia la caché de Metro (ver `SETUP.md`).
- `.env` nunca se commitea ni se copian sus valores en issues, PRs, logs o artefactos; toda variable
  nueva va a `.env.example` con un valor no sensible y a `SETUP.md`.
- Los reportes de `security-best-practices` y `security-threat-model` no se commitean: se escriben
  fuera del repositorio, en español.

## Comandos

Bun es el runtime y package manager (versión en `.bun-version`). Los scripts completos están en
`package.json`; estos son los del flujo de trabajo:

| Comando | Descripción |
|---|---|
| `bun run typecheck` | `tsc --noEmit` sobre todo el proyecto. |
| `bunx biome ci --error-on-warnings .` | Biome en modo CI: los warnings también fallan. |
| `bun run gate` | `biome ci`, `tsc` y todos los tests, en secuencia y con tope de 3 GB si hay systemd. **Es la batería pesada**: `--changed` solo acota Biome. |
| `bun run test` | Tests unitarios y de integración. Sin Supabase, las suites vivas se omiten. |
| `bun --env-file=test-results/backend.env run test:integration` | Integración viva en backend exclusivo de testing; el runner crea/limpia fixtures por archivo. |
| `bun run db:start` | `supabase start` sin los servicios que no usan los e2e (ahorra ~300 MB de RAM). |
| `supabase test db` | pgTap: RLS, triggers, caducidad de sesión y atribución. |
| `bun run db:types` | Regenera `src/lib/supabase/database.types.ts`; CI falla si difiere de las migraciones. |
| `bun run test:e2e:smoke` | Solo `login` y `navegacion` en Chromium: iteración rápida. |
| `bun --env-file=test-results/backend.env run test:e2e:web` | Playwright con gate WCAG 2.2 AA y fixtures aislados. Sin configuración `TEST_*` completa falla antes de escribir. Local: un worker y Chromium (`PLAYWRIGHT_ALL_BROWSERS=1` añade Firefox y WebKit). CI: Chromium en cada PR; Firefox y WebKit solo en `main`. |
| `bun run test:e2e:native` | Maestro sobre un build nativo; CI en `native-e2e.yml` (`main`, nightly y a demanda). |

La definición completa de CI está en `.github/workflows/ci.yml`; en cambios que solo tocan
`**.md`, `docs/**` u `openspec/**` CI no corre y no hay nada que ejecutar.

## Puertos de desarrollo

Usa `bun run start`, `web`, `start:web`, `android` o `ios`: el lanzador elige el primer puerto
libre entre **9701 y 9710**, en ese orden. Si todos están ocupados, informa el error; no inicia
otra instancia fuera del rango. No reutilices un servidor de otro worktree. Los e2e conservan
su puerto explícito independiente. Para una vista previa solicitada, deja el servidor en segundo
plano y comunica la URL elegida.

## Desarrollo ligero

La máquina de desarrollo tiene poca RAM: mientras se desarrolla se ejecuta lo mínimo que valida el
cambio; la batería pesada (`gate`, `test`, Playwright completo) se reserva para el cierre de la PR,
para un fallo de CI que no se reproduzca con un test focalizado o para cuando el usuario lo pida. Los
e2e y las exportaciones corren de uno en uno, con un solo worker.

| Cambio | Durante el desarrollo | Al cerrar la PR |
|---|---|---|
| Código en `src/` | `bunx biome check --write <rutas>` y `bun test <ruta>`; `bun run typecheck` solo si cambian tipos o firmas públicas | `bun run gate` |
| `src/theme/` o clases de UI | lo anterior y `tests/unit/theme/tema.test.ts` | `gate` y `bun run test:e2e:web -- --project=chromium` |
| Login o navegación | como mucho `bun run test:e2e:smoke` | `gate` y `test:e2e:web` |
| `supabase/migrations/` o `database.types.ts` | Biome, `supabase test db`, `db:types` y `typecheck`, sin gate completo | `gate`, `supabase test db` y `db:types` |
| `src/lib/supabase/`, autenticación o atribución | lo de «Código» y `bun --env-file=test-results/backend.env run test:integration` | `gate` y `bun --env-file=test-results/backend.env run test:integration` |
| Solo `**.md`, `docs/**` u `openspec/**` | nada | nada |

## Pruebas, depuración y verificación

- **Rojo primero** (Principio II, no negociable): la prueba se escribe antes del código y se observa
  fallar por la razón prevista; un error abre con una prueba de regresión que falle. Ponytail fija el
  tamaño, no el orden: una prueba mínima por comportamiento, sin suites por función ni fixtures que
  el caso no necesite. Las pruebas ejercen código real: se simula solo lo lento o externo, tras ver
  qué efectos tiene, y nunca se afirma sobre el propio mock.
- **Depuración:** reproduce, traza hacia atrás hasta la causa raíz, revisa todos los llamadores y
  corrige una sola vez donde confluyen; sin arreglos a ciegas. Tras 3 intentos fallidos, para y
  cuestiona el diseño. Espera condiciones, no `sleep`.
- **Sin evidencia fresca no hay afirmación de éxito:** ejecuta en el mismo mensaje el comando que la
  prueba y lee su salida y su código de salida («debería pasar» no cuenta). Una regresión se verifica
  en rojo y verde (al revertir el arreglo debe fallar). Si un subagente informa éxito, comprueba el
  diff. Al declarar algo terminado, di qué se ejecutó y qué no: «verificado» solo cubre lo ejecutado.

## Cierre de una PR

Al terminar el trabajo, si el usuario no pidió abrir ni cerrar la PR, haz **una sola pregunta**:
«¿Cierro la PR?». Si ya la pidió, sigue sin preguntar. No ejecutes nada pesado antes de la
confirmación.

1. **Verificación, una vez**, según la columna «Al cerrar la PR» de «Desarrollo ligero».
2. **Si hay cambios de UI:** `impeccable` (`critique` o `audit`) antes de la prerrevisión.
3. **`requesting-code-review`** sobre la rama, **en paralelo con el paso 1** (el revisor no consume
   RAM); publica el reporte en español en la PR, como exige la plantilla, con la sección
   «Sobreingeniería» (criterio de ponytail; ver «Coordinación de la prerrevisión»). Se omite en el carril trivial y en cambios que solo
   tocan `**.md`, `docs/**` u `openspec/**` sin alterar requisitos. Es una prerrevisión de agente:
   la revisión por alguien distinto del autor que exige la constitución sigue siendo obligatoria.
4. **Aplica los comentarios que sean correctos técnicamente,** verificando cada uno antes de
   implementarlo (ante un «implementa bien» algo, comprueba con grep que se usa de verdad); aplícalos
   de a uno y prueba cada cambio; sin agradecimientos de cortesía, y discrepa con argumentos
   técnicos. Sin hallazgos: anótalo y sigue.
5. **Pregunta al usuario ante una decisión difícil:** sugerencias contradictorias entre sí o con la
   constitución, cambios de alcance o de diseño, hallazgos que exigen tocar migraciones o
   contratos, o una sugerencia que no se comparte. No las decidas en silencio ni ignores un
   hallazgo sin decirlo.
6. **Máximo 2 rondas** de revisión; si aún quedan hallazgos, para y pregunta. Repite la
   verificación solo sobre lo cambiado y resume qué se aplicó, qué se descartó y por qué.

### Coordinación de la prerrevisión

`requesting-code-review` se usa tal cual (copia de superpowers 6.4.1, MIT, con su `LICENSE`); lo propio
del proyecto vive aquí.
El agente coordinador, no el reviewer, es quien:

- **Pasa al reviewer** `PLAN_OR_REQUIREMENTS` = la tarea de `openspec/changes/<cambio>/tasks.md`, y
  añade a su prompt: el reporte entero en español (símbolos, rutas y comandos sin traducir); una
  sección final «Sobreingeniería» solo sobre el diff, una línea por hallazgo
  `N. archivo:L<línea>: <etiqueta> qué recortar. Con qué se reemplaza.` con las etiquetas `delete`,
  `stdlib`, `native`, `reuse` (cita la ruta), `yagni` y `shrink`, cerrada con
  `neto: -<N> líneas posibles.` o `Ya está ajustado.`; que no marque como sobrante la validación en
  fronteras de confianza, el fallo cerrado, la accesibilidad, RLS ni un requisito del cambio, y que
  un test o `assert` mínimo es el piso; y que no escriba en GitHub.
- **Publica el reporte una sola vez**, sin pedir confirmación, incluso sin hallazgos. Lleva SHA base
  y revisado, alcance, verificaciones realmente ejecutadas y limitaciones, sin secretos. Resuelve la
  PR abierta de la rama con `gh pr list --repo <repo> --head <rama>` (nunca una inferida de otra
  rama; en forks, confirma el propietario). Si su HEAD difiere del SHA revisado, revisa de nuevo.
  Publica con `gh pr comment --body-file` (comentario, no aprobación), comprueba que existe y no lo
  dupliques. Sin PR todavía: conserva el reporte y publícalo al crearla, sin crearla solo para eso.
  Sin `gh`, permisos o red: entrega el reporte e indica que la publicación sigue pendiente.

## Worktrees

Viven en `.claude/worktrees/<nombre>` (ignorado por git), no fuera del repo. Rama `tipo/descripcion`
(renombra `worktree-<nombre>` antes del primer push). Si no cambian dependencias, enlaza desde
dentro del worktree `ln -s ../../../node_modules node_modules` y `ln -s ../../../.env .env`; nunca
`bun install` en uno enlazado. Al integrar la rama, `git worktree remove .claude/worktrees/<nombre>`.

## Skills de agentes

- `.claude/skills/` es la fuente de las skills del proyecto; `.agents/skills/` es su espejo para
  Codex y Oh My Pi. Toda alta, baja o edición se aplica en ambos en el mismo commit y
  `bun run check:skills` (también en `gate` y CI) falla si derivan: solo se admite la invocación
  (`/` frente a `$`) y las rutas; `openspec-*` e `impeccable` se regeneran con su herramienta y solo
  se vigilan sus archivos, nombre y descripción.
- Las skills genéricas (TDD, depuración, verificación, worktrees, `expo-*`) no se copian al repo: las
  reglas de trabajo viven en este archivo y las guías de Expo, en el plugin `expo`.
- `security-best-practices` y `security-threat-model`: solo cuando se pidan expresamente.
- UI: `impeccable` y sus estándares son la autoridad visual (`DESIGN.md`, `PRODUCT.md` y
  `.impeccable/`, que hacen cumplir `tema.test.ts` y la compuerta axe), subordinada a la constitución
  y al brief; un cambio de identidad se propone por OpenSpec. No se usan `frontend-design` ni
  `expo-design-system`. Solo se usa la copia de `impeccable` del repo: desactiva el plugin global
  (`claude plugin disable impeccable@impeccable`) para no duplicarla.
- Comandos de `impeccable` permitidos: `critique`, `audit`, `polish`, `harden` y `document`; cualquier
  otro (`bolder`, `colorize`, `overdrive`, `delight`, `typeset`, `shape`, `layout`, `live`...) solo con
  confirmación del usuario y paso por OpenSpec. Sus subagentes (`.claude/agents/impeccable-*`) se
  invocan solo desde esa skill.

## Ponytail

Ponytail (skill `ponytail` copiada de la 5.3.3 en ambos espejos; el plugin global añade los hooks de
modo siempre activo; para actualizarla, copia `skills/ponytail/` del plugin, modo `full`) fija **cuánto** se escribe, no **qué** se hace ni **qué** se
verifica. Precedencia: constitución > este archivo > cambio OpenSpec > ponytail.

- No recorta requisitos ni criterios del cambio activo, IDs FR/US/SC, validación en fronteras de
  confianza, fallo cerrado, accesibilidad, RLS ni la verificación que exige la constitución; el
  rojo primero sigue vigente aunque ponytail exima de prueba a lo trivial.
- Una simplificación con techo conocido lleva un comentario `shortcut: <techo>, <cuándo mejorar>` (ponytail 5.x;
  los `ponytail:` antiguos siguen vigentes), que no sustituye a la deuda de tests (sigue siendo una
  tarea). No interviene en `explore`, `sync-specs` ni `archive-change`.
- La sección «Sobreingeniería» de `requesting-code-review` es la única pasada de ponytail al cerrar
  una PR; no lances además `ponytail-review` ni `simplify`.
