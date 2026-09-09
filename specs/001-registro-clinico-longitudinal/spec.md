# Feature Specification: Registro clínico longitudinal

**Feature Branch**: `docs/project-constitution` (rama activa; directorio: `specs/001-registro-clinico-longitudinal`)

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: capa de registro clínico del PoC de CDSS de etología veterinaria
canina — ficha de paciente y tutor, consulta con anamnesis estructurada, epicrisis validada por el
profesional e historial longitudinal recuperable entre consultas. Sin componentes de recuperación de
conocimiento, voz ni apoyo a la decisión, que se especifican por separado.

**Contexto de producto**: [Brief del PoC](../../docs/brief-poc-cdss.md)

**Nota sobre identificadores**: los `FR-NNN` y `SC-NNN` son únicos a nivel de familia de specs. Un
requisito transversal aparece íntegro en cada spec donde aplica, designando siempre el mismo
requisito.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ficha de paciente y tutor (Priority: P1)

El veterinario registra un perro nuevo con sus antecedentes básicos y los datos de contacto de su
tutor, antes o durante una consulta. Puede volver a la ficha más tarde para ampliarla sin que se
pierda nada de lo registrado antes.

**Why this priority**: Es la base del registro longitudinal. Sin una identidad estable de paciente
no existe historial, y sin historial ninguna de las capas de apoyo clínico tiene sobre qué operar.
Entregada sola, ya es un registro clínico utilizable.

**Independent Test**: Registrar un perro con todos los campos mínimos, cerrarlo, reabrirlo, agregar
un antecedente nuevo y verificar que la información previa permanece intacta.

**Acceptance Scenarios**:

1. **Given** que no existe el paciente, **When** el veterinario completa nombre, especie, raza,
   fecha de nacimiento o edad, peso, sexo, estado reproductivo y los datos del tutor, **Then** el
   sistema crea la ficha y la deja disponible para asociar consultas.
2. **Given** una ficha existente, **When** el veterinario agrega una enfermedad preexistente y una
   alergia conocida, **Then** ambos quedan registrados y ningún dato anterior se modifica ni se
   elimina.
3. **Given** una ficha con campos opcionales vacíos, **When** el veterinario la guarda, **Then** el
   sistema la acepta y señala explícitamente qué información clínica relevante falta.
4. **Given** un tutor responsable de más de un paciente, **When** se registra un segundo perro,
   **Then** el sistema permite asociarlo al tutor existente sin duplicar sus datos de contacto.
5. **Given** una ficha con medicamentos actuales y antecedentes conductuales registrados, **When** el
   veterinario la consulta, **Then** el sistema muestra ambos campos con el contenido guardado.

---

### User Story 2 - Consulta clínica con anamnesis estructurada (Priority: P1)

El veterinario abre una nueva consulta sobre un paciente existente y registra la anamnesis,
combinando campos estructurados (motivo de consulta, comportamiento problemático, frecuencia,
duración, contexto, desencadenantes, cambios recientes, ambiente, convivencia con personas y otros
animales, alimentación, actividad, rutinas, tratamientos anteriores y respuesta a ellos) con texto
libre. Cada antecedente queda marcado según su procedencia: reportado explícitamente, inferido por
el sistema, o desconocido.

**Why this priority**: Es la unidad de trabajo clínico del sistema. Todo lo demás —evidencia,
hipótesis, epicrisis— se cuelga de una consulta con anamnesis.

**Independent Test**: Abrir una consulta, llenar la anamnesis a mano, guardarla y verificar que
queda asociada al paciente con fecha, profesional y marcas de procedencia por campo.

**Acceptance Scenarios**:

1. **Given** un paciente registrado, **When** el veterinario inicia una consulta, **Then** el
   sistema la asocia al paciente con fecha y profesional responsable.
2. **Given** una consulta abierta, **When** el veterinario escribe el motivo de consulta y describe
   el comportamiento problemático en texto libre, **Then** ambos quedan almacenados y distinguibles
   entre sí.
3. **Given** un antecedente que el veterinario deduce del relato del tutor sin que este lo haya
   afirmado, **When** lo registra marcándolo como inferido, **Then** queda almacenado con esa
   procedencia y se distingue de los reportados explícitamente.
