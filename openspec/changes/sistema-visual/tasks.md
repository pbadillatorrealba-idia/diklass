# Tasks: Sistema visual

Convención: Rojo-Verde-Refactor obligatorio (Constitución II): cada prueba se observa fallando por
la razón prevista antes de la implementación que cubre. El grupo 1 es la excepción documentada. Ese
código ya existe en `feat/tema-visual` sin especificación previa, así que sus tareas verifican y
registran evidencia en lugar de implementar; si una prueba nueva del grupo 1 pasa a la primera, se
comprueba que falla al revertir el cambio que cubre (mutación manual) y se deja constancia.
`quickstart.md` del cambio se crea en 1.1 y se completa de forma incremental. Las decisiones Dn
remiten a [design.md](design.md) y los requisitos a [la spec](specs/sistema-visual/spec.md). La
máquina de desarrollo tiene poca RAM: las suites e2e se ejecutan de una en una, con `--workers=1`.

## 1. Base implementada: verificación y registro (D1–D3)

- [x] 1.1 Crear `quickstart.md` con el inventario de lo implementado en `feat/tema-visual` (tokens, espejo, `useThemeColors`, fuente en `app.json`/`public/fonts`/`+html.tsx`, `AppUiProvider`, variantes de `Button`, `Input`, `:focus-visible`, `chromium-dark`, skills de Expo) y registrar `bun test tests/unit/theme` en verde, junto con la mutación que lo pone en rojo (alterar un canal de `--primary` en `global.css`) (FR-071 · FR-072). Verificación: salida rojo→verde pegada en `quickstart.md`.
- [x] 1.2 Verificar el modo oscuro en nativo (riesgo de D1/D9): arrancar la app en un emulador Android o simulador iOS con el esquema oscuro y confirmar fondo, texto, `Input` y navegación oscuros. Si no hay dispositivo disponible, dejarlo como pendiente explícito en `quickstart.md` (FR-071 · US13-AC1). Verificación: captura adjunta o pendiente registrado.
- [x] 1.3 Verificar la fuente en web y nativo: en web, las 4 peticiones `woff2` salen como `preload` antes del primer render y `/login` tiene CLS ≤ 0.1 (presupuesto de design.md); en nativo, `font-semibold` resuelve al peso 600 sin síntesis (FR-073 · US13-AC6). Verificación: traza de Playwright y captura registradas en `quickstart.md`.
- [x] 1.4 Ejecutar `accessibility.spec.ts` en `chromium` y `chromium-dark` (uno a la vez) y registrar 0 violaciones, incluido el recorrido de foco por teclado en `/patients` (FR-080 · SC-050). Verificación: resultados en `quickstart.md`.
- [x] 1.5 Comprobar que `OptionPicker` sigue exponiendo `checked` y que la opción elegida conserva la variante `primary` aunque esté deshabilitada (regresión de la sustitución de colores inline). Si no hay una prueba que lo cubra, escribirla en `tests/unit/` (FR-081). Verificación: prueba verde, y roja al quitar `variant`.

## 2. Tokens (pruebas primero) (D4, D6)

- [x] 2.1 Escribir en rojo `tests/unit/theme/sin-literales.test.ts` (D10): falla con archivo y línea ante hex, `rgb()`/`rgba()` y colores de paleta fija de Tailwind en `src/` fuera de `src/theme/`. Debe fallar hoy por `session-expired-dialog.tsx:19` (FR-081 · SC-051). Verificación: `bun test tests/unit/theme` en rojo, nombrando ese archivo.
- [x] 2.2 Ampliar `tema.test.ts` en rojo con los pares nuevos: `warning`, `success`, `info` y `destructive` con `-surface`/`-foreground` (≥ 4.5:1 para el texto, ≥ 3:1 para el borde contra `card`), `suggested` (≥ 3:1 contra `card`) y `background` más oscuro en claro. Luego añadir los valores a `global.css` y `colors.ts` ajustando solo la luminosidad, y el token `scrim` (FR-072 · FR-075 · SC-053). Verificación: rojo por tokens ausentes → verde; se muestran al usuario los valores propuestos (Open Question de design.md) antes del grupo 4.
- [x] 2.3 Subir la separación card/fondo en modo claro (`--background`, `--border` ≥ 1.4:1 contra `card`) y volver a verificar todos los pares con `background` (D4). Verificación: `tema.test.ts` verde y captura antes/después de `/patients` en `quickstart.md`.
- [x] 2.4 Extender `tailwind.config.js` con los colores nuevos, `maxWidth.content`/`wide` y `minHeight.touch`/`textarea` (D6), y sustituir `rgba(...)` + `padding: 24` del diálogo de sesión por `bg-scrim/55` y `p-6`. Verificación: `sin-literales.test.ts` verde y `bun run typecheck` verde.

