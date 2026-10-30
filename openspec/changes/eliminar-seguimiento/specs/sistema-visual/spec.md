# Spec Delta

## REMOVED Requirements

### Requirement: FR-077
**Reason**: su único consumidor eran los eventos adversos de la retroalimentación clínica, que se eliminan; la escala de severidad no tiene otro uso en la interfaz.
**Migration**: ninguna. El ID FR-077 queda retirado y no se reutiliza; si una funcionalidad futura vuelve a necesitar severidad visual, la especifica con un ID nuevo.

## MODIFIED Requirements

### Requirement: FR-082

Toda pantalla protegida MUST ofrecer navegación global según la plataforma:

- En web, desde 1024 px CSS, MUST ser una barra lateral fija que incluya la cuenta y el cierre de
  sesión y los accesos a Inicio, Pacientes y Conocimiento.
- En web bajo 1024 px, MUST mostrar una barra inferior con Inicio, Pacientes, Conocimiento y
  Configuración.
- En iOS/Android, MUST conservar sus secciones y ser una barra de pestañas inferior con la
  convención de la plataforma: la barra de pestañas en iOS y la barra de navegación de Material 3
  en Android.

La sección actual MUST indicarse con algo más que el color (peso, indicador y `aria-current`/estado
seleccionado). Cada entrada MUST tener icono y nombre visible, incluida Configuración en web compacta. La navegación MUST NOT ser operable
mientras el diálogo de sesión expirada está abierto.

#### Scenario: US14-AC1

- **GIVEN** una ventana de 1280 px con la sesión iniciada
- **WHEN** se abre `/patients`
- **THEN** la barra lateral muestra Inicio, Pacientes y Conocimiento, no muestra Seguimiento, tiene
  Pacientes marcada como actual y el cierre de sesión al pie

#### Scenario: US14-AC2

- **GIVEN** una ventana de 375 px con la sesión iniciada
- **WHEN** se abre `/knowledge`
- **THEN** la barra de pestañas inferior muestra Inicio, Pacientes y Conocimiento con icono y nombre,
  Configuración con icono y nombre visible, y Conocimiento está seleccionada

### Requirement: FR-083

Toda pantalla que no sea la raíz de su sección MUST ofrecer una acción de retroceso en la propia
interfaz: en iOS/Android, la cabecera nativa del `Stack` con el título de la pantalla; en web, un
enlace «Volver a <sección o pantalla anterior>» antes del título; desde 1024 px, un breadcrumb
con los ancestros enlazados (revisado por `rediseno-pacientes`, FR-083, que también fija dónde va la acción principal). Al abrir una pantalla por URL
directa, el retroceso MUST llevar a la raíz de su sección. El título de la pantalla MUST coincidir
con el título del documento en web.

#### Scenario: US14-AC3

- **GIVEN** la consulta abierta desde la ficha de un paciente
- **WHEN** el usuario activa el retroceso de la interfaz
- **THEN** vuelve a la ficha del paciente

#### Scenario: Entrada por URL directa

- **GIVEN** `/patients/<id>` abierto directamente en una pestaña nueva
- **WHEN** el usuario activa «Volver»
- **THEN** llega a `/patients`

### Requirement: FR-085

Toda pantalla que carga datos MUST distinguir cuatro estados:

- **Cargando.**
- **Error:** con un mensaje y una acción de reintento.
- **Vacío:** con un texto que explica qué falta y, si existe, la acción para crearlo.
- **Contenido.**

El estado vacío MUST NOT mostrarse mientras la primera carga no ha terminado.

#### Scenario: US14-AC5

- **GIVEN** una clínica sin fuentes incorporadas
- **WHEN** se abre `/knowledge/sources`
- **THEN** se muestra «Cargando…» y después un estado vacío que ofrece «Incorporar fuente
  clínica», nunca el vacío durante la carga

#### Scenario: Error con reintento

- **GIVEN** la lectura de pacientes falla
- **WHEN** se abre `/patients`
- **THEN** se muestra un error con «Reintentar», y al reintentar con éxito aparece la lista

### Requirement: FR-086

Las listas de longitud no acotada (pacientes y fuentes) MUST renderizarse
virtualizadas (`FlatList`) y MUST NOT anidarse dentro de otro contenedor de desplazamiento
vertical.

#### Scenario: Lista larga de pacientes

- **GIVEN** 200 pacientes en la clínica
- **WHEN** se abre `/patients`
- **THEN** la lista se desplaza sin cargar todas las filas a la vez y sin doble barra de
  desplazamiento
