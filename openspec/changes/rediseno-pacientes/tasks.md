Estado: lo marcado `[x]` está **implementado y verificado con la prueba indicada**; ninguna marca
es aceptación. Lo pendiente queda sin marcar.

## 1. Lista de pacientes en el servidor (FR-113–FR-115)

- [x] 1.1 `supabase/tests/015_busqueda_pacientes.sql` (pgTap, 11 casos): alcance por clínica, orden
  asc/desc, última visita con nulos al final, filtros de nombre/raza/tutor, rango, comodín literal,
  nombre del tutor y `total_count`. Verificación: 11/11 en verde.
- [x] 1.2 Migración `015_busqueda_pacientes.sql` (`search_patients`, `security invoker`, grants).
  Verificación: 1.1 en verde.
- [x] 1.3 `src/features/registro/patient-search.ts` y `database.types.ts`; `tests/unit/registro/
  patient-search.test.ts` (mapeo de argumentos, fechas inválidas, propagación de error).
  Verificación: `bun test tests/unit/registro` en verde.
- [ ] 1.4 Comprobar que `database.types.ts` (editado a mano) coincide con `bun run db:types`
  formateado como en CI.

## 2. Interfaz de la lista y del tutor (FR-113–FR-116)

- [x] 2.1 `patients-table` (tabla ↔ tarjetas) y `patients/index.tsx` con filtros, orden y página en
  la URL. Verificación: Biome y `tsc` limpios.
- [x] 2.2 `tutors/[id].tsx` mínima. Verificación: Biome y `tsc` limpios.
- [ ] 2.3 Verificar en navegador a 1280, 768 y 375 px, con axe claro/oscuro, y actualizar los e2e de
  `accessibility.spec.ts` y `estados.spec.ts` que cubren la lista (`patient-item`, `patient-open`).

## 3. Ficha por cards (FR-117, FR-118, FR-002, FR-044)

- [x] 3.1 `patient-record.tsx` (cabecera, `EditableCard`, `ageLabel`) y `FichaForm` con `fields`;
  `tests/unit/registro/patient-record.test.ts` (edad calculada). Verificación: en verde.
- [x] 3.2 `antecedents-panel` en una card con alta en línea y chips; `recordedAt` opcional en el
  esquema y fijado por `addAntecedentItem`; `ficha-service.test.ts` actualizado.
  Verificación: `bun test tests/unit/registro` en verde (164).
- [x] 3.3 `patient-history` como línea de tiempo; retirados `ficha-summary` y
  `missing-fields-panel` y sus pruebas. Verificación: `tsc` limpio.
- [ ] 3.4 Verificar en navegador la edición por card, el alta de antecedentes con Enter y los
  estados de carga y error de la ficha.

- [x] 3.5 Resumen en grupos con «Alertas», `DataItem`/`DataGroup`/`Chip` en `ui/`, estados de
  la ficha con `QueryState` y `Callout`; `AGENTS.md` actualizado. Verificación: Biome, `tsc` y
  `bun test tests/unit` en verde (977).

## 4. Navegación (FR-083, FR-079)

- [x] 4.1 `Screen`: `back.crumbs`, breadcrumb desde 1024 px en web y prop `action`; breadcrumb en
  fuentes de conocimiento y en la consulta. Verificación: `tests/unit/ui/screen-title.test.tsx`.
- [x] 4.3 Acción principal en barra al pie bajo 768 px y en nativo (`Screen`).
  Verificación: `tests/unit/ui/screen-title.test.tsx`.
- [ ] 4.2 e2e: quitar la ficha del caso de «2 columnas» (hecho en `accessibility.spec.ts`),
  reemplazar los `testID` de alta de antecedentes por `antecedent-open` en `caso-sintetico.ts`
  (hecho) y **ejecutarlos** (workers=1). Añadir un caso del breadcrumb a 1280 px.

- [x] 4.4 Búsqueda de pacientes con tutor «nombre apellido» (migración 016, con la nota de
  rendimiento de los joins), ids de la URL que no son UUID resueltos como «no encontrado»
  (`isUuid`), «Registrar paciente» como `action` de `Screen`, y pruebas de `PatientsTable`,
  `DataItem` y `isUuid`. Verificación: Biome, `tsc` y `bun test tests/unit/registro tests/unit/ui`.

## 5. Cierre

- [ ] 5.1 `bun run lint`, `tsc --noEmit`, unit, pgTap y e2e web completos; registrar evidencia y
  URL de CI. Hasta entonces este cambio no está aceptado.
- [x] 5.2 Notas de revisión de FR-044, FR-079, FR-083 y D12/D18 añadidas en
  `implementar-registro-clinico-longitudinal` y `sistema-visual`. Verificación: lectura de los
  textos. Queda pendiente D20/quickstart 12.9 (`FichaSummary`), que es evidencia histórica y no se
  reescribe.
