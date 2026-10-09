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
- **Pendiente (2.2): splash.** `expo-splash-screen` no es dependencia del proyecto ni `app.json` tiene su plugin; `splash-wordmark.png` ya existe. Requiere decidir si se añade la dependencia (design.md prometía ninguna).

## Grupo 3 — logo en la interfaz (FR-102)

- Rojo: `tests/unit/ui/logo.test.tsx` por módulo inexistente → verde con `src/components/ui/logo.tsx`.
- `Logo` en `/login` (lg) y en la barra superior (sm) y lateral (md) de la navegación web. La navegación nativa no muestra marca de texto y no se tocó.
- Capturas: `evidencia/3.2-login-light.png`, `evidencia/3.2-login-dark.png`.
- axe sobre `/login` (export estático, sin Supabase): claro 0 violaciones; oscuro 1 `color-contrast` en `#username`/`#password` (texto escrito `foreground` claro sobre fondo oscuro). **Preexistente**: el mismo export de `main` da el mismo fallo con `#1b1d1f` sobre `#1b1f1f`; no lo introduce este cambio. Pendiente 3.3: la compuerta completa (`accessibility.spec.ts`) necesita Supabase local, hoy parado.
- Observación: la tarjeta de `/login` conserva su icono de pata + encabezado «Diklass» bajo el logo (marca duplicada, y la pata choca con «lo lúdico» de DESIGN.md). Fuera del alcance de las tareas; se propone quitarlos.
- `bun test tests/unit`: 940 pass, 0 fail; `tsc --noEmit` y `biome check` limpios.
