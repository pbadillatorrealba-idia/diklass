#  Sistema visual

## Purpose

Da a toda la interfaz del PoC una sola fuente visual (color, tipografía, dimensiones, iconografía y
primitivas) para que el veterinario lea la información clínica de forma legible y consistente en
escritorio, tablet y móvil, en modo claro y oscuro, distinga lo sugerido por el sistema de lo
validado por un profesional y reconozca la severidad clínica sin depender solo del color.

**Created**: 2026-09-25

**Status**: Draft — pendiente de aceptación. Parte de los requisitos ya están implementados en
`feat/tema-visual` (se indica en cada uno); implementado no equivale a aceptado.

**Contexto de producto**: [Brief del PoC](../../../../../docs/brief-poc-cdss.md) — "aplicación
accesible desde computador y, de ser viable, móvil".

**Nota sobre identificadores**: FR/SC/US continúan la numeración global (último FR-070, SC-049,
US12).

## User Scenarios & Testing

### User Story 13 - Interfaz clínica legible y consistente (Priority: P2)

El veterinario usa la app en el computador de la clínica y a veces en una tablet o un teléfono
durante la consulta. En cualquier pantalla lee el mismo tipo de información con el mismo aspecto,
distingue enseguida lo que propone el sistema de lo que ya validó un profesional, reconoce la
severidad de un evento y puede trabajar con modo oscuro, con teclado o con texto ampliado.

**Why this priority**: no añade funcionalidad clínica, pero condiciona la seguridad de uso de todas
las demás (confundir una sugerencia con un dato validado o pasar por alto un evento grave) y la
conformidad WCAG 2.2 AA que la constitución exige como compuerta.

**Independent Test**: recorrer las pantallas protegidas en claro y oscuro, a 320 px y a 1280 px,
con la compuerta axe y una revisión en escala de grises.

**Acceptance Scenarios**:

1. **Given** el sistema operativo en modo oscuro, **When** se abre cualquier pantalla, **Then**
   toda la interfaz usa la paleta oscura y cumple contraste AA.
2. **Given** un bloque generado por el sistema junto a uno validado, **When** se ven en escala de
   grises, **Then** siguen siendo distinguibles por su etiqueta y su borde.
3. **Given** eventos adversos de distinta severidad, **When** se presentan, **Then** cada uno
   muestra el nombre del nivel y un icono además del color, y `grave`/`critico` destacan sobre
   `leve`.
4. **Given** una ventana de 320 px de ancho, **When** se abre cualquier pantalla, **Then** no hay
   desplazamiento horizontal ni contenido recortado.
5. **Given** una ventana ancha de escritorio, **When** se abre la consulta, **Then** el registro y
   el apoyo del sistema se muestran lado a lado.
6. **Given** la primera carga de la app web, **When** se pinta la pantalla, **Then** el texto usa
   la fuente del tema sin un salto de maquetación visible al terminar de cargarla.

### User Story 14 - Moverse por la app sin perderse (Priority: P2)

Durante la jornada, el veterinario salta entre la ficha de un paciente, la consulta en curso, el
seguimiento de otro paciente y la base de conocimiento. Desde cualquier pantalla ve en qué sección
está, llega a cualquier otra con una sola acción y vuelve a la pantalla anterior sin depender del
botón del navegador. Esto vale en el computador, en la tablet y en el teléfono, siguiendo las
convenciones de cada plataforma.

**Why this priority**: hoy no hay navegación global. `/follow-up` solo se alcanza por URL y, en
iOS, una pantalla de detalle no tiene forma de volver atrás. Es una barrera de uso que afecta a
todas las features.

**Independent Test**: desde una consulta abierta, llegar al seguimiento de otro paciente y volver,
con ratón, con teclado y con lector de pantalla, a 1280 px y a 375 px.

**Acceptance Scenarios**:

1. **Given** una ventana de 1280 px, **When** se abre cualquier pantalla protegida, **Then** una
   barra lateral fija muestra las secciones Inicio, Pacientes, Seguimiento y Conocimiento, marca la
   sección actual con algo más que el color y ofrece la cuenta y el cierre de sesión.
2. **Given** una ventana de 375 px o un dispositivo iOS/Android, **When** se abre cualquier
   pantalla protegida, **Then** una barra de pestañas inferior da acceso a las cuatro secciones con
   icono y nombre.
