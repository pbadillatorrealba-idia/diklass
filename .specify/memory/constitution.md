<!--
REPORTE DE IMPACTO DE SINCRONIZACIÓN
Cambio de versión: 1.0.0 → 1.0.1
Justificación del incremento: PATCH — traducción íntegra al español. No se agrega, elimina ni
redefine ninguna obligación; el contenido normativo es idéntico al de la versión 1.0.0.

Principios modificados: ninguno en sustancia. Títulos traducidos:
- I. Spec-Driven Development → I. Desarrollo Dirigido por Especificación
- II. Test-First → II. Pruebas Primero
- III. Simplicity and YAGNI → III. Simplicidad y YAGNI
- IV. Observability and Debuggability → IV. Observabilidad y Depurabilidad
- V. Security and Data Protection → V. Seguridad y Protección de Datos

Secciones renombradas:
- Web Application Constraints → Restricciones de Aplicación Web
- Development Workflow → Flujo de Trabajo de Desarrollo
- Governance → Gobernanza

Secciones eliminadas: ninguna

Elementos diferidos / TODO pendientes:
- TODO(TECH_STACK): el stack concreto, el destino de despliegue y la matriz de navegadores
  soportados siguen sin definirse. Se completan en el primer /speckit-plan y luego se amenda esta
  constitución con un incremento PATCH o MINOR según si se introducen restricciones nuevas.
-->

# Constitución de diklass

## Principios Fundamentales

### I. Desarrollo Dirigido por Especificación (NO NEGOCIABLE)

Toda funcionalidad DEBE comenzar como una especificación escrita antes de que exista
implementación alguna. El orden `spec → plan → tareas → código` es vinculante: no puede ejecutarse
ninguna tarea que no se remita a una entrada de tareas, ni existir entrada de tareas que no se
remita a una especificación aprobada.

Los cambios en el comportamiento previsto DEBEN hacerse primero en la especificación y luego
propagarse hacia adelante; el código nunca es el registro autoritativo de lo que el sistema debe
hacer. Las correcciones de errores y las tareas triviales (actualización de dependencias, formato,
correcciones tipográficas) están exentas de requerir una especificación completa, pero DEBEN pasar
igualmente por revisión.

Fundamento: la especificación es el único artefacto que sobrevive a refactorizaciones, reescrituras
y cambios de equipo. Cuando el código es la única fuente de verdad, la intención se vuelve
irrecuperable y todo cambio futuro se convierte en arqueología.

### II. Pruebas Primero (NO NEGOCIABLE)

Las pruebas DEBEN escribirse antes de la implementación que cubren, DEBEN observarse fallando por
la razón prevista, y solo entonces puede procederse a implementar. El ciclo Rojo-Verde-Refactor se
aplica de forma obligatoria, no como recomendación.

Toda corrección de error DEBE abrir con una prueba de regresión que falle y reproduzca el defecto
reportado. Ningún cambio puede integrarse mientras haya una prueba fallando, y las pruebas NO DEBEN
omitirse ni deshabilitarse para conseguir una ejecución en verde: una prueba equivocada se elimina
con justificación, nunca se silencia.

Fundamento: una prueba escrita después de la implementación verifica lo que el código hace, no lo
que debería hacer. Escribirla primero es la única forma de distinguir una especificación de una
descripción.

### III. Simplicidad y YAGNI

DEBE preferirse la implementación más simple que satisfaga la especificación. Las abstracciones,
capas de indirección, interruptores de configuración y servicios nuevos se introducen únicamente
cuando un requisito concreto y actual los exige, nunca anticipando uno hipotético.

Toda dependencia de ejecución nueva, toda capa arquitectónica nueva y toda desviación del patrón
establecido en el proyecto DEBEN justificarse por escrito en el seguimiento de complejidad del plan
antes de introducirse. "Puede que lo necesitemos más adelante" no constituye justificación.

Fundamento: la generalidad especulativa es la principal fuente de complejidad accidental de larga
vida. El código que no existe no tiene defectos, ni costo de mantenimiento, ni carga de migración.

### IV. Observabilidad y Depurabilidad

El código de servidor DEBE emitir registros estructurados y procesables por máquina, que incluyan un
identificador de correlación de petición o traza capaz de seguir una unidad de trabajo de extremo a
extremo. Los errores DEBEN registrarse con contexto suficiente para reproducir la falla sin acceso a
la petición original.

Las fallas NO DEBEN silenciarse: toda excepción capturada se maneja de forma significativa, se
vuelve a lanzar, o se registra con la severidad que corresponda. Los errores del lado del cliente
DEBEN reportarse a un destino central en lugar de quedar en la consola del usuario.

