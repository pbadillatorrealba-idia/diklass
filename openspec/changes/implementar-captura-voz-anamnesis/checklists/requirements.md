# Checklist de Calidad de Especificación: Captura de voz hacia anamnesis

**Propósito**: Validar la completitud y calidad de la especificación antes de pasar a planificación
**Creado**: 2026-09-09
**Funcionalidad**: [spec.md](../specs/captura-voz-anamnesis/spec.md)

> **Revisión documental histórica trasladada el 2026-09-16:** se conservan las 16 marcas originales y las notas de revisión. No son tareas de implementación, pruebas de la aplicación ni aceptación de la capacidad; la migración no ha vuelto a ejecutar estas revisiones. Las afirmaciones de iteraciones anteriores se leen en su contexto histórico.

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

- Los ítems sin marcar requieren actualizar la especificación antes de aclarar requisitos o elaborar el diseño.

### Recuento

1 historia(s) · 15 escenarios · 12 requisitos funcionales · 6 criterios de éxito

### Historial de validación

**Iteración 1 — autovalidación del autor.** Detectó requisitos sin escenario de aceptación y los
corrigió. Concluyó, erróneamente, que los 16 criterios pasaban.

**Iteración 2 — revisión independiente.** Un revisor sin contexto previo verificó la afirmación
anterior y la refutó. El patrón de fallo era sistemático: la validación se había hecho en una sola
dirección, requisito → escenario, sin recorrer nunca la inversa, y sin verificar la segunda cláusula
de los requisitos compuestos ni las prohibiciones. Hallazgos:

- **Trazabilidad falsa**: FR-014 prohíbe iniciar captura sin consulta abierta, y el escenario que lo
  trazaba empezaba asumiendo una consulta abierta, siendo estructuralmente incapaz de verificar la
  prohibición; además su `Then` verificaba FR-025. Agregado US6/14.
- **Contradicción del enunciado canónico**: FR-021 redefinía la procedencia como función del estado
  de confirmación, contradiciendo a la especificación de [registro clínico longitudinal](../../implementar-registro-clinico-longitudinal/specs/registro-clinico-longitudinal/spec.md) y dejando indefinido qué procedencia queda tras
  confirmar. Reescrito separando ambos ejes, con escenario US6/9.
- **Detalle de implementación en un MUST**: FR-015 prescribía ventanas de 30 segundos, que es el
  CÓMO. Reescrito sobre la necesidad real —revisabilidad durante la consulta— dejando la ventana
  como cota de latencia del brief.
- **Atribución falsa**: los supuestos citaban el brief como fuente de la ventana de 30 segundos y el
  brief no la contenía. Se incorporó al brief como decisión de producto y se corrigió la cita.
- **Casos límite sin requisito**: se agregaron FR-054 (captura no disponible, con registro manual
  como alternativa) y FR-055 (persistencia del borrador e interrupción a mitad de tramo).
- **Caso límite duplicado**: eliminado.

**Iteración 3 — corrección y revalidación.** Todos los hallazgos anteriores corregidos. Verificación
programática sobre la familia completa: cada FR con trazabilidad, cada escenario referenciado
existente, sin identificadores colisionantes, tabla canónica del brief coincidente con la realidad.

**Iteración 5 — propagación del sistema de usuarios.** La revisión independiente detectó que esta
spec no se había modificado al incorporar identidad, pese a que su comportamiento cambió: activar la
captura de audio y confirmar antecedentes son escrituras sobre la ficha clínica. Agregado FR-068
(sesión activa y atribución, que puede ser de un veterinario distinto del que abrió la consulta),
escenario US6/15, SC-048 y la dependencia de la especificación de [identidad y acceso](../../implementar-identidad-y-acceso/specs/identidad-y-acceso/spec.md).

### Advertencia metodológica

La afirmación "los 16 criterios pasan" de la iteración 1 fue falsa y solo se detectó por revisión
independiente. Las marcas `[x]` de este checklist reflejan la iteración 3 y no deben tomarse como
garantía: valen lo que valga la próxima revisión que las cuestione.

### Dependencias

Dependencias directas de construcción: [identidad y acceso](../../implementar-identidad-y-acceso/specs/identidad-y-acceso/spec.md), [registro clínico longitudinal](../../implementar-registro-clinico-longitudinal/specs/registro-clinico-longitudinal/spec.md). Dependencia externa: conversación clínica simulada.
