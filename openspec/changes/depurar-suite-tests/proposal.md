# Proposal

## Why

La auditoría de tests detectó comprobaciones repetidas, contratos antiguos que no observan el
comportamiento anunciado y exports sin consumidores. Depurarlos reduce mantenimiento y recorridos
de navegador sin debilitar las garantías clínicas, de acceso ni de accesibilidad.

## What Changes

- Eliminar o fusionar los candidatos documentados en la matriz de `design.md`, conservando una
  prueba identificada para cada garantía vigente. La matriz es una propuesta pendiente de
  implementación y verificación, no una autorización para borrar cualquier test parecido.
- Corregir nombres y expectativas que prometen comprobar más de lo que ejecutan; retirar las
  aserciones sobre propiedades ausentes de esquemas o clientes falsos.
- Retirar el flujo nativo duplicado de login llamado `attribution.yaml` y documentar la cobertura
  real de US12 como pendiente en el cambio activo de identidad antes de eliminarlo.
- Corregir la lentitud de `search_patients` reproducida durante el cierre, mediante una migración mínima si el diagnóstico la requiere; preservar firma, resultados, RLS y atribución, sin aumentar el timeout ni borrar datos. Ampliación autorizada por el responsable tras el bloqueo de cierre.
- Eliminar helpers, constantes y funciones sin consumidores confirmados en código, tests,
  fixtures, scripts, configuración y referencias dinámicas.
- Registrar por recorte su justificación, cobertura conservada y verificación. No se fija una
  cuota de tests, líneas o tiempo que obligue a eliminar pruebas útiles.

## Capabilities

### New Capabilities

Ninguna. Es mantenimiento de tests y eliminación de código sin uso.

### Modified Capabilities

Ninguna: no cambian requisitos, escenarios, umbrales ni IDs FR/US/SC. Se declara
`skip_specs: true`; no se crean deltas ni se editan las especificaciones aceptadas.

## Impact

- Áreas: `tests/unit/`, un bloque de `tests/integration/attribution/`, tests web de autenticación
  y navegación, `tests/e2e/native/`, y los exports enumerados en `design.md`.
- Capacidades cuya evidencia se conserva: identidad y acceso (FR-061, FR-062, FR-063; US11,
  US12), sistema visual (FR-074, FR-079, FR-104), registro clínico y compatibilidad de anamnesis.
  Se mantienen las garantías del brief y la constitución aunque su aceptación esté pendiente.
- Dependencias de construcción: las suites y los flujos existentes; no se añaden librerías,
  scripts, servicios ni contratos. La ampliación de rendimiento permite una migración correctiva. Se mantienen los comandos actuales de CI.
- Aceptación conjunta: esta limpieza no acepta identidad, registro ni las demás funcionalidades.
  La deuda nativa de US12 continúa en identidad y acceso; su ejecución real no se sustituye por
  un checklist documental.
- Estado: plan propuesto, sin implementación ni aceptación. La auditoría se hizo sobre
  `317cd9a`, en `chore/auditoria-reduccion-tests`; los cambios sin commit del checkout original
  quedaron fuera. Se revalidarán los candidatos contra la base de integración antes de aplicar.
