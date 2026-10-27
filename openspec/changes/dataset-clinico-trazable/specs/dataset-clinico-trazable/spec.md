## Purpose

Mantener datos sintéticos de demostración plausibles y reproducibles, con cobertura comprobable
de la aplicación y trazabilidad desde las fuentes estructurales hasta los registros cargados.
Complementa FR-127 sin modificar sus cantidades, comandos ni protecciones.

## ADDED Requirements

### Requirement: FR-128 Coherencia del dataset

El dataset MUST conservar las cantidades de FR-127, usar nombres naturales en español de Chile,
mantener relaciones familiares, edades, pesos y antecedentes coherentes y distinguir los datos
desconocidos de los negativos. MUST NOT contener identidades copiadas de fuentes ni atribuir
conductas a una raza como causa demostrada.

#### Scenario: US20-AC1 Elenco consistente

- **GIVEN** el dataset completo
- **WHEN** se valida antes de cargar
- **THEN** contiene 15 tutores y 25 pacientes, 17 caninos y 8 felinos, con referencias existentes,
  claves únicas, fechas no futuras respecto de su fecha de referencia y pesos positivos cuando constan.
- **THEN** una fecha de nacimiento desconocida permanece vacía y puede acompañarse de edad estimada;
  un antecedente ausente no se convierte en un hallazgo negativo.

#### Scenario: US20-AC2 Conflicto dentro del hogar

- **GIVEN** dos pacientes del mismo hogar y relatos incompatibles sobre sus convivientes
- **WHEN** se revisa la coherencia editorial del conjunto
- **THEN** la aceptación queda pendiente hasta resolver el conflicto, aunque los esquemas sean válidos.

### Requirement: FR-129 Trazabilidad de autoría y fuentes

Cada entidad y entrada del fixture MUST tener una clave estable, autoría sintética y relación con
caso, requisitos, escenario, prueba y origen editorial o documental. Las fuentes MUST identificar
ruta, SHA-256, página/sección y uso. Un formulario vacío MUST NOT citarse como evidencia de un
diagnóstico, dosis, prevalencia o resultado clínico.

#### Scenario: US20-AC3 Reconstruir una entrada

- **GIVEN** una entrada de anamnesis cargada
- **WHEN** se consulta su trazabilidad
- **THEN** se puede recorrer versión y revisión Git → clave de caso y entrada → campo vigente →
  fuente estructural o autoría editorial → FR/escenario → prueba → ID persistido y eventos asociados.
- **THEN** la procedencia clínica (`reportada`, `inferida`, `recuperada`, `desconocida`) permanece
  separada de la procedencia del fixture; una frase inventada no se registra como evidencia recuperada.

#### Scenario: US20-AC4 Nombres homónimos

- **GIVEN** dos mascotas llamadas Pepa o un cambio de nombre
- **WHEN** se resuelven vínculos entre pacientes y consultas
- **THEN** se usan claves estables y la asociación no cambia por el nombre ni la posición del array.

### Requirement: FR-130 Cobertura de flujos clínicos

El dataset MUST cubrir las 14 secciones caninas, respuestas cerradas y ausencia de respuesta,
derivación, plan, consultas abiertas y cerradas, borrador, seguimiento y correcciones aditivas.
Los ocho felinos MUST limitarse a ficha administrativa. Los estados cerrados MUST ser simulaciones
editoriales explícitas mediante los servicios existentes, sin aprobación automática de salidas del asistente.

#### Scenario: US20-AC5 Composición observable

- **WHEN** se completa la carga del dataset
- **THEN** hay 8 consultas en 6 perros: 3 cerradas con epicrisis aprobada y 5 abiertas, de las cuales
  una tiene borrador de epicrisis; dos perros tienen consulta previa cerrada y consulta posterior abierta.
- **THEN** hay 6 registros de retroalimentación, incluida una corrección, y una epicrisis correctiva
  adicional; las versiones originales permanecen recuperables conforme a FR-024.
- **THEN** los ejemplos cubren las 4 adherencias y las 5 evoluciones vigentes, y al menos un evento
  adverso diferenciado, sin convertirlo en una afirmación causal demostrada.

#### Scenario: US20-AC6 Cobertura estructural

