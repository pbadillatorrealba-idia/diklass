## Purpose

Ejecutar integración y e2e con datos del dataset compartido en un destino de pruebas explícito,
con creación atribuida y eliminación acotada, sin contaminar desarrollo ni demostración.

## ADDED Requirements

### Requirement: FR-133 Plantillas compartidas en tests

Los tests de integración y e2e MUST reutilizar nombres y hogares del dataset vigente, conservando
claves y recursos exclusivos por ejecución, prueba e intento. MUST NOT depender de filas del demo
previamente cargadas ni añadir etiquetas técnicas a los nombres visibles. Las pruebas de datos
inválidos y límites MUST conservar sus fixtures específicos.

#### Scenario: US21-AC1 Nombres y reintentos

- **GIVEN** dos ejecuciones o intentos del mismo caso
- **WHEN** crean un paciente y su tutor desde una plantilla compartida
- **THEN** muestran los mismos nombres naturales, pero sus UUID, RUT válidos y registro de propiedad
  son diferentes; una ejecución no identifica ni elimina filas buscando por nombre.

### Requirement: FR-134 Destino de pruebas explícito

El runner MUST exigir configuración de testing completa y verificar una instancia local
desechable identificada, distinta de desarrollo/demo, antes de crear, limpiar o reiniciar datos.
App, helpers y limpieza MUST usar el mismo destino. MUST NOT usar variables de desarrollo como
fallback ni admitir un destino remoto en este cambio.

#### Scenario: US21-AC2 Configuración incompleta o contradictoria

- **WHEN** falta una variable obligatoria, el backend es remoto, no se verifica su identidad de
  pruebas o la app compilada apunta a otro destino
- **THEN** falla antes de la primera escritura sin mostrar secretos ni iniciar un reset.
- **THEN** pedir explícitamente una suite viva sin configuración no produce un éxito por omisión;
  las ejecuciones unitarias ordinarias pueden seguir omitiendo suites vivas conforme a su contrato.

### Requirement: FR-135 Limpieza acotada y verificable

Cada fixture persistente MUST registrar sus recursos al crearlos y eliminarlos en teardown,
también ante fallo de setup o aserción. La limpieza privilegiada MUST limitarse al destino de
testing y a IDs de su ejecución, incluidas dependencias y storage. MUST NOT ampliar permisos del
producto, desactivar triggers ni borrar globalmente por nombre, tipo o clínica.

#### Scenario: US21-AC3 Fallo parcial y residuos

- **GIVEN** un fixture que crea tutor, paciente, consulta y registros dependientes
- **WHEN** falla una aserción o una creación posterior
- **THEN** el teardown elimina los recursos ya registrados y verifica su ausencia, conserva el fallo
  original y reporta cualquier fallo adicional de limpieza.
- **GIVEN** una interrupción que impide ejecutar teardown
- **WHEN** se inicia otra ejecución o se solicita recuperación
- **THEN** se informan residuos identificables y solo se limpian tras verificar mismo destino y
  propiedad; no se promete que un proceso terminado por fuerza pueda ejecutar finally.

#### Scenario: US21-AC4 Recursos ajenos preservados

- **GIVEN** registros centinela ajenos al test y dos conjuntos de IDs separados
- **WHEN** se limpia uno de los conjuntos
- **THEN** el otro y los centinelas permanecen intactos y los permisos normales siguen rechazando
  DELETE de registros clínicos y auditoría.

### Requirement: FR-136 Ejecución aislada y trazabilidad

El ciclo de tests MUST producir un reporte de ejecución, versión del dataset, claves usadas,
recursos creados/eliminados y residuos sin secretos. MUST impedir uso simultáneo de una instancia
compartida por runners y ejecutar integración y e2e secuencialmente con un worker en esta máquina.
La repetición MUST partir de un estado equivalente sin exigir reset del backend de desarrollo.

#### Scenario: US21-AC5 Repetición e independencia

- **WHEN** se ejecuta dos veces el subconjunto representativo de integración y e2e, incluida una
  falla deliberada para comprobar teardown
- **THEN** el conteo de recursos del test vuelve al estado inicial, los datos ajenos no cambian y
  el reporte relaciona cada creación y eliminación con su ejecución e intento.
- **THEN** un segundo runner dirigido a una instancia ocupada falla antes de escribir; la reserva
  no depende solo de un lock dentro de un checkout distinto.

## Traceability

| Requisito | Escenario | Relaciones existentes | Evidencia prevista |
|---|---|---|---|
| FR-133 | US21-AC1 | FR-128/FR-129; US1, US2 | Test de plantillas y reintentos, e2e representativo |
| FR-134 | US21-AC2 | Constitución V; FR-063 | Pruebas de configuración/destino, export web dirigida al destino |
| FR-135 | US21-AC3/AC4 | FR-024, FR-063 | Fallos inyectados, centinelas y regresión de permisos |
| FR-136 | US21-AC5 | FR-132; SC-009, SC-022 | Dos ejecuciones y reporte de recursos/limpieza |

FR-128–FR-132 dependen del cambio anterior; los demás IDs conservan su contrato. Ninguna de estas
pruebas autoriza eliminar datos clínicos de un entorno de producto.
