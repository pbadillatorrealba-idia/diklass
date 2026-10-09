## Why

La lista de pacientes era un listado de tarjetas sin búsqueda ni orden, y la ficha, un formulario
largo a dos columnas con un panel de campos faltantes y cinco sub-tarjetas de antecedentes con su
alta siempre abierta. Con más pacientes la lista no escala (todo se filtraba en el cliente o no se
filtraba) y la ficha mezclaba lectura, edición y avisos de relleno. Este cambio deja la lista y la
ficha como se usan en la clínica y registra, como canon, las decisiones de producto tomadas durante
el rediseño (en particular, que un paciente sin antecedentes registrados está bien: no se avisa).

## What Changes

- **Lista de pacientes (`/patients`)**: tabla en pantallas anchas (nombre, especie, raza, última
  visita, tutor enlazado, «Ver ficha») y tarjetas apiladas en pequeñas. Búsqueda por nombre, raza y
  rango de fecha de la última consulta, y orden por columna, **en el servidor** (RPC
  `search_patients`, migración 015). Filtros, orden y página en la URL; 25 por página.
- **Ficha del tutor mínima (`/tutors/[id]`)**: contacto y sus pacientes; es el destino del enlace
  de tutor de la tabla.
- **Ficha del paciente (`/patients/[id]`)**: una sola columna de cards: cabecera con el nombre
  como título y una grilla de datos (incluye edad calculada, última visita y nº de consultas),
  tutor, procedencia y adopción, derivante y seguro, antecedentes e historial. Cada card se edita
  por separado. «Abrir consulta» sube a la línea del título de la pantalla.
- **Antecedentes**: una card con un bloque por grupo; chips «Dato»/«Negativo»; alta en línea que se
  abre por grupo y se envía con Enter; fecha de alta por ítem (`recordedAt`, opcional).
- **Historial** como línea de tiempo.
- **Navegación**: desde 1024 px en web, el retroceso «‹ Volver a …» pasa a un breadcrumb
  (`Pacientes › nombre › Consulta`); en pantallas pequeñas y nativo no cambia. `Screen` gana la
  prop `action`.
- **BREAKING (documental)**: se retira el panel «Información de la ficha». FR-044 se redefine: ya
  no se señalan los grupos de antecedentes vacíos; se mantienen los campos de la ficha sin dato y la
  distinción visible entre «sin dato» y «hallazgo negativo registrado».

Fuera de alcance: edición de la ficha del tutor, exportación de la tabla, búsqueda por tutor
escrita a mano (el filtro por tutor solo existe como parámetro de la ficha del tutor), y cambios
en la consulta (`/consultations/[id]`) salvo su breadcrumb.

## Capabilities

### New Capabilities

- `lista-pacientes`: tabla de pacientes con búsqueda, filtro y orden en el servidor, y ficha
  mínima del tutor.
- `ficha-paciente`: ficha por cards con edición por card, antecedentes en línea e historial en
  línea de tiempo.

### Modified Capabilities

Ninguna publicada en `openspec/specs/`. Redefine, conservando sus IDs, FR-001, FR-002 y FR-044 de
`implementar-registro-clinico-longitudinal`, y FR-079 y FR-083 (y D12, D18, D20) de
`sistema-visual`. Condición de aceptación conjunta: ambos cambios.

## Impact

- Código: `src/app/(protected)/(patients)/patients/{index,[id]}.tsx`, `tutors/[id].tsx`;
  `src/components/registro/{patients-table,patient-record,antecedents-panel,patient-history,
  ficha-form}.tsx`; `src/components/ui/screen.tsx`; `src/features/registro/{patient-search,schema,
  ficha-service}.ts`; `src/lib/supabase/database.types.ts`; eliminados `ficha-summary.tsx` y
  `missing-fields-panel.tsx`.
- Base de datos: migración `015_busqueda_pacientes.sql` (función `search_patients`,
  `security invoker`, RLS vigente) y su suite pgTap. `content` sigue siendo jsonb: `recordedAt` no
  requiere migración.
- Pruebas: unitarias (`patient-search`, `patient-record`, `screen-title`, `ficha-service`), pgTap,
  e2e `accessibility` y `caso-sintetico` actualizados.
- Dependencias: ninguna nueva.
