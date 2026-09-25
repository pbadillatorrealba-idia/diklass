# Quickstart y evidencia: Sistema visual

Registro incremental de verificación del cambio. Implementado no significa aceptado: cada
entrada indica qué se observó, con qué comando y qué sigue pendiente.

## Inventario de la base implementada (feat/tema-visual, commit e11db49)

| Elemento | Ubicación | Requisito |
|---|---|---|
| Tokens RGB claro/oscuro | `src/global.css` (`:root` + `@media (prefers-color-scheme: dark)`) | FR-071 |
| Exposición a Tailwind/NativeWind | `tailwind.config.js` (`rgb(var(--x) / <alpha-value>)`) | FR-071 |
| Espejo TS + hook | `src/theme/colors.ts`, `src/theme/use-theme-colors.ts` | FR-071 |
| Sincronía, contraste AA y guarda de literales | `tests/unit/theme/tema.test.ts` | FR-071 · FR-072 · FR-081 |
| Fuente nativa | `app.json` (plugin `expo-font`), `assets/fonts/*.ttf` | FR-073 |
| Fuente web | `public/fonts/*.woff2`, `@font-face` en `global.css`, preload en `src/app/+html.tsx` | FR-073 |
| Tema de navegación | `src/components/ui/gluestack.tsx` (`AppUiProvider`) | FR-071 |
| Variantes de botón | `src/components/ui/button.tsx` (`primary`/`outline`), `option-picker.tsx` | FR-081 |
| Input con tema | `src/components/ui/input.tsx` (`bg-card`, `border-input`, `useThemeColors`) | FR-071 |
| Foco visible | `:focus-visible` en `global.css`; `focus:ring-ring` en `Button` | FR-080 |
| Compuerta axe oscura | `playwright.config.ts` (proyecto `chromium-dark`) | SC-050 |
| Skills de agentes | `.claude/skills/expo-*`, `.agents/skills/expo-*` | — (herramienta) |

## 1.1 — Sincronía y contraste del tema (FR-071 · FR-072)

Mutación: `--primary: 24 122 106` → `24 122 107` en el bloque claro de `global.css`.

```
$ bun test tests/unit/theme            # con la mutación
(fail) tema light > el espejo en TypeScript coincide con global.css
 169 pass
 1 fail

$ bun test tests/unit/theme            # restaurado
 170 pass
 0 fail
```

Resultado: la prueba detecta la desalineación CSS↔TS. Aceptación: pendiente.

## 1.2 — Modo oscuro en nativo (FR-071 · US13-AC1)

Sin dispositivo: la máquina de desarrollo no tiene Android SDK ni simulador iOS (`adb`/`emulator`
ausentes). Evidencia a nivel de compilación: la hoja de Tailwind compilada
(`bunx tailwindcss -i src/global.css`) procesada con `cssToReactNativeRuntime` de
`react-native-css-interop` (el compilador que NativeWind 4.2 usa para iOS/Android) produce
`rootVariables` con ambos esquemas, por ejemplo:

```
rootVariables["--background"] = {"light":[245,248,247],"dark":[1,4,4]}
```

Es decir, el bloque `@media (prefers-color-scheme: dark)` se traduce a variables por esquema que
NativeWind resuelve con la API `Appearance`; no hace falta el mecanismo alternativo `vars()` de
design.md.

**Pendiente explícito:** captura en un emulador Android o simulador iOS en modo oscuro (fondo,
texto, `Input`, cabecera de navegación). Se hace en la primera ejecución con dispositivo o en el
build de Maestro.

## 1.3 — Fuente sin salto de maquetación (FR-073 · US13-AC6)

Web, sobre el export estático (`bunx expo export -p web --clear`) servido en local y medido con
Playwright/Chromium en `/login` (`PerformanceObserver` de `layout-shift` y orden de peticiones):

| Esquema | CLS | `woff2` pedidos | ¿Antes del primer script? | Pesos cargados |
|---|---|---|---|---|
| claro | 0 | 4 | sí | 400, 500, 600, 700 |
| oscuro | 0 | 4 | sí | 400, 500, 600, 700 |

`login.html` contiene los 4 `<link rel="preload" as="font" type="font/woff2">`. Presupuesto de
design.md (CLS ≤ 0.1; ≤ 100 KB de fuentes de texto, hoy 80 KB): cumplido.

Nativo: `app.json` declara la familia Android con el peso de cada archivo y los 4 TTF en iOS
(cubierto por `tema.test.ts`). **Pendiente explícito:** comprobar en un dispositivo que
`font-semibold` usa el archivo 600 sin síntesis (sin SDK en esta máquina).

## 1.4 — Compuerta axe en claro y oscuro (FR-080 · SC-050)

Supabase local activo (Podman). Comandos, uno a la vez y con un worker:

```
$ bun --env-file=.env run test:e2e:web -- tests/e2e/web/accessibility.spec.ts --project=chromium --workers=1
  6 passed (57.8s)
$ bun --env-file=.env run test:e2e:web -- tests/e2e/web/accessibility.spec.ts --project=chromium-dark --workers=1
  6 passed (44.7s)
```

Cobertura actual de la compuerta: `/login` (normal y con error), pantallas protegidas base,
`/patients`, `/patients/new`, ficha del paciente y consulta abierta/cerrada (axe, recorrido de
teclado con foco visible —incluye `patients-register` y `patient-open` en `/patients`— y ausencia
de desborde a 375/1280 px). **No cubre** `/knowledge*` ni `/follow-up*`: se añaden en el grupo 5.
La prueba de desborde ya existía: la tarea 5.1 la extiende a 320 px en lugar de duplicarla.

## 1.5 — Regresión de OptionPicker (FR-081)

No había pruebas de componentes: se añadió el preload `tests/unit/setup/react-native.ts`
(`bunfig.toml`) de design.md D11. `tests/unit/registro/option-picker.test.tsx` comprueba
`role="radiogroup"`, `aria-checked` y que la opción elegida conserva `bg-primary` aun deshabilitada.

```
$ bun test tests/unit/registro/option-picker.test.tsx    # quitando `variant=` en option-picker.tsx
(fail) OptionPicker > con isDisabled=false la opción elegida conserva la variante primary
(fail) OptionPicker > con isDisabled=true la opción elegida conserva la variante primary
 2 pass / 2 fail
$ bun test tests/unit/registro/option-picker.test.tsx    # restaurado
 4 pass / 0 fail
$ bun run test                                            # suite completa con el preload
 562 pass / 75 skip / 0 fail
```

## 2.1 — Guarda de literales ampliada (FR-081 · SC-051)

`tests/unit/theme/tema.test.ts` ("colores fuera del tema") detecta ahora también `rgb()`/`rgba()` y
reporta cada hallazgo como `archivo:línea literal`. Rojo observado:

```
+   "src/components/auth/session-expired-dialog.tsx:19 rgba(15, 23, 42, 0.55)",
(fail) colores fuera del tema > src/components/auth/session-expired-dialog.tsx no usa hex, rgb() ni la paleta fija de Tailwind
```

## 2.2 — Tokens de estado, sugerido y scrim (FR-072 · FR-075 · SC-053)

Rojo: 44 fallas en `bun test tests/unit/theme` (tokens ausentes). Verde tras añadir los valores
(solo el par de borde de 2.3 y el literal de 2.1 seguían en rojo). Regla de uso (design.md D4):
`{estado}` = texto/icono/borde sobre card y fondo; `{estado}-foreground` = texto sobre el relleno
sólido; `foreground` sobre `{estado}-surface`.

| Token | Claro | Oscuro |
|---|---|---|
| `warning` / `-foreground` / `-surface` | `147 95 16` / `255 255 255` / `250 242 229` | `230 148 25` / `37 24 4` / `59 44 22` |
| `success` / `-foreground` / `-surface` | `36 123 67` / `255 255 255` / `231 248 237` | `57 198 109` / `9 32 17` / `22 59 36` |
| `info` / `-foreground` / `-surface` | `57 111 172` / `255 255 255` / `232 239 247` | `91 142 200` / `10 20 31` / `22 40 59` |
| `destructive-surface` | `250 230 229` | `59 25 22` |
| `suggested` | `131 83 198` | `161 125 212` |
| `scrim` | `0 0 0` | `0 0 0` |

## 2.3 — Separación card/fondo en claro (D4)

