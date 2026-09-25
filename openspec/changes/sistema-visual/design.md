## Context

La UI usa NativeWind 4.2 (Tailwind 3.4) sobre los primitivos locales de gluestack-ui v3 en
`src/components/ui/` (`Box`, `VStack`, `Text`, `Heading`, `Button`, `Input`, `FormControl`). Una
auditoría de la rama `feat/tema-visual` (2026-09-25) encontró:

- **Ya resuelto en la rama:** colores por token en todas las pantallas, sin hex ni paleta fija de
  Tailwind, salvo el `rgba(15, 23, 42, 0.55)` del diálogo de sesión. Contraste AA medido:
  destructive/card 4.96 (claro) y 4.54 (oscuro); input/card 3.29 y 3.10; ring/bg 3.05 y 4.01.
- **Deriva pendiente:**
  - `text-foreground/70` aparece 40 veces y `text-muted-foreground` ninguna.
  - Hay 27 `text-sm` y 11 `text-xs` escritos a mano junto a la prop `size`.
  - `Heading` ofrece 5 tamaños y se usan sobre todo `lg` (14 veces) y `2xl` (7).
  - Los radios mezclan `rounded-xl` (24) y `rounded-lg` (17) sin regla.
  - La tarjeta `rounded-xl border border-border bg-card p-4` se repite más de 30 veces.
  - `SafeAreaView style={{flex:1}}` + `ScrollView` con `padding: 24` + `max-w-[720px]` se
    repite en unas 10 pantallas.
  - En modo claro, card/background da 1.07:1 y border/background también: las tarjetas casi no
    se distinguen del fondo.
  - No hay iconos, ni estados warning/success/info, ni un tratamiento para el contenido generado
    por el sistema.

Decisiones de producto tomadas con el usuario el 2026-09-25: estados warning/success/info,
distinción sistema/profesional con borde lateral y etiqueta, severidad de 4 niveles, paleta y modo
automático sin cambios, iconos con `@expo/vector-icons` y layout adaptable según el caso
(escritorio y tablet/móvil).

## Goals / Non-Goals

**Goals:**
- Especificar y verificar lo ya implementado (D1–D3).
- Una sola rampa tipográfica, primitivas `Screen`/`Card`/`Callout`/`SuggestedBlock`/
  `SeverityBadge`/`Icon`, tokens de estado y una prueba que impida la deriva (D4–D10).
- Migrar todas las pantallas existentes sin cambiar su comportamiento funcional ni sus `testID`.

**Non-Goals:**
- Cambiar la marca, añadir un selector de tema o cambiar vocabularios de datos.
- Animaciones, hojas nativas o sustituir `Modal` por hojas. Queda fuera; el diálogo de sesión
  expirada es una confirmación consecuente y se mantiene como modal.
- Un catálogo visual (Storybook o similar).

## Decisions

### D1 — Fuente de verdad del color: variables CSS + espejo TS verificado (implementado)

Los tokens viven en `src/global.css` como canales RGB (`--primary: 24 122 106`), con el bloque
oscuro bajo `@media (prefers-color-scheme: dark)`. `tailwind.config.js` los expone como
`rgb(var(--x) / <alpha-value>)`, lo que permite opacidad (`bg-primary/15`). Las props de color que
no aceptan `className` (`placeholderTextColor`, el reset de `TextInput` en web y el tema de
navegación) leen `src/theme/colors.ts` mediante `useThemeColors()`. `tests/unit/theme/tema.test.ts`
compara ambos y mide el contraste de cada par. *Alternativa descartada:* un `theme.ts` como fuente
con Tailwind generado desde él; habría que generar CSS y se perdería el modo oscuro por media
query que NativeWind resuelve de forma nativa.

### D2 — Tipografía: Atkinson Hyperlegible Next (implementado)

Cuatro pesos (400/500/600/700), OFL 1.1.
- **iOS/Android:** embebidos con el config plugin de `expo-font` en `app.json`. Hay un solo
  nombre de familia, y en Android se declara el peso de cada archivo para que `font-semibold`
  resuelva sin síntesis.
- **Web:** `@font-face` con `font-display: swap` y `<link rel="preload">` de los cuatro pesos en
  `+html.tsx`, para evitar el salto de métrica del primer pintado (FR-073).