## 3. Primitivas (pruebas primero) (D5, D7, D8)

- [x] 3.1 Instalar `@expo/vector-icons` con `bunx expo install @expo/vector-icons` (versión alineada con SDK 57, justificada en el Complexity Tracking) y ejecutar la auditoría de vulnerabilidades del proyecto. Verificación: `package.json` y lockfile actualizados, auditoría sin hallazgos altos y `expo-doctor` sin avisos nuevos.
- [x] 3.2 Escribir en rojo `tests/unit/ui/icon.test.tsx` y luego implementar `Icon`: exige `label` o `decorative` por tipos (`@ts-expect-error` en la prueba), el `label` expone `role="img"` + nombre y `decorative` queda oculto a la accesibilidad (FR-078). Verificación: la prueba pasa de rojo a verde y `typecheck` falla sin `label` ni `decorative`.
- [x] 3.3 Escribir en rojo las pruebas de `Text` (`variant` body/caption/label/strong, `tone` default/muted/destructive/warning/success/info) y `Heading` (`level` 1–3 → tamaño y nivel semántico), y luego implementarlos conservando `size`/`bold` como alias deprecados (FR-074 · D5). Verificación: pruebas en verde y pantallas actuales sin cambios de tipos.
- [x] 3.4 Escribir en rojo y luego implementar `Card` y `Screen` (`width` content/wide, `scroll`, padding `p-4 md:p-6`, `SafeAreaView`, propagación de `testID`) (FR-079 · FR-081 · D7). Verificación: pruebas verdes que comprueban las clases resultantes y el `testID`.
- [x] 3.5 Escribir en rojo y luego implementar `Callout` (`tone`, icono por tono, título opcional, `accessibilityRole` adecuado y `accessibilityLiveRegion="polite"` para `error`/`warning`) (FR-075). Verificación: pruebas verdes; el icono lleva nombre o el texto equivalente está presente.
- [x] 3.6 Escribir en rojo y luego implementar `SuggestedBlock` (borde `suggested`, etiqueta visible "Sugerencia del sistema" con icono y `accessibilityLabel` con el prefijo) (FR-076). Verificación: pruebas verdes, incluido que la etiqueta es texto y no solo color.
- [x] 3.7 Escribir en rojo y luego implementar `SeverityBadge` con la correspondencia de D4 para `leve`/`moderado`/`grave`/`critico`: nombre visible, icono, relleno sólido en `critico` y negrita desde `grave` (FR-077). Verificación: pruebas verdes para los 4 niveles, y el tipo acepta `AdverseEventSeverity` sin cambiar su vocabulario.
- [x] 3.8 Añadir a `Button` la variante `ghost` y la prop `size` (`sm`/`md`) manteniendo `min-h-touch`, con prueba en rojo primero (D7). Verificación: prueba verde y altura mínima de 44 px en ambos tamaños.

## 4. Migración por pantalla (una tarea = un commit con su e2e verde)

Cada tarea de este grupo:
- sustituye `SafeAreaView`/`ScrollView`/`max-w-[720px]` por `Screen`, las tarjetas por `Card`,
  `text-foreground/70` por `tone="muted"`, los `text-sm`/`text-xs` por `variant` y los `Heading
  size` por `level`;
- conserva todos los `testID`;
- se verifica con `sin-literales.test.ts` y `typecheck` en verde, la suite e2e de su feature en
  verde (`--workers=1`) y capturas claro/oscuro a 320 px y 1280 px en `quickstart.md`.

