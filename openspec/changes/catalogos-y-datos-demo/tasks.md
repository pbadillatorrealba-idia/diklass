Estado: lo marcado `[x]` está **implementado y verificado con la prueba indicada**; ninguna marca
es aceptación. Lo pendiente queda sin marcar.

## 1. Catálogos y RUT en el código (FR-124, FR-125)

- [x] 1.1 `tests/unit/registro/rut.test.ts` (dígito verificador incluidos K y 0, normalización,
  rechazo, formato) y `src/lib/rut.ts`. Verificación: 4/4 en verde.
- [x] 1.2 `src/features/registro/catalogs.ts`; `species`/`sex`/`reproductiveStatus` como `z.enum` y
  `rut` obligatorio en `tutorContentSchema`. Verificación: `schema.test.ts` (catálogo, RUT) en verde.
- [x] 1.3 Formularios: `OptionPicker` para los tres catálogos en `ficha-form`, campo RUT en
  `tutor-form`, etiquetas en lecturas y tablas, columna RUT, búsqueda «RUT, teléfono o correo».
  Verificación: `tutor-form.test.ts`, `tutors-table.test.tsx`, Biome y `tsc`.
- [x] 1.4 `findTutorByRut` y su uso en `tutors/new.tsx` y `patients/new.tsx` (FR-126).
  Verificación: `tutor-search.test.ts` (exacto, excluye al propio, falla → null).

## 2. Base de datos (FR-124–FR-126)

- [x] 2.1 `supabase/tests/018_catalogos_y_rut.sql` (14): `rut_is_valid`, RUT obligatorio, inválido y
  único, catálogos y obligatorios del paciente, búsqueda con puntos. Verificación: en verde.
- [x] 2.2 Migración `018_catalogos_y_rut.sql` (checks `not valid`, `rut_is_valid`, índice único,
  `search_tutors` con RUT) y `database.types.ts`. Verificación: 2.1 y la suite completa
  (19 archivos, 334 tests) en verde; 004 actualizado a 14 funciones.
- [x] 2.3 Fixtures de pgTap 001–017 con contenido válido. Verificación: suite completa en verde.

## 3. Datos de demostración (FR-127)

- [x] 3.1 `scripts/demo/datos-demo.ts` (15 tutores, 25 pacientes, 8 consultas) y
  `scripts/provision-demo-data.ts`; `provision:demo` y `demo:reset`; tercer veterinario en el
  fixture. Verificación: `bun run demo:reset` carga «15 tutores, 25 pacientes y 8 consultas» y una
  segunda ejecución no escribe.
- [x] 3.2 `SETUP.md`.

## 4. Pruebas existentes y limpieza

- [x] 4.1 Valores antiguos (`perro`, `gato`, `esterilizada`, `entera`, `castrado`, `Hembra`…)
  reemplazados por los del catálogo en unitarias, integración y e2e; `randomRut`/`patientContent` en
  `tests/support/rut.ts`. Verificación: unit 1020+ en verde, integración viva 74/74, e2e Chromium
  (tutores, ficha-etologica, attribution, auth, accessibility, estados, navegacion, login, tema,
  perfil, consulta-formulario, registro-epicrisis, conocimiento, retroalimentacion) en verde.
- [x] 4.2 Base local reconstruida (`supabase db reset`): sin datos anteriores.
- [ ] 4.3 Verificar a mano en navegador el alta de paciente con las opciones y el alta de tutor con
  RUT a 1280, 768 y 375 px, y axe en modo oscuro.
- [ ] 4.4 `bun run lint`, `tsc --noEmit`, unit, pgTap y e2e web completos en CI; registrar la URL.
  Hasta entonces este cambio no está aceptado.
