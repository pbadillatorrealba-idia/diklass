# Checklist de Calidad de Especificación: Apoyo al tratamiento y farmacología

**Propósito**: Validar la completitud y calidad de la especificación antes de pasar a planificación
**Creado**: 2026-09-09
**Funcionalidad**: [spec.md](../spec.md)

## Calidad del Contenido

- [x] Sin detalles de implementación (lenguajes, frameworks, APIs)
- [x] Centrado en el valor para el usuario y las necesidades del negocio
- [x] Escrito para interlocutores no técnicos
- [x] Todas las secciones obligatorias completadas

## Completitud de los Requisitos

- [x] No quedan marcadores [NEEDS CLARIFICATION]
- [x] Los requisitos son verificables y no ambiguos
- [x] Los criterios de éxito son medibles
- [x] Los criterios de éxito son agnósticos de tecnología (sin detalles de implementación)
- [x] Todos los escenarios de aceptación están definidos
- [x] Los casos límite están identificados
- [x] El alcance está claramente acotado
- [x] Dependencias y supuestos identificados

## Preparación de la Funcionalidad

- [x] Todos los requisitos funcionales tienen criterios de aceptación claros
- [x] Los escenarios de usuario cubren los flujos principales
- [x] La funcionalidad cumple los resultados medibles definidos en Criterios de Éxito
- [x] No se filtran detalles de implementación en la especificación

## Notas

- Los ítems sin marcar requieren actualizar el spec antes de `/speckit-clarify` o `/speckit-plan`

### Recuento

1 historia(s) · 19 escenarios · 12 requisitos funcionales · 7 criterios de éxito

### Historial de validación

**Iteración 1 — autovalidación del autor.** Detectó requisitos sin escenario de aceptación y los
corrigió. Concluyó, erróneamente, que los 16 criterios pasaban.

**Iteración 2 — revisión independiente.** Un revisor sin contexto previo verificó la afirmación
anterior y la refutó. El patrón de fallo era sistemático: la validación se había hecho en una sola
dirección, requisito → escenario, sin recorrer nunca la inversa, y sin verificar la segunda cláusula
de los requisitos compuestos ni las prohibiciones. Hallazgos:

Es la spec de mayor riesgo clínico y la que llegó peor. Tres huecos de seguridad, todos cerrados:

- **Dosis sin rótulo de validación**: FR-035 obligaba a rotular solo la dosis "calculada por el
  sistema"; una dosis citada literalmente de una fuente escapaba a la obligación, y con ella se caía
  SC-006. Ampliado a toda dosis presentada, con escenario US9/19.
- **Prescripción por la puerta trasera**: nada impedía que el borrador automático de epicrisis
  arrastrara sugerencias farmacológicas nunca aprobadas individualmente, y que la aprobación global
  de la epicrisis las convirtiera en registro definitivo. Agregado FR-058, escenarios US9/16 y
  US9/17, y SC-038 que mide esa vía en 0.
- **Evaluación de seguridad verificada a un sexto**: FR-037 obliga a evaluar seis dimensiones y
  advertir contraindicaciones e interacciones; un único escenario lo verificaba, y solo para
  alergias, pese a que SC-020 lo mide al 100%. Agregados US9/11 y US9/12.
- **Reglas de seguridad que vivían en Supuestos**: la prohibición de mostrar dosis fuera de rango
  documentado y de sugerir fármacos sin cobertura no era un requisito. Promovida a FR-046.
- **Lenguaje normativo invertido** en FR-036 y FR-010, los dos requisitos ancla del human-in-the-loop.
  Reescritos como MUST NOT, y FR-036 explicita que la aprobación es individual por fármaco.
- **Frontera indefinida** entre FR-019 (toda sugerencia farmacológica cita fuente) y FR-023
  (alternativa sin respaldo declarándolo): se acotó FR-023 a lo no farmacológico.
- **Colisión de identificador**: el requisito de la epicrisis se numeró FR-045, ya usado por otro
  requisito distinto en la spec 001. Renumerado a FR-058.

**Iteración 3 — corrección y revalidación.** Todos los hallazgos anteriores corregidos. Verificación
programática sobre la familia completa: cada FR con trazabilidad, cada escenario referenciado
existente, sin identificadores colisionantes, tabla canónica del brief coincidente con la realidad.

**Iteración 4 — incorporación del sistema de usuarios.** El PoC pasó a incluir identidad y acceso
(spec 007): FR-036 atribuye la aprobación de cada fármaco a la identidad autenticada de la spec 007. Revalidado el grafo de dependencias completo contra la tabla y las aristas del brief.

### Advertencia metodológica

La afirmación "los 16 criterios pasan" de la iteración 1 fue falsa y solo se detectó por revisión
independiente. Las marcas `[x]` de este checklist reflejan la iteración 3 y no deben tomarse como
garantía: valen lo que valga la próxima revisión que las cuestione.

### Dependencias

Specs 001, 002 y 004. Es la funcionalidad de mayor riesgo clínico del PoC.