4. **Given** un campo estructurado sin información, **When** se consulta la anamnesis, **Then** el
   campo aparece como desconocido y no como negativo.
5. **Given** una anamnesis en curso, **When** el veterinario corrige la procedencia de un
   antecedente marcado como inferido, **Then** queda registrado como reportado y la corrección es
   recuperable.
6. **Given** una consulta abierta por un veterinario, **When** otro registra un antecedente en su
   anamnesis, **Then** consta que ese antecedente lo registró el segundo, no el primero.

---

### User Story 3 - Epicrisis con validación profesional (Priority: P1)

Al cerrar la consulta el sistema arma un borrador de epicrisis con lo registrado durante la sesión.
El veterinario lo corrige y lo aprueba explícitamente; recién entonces pasa a formar parte del
historial.

**Why this priority**: Es el punto donde el trabajo de la consulta se vuelve registro permanente, y
donde se materializa la regla de que ninguna salida del sistema entra al historial sin validación
humana.

**Independent Test**: Cerrar una consulta con anamnesis cargada, verificar que se genera un borrador
editable, modificarlo, aprobarlo y comprobar que queda en el historial como registro aprobado.

**Acceptance Scenarios**:

1. **Given** una consulta con anamnesis y diagnóstico registrados, **When** el veterinario la
   cierra, **Then** el sistema presenta un borrador de epicrisis editable con motivo de consulta,
   antecedentes relevantes, hallazgos de la anamnesis, hipótesis consideradas con su estado,
   diagnóstico registrado por el veterinario, exámenes solicitados, intervenciones propuestas,
   medicamentos aprobados, recomendaciones al tutor, plan de seguimiento y observaciones.
2. **Given** un borrador de epicrisis, **When** el veterinario edita su contenido y lo aprueba,
   **Then** se almacena la versión aprobada junto con la identidad de quien aprobó y el momento de
   aprobación.
3. **Given** un borrador de epicrisis no aprobado, **When** se consulta el historial del paciente,
   **Then** el borrador no aparece como registro clínico definitivo.
4. **Given** una epicrisis ya aprobada en la que se detecta un error, **When** el veterinario la
   corrige, **Then** se genera un registro nuevo y la versión original permanece recuperable.

---

### User Story 4 - Seguimiento longitudinal entre consultas (Priority: P1)

Cuando el paciente vuelve, el sistema le presenta al veterinario un resumen de lo relevante de las
consultas anteriores: diagnóstico previo, tratamiento indicado, medicamentos, recomendaciones,
evolución registrada, exámenes y pendientes. La consulta nueva agrega información sin tocar los
registros anteriores.

**Why this priority**: Es la mitad del valor prometido —integrar información longitudinal— y el
segundo tramo del escenario demostrador del PoC.

**Independent Test**: Con un paciente que ya tiene una epicrisis aprobada, iniciar una segunda
consulta y verificar que el resumen previo se presenta correctamente y que la epicrisis anterior
permanece sin cambios al cerrar la nueva.

**Acceptance Scenarios**:

1. **Given** un paciente con al menos una consulta cerrada, **When** el veterinario inicia una
   consulta nueva, **Then** el sistema muestra el resumen de antecedentes relevantes de las
   consultas previas sin que deba buscarlo manualmente en el historial.
2. **Given** una segunda consulta en curso, **When** el veterinario registra nueva información y la
   cierra, **Then** los registros de la consulta anterior permanecen idénticos.
3. **Given** un pendiente registrado en la sesión anterior, **When** se abre la nueva consulta,
   **Then** ese pendiente aparece señalado.
4. **Given** un paciente con varias consultas cerradas, **When** el veterinario consulta el
   historial, **Then** las consultas se presentan en orden cronológico.
5. **Given** una consulta abierta que se interrumpió sin cerrarse, **When** el veterinario la
   retoma, **Then** recupera su contenido y nada de él había entrado al historial.

---

### Edge Cases

- **Consulta interrumpida**: si la sesión se cierra sin aprobar la epicrisis, el trabajo debe poder
  retomarse sin haber contaminado el historial.
- **Epicrisis aprobada con error detectado después**: debe corregirse mediante un registro nuevo que
  preserve el original, nunca sobrescribiéndolo.