- [x] 4.1 `(auth)/login.tsx` y `login-form.tsx` (FR-074 · FR-079).
- [x] 4.2 `home.tsx` y el diálogo de sesión expirada (`rounded-xl`, `scrim`) (FR-081).
- [x] 4.3 `patients/index.tsx`, `patients/new.tsx`, `patients/[id].tsx`, `patient-history`, `antecedents-panel` y `AttributionBadge` (tarjeta de paciente con la acción a la derecha en `lg`, D9) (FR-079 · US13-AC4).
- [x] 4.4 `knowledge/index.tsx`, `knowledge/sources/*`, `avisos-cobertura` (→ `Callout`, `sin_respaldo_documental` como `error` y el resto como `warning`/`info`), `segmento-respuesta` (→ `SuggestedBlock`), `cita-fragmento` y `visor-documento` (FR-075 · FR-076 · US13-AC2).
- [x] 4.5 Componentes de voz: `draft-facts-panel` (hechos pendientes → `SuggestedBlock`; aprobados → atribución), `transcript-review` y `listen-mode-section` (FR-076 · escenario "Sugerencia aprobada").
- [x] 4.6 `consultations/[id].tsx`: `Screen width="wide"`, dos columnas en `lg` según D9 con el orden del DOM intacto, `missing-fields-panel` → `Callout warning`, más las secciones de anamnesis, diagnóstico y epicrisis y `follow-up-summary`. Resolver con el usuario la Open Question del resumen de seguimiento (FR-079 · US13-AC5). Verificación adicional: prueba e2e que a 1280 px afirma las dos columnas lado a lado y a 375 px una sola.
- [x] 4.7 `follow-up/index.tsx`, `follow-up/[patientId].tsx`, `feedback-form`, `feedback-timeline` y `adverse-event-report` (→ `SeverityBadge`; `grave` destacado) (FR-077 · US13-AC3).
- [x] 4.8 Revisar que `option-picker`, `anamnesis-section`, `diagnosis-section` y `epicrisis-fields` usan `min-h-textarea`/`min-h-touch` en vez de valores arbitrarios (FR-081).

## 5. Compuertas de accesibilidad y adaptabilidad

- [x] 5.1 Escribir en rojo el caso de reflujo en `accessibility.spec.ts` (viewport 320×640 en todas las rutas cubiertas; `scrollWidth <= clientWidth`) antes de terminar el grupo 4. Debe fallar en al menos una pantalla sin migrar, o documentar que ya pasa (FR-079 · SC-052). Verificación: rojo→verde registrado.
- [x] 5.2 Ejecutar la compuerta axe completa en `chromium` y `chromium-dark` y los proyectos `firefox`/`webkit` requeridos por la constitución, de uno en uno (SC-050). Verificación: 0 violaciones, con resultados y URLs de CI en `quickstart.md`. Primera ejecución (2026-09-25): chromium 29/29 y webkit 29/29 en verde; `chromium-dark` y `firefox` fallan un caso cada uno por defectos reales, que se corrigen en 5.5 y 5.6. Se repite tras el grupo 8, con la navegación montada.
- [x] 5.3 Revisión en escala de grises (emulación `forced-colors`/grayscale de Chromium) de `/knowledge`, `/consultations/[id]` y `/follow-up/[patientId]`: sugerido vs validado y severidades distinguibles sin color (US13-AC2/AC3). Verificación: capturas en `quickstart.md`.
- [x] 5.4 Prueba de texto ampliado: zoom del navegador al 200 % y, si hay dispositivo, Dynamic Type al máximo en `/patients` y `/consultations/[id]`, sin recortes (FR-074 · escenario "Texto ampliado"). Verificación: capturas o pendiente explícito en `quickstart.md`.
- [x] 5.5 Superficies tintadas sin transparencia (D4, corrección de 5.2):
  - Primero, en rojo: la guarda de `tema.test.ts` prohíbe `bg-<token>/<n>` salvo `scrim`. Debe fallar en `attribution-badge.tsx`, `segmento-respuesta.tsx` y `visor-documento.tsx`.
  - En `PAIRS`, añadir `muted-foreground` y `foreground` sobre `primary-surface` y `secondary-surface` y sobre `background`, en ambos esquemas.
  - Después: añadir los tokens a `global.css`, `colors.ts` y `tailwind.config.js`, subir la luminosidad de `muted-foreground` en oscuro y migrar los tres componentes (`AttributionBadge` → `bg-muted`).
  - FR-072 · SC-053.
  - Verificación: rojo→verde registrado, `chromium-dark` de `accessibility.spec.ts` en verde y capturas claro/oscuro de `/knowledge` y del historial de correcciones en `quickstart.md`.
