# Checklist de Calidad de Especificación: Asistencia clínica proactiva

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

2 historia(s) · 16 escenarios · 10 requisitos funcionales · 6 criterios de éxito

### Historial de validación

**Iteración 1 — autovalidación del autor.** Detectó requisitos sin escenario de aceptación y los
corrigió. Concluyó, erróneamente, que los 16 criterios pasaban.

**Iteración 2 — revisión independiente.** Un revisor sin contexto previo verificó la afirmación
anterior y la refutó. El patrón de fallo era sistemático: la validación se había hecho en una sola
dirección, requisito → escenario, sin recorrer nunca la inversa, y sin verificar la segunda cláusula
de los requisitos compuestos ni las prohibiciones. Hallazgos:

- **Escenario sin requisito y trazabilidad falsa**: US8/6 prometía que las hipótesis figuran en la
  epicrisis, campo que la spec 002 no contemplaba, y la fila `FR-009 | US8/1, 6` atribuía a FR-009
  un escenario que no lo verifica. Se agregó FR-049, se amplió la epicrisis en FR-011 de la 002 y se
  corrigió la trazabilidad.
- **Lenguaje normativo invertido**: FR-010 reescrito como MUST NOT.
- **Obligaciones no verificadas**: FR-008 exige permitir "formular" una pregunta y FR-029 "agregar
  hipótesis propias", sin escenario. Agregados US7/6 y US8/9. FR-007 exige mostrar el fragmento y
  los escenarios solo verificaban la fuente: agregado US8/10.
- **Dependencia no declarada**: SC-017 y SC-018 dependen del panel de especialistas, que el brief
  clasifica como dependencia externa. Declarado.
- **Casos límite sin requisito**: el de dominio fuera de etología se delegó explícitamente a FR-023
  y la spec 003; los otros dos se eliminaron o se remitieron a FR-022.

**Iteración 3 — corrección y revalidación.** Todos los hallazgos anteriores corregidos. Verificación
programática sobre la familia completa: cada FR con trazabilidad, cada escenario referenciado
existente, sin identificadores colisionantes, tabla canónica del brief coincidente con la realidad.

**Iteración 4 — incorporación del sistema de usuarios.** El PoC pasó a incluir identidad y acceso
(spec 001): FR-029 atribuye el diagnóstico a la identidad autenticada de la spec 001. Revalidado el grafo de dependencias completo contra la tabla y las aristas del brief.

### Advertencia metodológica

La afirmación "los 16 criterios pasan" de la iteración 1 fue falsa y solo se detectó por revisión
independiente. Las marcas `[x]` de este checklist reflejan la iteración 3 y no deben tomarse como
garantía: valen lo que valga la próxima revisión que las cuestione.

### Dependencias

Specs 001 y 002. Dependencia externa: panel de especialistas.