3. **Given** una pantalla de detalle (ficha, consulta, fuente, seguimiento de un paciente),
   **When** el usuario quiere volver, **Then** dispone de una acción de retroceso en la propia
   interfaz: la cabecera nativa en iOS/Android o el enlace «Volver» en web.
4. **Given** un elemento que lleva a otra pantalla, **When** lo anuncia un lector de pantalla,
   **Then** se anuncia como enlace; en web se puede abrir en una pestaña nueva.
5. **Given** una pantalla que carga datos, **When** la carga está en curso, falla o no devuelve
   nada, **Then** muestra respectivamente un estado de carga, un error con reintento o un estado
   vacío explicativo, nunca el vacío antes de que termine la primera carga.

### User Story 15 - Entrar sin fricción y con el gestor de contraseñas (Priority: P2)

Como veterinario que entra varias veces al día desde el navegador de la clínica o desde el
teléfono, quiero que el navegador o el sistema me ofrezca guardar y rellenar mis credenciales, y
que el acceso se vea como un formulario claramente delimitado, para entrar rápido y sin errores de
tecleo.

**Why this priority**: el login es la puerta de todas las features. Hoy ningún gestor de
contraseñas ofrece guardar las credenciales ni rellenarlas: en web no hay un `<form>` real, los
campos no tienen `name`, el envío va por `onPress` y no dispara un envío de formulario, y los
campos se renderizan `readOnly` hasta la hidratación, así que los gestores los descartan. Además, el
formulario flota sobre el fondo sin ninguna superficie que lo separe del resto de la pantalla.

**Independent Test**: en Chromium, iniciar sesión con credenciales válidas y comprobar que el
navegador ofrece guardarlas. Al volver a `/login`, el gestor rellena ambos campos. En iOS/Android
el teclado ofrece las credenciales guardadas.

**Acceptance Scenarios**:

1. **Given** `/login` en web, **When** el usuario escribe credenciales válidas y pulsa Intro o
   «Iniciar sesión», **Then** el envío se hace como envío de formulario y el navegador ofrece
   guardar la contraseña.
2. **Given** credenciales guardadas en el navegador o en el llavero del sistema, **When** se abre
   `/login`, **Then** el gestor puede rellenar el correo y la contraseña, y lo rellenado se
   conserva tras la hidratación.
3. **Given** `/login` en cualquier ancho, **When** se muestra, **Then** el formulario vive en una
   tarjeta (`Card`) con título, descripción y acción principal, claramente separada del fondo en
   claro y en oscuro.
4. **Given** el campo de contraseña, **When** el usuario activa «Mostrar contraseña», **Then** el
   texto se hace visible, el control anuncia su estado y el nombre accesible del campo no cambia.
5. **Given** un error de acceso, **When** se muestra, **Then** aparece como `Callout tone="error"`
   anunciado a lectores de pantalla, y el foco o la lectura llega a él sin perder lo escrito en el
   correo.

### User Story 16 - Mi espacio: apariencia, cuenta y agenda (Priority: P3)

Como veterinario, quiero elegir modo claro u oscuro sin depender del sistema operativo, reconocer
mi sesión por mi foto o iniciales, tener una sección de Configuración donde gestionar mis datos, y
ver en Inicio un calendario que más adelante mostrará mis citas y controles, para trabajar
cómodo en turnos largos y con luz variable.

**Why this priority**: hoy el modo sigue siempre al sistema operativo, la sesión solo se identifica
por un texto y no existe ningún lugar para los ajustes personales. El calendario prepara la agenda
clínica futura sin comprometer todavía un modelo de citas.

**Independent Test**:

- Cambiar a oscuro desde el botón rápido y recargar: la app sigue en oscuro. Volver a «Usar el
  del sistema» en Configuración.
- Abrir Configuración desde la navegación a 1280 px y a 375 px.
- Ver en Inicio el calendario del mes actual, vacío, navegable por teclado.

**Acceptance Scenarios**:

1. **Given** cualquier pantalla protegida, **When** el usuario activa el botón de tema, **Then** la
   app pasa de claro a oscuro (o al revés) sin recargar, el botón anuncia el modo resultante, y la
   elección persiste en ese dispositivo tras recargar o reabrir.
2. **Given** Configuración › Apariencia, **When** el usuario elige «Sistema», «Claro» u «Oscuro»,
   **Then** la app aplica esa preferencia; con «Sistema», sigue los cambios del sistema operativo.
