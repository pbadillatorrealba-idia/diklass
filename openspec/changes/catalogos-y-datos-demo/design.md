## Context

`clinical_records.content` es jsonb libre por tipo de registro. La validación vive en Zod
(`schema.ts`) y, desde la 017, en un `check` mínimo del nombre del tutor. Este cambio revisa
variable por variable qué debe ser categórica y qué obligatoria, y lleva a la base lo que el
modelo ya declaraba.

## Revisión de variables

| Entidad · variable | Antes | Ahora | Dónde se exige |
|---|---|---|---|
| Paciente · `species` | texto libre obligatorio | **categórica**: canino, felino | Zod + `check` |
| Paciente · `sex` | texto libre obligatorio | **categórica**: macho, hembra | Zod + `check` |
| Paciente · `reproductiveStatus` | texto libre obligatorio | **categórica**: entero, esterilizado | Zod + `check` |
| Paciente · `name`, `breed`, `tutorId` | obligatorios solo en Zod | obligatorios no vacíos | Zod + `check` |
| Paciente · `breed` | texto libre | texto libre (ver D2) | Zod |
| Paciente · `referrer.refers` | `si`/`no` | sin cambio | Zod |
| Paciente · `origin`, `adoptionState` | texto libre opcional | texto libre opcional (ver D2) | — |
| Tutor · `name` | obligatorio (Zod + `check` de 017) | sin cambio | Zod + `check` |
| Tutor · `rut` | no existía | **obligatorio**, válido, canónico, único por clínica | Zod + `check` + índice único |
| Tutor · `phone`/`email` | al menos uno (Zod) | sin cambio: no se exige en la base (hay tutores antiguos sin contacto) | Zod |
| Tutor · `city` | texto libre opcional | texto libre opcional (ver D2) | — |

## Decisions

### D1 — Catálogos en el código y en un `check`, no en tablas de referencia

Los tres vocabularios son pequeños y estables. Viven en `catalogs.ts` (valores + etiquetas) y se
enumeran en el `check` `clinical_records_patient_catalog_check`. Una tabla de referencia con clave
foránea no sirve aquí: el valor vive dentro de un jsonb. Agregar una especie exige una migración que
reemplace el `check`: es deliberado, porque el catálogo es una decisión clínica y no un dato.

Los valores guardados son neutros en género (`entero`, `esterilizado`); la etiqueta de lectura es
«Entero/a», «Esterilizado/a». Un dato previo fuera del catálogo se muestra tal cual
(`catalogLabel`), nunca se descarta en silencio.

### D2 — Lo que se deja libre, y por qué

- `breed`: hay cientos de razas y cruces; un catálogo incompleto bloquearía datos reales, y
  «Mestizo»/«Quiltro» ya son la respuesta habitual. Si se quiere estadística por raza, el paso
  siguiente es un campo auxiliar de «grupo de raza», no cerrar este.
- `city` y `origin`: la lista de comunas de Chile (346) y las procedencias cambian; el valor sigue
  siendo útil como texto. `adoptionState` es descriptivo.
- Especies exóticas: fuera de alcance; el `check` y el catálogo se amplían con una migración.

### D3 — RUT: forma canónica y comprobación en tres capas

Se guarda `12345678-5` (sin puntos, `K` en mayúscula). Zod normaliza lo que escribe la persona
(`12.345.678-5`, minúsculas, espacios) con `normalizeRut` y rechaza lo inválido; la base repite la
comprobación con `rut_is_valid` (módulo 11, `immutable`) en un `check`, porque un cliente puede
escribir directo en la tabla. `authenticated` necesita `execute` sobre esa función porque el `check`
se evalúa con sus privilegios; no es un RPC útil y no amplía lo que puede leer.

Es **único por clínica** (`clinical_records_tutor_rut_idx`, índice parcial sobre
`(clinic_id, content->>'rut')`). El alta consulta antes (`findTutorByRut`) para dar un mensaje junto
al campo con el nombre del tutor existente; si esa consulta falla, manda el índice único.

### D4 — `not valid`, como en la 017

Los `check` nuevos rigen para lo que se inserte o actualice, no revisan filas previas, y nunca se
ejecuta `validate constraint`. Consecuencia conocida: un `UPDATE` de un paciente o tutor antiguo
que no cumpla (p. ej. un tutor sin RUT) falla hasta corregirlo, y `listTutors`/`listPatients`
omiten (con log) las filas que ya no pasan Zod. Los entornos de prueba y demostración no tienen
datos antiguos: se reconstruyen con `supabase db reset`.

### D5 — Formularios: opciones, no texto

Especie, sexo y estado reproductivo usan `OptionPicker` (ya accesible por teclado y lector de
pantalla) en el mismo lugar del formulario; el error sale junto al grupo. Sus `testID` son
`patient-species-<valor>`, etc.

### D6 — Clínica de demostración por los servicios reales

`provision-demo-data.ts` inicia sesión como cada veterinario del fixture y llama a
`createTutor`, `createPatientFicha`, `openConsultation` y `recordAnamnesisEntry`: pasa por Zod,
los triggers de atribución y los `check`, igual que la interfaz. No toca el rol de servicio y
rechaza un Supabase no local. Es idempotente por rechazo: si el primer tutor demo ya existe, sale
sin escribir. Los datos se reconocen como sintéticos (correos `@example.test`, teléfonos `+56 9 5550`
y RUT sobre cuerpos `5.000.0NN`), no por un sufijo en los nombres.

### D7 — Un solo conjunto de veterinarios

El fixture de e2e e integración (`veterinarians.json`) pasa a tres veterinarios y es también el de
la demostración: no hay un segundo conjunto de cuentas que mantener.

## Risks / Trade-offs

- Los `check` estrictos obligan a que toda fila escrita en pruebas sea válida: las suites pgTap
  001–017 y las pruebas de integración y e2e que escriben contenido mínimo se actualizaron
  (`patientContent`, `randomRut` en `tests/support/rut.ts`).
- `tutorId` es solo «no vacío» en la base; que apunte a un tutor real lo sigue garantizando el
  servicio. Un trigger de integridad referencial queda para otro cambio.
- `database.types.ts` se editó a mano (el CLI local formatea distinto al de CI); el contenido
  coincide con `supabase gen types`.
- Los cuerpos de RUT sintéticos podrían coincidir con los de una persona real por azar; no se
  guarda ningún otro dato que las identifique.

## Verificación de la constitución

Sin decisión clínica automática ni dependencias nuevas. Los datos de demostración son sintéticos y
nunca se cargan contra un backend no local sin `--allow-remote`. El RUT es dato personal: se
muestra seleccionable y nunca va a logs (los eventos solo llevan `requestId` y operación).
