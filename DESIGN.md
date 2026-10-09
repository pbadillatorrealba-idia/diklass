---
name: Diklass
description: Formulario clínico en copias para la consulta de etología canina; lo sugerido es la copia canaria y solo la firma del veterinario la vuelve original.
colors:
  background: "#F1F0F6"
  card: "#FFFFFF"
  popover: "#FFFFFF"
  foreground: "#251134"
  muted: "#EBE9F2"
  muted-foreground: "#544F68"
  primary: "#3E3888"
  primary-foreground: "#FFFFFF"
  primary-surface: "#E8E6F4"
  secondary-surface: "#E8ECEE"
  border: "#D3D0E3"
  input: "#706A92"
  ring: "#3E3888"
  suggested: "#7A6100"
  suggested-surface: "#FBEFA8"
  correction: "#9E2B45"
  correction-surface: "#F6DDE8"
  stamp: "#1F4E9E"
  destructive: "#B02818"
  destructive-foreground: "#FFFFFF"
  destructive-surface: "#FBE3D6"
  warning: "#965400"
  warning-surface: "#F5EEDC"
  success: "#266C3A"
  success-surface: "#E5F1E7"
  info: "#465E7C"
  info-surface: "#E6EBF1"
  scrim: "#000000"
typography:
  headline:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "32px"
  title:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
  title-sm:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "28px"
  body:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  body-strong:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  label:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
  caption:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  rubric:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
    letterSpacing: "0.025em"
  data:
    fontFamily: "Atkinson Hyperlegible Mono, Atkinson Hyperlegible Mono Fallback, monospace"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    fontFeature: "tnum"
  nav:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
rounded:
  sm: "2px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
    height: "44px"
  button-primary-sm:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
    height: "44px"
  button-ghost:
    textColor: "{colors.primary}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
    height: "44px"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
    height: "44px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
    height: "44px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.sm}"
    padding: "16px"
  form-section-band:
    backgroundColor: "{colors.primary-surface}"
    textColor: "{colors.primary}"
    typography: "{typography.title}"
    padding: "8px 16px"
  form-section-band-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.title}"
    padding: "8px 16px"
  form-field-label:
    textColor: "{colors.primary}"
    typography: "{typography.rubric}"
  suggested-block:
    backgroundColor: "{colors.suggested-surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "12px"
  correction-sheet:
    backgroundColor: "{colors.correction-surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "12px"
  signature-stamp:
    textColor: "{colors.stamp}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  provenance-mark:
    textColor: "{colors.primary}"
    typography: "{typography.data}"
    rounded: "{rounded.sm}"
    size: "24px"
  callout-error:
    backgroundColor: "{colors.destructive-surface}"
    textColor: "{colors.foreground}"
    padding: "8px 12px"
  callout-warning:
    backgroundColor: "{colors.warning-surface}"
    textColor: "{colors.foreground}"
    padding: "8px 12px"
  severity-badge-grave:
    backgroundColor: "{colors.destructive-surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  severity-badge-critico:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  avatar:
    backgroundColor: "{colors.primary-surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.full}"
    size: "44px"
---

# Design System: Diklass

<!-- Generado desde lo construido en la rama feat/formulario-en-copias-impl (sistema-visual, design.md D20). Fuente normativa del color: src/global.css; espejo: src/theme/colors.ts; guardas: tests/unit/theme/tema.test.ts. -->

## Overview

**Creative North Star: "El formulario en copias"**

Diklass es un formulario clínico normalizado, impreso sobre papel frío casi blanco en una sola tinta índigo de formulario: reglas de 1 px, recuadros, rótulos y números de sección. Lo que escribe el veterinario va en tinta negra. Lo que propone el sistema, sin validar, llega en pliego canario, como la copia amarilla de un formulario autocopiativo; lo corregido llega en pliego rosa, con el renglón anterior tachado de una sola línea y todavía legible. Solo la firma del veterinario, un timbre de tampón azul con nombre y hora, vuelve original la copia.

