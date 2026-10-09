## Why

Hoy el tutor solo existe como un efecto del alta del paciente: se crea dentro de «Registrar
paciente» o se elige de una lista plana (`listTutors` trae todos), y su única pantalla,
`/tutors/[id]`, es de solo lectura. No hay forma de ver, buscar, corregir ni dar de alta a un
tutor por sí mismo, ni de saber cuántos pacientes tiene. Con la clínica creciendo, un tutor mal
escrito o duplicado no tiene dónde arreglarse. Este cambio le da al tutor su propio módulo, con el
mismo patrón que la lista de pacientes (`rediseno-pacientes`).

## What Changes

- **Lista de tutores (`/tutors`)**: tabla en pantallas anchas (nombre, teléfono, correo, nº de
  pacientes, «Ver ficha») y tarjetas apiladas en pequeñas. Búsqueda por nombre y por contacto
  (teléfono o correo), orden por columna y paginación de 25, **en el servidor** (RPC
  `search_tutors`, migración 017). Filtros, orden y página en la URL.
- **Alta (`/tutors/new`)**: formulario con nombre obligatorio y al menos un medio de contacto
  (teléfono o correo); apellidos y dirección opcionales. Si ya existe un tutor con el mismo
  teléfono o correo, avisa sin bloquear.
- **Edición** en la ficha del tutor (`/tutors/[id]`): card de contacto con «Editar», con el mismo
  formulario. Revisa FR-116, que decía «sin edición».
- **Acceso**: botón «Registrar tutor» como acción principal (FR-083) y un enlace «Tutores» desde
  `/patients`. No es una sección nueva de la navegación: a 320 px solo caben cuatro (D17).
- **Formulario compartido**: el alta de tutor y el bloque «Nuevo tutor» de «Registrar paciente»
  pasan a usar un solo `TutorForm`, con los mismos `testID`.
- **Base de datos** (revisión de `clinical_records` para tutores, ver `design.md`): función
  `search_tutors`, índice sobre `content->>'tutorId'` de los pacientes y `check` de nombre no
  vacío para los tutores.

Fuera de alcance: borrar o archivar tutores (el rol `authenticated` no tiene `DELETE` sobre
`clinical_records`, 004), fusionar duplicados, exigir contacto en la base (hay datos y fixtures
con tutores sin contacto), y reemplazar el selector de tutor de «Registrar paciente», que sigue
cargando todos.

## Capabilities

### New Capabilities

- `administracion-tutores`: lista, búsqueda, alta y edición de tutores.

### Modified Capabilities

Ninguna publicada en `openspec/specs/`. Redefine, conservando el ID, FR-116 de `rediseno-pacientes`
(ficha mínima, ahora editable) y toca FR-027 de `implementar-registro-clinico-longitudinal` (el
tutor sigue siendo una fila `clinical_records` de tipo `tutor`; el contenido no cambia).
Condición de aceptación conjunta: `rediseno-pacientes` y este cambio.

## Impact

- Código: `src/app/(protected)/(patients)/tutors/{index,new,[id]}.tsx`,
  `src/app/(protected)/(patients)/patients/{index,new}.tsx`; `src/components/registro/{tutors-table,
  tutor-form}.tsx`; `src/features/registro/{tutor-search,tutor-service}.ts`;
  `src/lib/supabase/database.types.ts` (por `db:types`).
- Base de datos: migración `017_administracion_tutores.sql` y su suite pgTap.
- Pruebas: unitarias (`tutor-search`, `tutors-table`, `tutor-form`), pgTap, e2e `tutores`.
- Dependencias: ninguna nueva.