`background` `245 248 247` → `238 242 241` y `border` `233 241 239` → `206 219 215`
(border/card 1.07 → 1.42). Para seguir en AA sobre el fondo nuevo bajaron su luminosidad
`destructive` (`224 14 0` → `217 14 0`), `input` (`101 151 144` → `97 145 138`) y `ring`
(`97 153 139` → `93 147 133`). `bun test tests/unit/theme`: solo queda el literal de 2.1 en rojo.
Capturas de `/patients` a 1280 px en claro: [antes](evidencia/2.3-patients-antes.png) ·
[después](evidencia/2.3-patients-despues.png).

## 2.4 — Tailwind y diálogo de sesión (D6 · FR-081)

`tailwind.config.js` expone `warning`/`success`/`info` (con `foreground` y `surface`),
`destructive-surface`, `suggested`, `scrim`, `maxWidth.content|wide|dialog` y
`minHeight.touch|textarea`. `session-expired-dialog.tsx` pasa de `style` inline con
`rgba(15, 23, 42, 0.55)` y `padding: 24` a `bg-scrim/55 p-6`, con `max-w-dialog` y `rounded-xl`
(se añadió `maxWidth.dialog` a D6 para no dejar `max-w-[440px]`).

```
$ bun test tests/unit/theme            → 210 pass / 0 fail (el literal de 2.1 queda resuelto)
$ bun run typecheck                    → sin errores
$ bun --env-file=.env run test:e2e:web -- tests/e2e/web/auth.spec.ts --project=chromium --workers=1
  8 passed (incluye US11/AC5: el diálogo de sesión expirada aparece y permite reautenticar)
```

## 3.1 — Dependencias de iconos (D8 · Complexity Tracking)

```
$ bunx expo install @expo/vector-icons   → @expo/vector-icons ^15.0.2 (instalado 15.1.1, alineado con SDK 57)
$ bunx expo install expo-font            → expo-font ~57.0.4
$ bun audit --ignore … (mismas exclusiones que CI)
  No vulnerabilities found (checked 602 packages, 2 ignored)
$ bunx expo install --check              → Dependencies are up to date
$ bunx expo-doctor                       → 20/21 checks passed
```

`expo-doctor` detectó que `expo-font` (cuyo config plugin ya usa `app.json`) era solo transitiva y
`@expo/vector-icons` la requiere como peer: se instaló como dependencia directa. El único aviso
restante, `react-native-screens` duplicado dentro de `expo-router`, **existe ya en `main`**
(`bun.lock` de `main` contiene `expo-router/react-native-screens`) y queda fuera del alcance de
este cambio.

## 3.2 — Icon (FR-078 · D8)

`src/components/ui/icon.tsx` (MaterialCommunityIcons; color por token con `tone`; tamaños 16/20/24).
Para renderizarlo en Bun, el preload de D11 también sustituye `expo-font` (fuente dada por cargada)
y define `__DEV__`.

```
$ bun test tests/unit/ui/icon.test.tsx   # sin el componente
error: Cannot find module '@/components/ui/icon'
$ bun test tests/unit/ui/icon.test.tsx   # implementado
 6 pass / 0 fail   (role="img" + aria-label con label; aria-hidden con decorative; font-size por tamaño)
$ bun run typecheck                      # con los tipos relajados a { label?; decorative? }
 2 × TS2578 (Unused '@ts-expect-error'): los tipos sí exigen label o decorative
```

## 3.3–3.8 — Primitivas (FR-074 · FR-075 · FR-076 · FR-077 · FR-078 · FR-079 · D5–D8)

Cada prueba se observó en rojo (`Cannot find module …` para los componentes nuevos; 12 fallas en
`typography.test.tsx` y 3 en `button.test.tsx` antes de implementar) y luego en verde:

| Tarea | Componente | Prueba | Resultado |
|---|---|---|---|
| 3.3 | `Text` (`variant`, `tone`), `Heading` (`level`, `aria-level`; alias `size`/`bold` deprecados con nivel derivado) | `tests/unit/ui/typography.test.tsx` | verde |
| 3.4 | `Card`, `Screen` (safe-area-context, `max-w-content`/`wide`, `p-4 md:p-6`, `<testID>-scroll`) | `tests/unit/ui/layout.test.tsx` | 5/5 |
| 3.5 | `Callout` (superficie + borde + icono con nombre; `aria-live` en error/warning) | `tests/unit/ui/callout.test.tsx` | 9/9 |
| 3.6 | `SuggestedBlock` (`border-l-4 border-suggested`, grupo con nombre, etiqueta visible primero) | `tests/unit/ui/suggested-block.test.tsx` | 4/4 |
| 3.7 | `SeverityBadge` (leve/moderado/grave/crítico; tono `onDestructive` añadido a `Text`) | `tests/unit/ui/severity-badge.test.tsx` | verde |
| 3.8 | `Button` `ghost` + `size` sm/md con `min-h-touch` | `tests/unit/ui/button.test.tsx` | 6/6 |

`bun test tests/unit/ui tests/unit/registro/option-picker.test.tsx` → 60 pass / 0 fail;
`bun run typecheck` sin errores. El preload también sustituye `react-native-safe-area-context`.
`Screen` pasa `style={{ flex: 1 }}` al `SafeAreaView` porque NativeWind solo interpreta
`className` en los componentes de RN.

## Revisión de colores antes del grupo 4 (tarea 2.2 · Open Questions)

Vista previa construida con las mismas utilidades de Tailwind que usan las primitivas, compiladas
desde `src/global.css`: [claro](evidencia/2.2-tokens-claro.png) · [oscuro](evidencia/2.2-tokens-oscuro.png).
El usuario **aprobó** los valores (2026-09-25) y eligió la **columna lateral** para el resumen de
seguimiento en la consulta en escritorio.

## Grupo 4 — Migración por pantalla

Método común: Metro web local (`bun run web -- --port 8084`) + script de capturas con Playwright
(inicio de sesión como Ana), a 320 px en oscuro y 1280 px en claro; e2e de la feature con
`--workers=1`; `bun test tests/unit/theme` (guarda de literales) y `bun run typecheck` en verde.

### 4.1 — Login

`login.tsx`: `SafeAreaView` de safe-area-context y `contentContainerClassName="grow items-center
justify-center p-4 md:p-6"` (el centrado vertical solo lo usa esta pantalla, así que no va en
`Screen`). `login-form.tsx`: `max-w-form` (nuevo token de D6), `Heading level={1}`,
`tone="muted"`, y `login-error` con `tone="destructive"`. Es un mensaje de validación del
formulario cuyo texto ya explica el error; no se usa `Callout`, porque el glifo del icono entraría
en el texto verificado por `auth.spec.ts`.

```
$ bun --env-file=.env run test:e2e:web -- tests/e2e/web/auth.spec.ts --project=chromium --workers=1
  8 passed
```
Capturas: [320 px oscuro](evidencia/4.1-login-320-oscuro.png) · [1280 px claro](evidencia/4.1-login-1280-claro.png).

### 4.2 — Panel y diálogo de sesión

`home.tsx` pasa a `Screen scroll={false}` con `justify-between` (cerrar sesión al pie),
`Heading level={1}` y `tone="muted"`; la columna queda centrada en escritorio. `LogoutButton`
pasa a `variant="outline"`: cerrar sesión no es una acción principal y no debe tener la misma
jerarquía que "Pacientes". El diálogo de sesión expirada ya quedó migrado en 2.4 (`bg-scrim/55`,
`rounded-xl`, `max-w-dialog`).

```
$ bun --env-file=.env run test:e2e:web -- tests/e2e/web/auth.spec.ts --project=chromium --workers=1
  8 passed (incluye logout y el diálogo de sesión expirada)
```
Capturas: [320 px oscuro](evidencia/4.2-home-320-oscuro.png) · [1280 px claro](evidencia/4.2-home-1280-claro.png).

### 4.3 — Pacientes, ficha, historial, antecedentes y atribución

Migración mecánica con un script local (no versionado): `SafeAreaView`+`ScrollView`+`max-w-[720px]`
→ `Screen`, tarjetas → `Card`, `text-foreground/70` → `tone="muted"`, `bold` → `variant="strong"`
(o `label` si era texto pequeño) y `Heading size` → `level`. Revisado con `git diff -w`. Cambios
de diseño, además:
- `/patients`: en `lg` la tarjeta pone "Ver ficha" a la derecha (D9); "Ver ficha" pasa a `outline`
  para no competir con la acción principal "Registrar paciente"; el error de carga pasa a
  `Callout tone="error"`.
- Los mensajes de estado de la ficha y del alta (`setStatus`) mezclan éxito y error en un solo
  texto; tipificarlos cambia su lógica de estado y queda fuera de esta tarea.

