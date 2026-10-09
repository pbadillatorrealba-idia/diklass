## Context

`clinical_records.content` es jsonb por `record_type` (`patient`, `tutor`, `consultation`,
`anamnesis`, `diagnosis`, `epicrisis`); Zod valida en la frontera (`schema.ts`). La anamnesis es
**una fila por campo** (`field`, `text`, `provenance`). Hay triggers de sellado/atribución que
dependen de `consultationId` y `record_type`, no del contenido de `field`. El campo `field` no
tiene CHECK en SQL (solo aparece como dato en pgTap).

## Goals / Non-Goals

- Goal: que ficha y anamnesis reflejen la hoja canina sin tocar SQL.
- Non-goal: hoja felina, adjuntos, generación automática de diagnóstico.

## Decisions

**D1 — Sin migración; extender los esquemas Zod.** Los campos nuevos de paciente/tutor son
opcionales y se normalizan a `null` (FR-044). Alternativa descartada: columnas SQL (rígidas, y la
trazabilidad ya vive en `content`).

**D2 — Anamnesis: un catálogo de campos por sección, mismo modelo fila-por-campo.**
`ANAMNESIS_SECTIONS` (nuevo) = lista ordenada de `{section, fields[]}` con ids tipo
`entorno.vivienda`, `soledad.ladra`, `social.familia.gruñe`… `AnamnesisField` pasa a derivarse del
catálogo. Conserva procedencia (FR-021) y atribución (FR-004) sin cambios de servicio. Alternativa
descartada: un solo registro `anamnesis_etologica` con todo el formulario: pierde procedencia y
atribución por campo.

**D3 — Tipos de respuesta.** Cada campo declara `kind: "texto" | "tri"`; `tri` guarda
`"si" | "no" | "a_veces"` en `text` (validado por Zod según el catálogo). Un `tri` sin responder
sigue siendo «sin dato», nunca «no» (SC-024).

**D4 — Compatibilidad hacia atrás.** Los ids antiguos se conservan en `LEGACY_FIELDS` solo para
lectura: se muestran como «Campo previo» y no se ofrecen al escribir. Las filas sintéticas
existentes no se migran (D5 de 009 sella las consultas cerradas; reescribirlas rompería el sello).

**D5 — Plan de la consulta como `record_type` existente.** Protocolo, diferenciales, presuntivo y
tratamiento se guardan como campos del `diagnosis` actual (extendido, `text` sigue obligatorio =
diagnóstico presuntivo) para no añadir un tipo ni tocar grants/auditoría. Confirmado en 1.1: `clinical_record_action` y los
triggers de 009 solo miran `record_type`, `status` y `consultationId`, no el contenido.

**D6 — Voz y epicrisis.** Mapeo de los campos previos a la hoja (extractor y fixture comparten
la misma función): comportamiento, frecuencia, duración, contexto, desencadenantes y cambios
recientes → `historia_problema`; ambiente → `vivienda_tipo`; convivencia → `familia_otros_animales`;
alimentación → `alimentacion_dieta`; actividad → `rutina_paseos`; rutinas → `rutina_comida`;
respuesta a tratamientos → `tratamientos_anteriores`. El extractor emite a lo sumo una propuesta
por cláusula y campo. `audioFactContentSchema` valida también las respuestas cerradas. `features/voz` extrae hechos hacia `AnamnesisField`; se actualiza su
prompt/esquema al catálogo nuevo y los fixtures. `epicrisis-draft.ts` resume por sección.

**D7 — UI.** Anamnesis en secciones plegables siguiendo el orden de la hoja; primitivas y tokens de
`sistema-visual` (sin hex). `tri` como grupo de opciones con `option-picker` existente.

## Risks / Trade-offs

- Catálogo grande (~70 campos) → formulario largo. Mitigación: secciones plegables y
  «campos sin dato» del panel de faltantes agrupados por sección.
- Cambiar `AnamnesisField` rompe consumidores de voz. Mitigación: tipos compilan o fallan; tests de
  fixtures.
- Decisiones de nomenclatura de la hoja (p. ej. «Pautas» vs «Educación») son marcas sin semántica
  clínica; si la clínica las quiere con significado, es otro cambio.

## Open Questions

- ¿Los diferenciales de conducta son texto libre o vocabulario cerrado? Se asume texto libre.
