# Guía de validación rápida: Asistencia clínica proactiva

**Creado**: 2026-09-22 · **Cambio**: `implementar-asistencia-clinica-proactiva` ·
**Diseño**: [design.md](design.md) · **Tareas**: [tasks.md](tasks.md)

Registro consolidado de la evidencia real de esta ejecución. Diferencia, como exige `AGENTS.md`,
entre verificado por máquina y aceptado: nada de lo que sigue es aceptación de SC.

## Prerrequisitos

- Bun 1.4.0 (`.bun-version`) y dependencias con `bun install --frozen-lockfile`.
- **pgTap local**: clúster PostgreSQL 18 scratch en `/tmp/verify-006/` (fuera del repo), patrón
  del quickstart de 002 y del clúster `/tmp/verify-003` de 003. Nunca `supabase start` para
  pgTap: las ramas hermanas compiten por puertos. El árbol se arma sin root con los `.deb` del
  mirror de Ubuntu:

  ```sh
  mkdir -p /tmp/verify-006 && cd /tmp/verify-006
  apt-get download postgresql-18 postgresql-18-pgtap    # pgtap 1.3.4, server 18.6
  mkdir -p dist && for d in *.deb; do dpkg-deb -x "$d" dist; done
  ```

  Shims (`/tmp/verify-006/shims.sql`, en este orden) — equivalen al bootstrap de Supabase que
  las migraciones asumen:

  1. Roles de API: `anon`, `authenticated` y `service_role nologin bypassrls` (el BYPASSRLS es
     lo que distingue a `service_role` en la plataforma; sin él, el assert «no-owner flag» de la
     suite 002 ejercita una actualización de 0 filas).
  2. Privilegios por omisión al modo Supabase: `alter default privileges in schema public grant
     all on tables/sequences/functions` a los tres roles (004/005/010 endurecen después con
     revokes selectivos).
  3. Esquema `extensions` con `citext`, `pgcrypto` y **`pgtap`** (en `extensions`, como
     Supabase: 005 revoca EXECUTE en `public`, donde pgtap quedaría inutilizable), y
     `alter database verify006 set search_path = "$user", public, extensions`.
  4. Esquema `auth` con `users` (columnas que insertan las suites) y `auth.uid()` / `auth.jwt()`
     leídos de `request.jwt.claim.sub` (claim legado, lo usa la suite 003) y
     `request.jwt.claims` (JSON), más `grant usage` de los esquemas `auth`/`extensions` a los
     roles de API.

  Guiones: `setup.sh` (initdb `--locale=C -E UTF8`, arranque en socket
  `/tmp/verify-006/sock` puerto 55432 con `jit=off`, recreación de la BD `verify006`, shims y
  migraciones 001–013 en orden) y `run-suite.sh` (psql del sistema 18.6 sobre el socket con
  `-A -t`, salida TAP). La BD se recrea en cada corrida: cada ejecución es un esquema limpio.

- **Integración viva**: stack Supabase local compartido (podman) con **concesión por orquestador**
  («reservo stack» / «stack libre» anunciados por hub y confirmados por Main). Lección de esta
  ejecución: dos colisiones por latencia de mensajes entre pares (mi `supabase db reset` corrió
  durante una pasada de 004); el protocolo pasó de relevo entre pares a concesión expresa del
  orquestador. Coste contable del solape: 2 corridas de 004, repuestas.

## Guion de verificación local

```sh
# 1) pgTap (clúster scratch; no toca el stack compartido)
bash /tmp/verify-006/setup.sh
for t in supabase/tests/0*.sql; do bash /tmp/verify-006/run-suite.sh "$PWD/$t"; done

# 2) Integración viva (con stack concedido por el orquestador)
export DOCKER_HOST=unix:///run/user/1000/podman/podman.sock
supabase db reset                                              # migraciones 001–013
supabase test db                                               # pgTap 001–012
podman exec supabase_db_diklass psql -U postgres -d postgres \
  -c "NOTIFY pgrst, 'reload schema';"
eval "$(supabase status -o env 2>/dev/null \
  | grep -E '^(ANON_KEY|SERVICE_ROLE_KEY|API_URL)=' \
  | sed 's/^API_URL=/SUPABASE_URL=/; s/^ANON_KEY=/EXPO_PUBLIC_SUPABASE_ANON_KEY=/; s/^SERVICE_ROLE_KEY=/SUPABASE_SERVICE_ROLE_KEY=/' \
  | sed 's/^/export /')"
bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json
SUPABASE_LIVE_TESTS=1 bun test tests/integration/asistencia    # integración viva + arnés
bun run db:types && git diff --exit-code src/lib/supabase/database.types.ts   # sin diff

# 3) Compuertas locales acotadas (solo archivos de este cambio, jamás todo el repo)
bunx biome check --write src/features/asistencia src/components/asistencia \
  "src/app/(protected)/support" tests/unit/asistencia tests/integration/asistencia \
  tests/fixtures/asistencia
bun run typecheck
bun test tests/unit/asistencia
bunx expo export --platform web    # smoke de compilación de las rutas nuevas
```

