# Guía de validación rápida: Base de conocimiento trazable

**Creado**: 2026-09-22 · **Cambio**: `implementar-base-conocimiento-trazable` ·
**Diseño**: [design.md](design.md) · **Tareas**: [tasks.md](tasks.md)

Registro consolidado de la evidencia real de esta ejecución. Diferencia, como exige `AGENTS.md`,
entre verificado por máquina y aceptado: nada de lo que sigue es aceptación de SC.

## Prerrequisitos

- Bun 1.4.0 (`.bun-version`) y dependencias con `bun install --frozen-lockfile`.
- Stack Supabase local (podman): `export DOCKER_HOST=unix:///run/user/1000/podman/podman.sock`.
- **Protocolo de reserva del stack por hub** («reservo stack» / «stack libre»): obligatorio entre
  worktrees hermanos. El 2026-09-22 un `supabase db reset` ajeno borró `knowledge_*` en mitad de
  una corrida viva; el protocolo nació de esa colisión y el orquestador lo arbitra.
- Sin Playwright y sin daemon de Chromium operativo en este entorno (`omp.browser.headed` falla
  con exit=21).

## Guion de verificación local

```sh
export DOCKER_HOST=unix:///run/user/1000/podman/podman.sock
# 1) Reservar el stack por hub y esperar la ventana.
supabase db reset                                              # migraciones 001–010
supabase test db                                               # pgTap 001–009 (166 asserts)
podman exec supabase_db_diklass psql -U postgres -d postgres \
  -c "NOTIFY pgrst, 'reload schema';"                          # PostgREST ve las tablas nuevas
eval "$(supabase status -o env 2>/dev/null \
  | grep -E '^(ANON_KEY|SERVICE_ROLE_KEY|API_URL)=' \
  | sed 's/^API_URL=/SUPABASE_URL=/; s/^ANON_KEY=/EXPO_PUBLIC_SUPABASE_ANON_KEY=/; s/^SERVICE_ROLE_KEY=/SUPABASE_SERVICE_ROLE_KEY=/' \
  | sed 's/^/export /')"
bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json
SUPABASE_LIVE_TESTS=1 bun test tests/integration/conocimiento    # integración viva + arnés
bun run db:types && git diff --exit-code src/lib/supabase/database.types.ts   # RI-1 sin diff
# 2) Anunciar «stack libre» por hub.
```

Compuertas locales acotadas (solo archivos de este cambio, jamás todo el repo):

```sh
bunx biome check --write src/features/conocimiento src/components/conocimiento \
  "src/app/(protected)/knowledge" tests/unit/conocimiento tests/integration/conocimiento \
  tests/fixtures/conocimiento scripts/cargar-corpus-conocimiento.ts
bun run typecheck
bun test tests/unit/conocimiento
bunx expo export --platform web    # smoke de compilación de las rutas nuevas
```

## Integraciones autorizadas por el orquestador (archivos compartidos)

| Archivo | Motivo | Autorización |
|---|---|---|
| `src/lib/supabase/database.types.ts` | **RI-1**: regenerado con `bun run db:types` tras la migración 010 | expresa por hub en FASE 2 (2026-09-22) |
| `supabase/tests/004_function_privileges.sql` (test 23) | **RI-3**: `search_knowledge_fragments(text, integer)` es la décima función ejecutable por `authenticated`; se añadió al array esperado y «nine»→«ten» | expresa por hub en FASE 2 (2026-09-22) |

Ningún otro archivo compartido fue modificado.

## Evidencia de verificación

### Ciclo rojo→verde de la suite pgTap `009` (Constitución II)

| Etapa | Dónde | Resultado |
|---|---|---|
| Rojo — suite `009` sin la migración `010` | stack local (`supabase db reset` con 001–009 + `supabase test db supabase/tests/009_base_conocimiento.sql`) | `ERROR: relation "public.knowledge_documents" does not exist` — los 30 asserts previstos no arrancan, exactamente la razón prevista (objetos inexistentes) |
| Verde — con la migración `010` | stack local (`supabase test db`) | 30/30 en la suite `009`; suites `001`–`008` verdes |
| Rojo — assert 18 de cobertura de lemas (regresión de conjunción estricta en la búsqueda) | stack local | `Failed test 18 … have: 0, want: 2` por la razón prevista: `websearch_to_tsquery` conjuntaba todos los lemas y una palabra ausente anulaba la evidencia |
| Verde — recuperación por unión de lemas | stack local (`supabase test db`) | 31/31 en la suite `009`; total **166 asserts, «All tests successful»** (suites 001–009) |

### Modelos, composición y conversación (tareas 2.1–2.3)

| Etapa | Resultado |
|---|---|
| Rojo previo (`bun test tests/unit/conocimiento`) | 3 archivos fallando por módulos inexistentes (`@/features/conocimiento/{schema,answer,conversation-store}`), la razón prevista |
| Verde | **53 pass / 0 fail** (147 `expect()`), verificado localmente |

