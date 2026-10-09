## Context

El tutor es una fila `clinical_records` con `record_type = 'tutor'` y `content` jsonb validado con
Zod en el cliente (`tutorContentSchema`: `name` obligatorio, `phone`/`email` con al menos uno,
`surname`, `address`, `city`, `postalCode` opcionales). El paciente lo referencia por
`content->>'tutorId'`. Servicio vigente: `createTutor`, `updateTutor`, `listTutors`, `getTutor`.
`rediseno-pacientes` dejó la lista de pacientes con `search_patients` y un `/tutors/[id]` de solo
lectura; este cambio copia ese patrón para el tutor.

## Revisión de la base de datos

Lo que se comprobó en las migraciones 002–016 y en los fixtures:

| Hallazgo | Consecuencia |
|---|---|
| La RLS de `clinical_records` acota por clínica; la actualización exige `status = 'draft'` (003), y el tutor lo es. | Editar un tutor funciona con la política vigente; no hace falta tocarla. |
| `authenticated` no tiene `DELETE` (004). | No hay borrado de tutores: queda fuera de alcance. |
| No hay validación del contenido en el servidor: todo `content` es jsonb libre; solo Zod en el cliente. | Se añade un `check` mínimo: un tutor tiene nombre no vacío. |
| Hay tutores sin contacto en datos y fixtures (pgTap 010, e2e `conocimiento`). | **No** se exige contacto en la base: rompería esos datos. Se exige en el formulario (FR-121). |
| Hay índice sobre `content->>'patientId'` y `'consultationId'` (009), no sobre `'tutorId'`. | El nº de pacientes por tutor y el filtro por tutor recorrerían la clínica entera: se añade `clinical_records_tutor_idx`. |
| No hay unicidad de teléfono ni correo. | Dos familiares comparten teléfono con razón: no se bloquea; se avisa (FR-122). |
| `listTutors` trae todos los tutores (`readAllPages`). | La lista nueva pagina en el servidor. El selector de «Registrar paciente» sigue como está (fuera de alcance). |

## Decisions

### D1 — `search_tutors`, igual que `search_patients`

`public.search_tutors(p_name, p_contact, p_sort, p_dir, p_limit, p_offset)`:
`language sql stable security invoker` (la RLS acota a la clínica), `revoke … from public, anon`,
`execute` solo para `authenticated`.

- `p_name` filtra por «nombre apellido» y `p_contact` por teléfono o correo; ambos con `ilike` y
  `\`, `%`, `_` escapados (literales), como en D1 de `rediseno-pacientes`.
- Devuelve `id, name, surname, full_name, phone, email, patient_count, total_count`.
  `patient_count` cuenta los pacientes con `content->>'tutorId' = tutor.id::text`.
- Orden por `name | patients`, asc/desc, con `lower(full_name), id` como desempate.
  Límite acotado a 1..100.

### D2 — Un `TutorForm` para el alta, la edición y «Nuevo tutor» del paciente

Hoy el formulario vive dentro de `patients/new.tsx`. Se extrae a `components/registro/tutor-form.tsx`
(valores, errores por campo y `testID` actuales: `tutor-name`, `tutor-phone`…) y lo usan las tres
pantallas. Valida con `tutorContentSchema.safeParse`; los errores salen por campo con
`getFieldErrors`. Los obligatorios se rotulan «(obligatorio)» en el texto, no solo por color.

### D3 — Alta con aviso de duplicado, sin bloqueo

Al enviar, el formulario consulta `search_tutors` con el teléfono y con el correo; si algún
resultado coincide exacto (sin mayúsculas ni espacios), muestra un `Callout` de aviso con el
nombre del tutor y un enlace a su ficha, y el botón pasa a «Registrar de todos modos». Un
segundo envío crea el tutor. Un error de la consulta no impide guardar: el aviso es una ayuda,
no una compuerta.

### D4 — Edición en la ficha, no en una ruta aparte

`/tutors/[id]` gana una card «Contacto» con «Editar» que cambia la lectura por el `TutorForm` y
guarda con `updateTutor` (que ya pasa por el contrato de atribución). Evita una ruta
`tutors/[id]/edit` y un cambio de estructura de carpetas. Tras guardar se invalida `registro`.

### D5 — Sección propia en la barra lateral; en la inferior, por Pacientes

`Tutores` es una sección más de `SECTIONS` (grupo de rutas `(tutors)`, icono
`account-group-outline`) y aparece en la barra lateral desde 1024 px. La barra inferior web sigue con
cuatro secciones, porque a 320 px no caben más con el nombre visible (D17 de `sistema-visual`):
ahí se llega por el botón «Tutores» de `/patients`, igual que Configuración se llega por el avatar.
En nativo la barra de pestañas muestra las seis; en iOS la sexta queda bajo «Más».

### D6 — Reutilizar en vez de duplicar

La tabla sigue el patrón de `PatientsTable` (tabla desde 1024 px, tarjetas debajo, cabeceras como
enlaces) y el estado de URL el de `patients/index.tsx`. Se reutilizan `Screen`/`action`,
`QueryState`, `Callout`, `DataItem`, `isUuid` y `tutorFullName`. No se extrae una tabla genérica
con dos usos: son dos componentes de unas 100 líneas.

## Risks / Trade-offs

- El `check` de nombre se añade `not valid`: no revisa las filas previas, solo las que se
  inserten o actualicen. Si algún dato antiguo no tiene nombre, `updateTutor` fallaría sobre
  él hasta que se corrija; Zod ya lo impedía en el cliente.
- `search_tutors` recorre los pacientes por tutor con un subselect: con el índice nuevo es una
  búsqueda por índice por tutor.
- El aviso de duplicado compara en el cliente lo que devuelve `search_tutors` (subcadena); un
  teléfono corto podría traer resultados que el cliente descarta por no ser exactos.

## Verificación de la constitución

Sin decisión clínica automática: todo lo escribe el veterinario. Sin dependencias nuevas. La
función SQL no amplía permisos (RLS vigente). Los datos del tutor son datos personales: se
muestran seleccionables, nunca van a logs (los eventos solo llevan `requestId` y operación).