```
$ bun --env-file=.env run test:e2e:web -- tests/e2e/web/registro-epicrisis.spec.ts --project=chromium --workers=1   → 2 passed
$ bun --env-file=.env run test:e2e:web -- tests/e2e/web/attribution.spec.ts --project=chromium --workers=1          → 2 passed
$ bun --env-file=.env run test:e2e:web -- tests/e2e/web/accessibility.spec.ts --project=chromium --workers=1        → 6 passed
```
Capturas: [pacientes 1280 px claro](evidencia/4.3-pacientes-1280-claro.png) · [ficha 320 px oscuro](evidencia/4.3-ficha-320-oscuro.png).

### 4.4 — Base de conocimiento (FR-075 · FR-076 · US13-AC2)

- `avisos-cobertura`: cada aviso es un `Callout` (`sin_respaldo_documental` → `error`,
  `sin_paciente_seleccionado` → `info`, resto → `warning`). El aviso de cobertura parcial y el
  detalle de lo no cubierto se fusionan en un solo `Callout` que conserva ambos `testID`.
- `segmento-respuesta`: la `inferencia` (afirmación del propio sistema) va en `SuggestedBlock`,
  y conserva su etiqueta de origen de FR-021; evidencia citada y dato de ficha mantienen su tinte.
  Los textos de lectura pasan a `body`.
- `cita-fragmento`: "Ver fragmento en su contexto" pasa a `ghost sm`; `visor-documento`: la
  cabecera pasa a superficie de primer nivel (`rounded-xl p-4`) y los fragmentos a `body`.
- Fuentes: tarjetas → `Card`, estado con `tone`, "Ver documento" → `outline`; la confirmación de
  retiro → `Callout warning` con "Cancelar" `outline`; el error de lectura → `Callout error`.
- **Defecto encontrado y corregido:** `Callout` solo envolvía en `Text` un contenido de tipo
  string, así que un texto con interpolación (arreglo de strings) quedaba suelto en un `View`
  (LogBox: "Unexpected text node"). Regresión en `callout.test.tsx`: roja con la versión anterior
  y verde con `isPlainText`.

```
$ bun --env-file=.env run test:e2e:web -- tests/e2e/web/conocimiento.spec.ts --project=chromium --workers=1   → 5 passed
```
Capturas: [respuesta 1280 px claro](evidencia/4.4-respuesta-1280-claro.png) · [fuentes 320 px oscuro](evidencia/4.4-fuentes-320-oscuro.png).

### 4.5 — Componentes de voz (FR-076 · escenario «Sugerencia aprobada»)

**Defecto encontrado:** los componentes de voz usaban clases de la paleta numerada de gluestack
(`bg-warning-100`, `text-warning-700`, `text-success-700`, `text-error-700`, `bg-error-500`,
`bg-primary-500`) que no existen en el tema: se renderizaban sin color, así que la contradicción,
el error y el estado "grabando" no se veían como tales. La guarda de `tema.test.ts` detecta ahora
cualquier escala numerada `(bg|text|border|…)-<nombre>-<n>` (rojo: 7 hallazgos en `src/components/voz/`).

- `draft-facts-panel`: pendiente → `SuggestedBlock`; confirmado → "Confirmado" (`tone="success"` +
  icono) y `AttributionBadge` con quien confirmó (`updated_by`/`updated_at`: confirmar es un UPDATE);
  descartado → `tone="muted"`; contradicción → `Callout warning`; "Corregir" y "Descartar" → `outline`.
- `listen-mode-button`: grabando usa `variant="destructive"` (nueva variante de `Button`, D7: se
  añade porque una pantalla real la necesita).
- `listen-mode-section`: error → `Callout error`. `transcript-review`: tramos → `Card`; tramo no
  confiable → `tone="destructive"`. `listen-status-indicator`: icono de grabación al capturar.

```
$ bun test tests/unit/voz/voz-ui.test.tsx   → rojo 4/5 antes de implementar; 5 pass después
$ node_modules/.cache/gates.sh (biome ci, typecheck, bun test tests/unit) → OK
```
**Pendiente explícito:** `ListenModeSection` no está montada en ninguna pantalla (integración
pendiente de la 004), así que no hay e2e ni capturas en la app; la verificación es por render en
`tests/unit/voz/voz-ui.test.tsx`.

### 4.6 — Consulta a dos columnas (FR-079 · US13-AC5)

`Screen width="wide"`; desde `lg`, principal (anamnesis, diagnóstico, epicrisis) y lateral
(resumen de seguimiento e historial de correcciones, que sale de la epicrisis). La lateral va
primero en el DOM y a la derecha con `lg:flex-row-reverse` (D9 actualizado). Además:
- `missing-fields-panel`: la lista de campos sin información → `Callout warning`.
- Borrador de epicrisis → `SuggestedBlock` (lo arma el sistema y no está validado, FR-076).
- Error de carga → `Callout error`; "Ver ficha del paciente", "Guardar borrador" y "Cancelar" →
  `outline`; "Aprobar y cerrar consulta" queda como única acción principal.
- `follow-up-summary`: título `Heading level={3}`.

Prueba nueva en `accessibility.spec.ts`: «la consulta usa dos columnas a 1280 px y una a 375 px».
Roja sobre el código anterior (`waiting for getByTestId('consultation-main')`); la primera
versión verde tuvo una carrera, porque el resumen llega después y agranda la lateral entre dos
mediciones. Se corrigió midiendo ambas cajas en un solo `evaluate` con la red en reposo (dos
ejecuciones seguidas en verde).

```
$ … accessibility.spec.ts --project=chromium --workers=1        → 7 passed
$ … registro-epicrisis.spec.ts --project=chromium --workers=1   → 2 passed
$ … auth.spec.ts / attribution.spec.ts                           → 8 / 2 passed
```
Capturas (consulta cerrada): [1280 px oscuro](evidencia/4.6-consulta-1280-oscuro.png) · [320 px claro](evidencia/4.6-consulta-320-claro.png).

### 4.7 — Seguimiento y retroalimentación (FR-077 · US13-AC3)

- `adverse-event-report`: cada evento vigente muestra `SeverityBadge` (nombre + icono + color) y su
  descripción; el `grave` conserva su superficie destacada con el token `destructive-surface` (antes
  `bg-destructive/10`). Las versiones sustituidas siguen sin resalte (la e2e lo exige). "Ver
  versiones ya corregidas" → `outline`.
- `feedback-timeline`: el evento adverso usa `SeverityBadge` en lugar de texto en rojo.
- `/follow-up`: error de carga → `Callout error`; tarjeta con acción a la derecha en `lg` y
  "Ver seguimiento" → `outline` (como `/patients`).

```
$ bun --env-file=.env run test:e2e:web -- tests/e2e/web/retroalimentacion.spec.ts --project=chromium --workers=1   → 5 passed
```
Capturas del reporte de eventos adversos: [1280 px claro](evidencia/4.7-eventos-1280-claro.png) · [320 px oscuro](evidencia/4.7-eventos-320-oscuro.png).

### 4.8 — Dimensiones del sistema en campos (D6 · FR-081)

`min-h-[120px]` y `min-h-[96px]` → `min-h-textarea` (anamnesis, diagnóstico, epicrisis;
el campo de 96 px se unifica a 120 px); `Input` `min-h-[44px]` → `min-h-touch`; `gap-1.5` →
`gap-2` en `OptionPicker` y `FormControl`. Queda `text-xs` solo como alias deprecado de `Text`
(se retira en 6.3).

```
$ … registro-epicrisis / accessibility / auth (chromium, --workers=1)   → 2 / 7 / 8 passed
```

## Grupo 5 — Compuertas de accesibilidad y adaptabilidad

### 5.1 — Reflujo a 320 px y rutas nuevas en la compuerta (FR-079 · SC-052)

- `expectNoHorizontalOverflow` mide 320, 375 y 1280 px.
- `syntheticScreens` suma `/knowledge`, `/knowledge/sources`, `/knowledge/sources/new`,
  `/follow-up` y `/follow-up/<paciente>`; así las pruebas de axe, teclado y desborde cubren
  también esas pantallas.
- **Defecto encontrado (preexistente, 003):** las cuatro pantallas de conocimiento no tenían
  `<title>` (axe `document-title`, WCAG 2.4.2). Al sumarlas, la compuerta falló; se añadió `<Head>`
  con título a cada una.
