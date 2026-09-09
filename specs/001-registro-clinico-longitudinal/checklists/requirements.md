# Checklist de Calidad de Especificación: Registro clínico longitudinal

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

4 historia(s) · 20 escenarios · 13 requisitos funcionales · 6 criterios de éxito

### Historial de validación

**Iteración 1 — autovalidación del autor.** Detectó requisitos sin escenario de aceptación y los
corrigió. Concluyó, erróneamente, que los 16 criterios pasaban.

**Iteración 2 — revisión independiente.** Un revisor sin contexto previo verificó la afirmación
anterior y la refutó. El patrón de fallo era sistemático: la validación se había hecho en una sola
dirección, requisito → escenario, sin recorrer nunca la inversa, y sin verificar la segunda cláusula
de los requisitos compuestos ni las prohibiciones. Hallazgos:

- **Escenario sin requisito**: US2/3 afirmaba que el sistema deduce antecedentes del texto libre;
  ningún FR lo exigía y habría duplicado el extractor de la spec 003. Reescrito: la procedencia la
  asigna el veterinario, y esta spec no infiere nada.
- **Dependencia hacia adelante**: FR-013 exigía presentar "tratamiento indicado, medicamentos,
  evolución registrada", que solo producen las specs 005 y 006, mientras la 001 declaraba no
  depender de nada. Acotado a lo que la 001 sí produce.
- **Requisito no verificable**: FR-044 hablaba de "información clínica relevante", conjunto que el
  brief tiene como pregunta abierta. Reformulado sobre los campos concretos de FR-001.
- **Lenguaje normativo invertido**: FR-010 decía "Ninguna salida ... MUST incorporarse", que bajo
  RFC-2119 es permisivo. Reescrito como MUST NOT.
- **Casos límite sin requisito**: se agregó FR-045 (retomar consulta interrumpida) y se eliminaron
  dos casos especulativos que ningún requisito respaldaba.
- **Cobertura incompleta**: FR-001 no tenía escenario para consultar una ficha ni para medicamentos
  actuales y antecedentes conductuales. Agregado US1/5.
- **Criterio no medible**: SC-011 era el `Then` de un escenario reetiquetado. SC-013 no definía
  muestra. Ambos reformulados con umbral.

**Iteración 3 — corrección y revalidación.** Todos los hallazgos anteriores corregidos. Verificación
programática sobre la familia completa: cada FR con trazabilidad, cada escenario referenciado
existente, sin identificadores colisionantes, tabla canónica del brief coincidente con la realidad.

**Iteración 4 — incorporación del sistema de usuarios.** El PoC pasó a incluir identidad y acceso
(spec 007): FR-003 y FR-012 pasan a apoyarse en la identidad autenticada de la spec 007; se eliminó el supuesto de usuario único. Revalidado el grafo de dependencias completo contra la tabla y las aristas del brief.

**Iteración 5 — propagación del sistema de usuarios.** La revisión independiente detectó que la
entidad Observación clínica no llevaba autor, de modo que en una clínica compartida el contenido de
la anamnesis heredaba la identidad de quien abrió la consulta en vez de la de quien lo escribió.
FR-004 ahora atribuye cada antecedente, con escenario US2/6.

### Advertencia metodológica

La afirmación "los 16 criterios pasan" de la iteración 1 fue falsa y solo se detectó por revisión
independiente. Las marcas `[x]` de este checklist reflejan la iteración 3 y no deben tomarse como
garantía: valen lo que valga la próxima revisión que las cuestione.

### Dependencias

Ninguna. Construible y verificable por sí sola.