3. **Given** un profesional sin foto, **When** se muestra su identidad (barra lateral,
   Configuración), **Then** aparece un avatar con sus iniciales sobre un fondo del tema, con su
   nombre como texto (el avatar es decorativo).
4. **Given** la navegación global, **When** el usuario busca sus ajustes, **Then** la sección
   Configuración está a 1 activación, con su perfil, la apariencia y el cierre de sesión.
5. **Given** Inicio, **When** se abre, **Then** muestra el calendario del mes actual en español
   (semana desde el lunes, hoy destacado con algo más que el color), navegable entre meses, y un
   estado vacío «Sin eventos agendados» sin inventar datos.

### Edge Cases

- Texto ampliado por el sistema (Dynamic Type / zoom del navegador al 200 %): las filas crecen y el
  texto se ajusta de línea; nunca se desactiva el escalado.
- Un icono que no carga no puede dejar un control sin nombre: el texto o la etiqueta accesible
  sigue presente.
- Contenido sugerido que el profesional aprueba: pasa a mostrarse como validado, con su
  atribución, sin el tratamiento de sugerido.
- La severidad `critico` no existe hoy en ningún vocabulario de datos; se muestra solo cuando una
  feature la emita (006/007).
- Abrir por URL directa una pantalla de detalle (sin historial previo): el retroceso de la
  interfaz lleva a la raíz de su sección, no fuera de la app.
- Sesión expirada con la navegación visible: el diálogo de sesión queda por encima de la barra
  lateral y de las pestañas, y estas no son operables mientras está abierto.
- Nombres largos (paciente, fuente) en el título de la cabecera: se truncan en la cabecera con el
  nombre completo disponible en el contenido y en la etiqueta accesible.
- Texto ampliado con la barra de pestañas: las etiquetas pueden ajustarse o reducirse según la
  plataforma, pero cada pestaña conserva su nombre accesible.
- El gestor de contraseñas rellena los campos antes de que React hidrate: el valor rellenado se
  adopta como valor del formulario, no se borra.
- Credenciales incorrectas guardadas: el error se muestra igual que con credenciales tecleadas, y
  la contraseña se limpia sin borrar el correo.
- Web a 320 px con la sección Configuración: la barra inferior mantiene las 4 secciones con nombre
  visible, y Configuración se alcanza con el avatar de la barra superior compacta. Ninguna etiqueta
  se recorta.
- Preferencia de tema guardada que el almacenamiento no puede leer (modo privado, almacenamiento
  bloqueado): la app usa «Sistema» sin error visible.
- Primer pintado en web con preferencia «Oscuro»: no hay destello del tema claro antes de hidratar.
- Nombre de una sola palabra o con caracteres acentuados: las iniciales usan las dos primeras letras
  o la inicial disponible, normalizadas en mayúscula.
- En iOS, ofrecer *guardar* en el llavero requiere Associated Domains (`webcredentials:`) con un
  dominio publicado. Sin despliegue, en nativo se cubre el relleno, y el guardado queda como
  pendiente de despliegue.

### Trazabilidad de requisitos

| Requisito | Escenarios | Estado |
|---|---|---|
| FR-071 Tokens únicos claro/oscuro | US13-AC1 | Implementado (sin aceptar) |
| FR-072 Contraste AA de pares | US13-AC1 | Implementado para la paleta base; pendiente para tokens nuevos |
| FR-073 Tipografía legible sin salto | US13-AC6 | Implementado (sin aceptar) |
| FR-074 Rampa tipográfica con nombre | US13-AC1 | Pendiente |
| FR-075 Estados semánticos | US13-AC2/AC3 | Pendiente |
| FR-076 Sugerido vs validado | US13-AC2 | Pendiente |
| FR-077 Severidad clínica de 4 niveles | US13-AC3 | Pendiente |
| FR-078 Iconografía accesible | US13-AC3 | Pendiente |
| FR-079 Layout adaptable | US13-AC4/AC5 | Pendiente |
| FR-080 Foco visible | — | Implementado (sin aceptar) |
| FR-081 Fuente única de valores visuales | — | Parcial |
| FR-082 Navegación global adaptable | US14-AC1/AC2 | Pendiente |
| FR-083 Cabecera y retroceso | US14-AC3 | Pendiente |
| FR-084 Navegar es un enlace | US14-AC4 | Pendiente |
| FR-085 Cuatro estados de datos | US14-AC5 | Pendiente |
| FR-086 Listas virtualizadas | — | Pendiente |
| FR-087 Datos clínicos copiables | — | Pendiente |
| FR-088 Formularios con teclado | — | Pendiente (verificación nativa sujeta a dispositivo) |
| FR-089 Login compatible con gestores de contraseñas | US15-AC1/AC2 | Pendiente (guardado en iOS sujeto a dominio desplegado) |
| FR-090 Login en tarjeta con controles completos | US15-AC3/AC4/AC5 | Pendiente |
| FR-091 Selector de tema persistente | US16-AC1/AC2 | Pendiente |
| FR-092 Avatar del profesional | US16-AC3 | Pendiente (foto real: fuera de alcance) |
| FR-093 Sección Configuración | US16-AC4 | Pendiente (edición de perfil en `perfil-profesional`) |
| FR-094 Calendario en Inicio | US16-AC5 | Pendiente (eventos: fuera de alcance) |