La densidad es la de un formulario bien compuesto, no la de un tablero: un solo eje vertical de secciones numeradas según el protocolo clínico (1 Anamnesis, 2 Diagnóstico, 3 Epicrisis y firma), campos con rótulo preimpreso sobre su regla y, al margen, el código de procedencia de cada dato (R, I, F, ?). La jerarquía la dan la regla, el pliego y la tinta; nunca la elevación, el degradado ni el color decorativo. El sistema rechaza de forma explícita el tablero de tarjetas con panel de «Hallazgos IA», los destellos y el violeta luminoso o degradado con que la categoría marca la IA (el índigo de marca es tinta mate, no un marcador de IA), lo frío-hospitalario (gris clínico sin tinta) y lo lúdico (patitas, ilustraciones de perros).

La misma paleta sirve a iOS, Android y web, en claro y en oscuro (pizarra con tinte violáceo, con los pliegos convertidos en tintes cálidos opacos). La revisión final de `impeccable` sobre la consulta dio veredicto «ship» en web (capturas en `openspec/changes/sistema-visual/evidencia/12.10-*` y la revisión en grises `12.9-*`); las capturas nativas de iOS y Android quedan como pendiente explícito, porque en esta máquina no hay simulador ni emulador.

**Key Characteristics:**
- Una sola tinta de estructura (`primary`) para reglas, rótulos, números, banda de sección y acción principal.
- Los pliegos (canario y rosa) son el único color de superficie con significado de registro.
- Datos en mono con cifras tabulares; UI y texto en Atkinson Hyperlegible Next.
- Esquinas de 2 px en todo salvo el avatar; ninguna sombra; reglas de 1 px.
- Toda distinción clínica lleva forma además de color: letra de procedencia, contorno, tachado, segmentos de severidad, etiqueta visible.
- Una única animación de autor: la firma.

## Colors

Tinta sobre papel con dos pliegos de color: estrategia restringida, en la que el color de superficie se concentra en lo sugerido y lo corregido y el resto es tinta. Todos los tokens se declaran como canales RGB en `src/global.css`, en cuatro bloques (claro, oscuro por media query, `:root.light` y `:root.dark` forzados en web), y `tema.test.ts` exige que el espejo `src/theme/colors.ts` coincida y que cada par de texto cumpla WCAG 2.2 AA (4.5:1; 3:1 para bordes de campo, foco y el contorno de lo sugerido).

