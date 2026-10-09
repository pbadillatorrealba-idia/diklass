## Context

`implementar-registro-clinico-longitudinal` entregó `/patients` y `/patients/[id]` con el
contenido clínico completo; `sistema-visual` fijó su disposición (D9, D18, D20). Este cambio
rehace esas dos pantallas sin tocar el modelo clínico, salvo un campo opcional por antecedente.

## Decisions

### D1 — Búsqueda y orden en una función SQL, no en el cliente

Los pacientes son filas de `clinical_records` con `content` jsonb, y la «última visita» es
`max(created_at)` de las consultas cuyo `content->>'patientId'` es el paciente. Filtrar y ordenar
eso en el cliente exige traer todo. `public.search_patients(p_name, p_breed, p_tutor_id,
p_visit_from, p_visit_to, p_sort, p_dir, p_limit, p_offset)` lo hace en el servidor:

- `language sql stable security invoker`: aplica la RLS de la clínica; no se salta ninguna
  política. `revoke ... from public, anon`; `execute` solo para `authenticated`.
- `ilike` con `\`, `%` y `_` escapados: lo buscado es literal.
- Rango de última visita `[desde, hasta)`; la UI manda fechas `AAAA-MM-DD` y el cliente las
  convierte a UTC con el día siguiente como cota superior. Excluye a quien no tiene visitas.
- Orden por `name | species | breed | tutor | last_visit`, `nulls last`, con
  `lower(name), id` como desempate estable. Límite acotado a 1..100.
- Devuelve `total_count` en cada fila para paginar sin segunda consulta.

Alternativa descartada: vista materializada con `last_visit_at`. Añade invalidación y no es
necesaria a la escala de la PoC.

### D2 — Estado de la lista en la URL

`name`, `breed`, `from`, `to`, `tutor`, `sort`, `dir` y `page` viven en los parámetros de la ruta:
la vista es enlazable y el botón atrás funciona. Los campos de texto se confirman con 300 ms de
debounce y reinician la página. Las cabeceras de orden y el paginador son `Link` (FR-084).
TanStack Query con `keepPreviousData` evita el parpadeo entre páginas.

### D3 — Tabla ↔ tarjetas por ancho de ventana

Desde 1024 px, una tabla con roles `table/row/columnheader/cell` y `aria-sort`; por debajo,
tarjetas con las mismas etiquetas. Sin desplazamiento horizontal (FR-079). Se conservan los
`testID` `patients-list`, `patient-item` y `patient-open`.

### D4 — Ficha en una columna de cards con edición por card (revisa D18 y D20 de `sistema-visual`)

Una sola columna: el orden visual, el del DOM y el del foco coinciden. Cada card editable
(`EditableCard`) abre solo sus campos (`FichaForm` con `fields`) y al guardar los **fusiona sobre
la ficha vigente**, de modo que editar una card no pisa otra abierta antes. Los antecedentes
siguen escribiéndose por apéndice (`addAntecedentItem`), nunca con la ficha.

La cabecera lleva el nombre como título y una grilla de 11 datos. La edad se calcula desde la
fecha de nacimiento (años y meses) y, sin ella, desde los meses registrados.

### D4b — Presentación de datos de la ficha

La cabecera lleva el subtítulo «Resumen» y tres grupos (Identidad, Edad y medidas, Seguimiento) más
«Alertas» si falta algún dato. Cada dato es un `DataItem` (rótulo `label` apagado arriba, valor
debajo) y cada grupo un `DataGroup` (subtítulo `rubric` y separador), ambos en `src/components/ui/`.
Las cards de procedencia, derivante y tutor reutilizan `DataItem`; `Field` queda para el formulario
clínico con marca de procedencia. Los tipos y estados cortos (Dato/Negativo, Cerrada/Abierta) son un
`Chip` (`rounded-sm`, texto visible). Carga, error y ficha inexistente usan `QueryState`, y los avisos
de guardado, `Callout`.

### D5 — FR-044 redefinido: sin aviso por antecedentes vacíos

Decisión del usuario (2026-10-09): un paciente puede no tener antecedentes y estar bien, así que
no se avisa de los grupos vacíos. Se retira el panel «Información de la ficha». Se conserva:

- una línea en la cabecera con los **campos de la ficha** sin dato (fecha de nacimiento, edad,
  peso, procedencia y edad de adopción), calculados por `computeMissingFichaFields` filtrando
  `kind = sin_dato`;
- «Sin dato» en cada campo vacío y «Sin registrar» en cada grupo vacío;
- el chip **Negativo** en los hallazgos negativos registrados, que siguen contando como
  información y nunca como falta.

### D6 — Antecedentes: `recordedAt` opcional

El ítem gana `recordedAt` (ISO), que `addAntecedentItem` fija al guardar. Es opcional: los ítems
anteriores no lo tienen y se muestran sin fecha. Sin migración ni reescritura de datos.

### D7 — Navegación (revisa D12 de `sistema-visual`)

`Screen` recibe `back.crumbs`. En web y desde 1024 px, el retroceso se pinta como breadcrumb
(`nav` con `aria-label="Ruta"`, la página actual con `aria-current="page"`); en pantallas
pequeñas y en nativo sigue «‹ Volver a …» / cabecera nativa. La consulta enlaza
`Pacientes › <nombre> › Consulta`. `Screen` recibe además `action`: en web desde 768 px va en
la línea del `h1`; en nativo y por debajo de 768 px, en una barra fija al pie (`screen-action-bar`)
a todo el ancho, fuera del `ScrollView`, para que no tape el contenido.

### D8 — Ficha del tutor mínima

`/tutors/[id]` muestra el contacto y la tabla de sus pacientes (`search_patients` con
`p_tutor_id`). Sin edición: fuera de alcance.

## Risks / Trade-offs

- `search_patients` recorre las consultas del paciente con un subselect: aceptable a la escala de
  la PoC; si crece, índice sobre `content->>'patientId'`.
- `database.types.ts` se editó a mano en este cambio: debe coincidir con lo que genera
  `db:types` tras el formato de CI (verificación pendiente, ver tasks).
- Los e2e que seleccionaban los controles de antecedentes y las dos columnas de la ficha cambian
  (ver tasks 4.x).

## Verificación de la constitución

Sin decisión clínica automática: todo lo que se muestra o edita lo escribe el veterinario. Sin
dependencia nueva. La función SQL no amplía permisos (RLS vigente).
