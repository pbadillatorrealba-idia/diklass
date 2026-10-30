# Proposal

## Why

El módulo de seguimiento (`/follow-up`: línea de tiempo de retroalimentación clínica y registro de
evolución, adherencia y eventos adversos) deja de formar parte del producto. Mantenerlo cuesta una
sección de navegación, pantallas, tests, datos demo y superficie para el agente que nadie va a usar.

## What Changes

- **BREAKING** Se elimina la sección «Seguimiento» y las rutas `/follow-up` y `/follow-up/[patientId]`;
  la navegación global pasa de cuatro secciones a tres (Inicio, Pacientes, Conocimiento).
- Se elimina la interfaz de retroalimentación clínica (formulario, línea de tiempo, eventos
  adversos), su servicio, esquema y utilidades de `src/features/retroalimentacion/`.
- Se retira la ruta `/follow-up` de las rutas permitidas del agente y de su prompt.
- Se retira la severidad visual de cuatro niveles (`SeverityBadge`), cuyo único uso eran los eventos
  adversos.
- Se quitan la retroalimentación de los datos demo (`scripts/demo/`), sus huellas de contratos, y los
  tests unitarios, de integración y e2e del módulo.
- Se actualizan DESIGN.md, PRODUCT.md, el brief y los workflows de CI que nombren el módulo.
- **No cambia:** la base de datos (migración 012, tipo `clinical_feedback`, trigger de validación e
  inmutabilidad, evento `clinical_feedback_recorded`) ni sus pruebas pgTap. Los datos existentes no se
  tocan. `plan.followUp` y `FollowUpSummaryPanel` de la consulta tampoco cambian.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `retroalimentacion-clinica`: se retiran todos sus requisitos de interfaz y captura (FR-018, FR-039,
  FR-040, FR-041, FR-024, FR-056, FR-057, FR-070, FR-042, FR-043). Los IDs quedan retirados y no se
  reutilizan.
- `sistema-visual`: se retira FR-077 (severidad clínica de cuatro niveles); FR-082 y la historia US14
  pasan de cuatro a tres secciones; se retiran los escenarios de `/follow-up` en FR-083 y FR-085; FR-086
  deja de nombrar las líneas de seguimiento.

## Impact

- **Código:** `src/app/(protected)/(follow-up)/`, `src/components/retroalimentacion/`,
  `src/features/retroalimentacion/`, `src/components/ui/severity-badge.tsx`, navegación
  (`sections.ts`, `section-stack.tsx`), `supabase/functions/_shared/routes.ts` y `agent/agent.ts`.
- **Datos demo y tests:** `scripts/demo/*`, `tests/{unit,integration,e2e}` de retroalimentación y los
  e2e que la recorren.
- **BD:** sin cambios; queda un tipo de registro que ninguna interfaz escribe (deuda consciente).
- **Specs en vuelo:** `agente-conversacional`, `dataset-clinico-trazable` y `marca-movil-sin-barra`
  nombran seguimiento o retroalimentación y deben reconciliarse (ver design).
- **Riesgo:** la cobertura e2e de `clinical_feedback` queda solo en pgTap.