- **Ficha ampliada entre consultas**: agregar antecedentes a la ficha no debe alterar
  retroactivamente las epicrisis ya aprobadas.
- **Paciente sin peso registrado**: el sistema debe aceptarlo y señalar la ausencia, sin asumir un
  valor por omisión.
- **Tutor que cambia de contacto**: actualizar sus datos no debe alterar las epicrisis aprobadas que
  ya lo referencian.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir crear, consultar y actualizar fichas de pacientes caninos con
  nombre, especie, raza, fecha de nacimiento o edad, peso, sexo, estado reproductivo, antecedentes
  médicos, enfermedades preexistentes, medicamentos actuales, alergias conocidas y antecedentes
  conductuales.
- **FR-044**: El sistema MUST aceptar una ficha con campos sin completar y MUST señalar cuáles de
  los campos de FR-001 quedaron sin información, distinguiendo visiblemente un campo sin dato de un
  hallazgo negativo registrado.
- **FR-027**: El sistema MUST registrar datos básicos de contacto del tutor (nombre y al menos un
  medio de contacto) asociados al paciente, permitiendo que un tutor tenga varios pacientes.
- **FR-003**: El sistema MUST permitir registrar una nueva sesión clínica asociada a un paciente,
  una fecha y el profesional autenticado que la abre (FR-063, spec 007).
- **FR-004**: El sistema MUST almacenar antecedentes de anamnesis mediante campos estructurados y
  texto libre, permitiendo ambos en una misma consulta, y MUST atribuir cada antecedente a la
  identidad autenticada de quien lo registró (FR-063, spec 007), que puede no ser la de quien abrió
  la consulta.
- **FR-021**: El sistema MUST registrar y mostrar, para cada antecedente clínico, si fue reportado
  explícitamente, inferido por el sistema o es desconocido, y MUST permitir al veterinario corregir
  esa procedencia.
- **FR-011**: El sistema MUST generar un borrador editable de epicrisis a partir de la sesión, con
  motivo de consulta, antecedentes, hallazgos, hipótesis consideradas con su estado, diagnóstico
  registrado, exámenes, intervenciones propuestas, medicamentos aprobados, recomendaciones, plan de
  seguimiento y observaciones. Las hipótesis las aporta la spec 004 y los medicamentos la 005; en
  ausencia de ellas los campos quedan vacíos sin impedir la generación del borrador.
- **FR-012**: La epicrisis MUST ser confirmada explícitamente por el veterinario antes de
  almacenarse como registro definitivo, quedando registrada la identidad autenticada de quien
  aprueba (FR-063, spec 007) y el momento de aprobación.
- **FR-010**: El sistema MUST NOT incorporar automáticamente ninguna salida propia al historial
  clínico como registro definitivo; toda incorporación MUST requerir validación explícita del
  veterinario.
- **FR-045**: El sistema MUST permitir retomar una consulta no cerrada conservando su contenido, sin
  que nada de ese contenido haya pasado al historial clínico.
- **FR-002**: El sistema MUST mantener un historial cronológico de consultas por paciente.
- **FR-013**: El sistema MUST recuperar y presentar, al iniciar una nueva consulta del mismo
  paciente, el contenido de las epicrisis aprobadas anteriores: diagnóstico previo, intervenciones
  propuestas, recomendaciones al tutor, exámenes solicitados y pendientes del plan de seguimiento.
  Los medicamentos efectivamente prescritos los aporta FR-036 (spec 005) y la evolución posterior
  FR-042 (spec 006); FR-013 no los produce ni los exige para ser verificable.
- **FR-024**: El sistema MUST preservar los registros clínicos de consultas anteriores sin
  modificarlos al registrar información nueva; toda corrección posterior MUST generar un registro
  adicional que conserve el original.

### Trazabilidad de requisitos

Cada requisito funcional se verifica mediante los escenarios de aceptación indicados.

