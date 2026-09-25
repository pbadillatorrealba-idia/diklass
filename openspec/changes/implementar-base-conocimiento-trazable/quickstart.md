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
| `bun run db:types` + `git diff --exit-code` (RI-1) | stack local | **SIN DIFF** sobre `src/lib/supabase/database.types.ts` (respecto al esquema de esta rama, migraciones 001–010) |
| Unidad (`bun test tests/unit/conocimiento`) tras el merge | local | 53 pass / 0 fail (147 `expect()`) |
| CI de la rama | GitHub Actions | Las corridas de workflow se disparan por PR en este repositorio: el push a la rama no las genera y la URL de la corrida nacerá con la PR que abre el orquestador. La evidencia local completa es la de arriba. |

**Matiz sobre tipos generados (RI-1)**: el «SIN DIFF» cierra RI-1 para el esquema de esta rama
(001–010). Al integrar las ramas hermanas, cuyas migraciones añaden tablas (p. ej. la `011` de
captura de voz), volverá a hacer falta `bun run db:types` sobre el esquema combinado: lo ejecuta
quien integre, al cerrar el conjunto.

## Correcciones de la revisión (PR #30, veredicto «Con correcciones»)

| # | Hallazgo | Fix | Evidencia |
|---|---|---|---|
| 1 | El contexto conversacional sobrevivía al cierre/expiración de sesión | `conversation-store.ts` se suscribe al ciclo de `useSessionStore` y hace `reset()` al dejar de haber sesión activa | tests de unidad «ciclo de sesión» (expiración y logout): 58 pass / 0 fail |
| 2 | La superficie de revisión no mostraba quién retiró la fuente ni cuándo | `sources/index.tsx` y el visor muestran `AttributionBadge` del retiro (`withdrawn_by`/`withdrawn_at` con fecha y hora completas) | `bun run typecheck` + `expo export` verdes; los datos ya se exponían por `listSources`/`getSource` (integración viva) |
| 3 | «Ver documento» sin cita mostraba solo el fragmento 1 | `buildFragmentContext(documento, null)` devuelve el documento completo desde el inicio | test de unidad «sin fragmento citado…» (rojo→verde) |
| 4 | El top-5 descartaba evidencia calificada en silencio | aviso `evidencia_truncada` cuando hay más calificados que referencias mostradas | test de unidad «declara el descarte» (rojo→verde) |
| 5 | La retirada podía reescribir la PK de la fuente | la guarda compara también `id` (`KNOWLEDGE_SOURCE_IMMUTABLE`) | assert pgTap: «la retirada no puede reescribir la identidad» — rojo «caught: no exception» (y corrompió el fixture aguas abajo, demostrando el alcance) → verde 33/33 |
| 6 | Citas irresolubles al reconstruir; `answer` fabricable por cliente | aviso `cita_irresoluble` (sin heredar estado guardado) + CHECK SQL de forma mínima de `answer` con su riesgo residual y reverso declarados en `design.md` D6 | test de unidad «cita que ya no resuelve…» + assert pgTap «una respuesta sin la forma del contrato no se registra» (rojo «no exception» → verde) |
| 7 | Faltaba el presupuesto de recuperación ≤ 500 ms | aserción temporal sobre `search_knowledge_fragments` en `consulta.test.ts` | integración viva: 14 pass / 0 fail (92 `expect()`) |
| 8 | Ternario no-op de `anio`, NaN posible, mensaje de Zod en inglés | `parsearEntero` sin NaN + error derivado en español («Año de publicación inválido.») que deshabilita el envío | `bun run typecheck` + `expo export` verdes |
| 9 | Ficha ilegible ⇒ aviso `sin_paciente_seleccionado` con `patient_id` no nulo | el contexto se conserva (`ficha_no_disponible`) y fila/respuesta comparten `answer.patientId` como única verdad | test de unidad «paciente seleccionado sin ficha legible…» (rojo→verde) |