- **Punto ciego de la prueba de desborde (preexistente):** solo medía `document.documentElement`,
  pero el `ScrollView` de RN Web es un contenedor con scroll propio y un desborde dentro de él no
  agranda el documento. Una mutación (`min-w-[340px]` en `Screen`) pasaba la prueba. Ahora también
  mide cada contenedor que recorta o desplaza en horizontal (salvo campos de texto). La misma
  mutación falla con «Desbordamiento horizontal a 320 px en lista de pacientes: div 330 > 320», y
  sin ella pasa.

No hubo rojo por pantallas sin migrar: al llegar a 5.1 todas estaban migradas (grupo 4 completo).

```
$ … accessibility.spec.ts --project=chromium --workers=1   → 7 passed (con las 5 rutas nuevas)
```

## Grupo 6 — Limpieza

### 6.3 — Alias deprecados retirados (D5)

El script de migración pasado por todo `src` solo encontró un resto (`correction-history`:
`<Text bold>` → `variant="strong"`). `Text` pierde `size`/`bold` y `Heading` pierde `size`; se
eliminan sus pruebas de alias. `bun run typecheck` sin errores (no quedan usos) y
`bun test tests/unit/ui` → 54 pass.

### 6.1 — Guarda de deriva (FR-081 · SC-051)

`tema.test.ts` prohíbe además `text-foreground/<n>`, `text-xs`, dimensiones arbitrarias
(`max-w-[…]`, `min-h-[…]`, `w-[…]`…), `rounded-2xl` y `gap-<n>.<m>`. Verde sobre `src`. Mutación:
un archivo con los seis patrones da 6 hallazgos `archivo:línea` y rojo; al quitarlo, verde.

### 6.2 — AGENTS.md

Sección «Sistema visual»: dónde viven los tokens, qué primitiva usar para cada caso, jerarquía de
botones, reglas de layout y prohibición de literales. Revisión humana: pendiente en la PR.

## 5.2 — Compuerta completa (primera ejecución, 2026-09-25, local, `--workers=1`)

| Proyecto | Resultado |
|---|---|
| `chromium` | 29 passed |
| `chromium-dark` | 6 passed, **1 failed**: `color-contrast` en el historial de correcciones (`muted-foreground` sobre `bg-secondary/15` = 3.77:1) → tarea 5.5 |
| `firefox` | 28 passed, **1 failed**: «recorrido por teclado», un `DIV` (el `ScrollView` de `Screen`) recibe foco sin indicador → tarea 5.6 |
| `webkit` | 29 passed |

Estado: 5.2 **pendiente**. Se repite tras 5.5/5.6 y tras los grupos 7–8.

### 5.5 — Superficies tintadas opacas (D4 · FR-072 · SC-053)

Rojo: la guarda nueva de `tema.test.ts` (`bg|border|text|ring|outline-<token>/<n>`, salvo
`scrim`) y los pares de `primary-surface`/`secondary-surface` dieron 15 fallos. Entre ellos, la
guarda marcó `attribution-badge.tsx`, `segmento-respuesta.tsx` y `visor-documento.tsx`, pero no
el `bg-scrim/55` del diálogo de sesión.

Cambios:

- `primary-surface` y `secondary-surface` son una mezcla del 12 % sobre `card`: en claro,
  227 239 237 y 233 239 245; en oscuro, 27 60 54 y 32 51 53.
- En oscuro, `muted-foreground` pasa de 117 148 135 a 135 170 155, solo en luminosidad.
- Adopción:
  - evidencia y fragmento citado → `bg-primary-surface`;
  - ficha → `bg-secondary-surface`;
  - `AttributionBadge` → `bg-muted`.

Contraste de `muted-foreground` en oscuro:

| Superficie | Contraste |
|---|---|
| `primary-surface` | 4.73:1 |
| `secondary-surface` | 5.20:1 |
| `card` | 6.18:1 |
| `muted` | 5.94:1 |
| `background` | 8.09:1 |

Verde: `bun test tests/unit/theme` 224 pass, y `accessibility.spec.ts` en `chromium-dark` 7 passed.

Capturas a 1280 px:

- respuesta de `/knowledge`: [claro](evidencia/5.5-respuesta-light.png) · [oscuro](evidencia/5.5-respuesta-dark.png);
- historial de atribución: [claro](evidencia/5.5-correcciones-light.png) · [oscuro](evidencia/5.5-correcciones-dark.png).

### 5.6 — Foco visible en contenedores de desplazamiento (D3 · FR-080)

Rojo: en `firefox`, «recorrido por teclado» → `Foco sin indicador visible en DIV#`. Firefox hace
enfocable el `ScrollView` de `Screen` (`overflow-y: auto`, sin `tabindex` ni rol), que la lista
de selectores de `:focus-visible` no cubría.

Cambio: la regla pasa a `:focus-visible` para todo elemento enfocable, con el anillo hacia dentro
(`outline-offset: -2px`). Con el anillo exterior, un contenedor de ventana completa lo recortaba:
se computaba, pero no se veía. Los controles conservan el anillo exterior de 2 px.

Verde:

- `accessibility.spec.ts` completo: `chromium` 7 passed y `webkit` 7 passed.
- En `firefox` local, el contenedor enfocado computa `solid 2px` y coincide con `:focus-visible`
  ([captura](evidencia/5.6-firefox-scroll-foco.png)). El recorrido pasa `/patients`,
  `/patients/new`, la ficha y las dos consultas.

**Hallazgo aparte (entorno local, no del sistema visual):**

- En `/knowledge`, Firefox termina con el foco en `#error-toast`, el aviso de errores del
  servidor de desarrollo de Expo.
- El aviso aparece porque `parseRows` registra con `console.error` las filas de paciente que omite.
  En la base local hay cientos: datos mínimos (`{}`, `{"name": …}`) que dejan las suites de
  integración en vivo. Esas filas se omiten como está previsto (lectura tolerante).
- CI levanta un Supabase limpio para los e2e, así que ese estado no se reproduce allí. La
  verificación de `firefox` queda en el job de CI de la PR #38.

## Grupo 7 — Navegación

### 7.1 — `navegacion.spec.ts` en rojo (FR-082 · FR-083 · SC-054)

`provisionClinicalCase` y `syntheticScreens` pasan de `accessibility.spec.ts` a
`tests/e2e/web/caso-sintetico.ts`, compartido por ambas suites.

Resultado en `chromium`: 5 failed y 1 passed.

- Fallan por falta de navegación: `app-sidebar` y `app-tabbar` no existen, el enlace
  «Seguimiento» no existe y «Volver a Seguimiento» tampoco.
- Pasa: «todas las rutas cubiertas siguen resolviendo», la línea base antes de mover archivos.

### 7.2–7.8 — Navegación montada (FR-082 · FR-083 · SC-054)

- **7.2:** rutas en `(home)`, `(patients)` (incluye `consultations/[id]`), `(follow-up)` y
  `(knowledge)`, cada una con `SectionStack`. No cambió ninguna URL de los tests.
- **7.3:**
  - token `w-sidebar` (240 px);
  - `NavItem`, `SkipLink` y `SECTIONS` con prueba de componente (`tests/unit/navigation`,
    7 pass): enlace real con `href`, `aria-current`, peso, barra `bg-primary` y `bg-muted`;
  - `app-navigation.web.tsx`: `TabList` oculto que solo define las rutas, más las barras
    `app-sidebar` (desde `lg`) y `app-tabbar`.
  - `TabTrigger asChild` inyecta `justifyContent: space-between`: `NavItem` descarta ese `style`.
- **7.4:** `NativeTabs` con `sf`/`md` y colores del tema; `typecheck` verde. **Pendiente de
  dispositivo:** capturas iOS/Android en claro y en oscuro.
- **7.5:** la navegación se monta bajo el diálogo de sesión. En `auth.spec.ts` (sesión envejecida),
  con el diálogo abierto, el clic en «Pacientes» de la barra lateral no llega y 6 Tab no la
  alcanzan.
- **7.6:**
  - `Screen title`/`back`, con prueba de componente en rojo→verde (3 casos; los dobles de
    `expo-router` pasan al preload);
  - 11 pantallas sin `Head` suelto, y retroceso en los detalles;
  - las de conocimiento ganan su `h1`, antes empezaban en `h2`.
  - `contentInsetAdjustmentBehavior="automatic"` no es observable en web: **pendiente de
    dispositivo**.
- **7.7:** `SectionStack`:
  - `headerShown` solo en nativo;
  - título grande en la raíz iOS;
  - `headerBackButtonDisplayMode: "minimal"`;
  - colores del tema.
  **Pendiente de dispositivo:** capturas.
