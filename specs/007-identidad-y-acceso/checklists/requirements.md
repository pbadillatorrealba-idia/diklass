# Checklist de Calidad de Especificación: Identidad y acceso

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

2 historia(s) · 17 escenarios · 8 requisitos funcionales · 9 criterios de éxito

### Historial de validación

**Origen**: esta spec no existía en la partición original. Se añadió al decidir que el PoC incorpora
sistema de usuarios, decisión que también elimina el conflicto entre el Principio V de la
constitución y el supuesto de usuario único que tenía la spec 001.

**Iteración 1 — verificación programática**: cada FR con trazabilidad a escenarios existentes, sin
identificadores colisionantes, aristas de dependencia coincidentes entre spec, tabla del brief y
lista de aristas. Sin hallazgos.

**Iteración 2 — revisión independiente.** Dos revisores sin contexto previo refutaron la afirmación
de la iteración 1: fallaban 6 de los 16 criterios. Hallazgos corregidos:

- **Generalidad especulativa (el más grave).** FR-065 obligaba a que la atribución sobreviviera a la
  desactivación o eliminación de una cuenta, y de él colgaban SC-045, un escenario, dos casos límite
  y el atributo `estado` de la entidad Veterinario — sin que ningún requisito permitiera desactivar
  cuentas ni ningún supuesto lo declarara. Peor: FR-059 era incondicional, de modo que una cuenta
  desactivada podía seguir autenticándose. Es el mismo defecto que la spec 002 ya había corregido en
  FR-030 y que el Principio III prohíbe. El ciclo de vida de cuentas salió del alcance, como el
  brief ya lo situaba en Fase 2.
- **Prohibiciones sin verificación real.** FR-060 trazaba su cláusula de indistinguibilidad a un
  escenario cuyo `Given` presupone una cuenta existente, y la indistinguibilidad es comparativa:
  ahora hay dos escenarios. FR-062 y FR-067 compartían escenario, y ese escenario lo satisfaría una
  denegación implementada solo en el cliente, justo lo que FR-067 prohíbe: se reformuló en términos
  observables y tiene escenario propio.
- **FR-063 enumeraba seis acciones y verificaba dos**, sin declarar si la lista era taxativa. Ahora
  es taxativa, cubre las once acciones de escritura reales de las siete specs, e incluye el momento
  que SC-040 ya medía sin respaldo.
- **FR-061** no cuantificaba el periodo de inactividad y su escenario verificaba caducidad por
  vigencia, no por inactividad.
- **Verificabilidad.** La spec declaraba no depender de nada y usaba entidades de las specs 001 y
  005. Se separó la dependencia de construcción (ninguna) de la de verificación (la 001), sin crear
  el ciclo que una arista habría introducido.

### Advertencia metodológica

La autovalidación de la iteración 1 afirmó 16/16 y era falsa. La advertencia que llevaba entonces
acertó al señalar que el riesgo estaba en los requisitos compuestos y las prohibiciones —FR-060,
FR-062 y FR-067 fallaron exactamente ahí— pero no anticipó el defecto más grave, que fue el ciclo de
vida de cuentas. Las marcas `[x]` reflejan la iteración 2 y valen lo que valga la próxima revisión.

### Dependencias

Ninguna. Es la primera del orden de construcción.