Verificación global tras las correcciones: pgTap **170 asserts «All tests successful»** (suite `009`
con 33), unidad 58 pass / 0 fail, integración viva 14 pass / 0 fail con el arnés estable
(SC-002 100%, SC-025 100%, 0 incumplimientos sobre 16 citas), `bun run typecheck` limpio y
`bunx biome check` sin advertencias sobre los archivos propios.

## Evidencia de la revisión de la PR #30 (2026-09-24, tareas 7.x)

Ejecutado en local sobre la rama con Supabase local (`DOCKER_HOST` al socket rootless de podman),
`supabase db reset` desde este worktree y los veterinarios sintéticos provisionados con
`bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json`:

| Compuerta | Comando | Resultado |
|---|---|---|
| Lint estricto | `bunx biome ci --error-on-warnings .` | verde (152 archivos) |
| Tipos | `bun run typecheck` | verde |
| pgTap | `supabase db reset && supabase test db` | 193 aserciones en 11 archivos, «All tests successful» (nueva suite `010_base_conocimiento_revision.sql`: 20) |
| Tipos generados | `bun run db:types` + `git diff` | sin diff tras regenerar (incluye `knowledge_fragments` y `terminos_pregunta`) |
| Unidad | `SUPABASE_LIVE_TESTS= bun run test` | 265 pass, 57 skip (vivas), 0 fail |
| Integración viva | `SUPABASE_LIVE_TESTS=1 bun run test:integration` | 53 pass, 0 fail (conocimiento: 16) |
| Web e2e (Chromium) | `bunx playwright test --project=chromium` | 21 pass, 0 fail (incluye `conocimiento.spec.ts`: 3) |

Rojos observados antes de cada arreglo:

| Tarea | Prueba | Rojo |
|---|---|---|
| 7.1 | pgTap «el ranking puntúa el lexema «ansied»» | `rank_cd = 0` (`to_tsquery('spanish', '''ansied''')` → `'ansi'`) |
| 7.2 | pgTap corte con `p_limit = 1` | have `(e1e1…0002, 1)`, want `(e1e1…0003, 1)` |
| 7.3 | cinco aserciones pgTap de forma · unidad de lectura tolerante | «caught: no exception» ×5 · `ZodError` («expected number, received string») que tumbaba la consulta |
| 7.4 | tres aserciones pgTap del paciente de contexto (con la 010 anterior) | «no exception» (paciente ajeno), «no exception» (tutor como paciente), `23503` de la FK (inexistente) |
| 7.5 | e2e «la colección refleja al momento…» | la fuente recién incorporada no aparece a los 5 s (lista servida de caché) |
| 7.6 | e2e «pulsar Enter otra vez con la consulta en curso…» | 2 turnos con la misma pregunta |
| 7.7 | pgTap `terminos_pregunta` · unidad `answer`/`consulta-service` | columna inexistente · `noCubiertos = ["tratamient"]` en vez de `["tratamiento"]` |
| 7.8 | pgTap de materialización | relación `public.knowledge_fragments` inexistente |
| 7.9 | e2e «una fuente inexistente o ilegible…» | `fuente-no-encontrada` ausente: «Cargando la fuente…» indefinido |
| 7.10 | `tests/unit/scripts/corpus-conocimiento.test.ts` | módulo `scripts/lib/corpus-conocimiento` inexistente |

Coste de la recuperación (7.8), medido con 10 000 fragmentos sintéticos (20 fuentes × 500) en una
transacción revertida:

| Consulta | Tiempo | Plan |
|---|---|---|
| Antes: `ts_debug` sobre cada fragmento de `content` en cada pregunta | 78,6 ms | recorrido completo del corpus |
| Después: `vector @@ tsquery` sobre `knowledge_fragments` | 4,3 ms | `Bitmap Index Scan on knowledge_fragments_vector_idx` |

Guion del corpus (7.10), ejecutado contra el stack local: sin `CORPUS_VET_EMAIL` sale con código 1
(«Falta CORPUS_VET_EMAIL…»); con `SUPABASE_URL=https://abcd.supabase.co` sale con código 1 («no es
un Supabase local…»); con las credenciales sintéticas de Ana incorpora el corpus completo.

