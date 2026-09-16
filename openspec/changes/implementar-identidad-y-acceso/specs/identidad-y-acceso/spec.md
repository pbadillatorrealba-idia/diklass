#  Identidad y acceso

## Purpose

capa de identidad del PoC de CDSS de etología veterinaria canina — cuentas de veterinario provisionadas, acceso autenticado, y atribución verificable de toda acción clínica a la persona que la realizó, dentro de una clínica compartida donde los profesionales ven los mismos pacientes.

**Created**: 2026-09-09

**Status**: Draft — pendiente de aceptación

**Contexto de producto**: [Brief del PoC](../../../../../docs/brief-poc-cdss.md)

**Nota sobre identificadores**: FR/SC conservan su identidad global. Los requisitos transversales comparten ID y pueden especializarse por dominio sin contradecir la obligación canónica del brief.

**Nota de orden**: esta funcionalidad se construye **primero**. Los
números identifican specs, no ordenan su construcción; el orden lo fija la lista de aristas del
brief.

## User Scenarios & Testing

### User Story 11 - Acceso autenticado del veterinario (Priority: P1)

El veterinario accede al sistema con una cuenta que le fue provisionada. Mientras su sesión está
activa, el sistema sabe quién es. Al cerrarla, deja de saberlo.

**Why this priority**: Sin identidad verificada, toda la cadena de responsabilidad clínica del PoC
—quién registró, quién aprobó, quién prescribió— es texto que nadie respalda. Es la base de las
demás specs.

**Independent Test**: Acceder con una cuenta provisionada, comprobar que el sistema identifica al
profesional durante la sesión, cerrar sesión y comprobar que ya no permite operar.

**Acceptance Scenarios**:

1. **Given** una cuenta de veterinario provisionada, **When** el profesional se autentica con sus
   credenciales, **Then** el sistema inicia su sesión y lo identifica en las operaciones que realice.
2. **Given** una cuenta existente y una contraseña incorrecta, **When** se intenta acceder,
   **Then** el sistema deniega el acceso sin revelar si el fallo fue en el identificador o en la
   contraseña.
3. **Given** un identificador que no corresponde a ninguna cuenta, **When** se intenta acceder,
   **Then** el sistema deniega el acceso con una respuesta indistinguible de la del escenario
   anterior.
4. **Given** una sesión activa, **When** el veterinario la cierra, **Then** el sistema deja de
   permitir operaciones clínicas hasta un nuevo acceso.
5. **Given** una sesión sin actividad durante más tiempo del permitido, **When** el veterinario
   intenta operar, **Then** el sistema exige autenticarse nuevamente y conserva el contenido que el
   veterinario había introducido y no guardado.
6. **Given** que no hay sesión activa, **When** se intenta acceder directamente a una operación
   clínica, **Then** el sistema la deniega.
7. **Given** la aplicación en cualquier estado, **When** se busca una forma de registrar información
   clínica sin autenticarse, **Then** no existe ninguna: no hay modo anónimo ni invitado.
8. **Given** una operación denegada por falta de sesión, **When** se intenta repetirla eludiendo la
   interfaz de usuario, **Then** el sistema la deniega igualmente.

---

### User Story 12 - Atribución verificable en la clínica compartida (Priority: P1)

Los veterinarios de la clínica ven los mismos pacientes y pueden atender a cualquiera de ellos. Cada
acción clínica —abrir una consulta, aprobar una epicrisis, registrar un diagnóstico, aprobar un
fármaco— queda atribuida a la identidad autenticada de quien la realizó, y nadie puede atribuirse
una acción ajena ni modificar la atribución de un registro.

**Why this priority**: Es lo que convierte la responsabilidad profesional del PoC en algo
verificable, y es el requisito que sostiene el principio rector del brief. Un paciente atendido por
un colega es el caso normal en una clínica, no la excepción.

**Independent Test**: Con dos cuentas provisionadas, hacer que una registre un paciente y la otra lo
atienda, y comprobar que cada registro conserva la identidad de quien lo produjo y que ninguna de
las dos puede alterar la atribución de la otra.

**Acceptance Scenarios**:

1. **Given** dos veterinarios con cuenta en la clínica, **When** el primero registra un paciente,
   **Then** el segundo puede verlo y abrir una consulta sobre él.