## Success Criteria

### Measurable Outcomes

- **SC-050**: la compuerta axe WCAG 2.2 AA reporta 0 violaciones en las pantallas cubiertas, en
  esquema claro y oscuro.
- **SC-051**: 0 literales de color (hex, `rgb()`, `rgba()`) y 0 colores de paleta fija de Tailwind
  en `src/` fuera de los archivos del tema.
- **SC-052**: 0 pantallas con desplazamiento horizontal a 320 px CSS.
- **SC-053**: todos los pares texto/superficie del tema, incluidos los de estado, sugerido y
  severidad, cumplen ≥ 4.5:1; los bordes de control y el indicador de foco, ≥ 3:1. Esto incluye
  el texto atenuado sobre cada superficie tintada, y ningún texto se apoya en un tinte
  translúcido que el test no mida.
- **SC-054**: desde cualquier pantalla protegida, cada sección principal queda a 1 activación y la
  pantalla anterior a 1 activación, a 1280 px y a 375 px.
- **SC-055**: 0 elementos que cambian de ruta expuestos con rol de botón en las pantallas cubiertas
  por la compuerta.
- **SC-056**: 0 pantallas que cargan datos sin sus estados de carga, error y vacío.
- **SC-057**: en web, un inicio de sesión válido produce 1 envío de formulario con los campos
  `username`/`current-password` identificables por el gestor, y 0 campos de acceso con `readOnly`
  cuando el gestor intenta rellenarlos.
- **SC-058**: el cambio de tema se aplica en 1 activación, en ≤ 100 ms sin recarga, y persiste
  tras 1 recarga; 0 violaciones axe en claro y oscuro forzados.
- **SC-059**: 0 etiquetas de navegación recortadas y 0 desbordamientos horizontales a 320 px con
  las 5 secciones.

## Assumptions

- La paleta de marca vigente (verde azulado primario, azul secundario, ámbar de acento) se
  mantiene. El modo sigue al sistema operativo por defecto; desde US16 el profesional puede fijar
  claro u oscuro por dispositivo (la preferencia no viaja con la cuenta).
- La severidad visual `critico` se define ahora por decisión de producto para 006/007; el
  vocabulario de eventos adversos de 005 sigue siendo `leve`/`moderado`/`grave`.

## ADDED Requirements

### Requirement: FR-071

Todo color de la interfaz MUST salir de un conjunto único de tokens semánticos con valor definido
para el esquema claro y para el oscuro. La interfaz MUST seguir el esquema del sistema operativo en
iOS, Android y web.

#### Scenario: US13-AC1

- **GIVEN** el sistema operativo en modo oscuro
- **WHEN** se abre cualquier pantalla
- **THEN** fondo, texto, superficies, controles y navegación usan los valores oscuros de los
  tokens

#### Scenario: Espejo desalineado

- **GIVEN** un token cuyo valor en la hoja de estilos difiere de su copia para estilos por prop
- **WHEN** se ejecuta la suite de pruebas
- **THEN** la suite falla nombrando el token y el esquema

### Requirement: FR-072

Cada par de token texto/superficie MUST alcanzar un contraste ≥ 4.5:1, y los bordes de control y el
indicador de foco ≥ 3:1 contra su fondo, en ambos esquemas. Un token nuevo MUST NOT integrarse sin
esa verificación.

#### Scenario: Token nuevo sin contraste suficiente

