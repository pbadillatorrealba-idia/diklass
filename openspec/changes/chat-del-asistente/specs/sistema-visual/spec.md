# Sistema visual

Delta que retira del shell lo que absorbe el chat del asistente. Se aplica tras archivar
`shell-asistente-tres-zonas` (#70), que introduce estos requisitos.

## MODIFIED Requirements

### Requirement: Hilos contextuales del panel

El panel MUST ofrecer hilos según la pantalla: «Escucha» solo con una consulta abierta y «Asistente»
siempre (su contenido es de `asistente-conversacional`). Con un único hilo, el panel MUST nombrarlo sin
pestañas. Cambiar de pantalla MUST conservar el estado del panel y MUST mantener el hilo activo si sigue
disponible, o pasar a «Asistente» si no.

#### Scenario: una pantalla sin consulta solo ofrece «Asistente»

- **GIVEN** el veterinario en `/home`
- **WHEN** ve el panel
- **THEN** solo está el hilo «Asistente», sin pestañas

#### Scenario: hilo de escucha solo en consulta abierta

- **GIVEN** el hilo «Escucha» activo en una consulta abierta
- **WHEN** el veterinario navega a `/patients`
- **THEN** el panel sigue abierto y muestra «Asistente», sin el hilo «Escucha»

## REMOVED Requirements

### Requirement: Conocimiento en el panel

**Reason**: el hilo «Conocimiento» se funde en el chat del asistente; `/knowledge` muestra ese mismo chat.

**Migration**: ver «Conocimiento dentro del chat» y «Paciente de contexto automático» en `asistente-conversacional`.

### Requirement: Hilo del asistente con consultas básicas

**Reason**: el hilo pasa a ser el chat persistido y con audio.

**Migration**: ver «Consultas básicas» y «Conversación continua y privada» en `asistente-conversacional`.
