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

**Segunda revisión (2026-09-25)**, con las guías `expo-native-ui` y `expo-router`, tras completar
los grupos 1–4:

- **Navegación:** no hay navegación global. `src/app/_layout.tsx` y `(protected)/_layout.tsx`
  usan `Stack` con `headerShown: false`, así que no hay barra lateral, pestañas ni cabecera. En
  iOS, una pantalla de detalle no tiene retroceso. `/home` enlaza a Pacientes y Conocimiento con
  botones, y `/follow-up` no tiene entrada.
- **Enlaces:** la navegación usa `router.push` dentro de `Button`, así que el lector de pantalla
  la anuncia como botón y en web no hay `href`.
- **Estados de datos:** `/knowledge/sources` no muestra carga, error ni vacío, y `/follow-up` no
  tiene vacío. Las listas se construyen con `.map` dentro del `ScrollView` de `Screen`.
- **Texto:** ningún `Text` es `selectable`.
- **Estilo de código:** `Platform.OS` aparece en 4 sitios y `useContext` en 4.
- **Compuerta 5.2 (dos fallos reales):**
  - En `chromium-dark`, `muted-foreground` sobre `bg-secondary/15` da 3.77:1 (historial de
    correcciones); las mismas mezclas con `primary/15` y `accent/20` dan 3.39 y 3.36.
  - En `firefox`, el `ScrollView` de `Screen` (un `div` con `overflow: auto`, que Firefox hace
    enfocable) recibe foco sin indicador, porque la regla `:focus-visible` de `global.css` solo
    cubre elementos con `tabindex` o con rol interactivo.

Decisiones del usuario: navegación **adaptable** (barra lateral en escritorio, pestañas en
compacto y nativo) y todas las mejoras de `expo-native-ui` **dentro de este cambio**.

## Goals / Non-Goals

**Goals:**
- Especificar y verificar lo ya implementado (D1–D3).
- Una sola rampa tipográfica, primitivas `Screen`/`Card`/`Callout`/`SuggestedBlock`/
  `SeverityBadge`/`Icon`, tokens de estado y una prueba que impida la deriva (D4–D10).
- Migrar todas las pantallas existentes sin cambiar su comportamiento funcional ni sus `testID`.
- Navegación global adaptable, cabeceras con retroceso, enlaces para navegar, cuatro estados de
  datos, listas virtualizadas, texto copiable y formularios compatibles con el teclado (D12–D15),
  sin cambiar las URLs.

**Non-Goals:**
- Previsualizaciones de enlace y menús contextuales (`Link.Preview`, `Link.Menu`), transiciones de
  zoom y hápticos. Son mejoras exclusivas de iOS o añaden una dependencia (`expo-haptics`) sin
  requisito que las pida.
- Búsqueda en la cabecera (`Stack.SearchBar`): no hay requisito de búsqueda.
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
- **Corrección (tarea 5.6):** la regla `:focus-visible` se amplía a cualquier elemento enfocable,
  en vez de enumerar selectores. Así cubre los contenedores de desplazamiento que Firefox hace
  enfocables (el `ScrollView` de `Screen`). No se les quita el foco (`tabindex="-1"`): desplazar
  con el teclado un contenedor sin controles es el comportamiento accesible esperado.

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

**Superficies tintadas sin transparencia (corrección de la tarea 5.5).** Los tintes `bg-x/NN`
componen el color en tiempo de pintado, así que `tema.test.ts` no puede medirlos. En oscuro,
`muted-foreground` queda en 3.36–3.78:1 sobre ellos, y ni un tinte del 6 % sobre `card` llega a
4.5:1 con el valor oscuro actual (4.18–4.35, medido).

- **Tokens nuevos (canales opacos):**
  - `primary-surface`: evidencia documental y fragmento citado.
  - `secondary-surface`: dato de la ficha.
  Cada uno se deriva como mezcla fija del ~8–12 % sobre `card` y se escribe en claro y en oscuro.
- **Ajuste de paleta:** se sube la luminosidad de `muted-foreground` en oscuro. Es el único cambio
  de paleta, solo de luminosidad y sin cambio de tono, hasta que cumpla ≥ 4.5:1 sobre `card`,
  `muted`, `background` y las dos superficies nuevas.
- **`AttributionBadge`:** pasa a `bg-muted`, porque la atribución es un metadato neutro y no un
  origen.
- **Regla nueva:** toda superficie que pueda alojar `tone="muted"` entra en `PAIRS` con
  `muted-foreground` y con `foreground`.
- **Guarda de D10:** prohíbe `bg-<token>/<n>` salvo `bg-scrim/<n>`, que no aloja texto.

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