- **GIVEN** un token de estado cuyo texto sobre su superficie da menos de 4.5:1 en modo oscuro
- **WHEN** se ejecuta la suite de pruebas
- **THEN** la suite falla indicando el par y la razón obtenida

### Requirement: FR-073

La interfaz MUST usar una familia tipográfica de alta legibilidad que distinga caracteres
confundibles (1/l/I, 0/O) en dosis e identificadores, disponible sin conexión en iOS y Android. En
web MUST NOT producir un salto de maquetación visible al cargar la fuente.

#### Scenario: US13-AC6

- **GIVEN** la primera carga de la app web
- **WHEN** se pinta la pantalla de inicio de sesión
- **THEN** las fuentes de los pesos del primer pintado se solicitan antes del render y el texto no
  cambia de métrica de forma visible

### Requirement: FR-074

El texto MUST expresarse con una rampa con nombre (título de pantalla, sección, subsección, cuerpo
y texto secundario) y un tono secundario que cumpla FR-072. Los tamaños MUST respetar el escalado
de texto del sistema.

#### Scenario: Texto secundario

- **GIVEN** un metadato (fecha, especie, referencia bibliográfica)
- **WHEN** se muestra
- **THEN** usa el tono secundario del tema, con contraste ≥ 4.5:1 en ambos esquemas

#### Scenario: Texto ampliado

- **GIVEN** el tamaño de texto del sistema al máximo de accesibilidad
- **WHEN** se abre una tarjeta de paciente
- **THEN** el texto se ajusta de línea y la tarjeta crece sin recortar contenido

### Requirement: FR-075

La interfaz MUST disponer de estados semánticos `error`, `warning`, `success` e `info`, cada uno
con superficie, borde y texto propios, y MUST acompañar cada estado de texto o icono con nombre
accesible (el color MUST NOT ser la única señal).

#### Scenario: Aviso de cobertura parcial

- **GIVEN** una respuesta de conocimiento con cobertura parcial
- **WHEN** se muestra el aviso
- **THEN** se presenta con el estado `warning`, un icono y un texto que describe el aviso

### Requirement: FR-076

Todo contenido generado por el sistema y aún no validado por un profesional MUST mostrarse con un
tratamiento "sugerido": borde lateral del token `suggested` y la etiqueta visible "Sugerencia del
sistema". El contenido validado o registrado por un profesional MUST NOT llevar ese tratamiento y
MUST mostrar su atribución.

#### Scenario: US13-AC2

- **GIVEN** un hecho extraído por voz pendiente de revisión y un antecedente registrado por un
  profesional en la misma pantalla
- **WHEN** se ven en escala de grises
- **THEN** el primero conserva la etiqueta "Sugerencia del sistema" y el borde lateral, y el
  segundo muestra la insignia de atribución

#### Scenario: Sugerencia aprobada

- **GIVEN** un contenido sugerido
- **WHEN** el profesional lo aprueba
- **THEN** deja de mostrarse como sugerido y pasa a mostrar su atribución

### Requirement: FR-077

La severidad clínica MUST presentarse en una escala visual única de cuatro niveles en orden
creciente (`leve`, `moderado`, `grave`, `critico`), cada uno con su nombre visible, un icono y un
color. `grave` y `critico` MUST destacar visualmente sobre `leve` y `moderado`. Esta escala MUST NOT
modificar ningún vocabulario de datos existente.

#### Scenario: US13-AC3

- **GIVEN** un reporte con eventos adversos `leve` y `grave`
- **WHEN** se presenta
- **THEN** cada evento muestra el nombre de su nivel y su icono, y el `grave` destaca sobre el
  `leve` también en escala de grises

### Requirement: FR-078

Los iconos MUST provenir de un solo conjunto. Un icono que transmite información MUST tener nombre
accesible o acompañar a un texto equivalente; uno decorativo MUST quedar oculto a los lectores de
pantalla. Un control solo con icono MUST tener etiqueta accesible y un área táctil ≥ 44×44 px.

#### Scenario: Botón solo con icono

- **GIVEN** un control que muestra solo un icono
- **WHEN** lo enfoca un lector de pantalla
- **THEN** anuncia su acción, y su área táctil mide al menos 44×44 px

### Requirement: FR-079

Las pantallas MUST adaptarse al ancho de la ventana sin desplazamiento horizontal desde 320 px CSS
(WCAG 1.4.10). En ancho compacto MUST mostrarse una columna; en pantallas anchas el contenido de
lectura MUST limitarse a un ancho legible, y la consulta MUST mostrar el registro y el apoyo del
sistema en dos columnas.

