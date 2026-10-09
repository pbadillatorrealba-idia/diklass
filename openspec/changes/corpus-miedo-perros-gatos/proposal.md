## Why

La base de conocimiento (`implementar-base-conocimiento-trazable`) arrancó con un corpus **sintético**
(6 documentos ficticios) como sustituto provisional del corpus real (HD7 de su diseño). Ya hay un
primer documento real: la presentación «Problemas de miedo en perros y gatos» (Susana Le Brech,
AWEC-UAB, 60 diapositivas). Debe ser la primera y única información de la base de conocimiento, en
lugar de los documentos ficticios.

## What Changes

- Nuevo fixture `tests/fixtures/conocimiento/corpus-miedo.json`: la presentación transcrita en una
  **única fuente** con fragmentos citables por diapositiva o grupo de diapositivas (misma forma que
  la ingesta: `bibliografia`, `licencia`, `fragmentos`).
- **BREAKING (fixtures)**: se elimina `corpus-sintetico.json` y se reescribe `conjunto-anotado.json`
  con preguntas cuya evidencia esperada está en el nuevo documento y con preguntas fuera de dominio
  que el documento no cubre.
- `scripts/cargar-corpus-conocimiento.ts`, `evaluacion.test.ts` y `SETUP.md` apuntan al corpus
  nuevo. El loader (`loadSyntheticCorpus`) y la ingesta no cambian de contrato.
- Retirada (no borrado, FR-053) de las fuentes sintéticas ya cargadas en entornos vivos, para que
  el único corpus citable sea el nuevo.
- El PDF original no entra al repositorio (`data/` sigue sin versionar); queda referenciado en la
  bibliografía y en el quickstart.

Fuera de alcance: OCR de las imágenes y gráficos de las diapositivas (solo se transcribe el texto
legible), otros documentos, y cualquier cambio de esquema, RPC o UI.

## Capabilities

### New Capabilities

- `corpus-clinico-inicial`: contenido y trazabilidad del corpus real inicial: qué documento es la
  base, cómo se fragmenta, qué metadatos lleva y qué conjunto anotado lo evalúa.

### Modified Capabilities

Ninguna publicada en `openspec/specs/`. Sustituye el corpus sintético que define D9/HD7 de
`implementar-base-conocimiento-trazable` sin cambiar sus requisitos (FR-030, FR-053, FR-069).

## Impact

- Fixtures: `corpus-miedo.json` (nuevo), `corpus-sintetico.json` (eliminado), `conjunto-anotado.json`.
- Código/documentación: `scripts/cargar-corpus-conocimiento.ts`, `SETUP.md`, y la mención del
  corpus sintético en `tests/integration/conocimiento/evaluacion.test.ts`.
- Pruebas: validación unitaria del fixture con `fuenteContentSchema` y evaluación viva
  (`SUPABASE_LIVE_TESTS=1`) sobre el conjunto nuevo.
- Dependencias de construcción: `implementar-base-conocimiento-trazable`.
- Aceptación: SC-002/SC-003 siguen sin aceptarse hasta que el equipo clínico revise el corpus y el
  conjunto; este cambio es una integración de contenido, no una aceptación clínica.