2. **Given** una consulta abierta por un veterinario, **When** se consulta el registro, **Then**
   consta la identidad autenticada de quien la abrió.
3. **Given** una epicrisis aprobada, **When** se revisa posteriormente, **Then** consta la identidad
   autenticada de quien la aprobó y esa atribución no puede modificarse.
4. **Given** un veterinario autenticado, **When** intenta registrar una acción clínica a nombre de
   otro profesional, **Then** el sistema lo impide.
5. **Given** un paciente atendido por dos veterinarios en consultas distintas, **When** se revisa el
   historial, **Then** cada consulta conserva la atribución de su propio autor.
6. **Given** un antecedente extraído del audio que un veterinario distinto del que abrió la consulta
   confirma, **When** se revisa la anamnesis, **Then** consta quién lo confirmó y cuándo.
7. **Given** una epicrisis aprobada que otro veterinario corrige después, **When** se revisa el
   historial, **Then** el registro correctivo consta atribuido a quien lo hizo, sin alterar la
   atribución del original.
8. **Given** un tratamiento no farmacológico adoptado durante la consulta, **When** se revisa la
   epicrisis, **Then** consta quién lo adoptó.
9. **Given** una acción clínica registrada por un veterinario, **When** otro profesional consulta
   ese registro, **Then** no puede alterar la identidad a la que está atribuido.

---

### Edge Cases

- **Sesión expirada a mitad de una consulta**: el trabajo en curso no debe perderse ni entrar al
  historial sin una identidad válida que lo respalde.
- **Intento de operar sin sesión**: toda operación clínica debe denegarse, no degradarse a un modo
  anónimo.
- **Credenciales de una cuenta inexistente**: el mensaje de error no debe permitir distinguir una
  cuenta que existe de una que no.

### Trazabilidad de requisitos

Cada requisito funcional se verifica mediante los escenarios de aceptación indicados.

| Requisito | Verificado por |
|---|---|
| FR-059 | US11 / 1 |
| FR-060 | US11 / 2, 3 |
| FR-061 | US11 / 4, 5 |
| FR-062 | US11 / 6, 7 |
| FR-063 | US12 / 2, 3, 5, 6, 7, 8 |
| FR-064 | US12 / 3, 4, 7, 9 |
| FR-066 | US12 / 1 |
| FR-067 | US11 / 8 |

### Key Entities

- **Veterinario**: profesional con cuenta provisionada en la clínica, con identificador y
  credenciales. Es la identidad a la que se atribuyen las acciones clínicas.
- **Sesión de acceso**: periodo de acceso autenticado de un Veterinario, con inicio, término y
  validez. No debe confundirse con la *sesión clínica* de la spec 002 (que es una Consulta) ni con
  la *sesión de escucha* de la spec 004.
- **Atribución**: vínculo inmutable entre un registro clínico y la identidad del Veterinario que lo
  produjo, junto con el momento en que lo hizo.
- **Consulta**, **Epicrisis**, **Diagnóstico**, **Anamnesis**: definidos en la spec 002. Reciben la
  Atribución. Su existencia condiciona la verificación de US12, no la construcción de esta spec.
- **Medicamento**, **Tratamiento**: definidos en la spec 007. Su adopción recibe la Atribución.

## Success Criteria

### Measurable Outcomes

- **SC-039**: El 100% de las operaciones clínicas realizadas sin sesión activa es denegado.
- **SC-040**: El 100% de los registros clínicos creados conserva la identidad autenticada de su
  autor y el momento de creación.
- **SC-041**: El número de registros cuya atribución pudo modificarse después de creados es 0.
- **SC-042**: El número de acciones clínicas registrables a nombre de un profesional distinto del
  autenticado es 0.
- **SC-045**: El número de operaciones protegidas que pueden completarse eludiendo la interfaz de
  usuario sin sesión válida es 0.
- **SC-046**: El 100% de los intentos de acceso fallidos produce una respuesta indistinguible entre
  cuenta existente y cuenta inexistente.
- **SC-047**: Al expirar una sesión por inactividad, el contenido clínico introducido y no guardado
  se conserva en el 100% de los casos.
- **SC-043**: Un veterinario accede al sistema y queda en condiciones de operar en menos de 30
  segundos.