- `maxWidth`: `content` (720 px, una columna de lectura), `wide` (1200 px, consulta a dos
  columnas), `dialog` (440 px, diálogos) y `form` (480 px, formulario de acceso);
- `width.sidebar` (240 px, barra lateral de navegación en `lg`, D12);
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

`SuggestedBlock` pinta `border-l-4 border-suggested` y, como primer hijo, la etiqueta visible
"Sugerencia del sistema" (icono decorativo + texto `tone="muted"`), de modo que se lee antes que
el contenido en todas las plataformas; el contenedor es un `role="group"` con ese nombre. Un
`aria-label` sobre un contenedor sin rol lo ignoran los lectores de pantalla (FR-076).
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
- **`lg` en `/consultations/[id]`:** `Screen width="wide"` con dos columnas.
  - Principal (`lg:flex-1`): anamnesis, diagnóstico y epicrisis.
  - Lateral (`lg:w-2/5`): resumen de seguimiento, historial de correcciones y, cuando exista, la
    asistencia de 006 (decisión del usuario).

  La lateral va **primero en el DOM**, como iba el resumen antes de la migración: en móvil da el
  contexto antes del registro. En escritorio `lg:flex-row-reverse` la muestra a la derecha. Es de
  solo lectura, así que el orden de foco del teclado sobre los controles del registro no cambia.
- El ancho de las listas y los paneles en escritorio lo fija D18. A partir de `lg`, las tarjetas
  de paciente ponen la acción a la derecha (`lg:flex-row`) en vez de debajo.
- Se respeta el escalado de texto: nada de `allowFontScaling={false}` y las alturas son mínimas
  (`min-h-*`), no fijas.

### D10 — Prueba anti-deriva

`tests/unit/theme/sin-literales.test.ts` recorre `src/**/*.{ts,tsx}` (excepto `src/theme/`) y
falla ante `#[0-9a-f]{3,8}`, `rgba?(` y `(bg|text|border)-(slate|gray|red|…|white|black)` con
archivo y línea (FR-081, SC-051). Es Bun test puro, sin dependencias nuevas.

**Reflujo (FR-079, SC-052):** `accessibility.spec.ts` añade un caso que fija el viewport en
320×640, visita las rutas cubiertas y afirma
`document.documentElement.scrollWidth <= clientWidth`.

