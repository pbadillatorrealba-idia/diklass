# Quickstart: corpus inicial «Problemas de miedo en perros y gatos»

## Sustituir el corpus en un entorno vivo

1. En `/knowledge/sources`, retirar cada fuente activa que no sea la nueva (no hay borrado,
   FR-053; la retirada queda atribuida).
2. Cargar el corpus (veterinario ya provisionado; local salvo `--allow-remote`):

   ```bash
   bun --env-file=.env scripts/cargar-corpus-conocimiento.ts
   ```

3. Comprobar que `/knowledge/sources` lista solo «Problemas de miedo en perros y gatos» y que
   «¿Qué datos incluye el historial etológico?» devuelve una cita con su bibliografía.

## Evidencia (2026-10-09, Supabase local)

`SUPABASE_LIVE_TESTS=1 bun test tests/integration/conocimiento/evaluacion.test.ts`, verificado por
máquina sobre 13 preguntas y 5 fuera de dominio:

| Criterio | Medido | Umbral |
|---|---|---|
| SC-002 (hit@5) | 100 % (13/13) | ≥ 80 % |
| SC-025 (ausencia declarada) | 100 % (5/5) | 100 % |
| SC-010 / SC-003 (verbatim) | 0 incumplimientos en 33 citas | 0 |

La pregunta del período de socialización se reformuló (decisión del usuario) porque la versión
anterior fallaba en hit@5 (92 %, 12/13); el fragmento no se tocó.

Esto es verificación por máquina. SC-002/SC-003/SC-015 siguen **pendientes de aceptación** hasta
que el equipo clínico revise el corpus y el conjunto anotado contra el PDF.

## Notas de transcripción

- Solo texto legible: de los gráficos solo se copian los valores rotulados (Diwoodie 2019,
  González Martínez 2011, recuento de Yamada para la mesa de exploración).
- La diapositiva 53 (producto con símbolo de prohibición y texto tapado) se describe sin
  interpretarla; el PDF no dice el motivo.
- Las diapositivas 1, 2, 10, 14, 34, 58 y 60 (portada, índices, vídeo y cierre) no aportan
  contenido y no se transcriben.
- El PDF no se versiona (`data/`); procedencia: `data/docs/MIEDO .pdf` de quien abre este cambio.

## Revisión independiente (PR #51)

Un revisor sin contexto comparó los 34 fragmentos con el PDF. Se corrigieron: atribución de Levine
(solo feromona canina), «Dogs Trust» (no consta en el PDF), «factores de riesgo» (la tabla es de
prevalencia), sección de la acepromacina (diap. 53 sin interpretar), lectura de barras del gráfico
de Blackwell, contenido solo de imágenes, el esquema de roedores y IDs de requisitos (FR-097–100
ya eran de `sistema-visual`: ahora FR-101–104). La segunda lectura de la tarea 1.2 no los detectó.
Las pruebas unitarias son estructurales: la fidelidad clínica (US5-AC15/AC16) se revisa a mano.

## Cierre (2026-10-09)

- 3.1: en el Supabase local la colección activa tiene solo «Problemas de miedo en perros y gatos»
  (verificado consultando la base, no a mano en `/knowledge/sources`; el e2e web de CI cubre la UI).
- 3.3: CI verde de la PR #51, job «Supabase database tests and web E2E»:
  https://github.com/pbadillatorrealba-idia/diklass/actions/runs/37945636254/job/113871089861
- 3.2 **abierta**: licencia por confirmar con la autora o el AWEC. Archivado con esa advertencia por
  decisión del usuario; la fuente sigue con licencia «Por confirmar».
- SC-002/SC-003/SC-015 siguen pendientes de aceptación clínica.
