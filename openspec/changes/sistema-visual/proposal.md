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

Añadido tras revisar la app con las guías `expo-native-ui` y `expo-router` (2026-09-25):

- **Navegación global adaptable.** Hoy no hay barra lateral, ni barra de pestañas, ni cabecera:
  ambos `_layout.tsx` usan `Stack` con `headerShown: false`, `/home` es una columna de botones y
  `/follow-up` solo es alcanzable por URL. Se añade:
  - barra lateral fija en web desde 1024 px, con Inicio, Pacientes, Seguimiento y Conocimiento, y
    la cuenta y el cierre de sesión al pie;
  - barra de pestañas inferior en móvil, tablet y web angosta (`NativeTabs` en iOS/Android);
  - un `Stack` por sección, con cabecera, título y botón atrás.
- **Retroceso en nativo.** Sin cabecera, iOS no tiene ninguna forma de volver atrás. Cada pantalla
  de detalle tendrá atrás: la cabecera nativa en iOS/Android y un enlace «Volver» en web.
- **Enlaces en vez de botones para navegar.** Todo lo que cambia de ruta es un `Link`: en web es un
  `<a>` real y el lector de pantalla anuncia «enlace».
- **Cuatro estados de datos** (cargando, error con reintento, vacío y contenido) en toda pantalla
  que carga datos. El estado vacío nunca aparece durante la primera carga.
- **Datos y listas:**
  - listas de longitud desconocida virtualizadas (`FlatList`);
  - datos clínicos y mensajes de error copiables (`selectable`);
  - la acción principal de un formulario nunca queda bajo el teclado.
- **Estilo de código de Expo:** `process.env.EXPO_OS` en vez de `Platform.OS`, `React.use` en vez
  de `useContext` y `borderCurve: "continuous"` en las superficies redondeadas.
- **Acceso (pedido del usuario, 2026-09-25):**
  - el login pasa a ser un formulario real que los gestores de contraseñas del navegador y del
    sistema pueden guardar y rellenar;
  - vive en una tarjeta separada del fondo, con «Mostrar contraseña», Intro para enviar y el error
    en un `Callout`.
  - La app sigue sin guardar credenciales propias.
- **Apariencia, cuenta y agenda (pedido del usuario, 2026-09-25):**
  - botón para cambiar entre modo claro y oscuro, con la preferencia guardada en el dispositivo
    (Sistema por defecto);
  - avatar con iniciales como marcador de la foto del profesional;
  - quinta sección, Configuración, con perfil, apariencia y cierre de sesión;
  - calendario mensual vacío en Inicio (`react-native-calendars`), con un modelo de evento
    compatible con iCalendar para llenarlo más adelante.
  - La edición de datos personales se especifica en el cambio nuevo `perfil-profesional`.
- **Correcciones de la compuerta de la tarea 5.2:**
  - En oscuro, el texto atenuado no llega a AA sobre los tintes translúcidos (`bg-primary/15`,
    `bg-secondary/15`, `bg-accent/20`): queda en 3.4–3.8:1. Se sustituyen por tokens de
    superficie verificados.
  - En Firefox, el contenedor de desplazamiento de `Screen` recibe foco sin indicador visible.

No hay cambios incompatibles de datos ni de API: el vocabulario `AdverseEventSeverity`
(`leve`/`moderado`/`grave`) no cambia.

## Capabilities

### New Capabilities

- `sistema-visual`: tema de tokens, tipografía, primitivas de UI, estados semánticos,
  distinción de autoría (sistema/profesional), severidad clínica e iconografía, con layout
  adaptable y conformidad WCAG 2.2 AA en claro y oscuro. Incluye la navegación global adaptable,
  las cabeceras con retroceso, el acceso compatible con gestores de contraseñas y los patrones de interacción comunes: enlaces, estados de datos,
  listas y teclado.

### Modified Capabilities

Ninguna. No existen capacidades base publicadas en `openspec/specs/`. Las features que hoy
presentan contenido del sistema (`base-conocimiento-trazable`, `captura-voz-anamnesis`) o
severidad (`retroalimentacion-clinica`) no cambian sus requisitos funcionales: solo adoptan las
primitivas de esta capacidad.

## Impact

- Código: `src/global.css`, `tailwind.config.js`, `src/theme/`, `src/components/ui/`, todas las
  pantallas de `src/app/(protected)/` y `(auth)/`, y los componentes de feature que hoy usan
  `text-foreground/70`, `bg-secondary/15`, `bg-accent/20` o estilos inline.
- Rutas: `src/app/(protected)/` se reorganiza en grupos por sección (`(home)`, `(patients)`,
  `(follow-up)`, `(knowledge)`), cada uno con su `Stack`. Los grupos no cambian las URLs
  (`/home`, `/patients`, `/consultations/[id]`, `/follow-up`, `/knowledge`…), así que las rutas
  de los e2e y los enlaces documentados siguen siendo válidos. Cambia `home.tsx`: la navegación
  sale de sus botones, pero se conservan los `testID` `home-patients`/`home-knowledge`, que
  `conocimiento.spec.ts` usa.
- Dependencias: `expo-font` (el config plugin ya se usaba; pasa a dependencia directa, antes solo
  transitiva) `@expo/vector-icons` (nueva) y `react-native-calendars` (nueva, D17). La navegación usa solo APIs de `expo-router` ya
  instalado (`expo-router/ui` y `expo-router/unstable-native-tabs`): no añade dependencias.
- Pruebas: `tests/unit/theme/`, compuerta axe en `tests/e2e/web/accessibility.spec.ts` (claro y
  oscuro) y una comprobación nueva de reflujo a 320 px.
- Dependencias de construcción: `identidad-y-acceso` (pantallas protegidas y diálogo de sesión).
  La adopción en las pantallas de 002–005 requiere que existan en la rama, pero no añade aristas al
  grafo: cada pantalla se migra cuando está presente.
- Aceptación conjunta: la distinción sistema/profesional (FR-076) y la severidad de 4 niveles
  (FR-077) se aceptan junto con las features que las presentan (003, 004, 005 y, a futuro, 006 y 007).

Estado: lo marcado como implementado existe en el árbol de trabajo de `feat/tema-visual`, pero aún
no está integrado ni aceptado.
