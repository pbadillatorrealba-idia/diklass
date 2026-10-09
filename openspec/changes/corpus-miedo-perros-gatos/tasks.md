# Tasks

## 1. Fixture del corpus (D1–D3 · FR-097 · FR-098 · FR-099)

- [x] 1.1 Escribir en rojo `tests/unit/conocimiento/corpus-miedo.test.ts`: el fixture valida con
  `fuenteContentSchema` y `corpusSinteticoSchema`; hay una sola fuente; el año, el DOI y la URL son
  `null`; la licencia dice «Por confirmar»; cada fragmento abre con «[diap. N–M]»; ningún
  fragmento contiene patrones de dosis (`mg`, `mg/kg`). Verificación: `bun test` en rojo.
- [x] 1.2 Transcribir `data/docs/MIEDO .pdf` a `tests/fixtures/conocimiento/corpus-miedo.json`
  siguiendo las secciones de D1 y las reglas de D2/D3. Verificación: la prueba 1.1 en verde y una
  segunda lectura de cada fragmento contra sus diapositivas.

## 2. Conjunto anotado y sustitución (D4 · FR-100)

- [x] 2.1 Reescribir `tests/fixtures/conocimiento/conjunto-anotado.json` con 10–12 preguntas con su
  `documentoClave`/`ordinal` y 5 fuera de dominio. Ampliar la prueba 1.1 para que cada
  `ordinal` exista en el corpus y las preguntas fuera de dominio no compartan términos clave con él.
  Verificación: `bun test tests/unit/conocimiento` en verde.
- [x] 2.2 Repuntar `tests/integration/conocimiento/evaluacion.test.ts` y
  `scripts/cargar-corpus-conocimiento.ts` a `corpus-miedo.json`, eliminar `corpus-sintetico.json` y
  actualizar los textos «sintético» de ambos y de `SETUP.md`. Verificación: `bun run typecheck`,
  `bun run lint` y `bun run test` en verde; `grep -r corpus-sintetico` sin resultados.
- [x] 2.3 Evaluación viva: con Supabase local, `SUPABASE_LIVE_TESTS=1 bun run test:integration`
  sobre `evaluacion.test.ts` y registrar SC-002/SC-003/SC-025 medidos. Verificación: las cifras
  quedan en `quickstart.md`; si SC-002 < 80 %, ajustar el texto de los fragmentos, no el umbral.

## 3. Entornos vivos y cierre

- [ ] 3.1 Escribir `quickstart.md` con el procedimiento de sustitución (retirar fuentes
  sintéticas, `bun --env-file=.env scripts/cargar-corpus-conocimiento.ts`) y ejecutarlo en el
  Supabase local. Verificación: `/knowledge/sources` lista solo la fuente nueva, y una pregunta
  de ejemplo devuelve una cita con su bibliografía.
- [ ] 3.2 Confirmar la licencia con la autora o el AWEC y registrar el resultado; mientras no
  exista, la fuente sigue «Por confirmar». Verificación: nota en `quickstart.md`.
- [ ] 3.3 e2e web de conocimiento en verde con el corpus nuevo
  (`bun --env-file=.env run test:e2e:web`, un worker). Verificación: URL de CI en `quickstart.md`.

## Workflow follow-up

- Archivar el cambio tras la revisión clínica del corpus y del conjunto anotado.
