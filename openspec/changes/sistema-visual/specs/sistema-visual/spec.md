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

### Edge Cases

- Texto ampliado por el sistema (Dynamic Type / zoom del navegador al 200 %): las filas crecen y el
  texto se ajusta de línea; nunca se desactiva el escalado.
- Un icono que no carga no puede dejar un control sin nombre: el texto o la etiqueta accesible
  sigue presente.
- Contenido sugerido que el profesional aprueba: pasa a mostrarse como validado, con su
  atribución, sin el tratamiento de sugerido.
- La severidad `critico` no existe hoy en ningún vocabulario de datos; se muestra solo cuando una
  feature la emita (006/007).

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

## Success Criteria

### Measurable Outcomes

- **SC-050**: la compuerta axe WCAG 2.2 AA reporta 0 violaciones en las pantallas cubiertas, en
  esquema claro y oscuro.
- **SC-051**: 0 literales de color (hex, `rgb()`, `rgba()`) y 0 colores de paleta fija de Tailwind
  en `src/` fuera de los archivos del tema.
- **SC-052**: 0 pantallas con desplazamiento horizontal a 320 px CSS.
- **SC-053**: todos los pares texto/superficie del tema, incluidos los de estado, sugerido y
  severidad, cumplen ≥ 4.5:1; los bordes de control y el indicador de foco, ≥ 3:1.

## Assumptions

- La paleta de marca vigente (verde azulado primario, azul secundario, ámbar de acento) se
  mantiene. El modo sigue al sistema operativo, sin selector manual.
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