- **7.8:**
  - `/home` es un panel de enlaces (`home-patients`, `home-follow-up`, `home-knowledge`);
  - «Cerrar sesión» solo por debajo de 1024 px en web y siempre en nativo;
  - Maestro (`auth.yaml`, `attribution.yaml`) solo cubre `/login`: sin cambios.

Reflujo a 320 px: con 4 pestañas, «Conocimiento» a 14 px (89 px) no cabía en 80 px. Se añadió la
variante `nav` (12 px, `text-nav`, D17) y se retiró el recorte.

Resultado local en `chromium`: suite completa 34/35 antes de la variante `nav`; después,
`accessibility` + `navegacion` 13/13 y `navegacion` + `auth` 15/15.

Firefox/WebKit locales: sin fallos de foco. Quedan 2 limitaciones del entorno local:

- el recorrido por teclado supera sus 150 pasos en `/knowledge`, porque la base local tiene 639
  pacientes sintéticos, un radio por paciente;
- el caso de reflujo agota sus 30 s en Firefox.

Ambas se verifican de nuevo sobre una base limpia (5.2/5.6).

## Grupo 10 — Apariencia, cuenta y agenda (US16)

- **10.1 Tema manual (FR-091):**
  - rojo→verde en `tema.test.ts`: los bloques `:root.light`/`:root.dark` repiten los tokens;
  - rojo→verde en `theme-preference.test.ts`: 8 casos de resolución, hidratación, persistencia y
    degradación a `system`.
  - e2e `tema.spec.ts`:
    - el botón cambia a oscuro sin recargar, y `--background` pasa a `1 4 4`;
    - tras recargar sigue oscuro y axe da 0 violaciones;
    - «Sistema» lo devuelve a claro;
    - con el bundle bloqueado, el script de `+html.tsx` ya pone `dark` en `<html>` (sin destello).
- **10.2 `Avatar`:**
  - prueba de componente: iniciales con «Dra.», acentos, espacios y vacío; decorativo; `min-h-touch`
    y `min-w-touch`.
  - Las iniciales van en `foreground`: `primary` sobre `primary-surface` daba 4.3:1 en claro.
- **10.3 Configuración:**
  - la quinta sección (`/settings`) tiene perfil (avatar, nombre, correo), apariencia (Sistema,
    Claro, Oscuro) y sesión;
  - la barra lateral lleva 5 secciones y un pie con avatar, tema y cierre de sesión;
  - `app-topbar` por debajo de `lg`, con la marca, el tema y el avatar-enlace;
  - la barra inferior conserva las 4 clínicas (`TABBAR_SECTIONS`);
  - `NativeTabs` con 5.
  - e2e: Configuración a 1 activación a 1280 y a 375 px.
  - La edición de datos personales queda en `perfil-profesional`; la pantalla lo indica.
- **10.4 Calendario:**
  - `react-native-calendars@1.1314.0` (MIT, JS puro, 9 paquetes transitivos) instalado con
    `bunx expo install`; justificación en design.md (Complexity Tracking).
  - `bunfig.toml` carga `.png` como archivo, porque el paquete importa imágenes.
  - Pruebas unitarias (6):
    - `toMarkedDates` usa la zona del evento, agrupa por día e ignora los cancelados;
    - mes en español, semana desde el lunes, estado vacío y flechas con nombre.
  - La cabecera del paquete se sustituye (daba `slider` sin nombre en axe).
  - e2e: mes navegable y axe verde en claro y en oscuro.

Resultado local en `chromium`:

- La suite completa dio 34 passed hasta que el Metro del servidor de pruebas agotó su heap (OOM de
  la máquina local).
- `retroalimentacion` + `tema`, corridas aparte: 10 passed.
- El recorrido por teclado sube su tope de 150 a 250 paradas: la navegación suma unas 10 por
  pantalla.
- Repetición tras 10.5 (2026-09-25), en `chromium` y de una en una: `navegacion` + `tema` 12 passed
  y `accessibility` 7 passed (incluye el reflujo a 320 px con 5 secciones). `typecheck`,
  `biome ci --error-on-warnings` y `bun run test` (725 pass, 75 skip, 0 fail) en verde.
- **10.5:** `AGENTS.md` suma `Avatar`, `MonthCalendar`, la variante `nav` y la preferencia de tema.

## Grupo 8 — Patrones nativos de interacción

- **8.1 `Link` y `LinkText` (FR-084):**
  - `link.test.tsx`: el mock de `expo-router` reproduce `Link asChild` como el real en web (el
    `Slot` de Radix con `href` y `role="link"`).
  - `Button` bajo `Link asChild` ya daba `<a href>`, porque sus props van después de
    `role="button"`. Se comprobó por mutación: con `role="button"` después de las props, la prueba
    falla con un `<button href>`.
  - `LinkText`: rojo por el módulo vacío y por el doble color (`text-foreground` + `text-primary`),
    y verde con el tono nuevo `primary` de `Text`.
- **8.2 Navegación con `Link` (FR-084 · SC-055):**
  - Caso nuevo en `accessibility.spec.ts` («los controles de navegación son enlaces y no botones»),
    que recorre `/home` y las pantallas del caso sintético. Rojo: `patients-register` en
    `/patients` era un `<button>` sin `href`.
  - Migrados a `<Link href asChild>`: `patients-register`, `patient-open`, `history-open`
    (`PatientHistory` ya no recibe `onOpen`), `consultation-patient`, `follow-up-open`,
    `conocimiento-incorporar`, `ver-fuente-*` y `ver-contexto-*`. Los de `/home` ya lo eran.
  - `router.push`/`replace` solo quedan tras una operación: guardar una ficha, abrir una consulta
    e incorporar una fuente.
  - `conocimiento.spec.ts` y `registro-epicrisis.spec.ts` localizaban dos de esos controles por el
    rol `button`; ahora usan `link`.
  - Verde en `chromium`, de una en una: `accessibility` 8, `registro-epicrisis` 2, `conocimiento`
    5, `retroalimentacion` 5, `navegacion` 7 y `attribution` 2. En la primera corrida completa de
    `accessibility`, el recorrido por teclado falló una vez; no se reprodujo en 3 corridas más
    (queda a observar en 5.2).
- **8.3 `QueryState` (FR-085):**
  - `query-state.test.tsx`, 6 casos: carga con `aria-busy` y sin vacío aunque `isEmpty`; error con
    `Callout` y «Reintentar»; `onRetry` invocado; vacío; contenido; la carga precede al error.
  - Rojo por el módulo ausente. El caso de reintento se comprobó por mutación: sin `onPress`, falla.
  - Además de las props de D13, recibe `errorMessage` y el prefijo `testID` (`-loading`,
    `-status`), para conservar los `testID` de las pantallas.
- **8.4 Adopción de `QueryState` (FR-085 · SC-056 · US14-AC5):**
  - La usan `/patients`, `/follow-up`, `/knowledge/sources`, `/knowledge/sources/[id]`,
    `PatientHistory` y `FeedbackTimeline`. Los dos historiales reciben ahora `isPending`, `error` y
    `onRetry`: antes decían «Sin consultas…» o «Sin retroalimentación…» mientras la lectura seguía
    en curso.
  - Estados vacíos redactados. En `/patients` y `/knowledge/sources`, la acción de alta pasa al
    vacío y la cabecera la oculta, para que haya una sola en pantalla. `/follow-up` enlaza a
    «Registrar paciente» con `LinkText`.
  - El error de `QueryState` usa el sufijo `-error` (`fuente-error`, `patients-error`…), porque
    `fuente-status` ya era el aviso del retiro.
  - Pruebas en rojo primero:
    - `historiales-estados.test.tsx`: 4 casos rojos de carga y error;
    - `estados.spec.ts`: rojo por `fuentes-loading` y `patients-error` ausentes.
  - La «clínica sin fuentes» se reproduce respondiendo `knowledge_documents` con `[]` mediante
    `page.route`, con la respuesta retenida para afirmar «Cargando…» con `aria-busy` y sin vacío.
    La base local tiene una sola clínica sintética. El error se simula con un 500 en la lista de
    pacientes, y «Reintentar» la recupera.
  - `conocimiento.spec.ts` ahora afirma `fuente-loading` ausente, en vez del texto antiguo.
  - Verde en `chromium`, de una en una: `estados` 2, `conocimiento` 5, `registro-epicrisis` 2,
    `retroalimentacion` 5, `navegacion` 7, `attribution` 2 y `auth` 8. `accessibility`: 7 de 8.