- **SC-044**: Cualquier veterinario de la clínica puede abrir una consulta sobre el 100% de los
  pacientes registrados, con independencia de quién los registró.

## Assumptions

- **Cuentas provisionadas, sin ciclo de vida**: las cuentas se cargan al preparar el entorno. El PoC
  no implementa autoregistro, verificación de correo, recuperación de contraseña, ni desactivación o
  eliminación de cuentas. Toda la gestión de cuentas corresponde a la Fase 2 según el brief; el
  conjunto de cuentas es fijo durante el PoC.
- **Clínica única compartida**: todos los veterinarios pertenecen a la misma clínica y comparten los
  pacientes. El soporte multi-clínica y el multi-tenancy siguen fuera del alcance del PoC, según el
  brief.
- **Sin roles diferenciados**: todos los veterinarios tienen las mismas capacidades. La supervisión
  de casos por especialistas figura entre los usuarios futuros del brief, fuera del PoC.
- **Sin trazabilidad de accesos**: se registra quién creó, aprobó o modificó cada registro clínico,
  pero no quién consultó qué. El registro de lecturas corresponde a fases posteriores, cuando se
  manejen datos reales.
- **Datos sintéticos**: las cuentas del PoC corresponden a profesionales ficticios o del equipo del
  proyecto, no a una nómina real de una clínica.

### Dependencias

**De construcción: ninguna.** La 001 se construye primero y no necesita que exista ninguna otra spec
para hacerlo.

**De verificación: la spec 002.** La historia US11 (acceso autenticado) es verificable por sí sola.
La US12 (atribución) no lo es: se expresa sobre pacientes, consultas y epicrisis que define la spec
002, igual que SC-040, SC-041, SC-042 y SC-044. Esto **no** es una arista de dependencia —invertirla
crearía el ciclo `002 ↔ 001`— sino un punto de verificación conjunta: la 001 se declara terminada
cuando US11 pasa y US12 queda verificada junto con la 002, no antes.

Las specs 002, 003, 004, 005, 006 y 007 dependen de esta para que su atribución de responsabilidad
profesional sea verificable.

## ADDED Requirements

### Requirement: FR-059

El sistema MUST permitir a un veterinario autenticarse con una cuenta previamente
  provisionada, y MUST establecer una sesión que lo identifique durante sus operaciones.

#### Scenario: US11-AC1

- **GIVEN** una cuenta de veterinario provisionada
- **WHEN** el profesional se autentica con sus credenciales
- **THEN** el sistema inicia su sesión y lo identifica en las operaciones que realice.

### Requirement: FR-060

El sistema MUST denegar el acceso ante credenciales inválidas sin revelar si el fallo
  estuvo en el identificador o en la contraseña, y MUST NOT permitir distinguir una cuenta existente
  de una inexistente a partir del mensaje de error.

#### Scenario: US11-AC2

- **GIVEN** una cuenta existente y una contraseña incorrecta
- **WHEN** se intenta acceder
- **THEN** el sistema deniega el acceso sin revelar si el fallo fue en el identificador o en la contraseña.

#### Scenario: US11-AC3

- **GIVEN** un identificador que no corresponde a ninguna cuenta
- **WHEN** se intenta acceder
- **THEN** el sistema deniega el acceso con una respuesta indistinguible de la del escenario anterior.

### Requirement: FR-061

El sistema MUST permitir cerrar la sesión, y MUST expirarla tras un periodo de
  inactividad no superior a 8 horas, exigiendo autenticarse nuevamente. Al expirar, el contenido
  clínico que el veterinario había introducido y no guardado MUST conservarse.

#### Scenario: US11-AC4

- **GIVEN** una sesión activa
- **WHEN** el veterinario la cierra
- **THEN** el sistema deja de permitir operaciones clínicas hasta un nuevo acceso.

#### Scenario: US11-AC5

- **GIVEN** una sesión sin actividad durante más tiempo del permitido
- **WHEN** el veterinario intenta operar
- **THEN** el sistema exige autenticarse nuevamente y conserva el contenido que el veterinario había introducido y no guardado.

### Requirement: FR-062

El sistema MUST denegar toda operación clínica que no provenga de una sesión activa, y
  MUST NOT ofrecer un modo de operación anónimo.

#### Scenario: US11-AC6

- **GIVEN** que no hay sesión activa
- **WHEN** se intenta acceder directamente a una operación clínica
- **THEN** el sistema la deniega.