- [x] 5.6 Foco visible en contenedores de desplazamiento (D3, corrección de 5.2):
  - Reproducir en rojo el fallo de `firefox` en «recorrido por teclado».
  - Después, ampliar la regla `:focus-visible` de `global.css` a todo elemento enfocable.
  - FR-080.
  - Verificación: el caso pasa en `firefox`, `chromium` y `webkit`, y una captura de Firefox con el contenedor enfocado queda en `quickstart.md`.
- [x] 5.7 `OptionPicker` con tabindex itinerante (D19 · FR-080):
  - primero, en rojo, un e2e en el que Tab entra en un grupo por la opción elegida, la flecha
    cambia la selección y el foco, y el siguiente Tab sale del grupo;
  - después, la implementación;
  - ajustar los `keyboardTestIDs` del caso sintético a una parada por grupo.
  Verificación: el e2e nuevo y el recorrido por teclado en verde en `chromium`, `firefox` y
  `webkit`.
- [x] 5.8 Selector de paciente con búsqueda (D19 · FR-095 · US14-AC6):
  - prueba unitaria en rojo de `filtrarPacientes` (tildes, mayúsculas, raza/especie, máximo 8 y
    el elegido siempre presente);
  - después, el componente;
  - e2e en `conocimiento.spec.ts`: buscar, elegir y anuncio del recuento.
  Verificación: pruebas verdes y axe en `/knowledge`.

## 6. Limpieza y cierre

Las tareas 6.4 y 6.5 se ejecutan al final, después de los grupos 7 y 8 y de repetir 5.2–5.4.

- [x] 6.1 Confirmar con grep que no quedan `text-foreground/70`, `text-xs`, `max-w-[`, `min-h-[`, `rounded-2xl` ni `gap-1.5` en `src/` (D5–D6), y añadir esos patrones a `sin-literales.test.ts`. Verificación: prueba verde, y roja al reintroducir cualquiera de ellos.
- [x] 6.2 Actualizar `AGENTS.md` con una sección breve sobre el sistema visual: dónde viven los tokens, qué primitiva usar para cada caso y la prohibición de literales. Verificación: sección presente y revisada.
- [x] 6.3 Retirar los alias deprecados (`Text size`/`bold`, `Heading size`). Verificación: `typecheck`, `bun test` y Biome en verde.
- [x] 6.4 Ejecutar las compuertas locales (`bun run typecheck`, `bunx biome check`, `bun test`) y dejar CI en verde; consolidar `quickstart.md` sin dar por aceptado nada que no lo esté, con los pendientes explícitos (verificación nativa si faltó y aceptación conjunta de FR-076/FR-077 con 003–005). Verificación: documento completo y URLs de CI.
- [x] 6.5 Generar el reporte de revisión en español con `requesting-code-review` sobre el rango completo de la rama. Verificación: reporte existente y su ubicación registrada.

## 7. Navegación global adaptable (D12 · US14)

Cada tarea conserva las URLs y los `testID` existentes y se verifica con `typecheck`, `bun test` y
las suites e2e afectadas en verde (`--workers=1`). Las verificaciones nativas sin dispositivo quedan
como pendiente explícito en `quickstart.md`.

- [x] 7.1 Escribir en rojo `tests/e2e/web/navegacion.spec.ts`:
  - a 1280 px, la barra lateral (`app-sidebar`) está en `/patients` con Pacientes marcada `aria-current="page"` y el cierre de sesión al pie;
  - a 375 px, la barra de pestañas (`app-tabbar`) está en `/knowledge`;
  - desde `/consultations/<id>` se llega a `/follow-up` en 1 activación;
  - «Volver» en `/follow-up/<id>` abierto por URL directa lleva a `/follow-up`;
  - todas las rutas de `syntheticScreens` siguen resolviendo.
  FR-082 · FR-083 · SC-054. Verificación: rojo por la navegación ausente, y el caso de rutas en verde antes de mover archivos.
