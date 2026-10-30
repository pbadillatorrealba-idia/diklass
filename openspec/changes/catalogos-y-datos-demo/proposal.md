## Why

Hoy la base solo valida con Zod en el cliente: `species`, `sex` y `reproductiveStatus` del
paciente son texto libre obligatorio, y en los datos y las pruebas conviven «Macho», «macho» y
«M»; «perro», «Canino» y «canino»; «esterilizada», «castrado» y «Entera». Eso rompe los filtros, la
ordenación y cualquier estadística. El tutor, además, no tiene un identificador: dos fichas del
mismo dueño no se pueden distinguir de dos homónimos. Y no hay una base de prueba razonable: cada
prueba inventa sus filas y la clínica local queda vacía o llena de restos.

Este cambio fija los vocabularios cerrados y los obligatorios **en la base** (no solo en el
formulario), agrega el RUT del tutor, y deja una clínica de demostración chilena reproducible.

## What Changes

- **Catálogos cerrados** del paciente: `species` (canino, felino), `sex` (macho, hembra),
  `reproductiveStatus` (entero, esterilizado). Se enumeran en `src/features/registro/catalogs.ts`,
  se validan con Zod (`z.enum`) y con un `check` de la base. El formulario pasa de texto libre a
  grupos de opciones (`OptionPicker`) y las lecturas muestran la etiqueta («Canino»).
- **Obligatorios del paciente en la base**: `name`, `breed` y `tutorId` no vacíos (migración 018).
- **RUT del tutor**: obligatorio, válido (dígito verificador, módulo 11), guardado canónico
  (`12345678-5`) y único por clínica. Se pide en el alta, se muestra y se busca (con o sin puntos)
  en la lista de tutores. Un RUT repetido bloquea el alta con un mensaje junto al campo; el
  teléfono o correo repetido sigue solo avisando (FR-122).
- **Clínica de demostración**: `bun run provision:demo` carga 15 tutores, 25 pacientes (perros y
  gatos) y 8 consultas con anamnesis, con nombres comunes en Chile; `bun run demo:reset` reconstruye
  la base local desde cero. Todo escrito por los servicios reales con la sesión de cada veterinario.
- **Limpieza**: se reemplazan los valores antiguos de las pruebas (`perro`, `esterilizada`…) por
  los del catálogo, y los datos viejos de la base local desaparecen con el reset.

Fuera de alcance, con motivo (ver `design.md`): `breed` y `city` siguen siendo texto libre (el
catálogo de razas y comunas es largo y cambia; una lista incompleta bloquearía datos reales); exigir
las columnas de procedencia o adopción; validar en la base que `tutorId` apunte a un tutor
existente; especies exóticas.

## Capabilities

### New Capabilities

- `catalogos-y-datos-demo`: vocabularios cerrados del paciente, RUT del tutor y clínica de demostración.

### Modified Capabilities

Ninguna publicada en `openspec/specs/`. Redefine FR-121 (el alta de tutor ahora exige RUT) y
FR-123 de `administracion-tutores`, y FR-001/FR-027 de `implementar-registro-clinico-longitudinal`
(especie, sexo y estado reproductivo pasan a catálogo).

## Impact

- Código: `src/features/registro/{catalogs,schema,tutor-search}.ts`, `src/lib/rut.ts`,
  `src/components/registro/{ficha-form,tutor-form,tutors-table,patient-record,patients-table}.tsx`,
  pantallas de `(tutors)` y `patients/new.tsx`.
- Base de datos: migración `018_catalogos_y_rut.sql` (checks `not valid`, índice único,
  `rut_is_valid`, `search_tutors` con RUT) y su suite pgTap; las suites 001–017 actualizan sus
  fixtures a contenido válido.
- Datos y scripts: `scripts/provision-demo-data.ts`, `scripts/demo/datos-demo.ts`, fixture de
  veterinarios (un tercero), `SETUP.md`.
- Pruebas: unitarias (RUT, catálogos, esquemas), integración viva, pgTap y e2e (`tutores`,
  `ficha-etologica`) con RUT únicos por ejecución (`tests/support/rut.ts`).
- Dependencias: ninguna nueva.
