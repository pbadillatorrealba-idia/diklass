# Feature Specification: Identidad y acceso

**Feature Branch**: `docs/project-constitution` (rama activa; directorio: `specs/007-identidad-y-acceso`)

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: capa de identidad del PoC de CDSS de etología veterinaria canina —
cuentas de veterinario provisionadas, acceso autenticado, y atribución verificable de toda acción
clínica a la persona que la realizó, dentro de una clínica compartida donde los profesionales ven
los mismos pacientes.

**Contexto de producto**: [Brief del PoC](../../docs/brief-poc-cdss.md)

**Nota sobre identificadores**: los `FR-NNN` y `SC-NNN` son únicos a nivel de familia de specs. Un
requisito transversal aparece íntegro en cada spec donde aplica, designando siempre el mismo
requisito.

**Nota de orden**: pese a llevar el número 007, esta funcionalidad se construye **primero**. Los
números identifican specs, no ordenan su construcción; el orden lo fija la lista de aristas del
brief.

## User Scenarios & Testing *(mandatory)*

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
2. **Given** credenciales incorrectas, **When** se intenta acceder, **Then** el sistema deniega el
   acceso sin revelar si el fallo fue en el identificador o en la contraseña.
3. **Given** una sesión activa, **When** el veterinario la cierra, **Then** el sistema deja de
   permitir operaciones clínicas hasta un nuevo acceso.
4. **Given** una sesión que superó su tiempo de validez, **When** el veterinario intenta operar,
   **Then** el sistema exige autenticarse nuevamente y no pierde el trabajo no guardado.
5. **Given** que no hay sesión activa, **When** se intenta acceder directamente a una operación
   clínica, **Then** el sistema la deniega.

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
6. **Given** una acción clínica registrada, **When** se elimina o desactiva la cuenta que la
   realizó, **Then** la atribución del registro sigue siendo identificable.

---

### Edge Cases

- **Sesión expirada a mitad de una consulta**: el trabajo en curso no debe perderse ni entrar al
  historial sin una identidad válida que lo respalde.
- **Dos sesiones simultáneas de la misma cuenta**: las acciones deben atribuirse igualmente a esa
  identidad, sin ambigüedad sobre cuál sesión las produjo.
- **Cuenta desactivada con trabajo en curso**: las sesiones activas de esa cuenta deben dejar de
  permitir operaciones clínicas.
- **Intento de operar sin sesión**: toda operación clínica debe denegarse, no degradarse a un modo
  anónimo.
- **Credenciales de una cuenta inexistente**: el mensaje de error no debe permitir distinguir una
  cuenta que existe de una que no.
- **Registro clínico cuya cuenta autora fue eliminada**: la atribución histórica debe sobrevivir a
  la eliminación de la cuenta.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-059**: El sistema MUST permitir a un veterinario autenticarse con una cuenta previamente
  provisionada, y MUST establecer una sesión que lo identifique durante sus operaciones.
- **FR-060**: El sistema MUST denegar el acceso ante credenciales inválidas sin revelar si el fallo
  estuvo en el identificador o en la contraseña, y MUST NOT permitir distinguir una cuenta existente
  de una inexistente a partir del mensaje de error.
- **FR-061**: El sistema MUST permitir cerrar la sesión, y MUST expirarla tras un periodo de
  inactividad, exigiendo autenticarse nuevamente sin descartar el trabajo no guardado.
- **FR-062**: El sistema MUST denegar toda operación clínica que no provenga de una sesión activa, y
  MUST NOT ofrecer un modo de operación anónimo.
- **FR-063**: Toda acción clínica —crear o actualizar una ficha, abrir una consulta, registrar un
  diagnóstico, aprobar una epicrisis, aprobar un fármaco, registrar retroalimentación— MUST quedar
  atribuida a la identidad autenticada que la realizó.
- **FR-064**: El sistema MUST NOT permitir que un profesional registre una acción clínica a nombre
  de otro, ni que se modifique la atribución de un registro ya creado.
- **FR-065**: La atribución de un registro clínico MUST seguir siendo identificable aunque la cuenta
  que lo produjo sea posteriormente desactivada o eliminada.
- **FR-066**: Todos los veterinarios de la clínica MUST poder ver y atender a todos los pacientes
  registrados; el PoC MUST NOT aislar la información clínica por profesional.
- **FR-067**: La autenticación y la autorización MUST aplicarse del lado del servidor en cada
  operación protegida; las verificaciones en el cliente MUST NOT considerarse un control.

### Trazabilidad de requisitos

Cada requisito funcional se verifica mediante los escenarios de aceptación indicados.

| Requisito | Verificado por |
|---|---|
| FR-059 | US11 / 1 |
| FR-060 | US11 / 2 |
| FR-061 | US11 / 3, 4 |
| FR-062 | US11 / 5 |
| FR-063 | US12 / 2, 3, 5 |
| FR-064 | US12 / 3, 4 |
| FR-065 | US12 / 6 |
| FR-066 | US12 / 1 |
| FR-067 | US11 / 5 |

### Key Entities *(include if feature involves data)*

- **Veterinario**: profesional con cuenta en la clínica, con identificador, credenciales y estado
  (activa, desactivada). Es la identidad a la que se atribuyen las acciones clínicas.
- **Sesión**: periodo de acceso autenticado de un Veterinario, con inicio, término y validez.
- **Atribución**: vínculo inmutable entre un registro clínico y la identidad del Veterinario que lo
  produjo, junto con el momento en que lo hizo.
- **Consulta**, **Epicrisis**, **Diagnóstico**: definidos en la spec 001. Reciben la Atribución.
- **Medicamento**: definido en la spec 005. Su aprobación recibe la Atribución.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-039**: El 100% de las operaciones clínicas realizadas sin sesión activa es denegado.
- **SC-040**: El 100% de los registros clínicos creados conserva la identidad autenticada de su
  autor y el momento de creación.
- **SC-041**: El número de registros cuya atribución pudo modificarse después de creados es 0.
- **SC-042**: El número de acciones clínicas registrables a nombre de un profesional distinto del
  autenticado es 0.
- **SC-043**: Un veterinario accede al sistema y queda en condiciones de operar en menos de 30
  segundos.
- **SC-044**: Cualquier veterinario de la clínica puede abrir una consulta sobre el 100% de los
  pacientes registrados, con independencia de quién los registró.
- **SC-045**: La atribución de los registros clínicos sobrevive a la desactivación de la cuenta
  autora en el 100% de los casos.

## Assumptions

- **Cuentas provisionadas**: las cuentas de veterinario se cargan al preparar el entorno. El PoC no
  implementa autoregistro, verificación de correo ni recuperación de contraseña; ninguno de esos
  flujos valida la hipótesis del producto.
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

Ninguna. Esta funcionalidad es construible y verificable por sí sola, y es la primera del orden de
construcción: las specs 001 a 006 dependen de ella para que su atribución de responsabilidad
profesional sea verificable.
