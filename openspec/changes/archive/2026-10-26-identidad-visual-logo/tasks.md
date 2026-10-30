# Tasks: Identidad visual

Convención: Rojo-Verde-Refactor (Constitución II). Las decisiones Dn remiten a
[design.md](design.md) y los requisitos a [la spec](specs/identidad-visual/spec.md). La máquina
de desarrollo tiene poca RAM: las suites e2e se ejecutan de una en una, con `--workers=1`.
Trabajo en el worktree `~/.omp/wt/identidad-logo` (rama `feat/identidad-logo`).

## 1. Paleta (pruebas primero) (D1–D3)

- [x] 1.1 Escribir en rojo en `tests/unit/theme/tema.test.ts` los nuevos valores esperados de `primary`, `foreground`, `background`, `accent`, `primary-surface`, `border` y `stamp` y la prueba de distancia `stamp`↔`primary` (ΔE*ab ≥ 10, ambos esquemas) (FR-103 · FR-104). Verificación: `bun test tests/unit/theme` en rojo por valores y distancia.
- [x] 1.2 Aplicar los valores de D1–D3 en `src/global.css` y `src/theme/colors.ts`, ajustando solo luminosidad hasta que todos los pares pasen (FR-103 · FR-072). Verificación: `bun test tests/unit/theme` en verde; valores finales (incluido `stamp` oscuro) anotados en `quickstart.md`.
- [x] 1.3 Revisar `tailwind.config.js` y los usos de `accent` en `src/` por si algo depende del ámbar anterior, y actualizar `DESIGN.md` (frontmatter de colores) (FR-081). Verificación: `sin-literales.test.ts` verde y `bun run typecheck` verde.

## 2. Assets de marca (D4)

- [x] 2.1 Escribir en rojo `tests/unit/brand/assets.test.ts`: `app.json` referencia ícono (1024², sin alfa), ícono adaptativo (foreground + fondo `#3E3888`), splash y favicon, y cada archivo existe con las dimensiones de plataforma (FR-101 · SC-063). Verificación: rojo por referencias ausentes.
- [x] 2.2 Generar con un script local (fuera del bundle) desde `assets/brand/logo-fuente.png`: isotipo, wordmark con transparencia (blanco y tinta), splash y favicon; commitearlos en `assets/brand/` y referenciarlos en `app.json` y en `src/app/+html.tsx` (favicon) (FR-101). Verificación: prueba 2.1 en verde y cotejo visual a tamaño de uso registrado en `quickstart.md`.

## 3. Logo en la interfaz (D5)

- [x] 3.1 Escribir en rojo una prueba de `Logo` (nombre accesible `Diklass`, tamaños y proporción) e implementar `src/components/ui/logo.tsx` (FR-102). Verificación: rojo → verde.
- [x] 3.2 Usar `Logo` en `src/app/(auth)/login.tsx` y en `app-navigation.web.tsx` / `app-navigation.tsx` (cabecera compacta y barra lateral), con variante legible en claro y oscuro (FR-102 · US19-AC2). Verificación: capturas Playwright de `/login` y `/patients` en `chromium` y `chromium-dark` en `quickstart.md`.
- [x] 3.3 Ejecutar `accessibility.spec.ts` en `chromium` y `chromium-dark` (uno a la vez) y registrar 0 violaciones; revisar visualmente los pliegos de copias (D20) con la paleta nueva (SC-062). Verificación: resultados y capturas antes/después en `quickstart.md`.

## 4. Mejora opcional: SVG trazado (D4)

- [x] 4.1 Trazar wordmark e isotipo desde el PNG con una herramienta local; si el cotejo a tamaño de uso (acceso, barra lateral, favicon) no muestra diferencias, sustituir la fuente dentro de `Logo` si la plataforma lo permite sin dependencias nuevas; si no, conservar el SVG como master y descartar el cambio de fuente y dejar constancia en `quickstart.md` (FR-102). Verificación: decisión y comparativa registradas; las pruebas 3.1 y 2.1 siguen en verde.

## 5. Cierre

- [x] 5.1 Ejecutar `bun run typecheck`, `bun run lint` y `bun test`, y registrar el resultado en `quickstart.md`; diferenciar pendiente/implementado/aceptado sin archivar el cambio (FR-101–FR-104).
