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
