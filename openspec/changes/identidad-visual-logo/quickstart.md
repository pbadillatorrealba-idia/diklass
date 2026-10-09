# Quickstart: identidad visual

## Grupo 1 — paleta (FR-103 · FR-104)

- Rojo: `bun test tests/unit/theme/tema.test.ts` → 6 fallos (`paleta de marca …`) con la paleta salvia.
- Verde: tras aplicar los valores en `src/global.css` y `src/theme/colors.ts`, `bun test tests/unit/theme` → 312 pass, 0 fail (incluye todos los pares AA, el espejo CSS↔TS y `stamp`↔`primary` ΔE*ab ≥ 10 en los cuatro bloques).
- Valores finales (RGB en el tema): claro — primary `62 56 136`, foreground `37 17 52`, background `241 240 246`, accent `29 118 114`, stamp `31 78 158`; oscuro — primary `185 179 242`, background `20 18 28`, accent `108 201 194`, stamp `140 178 245`.
- Desviación respecto a design.md D2: el teal claro se oscureció de `#2F8F8A` a `#1D7672` para cumplir 4.5:1 con `accent-foreground` blanco (solo luminosidad, como prescribe D1).
- `DESIGN.md` actualizado (frontmatter y prosa). Nota: su principio rechazaba «el violeta con que la categoría marca la IA»; se matizó: el índigo de marca es tinta mate, no un marcador de IA. Pendiente: confirmar con capturas que no lee como «IA».

## Grupo 2 — assets (FR-101)

- Rojo: `bun test tests/unit/brand` → 3 fallos (sin `icon`, `adaptiveIcon` ni `web.favicon` en `app.json`). Verde tras cablear: 3 pass.
- Generados por `scripts/brand/generar-assets.py` (Pillow; herramienta de desarrollo) desde `logo-fuente.png`: `icon.png` (1024², RGB), `adaptive-icon.png` (1024², RGBA, isotipo en el 66 % central), `favicon.png` (48²), `wordmark-blanco.png`/`wordmark-tinta.png`, `isotipo-blanco.png`, `splash-wordmark.png`. Cotejo visual: filos limpios a tamaño de uso (el isotipo se amplía 2,1×).
- El favicon lo emite `expo export` desde `web.favicon` (`/favicon.ico`); no hace falta `<link>` manual.
- Splash (2.2): añadida la dependencia `expo-splash-screen@~57.0.9` (decisión del usuario; design.md prometía ninguna) con `bunx expo install`; plugin en `app.json` con `splash-wordmark.png` (240 px) sobre `#2D1E50`. Prueba añadida a `tests/unit/brand/assets.test.ts`.

## Grupo 3 — logo en la interfaz (FR-102)

- Rojo: `tests/unit/ui/logo.test.tsx` por módulo inexistente → verde con `src/components/ui/logo.tsx`.
- `Logo` en `/login` (lg) y en la barra superior (sm) y lateral (md) de la navegación web. La navegación nativa no muestra marca de texto y no se tocó.
- Capturas: `evidencia/3.2-login-light.png`, `evidencia/3.2-login-dark.png`.
- axe sobre `/login` (export estático, sin Supabase): claro 0 violaciones; oscuro 1 `color-contrast` en `#username`/`#password` (texto escrito `foreground` claro sobre fondo oscuro). **Preexistente**: el mismo export de `main` da el mismo fallo con `#1b1d1f` sobre `#1b1f1f`; no lo introduce este cambio. Pendiente 3.3: la compuerta completa (`accessibility.spec.ts`) necesita Supabase local, hoy parado.
- Observación: la tarjeta de `/login` conserva su icono de pata + encabezado «Diklass» bajo el logo (marca duplicada, y la pata choca con «lo lúdico» de DESIGN.md). Fuera del alcance de las tareas; se propone quitarlos.
- `bun test tests/unit`: 940 pass, 0 fail; `tsc --noEmit` y `biome check` limpios.

## Cambios tras la revisión del usuario

- `/login`: se quitó el ícono de pata y el título «Diklass»; el `h1` pasa a «Acceso para profesionales veterinarios» (se actualizó `auth.spec.ts`). `Logo` es ahora la única marca de la pantalla.
- `DESIGN.md`: el rechazo al «violeta de la IA» se reemplazó por «degradados luminosos» (sin matiz).
- `Logo` con ancho explícito: sin él, el `<img>` oculto de RN Web heredaba el ancho natural del PNG y `/login` desbordaba a 320 px (rojo en `accessibility.spec.ts`, verde tras el fix; prueba unitaria añadida).
- Merge de `origin/main` (`d0e40ad`) sin conflictos.

## Grupo 3.3 — compuerta de accesibilidad (SC-062)

Con Supabase local y veterinarios provisionados, de a una proyecto a la vez:
- `chromium`: 12 passed, 0 violaciones.
- `chromium-dark`: 10 passed, 2 failed — `login` y `login error`, `color-contrast` 1.01:1 en `#username`/`#password`. **Preexistente**: `main` (`d0e40ad`) falla igual (`#1b1d1f` sobre `#1b1f1f`). Causa observada: el texto escrito del `Input` queda con el color del esquema claro (`rgb(37 17 52)`) en la web exportada con el sistema en oscuro, es decir, es un fallo real y no de esta paleta. Se deja fuera de este cambio; SC-062 no se da por cumplido hasta corregirlo. La tarea 3.3 queda abierta.

## Grupo 4 — SVG trazado (4.1)

- Trazado con `potrace` (paquete npm, instalado fuera del proyecto) sobre el canal alfa ampliado 3×: `assets/brand/wordmark.svg` e `isotipo.svg` (relleno `#251134`; recolorear editando `fill`).
- Cotejo a 440 px y 109 px contra el PNG: indistinguibles (sin diferencias visibles de filo ni de forma).
- **Decisión:** el SVG se conserva como master vectorial, pero la app sigue usando el PNG. `Image` de React Native no dibuja SVG en nativo sin `react-native-svg` (dependencia nueva que ningún otro uso justifica); `Logo` cambiaría de fuente en un solo lugar si algún día se añade.

## Grupo 5 — cierre

- `tsc --noEmit`, `biome` y `bun test tests/unit`: ver salida de la última ejecución en la sesión (verdes).
- Estado: implementado, sin aceptar; 3.3 pendiente por el fallo preexistente.
