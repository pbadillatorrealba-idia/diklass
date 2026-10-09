## Why

La marca de Diklass (wordmark blanco sobre degradado índigo, `assets/brand/logo-fuente.png`) no
aparece en la app, y la paleta vigente (verde salvia sobre hueso) no guarda relación con ella.
Ante evaluadores de fondos de I+D la app debe verse como un producto con identidad propia, y la
marca no puede ser un archivo suelto: tiene que gobernar el ícono, la pantalla de arranque, el
acceso y la navegación (Principio I: el código no es el único registro de esas decisiones).

## What Changes

- Logo como identidad principal: ícono de app (iOS/Android), splash, favicon, wordmark en la
  pantalla de acceso y en la cabecera web / barra lateral. Primero con recortes del PNG fuente;
  una versión SVG trazada se adopta solo si resulta fiel (mejora opcional, no bloquea).
- Paleta migrada a índigo, derivada del degradado del logo (`#251134` → `#3E3888`):
  `primary` `#3E3888` (oscuro `#B9B3F2`), `foreground` `#251134`, `background` `#F1F0F6` /
  `#14121C`, `accent` teal `#2F8F8A` / `#6CC9C2`, y `primary-surface`/`border` reentonados.
- `stamp` (tinta de la firma del veterinario) pasa a un azul tinta (~`#1F4E9E`, oscuro por
  calcular) para no confundirse con el primario de marca.
- Estados clínicos (`destructive`, `warning`, `success`, `info`, `suggested`, `correction`)
  conservan su matiz y significado; solo se ajusta luminosidad si algún par pierde contraste.
- Actualización de `DESIGN.md` y de los espejos de tokens (`global.css`, `colors.ts`).

## Capabilities

### New Capabilities
- `identidad-visual`: marca (logo, ícono, splash, favicon, ubicación del wordmark) y color de
  marca (primario, acento, tinta, distinción firma/marca) de la app.

### Modified Capabilities
<!-- Ninguna publicada: openspec/specs/ está vacío. FR-071, FR-072 y FR-081 de `sistema-visual`
     (aún en cambio activo) se siguen cumpliendo; este cambio solo reasigna valores de tokens. -->

## Impact

- Código: `src/global.css`, `src/theme/colors.ts`, `tests/unit/theme/tema.test.ts`, `app.json`,
  `assets/brand/` (nuevos), `src/components/ui/` (componente `Logo`), `src/app/(auth)/login.tsx`,
  `src/components/navigation/app-navigation*.tsx`, `src/app/+html.tsx` (favicon), `DESIGN.md`.
- Sin dependencias nuevas previstas (el recorte se hace una vez con herramientas locales y los
  archivos resultantes se versionan).
- Riesgo: los pliegos de copias (D20: amarillo `suggested`, rosa `correction`) conviven con un
  primario más frío; se revisa con capturas.
