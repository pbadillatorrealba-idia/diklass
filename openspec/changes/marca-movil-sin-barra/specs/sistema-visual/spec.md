## ADDED Requirements

### Requirement: Marca en el contenido web compacto (FR-079 · FR-082)

En web bajo 1024 px, toda pantalla protegida MUST mostrar el logo pequeño y centrado, con 8 px adicionales de espacio superior, al inicio del contenido desplazable, antes del título y del retroceso. El shell MUST NOT mostrar una barra superior de marca. En escritorio el logo MUST verse solo en la barra lateral. El login MUST conservar su marca existente. El dock, los títulos y el retroceso MUST conservar su funcionamiento.

#### Scenario: Marca en pantalla y lista compactas

- **GIVEN** una sesión iniciada y una ventana web de 375 px
- **WHEN** se abre cualquier pantalla protegida, incluida una lista o un detalle
- **THEN** hay un solo logo visible, centrado sobre el contenido y dentro de su desplazamiento
- **AND** no existe una barra superior independiente
- **AND** al desplazar el contenido la marca se desplaza con él

#### Scenario: Escritorio sin duplicación

- **GIVEN** una ventana web de 1280 px
- **WHEN** se abre una pantalla protegida
- **THEN** la marca de la barra lateral está visible y la marca del contenido está oculta

#### Scenario: Acceso sin duplicación

- **GIVEN** la pantalla de inicio de sesión
- **WHEN** se abre en móvil o escritorio
- **THEN** conserva su único logo existente

## MODIFIED Requirements

### Requirement: FR-082

Toda pantalla protegida MUST ofrecer navegación global según la plataforma:

- En web, desde 1024 px CSS, MUST ser una barra lateral fija que incluya la cuenta y el cierre de
  sesión y los accesos a Inicio, Pacientes, Seguimiento y Conocimiento.
- En web bajo 1024 px, MUST mostrar una barra inferior con Inicio, Pacientes, Conocimiento y
  Configuración. Seguimiento MUST NOT aparecer en esa barra; su ruta y su acceso de escritorio
  MUST conservarse.
- En iOS/Android, MUST conservar sus secciones y ser una barra de pestañas inferior con la
  convención de la plataforma: la barra de pestañas en iOS y la barra de navegación de Material 3
  en Android.

La sección actual MUST indicarse con algo más que el color (peso, indicador y `aria-current`/estado
seleccionado). Cada entrada MUST tener icono y nombre visible, incluida Configuración en web compacta. La navegación MUST NOT ser operable
mientras el diálogo de sesión expirada está abierto.

#### Scenario: US14-AC1

- **GIVEN** una ventana de 1280 px con la sesión iniciada
- **WHEN** se abre `/patients`
- **THEN** la barra lateral muestra las cuatro secciones con Pacientes marcada como actual y el
  cierre de sesión al pie

#### Scenario: US14-AC2

- **GIVEN** una ventana de 375 px con la sesión iniciada
- **WHEN** se abre `/knowledge`
- **THEN** la barra de pestañas inferior muestra Inicio, Pacientes y Conocimiento con icono y nombre,
  Configuración con icono y nombre visible, y Conocimiento está seleccionada
- **AND** Seguimiento no aparece en la barra inferior