## Transiciones y acciones de FR-063 (tarea 1.3 · D1/D7)

Reuso confirmado de la convención existente (`clinical_record_action` en
`003_attribution_hardening.sql`, verificado por los asserts 1–5 y 13–14 de la suite 012):

| Transición | `record_type` | Acción emitida |
|---|---|---|
| `INSERT` (sistema al presentar o veterinario al agregar) | `hypothesis` | `hypothesis_added` |
| `UPDATE` con `content.decision = 'accepted'` | `hypothesis` | `hypothesis_accepted` |
| `UPDATE` con `content.decision = 'discarded'` | `hypothesis` | `hypothesis_discarded` |
| `INSERT` (la decisión registrada, D3) | `missing_information` | `missing_information_decided` |
| `UPDATE` del `estado` (revisión de la decisión) | `missing_information` | `missing_information_decided` |

Las filas de asistencia nacen y permanecen en `status = 'draft'` (FR-010, enforce por
`ASSISTANCE_STATUS_INVALID` del trigger 013 y por la RPC de aprobación, que solo acepta
epicrisis).

**Desviación detectada y resuelta sobre el propio trigger (013)**: el sellado por consulta
cerrada NO es heredado para estas entidades — `guard_consultation_sealed` (009) acota su sello a
`('anamnesis', 'diagnosis', 'epicrisis')` (el set de registros de trabajo de SC-009 de la spec
002). Por eso los asserts 21–22 de la suite 012 estaban en rojo junto a los del trigger: el
sello de `hypothesis`/`missing_information` vive en `guard_assistance_decisions` (misma
semántica sobre `old`, mismo error `CLINICAL_RECORD_SEALED`). `design.md` y `tasks.md` quedan
ajustados a este alcance real.

## Integraciones autorizadas pendientes (archivos compartidos, ejecuta el orquestador)

| Requisito | Edición mínima propuesta | Motivo |
|---|---|---|
| RI-1 | `src/features/registro/epicrisis-draft.ts` o `src/app/(protected)/consultations/[id].tsx`: fusionar `composeHipotesisConsideradas(...)` (de `src/features/asistencia/soporte-diferencial.ts`) sobre el campo `hipotesis` del borrador de epicrisis (1–2 líneas) | FR-049 · US8-AC6: el campo se puebla en el flujo de 002 (archivo prohibido para esta rama) |
| RI-2 | `src/app/(protected)/home.tsx` y `src/app/(protected)/consultations/[id].tsx`: enlace de navegación a `/support/consultations/[id]` (1–2 líneas por archivo) | Entrada de UI a las rutas propias de esta rama |
| RI-3 | `tests/e2e/web/accessibility.spec.ts` (de 002): ampliar el escaneo axe + teclado/foco + viewport a `/support/**` | Esta rama no escribe Playwright (restricción de la ejecución) |

Ningún otro archivo compartido fue modificado.

## Evidencia de verificación

### Ciclo rojo→verde de la suite pgTap `012` (Constitución II · tareas 1.1–1.2)

| Etapa | Dónde | Resultado |
|---|---|---|
| Rojo — suite `012` sin la migración `013` | clúster scratch `/tmp/verify-006` (migraciones 001–010) | **11 ok / 11 not ok** — fallan exactamente los asserts 6–11 (nacimiento `added`, irreversibilidad, inmutabilidad de `texto`/`insumos`, `status='draft'`, texto obligatorio), 15–17 (estado nunca `pendiente`, pregunta obligatoria, inmutabilidad de la base) y 21–22 (sellado de hipótesis y decisión al cerrar la consulta): la razón prevista (invariantes del trigger 013 y alcance real del sellado, ver arriba) |
| Verde — con la migración `013` | clúster scratch `/tmp/verify-006` (migraciones 001–013) | **22/22** en la suite `012` |
| Regresión de las suites heredadas con la `013` aplicada | clúster scratch `/tmp/verify-006` | **187 asserts, 0 fallos** — `001` 12/12, `002` 17/17, `003` 14/14, `004` 30/30, `005` 18/18, `006` 5/5, `007` 10/10, `008` 28/28, `009` 31/31 y `012` 22/22 |
| Verde oficial (stack local, `supabase db reset` 001–013 + `supabase test db`) | stack Supabase compartido (ventana concedida) | **11 archivos, 192 asserts, «All tests successful»** — suites `001`–`012` verdes con la 013 (incluye los asserts de los «flips»: `missing_information` como decisión, `added` irreversible, base inmutable) |

Notas de fidelidad del clúster scratch (fueron los únicos tropiezos del arranque, ambos del
shim, no del repo): `service_role` exige `BYPASSRLS` (si no, el assert «no-owner flag» de la
suite 002 ejercita una actualización de 0 filas) y `auth.uid()` debe honrar el claim legado
`request.jwt.claim.sub` que usa la suite 003. Con los shims ajustados, la reproducción local
es determinista.

