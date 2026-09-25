## Why

La interfaz del PoC creció feature a feature sin una fuente visual común: colores fijos por
componente (`#0369a1`, `#0f172a`, `bg-white`), tamaños de texto y radios escritos a mano en cada
pantalla y un único color de estado (`destructive`) para expresar avisos, severidad y autoría. En un
CDSS eso no es cosmético: el veterinario tiene que distinguir de un vistazo lo que sugiere el
sistema de lo que validó un profesional, y un evento adverso grave de uno leve, en escritorio y en
tablet o móvil, con modo claro y oscuro y cumpliendo WCAG 2.2 AA (constitución, Restricciones de
Aplicación Web).

La rama `feat/tema-visual` ya implementó la base (tokens, fuente, modo oscuro y compuerta de
accesibilidad oscura) sin especificación previa. Este cambio la especifica tal como está y
planifica lo que falta, para que el código deje de ser el único registro de esas decisiones
(Principio I).

## What Changes

Implementado en `feat/tema-visual` (se documenta y se verifica; no se reescribe):

- Paleta de tokens semánticos (`background`, `foreground`, `card`, `popover`, `primary`,
  `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring` y sus `-foreground`)
  como canales RGB en `src/global.css`, con variante clara y oscura según `prefers-color-scheme`,
  expuesta a Tailwind/NativeWind en `tailwind.config.js`.
- Espejo `src/theme/colors.ts` + `useThemeColors()` para las props de color que no admiten
  `className`, y `tests/unit/theme/tema.test.ts`, que verifica la sincronía CSS↔TS y el contraste
  AA de cada par.
- Fuente Atkinson Hyperlegible Next (OFL 1.1) en 4 pesos: embebida en iOS/Android con el config
  plugin de `expo-font` (`app.json`, `assets/fonts/`), servida en web desde `public/fonts/` con
  `@font-face` y precargada en `src/app/+html.tsx`.
- Tema de navegación de Expo Router alineado con la paleta (`AppUiProvider`).
- `Button` con variantes `primary`/`outline` (el `OptionPicker` deja de fijar colores inline),
  `Input` con colores del tema y todos los primitivos de texto con `font-sans`.
- Indicador de foco `:focus-visible` global con el token `ring`.
- Proyecto Playwright `chromium-dark` que ejecuta la compuerta axe con el esquema oscuro.
- Skills de Expo para agentes en `.agents/skills/` y `.claude/skills/` (herramientas de desarrollo,
  sin efecto en tiempo de ejecución).

Pendiente (se planifica en este cambio):

- Rampa tipográfica con nombre (`title`, `section`, `subsection`, `body`, `caption`) y tono
  `muted` en `Text`; se eliminan `text-foreground/70` y los `text-*` sueltos.
- Tokens de estado `warning`, `success`, `info`; token `suggested` para el contenido generado por
  el sistema; escala visual de severidad clínica de 4 niveles (`leve`, `moderado`, `grave`,
  `critico`); token `scrim` para capas modales. Todos con par claro/oscuro verificado AA.
- Más separación visual entre `card` y `background` en modo claro (hoy 1.07:1).
- Primitivas `Screen`, `Card`, `Callout`, `SuggestedBlock`, `SeverityBadge` e `Icon`; tokens de
  dimensión (ancho de contenido, alto táctil mínimo, alto mínimo de área de texto) y regla de
  radios (control vs superficie).
- Iconografía con `@expo/vector-icons` (dependencia nueva, justificada en `design.md`).
- Layout adaptable por tamaño de ventana: una columna en compacto; dos columnas en la consulta en
  pantallas anchas.
- Migración incremental pantalla por pantalla y una prueba que impide la reintroducción de colores
  literales fuera del tema.

No hay cambios incompatibles de datos ni de API: el vocabulario `AdverseEventSeverity`
(`leve`/`moderado`/`grave`) no cambia.

## Capabilities

### New Capabilities

- `sistema-visual`: tema de tokens, tipografía, primitivas de UI, estados semánticos,
  distinción de autoría (sistema/profesional), severidad clínica e iconografía, con layout
  adaptable y conformidad WCAG 2.2 AA en claro y oscuro.

### Modified Capabilities

Ninguna. No existen capacidades base publicadas en `openspec/specs/`. Las features que hoy
presentan contenido del sistema (`base-conocimiento-trazable`, `captura-voz-anamnesis`) o
severidad (`retroalimentacion-clinica`) no cambian sus requisitos funcionales: solo adoptan las
primitivas de esta capacidad.

## Impact

- Código: `src/global.css`, `tailwind.config.js`, `src/theme/`, `src/components/ui/`, todas las
  pantallas de `src/app/(protected)/` y `(auth)/`, y los componentes de feature que hoy usan
  `text-foreground/70`, `bg-secondary/15`, `bg-accent/20` o estilos inline.
- Dependencias: `expo-font` (el config plugin ya se usaba; pasa a dependencia directa, antes solo
  transitiva) y `@expo/vector-icons` (nueva).
- Pruebas: `tests/unit/theme/`, compuerta axe en `tests/e2e/web/accessibility.spec.ts` (claro y
  oscuro) y una comprobación nueva de reflujo a 320 px.
- Dependencias de construcción: `identidad-y-acceso` (pantallas protegidas y diálogo de sesión).
  La adopción en las pantallas de 002–005 requiere que existan en la rama, pero no añade aristas al
  grafo: cada pantalla se migra cuando está presente.
- Aceptación conjunta: la distinción sistema/profesional (FR-076) y la severidad de 4 niveles
  (FR-077) se aceptan junto con las features que las presentan (003, 004, 005 y, a futuro, 006 y 007).

Estado: lo marcado como implementado existe en el árbol de trabajo de `feat/tema-visual`, pero aún
no está integrado ni aceptado.
