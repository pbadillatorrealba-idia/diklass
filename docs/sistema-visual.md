# Sistema visual

Catálogo de reglas de UI de Diklass (identidad «Formulario en copias», D20). Es la versión
estable de lo que justifica `openspec/changes/sistema-visual/design.md`; `AGENTS.md` conserva
solo las reglas que hacen fallar una guarda. Ante conflicto prevalecen la constitución, el brief
y la spec de `sistema-visual`.

Reglas para cualquier UI nueva o modificada:

- **Color:** solo tokens semánticos de `src/global.css` (claro y oscuro), vía clases
  (`bg-card`, `text-muted-foreground`, `border-warning`…). `src/theme/colors.ts` es su espejo
  para props que no aceptan `className` (`useThemeColors()`). Un token nuevo va en ambos y en
  `tests/unit/theme/tema.test.ts` con su par de contraste AA. Nunca hex, `rgb()`, paleta fija de
  Tailwind ni escalas numeradas de gluestack (`text-warning-700`): la guarda de ese test falla.
  Identidad «Formulario en copias» (D20): el color de superficie se concentra en los pliegos
  (`suggested-surface` para lo sugerido, `correction-surface` para lo corregido); el resto es tinta
  (`primary` preimpresa, `foreground` del veterinario) sobre papel (`card`). `stamp` solo pinta el
  timbre de firma, junto al nombre de un profesional.
- **Primitivas** (`src/components/ui/`):
  - Pantalla: `Screen`, con `title` (en web, `h1` y `<title>`; en nativo, la cabecera del
    `Stack`) y `back={{ href, label }}` en las pantallas de detalle. Nunca `Head` suelto.
  - Lista no acotada (pacientes, fuentes, seguimiento): `ScreenList`, que usa `FlatList` como
    único contenedor de desplazamiento. El título y las acciones van en `header`; carga, error y
    vacío, en `empty`. Nunca `.map` dentro de un `ScrollView`.
  - Datos que se cargan: `QueryState` (cargando > error con «Reintentar» > vacío > contenido),
    con `isPending` de TanStack Query para no mostrar el vacío durante la primera carga. El vacío
    explica qué falta y ofrece la acción para crearlo.
  - Superficie: `Card` (listas y paneles fuera de la consulta).
  - Formulario clínico (D20): `FormSection` (sección numerada con banda preimpresa; la activa, en
    `primary` sólido) y `Field` (rótulo `rubric` + valor + marca al margen).
  - Procedencia (FR-097): `ProvenanceMark` al margen de todo dato con `Provenance` (R/I/F/?,
    nombre «Procedencia: …») y `ProvenanceKey` en el encabezado de la consulta. Nunca el texto
    «Procedencia: X» suelto.
  - Estado: `Callout tone="error|warning|success|info"`, un renglón dentro de su sección, nunca
    una caja flotante ni un toast (FR-100).
  - Contenido del sistema sin validar: `SuggestedBlock` (pliego canario, «Sugerencia del sistema ·
    copia sin firmar»). Contenido aprobado: `AttributionBadge approved`, que pinta
    `SignatureStamp`.
  - Corrección de un registro firmado: `CorrectionLine` (anterior tachado tras «Reemplazado» y el
    vigente en el pliego rosa) y `ProvenanceCorrection` en la anamnesis.
  - Severidad clínica: `SeverityBadge` (nombre, icono y barra de 4 segmentos).
  - Iconos: `Icon` (`label` o `decorative`, obligatorio).
  - Persona: `Avatar` con iniciales; es decorativo, así que el nombre siempre va al lado como
    texto o como nombre accesible del control que lo contiene.
  - Calendario: `MonthCalendar` (`src/components/calendar/`), único punto de uso de
    `react-native-calendars`; recibe `CalendarEvent[]` (`src/features/agenda/`), nunca
    `markedDates` directamente.
- **Texto:** `Text variant="body|caption|label|strong"` y `tone`; títulos con
  `Heading level={1|2|3}`. Nada de `text-sm`/`text-xs` sueltos ni `text-foreground/70`. La
  variante `nav` (12 px) es exclusiva de las etiquetas de navegación. `data` (Atkinson
  Hyperlegible Mono, cifras tabulares) para números de consulta, fechas y horas, pesos, edades,
  dosis y códigos; `rubric` para los rótulos preimpresos del formulario. `data` fija `text-base`:
  no se anida dentro de un texto `caption`.
- **Movimiento:** la firma es la única animación de autor (`useSignatureMotion`,
  `SIGNATURE_MS` ≤ 300 ms) y es inmediata con Reduce Motion / `prefers-reduced-motion`.
- **Tema:** la preferencia (`system|light|dark`, por defecto `system`) se lee y cambia con
  `useThemePreference()`, y el esquema efectivo con `useColorScheme()` de
  `src/theme/use-color-scheme.ts`, nunca el de `react-native`. Un token nuevo va también en los
  bloques `:root.light`/`:root.dark` de `global.css`, que `tema.test.ts` compara con claro y
  oscuro.
- **Navegación:** todo cambio de ruta es `<Link href asChild>` con `Button` o con `LinkText`
  (enlace en línea), para que en web sea un `<a href>`. `router.push`/`replace` solo tras una
  operación, como guardar y abrir lo guardado. La compuerta axe falla si un control de navegación
  tiene rol `button`.
- **Ancho (D18):** `width="wide"` (1200 px) para la consulta, las listas (2 columnas desde
  1280 px de ventana), Inicio, Configuración y la ficha. Los paneles de dos columnas usan
  `lg:flex-row` sin cambiar el orden del DOM. Los formularios y la lectura larga quedan en
  `content` (720 px).
- **Texto copiable:** `selectable` en los datos clínicos (ficha, anamnesis, citas y fragmentos,
  resúmenes); los mensajes de `Callout tone="error"` y `QueryState` ya lo llevan. No va en
  etiquetas ni botones.
- **Botones:** `primary` para la acción principal de la pantalla; `outline` para las
  secundarias y las acciones por fila; `ghost` para las terciarias; `destructive` solo para
  detener algo en curso.
- **Layout:** espaciado de la escala (`gap`/`p` 1, 2, 3, 4, 6, 8), `rounded-sm` (2 px) para
  controles y superficies, `rounded-full` solo para el avatar y ningún borde lateral grueso (D20 de
  `sistema-visual`; la guarda de `tema.test.ts` falla con `rounded-lg`/`rounded-xl` y
  `border-l-[2-8]`), y dimensiones con nombre (`max-w-content`, `min-h-touch`,
  `min-h-textarea`), nunca valores arbitrarios `[…]`.
- **El color nunca es la única señal:** todo estado lleva texto o icono con nombre.
- **Estilo de código (D15):** `process.env.EXPO_OS` en lugar de `Platform.OS`, y `use` de React 19
  en lugar de `useContext` (la guarda de `tema.test.ts` falla con los antiguos).
  `borderCurve: "continuous"` va en las superficies con radio mediante `CONTINUOUS_CURVE`.
- **Desviaciones asumidas de `expo-native-ui` (D15):**
  - NativeWind y no estilos en línea;
  - la paleta de marca y no los colores del sistema operativo;
  - `@expo/vector-icons` dentro de pantalla (SF Symbols solo en las pestañas nativas);
  - `automaticallyAdjustKeyboardInsets` en el `ScrollView` de `Screen` y no
    `react-native-keyboard-controller` ni `KeyboardAvoidingView`.