- [x] 7.2 Reorganizar `src/app/(protected)/` en los grupos `(home)`, `(patients)`, `(follow-up)` y `(knowledge)`, cada uno con un `_layout.tsx` de `Stack`, y retirar los archivos de ruta antiguos. `consultations/[id]` va dentro de `(patients)` (D12). Verificación: el caso de rutas de 7.1 y todas las suites e2e web en verde, sin cambiar ninguna URL de los tests.
- [x] 7.3 Añadir el token `width.sidebar` (D6) y escribir en rojo la prueba de componente de la variante web de `app-navigation`: 4 enlaces con icono y nombre, `aria-current` en la sección actual, indicador que no es solo color, enlace «Saltar al contenido» primero y cierre de sesión al pie. Después, implementar `src/components/navigation/app-navigation.web.tsx` con `expo-router/ui` (lateral en `lg` y pestañas inferiores por debajo) (FR-082). Verificación: prueba verde y casos de 1280/375 px de 7.1 en verde.
- [x] 7.4 Implementar `src/components/navigation/app-navigation.tsx` con `NativeTabs`: 4 disparadores con `sf` y `md` y etiqueta, y colores de `useThemeColors()` (FR-082 · D15). Verificación: `typecheck` verde; en dispositivo, capturas iOS/Android claro/oscuro, o pendiente explícito.
- [x] 7.5 Montar la navegación en `(protected)/_layout.tsx` por debajo del diálogo de sesión expirada, que debe seguir encima y bloquear la navegación (caso límite de la spec). Verificación: `auth.spec.ts` en verde y un caso nuevo en `navegacion.spec.ts`: con el diálogo abierto, la barra lateral no recibe foco ni clics.
- [x] 7.6 Escribir en rojo y después implementar en `Screen` las props `title` (web: `h1` + `<title>`; nativo: `Stack.Screen options.title` sin `h1`) y `back={{ href, label }}` (web: `Link` «‹ Volver a …»), y `contentInsetAdjustmentBehavior="automatic"` con cabecera nativa. Luego sustituir los `Head` sueltos por `title` en todas las pantallas y añadir `back` a las de detalle (FR-083 · D12). Verificación: pruebas de `Screen` verdes, axe (`document-title`, `heading-order`) en verde y el caso «Volver» de 7.1 en verde.
- [x] 7.7 Configurar las cabeceras nativas de cada `Stack` de sección: `headerShown` solo en nativo, título grande en la raíz iOS, `headerBackButtonDisplayMode: "minimal"` y colores del tema (FR-083). Verificación: `typecheck` verde; capturas nativas o pendiente explícito.
- [x] 7.8 Rehacer `/home` como panel de entrada con enlaces a las 4 secciones: se conservan `home-patients`/`home-knowledge` y se añade `home-follow-up`. El cierre de sesión se oculta en `lg` web, donde vive en la barra lateral. Revisar `tests/e2e/native/*.yaml` con las rutas nuevas (FR-082 · D12). Verificación: `conocimiento.spec.ts`, `auth.spec.ts` y `navegacion.spec.ts` en verde, y los flujos de Maestro actualizados o marcados pendientes de dispositivo.

## 8. Patrones nativos de interacción (D13–D15)

