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
- [x] 1.4 `database.types.ts` (editado a mano) coincide con `bun run db:types`. Verificación: tras
  `supabase db reset --local` (migraciones 001–015), `gen types` con la CLI 2.122.0 y ambos
  archivos pasados por `oxfmt`; solo difieren el ajuste de línea y el ruido de versión de la CLI
  (`ComputedFields: never`, `NonNullable<Json>`, `Args: Record<PropertyKey, never>`, `vector`).
  Tablas, columnas y firmas de funciones (incluida `search_patients`) son idénticas. El `diff -u`
  byte a byte de CI queda por confirmar en la PR.

## 2. Interfaz de la lista y del tutor (FR-113–FR-116)

- [x] 2.1 `patients-table` (tabla ↔ tarjetas) y `patients/index.tsx` con filtros, orden y página en
  la URL. Verificación: Biome y `tsc` limpios.
- [x] 2.2 `tutors/[id].tsx` mínima. Verificación: Biome y `tsc` limpios.
- [x] 2.3 Verificado a 1280, 768 y 375 px con axe en claro y oscuro, y e2e de `accessibility.spec.ts`
  y `estados.spec.ts` actualizados (este último en `acafe4f`). Verificación: ambos en verde en `chromium` y `chromium-dark`
  (workers=1); el caso de la lista crea sus propios pacientes con `prepararPaciente`.

## 3. Ficha por cards (FR-117, FR-118, FR-002, FR-044)

- [x] 3.1 `patient-record.tsx` (cabecera, `EditableCard`, `ageLabel`) y `FichaForm` con `fields`;
  `tests/unit/registro/patient-record.test.ts` (edad calculada). Verificación: en verde.
- [x] 3.2 `antecedents-panel` en una card con alta en línea y chips; `recordedAt` opcional en el
  esquema y fijado por `addAntecedentItem`; `ficha-service.test.ts` actualizado.
  Verificación: `bun test tests/unit/registro` en verde (164).
- [x] 3.3 `patient-history` como línea de tiempo; retirados `ficha-summary` y
  `missing-fields-panel` y sus pruebas. Verificación: `tsc` limpio.
- [x] 3.4 Verificado en navegador (Chromium, export estático, 921 px de ancho): la edición por card
  guarda y vuelve al resumen (peso 12.5 → 13 kg); el alta de antecedentes con Enter añade el ítem y
  deja el campo abierto y vacío; con `clinical_records` bloqueado la ficha muestra el error con
  «Reintentar», que recupera la ficha al quitar el bloqueo. «Cargando…» lo cubre `estados.spec.ts`.
  Observado, no atribuido a este cambio: error de hidratación React #418 al cargar la ficha en el
  export estático.

- [x] 3.5 Resumen en grupos con «Alertas», `DataItem`/`DataGroup`/`Chip` en `ui/`, estados de
  la ficha con `QueryState` y `Callout`; `AGENTS.md` actualizado. Verificación: Biome, `tsc` y
  `bun test tests/unit` en verde (977).

## 4. Navegación (FR-083, FR-079)

- [x] 4.1 `Screen`: `back.crumbs`, breadcrumb desde 1024 px en web y prop `action`; breadcrumb en
  fuentes de conocimiento y en la consulta. Verificación: `tests/unit/ui/screen-title.test.tsx`.
- [x] 4.3 Acción principal en barra al pie bajo 768 px y en nativo (`Screen`).
  Verificación: `tests/unit/ui/screen-title.test.tsx`.
- [x] 4.2 e2e: ficha fuera del caso de «2 columnas», `antecedent-open` en `caso-sintetico.ts` y caso
  del breadcrumb a 1280 px (y solo «Volver» a 375 px) en `navegacion.spec.ts`. Verificación:
  e2e web completo, 77/77 en `chromium` (workers=1), sobre el merge con `main`, con los casos de lista y
  breadcrumb incluidos.

- [x] 4.4 Búsqueda de pacientes con tutor «nombre apellido» (migración 016, con la nota de
  rendimiento de los joins), ids de la URL que no son UUID resueltos como «no encontrado»
  (`isUuid`), «Registrar paciente» como `action` de `Screen`, y pruebas de `PatientsTable`,
  `DataItem` y `isUuid`. Verificación: Biome, `tsc` y `bun test tests/unit/registro tests/unit/ui`.

## 5. Cierre

- [x] 5.1 `bun run lint`, `tsc --noEmit`, unit, pgTap y e2e web completos; registrar evidencia y
  URL de CI.
  Evidencia local (2026-10-26), sobre el merge con `main` y migraciones 001–018: Biome y `tsc`
  limpios; unit 1020/1020; pgTap 337/337; e2e web `chromium` 77/77.
  CI: https://github.com/pbadillatorrealba-idia/diklass/actions/runs/40335037410 (Auditoría de
  dependencias, Calidad y tipos, Unit e integración, y pgTap + e2e web con Supabase: todos en verde;
  incluye el paso «tipos generados = migraciones», que confirma 1.4). Firefox/WebKit solo corren al
  hacer push a `main`.
- [x] 5.3 Diagnóstico del error de hidratación React #418 (observado en 3.4). Verificación: sobre el
  export estático (2026-10-26), la carga completa de cualquier ruta dinámica lo dispara una vez
  (`/patients/[id]`, `/follow-up/[id]`, `/tutors/[id]`, `/consultations/[id]`,
  `/knowledge/sources/[id]`) y ninguna ruta estática (`/patients`, `/home`, …). Los HTML
  pre-renderizados de todas las rutas son idénticos y vacíos, y `follow-up/[id]` existe desde
  sistema-visual 7.2 (2026-09-25): **es anterior a este cambio y general a las rutas dinámicas**, no
  de la ficha. React recupera regenerando el árbol en el cliente; no hay efecto visible y el e2e
  pasa. No se corrige aquí: la causa exacta (parámetros de ruta en el primer render del cliente)
  queda sin aislar y merece su propio cambio si se quiere eliminar el aviso.
- [x] 5.2 Notas de revisión de FR-044, FR-079, FR-083 y D12/D18 añadidas en
  `implementar-registro-clinico-longitudinal` y `sistema-visual`. Verificación: lectura de los
  textos. Queda pendiente D20/quickstart 12.9 (`FichaSummary`), que es evidencia histórica y no se
  reescribe.