#### Scenario: US13-AC4

- **GIVEN** una ventana de 320 px de ancho
- **WHEN** se abre cualquier pantalla protegida
- **THEN** no hay desplazamiento horizontal ni contenido recortado

#### Scenario: US13-AC5

- **GIVEN** una ventana de 1280 px de ancho
- **WHEN** se abre una consulta
- **THEN** el registro clínico y el apoyo del sistema se muestran lado a lado

### Requirement: FR-080

Todo control interactivo MUST mostrar un indicador de foco visible al navegar con teclado, con el
token de foco del tema y un contraste ≥ 3:1, en ambos esquemas.

#### Scenario: Foco por teclado

- **GIVEN** la pantalla de pacientes
- **WHEN** el usuario recorre los controles con Tab
- **THEN** cada control enfocado muestra el indicador de foco

### Requirement: FR-081

Los valores visuales repetidos (color, tamaño de texto, espaciado, radio, dimensiones de contenido
y capas modales) MUST salir del tema. El código de pantallas y componentes MUST NOT contener
literales de color.

#### Scenario: Literal de color reintroducido

- **GIVEN** un componente con un color hex escrito a mano
- **WHEN** se ejecuta la suite de pruebas
- **THEN** la suite falla indicando el archivo y la línea

### Requirement: FR-082

Toda pantalla protegida MUST ofrecer navegación global a las secciones Inicio, Pacientes,
Seguimiento y Conocimiento:

- En web, desde 1024 px CSS, MUST ser una barra lateral fija que incluya la cuenta y el cierre de
  sesión.
- Por debajo de ese ancho, y en iOS/Android, MUST ser una barra de pestañas inferior con la
  convención de la plataforma: la barra de pestañas en iOS y la barra de navegación de Material 3
  en Android.

La sección actual MUST indicarse con algo más que el color (peso, indicador y `aria-current`/estado
seleccionado). Cada entrada MUST tener icono y nombre visible. La navegación MUST NOT ser operable
mientras el diálogo de sesión expirada está abierto.

#### Scenario: US14-AC1

- **GIVEN** una ventana de 1280 px con la sesión iniciada
- **WHEN** se abre `/patients`
- **THEN** la barra lateral muestra las cuatro secciones con Pacientes marcada como actual y el
  cierre de sesión al pie

#### Scenario: US14-AC2

- **GIVEN** una ventana de 375 px con la sesión iniciada
- **WHEN** se abre `/knowledge`
- **THEN** la barra de pestañas inferior muestra las cuatro secciones con icono y nombre, y
  Conocimiento está seleccionada

### Requirement: FR-083

Toda pantalla que no sea la raíz de su sección MUST ofrecer una acción de retroceso en la propia
interfaz: en iOS/Android, la cabecera nativa del `Stack` con el título de la pantalla; en web, un
enlace «Volver a <sección o pantalla anterior>» antes del título. Al abrir una pantalla por URL
directa, el retroceso MUST llevar a la raíz de su sección. El título de la pantalla MUST coincidir
con el título del documento en web.

#### Scenario: US14-AC3

- **GIVEN** la consulta abierta desde la ficha de un paciente
- **WHEN** el usuario activa el retroceso de la interfaz
- **THEN** vuelve a la ficha del paciente

#### Scenario: Entrada por URL directa

- **GIVEN** `/follow-up/<id>` abierto directamente en una pestaña nueva
- **WHEN** el usuario activa «Volver»
- **THEN** llega a `/follow-up`

### Requirement: FR-084

Todo elemento cuya acción sea cambiar de ruta MUST exponerse como enlace (`Link` de Expo Router;
un `<a>` con `href` en web). Los botones MUST reservarse a acciones que no navegan o que navegan
solo como consecuencia de una operación (por ejemplo, tras guardar).

#### Scenario: US14-AC4

- **GIVEN** la lista de pacientes en web
- **WHEN** se inspecciona «Ver ficha» con el árbol de accesibilidad
- **THEN** su rol es `link` y tiene un `href` a `/patients/<id>`

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
- **WHEN** se abre `/follow-up`
- **THEN** se muestra un error con «Reintentar», y al reintentar con éxito aparece la lista

### Requirement: FR-086