Fundamento: una aplicación web falla en producción, en máquinas a las que no es posible conectar un
depurador, ante usuarios que no reportarán el problema. La observabilidad es el único canal por el
cual esas fallas se vuelven corregibles.

### V. Seguridad y Protección de Datos

Los secretos NO DEBEN aparecer en el control de versiones, ni en los paquetes que se envían al
cliente, ni en los registros; se proveen exclusivamente mediante configuración de entorno. Toda
entrada que cruce una frontera de confianza DEBE validarse y, cuando se renderice, escaparse.

La autenticación y la autorización DEBEN aplicarse del lado del servidor en cada operación
protegida: las verificaciones en el cliente son una comodidad de uso y nunca un control. Las
dependencias DEBEN analizarse en busca de vulnerabilidades conocidas, y los datos personales DEBEN
recolectarse únicamente cuando una especificación declare la necesidad de hacerlo.

Fundamento: los defectos de seguridad se distinguen de los demás en que se explotan de forma
deliberada, suelen ser silenciosos hasta volverse catastróficos, y no pueden añadirse a posteriori
sobre una arquitectura que asumió confianza.

## Restricciones de Aplicación Web

Las vistas de cara al usuario DEBEN cumplir WCAG 2.2 Nivel AA: operabilidad por teclado en todo
control interactivo, etiquetas programáticas en los campos de formulario, indicación visible del
foco, y contraste de texto igual o superior a la razón exigida. La accesibilidad es una compuerta de
integración, no un elemento del backlog.

Las interfaces DEBEN ser adaptables en todo el rango de viewport soportado y DEBEN permanecer
utilizables sin saltos de maquetación dependientes de JavaScript en el primer pintado. Los
presupuestos de rendimiento se fijan por funcionalidad en su plan y se verifican antes de integrar;
una funcionalidad que degrada un presupuesto acordado no se publica.

TODO(TECH_STACK): el lenguaje, framework, almacenamiento, destino de despliegue y matriz de
navegadores soportados aún no se han seleccionado. DEBEN registrarse aquí en el primer
`/speckit-plan` y esta constitución DEBE amendarse en consecuencia.

## Flujo de Trabajo de Desarrollo

El trabajo avanza siguiendo el flujo de Spec Kit: `/speckit-specify` para capturar la intención,
`/speckit-plan` para elegir un enfoque, `/speckit-tasks` para descomponerlo y `/speckit-implement`
para ejecutarlo. La verificación cruzada `/speckit-analyze` DEBERÍA ejecutarse antes de comenzar la
implementación de cualquier funcionalidad que abarque más de un puñado de tareas.

Todo cambio propuesto para integración DEBE ser revisado por alguien distinto de su autor, y la
revisión DEBE verificar explícitamente el cumplimiento de los Principios Fundamentales anteriores.
Las compuertas automatizadas —suite completa de pruebas, análisis estático, verificación de tipos y
análisis de vulnerabilidades en dependencias— DEBEN pasar antes de que concluya la revisión; una
tubería en rojo no se anula con la aprobación de un revisor.

El desarrollo asistido por agentes se somete a las mismas compuertas que el trabajo escrito por
personas. La guía de desarrollo en tiempo de ejecución para agentes vive en `CLAUDE.md`, en la raíz
del repositorio; ese archivo describe cómo trabajar en esta base de código y nunca prevalece sobre
las reglas de esta constitución.

## Gobernanza

Esta constitución prevalece sobre cualquier otra práctica, convención o costumbre de desarrollo.
Cuando el valor por omisión de una herramienta, un modismo de un framework o un archivo existente
entren en conflicto con un principio aquí declarado, prevalece este documento y el conflicto se
resuelve modificando el código.

Las enmiendas DEBEN proponerse como un cambio escrito a este archivo, revisarse como cualquier otro
cambio, y acompañarse de una nota de migración cuando dejen código existente fuera de cumplimiento.
El versionado sigue el versionado semántico: MAYOR para la eliminación o redefinición incompatible
de un principio, MENOR para un principio nuevo o una guía materialmente ampliada, PARCHE para
aclaraciones y redacción que no alteren obligaciones.

El cumplimiento se revisa de forma continua en el momento de integrar, no mediante una auditoría
periódica. Toda complejidad admitida bajo el Principio III DEBE conservar su justificación
registrada mientras permanezca en la base de código; cuando la justificación deje de ser cierta, la
complejidad se elimina.

**Versión**: 1.0.1 | **Ratificada**: 2026-09-09 | **Última enmienda**: 2026-09-09
