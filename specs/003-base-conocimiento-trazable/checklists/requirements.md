# Checklist de Calidad de Especificación: Base de conocimiento trazable

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

1 historia(s) · 13 escenarios · 14 requisitos funcionales · 6 criterios de éxito

### Historial de validación

**Iteración 1 — autovalidación del autor.** Detectó requisitos sin escenario de aceptación y los
corrigió. Concluyó, erróneamente, que los 16 criterios pasaban.

**Iteración 2 — revisión independiente.** Un revisor sin contexto previo verificó la afirmación
anterior y la refutó. El patrón de fallo era sistemático: la validación se había hecho en una sola
dirección, requisito → escenario, sin recorrer nunca la inversa, y sin verificar la segunda cláusula
de los requisitos compuestos ni las prohibiciones. Hallazgos:

- **Casos límite sin requisito**: cuatro casos prometían comportamiento que ningún FR exigía. Se
  agregaron FR-051 (pregunta sin paciente seleccionado, el de mayor riesgo clínico), FR-052 (fuentes
  contradictorias entre sí) y FR-053 (citas hacia fuentes retiradas); se eliminó el caso de consulta
  ambigua por especulativo.
- **Generalidad especulativa**: la cláusula de jurisdicción de FR-030 era un MUST que su propio
  supuesto desactivaba. Eliminada por contradecir el Principio III de la constitución.
- **Criterios no medibles**: SC-026 era FR-028 reetiquetado; SC-010 y SC-015 no definían conjunto de
  evaluación ni muestra. Los tres reformulados.

**Iteración 3 — corrección y revalidación.** Todos los hallazgos anteriores corregidos. Verificación
programática sobre la familia completa: cada FR con trazabilidad, cada escenario referenciado
existente, sin identificadores colisionantes, tabla canónica del brief coincidente con la realidad.

**Iteración 5 — propagación del sistema de usuarios.** La revisión independiente detectó que
incorporar o retirar una fuente clínica altera el corpus del que dependen todas las afirmaciones del
sistema, y que esas operaciones no tenían autorización ni atribución en ninguna spec — una tensión
viva con el Principio V. Agregado FR-069, escenario US5/13 y la dependencia de la spec 001. Las
preguntas al asistente siguen siendo lectura y no requieren atribución.

### Advertencia metodológica

La afirmación "los 16 criterios pasan" de la iteración 1 fue falsa y solo se detectó por revisión
independiente. Las marcas `[x]` de este checklist reflejan la iteración 3 y no deben tomarse como
garantía: valen lo que valga la próxima revisión que las cuestione.

### Dependencias

Spec 002. Dependencia externa crítica: fuentes clínicas legalmente utilizables.
