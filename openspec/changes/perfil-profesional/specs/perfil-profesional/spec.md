# perfil-profesional

## Purpose

Permitir que cada profesional mantenga correcto su propio nombre visible sin romper la
trazabilidad clínica: el cambio es solo sobre sí mismo, exige sesión activa, queda auditado con los
valores anterior y nuevo, y nunca cambia a quién está atribuido un registro.

## User Scenarios & Testing

### User Story 17 - Corregir mi nombre visible (Priority: P3)

Como veterinario, quiero corregir cómo aparece mi nombre (por ejemplo, añadir mi segundo apellido
o el título), para que mis colegas me identifiquen correctamente en los registros, sabiendo que el
cambio queda registrado.

**Why this priority**: la cuenta se provisiona con un nombre que el profesional hoy no puede
corregir. No bloquea el trabajo clínico, pero un nombre erróneo en la atribución confunde al
equipo.

**Independent Test**: en `/settings/profile`, cambiar «Dra. Ana Torres» por «Dra. Ana Torres
Muñoz», guardar y ver el nombre nuevo en la barra lateral y en la atribución de una consulta. El
historial muestra el cambio, y otra veterinaria no puede cambiarlo.

**Acceptance Scenarios**:

1. **Given** una sesión activa, **When** el profesional guarda un nombre válido, **Then** el nombre
   se actualiza en la sesión y en toda atribución que lo muestre, sin recargar, y el historial
   registra el anterior y el nuevo con fecha.
2. **Given** un nombre vacío, de 1 carácter, de más de 80 caracteres o solo con espacios, **When**
   se intenta guardar, **Then** se rechaza con un mensaje junto al campo y nada cambia.
3. **Given** una sesión expirada o revocada, **When** se intenta guardar, **Then** el servidor lo
   rechaza, se muestra el diálogo de sesión expirada y lo escrito se conserva.
4. **Given** cualquier llamada directa a la API, **When** se intenta cambiar el perfil de otra
   persona o hacer `update` sobre `veterinarians`, **Then** se rechaza.

### Edge Cases

- Guardar el mismo nombre (tras normalizar espacios): no genera evento y se informa «Sin cambios».
- Dos pestañas guardan a la vez: gana el último, y ambos cambios quedan en el historial.
- Error de red al guardar: el formulario conserva lo escrito y ofrece reintentar.

### Trazabilidad de requisitos

| Requisito | Escenarios | Estado |
|---|---|---|
| FR-095 Edición auditada del nombre propio | US17-AC1/AC2/AC3/AC4 | Pendiente |
| FR-096 Historial de cambios y atribución estable | US17-AC1 | Pendiente |

## Success Criteria

### Measurable Outcomes

- **SC-060**: 100 % de los cambios de nombre producen exactamente 1 evento
  `veterinarian_profile_updated` con los valores anterior y nuevo. 0 escrituras aceptadas sobre
  `veterinarians` fuera de la función, y 0 registros clínicos cuyo `actor_id` cambie.

## Assumptions

- El único dato personal editable en este cambio es el nombre visible. La tabla no tiene otros
  datos personales, y ampliarla (teléfono, colegiatura) requiere una decisión de producto.
- Se muestra el nombre actual en la atribución histórica (decisión del usuario, 2026-09-25). La
  instantánea histórica por registro queda descartada.

## ADDED Requirements

### Requirement: FR-095

El profesional autenticado MUST poder cambiar su propio `display_name`, y solo mediante
`public.update_own_profile`. La función:

- MUST actuar solo sobre `auth.uid()` y exigir una sesión de acceso activa.
- MUST normalizar el nombre (recortar y colapsar espacios) y rechazarlo si queda con menos de 2 o
  más de 80 caracteres.
- MUST registrar en la misma transacción un evento `veterinarian_profile_updated`
  (`entity_type = 'veterinarian'`, `metadata = {previous, current}`), y MUST NOT registrarlo si el
  valor no cambia.
- Falla cerrado: los permisos `update` sobre `public.veterinarians` MUST seguir revocados.

#### Scenario: US17-AC1

- **GIVEN** la sesión activa de ANA
- **WHEN** guarda «Dra. Ana  Torres Muñoz »
- **THEN** `display_name` queda «Dra. Ana Torres Muñoz» y existe un evento con
  `previous = "Dra. Ana Torres"` y `current = "Dra. Ana Torres Muñoz"`

#### Scenario: US17-AC2

- **GIVEN** la sesión activa de ANA
- **WHEN** guarda «A»
- **THEN** la función rechaza el valor y no se registra ningún evento

#### Scenario: US17-AC3

- **GIVEN** la sesión de ANA revocada
- **WHEN** llama a `update_own_profile`
- **THEN** se rechaza, y en la UI aparece el diálogo de sesión expirada con lo escrito conservado

#### Scenario: US17-AC4

- **GIVEN** la sesión de BRUNO
- **WHEN** intenta `update` directo sobre la fila de ANA, o sobre la suya
- **THEN** ambas operaciones se rechazan

### Requirement: FR-096

La vista `/settings/profile` MUST mostrar el historial de cambios de nombre del propio profesional
(fecha, anterior, nuevo), del más reciente al más antiguo. La atribución de todo registro clínico
MUST seguir ligada a su `actor_id` y mostrar el nombre actual. Tras un cambio, las lecturas de
nombre en caché MUST invalidarse para que la interfaz no muestre el anterior.

#### Scenario: Historial y atribución tras un cambio

- **GIVEN** una consulta firmada por ANA y un cambio de nombre posterior
- **WHEN** se abre la consulta y `/settings/profile`
- **THEN** la consulta muestra el nombre nuevo con el mismo `actor_id`, y el historial muestra el
  cambio con su fecha