- **WHEN** se comprueba la matriz de cobertura
- **THEN** cada sección canina tiene al menos una entrada válida y existen `si`, `no` y `a_veces`
  en campos que los admiten, además de una pregunta cerrada deliberadamente sin respuesta.
- **THEN** los campos nuevos se clasifican como cubiertos o excluidos con motivo y prueba asociada;
  ningún ID desconocido o campo legacy se introduce como entrada nueva.

### Requirement: FR-131 Vigencia frente a cambios de la app

La verificación ligera MUST fallar si cambia un contrato vigilado sin actualizar o revisar
explícitamente el dataset. MUST contrastar esquemas, catálogos, cobertura y huellas de contratos
con la versión registrada. Una revisión sin cambios de datos MUST registrar su motivo; renovar
huellas por sí solo MUST NOT acreditar cobertura ni aceptación clínica.

#### Scenario: US20-AC7 Cambio incompatible

- **GIVEN** un campo de anamnesis retirado o una categoría de evolución modificada
- **WHEN** se ejecuta la verificación focalizada y la CI
- **THEN** fallan indicando el contrato y las claves afectadas hasta adaptar el dataset y sus pruebas.

#### Scenario: US20-AC8 Cambio compatible o documental

- **GIVEN** una modificación vigilada que no requiere nuevos ejemplos
- **WHEN** se registra una revisión con motivo y se ejecutan los controles
- **THEN** se acepta la vigencia solo si esquema, cobertura y pruebas siguen pasando.
- **THEN** un PR que solo modifica especificaciones o documentación clínica vigilada ejecuta este
  control ligero, sin arrancar la batería completa ni Supabase.

### Requirement: FR-132 Carga verificable y no destructiva

El cargador MUST validar todo antes de escribir y usar sesiones y servicios reales conforme a
FR-127 y FR-063. MUST distinguir carga completa, parcial, diferente y vacía; solo la completa
idéntica permite omitir escrituras con éxito. MUST emitir un manifiesto de ejecución sin secretos.
MUST NOT borrar ni modificar registros aprobados para actualizar el demo.

#### Scenario: US20-AC9 Fallo previo o parcial

- **GIVEN** referencias inválidas, contrato desactualizado o fixture mal formado
- **WHEN** se intenta cargar
- **THEN** falla antes de la primera escritura y el mensaje identifica las claves afectadas.
- **GIVEN** una interrupción después de crear parte de los registros
- **WHEN** se repite la carga
- **THEN** falla como parcial, no duplica ni informa carga completa, y explica cómo reconstruir
  deliberadamente una base local desechable; el cargador nunca ejecuta un reset por sí mismo.

#### Scenario: US20-AC10 Repetición y auditoría

- **GIVEN** un dataset completo de la misma versión y contenido
- **WHEN** se repite la carga
- **THEN** no hay nuevas escrituras y se verifica el grafo esperado, no solo el primer RUT.
- **THEN** el manifiesto identifica versión, revisión, huella, claves, registros y eventos;
  las fechas e identidades de auditoría son las reales del servidor y la cronología simulada
  aparece separada y etiquetada en la documentación del dataset.

## Traceability

| Requisito | Escenarios nuevos | Requisitos e historias existentes ejercitados | Prueba prevista |
|---|---|---|---|
| FR-128 | US20-AC1–AC2 | FR-001, FR-027, FR-044, FR-124–FR-127; US1-AC1/3/4 | `tests/unit/scripts/datos-demo.test.ts` y revisión editorial |
| FR-129 | US20-AC3–AC4 | FR-021, FR-063; US2-AC3/4/6; SC-024 | `tests/unit/scripts/datos-demo.test.ts`, integración de carga |
| FR-130 | US20-AC5–AC6 | FR-004, FR-010–FR-013, FR-018, FR-024, FR-039–FR-043, FR-110–FR-112; US3, US4, US10 | cobertura unitaria, integración e inspección del historial |
| FR-131 | US20-AC7–AC8 | FR-124, FR-127 | prueba de deriva de contrato y workflow ligero |
| FR-132 | US20-AC9–AC10 | FR-024, FR-063, FR-070, FR-127; SC-009, SC-022, SC-049 | pruebas del cargador e integración viva |

No se asignan nuevos SC: los escenarios anteriores son la aceptación de esta capacidad. Los SC
citados conservan sus umbrales originales; disponer de fixtures no demuestra haberlos aceptado.