### Modelos, detección y soporte diferencial (tareas 2.1–2.3)

| Etapa | Resultado |
|---|---|
| Rojo previo (`bun test tests/unit/asistencia`) | 3 archivos fallando por `Cannot find module '@/features/asistencia/…'` (razón prevista) |
| Verde | **39 pass / 0 fail** (114 `expect()`): `schema.test.ts`, `deteccion.test.ts`, `soporte-diferencial.test.ts`, `asistencia-service.test.ts`, `hipotesis-service.test.ts` — con los presupuestos de detección ≤ 100 ms y composición ≤ 300 ms verificados por temporización laxa |

### Servicios e integración viva (tareas 3.1–3.3)

| Etapa | Resultado |
|---|---|
| Rojo previo de servicios | 2 archivos fallando por `Cannot find module` de `asistencia-service`/`hipotesis-service` (razón prevista) |
| Rojo→verde de arreglos | 8 fallos por colas del cliente falso y 2 bugs reales de mi código (contexto de la ficha y fixture que matcheaba su propia cobertura) detectados por las pruebas y corregidos; verde **39/39** |
| Verde integración viva (stack concedido, `SUPABASE_LIVE_TESTS=1`) | **13 pass / 0 fail** (78 `expect()`): `asistencia.test.ts` (FR-008, FR-033, FR-063 · US7-AC1/AC2/AC4/AC6, con presupuestos ≤ 500 ms de fundamento y ≤ 2 s de decisión), `hipotesis.test.ts` (FR-009, FR-022, FR-020, FR-029, FR-010, FR-049 · US8-AC1/AC2/AC5/AC8/AC9, con generación ≤ 8 s y decisión ≤ 2 s, más el caso límite de diagnóstico no anticipado) y `evaluacion.test.ts` (arnés) |

**Fix→evidencia de los 2 fallos vivos iniciales** (11/2 → 13/0): eran aserciones
sobrespecificadas — exigían el token de la fuente sintética propia del archivo, pero la
colección es compartida y la recuperación léxica puede citar cualquier fuente calificada
(comportamiento correcto de 003). Se ajustaron al contrato real (FR-033/FR-007: cita
documento+fragmento con texto verbatim y bibliografía, no el ganador del ranking).

### Arnés de evaluación sobre casos anotados sintéticos (tarea 3.3 · HD8)

Métricas impresas por la propia corrida viva:

| Criterio | Resultado | Presupuesto |
|---|---|---|
| SC-029 (señalamiento de antecedentes faltantes anotados) | **100% (12/12)** sobre los 4 casos sintéticos | ≥ 70% |
| SC-019 (tres secciones con ausencias explícitas en toda hipótesis) | 0 incumplimientos sobre las hipótesis presentadas | 100% |
| SC-030 (ausencia de respaldo declarada cuando no hay citas) | 0 incumplimientos | 100% |
| SC-031 (descargo presente; nada como diagnóstico definitivo) | 0 incumplimientos | 100% |

Estas métricas verifican el **mecanismo** sobre casos anotados sintéticos (HD8); no aceptan
SC-029, SC-019, SC-030 ni SC-031 (conjunto del equipo clínico, panel de especialistas y lectura
clínica siguen pendientes).

### Interfaz (tareas 4.1–4.2) — verificación visual PENDIENTE y declarada

- Ruta `/support/consultations/[id]` con los componentes `panel-informacion-faltante`,
  `tarjeta-sugerencia`, `panel-soporte-diferencial`, `tarjeta-hipotesis` y `ver-respaldo`
  (etiquetas programáticas, operación por teclado y `testID` estables; citas navegables al visor
  de 003).
- Smoke de compilación: `expo export --platform web` exporta `/(protected)/support/consultations/[id]` (18 KB).
- **Verificación visual interactiva: NO realizada** (sin Playwright ni daemon de Chromium
  operativo; RI-3 queda como pendiente declarado, no como compuerta cumplida).

### Tipos generados

`bun run db:types` + `git diff --exit-code src/lib/supabase/database.types.ts` sobre el esquema
001–013: **SIN DIFF** (la migración 013 es un trigger puro, como `guard_consultation_sealed` de
009). Al integrar las ramas hermanas (p. ej. la 011 de captura de voz), el orquestador volverá
a necesitar `bun run db:types` sobre el esquema combinado: lo ejecuta 004 en su ventana de
regeneración.

## Pendientes explícitos (no son compuertas cumplidas)

- RI-1, RI-2 y RI-3 (ediciones de integración que ejecuta el orquestador; diffs propuestos arriba).
- SC-017 y SC-018: evaluación del panel de ≥ 3 especialistas sobre ≥ 5 casos.
- SC-029 sobre el conjunto de casos del equipo clínico (el arnés usa casos sintéticos, HD8).
- Lectura clínica de SC-019/SC-030/SC-031 y aceptación de las invariantes por el equipo.
- Verificación visual y e2e funcional web de `/support/**` (RI-3).