Las listas de longitud no acotada (pacientes, fuentes y líneas de seguimiento) MUST renderizarse
virtualizadas (`FlatList`) y MUST NOT anidarse dentro de otro contenedor de desplazamiento
vertical.

#### Scenario: Lista larga de pacientes

- **GIVEN** 200 pacientes en la clínica
- **WHEN** se abre `/patients`
- **THEN** la lista se desplaza sin cargar todas las filas a la vez y sin doble barra de
  desplazamiento

### Requirement: FR-087

El texto que muestra datos clínicos (nombres, identificadores, valores de la ficha, citas de las
fuentes) y los mensajes de error MUST poder seleccionarse y copiarse en todas las plataformas.

#### Scenario: Copiar una cita

- **GIVEN** un fragmento citado en `/knowledge/sources/<id>`
- **WHEN** el usuario mantiene pulsado o selecciona el texto
- **THEN** puede copiarlo

### Requirement: FR-088

En los formularios, la acción principal y el campo con foco MUST NOT quedar ocultos por el teclado
en pantalla. Los formularios desplazables MUST aceptar el primer toque sobre un control con el
teclado abierto.

#### Scenario: Guardar con el teclado abierto

- **GIVEN** el formulario de nuevo paciente en un teléfono con el teclado abierto
- **WHEN** el foco está en el último campo
- **THEN** el botón de guardar sigue visible o alcanzable desplazando, y responde al primer toque

### Requirement: FR-089

El formulario de acceso MUST poder guardarse y rellenarse con el gestor de contraseñas del
navegador y del sistema operativo:

- En web, MUST ser un elemento `<form>` con `method="post"` y `action` propia, cuyos campos tengan
  `name` (`username`, `password`), `id` estables y `autocomplete="username"` y
  `autocomplete="current-password"`. El envío MUST producirse como evento `submit` del formulario,
  tanto con Intro como con el botón, y MUST NOT recargar la página.
- En iOS, los campos MUST declarar `textContentType` `username` y `password`. En Android, MUST
  declarar `autoComplete` `username`/`password` y ser relevantes para Autofill.
- Los campos MUST NOT estar en `readOnly` en el momento del relleno: el valor que un gestor escriba
  antes de la hidratación MUST adoptarse como valor inicial del formulario.
- Las credenciales MUST NOT persistirse en almacenamiento propio de la app (`localStorage`,
  `AsyncStorage`, `SecureStore`): el guardado es solo del gestor del usuario.

#### Scenario: US15-AC1

- **GIVEN** `/login` en web con el backend disponible
- **WHEN** el usuario escribe credenciales válidas y pulsa Intro en la contraseña
- **THEN** se dispara un único `submit` del `<form>`, la sesión se inicia y la URL no se recarga

#### Scenario: US15-AC2

- **GIVEN** el HTML estático de `/login`, antes de la hidratación
- **WHEN** un gestor escribe el correo y la contraseña
- **THEN** tras la hidratación ambos valores siguen en los campos y el envío los usa

### Requirement: FR-090

La pantalla de acceso MUST presentar el formulario dentro de un `Card`, con la marca, un título de
nivel 1 y una descripción, centrado y con el ancho `max-w-form`. El `Card` MUST distinguirse del
fondo en ambos esquemas con los tokens de D4. El campo de contraseña MUST ofrecer un control
«Mostrar contraseña» / «Ocultar contraseña» operable por teclado, con estado anunciado y área
táctil `min-h-touch`. El correo MUST pasar el foco a la contraseña con «Siguiente» del teclado. Los
errores MUST mostrarse con `Callout tone="error"`, anunciados como región viva. Tras un error, la
contraseña MUST vaciarse y el correo MUST conservarse.

#### Scenario: US15-AC3

- **GIVEN** `/login` a 320 px y a 1280 px, en claro y en oscuro
- **WHEN** se muestra
- **THEN** el formulario está en una tarjeta con borde visible sobre el fondo, sin desbordamiento
  horizontal y con 0 violaciones axe

#### Scenario: US15-AC4

- **GIVEN** el campo de contraseña con texto
- **WHEN** el usuario activa «Mostrar contraseña» con el teclado
- **THEN** la contraseña se ve en claro, el control pasa a «Ocultar contraseña» con estado
  `pressed`, y el campo conserva el nombre accesible «Contraseña»

#### Scenario: US15-AC5

- **GIVEN** credenciales incorrectas
- **WHEN** se envía el formulario
- **THEN** aparece un `Callout` de error anunciado, el correo se conserva y la contraseña queda vacía