## Pendientes cerrados (2026-09-25, tareas 7.12 y 8.x)

Rama `feat/003-pendientes` sobre `main` (`4513f95`, specs 001–005 mergeadas), stack local. Las
compuertas se repitieron tras mergear `origin/main` (migración 013 y arreglo de `auth.spec.ts` de
la PR #33); la tabla recoge esa corrida.

| Pendiente | Commit | Prueba | Rojo observado |
|---|---|---|---|
| 7.12 visor: sesión caducada ≠ fuente inexistente | `cb25ae1` | unidad `getSource` (3 casos) · e2e «con la sesión de acceso caducada el visor pide reautenticación…» | unidad: 2 fail (devolvía `null` sin consultar `is_active_access`) · e2e: «No se encontró la fuente en la colección de tu clínica.» y ningún diálogo «Sesión expirada» |
| RI-2 enlace en `/home` (8.1) | `28d9084` | e2e «el panel clínico enlaza con la base de conocimiento» | `getByTestId('home-knowledge')` inexistente (timeout) |

El e2e de 7.12 envejece solo la sesión de acceso de su página con la service role (patrón de
`auth.spec.ts`) y responde `true` a `touch_access_session` para que el rastreador de actividad no
abra el diálogo por su cuenta: así el diálogo solo puede venir del visor.

| Compuerta | Comando | Resultado |
|---|---|---|
| Lint estricto | `bunx biome ci --error-on-warnings .` | verde (199 archivos) |
| Tipos | `bun run typecheck` | verde |
| pgTap | `supabase db reset && supabase test db` | 288 aserciones en 15 archivos (migraciones 001–013), «All tests successful» (sin SQL nuevo en esta rama) |
| Tipos generados | `bun run db:types` + `git diff` | sin diff |
| Unidad | `SUPABASE_LIVE_TESTS= bun run test` | 388 pass, 75 skip (vivas), 0 fail |
| Unidad + vivas | `bun run test` (con `SUPABASE_LIVE_TESTS=1`) | 453 pass, 0 fail |
| Integración viva | `bun run test:integration` | 69 pass, 0 fail |
| Web e2e (Chromium) | `bunx playwright test --project=chromium` | 28 pass, 0 fail (`conocimiento.spec.ts`: 5) |

## Transiciones sin acción enumerada (D3 · tarea 1.3)

Las transiciones de fuente (incorporar/retirar) devuelven `Attribution.action = null`: la
enumeración taxativa de FR-063 no tipifica fuentes (`document`) y **no se escribe** en
`clinical_audit_events`. La atribución —quién y cuándo— vive en las columnas de la fila
(`created_by`/`created_at`, `withdrawn_by`/`withdrawn_at`), la sella el trigger
`guard_knowledge_source_lifecycle` (rechazando toda atribución enviada por cliente con
`ATTRIBUTION_IMMUTABLE`) y es visible al revisar la colección (US5-AC13). Cada transición emite
además `log_server_event('knowledge_source_lifecycle', …)` (Constitución IV).

## Pendientes declarados

- **Corpus real y conjunto anotado del equipo clínico** (sustituyen los sintéticos; HD7).
- **Aceptación humana**: SC-003 por revisión manual de referencias; SC-015 con ≥ 3 especialistas
  sobre ≥ 5 casos; SC-002 medido sobre el conjunto real.
- **Verificación visual interactiva** de las pantallas nuevas y **e2e funcional web** completo:
  `tests/e2e/web/conocimiento.spec.ts` cubre cinco pruebas acotadas (caché y retiro confirmado,
  visor sin cuelgues, un envío por consulta, enlace desde `/home` y visor con la sesión
  caducada); el resto del recorrido lo cargan pgTap y la integración viva.

RI-2 (tarea 8.1) y la sesión caducada en el visor (tarea 7.12) se cerraron el 2026-09-25 (sección
«Pendientes cerrados»).