`fontFamily.sans` pone la familia primero; NativeWind en nativo usa solo esa.

### D3 — Navegación, foco y compuerta oscura (implementado)

- `AppUiProvider` pinta el tema de Expo Router con la paleta; en web deja el fondo transparente
  para que se vea `bg-background` desde el primer pintado.
- `:focus-visible` global con `--ring` (FR-080).
- El proyecto Playwright `chromium-dark` repite `accessibility.spec.ts` con
  `colorScheme: "dark"` (SC-050).

### D4 — Tokens nuevos y reglas de color

Cada estado de FR-075 recibe tres tokens: `{estado}` (borde/icono, ≥ 3:1 contra card),
`{estado}-surface` (fondo tintado) y `{estado}-foreground` (texto sobre la superficie, ≥ 4.5:1).
El estado `error` reutiliza `destructive` y añade solo `destructive-surface`.

| Token | Tono claro | Tono oscuro | Uso |
|---|---|---|---|
| `warning` | ámbar (≈ `accent` oscurecido) | ámbar | cobertura parcial, datos faltantes |
| `success` | verde distinto de `primary` | verde | guardado, aprobado |
| `info` | azul (≈ `secondary`) | azul | avisos neutros, severidad `leve` |
| `suggested` | violeta | violeta | borde de contenido del sistema (FR-076) |
| `scrim` | negro | negro | capa modal, usado como `bg-scrim/55` |

Los valores exactos se fijan en la tarea 2.2 con la prueba en rojo primero: se ajusta solo la
luminosidad hasta cumplir FR-072, igual que se hizo con la paleta base. `suggested` es violeta
porque debe diferenciarse del ámbar (warning y fragmento citado), del azul (`info` y atribución)
y del verde (`primary`/`success`).

**Separación card/fondo en modo claro:** `--background` baja a ≈ `238 242 241` y `--border` se
oscurece hasta ≥ 1.4:1 contra `card`. Son bordes decorativos: no tienen umbral WCAG propio,
porque el umbral de 3:1 aplica a los bordes de control (`input`). Todos los pares con
`background` se vuelven a verificar.

**Severidad (FR-077) sin tokens propios:** es una correspondencia dentro de `SeverityBadge`, no
un conjunto nuevo de tokens.

| Nivel | Estilo | Icono |
|---|---|---|
| `leve` | `info` tintado | `information-outline` |
| `moderado` | `warning` tintado | `alert-outline` |
| `grave` | `destructive` tintado + texto en negrita | `alert` |
| `critico` | `destructive` sólido con `destructive-foreground` | `alert-octagon` |

Así se evitan 4×3 tokens y la escala sigue siendo legible en escala de grises por icono,
etiqueta y relleno. El vocabulario de datos `AdverseEventSeverity` no cambia: `critico` solo se
muestra cuando una feature lo emita.

### D5 — Rampa tipográfica y tono

`Text` recibe dos props que reemplazan a `size`/`bold`:

- **`variant`:**
  - `body` → `text-base` (por defecto);
  - `caption` → `text-sm`;
  - `label` → `text-sm font-medium`;
  - `strong` → `text-base font-semibold`.
- **`tone`:** `default` | `muted` | `destructive` | `warning` | `success` | `info`. `muted`
  usa `text-muted-foreground`, lo que elimina `text-foreground/70`: su contraste ya está
  verificado (7.84 en claro y 4.75 en oscuro).

`Heading` recibe `level` (1–3), que asigna tamaño y nivel semántico: 1 → `text-2xl font-bold`
(título de pantalla), 2 → `text-xl font-semibold` (sección) y 3 → `text-lg font-semibold`
(subsección). Los 5 tamaños actuales caen en estos 3 niveles. `text-xs` desaparece: a 12 px la
lectura de metadatos clínicos se resiente, y `caption` (14 px) es el mínimo. Durante la migración
se conservan `size` y `bold` como alias deprecados; se eliminan en la tarea 6.3.

### D6 — Dimensiones, espaciado y radios

`tailwind.config.js` extiende:

- `maxWidth`: `content` (720 px, una columna de lectura) y `wide` (1200 px, consulta a dos
  columnas);
- `minHeight`: `touch` (44 px) y `textarea` (120 px).

Esto sustituye `max-w-[720px]`, `min-h-[44px]`, `min-h-[120px]` y `min-h-[96px]`.