### Servicios, corpus sintético y arnés de evaluación (tareas 3.1–3.3)

| Etapa | Resultado |
|---|---|
| Rojo previo | 5 archivos fallando por módulos inexistentes (`coleccion-service`, `consulta-service`, `corpus-loader`), la razón prevista |
| Verde unidad | 53 pass / 0 fail |
| Verde integración viva (stack local, `SUPABASE_LIVE_TESTS=1`) | **14 pass / 0 fail** (90 `expect()`): `coleccion.test.ts` (FR-028, FR-030, FR-053, FR-069, SC-026 · US5-AC6/AC9/AC12/AC13), `consulta.test.ts` (FR-005, FR-006, FR-007, FR-020, FR-021, FR-022, FR-023, FR-026, FR-051, FR-053 · US5) y `evaluacion.test.ts` |

Métricas del arnés sobre **corpus y conjunto sintéticos** (HD7), impresas por la propia corrida:

| Criterio | Resultado | Presupuesto |
|---|---|---|
| SC-002 hit@5 (evidencia esperada entre las primeras 5 referencias) | **100% (8/8)** | ≥ 80% |
| SC-025 ausencia de respaldo declarada (preguntas fuera de dominio) | **100% (5/5)** | 100% |
| SC-010 · SC-003 automática (toda cita resoluble y verbatim) | **0 incumplimientos sobre 16 citas** | 0 |

Estas métricas verifican el **mecanismo** sobre datos sintéticos; no aceptan SC-002/SC-003/SC-015
(corpus real, conjunto del equipo clínico y revisión/evaluación humanas siguen pendientes).

### Interfaz (tareas 4.1–4.2)

- `bun run typecheck` limpio (`tsc --noEmit`, 0 errores).
- `bunx biome check --write` sobre los archivos propios: 28 archivos, 0 advertencias tras retirar
  un import sin uso.
- Smoke de compilación: `expo export --platform web` exporta `/(protected)/knowledge`,
  `/(protected)/knowledge/sources`, `/knowledge/sources/new` y `/knowledge/sources/[id]`
  (≈18 KB c/u); el shell responde HTTP 200 con `<title>Diklass</title>`.
- **Verificación visual interactiva: NO realizada.** El daemon de Chromium del entorno no arranca
  (`omp.browser.headed` failed exit=21) y no hay Playwright. Queda como pendiente declarado, no
  como compuerta cumplida.

### Re-verificación post-merge de 002 (`2fd95ac`) y CI

| Etapa | Dónde | Resultado |
|---|---|---|
| Merge de `feat/002-registro-clinico-longitudinal` (fix `2fd95ac`) | worktree (commit de merge `af91382`) | merge limpio, sin conflictos |
| `supabase db reset` (migraciones 001–010 con el 009 corregido) + `supabase test db` | stack local (ventana reservada por hub) | **168 asserts, «All tests successful»** — suites `001`–`009` verdes, incluida la `009` con 31 asserts |
| Integración viva (`SUPABASE_LIVE_TESTS=1`) | stack local | **14 pass / 0 fail** (90 `expect()`); arnés: SC-002 100% (8/8), SC-025 100% (5/5), SC-010·SC-003 0 incumplimientos sobre 16 citas |
| `bun run db:types` + `git diff --exit-code` (RI-1) | stack local | **SIN DIFF** sobre `src/lib/supabase/database.types.ts` |
| Unidad (`bun test tests/unit/conocimiento`) tras el merge | local | 53 pass / 0 fail (147 `expect()`) |

## Transiciones sin acción enumerada (D3 · tarea 1.3)

Las transiciones de fuente (incorporar/retirar) devuelven `Attribution.action = null`: la
enumeración taxativa de FR-063 no tipifica fuentes (`document`) y **no se escribe** en
`clinical_audit_events`. La atribución —quién y cuándo— vive en las columnas de la fila
(`created_by`/`created_at`, `withdrawn_by`/`withdrawn_at`), la sella el trigger
`guard_knowledge_source_lifecycle` (rechazando toda atribución enviada por cliente con
`ATTRIBUTION_IMMUTABLE`) y es visible al revisar la colección (US5-AC13). Cada transición emite
además `log_server_event('knowledge_source_lifecycle', …)` (Constitución IV).

## Pendientes declarados

- **RI-2**: enlace de navegación a `/knowledge` en `src/app/(protected)/home.tsx` (1–2 líneas; el
  orquestador mantuvo el veto del archivo en FASE 2). Las rutas son alcanzables por URL.
- **Corpus real y conjunto anotado del equipo clínico** (sustituyen los sintéticos; HD7).
- **Aceptación humana**: SC-003 por revisión manual de referencias; SC-015 con ≥ 3 especialistas
  sobre ≥ 5 casos; SC-002 medido sobre el conjunto real.
- **Verificación visual interactiva** de las pantallas nuevas y **e2e funcional web**.
