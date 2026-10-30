## MODIFIED Requirements

### Requirement: FR-026

La conversación con el asistente MUST preservar el contexto del paciente a lo largo de la sesión de
acceso, y ese contexto MUST fijarlo la navegación de la aplicación (abrir la ficha o una consulta del
paciente) y no un selector manual.

#### Scenario: US5-AC4

- **GIVEN** un paciente cuya ficha o consulta está abierta
- **WHEN** el veterinario hace varias preguntas seguidas
- **THEN** la conversación mantiene el contexto de ese paciente.

#### Scenario: el contexto sigue a la pantalla

- **GIVEN** el contexto de un paciente fijado por su ficha
- **WHEN** el veterinario sale a una pantalla sin paciente
- **THEN** las preguntas siguientes no usan los datos de ese paciente.