La guarda de literales ya existía en `tests/unit/theme/tema.test.ts` (describe "colores fuera del
tema": hex entre comillas y paleta fija de Tailwind). La tarea 2.1 la amplía allí (`rgb()`/`rgba()`)
en lugar de crear un archivo nuevo. La prueba de desborde ya existía en `accessibility.spec.ts`
(375/1280 px): la tarea 5.1 añade 320 px y las rutas que no cubre.

### D11 — Pruebas de componentes sin dependencias nuevas

Bun no puede importar `react-native` (código fuente en Flow) y el repo no tiene renderer de
componentes. En lugar de añadir `@testing-library/react-native` y Jest, un preload de Bun
(`tests/unit/setup/react-native.ts`, registrado en `bunfig.toml`) sustituye `react-native` por
`react-native-web`, que ya es dependencia para la web, y reexpone `className` como `data-class`
(NativeWind no transforma JSX en Bun). Las pruebas renderizan con `renderToStaticMarkup` de
`react-dom/server` (también presente) y comprueban el HTML real de la web: `role`, `aria-*`,
`data-testid` y las clases de variante. Límite asumido: no se ejecutan estilos nativos; el
aspecto final lo verifican la compuerta axe y las capturas.

### D12 — Navegación global adaptable (FR-082 · FR-083)

**Estructura de rutas.** Los grupos no cambian las URLs.

```
src/app/(protected)/
  _layout.tsx            guarda de sesión + diálogo expirado (sin cambios) → <AppNavigation/>
  (home)/_layout.tsx     Stack · home.tsx
  (patients)/_layout.tsx Stack · patients/index, patients/new, patients/[id], consultations/[id]
  (follow-up)/_layout.tsx Stack · follow-up/index, follow-up/[patientId]
  (knowledge)/_layout.tsx Stack · knowledge/index, knowledge/sources/{index,new,[id]}
```

`consultations/[id]` vive en `(patients)`: se llega a una consulta desde la ficha, y así la
pestaña Pacientes queda marcada.

**Navegador de secciones.** Un componente con variante por plataforma (`app-navigation.tsx` y
`app-navigation.web.tsx`) en `src/components/navigation/`, fuera de `src/app`, como pide
`expo-router`:

- **iOS/Android:** `NativeTabs` (`expo-router/unstable-native-tabs`), con 4 disparadores. Cada
  uno lleva icono `sf` (SF Symbols en iOS) y `md` (Material Symbols en Android) y una etiqueta. Es
  la barra de pestañas nativa de cada plataforma (HIG/Material 3, ≤ 5 entradas). La API es
  `unstable`, así que el riesgo se acota abajo.
- **Web:** pestañas sin estilo de `expo-router/ui` (`Tabs`, `TabList`, `TabTrigger`, `TabSlot`),
  estilizadas con los tokens:
  - Desde `lg`: `TabList` vertical fija a la izquierda (`w-sidebar`, token nuevo de D6 = 240 px)
    con el nombre de la app arriba y, al pie, el nombre del profesional y el botón «Cerrar
    sesión», que sale de `/home`.
  - Por debajo de `lg`: `TabList` fija abajo, con icono y etiqueta.
  - Sección actual: `aria-current="page"`, texto `font-semibold`, barra indicadora `bg-primary`
    y fondo `bg-muted`. El indicador nunca es solo el color (FR-082).
  - El orden del DOM es navegación y después contenido, con un enlace «Saltar al contenido» como
    primer elemento enfocable (WCAG 2.4.1).
- **Iconos:** `Icon` (MaterialCommunityIcons) en web y SF/Material Symbols en nativo. Se desvía de
  `expo-native-ui` solo en web y en los iconos dentro de pantalla (ver D15).
- **Cierre de sesión en nativo:** la pantalla Inicio conserva el botón «Cerrar sesión», porque en
  la barra de pestañas no cabe una acción que no es una sección.

**Cabeceras y retroceso (FR-083).**

- **iOS/Android:** cada `Stack` de sección muestra la cabecera nativa (`headerShown: true`) con
  `headerBackButtonDisplayMode: "minimal"`. La raíz de la sección usa título grande en iOS. Los
  colores salen de `useThemeColors()`.
- **Web:** los `Stack` ocultan la cabecera, porque la barra lateral o las pestañas ya dan el
  contexto y el navegador ya tiene su botón atrás. En su lugar, `Screen` recibe dos props nuevas:
  - `title`: pinta `Heading level={1}` y el `<title>` del documento, sustituyendo los `Head`
    sueltos de cada pantalla.
  - `back={{ href, label }}`: pinta un `Link` «‹ Volver a …» antes del título. `href` es explícito
    (la raíz de la sección o la pantalla padre), no `router.back()`, para que la entrada por URL
    directa funcione (escenario de FR-083).
- **Nativo:** `Screen` con `title` fija `Stack.Screen options={{ title }}` y no pinta el
  `Heading level={1}`, para no duplicar el título de la cabecera (regla de `expo-native-ui`).
- **Área segura:** con cabecera nativa, el `ScrollView` de `Screen` usa
  `contentInsetAdjustmentBehavior="automatic"` y el `SafeAreaView` deja de aplicar el borde
  superior. La barra de pestañas gestiona el inferior.

**`/home`.** Pasa a ser un panel de entrada: la identidad de la sesión y accesos a las cuatro
secciones como enlaces. Se conservan `home-patients`/`home-knowledge` y se añaden `home-follow-up`.
El botón «Cerrar sesión» queda en nativo y en web angosta; en `lg` vive en la barra lateral.

### D13 — Enlaces, estados de datos y listas (FR-084 · FR-085 · FR-086)

- **Enlaces:**
  - Toda navegación pasa a `<Link href asChild>` con la primitiva existente: `Button` para
    acciones con aspecto de botón y un `LinkText` nuevo (texto `text-primary underline`) para
    enlaces en línea.
  - `router.push` queda solo tras una operación, por ejemplo al guardar una ficha y abrirla.
  - `Button` bajo `Link asChild` debe conservar el rol `link`. Una prueba de componente lo fija
    (rojo primero).
- **Estados:** una primitiva `QueryState` (`src/components/ui/query-state.tsx`) recibe
  `{ isPending, error, isEmpty, onRetry, empty, children }`:
  - Pinta, en este orden de precedencia, `Text` «Cargando…» con `aria-busy`, un `Callout error`
    con un botón «Reintentar» que llama a `refetch`, el nodo `empty`, o `children`.
  - `isPending` (TanStack Query v5) evita el vacío durante la primera carga.
  - La usan `/patients`, `/follow-up`, `/knowledge/sources`, `/knowledge/sources/[id]` y los
    historiales.
- **Listas:**
  - `/patients`, `/follow-up` y `/knowledge/sources` renderizan `FlatList` como contenedor de
    desplazamiento, con cabecera (título y acciones) en `ListHeaderComponent`, el vacío en
    `ListEmptyComponent` y `contentInsetAdjustmentBehavior="automatic"`.
  - Las tres usan `ScreenList` (`src/components/ui/screen.tsx`). Comparte con `Screen` el área
    segura, el título, el retroceso, el ancho (`width`, D18) y el margen, pero su único contenedor de
    desplazamiento es el `FlatList`. Así la configuración no se repite en cada pantalla, y el
    título y las acciones se desplazan con la lista.
  - El `ListEmptyComponent` es un `QueryState` sin contenido: carga, error o vacío.
  - Las listas acotadas dentro de una ficha (antecedentes, historial de una consulta) siguen con
    `.map`, porque son cortas y viven dentro del desplazamiento de su pantalla.

### D14 — Texto copiable y teclado (FR-087 · FR-088)

- **Texto copiable:** `Text` acepta `selectable` (lo pasa a RN). Se activa en:
  - los nombres y valores de la ficha;
  - los hechos de anamnesis;
  - los fragmentos y citas de fuentes;
  - el texto de las epicrisis;
  - todo `Callout tone="error"`, que lo pone por defecto.
  No se activa en etiquetas ni en botones.
- **Teclado:**
  - `Screen` envuelve su `ScrollView` en `KeyboardAvoidingView` de React Native: `behavior`
    `"padding"` en iOS y sin comportamiento en Android, donde `softwareKeyboardLayoutMode:
    "resize"` en `app.json` ya redimensiona.
  - `keyboardShouldPersistTaps="handled"` ya está en `Screen`.
  - `expo-native-ui` recomienda `react-native-keyboard-controller` para seguir el marco real del
    teclado. Se descarta por ahora, porque es una dependencia nueva y no hay animaciones ligadas
    al teclado (ver Complexity Tracking).
  - La verificación es nativa y depende de un dispositivo. Sin uno, queda como pendiente explícito.

### D15 — Adopción y desviaciones de `expo-native-ui`

| Guía | Decisión | Motivo |
|---|---|---|
| Estilos inline, sin Tailwind | **Se desvía** | NativeWind es el sistema existente (D1). `expo-design-system` prohíbe un segundo sistema al lado del existente |
| `Color` de `expo-router` (colores semánticos del SO) | **Se desvía** | La paleta de marca debe coincidir entre web y nativo, y está verificada AA en ambos esquemas. Los colores del SO no pasan por `tema.test.ts` |
| SF Symbols (`expo-symbols`) | **Solo en la barra de pestañas nativa** (`sf`/`md` de `NativeTabs`, sin dependencia) | Dentro de pantalla se mantiene `@expo/vector-icons` (decisión del usuario, D8), igual en las tres plataformas |
| `process.env.EXPO_OS` en vez de `Platform.OS` | **Se adopta** | Permite eliminar código por plataforma en el bundle. 4 usos |
| `React.use` en vez de `useContext` | **Se adopta** | React 19. 4 usos |
| `borderCurve: "continuous"` | **Se adopta** en `Card`, `Callout`, `Input`, `Button` y `SuggestedBlock` vía `style` (constante `CONTINUOUS_CURVE`) | Sin efecto en web; esquinas nativas en iOS. `Button` solo lo compone en iOS: en web, un `style` compuesto en su `Pressable` hacía que NativeWind acumulara clases de renders anteriores (8.8) |
| Sombras con `boxShadow` | Sin acción | No hay sombras: las superficies se separan con borde y fondo (D4) |
| Modal propio para confirmaciones | **Se mantiene** el diálogo de sesión expirada | Es una confirmación consecuente que bloquea la sesión; la guía admite alertas para estas. El retiro de fuentes ya confirma en línea |
| `Text selectable`, cuatro estados, `FlatList`, `keyboardShouldPersistTaps` | **Se adoptan** | D13–D14 |
| Hápticos, `Link.Preview`, menús contextuales | **Fuera de alcance** | Non-Goals |

### D16 — Acceso compatible con gestores de contraseñas (FR-089 · FR-090)

Diagnóstico (2026-09-25) del motivo por el que ningún gestor guarda ni rellena las credenciales:

- React Native Web no genera `<form>`: los campos son `<input>` sueltos, sin `name`. Chromium,
  Firefox y Safari asocian las credenciales a un formulario enviado.
- El botón es un `Pressable` con `onPress`: nunca hay evento `submit`, así que el navegador no
  detecta un inicio de sesión que pueda ofrecer guardar.
- `editable={isHydrated}` renderiza `readonly` en el HTML estático: los gestores no rellenan
  campos de solo lectura, y si rellenan antes de la hidratación, React sobrescribe el valor.
- En nativo falta `textContentType` (iOS) y el correo usa `autoComplete="email"` en vez de
  `username`, que es lo que asocian los gestores.

Decisión:

- **`auth-form.web.tsx`**: envoltorio que renderiza un `<form method="post" action="/login"
  noValidate>` real, solo en web (resolución por extensión de plataforma, como la navegación de
  D12). Su `onSubmit` hace `preventDefault()` y llama a `form.handleSubmit()`. Es un elemento DOM
  permitido: la guía `expo-native-ui` excluye DOM intrínseco salvo en código específico de web, y
  este es el único caso. En nativo, `auth-form.tsx` devuelve un `View`.
- **Envío**:
  - el botón principal es `type="submit"` en web (prop `web` de `Button`, sin cambiar su
    variante), y en nativo sigue con `onPress`;
  - Intro en la contraseña envía (`onSubmitEditing` en nativo; `submit` implícito en web);
  - el correo usa `returnKeyType="next"` y enfoca la contraseña.
- **Campos**:
  - `name`/`id` `username` y `password`;
  - `autoComplete` `username`/`current-password`;
  - `textContentType` `username`/`password`;
  - `importantForAutofill="yes"`.
- **Hidratación sin `readOnly`**:
  - se retira `editable={isHydrated}`;
  - al hidratar, el formulario adopta como valor inicial lo que ya haya en el DOM (lectura única
    de `input.value` por `id`, solo en web);
  - el botón sigue deshabilitado hasta la hidratación.
  - Así se conserva la protección que motivó `isHydrated` (pulsaciones perdidas en WebKit) sin
    bloquear el relleno. La regresión se cubre con `auth.spec.ts` en `webkit`.
- **Diseño**:
  - `Card` con `max-w-form` y `gap-6`, sobre `bg-background`;
  - cabecera con `Icon` de marca decorativo, `Heading level={1}` «Diklass» y `Text tone="muted"`;
  - error en `Callout tone="error"` (reemplaza el `Text` destructivo);
  - control «Mostrar contraseña» como `Button variant="ghost"` con `Icon` `eye`/`eye-off`,
    `aria-pressed` y `min-h-touch`, a la derecha del campo dentro de `Input`.
- **Seguridad**: la app no guarda credenciales. Tras un error se vacía la contraseña. `action`
  apunta a la propia ruta: si el JS no cargara, el `post` no llega a ningún servidor que acepte
  credenciales (Expo web estático), así que falla cerrado.
- **Fuera de alcance**: guardar en el llavero de iOS exige Associated Domains
  (`webcredentials:<dominio>`) y un `apple-app-site-association` publicado. Sin dominio
  desplegado queda como pendiente explícito. No se añaden passkeys ni «recordarme».
- **Alternativa descartada**: sustituir los `Input` por `<input>` DOM en todo el formulario. Así el
  login dejaría de compartir la primitiva `Input` (tema, foco, invalidez), y el `<form>`
  envolvente basta para que los gestores asocien los campos.

### D17 — Tema manual, avatar, Configuración y calendario (FR-091 – FR-094)

Decisiones del usuario (2026-09-25):

- El calendario usa `react-native-calendars` (Wix).
- Editar el nombre muestra el nombre actual en la atribución, con cada cambio auditado; se
  especifica en `perfil-profesional`.
- La UI va en este cambio y el perfil en un cambio aparte.

**Tema manual (FR-091).**

- `global.css` conserva el bloque oscuro bajo `@media (prefers-color-scheme: dark) { :root }`, que
  NativeWind usa en nativo y que en web da el modo `system`. Añade `:root.light` y `:root.dark`,
  que ganan por especificidad y fuerzan el modo en web con una clase en `<html>`. `tema.test.ts`
  exige que repitan exactamente los valores de claro y oscuro.
- No se usa `darkMode: "class"` de Tailwind: el tema no tiene variantes `dark:`, y la
  media query debe seguir sirviendo a nativo.
- La preferencia vive en `src/theme/theme-preference.ts` (store zustand vanilla, con prueba
  unitaria). La conectan dos archivos de plataforma:
  - `theme-store.web.ts`: `localStorage` y la clase en `<html>`;
  - `theme-store.ts`: `expo-secure-store` y `Appearance.setColorScheme`.
  - En ambos, `system` es el valor por defecto y un fallo de almacenamiento no es visible.
- `+html.tsx` incluye un script en línea que lee la preferencia y pone la clase antes del primer
  pintado (caso límite «sin destello»).
- `useThemeColors()` y `AppUiProvider` usan `useColorScheme()` de `src/theme/use-color-scheme.ts`,
  que resuelve la preferencia y, con `system`, el esquema del sistema operativo.
- El botón rápido es `ThemeToggle`, un `Button variant="ghost"` con `Icon`: `weather-night` para
  «Cambiar a modo oscuro» y `white-balance-sunny` para «Cambiar a modo claro».

**Avatar (FR-092).**

- Primitiva `src/components/ui/avatar.tsx`: círculo `rounded-full` (cápsula, sin `borderCurve`) con
  `bg-primary-surface` e iniciales `text-foreground font-semibold` (`primary` sobre esa superficie da
  4.3:1 en claro, por debajo de AA). Las iniciales son la primera letra
  de las dos primeras palabras, ignorando títulos como «Dr.»/«Dra.».
- Prop futura `uri`, con `expo-image` cuando se añada la foto: fuera de alcance. Por eso no se
  instala ahora.

**Configuración (FR-093).**

- Grupo `(settings)` con `settings/index.tsx` y `settings/profile.tsx` (la vista la entrega
  `perfil-profesional`). `SECTIONS` suma `{ name: "(settings)", href: "/settings", label:
  "Configuración", icon: "cog-outline", sf: "gearshape", md: "settings" }`.
- Web `lg`: la barra lateral lista las 5 secciones y su pie pasa a ser avatar + nombre (enlace a
  Configuración), el botón de tema y «Cerrar sesión».
- Web por debajo de `lg`:
  - barra superior compacta (`app-topbar`) con «Diklass», el botón de tema y el avatar-enlace a
    Configuración;
  - la barra inferior conserva las 4 secciones clínicas.
  - Medido a 320 px: 4 pestañas dan 80 px cada una, y «Conocimiento» ocupa 89 px a 14 px. Cinco
    pestañas no caben con el nombre visible.
- Etiquetas de la barra inferior:
  - nueva variante de `Text` `nav` (12 px, `font-medium`), exclusiva de la navegación. Las barras
    de pestañas de iOS/Material usan 10–12 px, y el mínimo de 14 px de D5 es para metadatos
    clínicos;
  - con ella (`text-nav` en `tailwind.config.js`), «Conocimiento» ocupa 76 px y cabe en los
    78 px útiles;
  - `numberOfLines` se retira: nada se recorta.
- Nativo: `NativeTabs` con 5 pestañas; el sistema ajusta las etiquetas.

**Calendario (FR-094).**

- La cabecera del paquete se sustituye con `customHeader` (solo los nombres de los días). En web, su
  `accessibilityRole="adjustable"` se convierte en un `slider` sin nombre (axe
  `aria-input-field-name`). El título y las flechas son propios.
- `react-native-calendars` `Calendar`, envuelto en `src/components/calendar/month-calendar.tsx`
  para aislar la dependencia. El envoltorio recibe `events: CalendarEvent[]` y traduce a
  `markedDates`.
- `theme` se construye con `useThemeColors()` y la fuente Atkinson.
- `LocaleConfig` en español (`es`), con `firstDay={1}`.
- `renderArrow` con `Icon` y nombres accesibles.
- `CalendarEvent` (`src/features/agenda/calendar-event.ts`) sigue RFC 5545:
  - `uid`, `title`;
  - `start`/`end` ISO 8601 con desfase, `timeZone` IANA y `allDay`;
  - `rrule?`, `location?`, `patientId?`, `status: "confirmed" | "tentative" | "cancelled"`.
- Así se podrá, sin reescribir el modelo:
  - exportar `.ics`;
  - sincronizar con los calendarios del dispositivo (`expo-calendar`, iOS/Android), que no se
    instala ahora;
  - usar vistas de día y semana más adelante.
- **Paquetes evaluados:**
  - `@marceloterreiro/flash-calendar`: el más rápido y fácil de estilizar, pero solo mes.
  - `@howljs/calendar-kit`: día/semana con arrastrar; requiere Reanimated y Gesture Handler, y el
    soporte web es menor.
  - `react-native-big-calendar`: estilo Google.
  - Se elige Wix por madurez, por cubrir mes, semana y agenda, y por funcionar en web con
    `react-native-web`.
  - Riesgo: estiliza con un objeto de tema, no con NativeWind. El envoltorio lo contiene.

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
- **[Riesgo] `NativeTabs` es `unstable` en SDK 57 y puede cambiar su API.** → Queda encapsulado
  en `app-navigation.tsx`: un cambio de API toca un solo archivo. El respaldo son las pestañas JS
  de `expo-router` (`Tabs`), ya incluidas.
- **[Riesgo] Reorganizar las rutas en grupos rompe los e2e o los flujos de Maestro.** → Las URLs
  no cambian. La tarea 7.1 comprueba con un e2e en rojo que todas las rutas de la compuerta
  siguen resolviendo antes de mover archivos. Los flujos `tests/e2e/native/*.yaml` se revisan en
  7.8.
- **[Riesgo] La barra lateral reduce el ancho útil de la consulta en `lg`.** → Con 240 px, a
  1280 px quedan 1040 px de contenido, suficientes para las dos columnas de D9 (`max-w-wide`
  1200 limita, no fuerza). La prueba de dos columnas de 4.6 se repite con la navegación montada.
- **[Trade-off] En web el título está dentro de la página y no en una cabecera.** → Es
  intencionado: la barra lateral da el contexto, el `h1` estructura el documento para los lectores
  de pantalla, y una cabecera extra solo repetiría el título.

## Performance budgets

- Fuentes de texto en web: ≤ 100 KB en total en woff2 (hoy 80 KB en 4 archivos). Precarga solo
  de esos 4 archivos.
- Fuente de iconos: ≤ 1.2 MB, sin precarga; no bloquea el primer pintado.
- Sin salto de maquetación atribuible a la fuente de texto en el primer pintado (FR-073). Se
  verifica con la traza de rendimiento de Playwright en `/login`: CLS ≤ 0.1.

### D18 — Ancho por tipo de pantalla (FR-079)

Decisión del usuario (2026-09-25): en escritorio web, 720 px dejaban casi la mitad del área útil
vacía junto a la barra lateral. El ancho pasa a depender del tipo de pantalla.

| Pantalla | Ancho en `lg` | Disposición |
|---|---|---|
| `/home` | `wide` | Panel de secciones y calendario lado a lado |
| `/patients`, `/follow-up`, `/knowledge/sources` | `ScreenList width="wide"` | 2 columnas desde `xl` (1280 px de ventana) |
| `/settings` | `wide` | Tarjetas en 2 columnas |
| `/patients/[id]` | `wide` | 2 columnas: ficha y campos faltantes a la izquierda; antecedentes e historial a la derecha |
| Formularios, visor de fuente, `/knowledge`, `/follow-up/[id]`, `/login` | `content` (720 px) | Una columna de lectura |

- Las columnas de `ScreenList` se toman de `useWindowDimensions()`: `numColumns` es 2 con 1280 px
  o más, y el `key` del `FlatList` cambia con él, porque RN no admite cambiar `numColumns` en
  caliente. Desde `xl`, 1280 px de ventana menos 240 px de barra lateral dejan unos 1040 px: dos
  tarjetas de unos 500 px.
- En la ficha, el orden del DOM no cambia (ficha, campos faltantes, edición, antecedentes,
  historial y abrir consulta), y el foco de teclado tampoco. Las dos columnas se forman con
  `lg:flex-row` sobre dos contenedores que ya siguen ese orden.
- Los formularios conservan 720 px: las líneas largas y los campos anchos dificultan la lectura y
  el llenado (WCAG 1.4.8, orientativo).

### D19 — Grupos de opciones por teclado y selector de paciente con búsqueda (FR-080 · FR-095)

Decisión del usuario (2026-09-25), a raíz de 5.2/5.6:

- **El problema:** `OptionPicker` hacía de cada opción una parada de Tab. En `/knowledge`, el
  selector de paciente pintaba una por ficha: con más de 250 fichas en la base local, el
  recorrido por teclado de la compuerta agotaba su tope antes de llegar a la pregunta. Esa era la
  causa del fallo intermitente.
- **`OptionPicker` con tabindex itinerante (solo web):**
  - `tabIndex` 0 en la opción elegida (o en la primera, si no hay ninguna) y -1 en el resto;
  - `onKeyDown` en el grupo: flechas derecha/abajo e izquierda/arriba (con vuelta), Inicio y Fin,
    que eligen la opción y le mueven el foco;
  - en nativo el lector de pantalla recorre el grupo por sí mismo y no hay cambios.
- **`SelectorPacienteContexto`:**
  - un `Input` «Buscar paciente» y un `OptionPicker` con las opciones de FR-095;
  - el filtro es una función pura (`filtrarPacientes`), sin tildes ni mayúsculas, probada
    aparte;
  - el recuento («N pacientes coinciden») va en un `Text` con `accessibilityLiveRegion="polite"`.
- **Alternativa descartada:** un combobox con lista desplegable. Exige más ARIA y más código de
  foco, sin ventaja para una lista ya acotada a 8.

## Complexity Tracking

| Elemento | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| `@expo/vector-icons` (dependencia nueva) | FR-075/077/078: estado y severidad no pueden depender solo del color, y el texto solo es menos escaneable en pantallas densas. Es un paquete de Expo, versionado con el SDK 57 e instalable con `expo install` | Sin iconos, solo texto: cumple WCAG pero no el objetivo de reconocimiento rápido de US13. SVG propios: más código que mantener |
| `expo-font` (config plugin; antes solo transitiva, ahora dependencia directa) | FR-073: fuente embebida sin carga en tiempo de ejecución en nativo | `useFonts` en tiempo de ejecución: añade un estado de carga y un parpadeo |
| Espejo `src/theme/colors.ts` | Props de color que no aceptan `className` (D1) | Leer las variables CSS en tiempo de ejecución: no es posible en nativo |
| 6 primitivas nuevas | Cada una tiene ≥ 2 usos reales (tabla de D7) | Clases repetidas: 30+ copias con deriva ya medida |
| Nivel visual `critico` | Decisión de producto para 006/007; es una fila en `SeverityBadge` | Añadirlo con 006: aceptable, pero el usuario lo pidió ahora |
| Navegación de secciones con variante por plataforma (`app-navigation.tsx` + `.web.tsx`) | FR-082: la convención de cada plataforma difiere (pestañas nativas frente a barra lateral en escritorio). Usa solo APIs de `expo-router` ya instalado | Un único `Tabs` JS en todas las plataformas: no es la barra nativa de iOS/Android y en escritorio desaprovecha el ancho. Un drawer: requiere `@react-navigation/drawer` y oculta las secciones en móvil |
| 4 layouts de grupo (`(home)`, `(patients)`, `(follow-up)`, `(knowledge)`) | Un `Stack` por sección, para que cada pestaña conserve su historial y su retroceso (FR-083) | Un único `Stack`: al cambiar de sección se pierde la posición en la anterior |
| Primitivas `QueryState` y `LinkText` | FR-084/085, con ≥ 4 y ≥ 3 usos | Repetir en cada pantalla los ternarios de carga/error/vacío: es la deriva que se midió |
| `react-native-calendars` (dependencia nueva, MIT, JS puro; arrastra `xdate`, `lodash`, `recyclerlistview`, `memoize-one`, `prop-types`, `hoist-non-react-statics`, `react-native-swipe-gestures`) | FR-094: calendario mensual accesible y localizable hoy, con semana y agenda disponibles cuando existan citas (decisión del usuario, D17) | Vista de mes propia con `Intl`: sin dependencias, pero habría que reescribirla al llegar semana y agenda |
| Bloques `:root.light`/`:root.dark` duplicados en `global.css` | FR-091: forzar el modo en web sin perder la media query de la que depende NativeWind en nativo | `darkMode: "class"`: rompería el modo `system` en nativo y no hay variantes `dark:` que lo necesiten. La duplicación la vigila `tema.test.ts` |
| `KeyboardAvoidingView` (React Native) en lugar de `react-native-keyboard-controller` | FR-088 sin dependencia nueva | `keyboard-controller`: mejor seguimiento del teclado, pero añade una dependencia nativa sin animaciones que lo justifiquen |

## Migration Plan

1. Completar tokens y primitivas con pruebas en rojo primero (tareas 2–3).
2. Migrar pantalla por pantalla (tarea 4), cada una con su e2e verde.
3. Retirar los alias deprecados (`size`/`bold` en `Text`, `size` en `Heading`) y activar la prueba
   anti-deriva sin excepciones (tarea 6).
4. Corregir los dos fallos de la compuerta (5.5, 5.6) y cerrar 5.2.
5. Navegación (grupo 7): primero la prueba de rutas en rojo, después los grupos de rutas, el
   navegador de secciones y las cabeceras, y al final `/home`.
6. Enlaces, estados, listas, texto copiable, teclado y estilo de código (grupo 8), pantalla por
   pantalla.
7. Repetir la compuerta completa, la revisión en escala de grises y la de texto ampliado con la
   navegación montada (5.2–5.4), y cerrar con 6.4–6.5.

Reversión: cada pantalla migra en su propio commit, así que se puede revertir por separado.

## Open Questions

Resueltas con el usuario el 2026-09-25:

- Valores de `suggested`, `warning`, `success` e `info`: **aprobados** tal como se fijaron en la
  tarea 2.2 (vista previa en `evidencia/2.2-tokens-claro.png` y `2.2-tokens-oscuro.png`).
- Resumen de seguimiento en la consulta a partir de `lg`: **columna lateral**, junto con los
  antecedentes y el historial de correcciones; la principal lleva anamnesis, diagnóstico y
  epicrisis.
- Tema manual, avatar, Configuración y calendario (2026-09-25): calendario con
  `react-native-calendars`; edición de nombre con nombre actual y auditoría, en el cambio
  `perfil-profesional` (D17).
- Login (2026-09-25): el usuario pide que el acceso permita guardar contraseñas y que el
  formulario vaya en una tarjeta. Se incorpora a este cambio como US15 (D16).
- Patrón de navegación: **adaptable** (barra lateral ≥ 1024 px en web; pestañas inferiores en
  compacto y en nativo). Alcance de las mejoras de `expo-native-ui`: **dentro de este cambio**.
