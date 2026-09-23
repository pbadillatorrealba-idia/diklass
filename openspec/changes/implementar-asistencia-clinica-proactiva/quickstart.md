# Guía de validación rápida: Asistencia clínica proactiva

**Creado**: 2026-09-22 · **Cambio**: `implementar-asistencia-clinica-proactiva` ·
**Diseño**: [design.md](design.md) · **Tareas**: [tasks.md](tasks.md)

Registro incremental de la evidencia real de esta ejecución (se consolida en la tarea 5.3).
Diferencia, como exige `AGENTS.md`, entre verificado por máquina y aceptado: nada de lo que
sigue es aceptación de SC.

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
     suite 002 no ejercita nada).
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

- **Integración viva**: stack Supabase local compartido (podman) con **protocolo de reserva por
  hub** («reservo stack» / «stack libre»), obligatorio entre worktrees hermanos. El orquestador
  confirmó que hoy solo esta rama lo usa, pero se mantiene el anuncio.

## Guion de verificación local

```sh
# 1) pgTap (clúster scratch; no toca el stack compartido)
bash /tmp/verify-006/setup.sh
for t in supabase/tests/0*.sql; do bash /tmp/verify-006/run-suite.sh "$PWD/$t"; done

# 2) Integración viva (reservar el stack por hub y anunciar la ventana)
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
# 3) Anunciar «stack libre» por hub.

# 3) Compuertas locales acotadas (solo archivos de este cambio, jamás todo el repo)
bunx biome check --write src/features/asistencia src/components/asistencia \
  "src/app/(protected)/support" tests/unit/asistencia tests/integration/asistencia \
  tests/fixtures/asistencia
bun run typecheck
bun test tests/unit/asistencia
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

## Evidencia de verificación (incremental)

### Ciclo rojo→verde de la suite pgTap `012` (Constitución II · tareas 1.1–1.2)

| Etapa | Dónde | Resultado |
|---|---|---|
| Rojo — suite `012` sin la migración `013` | clúster scratch `/tmp/verify-006` (migraciones 001–010) | **11 ok / 11 not ok** — fallan exactamente los asserts 6–11 (nacimiento `added`, irreversibilidad, inmutabilidad de `texto`/`insumos`, `status='draft'`, texto obligatorio), 15–17 (estado nunca `pendiente`, pregunta obligatoria, inmutabilidad de la base) y 21–22 (sellado de hipótesis y decisión al cerrar la consulta): la razón prevista (invariantes del trigger 013), más el alcance real del sellado heredado descrito arriba |
| Verde — con la migración `013` | clúster scratch `/tmp/verify-006` (migraciones 001–013) | **22/22** en la suite `012` |
| Regresión de las suites heredadas con la `013` aplicada | clúster scratch `/tmp/verify-006` | **187 asserts, 0 fallos** — `001` 12/12, `002` 17/17, `003` 14/14, `004` 30/30, `005` 18/18, `006` 5/5, `007` 10/10, `008` 28/28, `009` 31/31 y `012` 22/22 |

Notas de fidelidad del clúster scratch (fueron los únicos tropiezos del arranque, ambos del
shim, no del repo): `service_role` exige `BYPASSRLS` (si no, el assert «no-owner flag» de la
suite 002 ejercita una actualización de 0 filas) y `auth.uid()` debe honrar el claim legado
`request.jwt.claim.sub` que usa la suite 003. Con los shims ajustados, la reproducción local
es determinista.

Verificación visual interactiva y e2e web: **NO realizadas** (sin Playwright ni daemon de
Chromium operativo en este entorno; RI-3). Queda como pendiente declarado, no como compuerta
cumplida.