### Primary
- **Índigo de formulario** (primary; el índigo del logo, `#3E3888`): la tinta preimpresa. Rótulos de campo, número de sección, banda de la sección activa, recuadro del código de procedencia, enlaces en línea (subrayados), botón `ghost` y relleno del botón principal. También es el anillo de foco (`ring`) y el tinte nativo en iOS y Android. En oscuro, lavanda clara (#B9B3F2).
- **Banda preimpresa** (primary-surface): tinte opaco al 12 % sobre la hoja. Banda de título de una sección inactiva, fondo de la evidencia citada en conocimiento, días con eventos del calendario y fondo del avatar.

### Secondary
- **Pizarra de ficha** (secondary-surface): tinte opaco para el segmento «ficha» de una respuesta de conocimiento. Es el único uso de la familia `secondary` en los componentes.

### Tertiary
- **Pliego canario** (suggested-surface) con **contorno ocre de lo sugerido** (suggested): lo que propone el sistema sin validar (FR-076). El pliego ocupa la superficie y el contorno de 1 px la delimita; el contorno cumple 3:1 sobre la hoja. En oscuro, oliva oscuro (#3A3312) con contorno amarillo paja (#E8CF5C).
- **Pliego rosa** (correction-surface) con **granate de corrección** (correction): el valor vigente de un campo corregido va en el pliego rosa (frío, hacia el magenta) y la palabra «Reemplazado» en granate encima del valor anterior tachado. En oscuro, ciruela (#361C30) con rosa claro (#F29AAE).
- **Azul de tampón** (stamp, `#1F4E9E`; separado del índigo de marca por ΔE*ab ≥ 10, FR-104): solo el marco y el texto del `SignatureStamp`, siempre junto al nombre de un profesional. En oscuro, azul claro (#8CB2F5).

### Neutral
- **Mesa** (background): el fondo bajo el formulario, gris violáceo muy claro. En oscuro, pizarra violácea casi negra (#14121C).
- **Hoja** (card, popover): la superficie de cada sección, tarjeta y diálogo. En oscuro, #1D1A29 (hoja) y #262334 (diálogo).
- **Tinta del veterinario** (foreground): todo el texto escrito y el valor de los campos. En oscuro, #ECEAF4.
- **Tinta secundaria** (muted-foreground) sobre **papel apagado** (muted): metadatos, valor tachado, placeholder, etiqueta del pliego canario y la atribución en línea.
- **Regla** (border): el índigo de formulario al ~25 % sobre la hoja, opaco. Reglas de campo, contorno de secciones y tarjetas. Decorativa: no se exige contraste.
- **Borde de campo** (input): contorno de los campos editables y del botón `outline`, a 3:1.
- **Capa modal** (scrim): negro, solo con opacidad (`bg-scrim/55`) bajo los diálogos. Es el único token que admite transparencia.

### Estados
- **Destructivo** (destructive, destructive-surface), **aviso** (warning, warning-surface: ocre anaranjado, para no confundirse con el canario), **correcto** (success, success-surface) e **información** (info, info-surface: pizarra azulada, más gris que el tampón). El tono sólido es texto, icono y borde sobre la hoja; la superficie es el fondo tintado con la tinta del veterinario encima; `destructive-foreground` es el texto sobre el relleno sólido de la severidad crítica.

`accent` (teal de marca, `#1D7672`; oscuro `#6CC9C2`) y `secondary` sólidos están definidos y verificados en el tema, pero ningún componente los consume; no forman parte del vocabulario hasta que una superficie los necesite.

### Named Rules
**The One Ink Rule.** Toda la estructura preimpresa (reglas, rótulos, números, banda activa, acción principal) va en `primary`. Ninguna otra tinta dibuja el formulario.

**The Two Sheets Rule.** Los pliegos `suggested-surface` y `correction-surface` son el único color de superficie con significado de registro. No se pinta una superficie de color por decoración, y ningún tinte es translúcido salvo `scrim`: un tinte translúcido no se puede verificar.

**The Stamp Names a Person Rule.** La tinta `stamp` solo aparece en el timbre de firma, junto al nombre y la hora de quien aprobó. Nunca pinta una superficie ni marca contenido generado.

**The Correction Is Not an Error Rule.** `correction-surface` y `destructive-surface` se separan por ΔE*ab (CIE76) ≥ 10 en los cuatro bloques del tema (12.4 en claro y 22.7 en oscuro), además de por icono y texto. Entre dos pasteles no basta el contraste de luminancia.

## Typography

**Display Font:** no hay; el título más grande es el de pantalla, en Atkinson Hyperlegible Next.
**Body Font:** Atkinson Hyperlegible Next (con system-ui, sans-serif), pesos 400, 500, 600 y 700.
**Label/Mono Font:** Atkinson Hyperlegible Mono (con un respaldo Courier ajustado en métricas, luego monospace), pesos 400 y 600.

**Character:** Una familia de legibilidad clínica, del Braille Institute, que distingue 1 l I, 0 O y rn m en dosis, pesos e identificadores; la mono de la misma familia marca los datos como tales, igual que los números a máquina en un formulario. En web se sirven desde `public/fonts` (la sans se precarga; la mono no, y su respaldo ajustado evita desplazar la maquetación); en nativo las embebe el plugin `expo-font` de `app.json` con el mismo nombre de familia.

### Hierarchy
- **Headline** (700, 24px, 32px): título de pantalla, `Heading` nivel 1; en web es el `h1`.
- **Title** (600, 20px, 28px): título de sección, `Heading` nivel 2. En la banda de `FormSection` lleva delante el número de sección en `data` semibold.
- **Title small** (600, 18px, 28px): subsección, `Heading` nivel 3.
- **Body** (400, 16px, 24px): texto y valores de campo. **Body strong** (600): nombres de paciente y profesional, títulos de aviso, texto de botón.
- **Rubric** (600, 14px, mayúsculas, tracking 0.025em, en `primary`): el rótulo preimpreso de un campo (Paciente, Tutor, Fecha, Estado, el nombre de cada campo) y la palabra «Firmado» del timbre.
- **Label** (500, 14px) y **Caption** (400, 14px): etiquetas de control, «‹ Volver a …», leyenda de la clave de procedencia.
- **Data** (mono 400, 16px, cifras tabulares): número de consulta, fechas y horas, peso, edad, dosis y los códigos R / I / F / ?.
- **Nav** (500, 12px, 16px): solo las etiquetas de la barra de pestañas web, como las de iOS y Material.

### Named Rules
**The Data in Mono Rule.** Una cifra o un código que el veterinario puede tener que comparar o copiar (fecha, hora, n.º de consulta, dosis, peso, código de procedencia) va en `data`. El texto corrido nunca va en mono.

**The 14 px Floor Rule.** Ningún texto baja de 14 px; la única excepción son las etiquetas de navegación a 12 px. `text-xs` está prohibido por la guarda.

## Layout

Un solo eje vertical. `Screen` centra el contenido con un ancho de lectura de 720 px (`content`) o, para la consulta, listas y paneles, de 1200 px (`wide`); los formularios centrados (login) se limitan a 480 px y los diálogos a 440 px. El margen es de 16 px, 24 px desde `md` (768 px), y los bloques de una pantalla se separan 24 px.

En la consulta, el encabezado del formulario (paciente, tutor, fecha, estado, «Consulta n.º N» y la clave de procedencia) cierra con una regla de 1 px y precede a las secciones numeradas. Desde `lg` (1024 px) la consulta va a dos columnas: las secciones en la columna principal y, a la derecha, el resumen de seguimiento longitudinal en 2/5 del ancho; en el DOM el contexto de solo lectura va primero, como en compacto, donde todo es una columna. En web, desde `lg`, la navegación pasa a una barra lateral de 240 px; las listas `wide` van a dos columnas desde `xl` (1280 px).

El ritmo interno usa la escala de 4 px: 4 px entre rótulo y valor, 8 px en las reglas de campo (arriba y abajo), 16 px entre bloques dentro de una sección y de padding de sección y tarjeta, 24 px entre secciones. Todo control tiene un área táctil mínima de 44 px; los campos multilínea arrancan en 120 px y crecen con su contenido para que el borrador se lea entero antes de firmarlo. Las opciones de un vocabulario cerrado fluyen en fila con salto de línea.

## Elevation & Depth

Sin sombras en ninguna superficie ni estado. La profundidad es la de papel sobre una mesa: la hoja blanca (`card`) sobre el fondo verdoso (`background`), delimitada por reglas de 1 px; los pliegos se distinguen por color y contorno, no por altura. Pulsar un control baja su opacidad al 80 %; un control deshabilitado queda al 50 % y conserva su variante. El foco es un contorno de 2 px en `ring`, separado 2 px del control (hacia dentro, -2 px, en contenedores que ocupan la ventana, para que no se recorte).

### Named Rules
**The Paper-Flat Rule.** Nada flota. La jerarquía la dan la regla, el pliego y la tinta; si una superficie necesita destacar, cambia de pliego o de banda, no de elevación.

## Shapes

Esquinas casi rectas, como los recuadros de un formulario impreso: 2 px en todas las superficies y controles (secciones, tarjetas, botones, campos, pliegos, timbre, recuadro de procedencia, badge de severidad), con curva continua en iOS. El único círculo es el avatar. Reglas y contornos de 1 px; el recuadro de la procedencia `desconocida` va en trazo discontinuo, para que la forma, y no solo la letra, lo distinga. Los avisos (`Callout`) no son cajas: son renglones impresos con regla arriba y abajo. Los segmentos de la barra de severidad son rectángulos de 6 × 12 px, llenos (sólidos) o vacíos (solo contorno), para leerse también en escala de grises.

### Named Rules
**The Two-Pixel Rule.** `rounded-sm` (2 px) en todo; `rounded-full` solo en el avatar. `rounded-lg`, `rounded-xl` y `rounded-2xl` están prohibidos por la guarda.

**The No Side Stripe Rule.** Ninguna superficie se marca con un borde lateral grueso (`border-l-2` a `border-l-8`). Lo sugerido se marca con pliego y contorno de 1 px; la sección activa, con la banda sólida.

## Components

### Buttons
Rectangulares, firmes, de tinta llena: la acción principal es la tinta del formulario.
- **Shape:** esquinas de 2 px, altura mínima de 44 px.
- **Primary:** relleno `primary`, texto `primary-foreground` semibold; 12 × 20 px de padding (`md`) u 8 × 12 px (`sm`). Borde transparente, para que se pinte en `forced-colors`. «Firmar y cerrar consulta» es un botón primary a todo el ancho al pie de la sección 3.
- **Outline:** hoja con borde `input` y texto `foreground` («Guardar borrador», opciones no elegidas).
- **Ghost:** sin fondo, texto `primary` (acciones terciarias como «Ver fuente»).
- **Destructive:** relleno `destructive`, solo para detener algo en curso.
- **Hover / Focus:** sin cambio al pasar el ratón; foco con anillo de 2 px en `ring` separado 2 px; pulsado al 80 % de opacidad; deshabilitado al 50 %.

### Chips (grupos de opciones)
- **Style:** `OptionPicker` es un grupo de radio hecho de botones: la opción elegida en `primary`, el resto en `outline`, en fila con salto de línea.
- **State:** en web, una sola parada de Tab y flechas, `Home` y `End` para moverse.

### Cards / Containers
- **Corner Style:** 2 px.
- **Background:** la hoja (`card`) sobre la mesa.
- **Shadow Strategy:** ninguna (ver Elevation & Depth).
- **Border:** regla de 1 px en `border`.
- **Internal Padding:** 16 px; el ritmo interno lo pone quien la usa. En la consulta, `Card` se reemplaza por `FormSection`; sigue para listas y paneles fuera de ella.

### Inputs / Fields
- **Style:** hoja con contorno de 1 px en `input`, esquinas de 2 px, 12 × 16 px de padding, texto `foreground` y placeholder en `muted-foreground`.
- **Focus:** anillo de 2 px en `ring` separado 2 px.
- **Error / Disabled:** en error el contorno pasa a `destructive`.
- **Field (solo lectura):** rótulo `rubric` en `primary`, valor debajo y regla de 1 px al pie; el código de procedencia va al margen derecho cuando el dato la tiene en el modelo.

### Navigation
- Nativa en iOS y Android (`NativeTabs`, cabeceras y retroceso del sistema), tintada con `primary`. En web, barra lateral de 240 px desde `lg` y pestañas con etiquetas `nav` de 12 px en compacto. Las pantallas de detalle llevan en web el enlace «‹ Volver a …» en `label` apagado, sobre el `h1`.

### Form Section (componente firma)
Sección numerada del protocolo: contenedor de hoja con regla de 1 px y esquinas de 2 px; banda de título con el número en `data` semibold y el título en `title`. La banda es `primary-surface` con tinta `primary`; la sección activa (al cargar, el paso siguiente del protocolo: 1 sin borrador, 3 con borrador, ninguna si está cerrada; después, la última editada) invierte a `primary` sólido con tinta `primary-foreground`. El cuerpo va sobre la hoja con 16 px de padding y 16 px entre bloques.

### Suggested Block (pliego canario)
Pliego `suggested-surface` con contorno de 1 px `suggested`, esquinas de 2 px y 12 px de padding. Su primer hijo es la etiqueta visible «Sugerencia del sistema · copia sin firmar» en `label` apagado, que es también su nombre accesible. En la sección 3, mientras hay borrador, todo el cuerpo de la sección lleva debajo el pliego canario.

### Correction Line (pliego rosa)
Rótulo `rubric`, «Reemplazado» en `caption` granate, el valor anterior tachado de una línea en tinta apagada y seleccionable, y el valor vigente en un pliego `correction-surface` con contorno `correction`, con su atribución (nombre en `body-strong`, fecha en `data`) sobre una regla superior.

### Signature Stamp (timbre de firma)
Marco de tampón de 1 px en `stamp`, esquinas de 2 px, 8 × 12 px de padding, ajustado a su contenido: «Firmado» en `rubric`, el nombre en `body-strong` y la fecha y hora en `data`, todo en `stamp`. Nunca rellena su fondo.

**Movimiento de la firma.** Al firmar, en un solo movimiento de 240 ms con salida exponencial, el pliego canario de la sección 3 se funde a papel (opacidad 1 → 0) y el timbre entra con opacidad 0 → 1 y escala 0.96 → 1. Con Reduce Motion (en web, `prefers-reduced-motion`) el cambio es inmediato. Es la única animación de autor de la app.

### Provenance Mark
Recuadro de 24 × 24 px con esquinas de 2 px y contorno de 1 px en `primary`, con la letra en `data` semibold: R (reportada), I (inferida), F (recuperada con fuente), ? (desconocida, con trazo discontinuo). Es una imagen con nombre «Procedencia: …». La `ProvenanceKey` con los cuatro códigos y su nombre está siempre visible en el encabezado de la consulta.

### Callout y Severity Badge
- **Callout:** renglón impreso con reglas de 1 px arriba y abajo en el tono del estado, superficie del tono, icono con nombre y texto en `foreground`; 8 × 12 px de padding. Nunca una caja flotante ni un toast.
- **Severity Badge:** escala única de cuatro niveles sin tokens propios: leve (info), moderado (warning), grave (destructive-surface, nombre en semibold) y crítico (relleno `destructive`, texto `destructive-foreground`). Icono, nombre y una barra de cuatro segmentos con tantos llenos como su posición.

## Do's and Don'ts

### Do:
- **Do** dibujar toda la estructura preimpresa (reglas, rótulos, números, banda activa) en `primary`, con reglas de 1 px en `border`.
- **Do** poner lo que propone el sistema sin validar en un `SuggestedBlock` (pliego canario, contorno de 1 px y la etiqueta «Sugerencia del sistema · copia sin firmar» como primer hijo).
- **Do** mostrar una corrección como `CorrectionLine`: «Reemplazado», el valor anterior tachado de una línea y legible, y el vigente en pliego rosa con su atribución.
- **Do** llevar cifras, fechas, horas, dosis y códigos de procedencia en `data` (mono, cifras tabulares).
- **Do** dar a cada distinción clínica una forma además del color: letra de procedencia, trazo discontinuo, tachado, segmentos de severidad, icono con nombre, etiqueta visible.
- **Do** usar solo tokens del tema, opacos y verificados AA en claro y oscuro en `tema.test.ts`; un token nuevo entra en los cuatro bloques de `global.css` y en el espejo `colors.ts`.
- **Do** mantener la firma como la única animación de autor: ≤ 300 ms (hoy 240 ms), salida exponencial e inmediata con Reduce Motion.

### Don't:
- **Don't** usar sombras, degradados, destellos ni violeta de «IA»; el tablero de tarjetas con panel de «Hallazgos IA» es la anti-referencia de este sistema.
- **Don't** redondear más de 2 px (`rounded-lg`, `rounded-xl`, `rounded-2xl`) ni usar `rounded-full` fuera del avatar.
- **Don't** marcar nada con un borde lateral grueso (`border-l-2` a `border-l-8`); la sección activa se marca con la banda sólida.
- **Don't** usar colores literales (hex, `rgb()`, paleta de Tailwind), escalas numeradas ni tintes translúcidos salvo `bg-scrim/55`.
- **Don't** usar la tinta `stamp` fuera del timbre de firma ni sin el nombre de un profesional.
- **Don't** confundir corrección con error: `correction-surface` y `destructive-surface` mantienen ΔE*ab ≥ 10.
- **Don't** bajar de 14 px (salvo las etiquetas `nav` de 12 px) ni poner texto corrido en mono.
- **Don't** convertir un aviso en caja flotante o temporal; es un renglón dentro de su sección.
- **Don't** añadir ilustraciones de perros, patitas ni gris clínico sin tinta.