### Requirement: FR-091

La app MUST ofrecer una preferencia de tema con tres valores (`system`, `light`, `dark`), con
`system` por defecto. MUST existir un botón de tema accesible en la navegación global (barra
lateral en web `lg`, barra superior compacta en web angosta, y Configuración en nativo) que
alterne entre claro y oscuro, anunciando el modo resultante, y un selector de los tres valores en
Configuración › Apariencia. La preferencia MUST persistir en el dispositivo (almacenamiento local
del navegador en web, `expo-secure-store` en nativo), MUST NOT enviarse al servidor y MUST degradar
a `system` si no puede leerse. En web, MUST aplicarse antes del primer pintado. Los tokens de
`global.css` MUST resolver igual con el modo forzado que con la media query, y `tema.test.ts` MUST
verificar ambos caminos.

#### Scenario: US16-AC1

- **GIVEN** la app en claro con preferencia `system` y un sistema en claro
- **WHEN** el usuario activa «Cambiar a modo oscuro»
- **THEN** la app pasa a oscuro sin recarga, el botón pasa a «Cambiar a modo claro», y tras
  recargar la app sigue en oscuro

#### Scenario: US16-AC2

- **GIVEN** la preferencia `dark`
- **WHEN** el usuario elige «Sistema» en Configuración › Apariencia con el sistema en claro
- **THEN** la app vuelve a claro y sigue al sistema desde entonces

### Requirement: FR-092

La identidad del profesional MUST mostrarse con un `Avatar`. Sin foto, muestra sus iniciales en
`text-primary` sobre `bg-primary-surface`, con `min-h-touch` de diámetro y forma circular. El avatar
MUST ser decorativo, con el nombre siempre presente como texto o como nombre accesible del control
que lo contiene. El componente MUST aceptar a futuro una `uri` de foto con respaldo a las
iniciales si la imagen falla; la carga y el almacenamiento de fotos quedan fuera de este cambio.

#### Scenario: US16-AC3

- **GIVEN** la sesión de «Dra. Ana Torres» sin foto
- **WHEN** se abre la barra lateral o Configuración
- **THEN** aparece un avatar con «AT» y el nombre completo como texto junto a él

### Requirement: FR-093

La navegación global MUST incluir una quinta sección, Configuración (`/settings`), con icono y
nombre, y con los mismos patrones de FR-082/FR-083. En la barra lateral es un elemento más; en la
barra inferior web angosta, Configuración MUST alcanzarse desde el avatar de una barra superior
compacta (nombre accesible «Configuración»), para que ninguna etiqueta se recorte (SC-059). En
nativo es la quinta pestaña. La sección MUST contener:

- el perfil (avatar, nombre, identificador de acceso de solo lectura, y un enlace «Editar datos
  personales» a `/settings/profile`);
- la apariencia (FR-091);
- el cierre de sesión.

La edición de datos personales y su persistencia se especifican en el cambio
`perfil-profesional`.

#### Scenario: US16-AC4

- **GIVEN** `/consultations/<id>` a 1280 px y a 375 px
- **WHEN** el usuario quiere cambiar sus ajustes
- **THEN** llega a `/settings` en 1 activación, desde la barra lateral o desde el avatar

### Requirement: FR-094

Inicio MUST mostrar un calendario mensual (`react-native-calendars`, design.md D17):

- en español, con la semana empezando el lunes;
- con los colores de `useThemeColors()` en claro y oscuro;
- con «hoy» marcado con algo más que el color (peso y anillo);
- con navegación entre meses por botones con nombre accesible («Mes anterior», «Mes siguiente»).

El calendario MUST recibir sus eventos por una prop con un tipo `CalendarEvent` compatible con
iCalendar (RFC 5545: `uid`, `start`/`end` en ISO 8601 con zona horaria, `allDay`, `title`, `rrule`
opcional), vacía en este cambio. Sin eventos, MUST mostrar el estado vacío «Sin eventos
agendados». MUST NOT mostrar datos de ejemplo.

#### Scenario: US16-AC5

- **GIVEN** Inicio en septiembre de 2026, en claro y en oscuro
- **WHEN** se muestra
- **THEN** aparece «septiembre de 2026» con la semana desde el lunes, hoy destacado, «Sin eventos
  agendados», y los botones de mes anterior y siguiente operables por teclado, con 0 violaciones
  axe