**Espaciado:** se usa la escala de Tailwind (múltiplos de 4 px) limitada a `1, 2, 3, 4, 6, 8`
para `gap`/`p`. Se elimina `gap-1.5`. El margen de pantalla es `p-4` en compacto y `md:p-6` desde
768 px.

**Radios:** `rounded-xl` para controles y superficies de primer nivel (Button, Input, Card);
`rounded-lg` para elementos anidados dentro de una superficie (Callout, badges, fragmentos);
`rounded-full` para píldoras. Se elimina `rounded-2xl` (el diálogo pasa a `rounded-xl`).

**Sombras:** no se añaden. La jerarquía se expresa con superficie + borde.

### D7 — Primitivas nuevas en `src/components/ui/`

Todas usan composición por `children`, reciben `className` que se aplica al final (solo layout) y
mantienen los `testID` que les pasen.

| Primitiva | Reemplaza | Usos hoy |
|---|---|---|
| `Screen` | `SafeAreaView` + `ScrollView` + padding + `max-w` | ~10 pantallas |
| `Card` | `rounded-xl border border-border bg-card p-4 gap-2` | 30+ |
| `Callout` (`tone`, icono y título opcional) | avisos con `bg-*/15` o texto de color | `avisos-cobertura`, `missing-fields-panel`, estados de error de carga |
| `SuggestedBlock` | contenido del sistema sin marcar | `draft-facts-panel`, `segmento-respuesta` |
| `SeverityBadge` | severidad en texto plano | `adverse-event-report`, `feedback-timeline` |
| `Icon` | — | `Callout`, `SeverityBadge`, `SuggestedBlock` |

`Screen` acepta `width="content" | "wide"` y `scroll` (por defecto `true`). Toma el `<Head>` de la
pantalla como hijo y no lo gestiona.

`Card` no se usa para filas de listas densas dentro de otra tarjeta, para no caer en
*Everything's a Card*: las listas internas se separan con `gap` y un divisor.

`SuggestedBlock` pinta `border-l-4 border-suggested`, la etiqueta "Sugerencia del sistema" (icono
+ texto, `tone="muted"`) y un `accessibilityLabel` que antepone "Sugerencia del sistema:" (FR-076).
El contenido validado sigue usando `AttributionBadge`.

`Button` gana la variante `ghost`, para acciones terciarias como "Ver fuente", y la prop `size`
(`sm` | `md`). No se añade una variante `destructive` hasta que una pantalla la necesite.

### D8 — Iconografía: `@expo/vector-icons` (MaterialCommunityIcons)

Un solo conjunto, envuelto en `Icon`, que exige una de dos formas:

- `label`: el icono transmite información (`accessibilityLabel`, `role="img"`);
- `decorative`: el icono es decoración (`accessible={false}`, `aria-hidden`).

Así se cumple FR-078 por tipos. Se elige MaterialCommunityIcons porque cubre glifos clínicos
(`paw`, `pill`, `stethoscope`, `alert-octagon`, `robot-outline`) que MaterialIcons e Ionicons no
tienen completos. El tamaño se toma de la rampa (16/20/24).

### D9 — Layout adaptable

Se usan los breakpoints de Tailwind, que NativeWind resuelve también en nativo con el ancho de
ventana: `md` = 768 px (tablet) y `lg` = 1024 px (escritorio).

- **Compacto (< 768):** una columna, `p-4`, botones de ancho completo en acciones principales.
- **`md`:** una columna centrada en `max-w-content`, `p-6`.
- **`lg` en `/consultations/[id]`:** `Screen width="wide"` con dos columnas (`lg:flex-row`).
  - Principal (≈ 60 %): anamnesis, diagnóstico y epicrisis.
  - Lateral (≈ 40 %, `lg:sticky` en web): resumen de seguimiento, antecedentes, historial de
    correcciones y, cuando exista, la asistencia de 006.

  El orden del DOM se mantiene (principal primero) para el teclado y los lectores de pantalla.
- Las listas (pacientes, fuentes) siguen en una columna. A partir de `lg`, las tarjetas de
  paciente ponen la acción a la derecha (`lg:flex-row`) en vez de debajo.
- Se respeta el escalado de texto: nada de `allowFontScaling={false}` y las alturas son mínimas
  (`min-h-*`), no fijas.

