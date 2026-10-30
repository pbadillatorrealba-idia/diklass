# Tasks

Trazabilidad: la retirada de FR-018, 024, 039–043, 056, 057 y 070 (`retroalimentacion-clinica`) y de
FR-077 (`sistema-visual`) se cubre en 1–3; las modificaciones de FR-082, 083, 085 y 086 en 1 y 2.
En cada grupo, el test o el grep que debe fallar va antes del cambio.

## 1. Navegación y rutas

- [x] 1.1 Ajustar primero `tests/unit/navigation/nav-item.test.tsx` y los e2e `navegacion`, `accessibility`, `estados` y `tema` para que esperen tres secciones y no recorran `/follow-up` (FR-082, FR-083, FR-085); verificar que fallan antes del cambio.
- [x] 1.2 Quitar la sección `(follow-up)` de `src/components/navigation/sections.ts` y `section-stack.tsx` y borrar `src/app/(protected)/(follow-up)/`; verificar con `bun run typecheck` y los tests de navegación en verde.
- [x] 1.3 Quitar `/follow-up` de `supabase/functions/_shared/routes.ts` y del prompt de `supabase/functions/agent/agent.ts`, con su test de rutas si existe; verificar con el test focalizado de la función.

## 2. Módulo de retroalimentación y severidad

- [x] 2.1 Borrar `src/components/retroalimentacion/`, `src/features/retroalimentacion/`, `src/components/ui/severity-badge.tsx` y sus tests unitarios, de integración y e2e (`tests/unit/retroalimentacion/`, `tests/unit/ui/severity-badge.test.tsx`, `tests/integration/retroalimentacion/`, `tests/e2e/web/retroalimentacion.spec.ts`); verificar con `grep -rn "retroalimentacion\|SeverityBadge" src tests` sin resultados fuera de comentarios revisados.
- [x] 2.2 Limpiar las referencias residuales de `src/components/registro/` (`patient-record.tsx`, `labels.ts`), `src/features/registro/summaries.ts` (comentario de la 005) y `tests/unit/ui/historiales-estados.test.tsx`, `screen-title.test.tsx`, `correction-line.test.tsx`; verificar con `bun run typecheck` y Biome.
- [x] 2.3 Quitar la retroalimentación de `tests/e2e/web/caso-sintetico.ts` (insert REST de `clinical_feedback`, evento y testIDs `feedback-*`); verificar con `bun run test:e2e:smoke` en un worker.

## 3. BD sin cambios

- [ ] 3.1 Confirmar que la BD queda igual: `bun run db:types` no cambia `database.types.ts` y `supabase test db` mantiene en verde `012_retroalimentacion_clinica.sql` y `028_endurecimiento_auditoria.sql`.

## 4. Datos demo

- [x] 4.1 Reconciliar el cambio activo `dataset-clinico-trazable` (spec, proposal, design y tasks: 6 retroalimentaciones → ninguna) con `openspec-update-change`; verificar con `openspec validate dataset-clinico-trazable`.
- [x] 4.2 Ajustar primero `tests/unit/scripts/datos-demo.test.ts` y `tests/integration/registro/demo.test.ts` para que esperen cero retroalimentaciones; luego quitar `feedback` de `scripts/demo/datos-demo.ts`, `metadata-demo.ts`, `cargar-demo.ts` y `validar-demo.ts` y regenerar `contratos-demo.json` con `bun scripts/demo/contratos-demo.ts`; verificar con `bun run demo:check`.

## 5. Documentación y CI

- [x] 5.1 Actualizar `DESIGN.md` (barra inferior y navegación), `PRODUCT.md` y `docs/brief-poc-cdss.md` (fila de la spec 005) y quitar las rutas de `src/features/retroalimentacion/**` de `.github/workflows/dataset-demo.yml`; verificar con `grep -rn "follow-up\|features/retroalimentacion" DESIGN.md PRODUCT.md docs .github` solo con menciones intencionales.
- [x] 5.2 Revisar la narrativa de `sistema-visual` y `retroalimentacion-clinica` (US13, US14 y texto fuera de los requisitos) y registrar los restos que el sync no cubre; verificar con `openspec validate eliminar-seguimiento --strict`.

## 6. Cierre de la PR

- [ ] 6.1 Con `marca-movil-sin-barra` archivado antes (comparte FR-082), ejecutar `bun run gate`, `supabase test db` y los e2e web completos de uno en uno con un worker; verificar con todo en verde.

## Workflow follow-up

- Archivar `marca-movil-sin-barra` antes del sync de este cambio.
- Sync de specs y archivo de `eliminar-seguimiento` tras la aprobación de la PR; reenviar la función `agent`.