- [x] 8.1 Escribir en rojo pruebas de componente para `Link asChild` + `Button` (rol `link` y `href` en web) y para `LinkText`, e implementar `LinkText` (FR-084). Verificación: pruebas rojo→verde.
- [x] 8.2 Migrar a `Link` toda navegación que hoy es `router.push`/`router.replace` dentro de un `onPress` sin operación previa, pantalla por pantalla, y añadir a `accessibility.spec.ts` un caso que falla si un control con `data-testid` de navegación («Ver ficha», «Ver seguimiento», «Ver documento», los de `/home») tiene rol `button` (FR-084 · SC-055). Verificación: el caso nuevo pasa de rojo a verde y las suites e2e siguen en verde.
- [x] 8.3 Escribir en rojo y después implementar `QueryState` (orden de precedencia de D13, reintento con `refetch`, `aria-busy` en carga y sin vacío mientras `isPending`) (FR-085). Verificación: pruebas de componente para los 4 estados, incluido «nunca vacío durante la carga».
- [x] 8.4 Adoptar `QueryState` en `/patients`, `/follow-up`, `/knowledge/sources` y `/knowledge/sources/[id]`, y en `patient-history`/`feedback-timeline`, con estados vacíos redactados y su acción, por ejemplo «Incorporar fuente clínica» (FR-085 · SC-056). Verificación: e2e en verde, más un caso e2e de vacío (`/knowledge/sources` con una clínica sin fuentes) y uno de error con reintento (red interceptada con `page.route`).
- [x] 8.5 Pasar `/patients`, `/follow-up` y `/knowledge/sources` a `FlatList` (vía `ScreenList`, D13; sustituye a `Screen scroll={false}`), cabecera en `ListHeaderComponent`, vacío en `ListEmptyComponent` y `contentInsetAdjustmentBehavior="automatic"` (FR-086). Verificación: e2e en verde y la prueba de reflujo a 320 px de 5.1 en verde, sin doble contenedor de desplazamiento.
- [x] 8.6 Añadir `selectable` a `Text` y activarlo en los datos clínicos y en `Callout tone="error"` según D14, con una prueba de componente en rojo primero para `Callout` (FR-087). Verificación: prueba verde; en web, el texto se puede seleccionar (e2e con triple clic y `getSelection`).
- [x] 8.7 `KeyboardAvoidingView` en `Screen` según D14 (FR-088). Verificación: `typecheck` verde; en dispositivo, captura de `/patients/new` con el teclado abierto y el botón de guardar visible, o pendiente explícito.
- [x] 8.8 Estilo de código de D15: `process.env.EXPO_OS` en los 4 usos de `Platform.OS`, `React.use` en los 4 de `useContext` y `borderCurve: "continuous"` en `Card`, `Callout`, `Input`, `Button` y `SuggestedBlock`. Añadir `Platform.OS` y `useContext(` a la guarda de `tema.test.ts` (rojo primero). Verificación: guarda roja→verde, `typecheck` y `bun test` verdes.
- [x] 8.9 Actualizar la sección «Sistema visual» de `AGENTS.md`:
  - navegación y títulos: `Screen title`/`back`;
  - `Link` para navegar;
  - `QueryState`;
  - `FlatList` para listas no acotadas;
  - `selectable`;
  - las desviaciones de D15;
  - el ancho por tipo de pantalla (D18).
  Verificación: sección revisada.

## 9. Acceso con gestor de contraseñas y tarjeta (D16 · US15)

- [x] 9.1 Escribir en rojo `tests/e2e/web/login.spec.ts`:
  - existe un `form` que contiene los dos campos con `name` `username` y `password` y
    `autocomplete` `username` y `current-password`;
  - Intro en la contraseña dispara 1 `submit` (contado con un listener en `page.evaluate`) y la
    sesión se inicia sin recargar;
  - un valor escrito en el DOM antes de la hidratación (`page.addInitScript`) sigue en el campo y
    permite entrar;
  - tras un error, el correo se conserva y la contraseña queda vacía;
  - «Mostrar contraseña» cambia el `type` a `text` y `aria-pressed` a `true`.
  FR-089 · FR-090 · SC-057. Verificación: rojo por cada caso.
- [x] 9.2 Implementar `src/components/auth/auth-form.web.tsx` (`<form>` con `preventDefault`) y
  `auth-form.tsx` (`View`), el botón `submit` en web, los atributos de campo de D16 y la adopción
  del valor prerrellenado, retirando `editable={isHydrated}` (FR-089). Verificación: los casos
  de 9.1 en verde en `chromium`, `firefox` y `webkit`, y `auth.spec.ts` en verde en los tres.
- [x] 9.3 Rediseñar `/login` con `Card`, cabecera de marca, `Callout` de error y el control
  «Mostrar contraseña», con prueba de componente en rojo primero para el control (nombre
  accesible, `aria-pressed`, área táctil) (FR-090). Verificación: prueba verde, axe en `chromium`
  y `chromium-dark` en verde, reflujo a 320 px en verde, y capturas a 320/1280 px en claro y en
  oscuro en `quickstart.md`.
- [x] 9.4 Verificar el guardado de credenciales:
  - en Chromium con perfil persistente (`launchPersistentContext`), comprobar que tras entrar el
    gestor ofrece guardar, y registrarlo con captura;
  - en iOS/Android, comprobar que el teclado ofrece credenciales guardadas, o dejarlo como
    pendiente de dispositivo;
  - el guardado en el llavero de iOS queda como pendiente de dominio desplegado (Associated
    Domains).
  FR-089. Verificación: evidencia o pendientes explícitos en `quickstart.md`.

## 10. Apariencia, cuenta y agenda (D17 · US16)

- [x] 10.1 Tema manual (FR-091):
  - Primero, en rojo: `tema.test.ts` exige que `:root.light`/`:root.dark` repitan los tokens de
    claro y oscuro, y la prueba de `theme-preference` cubre la persistencia con `system` por
    defecto y la degradación si el almacenamiento falla.
  - Después: los bloques forzados en `global.css`, `theme-store` por plataforma, el script de
    `+html.tsx` y el botón de tema.
  - Verificación: pruebas rojo→verde, y un e2e nuevo (`tema.spec.ts`) donde el botón cambia a
    oscuro, persiste tras recargar y no hay destello (captura del primer pintado). Axe verde con
    `chromium` forzado a oscuro sobre sistema claro.
- [x] 10.2 `Avatar` con iniciales, con prueba de componente en rojo primero (iniciales con «Dra.»,
  una palabra y acentos; decorativo; `min-h-touch`) (FR-092). Verificación: pruebas verdes.
- [x] 10.3 Sección Configuración (FR-093):
  - `(settings)` con `settings/index.tsx` (perfil, apariencia, cerrar sesión) y la entrada en
    `SECTIONS`;
  - barra lateral con 5 secciones y pie con avatar;
  - `app-topbar` en web angosta;
  - variante `nav` de `Text`;
  - `NativeTabs` con 5.
  Verificación: casos nuevos en `navegacion.spec.ts` (Configuración a 1 activación a 1280 y 375 px),
  y el reflujo a 320 px de 5.1 en verde, sin etiquetas recortadas (SC-059).
- [x] 10.4 Calendario en Inicio (FR-094):
  - instalar `react-native-calendars` con `bunx expo install` y justificarlo en `quickstart.md`
    (Principio III);
  - prueba de componente en rojo para `MonthCalendar` (estado vacío, hoy marcado, flechas con
    nombre) y para la traducción `CalendarEvent` → `markedDates`;
  - implementar el envoltorio, `LocaleConfig` y el tipo `CalendarEvent`.
  Verificación: pruebas verdes; en e2e, `/home` con el mes actual, «Sin eventos agendados» y axe
  verde en claro y en oscuro; capturas a 320/1280 px.
- [x] 10.5 Actualizar `AGENTS.md` (sección «Sistema visual»):
  - `Avatar`;
  - la variante `nav` exclusiva de la navegación;
  - la preferencia de tema;
  - el envoltorio `MonthCalendar` como único punto de uso del paquete.
  Verificación: sección revisada.

## 11. Ancho por tipo de pantalla (D18 · FR-079)

- [x] 11.1 Escribir en rojo, en `accessibility.spec.ts`, el escenario «Listas en escritorio»:
  - a 1280 px, `/patients` muestra dos `patient-item` lado a lado y el contenido mide más de
    720 px;
  - a 1024 px, una sola columna;
  - `/patients/new` sigue en 720 px o menos.
  FR-079. Verificación: rojo por el ancho actual.
- [x] 11.2 Añadir a `ScreenList` la prop `width` y las columnas adaptables (`numColumns` según
  `useWindowDimensions`, con `key` por número de columnas), con prueba de componente en rojo
  primero. Adoptarlo en `/patients`, `/follow-up` y `/knowledge/sources`. Verificación: prueba
  verde y el caso de 11.1 en verde.
- [x] 11.3 Pasar `/home` (panel y calendario lado a lado), `/settings` (tarjetas en 2 columnas) y
  `/patients/[id]` (2 columnas con el orden del DOM intacto) a `width="wide"`. Verificación:
  `navegacion`, `tema`, `registro-epicrisis` y el recorrido por teclado en verde.
- [x] 11.4 Repetir el reflujo a 320 px y axe en `chromium` y `chromium-dark`, y dejar capturas a
  1280 y 1440 px de `/home`, `/patients` y `/patients/[id]` en `quickstart.md`. Verificación:
  compuertas en verde y capturas registradas.