- **Pendiente a observar en 5.2:**
  - «Recorrido por teclado» falla de forma intermitente en `/knowledge` («no alcanzó
    `conocimiento-pregunta`»): 2 veces en unas 30 corridas, antes y después de 8.4.
  - No se reprodujo a demanda: 17 corridas seguidas en verde, incluso con la lista de pacientes
    retrasada 400 ms.
  - Sin causa raíz confirmada no se cambia la prueba. Su mensaje ahora incluye la URL, la primera
    parada y las paradas alcanzadas.
- **8.5 Listas con `FlatList` (FR-086):**
  - `screen-list.test.tsx`, en rojo primero:
    - con 200 filas no las pinta todas;
    - en web, el título y las acciones van dentro de la lista, antes de las filas;
    - no hay `-scroll` anidado;
    - el vacío va dentro de la lista.
  - `ScreenList` sustituye la combinación `Screen scroll={false}` + `FlatList` de D13 (design.md
    actualizado).
  - Los `readyTestID` de `/patients` y `/follow-up` pasan a la primera fila (`patient-item`,
    `follow-up-patient-item`): el `FlatList` existe antes de que lleguen los datos.
  - Verde en `chromium`, de una en una: `accessibility` 8 (incluye el reflujo a 320 px),
    `navegacion` 7, `tema` 5, `estados` 2, `conocimiento` 5 y `retroalimentacion` 5.
- **8.6 Texto copiable (FR-087):**
  - `Text` ya pasa `selectable` a RN, porque hereda sus props: no hizo falta tocarlo.
  - `callout.test.tsx`, rojo→verde: el texto de un `Callout tone="error"` es seleccionable, y el
    de los demás tonos no se marca. `QueryState` marca su mensaje de error.
  - Se activa en:
    - la ficha (valores, tutor y nombre en la lista);
    - los antecedentes;
    - el texto de la anamnesis;
    - los hechos del borrador de voz y su fragmento de origen;
    - el título, los autores y los fragmentos del visor;
    - el título y la referencia de las citas;
    - las líneas del resumen de seguimiento.
  - La epicrisis efectiva se muestra en campos `TextInput` no editables: en web ya se puede
    seleccionar, y en nativo queda pendiente de verificar en dispositivo.
  - e2e en `estados.spec.ts`: triple clic y `getSelection` sobre el nombre de un paciente y sobre
    el mensaje de error, más `user-select: text`. Sin el cambio, falla con `auto`.
  - Verde en `chromium`: `estados` 3, `conocimiento` 5, `registro-epicrisis` 2 y
    `retroalimentacion` 5.
- **8.7 Teclado (FR-088):**
  - `Screen` envuelve su `ScrollView` en `KeyboardAvoidingView`: `padding` en iOS y sin
    comportamiento en Android.
  - `app.json` no declara `softwareKeyboardLayoutMode`, pero Expo lo pone en `resize` por
    defecto (`@expo/config-types`), así que se cumple lo que supone D14.
  - `layout.test.tsx`, rojo→verde en iOS y Android: el mock expone `behavior` como
    `data-behavior`.
  - `typecheck` en verde. **Pendiente de dispositivo:** la captura de `/patients/new` con el
    teclado abierto y el botón de guardar visible.
  - El caso de reflujo de `accessibility.spec.ts` agotó una vez los 30 s por defecto. Aislado
    tarda unos 23 s en 36 cargas. Se le fija `test.setTimeout(90_000)` y la suite queda en 8 de 8.
    `registro-epicrisis` 2 y `auth` 8 en verde.
- **8.8 Estilo de código de D15:**
  - La guarda de `tema.test.ts` suma `Platform.OS` y `useContext(`. En rojo fallaba en 7 archivos:
    - 4 usos de `Platform.OS` (`gluestack`, `use-session-activity`, `query-client`,
      `platform-auth-storage`);
    - 3 de `useContext` (`button`, `form-control`, `auth-provider`).
  - Después, `process.env.EXPO_OS` y `use` de React 19.
  - `border-curve.test.tsx`, rojo→verde: `Card`, `Callout`, `Input` y `SuggestedBlock` llevan
    `borderCurve: "continuous"`, y `Button` también en iOS, incluso bajo `Link asChild`.
  - Regresión encontrada con la compuerta axe: el botón «Iniciar sesión» quedó con contraste
    1.51. NativeWind acumulaba `opacity-50` del estado deshabilitado al recibir un `style`
    compuesto en web.
  - Aislada con y sin el cambio de `Button`: 2 fallos contra 6 de 6 en verde. Se corrigió con una
    prueba en rojo («Button no toca su style en web»).
  - Verde: `accessibility` 8, `navegacion` 7, `auth` 8, `tema` 5 y `conocimiento` 5; 757 pruebas
    unitarias.

## Grupo 11 — Ancho por tipo de pantalla (D18)

- **11.1:** nuevo caso en `accessibility.spec.ts` («a 1280 px la lista de pacientes va a 2
  columnas y el formulario sigue en 720 px»). Rojo: dos tarjetas a 98 px de distancia vertical.
- **11.2:**
  - `ScreenList` gana `width` y `listColumns(width, ventana)`: 2 columnas con `wide` y 1280 px o
    más.
  - `key` por número de columnas, y cada ítem va en un `View flex-1` cuando hay varias.
  - `screen-list.test.tsx` en rojo primero: el ancho de `max-w-content`/`max-w-wide` y 4 casos
    de columnas. El mock expone `contentContainerClassName` como `data-content-class`.
  - Adoptado en `/patients`, `/follow-up` y `/knowledge/sources`. El caso de 11.1 pasa a verde.
- **11.3:**
  - `/home` (accesos | agenda), `/settings` (perfil | apariencia y sesión) y `/patients/[id]`
    (`patient-main` | `patient-aside`) usan `width="wide"` y `lg:flex-row`, sin cambiar el orden
    del DOM.
  - Caso nuevo en `accessibility.spec.ts`: a 1280 px, la segunda columna va a la derecha y
    alineada arriba; a 375 px, debajo. Rojo en `/home`.
  - El primer intento medía `patient-history`, que en la columna derecha queda bajo los
    antecedentes. Se pasó a medir los contenedores de columna.
  - Verde en `chromium`: `accessibility` 10 (incluye el recorrido por teclado y el reflujo),
    `navegacion` 7, `tema` 5 y `registro-epicrisis` 2.
- **11.4:**
  - Axe en `chromium-dark`: `accessibility.spec.ts` 10 de 10 (incluye el reflujo a 320 px y los
    casos de D18). En `chromium`, 10 de 10 en 11.3.
  - Capturas en `evidencia/`: `11.4-home-1280.png`, `11.4-home-1440.png`,
    `11.4-pacientes-1280.png`, `11.4-pacientes-1440.png`, `11.4-ficha-1280.png` y
    `11.4-ficha-1440.png`.
  - En la de pacientes aparece el aviso del overlay de desarrollo de `@expo/log-box`
    (`registro.row_content_skipped`, por filas sintéticas ilegibles de la base local). No existe
    en producción.
- **8.9:** la sección «Sistema visual» de `AGENTS.md` suma:
  - `Screen title`/`back`, `ScreenList`, `QueryState` y `Link`/`LinkText`;
  - el ancho por tipo de pantalla, el texto copiable y el estilo de código;
  - las desviaciones de D15.

## Grupo 9 — Acceso con gestor de contraseñas y tarjeta (D16)

- **9.1:** `login.spec.ts`, en rojo por cada caso:
  - `form` con `method="post"`, `action="/login"`, `name`/`id`/`autocomplete` de credenciales y
    sin `readonly`;
  - «Mostrar contraseña» con `aria-pressed`;
  - Intro envía un único `submit` sin recargar;
  - un valor escrito antes de la hidratación (`addInitScript` en `readystatechange`) se conserva
    y permite entrar;
  - tras un error se conserva el correo y se vacía la contraseña.
- **9.2:**
  - `auth-form.web.tsx` es un `<form>` real con `preventDefault`, y `auth-form.tsx` un `View`.
  - RNW no reenvía `name` en `TextInput`: el formulario web asigna `name` = `id` al montar.
  - RNW siempre pinta `type="button"`: `Button` gana `type="submit"`, que en web se fija en el
    nodo al montar. En web el envío llega por el `submit` del formulario; en nativo, por `onPress`
    y por `onSubmitEditing`.
  - Se retira `editable={isHydrated}`. Lo escrito antes de hidratar se lee del DOM en el primer
    render del cliente y se adopta al montar, y el botón sigue deshabilitado hasta hidratar.
  - `InputField` acepta `ref` (React 19), para pasar el foco del correo a la contraseña.