| Requisito | Verificado por |
|---|---|
| FR-001 | US1 / 1, 2, 5 |
| FR-044 | US1 / 3 |
| FR-027 | US1 / 1, 4 |
| FR-003 | US2 / 1 |
| FR-004 | US2 / 2, 6 |
| FR-021 | US2 / 3, 4, 5 |
| FR-011 | US3 / 1 |
| FR-012 | US3 / 2 |
| FR-010 | US3 / 3 |
| FR-024 | US3 / 4 · US4 / 2 |
| FR-045 | US4 / 5 |
| FR-002 | US4 / 4 |
| FR-013 | US4 / 1, 3 |

### Key Entities *(include if feature involves data)*

- **Paciente**: el animal atendido. Identidad estable, datos de identificación y señalamiento,
  antecedentes médicos y conductuales. Se relaciona con un Tutor y con muchas Consultas.
- **Tutor**: persona responsable de uno o más pacientes. Nombre y al menos un medio de contacto.
- **Consulta**: episodio clínico asociado a una fecha, un paciente y un profesional. Contiene la
  Anamnesis y culmina en una Epicrisis.
- **Anamnesis**: información clínica recopilada durante una consulta, en campos estructurados y
  texto libre, donde cada antecedente lleva su procedencia.
- **Observación clínica**: unidad mínima de información registrada durante la consulta, con su
  procedencia (reportada, inferida, desconocida) y la identidad autenticada de quien la registró,
  que puede no ser la de quien abrió la consulta. El estado de confirmación que usa la spec 003 se
  añade allí; en la 001 toda observación se registra ya confirmada por el veterinario.
- **Epicrisis**: resumen clínico de una consulta, con estado borrador o aprobado, y registro de
  quién aprobó y cuándo. Inmutable una vez aprobada.
- **Diagnóstico**: diagnóstico registrado explícitamente por el veterinario, atribuido a él.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-012**: Un veterinario registra un paciente nuevo con sus campos mínimos y los datos del tutor
  en menos de 3 minutos, sin asistencia.
- **SC-009**: El 100% de los registros clínicos aprobados permanece sin modificaciones tras
  consultas posteriores, verificable mediante comparación del historial.
- **SC-011**: En el 100% de las consultas de pacientes con historial, el resumen de antecedentes
  previos se presenta al iniciar la consulta sin que el veterinario ejecute ninguna acción de
  búsqueda.
- **SC-014**: El 100% de las consultas cerradas es recuperable desde el historial del paciente en
  orden cronológico, con su epicrisis aprobada asociada.
- **SC-013**: En la evaluación por al menos 3 especialistas sobre al menos 5 casos, la utilidad de
  la epicrisis generada obtiene al menos 3 de 5 en promedio.
- **SC-024**: El 100% de los antecedentes de anamnesis muestra su procedencia, sin campos cuya
  ausencia de información se confunda con un hallazgo negativo.

## Assumptions

- **Identidad provista por la spec 007**: el profesional responsable de una consulta y quien
  aprueba una epicrisis son identidades autenticadas, no texto libre. Los veterinarios comparten los
  pacientes de la clínica; el aislamiento por profesional y el multi-tenancy siguen fuera del PoC.
- **Datos sintéticos**: se ejercita con pacientes y tutores ficticios; no se procesan datos
  personales reales.
- **Una sola especie**: el modelo de datos contempla el campo especie para permitir extensión
  futura, pero solo se valida con perros.
- **Idioma único**: interfaz y registros en español.
- **Sin extracción automática**: esta spec no infiere antecedentes por su cuenta. La procedencia la
  asigna el veterinario. El valor "inferido" existe porque la spec 003 produce antecedentes
  derivados del audio que aterrizan en esta misma anamnesis, pero construir la 001 sola no requiere
  ninguna capacidad de extracción.
- **Alcance de plataforma**: se prioriza el uso desde computador; el uso móvil condiciona el diseño
  pero no es criterio de éxito.

### Dependencias

- **Spec 007 (identidad y acceso)**: aporta la identidad autenticada del profesional responsable de
  la consulta (FR-003) y de quien aprueba la epicrisis (FR-012). Sin ella esas atribuciones son
  texto que nadie respalda.

FR-011 y FR-013 reservan campos —hipótesis consideradas, medicamentos aprobados— que las specs 004 y
005 pueblan cuando existen. Eso **no** es una dependencia: la 001 se construye y se verifica con
esos campos vacíos. La evolución posterior es de la spec 006 (FR-042) y la 001 no la exige.
