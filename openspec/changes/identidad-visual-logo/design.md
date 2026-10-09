# Design

## Context

Los tokens viven en `src/global.css` como canales RGB (claro/oscuro), con espejo en
`src/theme/colors.ts` y `tests/unit/theme/tema.test.ts`, que verifica sincronía y contraste AA por
par. `stamp` hoy es `58 63 154` (claro) y `163 168 242` (oscuro), casi el índigo de marca. El
logo fuente es un PNG RGBA de 1968×1420 con el fondo degradado incrustado (extremos `#251134` y
`#3E3888`) y wordmark blanco; no hay SVG. `app.json` no define ícono, splash ni favicon.

## Goals / Non-Goals

**Goals:**
- Marca presente en ícono, splash, favicon, acceso y navegación web.
- Paleta de marca que pasa las pruebas de contraste existentes sin relajar umbrales.

**Non-Goals:**
- Rediseñar componentes, tipografía o layout.
- Cambiar significado o matiz de los estados clínicos.
- Modo de color de marca configurable por usuario.

## Decisions

**D1 — Valores de marca, ajustando solo luminosidad.** Primario `#3E3888` (9.9:1 sobre blanco),
tinta `#251134` (15.3:1 sobre `#F1F0F6`), oscuro `#B9B3F2` sobre `#14121C` (9.5:1). Si un par de
`tema.test.ts` falla se corrige luminosidad, no el umbral. Alternativa descartada: conservar la
paleta salvia (sin relación con el logo).

**D2 — Acento teal `#2F8F8A` / `#6CC9C2`.** Sustituye al ámbar de `accent`. El teal debe pasar
3:1 como gráfico y 4.5:1 solo si se usa como texto; se verifica por par. Alternativa: sin acento
nuevo (más sobria); descartada por el usuario.

**D3 — `stamp` a azul tinta (~`#1F4E9E`; oscuro por calcular).** Mantiene el significado de
"tinta de firma" (FR-098) separándolo del primario con ΔE*ab ≥ 10, comprobado por prueba nueva.
Alternativa: mover el primario a violeta; descartada para no alejarlo del logo.

**D4 — PNG primero, recortes versionados.** Se generan una sola vez, con herramientas locales
(Python/Pillow, fuera del bundle), desde `logo-fuente.png`: isotipo (D con nodo) para ícono,
adaptativo y favicon; wordmark con transparencia para acceso y navegación; splash índigo con
wordmark. Los archivos resultantes se commitean en `assets/brand/`; no se añade dependencia ni
paso de build. Alternativa: SVG trazado (potrace/vtracer). Se intenta como mejora (grupo 4): se
adopta solo si el cotejo visual a tamaño de uso no encuentra diferencias; si no, se descarta.

**D5 — Componente `Logo` único** en `src/components/ui/` con el wordmark (tinta en claro, blanco en oscuro; el isotipo
solo existe como ícono, no hay otro uso que justifique una variante) y `accessibilityLabel="Diklass"`. Un solo lugar elige la fuente (PNG hoy, SVG mañana), en la
línea de FR-081. Wordmark blanco: sobre fondo claro se usa la variante tinta, obtenida
recoloreando el canal alfa del PNG, o se coloca sobre superficie índigo.

## Risks / Trade-offs

- Pliegos de copias (D20): amarillo y rosa junto a un primario frío; se mitiga con capturas
  antes/después de `/patients` y una consulta, y se ajusta solo si el contraste o la legibilidad
  empeoran.
- El isotipo mide ~255 px en el PNG fuente y el ícono de 1024 px lo amplía ~2,1×; con LANCZOS y un
  refuerzo de filo el resultado se ve limpio (quickstart.md), y el trazado SVG (grupo 4) lo
  resolvería del todo.
- El ícono de iOS no admite transparencia: se compone sobre `#3E3888`.
- El cambio toca todos los pares de `tema.test.ts`; es la red de seguridad y debe quedar verde
  antes de tocar assets.