### D10 — Prueba anti-deriva

`tests/unit/theme/sin-literales.test.ts` recorre `src/**/*.{ts,tsx}` (excepto `src/theme/`) y
falla ante `#[0-9a-f]{3,8}`, `rgba?(` y `(bg|text|border)-(slate|gray|red|…|white|black)` con
archivo y línea (FR-081, SC-051). Es Bun test puro, sin dependencias nuevas.

**Reflujo (FR-079, SC-052):** `accessibility.spec.ts` añade un caso que fija el viewport en
320×640, visita las rutas cubiertas y afirma
`document.documentElement.scrollWidth <= clientWidth`.

## Risks / Trade-offs

- **[Riesgo] El media query oscuro de `global.css` podría no resolverse en nativo con NativeWind
  4.2.** → La tarea 1.2 lo verifica en un build nativo o, si no hay dispositivo, lo deja como
  pendiente explícito en `quickstart.md`; el mecanismo alternativo es `vars()` + `useColorScheme`
  en `AppUiProvider`.
- **[Riesgo] La fuente de iconos pesa ~1.1 MB (ttf/woff).** → Presupuesto abajo; el icono siempre
  acompaña un texto o una etiqueta, así que una carga tardía no pierde información, y el glifo
  tiene caja fija (sin salto de maquetación).
- **[Trade-off] `critico` se define antes de que un dato lo emita.** → Por decisión de producto;
  cuesta una entrada en una tabla de correspondencia y ningún token (ver Complexity Tracking).
- **[Riesgo] La migración masiva rompe `testID` o selectores e2e.** → Las primitivas propagan
  `testID` y se migra una pantalla por tarea, con su suite e2e.
- **[Riesgo] Cambiar `--background` en claro altera pares ya verificados.** → `tema.test.ts`
  vuelve a medirlos todos. No se integra en rojo.

## Performance budgets

- Fuentes de texto en web: ≤ 100 KB en total en woff2 (hoy 80 KB en 4 archivos). Precarga solo
  de esos 4 archivos.
- Fuente de iconos: ≤ 1.2 MB, sin precarga; no bloquea el primer pintado.
- Sin salto de maquetación atribuible a la fuente de texto en el primer pintado (FR-073). Se
  verifica con la traza de rendimiento de Playwright en `/login`: CLS ≤ 0.1.

## Complexity Tracking

| Elemento | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| `@expo/vector-icons` (dependencia nueva) | FR-075/077/078: estado y severidad no pueden depender solo del color, y el texto solo es menos escaneable en pantallas densas. Es un paquete de Expo, versionado con el SDK 57 e instalable con `expo install` | Sin iconos, solo texto: cumple WCAG pero no el objetivo de reconocimiento rápido de US13. SVG propios: más código que mantener |
| `expo-font` (config plugin, ya presente) | FR-073: fuente embebida sin carga en tiempo de ejecución en nativo | `useFonts` en tiempo de ejecución: añade un estado de carga y un parpadeo |
| Espejo `src/theme/colors.ts` | Props de color que no aceptan `className` (D1) | Leer las variables CSS en tiempo de ejecución: no es posible en nativo |
| 6 primitivas nuevas | Cada una tiene ≥ 2 usos reales (tabla de D7) | Clases repetidas: 30+ copias con deriva ya medida |
| Nivel visual `critico` | Decisión de producto para 006/007; es una fila en `SeverityBadge` | Añadirlo con 006: aceptable, pero el usuario lo pidió ahora |

## Migration Plan

1. Completar tokens y primitivas con pruebas en rojo primero (tareas 2–3).
2. Migrar pantalla por pantalla (tarea 4), cada una con su e2e verde.
3. Retirar los alias deprecados (`size`/`bold` en `Text`, `size` en `Heading`) y activar la prueba
   anti-deriva sin excepciones (tarea 6).

Reversión: cada pantalla migra en su propio commit, así que se puede revertir por separado.

## Open Questions

- Valores exactos de `suggested`, `warning`, `success` e `info`: se proponen en la tarea 2.2 y se
  revisan visualmente con el usuario antes de migrar las pantallas.
- ¿El resumen de seguimiento va a la columna lateral o encabeza la principal en `lg`? Se decide en
  la revisión visual de la tarea 4.6.