- **9.3:**
  - `Card max-w-form` con la huella de marca, `Heading` y descripción; el error va en
    `Callout tone="error"`.
  - `PasswordToggle` (`password-toggle.test.tsx`, 4 casos en rojo primero): nombre
    «Mostrar/Ocultar contraseña», `aria-pressed`, `min-h-touch`/`min-w-touch` e icono decorativo.
  - Regresión encontrada en la captura de 320 px: el ojo se salía del campo, porque el `<input>`
    web tiene ancho intrínseco. Tiene prueba roja en `login.spec.ts` y se corrige con `min-w-0`
    en `InputField`.
  - Axe: `chromium` 11 y `chromium-dark` 11, incluido el nuevo reflujo de `/login` a
    320/375/1280 px.
  - Capturas: `evidencia/9.3-login-{320,1280}-{claro,oscuro}.png`.
- **Ajustes de pruebas existentes:**
  - `getByLabel("Contraseña")` pasa a ser exacto, porque «Mostrar contraseña» también coincide.
  - En el recorrido por teclado, el control nuevo va entre la contraseña y el envío.
  - El texto de un `Callout` incluye el glifo del icono: `calloutText()` en `fixtures.ts`.
  - La espera de hidratación pasa de «campo editable» a «botón habilitado».
- **Verde:** `login` y `auth` en `chromium`, `firefox` (13) y `webkit` (13). En `webkit`, el caso
  del control fallaba al pulsar Intro antes de la hidratación: ahora la espera.
- **Causa del fallo intermitente del recorrido por teclado (8.2/8.4):**
  - El mensaje ampliado lo mostró en la ficha: el recorrido empezaba con el historial aún
    cargando (`missing-fields-panel` aparece antes).
  - El `readyTestID` de la ficha pasa a `history-open`.
  - `accessibility` + `navegacion`: 18 de 18. El fallo anterior en `/knowledge` queda a observar
    en 5.2.

### 5.6 y 5.7 — Foco por teclado (cierre, 2026-09-25)

- **Causa del fallo intermitente del recorrido en `/knowledge`:**
  - El mensaje de diagnóstico lo mostró en `firefox`: `OptionPicker` hacía de cada opción una
    parada de Tab, y el selector de paciente pintaba una por ficha (más de 250 en la base local).
    El recorrido agotaba su tope antes de llegar a la pregunta.
  - En `chromium` solo fallaba cuando la lista llegaba antes del recorrido.
  - Decisión del usuario: D19 (tabindex itinerante y buscador, 5.7 y 5.8).
- **5.7:**
  - Caso nuevo en `accessibility.spec.ts` sobre el grupo «Tema» de `/settings`:
    - `tabindex` 0 solo en la opción elegida;
    - flecha derecha, `End` y vuelta al inicio;
    - el siguiente Tab sale del grupo.
  - Rojo: todas las opciones tenían `tabindex` 0.
  - `OptionPicker` con `tabIndex` y `onKeyDown` (web). `Button` acepta `ref` como prop.
  - `keyboardTestIDs` del caso sintético: una parada por grupo (se quitan `tutor-mode-new` y
    `antecedent-finding-negative`; seguimiento pasa a `desconocida`).
  - El recorrido lleva `test.setTimeout(90_000)`, porque en `firefox` tarda unos 57 s en 12
    pantallas.
  - Verde: el caso nuevo y el recorrido por teclado en `chromium`, `firefox` y `webkit`.
- **5.6:**
  - El rojo y el arreglo (`:focus-visible` para todo elemento enfocable) ya estaban en `d59fbce`.
  - Con 5.7, el recorrido pasa en los tres navegadores, que era la verificación pendiente.
  - La mutación (quitar la regla genérica) ya no lo pone en rojo en `firefox`: tras `ScreenList` y
    `KeyboardAvoidingView`, el recorrido ya no enfoca un contenedor de scroll. La regla se
    conserva por si otro contenedor vuelve a ser enfocable.
- **5.8 Selector de paciente con búsqueda (FR-095 · US14-AC6):**
  - `filtrar-pacientes.test.ts`, 7 casos en rojo primero:
    - sin búsqueda, las 8 primeras fichas;
    - sin mayúsculas ni tildes;
    - búsqueda por raza y especie;
    - tope de 8;
    - el elegido siempre, y primero si no coincide;
    - sin coincidencias;
    - `contarCoincidencias`, el total real sin tope.
  - `SelectorPacienteContexto`: el campo «Buscar paciente», el recuento en región viva
    (`selector-paciente-contexto-recuento`) y el `OptionPicker` con las opciones filtradas.
  - e2e en `conocimiento.spec.ts`: crea una ficha «Búho E2E …», la busca como «buho e2e …», ve
    «1 paciente coincide» y 2 opciones, y la elige. Rojo por el campo ausente.
  - Verde: `conocimiento` 6; `accessibility` 12 en `chromium` y 12 en `chromium-dark` (incluye
    axe de `/knowledge`); 778 pruebas unitarias.

### 5.3 — Escala de grises y `forced-colors` (US13-AC2/AC3)

- **Capturas en `evidencia/`, en `chromium` a 1280 px** (`filter: grayscale(1)` y
  `emulateMedia({ forcedColors: "active" })`):
  - `5.3-conocimiento-grises.png` y `5.3-conocimiento-forced-colors.png`: respuesta con fuentes
    y una inferencia;
  - `5.3-consulta-grises.png` y `5.3-consulta-forced-colors.png`: consulta cerrada con epicrisis
    corregida;
  - `5.3-seguimiento-grises.png` y `5.3-seguimiento-forced-colors.png`: evento adverso grave.
- **Resultado:**
  - Lo sugerido se distingue de lo validado sin color: barra lateral, «Sugerencia del sistema»
    con icono y «Inferencia del sistema», frente a «Fuente documental · recuperada» con la cita.
  - La severidad «Grave» lleva icono, nombre y negrita en ambos modos.
- **Hallazgo corregido:** en `forced-colors`, los botones rellenos (`primary`, `destructive`)
  perdían el fondo y quedaban como texto suelto. En rojo en `button.test.tsx`, y después con
  `border border-transparent`, que el modo de alto contraste pinta. Axe en `chromium` y
  `chromium-dark`: 12 de 12 tras el cambio.

### 5.4 — Texto ampliado (FR-074)

- Zoom del 200 % en una ventana de 1280 px, emulado como viewport de 640×450 CSS con
  `deviceScaleFactor: 2` (método de WCAG 1.4.4), en `chromium`.
- `/patients` y `/consultations/<abierta>`:
  - sin desplazamiento horizontal;
  - 0 nodos de texto recortados (`overflow: hidden/clip` con contenido mayor que la caja, o
    `text-overflow: ellipsis`);
  - la navegación pasa a la barra superior compacta y las pestañas inferiores.
- Capturas: `evidencia/5.4-pacientes-zoom-200.png` y `evidencia/5.4-consulta-zoom-200.png`.
- **Pendiente de dispositivo:** Dynamic Type al máximo en iOS y el tamaño de fuente máximo en
  Android.

### 5.2 — Compuerta axe completa, repetida tras los grupos 7–11 (SC-050)

- Local, de uno en uno con `--workers=1`, sobre `8990c3e`/`3c12ff4`, con `accessibility.spec.ts`
  (12 casos):

  | Proyecto | Resultado |
  |---|---|
  | `chromium` | 12 passed |
  | `chromium-dark` | 12 passed |
  | `firefox` | 12 passed |
  | `webkit` | 12 passed |

- Los 12 casos incluyen:
  - axe en `/login`, en su error y en todas las pantallas del caso sintético;
  - el recorrido por teclado;
  - los grupos de opciones;
  - los enlaces de navegación;
  - las dos columnas de la consulta y de D18;
  - el reflujo a 320/375/1280 px, también de `/login`.
- CI verde en `8990c3e`:
  https://github.com/pbadillatorrealba-idia/diklass/actions/runs/36185078838.
  - En la PR, CI solo corre `chromium`.
  - La matriz `firefox`/`webkit` (`web-e2e-full-matrix`) solo corre en `push`, así que quedó
    *skipped* en la rama. Su resultado es el local de la tabla, y en CI queda **pendiente** del
    `push` a `main`.
  - `chromium-dark` no corre en CI.