#### Scenario: US11-AC7

- **GIVEN** la aplicación en cualquier estado
- **WHEN** se busca una forma de registrar información clínica sin autenticarse
- **THEN** no existe ninguna: no hay modo anónimo ni invitado.

### Requirement: FR-063

Toda acción que cree o modifique un registro clínico MUST quedar atribuida a la
  identidad autenticada que la realizó, junto con el momento en que ocurrió. La enumeración es
  taxativa: crear o actualizar una ficha de paciente o tutor; abrir una consulta; registrar o
  corregir un antecedente de anamnesis; confirmar un antecedente extraído del audio; decidir sobre
  una sugerencia de información faltante; aceptar, descartar o agregar una hipótesis; registrar un
  diagnóstico; adoptar un tratamiento farmacológico o no farmacológico; aprobar una epicrisis;
  registrar retroalimentación; y generar cualquier registro correctivo sobre un registro aprobado.

#### Scenario: US12-AC2

- **GIVEN** una consulta abierta por un veterinario
- **WHEN** se consulta el registro
- **THEN** consta la identidad autenticada de quien la abrió.

#### Scenario: US12-AC3

- **GIVEN** una epicrisis aprobada
- **WHEN** se revisa posteriormente
- **THEN** consta la identidad autenticada de quien la aprobó y esa atribución no puede modificarse.

#### Scenario: US12-AC5

- **GIVEN** un paciente atendido por dos veterinarios en consultas distintas
- **WHEN** se revisa el historial
- **THEN** cada consulta conserva la atribución de su propio autor.

#### Scenario: US12-AC6

- **GIVEN** un antecedente extraído del audio que un veterinario distinto del que abrió la consulta confirma
- **WHEN** se revisa la anamnesis
- **THEN** consta quién lo confirmó y cuándo.

#### Scenario: US12-AC7

- **GIVEN** una epicrisis aprobada que otro veterinario corrige después
- **WHEN** se revisa el historial
- **THEN** el registro correctivo consta atribuido a quien lo hizo, sin alterar la atribución del original.

#### Scenario: US12-AC8

- **GIVEN** un tratamiento no farmacológico adoptado durante la consulta
- **WHEN** se revisa la epicrisis
- **THEN** consta quién lo adoptó.

### Requirement: FR-064

El sistema MUST NOT permitir que un profesional registre una acción clínica a nombre
  de otro, ni que se modifique la atribución de un registro ya creado.

#### Scenario: US12-AC3

- **GIVEN** una epicrisis aprobada
- **WHEN** se revisa posteriormente
- **THEN** consta la identidad autenticada de quien la aprobó y esa atribución no puede modificarse.

#### Scenario: US12-AC4

- **GIVEN** un veterinario autenticado
- **WHEN** intenta registrar una acción clínica a nombre de otro profesional
- **THEN** el sistema lo impide.

#### Scenario: US12-AC7

- **GIVEN** una epicrisis aprobada que otro veterinario corrige después
- **WHEN** se revisa el historial
- **THEN** el registro correctivo consta atribuido a quien lo hizo, sin alterar la atribución del original.

#### Scenario: US12-AC9

- **GIVEN** una acción clínica registrada por un veterinario
- **WHEN** otro profesional consulta ese registro
- **THEN** no puede alterar la identidad a la que está atribuido.

### Requirement: FR-066

Todos los veterinarios de la clínica MUST poder ver y atender a todos los pacientes
  registrados; el PoC MUST NOT aislar la información clínica por profesional.

#### Scenario: US12-AC1

- **GIVEN** dos veterinarios con cuenta en la clínica
- **WHEN** el primero registra un paciente
- **THEN** el segundo puede verlo y abrir una consulta sobre él.

### Requirement: FR-067

Toda operación protegida MUST denegarse aunque se invoque eludiendo la interfaz de
  usuario: la comprobación de identidad y permisos MUST realizarse donde el usuario no pueda
  alterarla, y una comprobación que solo exista en el cliente MUST NOT considerarse un control.

#### Scenario: US11-AC8

- **GIVEN** una operación denegada por falta de sesión
- **WHEN** se intenta repetirla eludiendo la interfaz de usuario
- **THEN** el sistema la deniega igualmente.
