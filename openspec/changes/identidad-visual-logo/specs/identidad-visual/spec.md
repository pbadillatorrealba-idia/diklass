#  Identidad visual

## Purpose

Hace que la marca Diklass (logo y color) sea la identidad principal y única de la app en iOS,
Android y web, sin degradar la legibilidad clínica ni la distinción entre lo sugerido, lo
corregido y lo firmado por el veterinario.

**Created**: 2026-10-09

**Status**: Draft — pendiente. Nada de esto está implementado ni aceptado.

**Nota sobre identificadores**: FR/SC/US continúan la numeración global (último FR-100, SC-061,
US18). Se apoya en `sistema-visual` (FR-071, FR-072, FR-081, FR-098).

## User Scenarios & Testing

### User Story 19 - La app se reconoce como Diklass (Priority: P3)

Quien abre la app (veterinario o evaluador) ve el logo de Diklass al instalarla, al arrancar, al
acceder y al navegar, y el color de la interfaz es coherente con él.

**Why this priority**: no cambia el comportamiento clínico, pero condiciona la credibilidad del
PoC en demostraciones.

**Independent Test**: instalar la app, abrirla en claro y oscuro, recorrer acceso y navegación y
ejecutar la suite de tema y la compuerta axe.

**Acceptance Scenarios**:

1. **Given** la app instalada, **When** se ve el ícono y se arranca, **Then** aparecen el isotipo y
   el splash de Diklass.
2. **Given** la pantalla de acceso y la navegación web, **When** se cargan, **Then** muestran el
   wordmark con nombre accesible "Diklass".
3. **Given** cualquier pantalla, **When** se compara el color de marca con el logo, **Then** el
   primario y la tinta provienen del degradado del logo.

### Edge Cases

- Wordmark blanco sobre fondo claro: se usa la variante en tinta o se coloca sobre superficie índigo.
- El PNG fuente no escala a íconos pequeños: se usa el isotipo recortado, no el wordmark.

## Success Criteria

- **SC-062**: 0 violaciones axe en `chromium` y `chromium-dark` con la paleta nueva.
- **SC-063**: ícono, splash y favicon presentes y con las dimensiones de plataforma (verificado por prueba).

## Traceability

| Requisito | Escenario | Estado |
|---|---|---|
| FR-101 Ícono, splash, favicon | US19-AC1 | Pendiente |
| FR-102 Wordmark en acceso y navegación | US19-AC2 | Pendiente |
| FR-103 Paleta de marca | US19-AC3 | Pendiente |
| FR-104 Firma distinta de marca | — | Pendiente |

## ADDED Requirements

### Requirement: FR-101

La app MUST usar el logo de Diklass como ícono de aplicación (iOS y Android, incluido el adaptativo
de Android sobre fondo índigo), pantalla de arranque y favicon web, derivados de
`assets/brand/logo-fuente.png`.

#### Scenario: US19-AC1

- **GIVEN** un build de la app
- **WHEN** se inspeccionan `app.json` y los assets referenciados
- **THEN** ícono, splash y favicon existen, tienen las dimensiones que exige cada plataforma y
  muestran la marca

### Requirement: FR-102

La pantalla de acceso y la navegación global web (cabecera compacta y barra lateral) MUST mostrar
el wordmark de Diklass con nombre accesible `Diklass` y una variante legible sobre fondo claro y
oscuro. Una versión SVG trazada SHOULD sustituir al PNG solo si no se distingue del original a
tamaño de uso.

#### Scenario: US19-AC2

- **GIVEN** `/login` y una pantalla protegida en web, en esquema claro y oscuro
- **WHEN** se cargan
- **THEN** el wordmark es visible, tiene nombre accesible y la compuerta axe no reporta violaciones

### Requirement: FR-103

Los tokens `primary`, `foreground`, `background`, `accent`, `primary-surface` y `border` MUST
derivar de la paleta de marca (índigo `#3E3888`, tinta `#251134`, teal `#2F8F8A`) con variante
oscura, y MUST cumplir FR-072 (texto ≥ 4.5:1; borde de control ≥ 3:1).

#### Scenario: US19-AC3

- **GIVEN** los valores nuevos en `global.css` y `colors.ts`
- **WHEN** se ejecuta `bun test tests/unit/theme`
- **THEN** la sincronía CSS↔TS y todos los pares de contraste pasan en claro y oscuro

### Requirement: FR-104

El color de la firma del veterinario (`stamp`) MUST ser perceptiblemente distinto del `primary`
(ΔE*ab ≥ 10) y seguir cumpliendo FR-098; los tokens de estado clínico MUST conservar su matiz y su
contraste.

#### Scenario: Firma distinta de marca

- **GIVEN** los tokens `stamp` y `primary` en claro y oscuro
- **WHEN** se ejecuta la prueba de distancia de color
- **THEN** ΔE*ab ≥ 10 en ambos esquemas, o la prueba falla nombrando el esquema