- El fallo intermitente del recorrido por teclado queda explicado y corregido (5.7, 5.8 y la
  espera de `history-open`).

## Revisión de la PR #38 (6.5)

Informe completo: https://github.com/pbadillatorrealba-idia/diklass/pull/38#issuecomment-5839341007
(revisión de `eb1f2e1..3d4732f`, veredicto «Con correcciones»).

**Importantes, cada uno con su prueba en rojo primero:**

1. **Cronología de seguimiento en «Cargando…» perpetuo si fallan las consultas:** corregido.
   - Prueba roja en `estados.spec.ts`.
   - Ahora `isPending` depende de `consultationsQuery.isSuccess`.
2. **`tabIndex` -1 también en nativo (en RN, `focusable=false`):** corregido. Solo se aplica en
   web, con prueba en `option-picker.test.tsx` para ios y android.
3. **Días del calendario como botones sin acción (35 paradas de Tab):** corregido.
   - `CalendarDay` propio, de solo texto: hoy con `border-2` y negrita; los días con eventos, con
     fondo y subrayado.
   - Pruebas: unitaria y e2e en `tema.spec.ts`.
   - Captura: `evidencia/10.4-agenda-dias-texto.png`.
4. **FR-093, FR-091 y FR-092 frente al código:** se enmendó la spec, alineada con D17 y con YAGNI.
   - FR-093: el enlace «Editar datos personales» llega con `perfil-profesional`.
   - FR-091: en nativo, el control es el selector de Apariencia.
   - FR-092: la `uri` de la foto queda fuera de este cambio.
5. **Regiones vivas que se montan ya con su texto:** corregido.
   - `Callout tone="error"` pasa a `role="alert"`.
   - El recuento del selector queda siempre montado. Rojo comprobado por mutación.
6. **Teclado nativo:** `KeyboardAvoidingView` sale y entra `automaticallyAdjustKeyboardInsets` en
   `Screen` y en `/login`.
   - D14 y la Complexity Tracking, actualizados.
   - Verificación en dispositivo: **pendiente**.
7. **`CalendarEvent` especulativo:** se registra en la Complexity Tracking con su alternativa
   mínima. Se conserva por la decisión del usuario en D17 y FR-094.

**Menores:**

- **Corregidos:**
  - las refs de `Button` se fusionan con `type="submit"`;
  - se retira la prop `scroll` de `Screen`, sin uso desde `ScreenList`, y se reescribe tasks 8.5;
  - `back.href` se tipa como `Href`;
  - el script de `+html.tsx` usa `THEME_STORAGE_KEY`;
  - la marca de la navegación es `Text` y no `h2`;
  - el enlace de salto no recibe clics sin foco;
  - el filtro de tildes usa `[\u0300-\u036f]` en lugar de `\p{Diacritic}` (Hermes);
  - Non-Goals de design.md;
  - «Mostrar contraseña» conserva el nombre con `aria-pressed`, tras enmendar US15-AC4 según el
    patrón ARIA.
- **No aplicados, con motivo:**
  - `catch {}` del almacén de tema: la degradación a `system` es el manejo que exige FR-091, no un
    error silenciado.
  - `aria-labelledby` en `SuggestedBlock`: FR-076 y la tarea 3.6 piden `accessibilityLabel` con el
    prefijo.
- **Pendientes registrados:**
  - el error de página de `/follow-up/[patientId]` sigue siendo un `Text` sin reintento (la
    cronología ya tiene el suyo);
  - los estados de carga y error de la lista de pacientes del selector de `/knowledge`;
  - una señal visible de «Reintentar» mientras vuelve a cargar (`isFetching`);
  - confirmar `normalize("NFD")` en Hermes en dispositivo;
  - un hash o nonce para el script de `+html.tsx` si se añade CSP;
  - la verificación de 7.5 vive en `auth.spec.ts`, no en `navegacion.spec.ts`.

**Verificación tras las correcciones:**

- local: `typecheck`, `biome ci --error-on-warnings` y `bun run test` (784 pass, 0 fail);
- e2e `chromium`: navegacion 7, tema 6, login 6, auth 8, conocimiento 6, estados 4,
  accessibility 12, retroalimentacion 5 y registro-epicrisis 2;
- `chromium-dark`: accessibility 12.

## Cierre (6.4) — estado a 2026-09-25

**Compuertas:**

- local, sobre `1181915`: `bun run typecheck`, `bunx biome ci --error-on-warnings .` y
  `bun run test` (784 pass, 75 skip de suites vivas, 0 fail);
- CI verde en `1181915`:
  https://github.com/pbadillatorrealba-idia/diklass/actions/runs/36189923114 (`chromium` en la PR);
- e2e local tras la revisión:
  - `firefox` y `webkit`: accessibility, login, auth y tema, 32/32 cada uno;
  - `chromium`: todas las suites;
  - `chromium-dark`: accessibility 12/12.

**Estado:** todo lo anterior está **implementado y verificado** según su tarea. Nada de esto
equivale a **aceptado**: la aceptación la da la revisión humana de la PR #38.

**Pendientes explícitos:**

- **Nativo, pendiente de dispositivo:**
  - modo oscuro (1.2) y peso 600 de la fuente (1.3);
  - capturas de `NativeTabs` y de las cabeceras (7.4, 7.7);
  - flujos de Maestro (7.8);
  - teclado en `/patients/new` y `/login` (8.7 y la revisión);
  - Dynamic Type (5.4);
  - autocompletado de credenciales en iOS/Android (9.4);
  - `normalize("NFD")` en Hermes.
- **iOS:** el guardado en el llavero exige Associated Domains con un dominio desplegado.
- **CI:** la matriz `firefox`/`webkit` corre en `push` a `main`; en la PR solo está la
  verificación local.
- **Aceptación conjunta de FR-076/FR-077 con 003–005:** el sugerido/validado y las severidades se
  usan en esas features.
- **Menores de la revisión** registrados arriba: la señal de reintento y el CSP. Los estados de
  error y reintento del seguimiento y del selector de `/knowledge` se corrigieron tras la revisión
  profunda de `85b265f` (detalle abajo).

### 9.4 — Guardado de credenciales (FR-089 · US15-AC1/AC2)

- **Chrome de escritorio (2026-09-25):** verificado a mano por el usuario en su Chrome, con
  perfil real, sobre `/login` local con `vet.ana@example.test`. El gestor ofreció guardar la
  contraseña tras entrar y la rellenó en la visita siguiente.
- **Cambio respecto a la tarea:** no hay captura. El diálogo del gestor es interfaz del
  navegador, fuera de la página: ni `page.screenshot` de Playwright ni un `launchPersistentContext`
  headless lo muestran. La evidencia es la confirmación del usuario.
- **Pendientes de dispositivo:**
  - que el teclado de iOS/Android ofrezca las credenciales guardadas;
  - el guardado en el llavero de iOS, que además exige Associated Domains con un dominio
    desplegado.

### Revisión profunda de la PR #38 (2026-09-25)

El informe sobre `eb1f2e1..85b265f` está en el comentario de la PR
`https://github.com/pbadillatorrealba-idia/diklass/pull/38#issuecomment-5840066178`. El veredicto
fue «No» por tres incumplimientos de producto y por la verificación nativa pendiente. Tras el
informe se corrigieron los puntos de código:

- FR-086: la cronología y sus antecedentes usan una sola `FlatList`, con formulario en el pie; las
  correcciones se agrupan en una pasada.
- FR-087: el texto clínico de los segmentos de respuesta y la cronología lleva `selectable`.
- FR-085: un fallo de lectura de la ficha de seguimiento o de los pacientes de Conocimiento muestra
  error y «Reintentar».

Las pruebas nuevas fallaron antes de cada corrección. Después pasaron `typecheck`, Biome, 790
pruebas unitarias/de integración (75 pruebas vivas omitidas por entorno), los 17 casos web
afectados en Chromium (`conocimiento.spec.ts`, `estados.spec.ts`, `retroalimentacion.spec.ts`) y
los 22 de `estados` y `retroalimentacion` en Firefox/WebKit. La compuerta `accessibility.spec.ts`
pasó 12/12 en Chromium claro y 12/12 en Chromium oscuro. La primera ejecución conjunta terminó
tras 19 casos por OOM del servidor Metro (heap de 2 GB); la repetición aislada de oscuro con
`NODE_OPTIONS=--max-old-space-size=4096` pasó 12/12. No hay `adb` ni simulador iOS disponibles:
la verificación nativa de la lista de pendientes anterior sigue abierta y no hay aceptación de la
PR.
