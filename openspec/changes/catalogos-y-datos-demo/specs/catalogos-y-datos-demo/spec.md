## ADDED Requirements

### Requirement: FR-124 Vocabularios cerrados del paciente

El sistema MUST aceptar como `species` solo `canino` o `felino`, como `sex` solo `macho` o `hembra`
y como `reproductiveStatus` solo `entero` o `esterilizado`, y MUST rechazar cualquier otro valor
tanto en la validación de contenido como en la base de datos. `name`, `breed` y `tutorId` MUST ser
no vacíos también en la base. El formulario de la ficha MUST ofrecer especie, sexo y estado
reproductivo como grupos de opciones etiquetados, con el error junto al grupo, y las lecturas
MUST mostrar la etiqueta legible («Canino», «Hembra», «Esterilizado/a»).

#### Scenario: valor fuera del catálogo

- **GIVEN** un cliente que escribe directo en `clinical_records`
- **WHEN** inserta un paciente con `species` «perro» o `sex` «M»
- **THEN** la base lo rechaza.

#### Scenario: alta con opciones

- **GIVEN** el formulario «Registrar paciente»
- **WHEN** se eligen Canino, Macho y Esterilizado/a y se completan los demás obligatorios
- **THEN** la ficha guarda `canino`, `macho` y `esterilizado` y la lectura muestra las etiquetas.

#### Scenario: falta una opción

- **GIVEN** el formulario sin elegir la especie
- **WHEN** se envía
- **THEN** no se crea nada y el error de especie aparece junto al grupo.

### Requirement: FR-125 RUT del tutor

El sistema MUST exigir un RUT en cada tutor nuevo o editado: válido por dígito verificador
(módulo 11), aceptado con o sin puntos y guion, en mayúsculas o minúsculas, y guardado en forma
canónica (`12345678-5`). La base de datos MUST rechazar un tutor sin RUT válido y MUST garantizar
que el RUT sea único dentro de la clínica. El RUT MUST mostrarse en la ficha y en la lista de
tutores (formato `12.345.678-5`), y la búsqueda por contacto MUST encontrarlo escrito con o sin
puntos.

#### Scenario: dígito verificador erróneo

- **GIVEN** el formulario de tutor con nombre, contacto y RUT `12345678-4`
- **WHEN** se envía
- **THEN** no se crea nada y el error «Registra un RUT válido» aparece junto al campo.

#### Scenario: normalización

- **GIVEN** el RUT `12.345.678-5` escrito con puntos
- **WHEN** se guarda el tutor
- **THEN** el contenido guarda `12345678-5` y la ficha muestra `12.345.678-5`.

#### Scenario: búsqueda con puntos

- **GIVEN** un tutor con RUT `12345678-5`
- **WHEN** se busca «12.345.678-5» por contacto
- **THEN** aparece ese tutor.

### Requirement: FR-126 RUT repetido bloquea el alta

El sistema MUST impedir dar de alta un tutor cuyo RUT ya exista en la clínica, nombrando al tutor
existente junto al campo del RUT, tanto desde «Registrar tutor» como desde «Registrar paciente»
con tutor nuevo. Si la comprobación previa falla, el índice único de la base MUST impedirlo igual.
Un teléfono o correo repetido MUST seguir solo avisando (FR-122).

#### Scenario: RUT repetido

- **GIVEN** un tutor con RUT `12345678-5`
- **WHEN** se intenta registrar otro tutor con ese RUT
- **THEN** no se crea nada y el error nombra al tutor existente.

### Requirement: FR-127 Clínica de demostración

El repositorio MUST ofrecer `bun run provision:demo`, que carga 15 tutores, 25 pacientes (perros y
gatos) y 8 consultas con anamnesis, con nombres y apellidos comunes en Chile, escribiendo con la
sesión de cada veterinario del fixture a través de los servicios de la aplicación. Los datos MUST
reconocerse como sintéticos (correos `@example.test`, teléfonos `+56 9 5550 xxxx`, RUT sobre
cuerpos `5.000.0NN` con dígito verificador válido). El script MUST rechazar un Supabase no local
salvo `--allow-remote`, MUST NOT duplicar datos si ya están cargados y MUST usar solo valores de
los catálogos. `bun run demo:reset` MUST reconstruir la base local desde cero (`supabase db reset`),
provisionar los veterinarios y cargar la demostración.

#### Scenario: carga

- **GIVEN** una base local recién reiniciada con los veterinarios provisionados
- **WHEN** se ejecuta `bun run provision:demo`
- **THEN** existen 15 tutores, 25 pacientes y 8 consultas, y cada paciente referencia a un tutor.

#### Scenario: segunda ejecución

- **GIVEN** la clínica de demostración ya cargada
- **WHEN** se ejecuta `bun run provision:demo` otra vez
- **THEN** el script lo indica y no escribe nada.

#### Scenario: backend no local

- **GIVEN** un `SUPABASE_URL` que no es local
- **WHEN** se ejecuta el script sin `--allow-remote`
- **THEN** falla antes de escribir.
