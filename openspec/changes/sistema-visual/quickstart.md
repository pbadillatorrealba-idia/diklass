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
