# Cierre de la revisión de la PR #4: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los hallazgos de la revisión de la PR #4 que la PR #3 deja abiertos: atribución, sesión de acceso ligada a la sesión de Auth, borradores en nativo, `report-client-error`, privilegios de funciones y los menores.

**Architecture:** Todo el trabajo se apoya en la cabeza de la #3 (`4cc0178`, rama `feat/001-convergencia-fase-7-8`). Los cambios de base de datos van en migraciones nuevas, `004` a `007`, sin editar las existentes, y cada una trae su suite pgTap. Los cambios de cliente se aíslan en funciones puras que se prueban con `bun test`, y los flujos completos se verifican con las suites vivas contra Supabase local y con Playwright.

**Tech Stack:** Supabase (Postgres 17, PostgREST, Edge Functions en Deno), CLI de Supabase 2.117.0, pgTap, Expo SDK 57 / React Native, `@supabase/supabase-js` ^2.57.4, Zod ^4.0.1, Bun 1.4.0, Biome 2.2.4, Playwright 1.61.0.

**Spec:**

- `specs/001-identidad-y-acceso/spec.md`
- Contratos: `specs/001-identidad-y-acceso/contracts/auth-session.md` y `contracts/clinical-attribution.md`
- Modelo de datos: `specs/001-identidad-y-acceso/data-model.md`
- Hallazgos: la revisión de la PR #4, https://github.com/pbadillatorrealba-idia/diklass/pull/4#pullrequestreview-5180031684

## Global Constraints

Tomadas textualmente de `contracts/auth-session.md`:

- "No existe `signUp` en la app."
- "La contraseña y los tokens nunca se registran."
- "Zustand no almacena tokens ni sustituye al estado de sesión de Supabase."
- "No se usa una service-role key para una operación iniciada por el veterinario."
- "Cualquier endpoint o Edge Function que se agregue para una operación compleja debe volver a validar Auth, sesión activa y payload con Zod antes de tocar datos."
- "La función `is_active_access(auth.uid())`, usada por las policies RLS, devuelve falso cuando no existe una sesión no revocada cuya actividad tenga menos de ocho horas."

Tomada del código (`003_attribution_hardening.sql`):

- Logs: "Never log passwords, tokens or clinical content: only identifiers and outcomes."

Convenciones del repositorio:

- Versiones fijadas: Bun `1.4.0` (`BUN_VERSION` en CI), Biome `2.2.4`, TypeScript `~6.0.3`, Postgres `17` (`supabase/config.toml`) y CLI de Supabase `2.117.0`, que es la instalada en local.
- Comentarios de código en inglés. Documentos de spec y contratos en español.
- Ancho de línea 100 y comillas dobles (Biome).
- Migraciones con prefijo numérico de tres dígitos (`00N_nombre.sql`).
- Commits con el formato `tipo: descripción` en inglés.

---

## Decisiones tomadas en este plan

Todas son revisables antes de ejecutar.

- **D1: varias sesiones a la vez por veterinario.** Lo decidió el usuario el 2026-09-11. Cada dispositivo tiene su propia sesión de acceso, ligada a su sesión de Auth. Consecuencias:
  - `start_access_session` ya no revoca las sesiones de otros dispositivos. Solo reemplaza la de la misma sesión de Auth, si existía.
  - El logout cierra solo el dispositivo actual: `revoke_current_access_session()` y después `supabase.auth.signOut({ scope: 'local' })`. Por defecto, `signOut()` usa `scope: 'global'` y cerraría las sesiones de Auth de todos los dispositivos.
  - `revoke_access_sessions()` se conserva para cerrar la sesión en todos los dispositivos, aunque la app no la usa.
  - Las pruebas e2e siguen en paralelo, porque cada contexto tiene su propia sesión. La prueba de expiración envejece solo la sesión de su propio contexto.
- **D2: `report-client-error` no exige sesión activa.** Los fallos de login ocurren sin sesión, y la función no toca datos: solo escribe una línea de log. El contrato exige validar sesión activa a los endpoints que tocan datos. Sí valida el payload con Zod, restringe el método, limita el tamaño y limita la tasa por IP.
- **D3: `status` solo cambia mediante `approve_clinical_record`.** Un registro `corrective` nace como INSERT con `supersedes_event_id`; nunca se convierte en `corrective` después.
- **D4: ningún UPDATE de `clinical_records` sin un veterinario autenticado.** Eso cubre la service role y los procesos de sistema. Toda edición clínica tiene un actor real (FR-064).
- **D5: migraciones nuevas, no ediciones.** Van de `004` a `007` sobre la `003` de la #3, porque puede haber entornos con la `003` aplicada, como el backend sintético de e2e.
- **D6: límite de 30 reportes por minuto por IP.** Si el almacén de cuotas falla, el sistema falla en abierto: se pierde el límite, no el reporte.

## Fuera de alcance

- **`detectSessionInUrl: true` en `src/lib/supabase/client.ts`.** supabase-js solo lo evalúa en navegador, así que en nativo no tiene efecto. Hay que confirmarlo antes de tocarlo.
- **Historial de versiones de la constitución.** Hay versiones inconsistentes: 1.0.1 en `main`, 1.1.0 → 1.2.0 en `plan.md` y 1.2.0 → 1.3.0 en el commit. Falta verificarlo y queda como tarea aparte.
- **Eliminar `access_sessions.token_hash`.** Queda como nonce interno. La Task 5 documenta que el vínculo real es `auth_session_id`.
- **T045/T063, parte nativa.** Dependen de credenciales del equipo.

## Estructura de archivos

**Crear:**

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/004_attribution_columns.sql` | `created_at` y `status` inmutables, UPDATE solo autenticado, grants por columna (T075) |
| `supabase/migrations/005_function_privileges.sql` | `EXECUTE` cerrado por defecto y `search_path` fijo (T076) |
| `supabase/migrations/006_access_session_binding.sql` | `auth_session_id`, `current_access_session()`, `is_active_access` y `touch_access_session` ligadas a la sesión (T077) |
| `supabase/migrations/007_client_error_quota.sql` | Cuota por minuto de `report-client-error` (T082) |
| `supabase/tests/003_attribution_columns.sql` | pgTap de T075 |
| `supabase/tests/004_function_privileges.sql` | pgTap de T076 |
| `supabase/tests/005_access_session_binding.sql` | pgTap de T077 |
| `supabase/tests/006_client_error_quota.sql` | pgTap de T082 |
| `supabase/functions/report-client-error/handler.ts` | Lógica pura de la función (CORS, método, tamaño, Zod, cuota), importable desde Bun |
| `supabase/functions/report-client-error/deno.json` | Mapa de imports de Deno (`zod`, `@supabase/supabase-js`) |
| `scripts/lib/provisioning.ts` | Funciones puras del provisioning (URL local, email, paginación) |
| `tests/unit/ci/pinned-actions.test.ts` | Falla si una action no está fijada por SHA |
| `tests/unit/auth/current-access-session.test.ts` | Pruebas de `getCurrentAccessSession` |
| `tests/unit/storage/draft-key.test.ts` | Claves de borrador válidas para SecureStore |
| `tests/unit/observability/report-client-error-handler.test.ts` | Pruebas del handler |
| `tests/unit/scripts/provisioning.test.ts` | Pruebas de `scripts/lib/provisioning.ts` |
| `tests/integration/observability/report-client-error.test.ts` | CORS e invocación real contra Supabase local |

**Modificar:**

- `.github/workflows/ci.yml`
- `.github/workflows/native-e2e.yml`
- `package.json`
- `biome.json`
- `tsconfig.json`
- `src/lib/supabase/database.types.ts` (pasa a ser generado)
- `src/features/auth/access-session-service.ts`
- `src/features/auth/auth-provider.tsx`
- `src/features/auth/auth-service.ts`
- `src/lib/storage/drafts.ts`
- `src/features/clinical/draft-preserver.tsx`
- `src/lib/attribution/types.ts`
- `supabase/functions/report-client-error/index.ts`
- `scripts/provision-veterinarians.ts`
- `supabase/seed.sql`
- `supabase/tests/001_identity_access.sql`
- `supabase/tests/002_attribution_immutability.sql`
- `tests/unit/clinical/attribution-guards.test.ts`
- `tests/integration/attribution/shared-clinic.test.ts`
- `tests/integration/auth/access-session.test.ts`
- `tests/integration/auth/auth-contract.test.ts`
- `tests/e2e/web/auth.spec.ts`
- `specs/001-identidad-y-acceso/tasks.md`
- `specs/001-identidad-y-acceso/data-model.md`
- `specs/001-identidad-y-acceso/contracts/auth-session.md`
- `specs/001-identidad-y-acceso/quickstart.md`

## Entorno local

Referencia para todas las tareas. En esta máquina, la CLI de Supabase necesita el socket rootless de podman:

```bash
systemctl --user start podman.socket
export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
```

**Reiniciar la base y provisionar los veterinarios sintéticos.** `supabase db reset` borra `auth.users`, así que hay que provisionar después de cada reset:

```bash
supabase db reset
bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json
```

**Variables para las suites vivas.** Son las mismas que usa el job `database` de CI:

```bash
status=$(supabase status -o json)
export EXPO_PUBLIC_SUPABASE_URL=$(echo "$status" | jq -r .API_URL)
export EXPO_PUBLIC_SUPABASE_ANON_KEY=$(echo "$status" | jq -r .ANON_KEY)
export SUPABASE_URL="$EXPO_PUBLIC_SUPABASE_URL"
export SUPABASE_SERVICE_ROLE_KEY=$(echo "$status" | jq -r .SERVICE_ROLE_KEY)
```

**Compuertas:**

| Compuerta | Comando |
|---|---|
| Lint y formato | `bunx biome ci .` |
| Tipos | `bun run typecheck` |
| Unitarias (las vivas se omiten) | `bun run test` |
| pgTap | `supabase test db` |
| Integración viva | `SUPABASE_LIVE_TESTS=1 bun run test:integration` |
| E2E web | `bun run test:e2e:web -- --project=chromium` |

---

### Task 0: Rama de trabajo y registro de tareas

**Files:**
- Modify: `specs/001-identidad-y-acceso/tasks.md` (al final)
- Create: `docs/superpowers/plans/2026-09-11-cierre-revision-pr4.md` (este plan, si todavía no está en la rama)

**Interfaces:**
- Produces: la rama `fix/001-cierre-revision-pr4` sobre `origin/feat/001-convergencia-fase-7-8`, y las tareas T073–T083 que las tareas siguientes marcan como hechas.

- [ ] **Step 1: Crear la rama desde la cabeza de la #3**

```bash
git fetch origin
git switch -c fix/001-cierre-revision-pr4 origin/feat/001-convergencia-fase-7-8
git log -1 --format=%h   # Expected: 4cc0178, o posterior si la #3 recibió commits
```

- [ ] **Step 2: Levantar el entorno y comprobar que la línea base está verde**

Ejecuta el bloque de «Entorno local» y después:

```bash
bun install --frozen-lockfile
supabase start
supabase db reset
bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json
bunx biome ci . && bun run typecheck && bun run test && supabase test db
SUPABASE_LIVE_TESTS=1 bun run test:integration
```

Expected: todo PASS. Son 30/30 aserciones pgTap y 13/13 vivas, según la evidencia de la #3. Si algo falla aquí, detente: la línea base no está limpia.

- [ ] **Step 3: Agregar la fase 9 al final de `tasks.md`**

Añade este bloque al final de `specs/001-identidad-y-acceso/tasks.md`:

```markdown

---

## Phase 9: Review follow-up (PR #4)

**Purpose**: Close the findings of the PR #4 code review that PR #3 leaves open
(https://github.com/pbadillatorrealba-idia/diklass/pull/4#pullrequestreview-5180031684).

- [ ] T073 Pin `oven-sh/setup-bun` and `supabase/setup-cli` by commit SHA, and the Supabase CLI to `2.117.0`, in `.github/workflows/ci.yml` and `.github/workflows/native-e2e.yml`, guarded by `tests/unit/ci/pinned-actions.test.ts` per plan.md: CI de GitHub (contradicts)
- [ ] T074 Generate `src/lib/supabase/database.types.ts` with `bun run db:types` instead of maintaining it by hand, and fail the `database` CI job when it drifts from the migrations (partial)
- [ ] T075 Stamp `created_at` on INSERT, reject `status` changes outside `approve_clinical_record`, reject clinical-record updates without an authenticated veterinarian, and restrict `authenticated` to column-level INSERT/UPDATE grants on `public.clinical_records` in `supabase/migrations/004_attribution_columns.sql` per FR-064, SC-042, data-model.md (contradicts)
- [ ] T076 Revoke `EXECUTE` on every `public` function from `PUBLIC`, `anon` and `authenticated` (now and by default), grant back only the RLS helpers and app RPCs, and fix `search_path` on the remaining invoker functions in `supabase/migrations/005_function_privileges.sql` per Supabase lints 0011/0028 (partial)
- [ ] T077 Bind every access session to the Supabase Auth `session_id` of the JWT that started it, allow concurrent sessions across devices, make `is_active_access`/`touch_access_session` honour only that binding, and add `current_access_session()` and `revoke_current_access_session()` in `supabase/migrations/006_access_session_binding.sql` per FR-061, FR-067, contracts/auth-session.md (contradicts)
- [ ] T078 Resume only the access session bound to the current Auth session on restore (`getCurrentAccessSession` in `src/features/auth/access-session-service.ts`), and make logout end only the current device (`revoke_current_access_session()` + `signOut({ scope: "local" })`) in `src/features/auth/` per FR-061, contracts/auth-session.md (contradicts)
- [ ] T079 Make `draftStorageKey` produce valid SecureStore keys and report failed draft writes instead of leaving unhandled rejections in `src/lib/storage/drafts.ts` and `src/features/clinical/draft-preserver.tsx` per FR-061, SC-047 (contradicts)
- [ ] T080 Check the snake_case attribution columns PostgREST receives in `ATTRIBUTION_CONTROL_FIELDS` (`src/lib/attribution/types.ts`) and stop blocking `clinic_id` per contracts/clinical-attribution.md (contradicts)
- [ ] T081 Handle the CORS preflight, restrict to `POST`, cap the body size and validate the payload with Zod in `supabase/functions/report-client-error` per Constitution IV (partial)
- [ ] T082 Rate-limit `report-client-error` per caller IP with `public.consume_client_error_quota` in `supabase/migrations/007_client_error_quota.sql` (missing)
- [ ] T083 Make `scripts/provision-veterinarians.ts` refuse non-local URLs without `--allow-remote`, match emails case-insensitively across every page and resync passwords on re-run, and drop the dead `clinical_records` insert from `supabase/seed.sql` (partial)
```

- [ ] **Step 4: Commit**

```bash
git add specs/001-identidad-y-acceso/tasks.md docs/superpowers/plans/2026-09-11-cierre-revision-pr4.md
git commit -m "docs: plan the PR #4 review follow-up (T073-T083)"
```

---

### Task 1: Fijar las actions de CI por SHA (T073)

Se hace primero para que el CI genere los tipos (Task 2) con la misma versión de la CLI que en local.

**Files:**
- Create: `tests/unit/ci/pinned-actions.test.ts`
- Modify: `.github/workflows/ci.yml` (todas las apariciones de `oven-sh/setup-bun@v2`, `supabase/setup-cli@v1` y `version: latest`)
- Modify: `.github/workflows/native-e2e.yml` (`oven-sh/setup-bun@v2`)

**Interfaces:**
- Produces: CI con la CLI de Supabase `2.117.0`, requisito de la verificación de tipos de la Task 2.

- [ ] **Step 1: Escribir la prueba que falla**

`tests/unit/ci/pinned-actions.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WORKFLOWS = ".github/workflows";
const workflows = readdirSync(WORKFLOWS).filter((name) => /\.ya?ml$/.test(name));

// plan.md (CI de GitHub) requires every third-party action pinned by commit SHA.
describe("GitHub Actions supply chain", () => {
  test.each(workflows)("%s pins every action by commit SHA", (name) => {
    const text = readFileSync(join(WORKFLOWS, name), "utf8");
    const refs = [...text.matchAll(/uses:\s*([^\s#]+)/g)].map((match) => match[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref).toMatch(/@[0-9a-f]{40}$/);
    }
  });

  test.each(workflows)("%s never installs the Supabase CLI as 'latest'", (name) => {
    expect(readFileSync(join(WORKFLOWS, name), "utf8")).not.toMatch(/version:\s*latest/);
  });
});
```

- [ ] **Step 2: Ejecutarla y verificar que falla**

Run: `bun test tests/unit/ci/pinned-actions.test.ts`

Expected: FAIL.

- `ci.yml pins every action by commit SHA` falla con `oven-sh/setup-bun@v2`.
- `ci.yml never installs the Supabase CLI as 'latest'` falla.
- `native-e2e.yml` falla con `oven-sh/setup-bun@v2`.

- [ ] **Step 3: Fijar las actions**

En `.github/workflows/ci.yml` y en `.github/workflows/native-e2e.yml`, reemplaza cada aparición de la primera columna por la segunda:

| Antes | Después |
|---|---|
| `oven-sh/setup-bun@v2` | `oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0` |
| `supabase/setup-cli@v1` | `supabase/setup-cli@ab058987d8d6c725971f6cf9d0b5c98467e30bd1 # v1.7.1` |
| `version: latest` (bajo `setup-cli`) | `version: 2.117.0` |

Los SHA salen de `git ls-remote --tags` (2026-09-11). Son tags ligeros, así que cada SHA es el del commit.

- [ ] **Step 4: Ejecutar la prueba y verificar que pasa**

Run: `bun test tests/unit/ci/pinned-actions.test.ts`

Expected: PASS, con 4 pruebas.

- [ ] **Step 5: Commit**

Marca T073 como `[X]` en `tasks.md`.

```bash
git add .github/workflows tests/unit/ci/pinned-actions.test.ts specs/001-identidad-y-acceso/tasks.md
git commit -m "ci: pin setup-bun and setup-cli by commit SHA (T073)"
```

---

### Task 2: Tipos generados desde el esquema (T074)

**Files:**
- Modify: `package.json` (nuevo script `db:types`)
- Modify: `biome.json` (excluir el archivo generado)
- Modify: `src/lib/supabase/database.types.ts` (regenerado)
- Modify: `.github/workflows/ci.yml` (job `database`: paso de deriva)

**Interfaces:**
- Produces: `bun run db:types`. Todas las tareas que cambian el esquema lo ejecutan y commitean el resultado.

- [ ] **Step 1: Agregar el script y excluir el archivo generado de Biome**

En `package.json`, dentro de `"scripts"`, después de `"provision:veterinarians"`:

```json
    "provision:veterinarians": "bun scripts/provision-veterinarians.ts",
    "db:types": "supabase gen types --lang=typescript --local > src/lib/supabase/database.types.ts"
```

En `biome.json`, dentro de `files.includes`, justo después de `"src/**",`:

```json
      "src/**",
      "!src/lib/supabase/database.types.ts",
```

- [ ] **Step 2: Generar los tipos**

```bash
supabase db reset
bun run db:types
git diff --stat src/lib/supabase/database.types.ts
```

Expected: el archivo cambia por completo. Ahora refleja el esquema real e incluye `current_clinic_id`, `is_active_access` y `request_id`, entre otras.

- [ ] **Step 3: Comprobar tipos y lint**

Run: `bun run typecheck && bunx biome ci .`

Expected: PASS. Si `tsc` reporta errores, son desajustes reales que los tipos escritos a mano ocultaban. Corrígelos en el sitio de la llamada, nunca en el archivo generado, y anota cada uno en el mensaje del commit.

- [ ] **Step 4: Verificar la deriva en CI**

En `.github/workflows/ci.yml`, job `database`, justo después del paso `pgTap (RLS, triggers, session expiry, attribution)`:

```yaml
      - name: Generated database types match the migrations
        run: |
          supabase gen types --lang=typescript --local > "$RUNNER_TEMP/database.types.ts"
          diff -u src/lib/supabase/database.types.ts "$RUNNER_TEMP/database.types.ts"
```

- [ ] **Step 5: Comprobar que la verificación detecta una deriva**

```bash
echo "// drift" >> src/lib/supabase/database.types.ts
supabase gen types --lang=typescript --local > /tmp/database.types.ts
diff -u src/lib/supabase/database.types.ts /tmp/database.types.ts; echo "exit=$?"
git checkout src/lib/supabase/database.types.ts
```

Expected: `exit=1`, con un diff que muestra `-// drift`. Tras el `checkout`, el mismo `diff` termina con `exit=0`.

- [ ] **Step 6: Commit**

Marca T074 como `[X]`.

```bash
git add package.json biome.json src/lib/supabase/database.types.ts .github/workflows/ci.yml specs/001-identidad-y-acceso/tasks.md
git commit -m "chore: generate database types from the local schema (T074)"
```

---

### Task 3: Columnas de atribución y `status` (T075)

**Files:**
- Create: `supabase/tests/003_attribution_columns.sql`
- Create: `supabase/migrations/004_attribution_columns.sql`
- Modify: `supabase/tests/002_attribution_immutability.sql` (dos aserciones)
- Modify: `tests/integration/attribution/shared-clinic.test.ts` (tres expectativas)

**Interfaces:**
- Consumes: `public.deny_attribution_mutation()` y el flag de transacción `diklass.approving`, que `approve_clinical_record` (migración 003) activa.
- Produces:
  - En la API, `authenticated` solo puede hacer `INSERT (id, clinic_id, record_type, content, status, supersedes_event_id)` y `UPDATE (content)` sobre `public.clinical_records`.
  - Cualquier otra columna devuelve `42501 permission denied for table clinical_records`.

- [ ] **Step 1: Escribir la suite pgTap que falla**

`supabase/tests/003_attribution_columns.sql`:

```sql
begin;
select plan(8);

-- Arrange: one clinic, one veterinarian. These assertions exercise the triggers and the
-- grants, not RLS, so no access session is needed.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a3a3a3a3-0000-0000-0000-0000000000a3',
   'authenticated', 'authenticated', 'ana.columns@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values ('c3c3c3c3-0000-0000-0000-0000000000c3', 'Clínica de prueba de columnas');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values ('a3a3a3a3-0000-0000-0000-0000000000a3', 'c3c3c3c3-0000-0000-0000-0000000000c3',
        'ana.columns@example.test', 'Ana Columnas');

select set_config('request.jwt.claim.sub', 'a3a3a3a3-0000-0000-0000-0000000000a3', true);

-- ---------------------------------------------------------------------------
-- data-model: created_at is generated by the server, even if the payload sends one.
-- ---------------------------------------------------------------------------

insert into public.clinical_records (id, clinic_id, record_type, content, status, created_at)
values ('d3d3d3d3-0000-0000-0000-0000000000d1', 'c3c3c3c3-0000-0000-0000-0000000000c3',
        'patient', '{"name":"Luna"}', 'draft', '2001-01-01T00:00:00Z');

select ok(
  (select created_at > timezone('utc', now()) - interval '1 minute'
   from public.clinical_records where id = 'd3d3d3d3-0000-0000-0000-0000000000d1'),
  'a client-supplied created_at is replaced by the server clock'
);

-- ---------------------------------------------------------------------------
-- D3: status only changes through approve_clinical_record.
-- ---------------------------------------------------------------------------

insert into public.clinical_records (id, clinic_id, record_type, content, status)
values ('d3d3d3d3-0000-0000-0000-0000000000d2', 'c3c3c3c3-0000-0000-0000-0000000000c3',
        'epicrisis', '{"summary":"borrador"}', 'draft');

select throws_ok(
  $$update public.clinical_records set status = 'approved'
    where id = 'd3d3d3d3-0000-0000-0000-0000000000d2'$$,
  '23514',
  'ATTRIBUTION_IMMUTABLE',
  'an epicrisis cannot be marked approved by a plain UPDATE'
);

select throws_ok(
  $$update public.clinical_records set status = 'corrective'
    where id = 'd3d3d3d3-0000-0000-0000-0000000000d1'$$,
  '23514',
  'ATTRIBUTION_IMMUTABLE',
  'a record cannot become corrective after the fact'
);

-- ---------------------------------------------------------------------------
-- Column grants: the Data API role writes domain columns only.
-- ---------------------------------------------------------------------------

select ok(
  not has_column_privilege('authenticated', 'public.clinical_records', 'approved_by', 'UPDATE'),
  'authenticated cannot update approved_by'
);
select ok(
  not has_column_privilege('authenticated', 'public.clinical_records', 'status', 'UPDATE'),
  'authenticated cannot update status'
);
select ok(
  not has_column_privilege('authenticated', 'public.clinical_records', 'created_at', 'INSERT'),
  'authenticated cannot insert created_at'
);
select ok(
  has_column_privilege('authenticated', 'public.clinical_records', 'content', 'UPDATE'),
  'authenticated can still update the clinical content'
);

-- ---------------------------------------------------------------------------
-- D4: an update always has an authenticated veterinarian as its actor.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$update public.clinical_records set content = '{"name":"Luna","weightKg":12}'
    where id = 'd3d3d3d3-0000-0000-0000-0000000000d1'$$,
  '42501',
  'AUTHENTICATION_REQUIRED',
  'an update without an authenticated veterinarian (service role) is rejected'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Ajustar las expectativas que cambian con los grants por columna**

Con grants por columna, PostgreSQL rechaza la columna antes de que corra el trigger. Informa la falta de privilegio de columna como `permission denied for table`.

En `supabase/tests/002_attribution_immutability.sql`, reemplaza:

```sql
            'b2b2b2b2-0000-0000-0000-0000000000b2', timezone('utc', now()))$$,
  '23514',
  'ATTRIBUTION_IMMUTABLE',
  'a veterinarian cannot insert a record naming a colleague as its approver'
```

por:

```sql
            'b2b2b2b2-0000-0000-0000-0000000000b2', timezone('utc', now()))$$,
  '42501',
  'permission denied for table clinical_records',
  'a veterinarian cannot insert a record naming a colleague as its approver'
```

Y reemplaza:

```sql
    where id = 'd2d2d2d2-0000-0000-0000-0000000000d2'$$,
  '23514',
  'ATTRIBUTION_IMMUTABLE',
  'approval columns cannot be written by a plain UPDATE'
```

por:

```sql
    where id = 'd2d2d2d2-0000-0000-0000-0000000000d2'$$,
  '42501',
  'permission denied for table clinical_records',
  'approval columns cannot be written by a plain UPDATE'
```

En `tests/integration/attribution/shared-clinic.test.ts`, haz tres reemplazos:

| Antes | Después |
|---|---|
| `expect(asAna.error?.message).toContain("ATTRIBUTION_IMMUTABLE");` | `expect(asAna.error?.code).toBe("42501");` |
| `expect(approvedByAna.error?.message).toContain("ATTRIBUTION_IMMUTABLE");` | `expect(approvedByAna.error?.code).toBe("42501");` |
| `expect(tamper.error?.message).toContain("ATTRIBUTION_IMMUTABLE");` | `expect(tamper.error?.code).toBe("42501");` |

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `supabase test db`

Expected: FAIL.

- En `003_attribution_columns.sql` fallan 7 de 8. Solo pasa `authenticated can still update the clinical content`.
- En `002_attribution_immutability.sql` fallan las dos aserciones editadas, que todavía reciben `23514`.

- [ ] **Step 4: Escribir la migración**

`supabase/migrations/004_attribution_columns.sql`:

```sql
-- Review #4 follow-up (T075): the attribution columns 003 left open.
--
-- 1. created_at is stamped by the server on INSERT (data-model: "Generado por servidor").
-- 2. status only changes through approve_clinical_record: a plain UPDATE could mark an
--    epicrisis approved with no approver and no epicrisis_approved event.
-- 3. Column-level grants: the Data API only writes domain columns.
-- 4. A clinical record is only updated by an authenticated veterinarian, so every update
--    has a real actor (a service-role UPDATE used to fall back to created_by).

create or replace function public.deny_attribution_mutation()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is distinct from auth.uid() then
      raise exception 'ATTRIBUTION_IMMUTABLE' using errcode = '23514';
    end if;
    if new.updated_by is not null or new.updated_at is not null
      or new.approved_by is not null or new.approved_at is not null then
      raise exception 'ATTRIBUTION_IMMUTABLE' using errcode = '23514';
    end if;
    if new.status = 'approved' then
      raise exception 'ATTRIBUTION_IMMUTABLE' using errcode = '23514';
    end if;
    -- The column default already fills created_at; overwrite whatever the payload sent
    -- so a record cannot be backdated.
    new.created_at := timezone('utc', now());
  end if;

  if tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'ATTRIBUTION_IMMUTABLE' using errcode = '23514';
    end if;
    -- The sanctioned approval path (approve_clinical_record) sets a transaction-local
    -- flag; every other writer is rejected, status included.
    if (new.approved_by is distinct from old.approved_by
        or new.approved_at is distinct from old.approved_at
        or new.status is distinct from old.status)
      and coalesce(current_setting('diklass.approving', true), 'off') <> 'on' then
      raise exception 'ATTRIBUTION_IMMUTABLE' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.stamp_update_attribution()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if tg_op = 'UPDATE' then
    if auth.uid() is null then
      raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
    end if;
    new.updated_by = auth.uid();
    new.updated_at = timezone('utc', now());
  end if;
  return new;
end;
$$;

-- `id` stays insertable: clients (and the pgTap suites) may choose the record's uuid.
revoke insert, update on public.clinical_records from anon, authenticated;
grant insert (id, clinic_id, record_type, content, status, supersedes_event_id)
  on public.clinical_records to authenticated;
grant update (content) on public.clinical_records to authenticated;
```

- [ ] **Step 5: Aplicar y verificar que pasa**

```bash
supabase db reset
bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json
supabase test db
SUPABASE_LIVE_TESTS=1 bun run test:integration
```

Expected:

- `supabase test db`: PASS en todas las suites, con 8 aserciones en `003_attribution_columns.sql`.
- Integración viva: PASS, incluidas las tres expectativas `42501` de `shared-clinic.test.ts`.

- [ ] **Step 6: Tipos y compuertas**

Run: `bun run db:types && git diff --exit-code src/lib/supabase/database.types.ts && bun run test`

Expected: sin diff, porque los grants no cambian los tipos generados, y la suite unitaria en PASS.

- [ ] **Step 7: Commit**

Marca T075 como `[X]`.

```bash
git add supabase/migrations/004_attribution_columns.sql supabase/tests/003_attribution_columns.sql supabase/tests/002_attribution_immutability.sql tests/integration/attribution/shared-clinic.test.ts specs/001-identidad-y-acceso/tasks.md
git commit -m "fix: lock created_at, status and attribution columns on clinical records (T075)"
```

---

### Task 4: Privilegios de funciones y `search_path` (T076)

**Files:**
- Create: `supabase/tests/004_function_privileges.sql`
- Create: `supabase/migrations/005_function_privileges.sql`

**Interfaces:**
- Consumes: todas las funciones de `public` de las migraciones 001 a 004.
- Produces:
  - Por defecto, una función nueva en `public` no es ejecutable por `PUBLIC`, `anon` ni `authenticated`, así que toda migración posterior debe conceder `EXECUTE` de forma explícita. La Task 5 lo hace con `current_access_session()`.
  - Solo estas funciones tienen `EXECUTE` para `authenticated`:
    - `is_active_access(uuid)`
    - `current_clinic_id()`
    - `start_access_session()`
    - `touch_access_session(uuid)`
    - `revoke_access_session(uuid)`
    - `revoke_access_sessions()`
    - `approve_clinical_record(uuid)`

- [ ] **Step 1: Escribir la suite pgTap que falla**

`supabase/tests/004_function_privileges.sql`:

```sql
begin;
select plan(24);

-- ---------------------------------------------------------------------------
-- RLS helpers and app RPCs: authenticated only, never anon.
-- ---------------------------------------------------------------------------

select function_privs_are('public', 'is_active_access', array['uuid'], 'authenticated', array['EXECUTE'],
  'authenticated can call is_active_access (the RLS policies need it)');
select function_privs_are('public', 'is_active_access', array['uuid'], 'anon', array[]::text[],
  'anon cannot call is_active_access');
select function_privs_are('public', 'current_clinic_id', array[]::text[], 'authenticated', array['EXECUTE'],
  'authenticated can call current_clinic_id (the veterinarians policy needs it)');
select function_privs_are('public', 'current_clinic_id', array[]::text[], 'anon', array[]::text[],
  'anon cannot call current_clinic_id');
select function_privs_are('public', 'start_access_session', array[]::text[], 'authenticated', array['EXECUTE'],
  'authenticated can start an access session');
select function_privs_are('public', 'start_access_session', array[]::text[], 'anon', array[]::text[],
  'anon cannot start an access session');
select function_privs_are('public', 'touch_access_session', array['uuid'], 'authenticated', array['EXECUTE'],
  'authenticated can touch an access session');
select function_privs_are('public', 'touch_access_session', array['uuid'], 'anon', array[]::text[],
  'anon cannot touch an access session');
select function_privs_are('public', 'revoke_access_session', array['uuid'], 'authenticated', array['EXECUTE'],
  'authenticated can revoke an access session');
select function_privs_are('public', 'revoke_access_session', array['uuid'], 'anon', array[]::text[],
  'anon cannot revoke an access session');
select function_privs_are('public', 'revoke_access_sessions', array[]::text[], 'authenticated', array['EXECUTE'],
  'authenticated can revoke its access sessions');
select function_privs_are('public', 'revoke_access_sessions', array[]::text[], 'anon', array[]::text[],
  'anon cannot revoke access sessions');
select function_privs_are('public', 'approve_clinical_record', array['uuid'], 'authenticated', array['EXECUTE'],
  'authenticated can approve through the server-side path');
select function_privs_are('public', 'approve_clinical_record', array['uuid'], 'anon', array[]::text[],
  'anon cannot approve');

-- ---------------------------------------------------------------------------
-- Internal helpers: only reachable from security-definer functions and triggers.
-- ---------------------------------------------------------------------------

select function_privs_are('public', 'insert_clinical_audit_event',
  array['text', 'uuid', 'text', 'jsonb', 'uuid'], 'authenticated', array[]::text[],
  'the audit trail is not writable through an RPC');
select function_privs_are('public', 'log_server_event',
  array['text', 'text', 'text', 'timestamptz', 'jsonb'], 'authenticated', array[]::text[],
  'server logs are not writable through an RPC');
select function_privs_are('public', 'request_id', array[]::text[], 'authenticated', array[]::text[],
  'request_id is internal');
select function_privs_are('public', 'clinical_record_action',
  array['text', 'text', 'text', 'jsonb'], 'authenticated', array[]::text[],
  'clinical_record_action is internal');

-- ---------------------------------------------------------------------------
-- Supabase lint 0011: invoker functions pin their search_path too.
-- ---------------------------------------------------------------------------

select ok(
  (select proconfig @> array['search_path=public, extensions']
   from pg_proc where oid = 'public.guard_approved_clinical_record()'::regprocedure),
  'guard_approved_clinical_record pins search_path'
);
select ok(
  (select proconfig @> array['search_path=public, extensions']
   from pg_proc where oid = 'public.stamp_update_attribution()'::regprocedure),
  'stamp_update_attribution pins search_path'
);
select ok(
  (select proconfig @> array['search_path=public, extensions']
   from pg_proc where oid = 'public.deny_attribution_mutation()'::regprocedure),
  'deny_attribution_mutation pins search_path'
);
select ok(
  (select proconfig @> array['search_path=public, extensions']
   from pg_proc where oid = 'public.clinical_record_action(text, text, text, jsonb)'::regprocedure),
  'clinical_record_action pins search_path'
);

-- ---------------------------------------------------------------------------
-- Functions created from now on start closed.
-- ---------------------------------------------------------------------------

create function public.review_privileges_probe() returns integer language sql as 'select 1';
select function_privs_are('public', 'review_privileges_probe', array[]::text[], 'authenticated', array[]::text[],
  'a new public function is not executable by authenticated by default');
select function_privs_are('public', 'review_privileges_probe', array[]::text[], 'anon', array[]::text[],
  'a new public function is not executable by anon by default');

select * from finish();
rollback;
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `supabase test db`

Expected: FAIL en `004_function_privileges.sql`. Fallan las siete aserciones `anon cannot …`, porque hoy `anon` hereda `EXECUTE`. Fallan también las cuatro de las funciones internas, las de `search_path` de `guard_approved_clinical_record` y `clinical_record_action`, y las dos de `review_privileges_probe`.

- [ ] **Step 3: Escribir la migración**

`supabase/migrations/005_function_privileges.sql`:

```sql
-- Review #4 follow-up (T076): functions are not executable unless granted on purpose.
--
-- Supabase grants EXECUTE on new public functions to anon and authenticated, and Postgres
-- grants it to PUBLIC. Revoke both, now and for future functions, then grant back only what
-- the app and the RLS policies call. Trigger functions need no grant: EXECUTE is checked
-- when the trigger is created, not when it fires, and the helpers below are only called
-- from security-definer functions, which run as their owner.

alter function public.guard_approved_clinical_record() set search_path = public, extensions;
alter function public.clinical_record_action(text, text, text, jsonb)
  set search_path = public, extensions;

revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- Evaluated by the RLS policies as the querying role.
grant execute on function public.is_active_access(uuid) to authenticated;
grant execute on function public.current_clinic_id() to authenticated;

-- The app's RPCs (contracts/auth-session.md, contracts/clinical-attribution.md).
grant execute on function public.start_access_session() to authenticated;
grant execute on function public.touch_access_session(uuid) to authenticated;
grant execute on function public.revoke_access_session(uuid) to authenticated;
grant execute on function public.revoke_access_sessions() to authenticated;
grant execute on function public.approve_clinical_record(uuid) to authenticated;
```

- [ ] **Step 4: Aplicar y verificar que pasa, y que la app sigue funcionando**

```bash
supabase db reset
bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json
supabase test db
SUPABASE_LIVE_TESTS=1 bun run test:integration
bun run test:e2e:web -- --project=chromium --workers=1
```

Expected: PASS en todo, con 24 aserciones en `004_function_privileges.sql`. Si una suite viva o e2e falla con `permission denied for function X`, a X le falta su `grant`: agrégalo a la migración con un comentario que diga quién la llama.

- [ ] **Step 5: Commit**

Marca T076 como `[X]`.

```bash
git add supabase/migrations/005_function_privileges.sql supabase/tests/004_function_privileges.sql specs/001-identidad-y-acceso/tasks.md
git commit -m "fix: close function EXECUTE by default and pin search_path (T076)"
```

---

### Task 5: Sesión de acceso ligada a la sesión de Auth (T077)

**Files:**
- Create: `supabase/tests/005_access_session_binding.sql`
- Create: `supabase/migrations/006_access_session_binding.sql`
- Modify: `supabase/tests/001_identity_access.sql` (claims y sesiones con `auth_session_id`)
- Modify: `supabase/tests/002_attribution_immutability.sql` (claims y sesiones con `auth_session_id`)
- Modify: `tests/integration/auth/access-session.test.ts` (prueba de dos dispositivos)
- Modify: `tests/e2e/web/auth.spec.ts` (la prueba de expiración envejece solo su propia sesión)
- Modify: `specs/001-identidad-y-acceso/data-model.md` (tabla «Sesión de acceso»)
- Modify: `src/lib/supabase/database.types.ts` (regenerado)

**Interfaces:**
- Consumes: la regla de la Task 4 de que toda función nueva necesita un `grant` explícito.
- Produces:
  - `public.access_sessions.auth_session_id uuid`: obligatorio mientras la sesión está viva, y único entre las sesiones vivas.
  - `public.current_auth_session_id() returns uuid`: interna, sin grant.
  - `public.current_access_session() returns jsonb`: `{ "id": uuid, "expiresAt": timestamptz }` o `null`, con grant a `authenticated`. La Task 6 la consume.
  - `public.revoke_current_access_session() returns boolean`: revoca solo la sesión de acceso de la sesión de Auth actual; es idempotente y tiene grant a `authenticated`. La Task 6 la usa en el logout.
  - `is_active_access` y `touch_access_session` solo aceptan la sesión ligada al `session_id` del JWT de la petición.

- [ ] **Step 1: Escribir la suite pgTap nueva, que falla**

`supabase/tests/005_access_session_binding.sql`:

```sql
begin;
select plan(15);

-- Arrange: one veterinarian who signs in on two devices, i.e. two Supabase Auth sessions.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a5a5a5a5-0000-0000-0000-0000000000a5',
   'authenticated', 'authenticated', 'ana.binding@example.test', 'not-a-real-hash',
   timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()));

insert into public.clinics (id, name)
values ('c5c5c5c5-0000-0000-0000-0000000000c5', 'Clínica de prueba de sesiones');

insert into public.veterinarians (id, clinic_id, identifier, display_name)
values ('a5a5a5a5-0000-0000-0000-0000000000a5', 'c5c5c5c5-0000-0000-0000-0000000000c5',
        'ana.binding@example.test', 'Ana Sesiones');

-- ---------------------------------------------------------------------------
-- Device 1 signs in.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a5a5a5a5-0000-0000-0000-0000000000a5","role":"authenticated","session_id":"5e510000-0000-0000-0000-000000000001"}',
  true);
set local role authenticated;
select lives_ok($$select public.start_access_session()$$,
  'device 1 starts an access session bound to its Auth session');
select ok(public.is_active_access(), 'device 1 has clinical access');
select ok(public.current_access_session() is not null, 'device 1 can resume its own access session');
reset role;

-- ---------------------------------------------------------------------------
-- Device 2 signs in (D1: several devices at once).
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a5a5a5a5-0000-0000-0000-0000000000a5","role":"authenticated","session_id":"5e520000-0000-0000-0000-000000000002"}',
  true);
set local role authenticated;
select lives_ok($$select public.start_access_session()$$, 'device 2 starts its own access session');
select ok(public.is_active_access(), 'device 2 has clinical access');
-- Starting again within the same Auth session (a retried start) replaces only that one.
select lives_ok($$select public.start_access_session()$$,
  'device 2 can start again within the same Auth session');
select is(
  (select count(*)::int from public.access_sessions
   where auth_session_id = '5e520000-0000-0000-0000-000000000002' and revoked_at is null),
  1,
  'an Auth session never holds two live access sessions'
);
reset role;

-- ---------------------------------------------------------------------------
-- Back on device 1: still active, and bound to its own access session only.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a5a5a5a5-0000-0000-0000-0000000000a5","role":"authenticated","session_id":"5e510000-0000-0000-0000-000000000001"}',
  true);
set local role authenticated;
select ok(public.is_active_access(), 'device 1 keeps clinical access while device 2 is signed in');
select is(
  public.current_access_session() ->> 'id',
  (select id::text from public.access_sessions
   where auth_session_id = '5e510000-0000-0000-0000-000000000001' and revoked_at is null),
  'device 1 resumes its own access session, never device 2''s'
);
select is(
  public.touch_access_session(
    (select id from public.access_sessions
     where auth_session_id = '5e520000-0000-0000-0000-000000000002' and revoked_at is null)
  ),
  false,
  'device 1 cannot keep device 2''s access session alive'
);

-- Device 1 logs out: only its own access session ends.
select lives_ok($$select public.revoke_current_access_session()$$, 'device 1 logs out');
select ok(not public.is_active_access(), 'device 1 lost clinical access after its own logout');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"a5a5a5a5-0000-0000-0000-0000000000a5","role":"authenticated","session_id":"5e520000-0000-0000-0000-000000000002"}',
  true);
set local role authenticated;
select ok(public.is_active_access(), 'device 2 keeps clinical access after device 1 logs out');
reset role;

-- ---------------------------------------------------------------------------
-- A token without an Auth session_id cannot start an access session.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"a5a5a5a5-0000-0000-0000-0000000000a5","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.start_access_session()$$, '42501', 'AUTHENTICATION_REQUIRED',
  'a token without an Auth session_id cannot start an access session');
reset role;

select function_privs_are('public', 'current_auth_session_id', array[]::text[], 'authenticated',
  array[]::text[], 'current_auth_session_id is internal');

select * from finish();
rollback;
```

- [ ] **Step 2: Adaptar 001 y 002 al vínculo**

Tras la migración, una sesión viva sin `auth_session_id` viola una restricción, y el `session_id` tiene que viajar en `request.jwt.claims`. `auth.uid()` también lee `sub` de ahí.

En `supabase/tests/001_identity_access.sql`:

1. Reemplaza:

```sql
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
```

por:

```sql
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated","session_id":"5e5a0000-0000-0000-0000-00000000000a"}',
  true);
```

2. Reemplaza:

```sql
insert into public.access_sessions (id, veterinarian_id)
values ('eeeeeeee-0000-0000-0000-00000000000e', 'aaaaaaaa-0000-0000-0000-00000000000a');
```

por:

```sql
insert into public.access_sessions (id, veterinarian_id, auth_session_id)
values ('eeeeeeee-0000-0000-0000-00000000000e', 'aaaaaaaa-0000-0000-0000-00000000000a',
        '5e5a0000-0000-0000-0000-00000000000a');
```

3. Reemplaza:

```sql
insert into public.access_sessions (veterinarian_id)
values ('bbbbbbbb-0000-0000-0000-00000000000b');
```

por:

```sql
insert into public.access_sessions (veterinarian_id, auth_session_id)
values ('bbbbbbbb-0000-0000-0000-00000000000b', '5e5b0000-0000-0000-0000-00000000000b');
```

En `supabase/tests/002_attribution_immutability.sql`:

1. Reemplaza:

```sql
insert into public.access_sessions (veterinarian_id)
values ('a2a2a2a2-0000-0000-0000-0000000000a2'), ('b2b2b2b2-0000-0000-0000-0000000000b2');
```

por:

```sql
insert into public.access_sessions (veterinarian_id, auth_session_id)
values ('a2a2a2a2-0000-0000-0000-0000000000a2', '5e5a2000-0000-0000-0000-0000000000a2'),
       ('b2b2b2b2-0000-0000-0000-0000000000b2', '5e5b2000-0000-0000-0000-0000000000b2');
```

2. Reemplaza:

```sql
select set_config('request.jwt.claim.sub', 'a2a2a2a2-0000-0000-0000-0000000000a2', true);
```

por:

```sql
select set_config('request.jwt.claims',
  '{"sub":"a2a2a2a2-0000-0000-0000-0000000000a2","role":"authenticated","session_id":"5e5a2000-0000-0000-0000-0000000000a2"}',
  true);
```

3. Reemplaza:

```sql
select set_config('request.jwt.claim.sub', 'b2b2b2b2-0000-0000-0000-0000000000b2', true);
```

por:

```sql
select set_config('request.jwt.claims',
  '{"sub":"b2b2b2b2-0000-0000-0000-0000000000b2","role":"authenticated","session_id":"5e5b2000-0000-0000-0000-0000000000b2"}',
  true);
```

`supabase/tests/fixtures/attribution.sql` y `003_attribution_columns.sql` no cambian: ejercen triggers como superusuario y no pasan por `is_active_access`.

- [ ] **Step 3: Agregar la prueba viva de dos dispositivos**

En `tests/integration/auth/access-session.test.ts`, dentro del `describe.skipIf(...)`, después de la prueba `more than eight hours idle expires the session server-side (FR-061)`:

```ts
  test("two devices hold separate access sessions, and logging out ends only one (D1)", async () => {
    const firstDevice = await signedInVeterinarian(ANA);
    const secondDevice = await signedInVeterinarian(ANA);

    const firstResume = await firstDevice.client.rpc("current_access_session");
    expect((firstResume.data as { id: string } | null)?.id).toBe(firstDevice.accessSessionId);
    const secondResume = await secondDevice.client.rpc("current_access_session");
    expect((secondResume.data as { id: string } | null)?.id).toBe(secondDevice.accessSessionId);

    const revoked = await firstDevice.client.rpc("revoke_current_access_session");
    expect(revoked.error).toBeNull();
    await expectClinicalAccessDenied(firstDevice);

    const stillActive = await secondDevice.client.rpc("touch_access_session", {
      p_session_id: secondDevice.accessSessionId,
    });
    expect(stillActive.data).toBe(true);
  });
```

- [ ] **Step 4: Ejecutar y verificar que falla**

```bash
supabase test db
SUPABASE_LIVE_TESTS=1 bun run test:integration
```

Expected: FAIL.

- `005_access_session_binding.sql` falla desde la primera aserción, porque `current_access_session` no existe.
- `001` y `002` fallan en los INSERT, porque la columna `auth_session_id` no existe.
- La prueba viva nueva falla porque falta la función `current_access_session`.

- [ ] **Step 5: Escribir la migración**

`supabase/migrations/006_access_session_binding.sql`:

```sql
-- Review #4 follow-up (T077): an access session belongs to one Supabase Auth session.
--
-- is_active_access used to accept any live access session of the veterinarian, so a device
-- whose access had been revoked kept passing RLS while another device was active, and a
-- reload adopted the other device's session. Every access session now records the Auth
-- session_id of the JWT that started it, and only a JWT of that Auth session authorizes
-- clinical access. A veterinarian may be signed in on several devices at once (decision D1):
-- each device holds its own access session, and logging out ends only that one.

alter table public.access_sessions add column auth_session_id uuid;

-- Sessions started before this migration are bound to no Auth session: end them, so every
-- veterinarian signs in again into a bound session.
update public.access_sessions
set revoked_at = timezone('utc', now())
where revoked_at is null;

alter table public.access_sessions
  add constraint access_sessions_live_sessions_are_bound
  check (revoked_at is not null or auth_session_id is not null);

create unique index access_sessions_live_auth_session_idx
  on public.access_sessions(auth_session_id)
  where revoked_at is null;

-- Internal: not granted to any API role (005 closes new functions by default).
create or replace function public.current_auth_session_id()
returns uuid
language sql
stable
set search_path = public, extensions
as $$
  select nullif(auth.jwt() ->> 'session_id', '')::uuid;
$$;

create or replace function public.is_active_access(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    p_user_id is not null
    and auth.uid() is not null
    -- Answering for an arbitrary uuid would let a veterinarian probe a colleague (T072).
    and p_user_id = auth.uid()
    and exists (
      select 1
      from public.access_sessions access_session
      join public.veterinarians veterinarian
        on veterinarian.id = access_session.veterinarian_id
      where veterinarian.id = p_user_id
        and access_session.auth_session_id = public.current_auth_session_id()
        and access_session.revoked_at is null
        and access_session.last_activity_at > timezone('utc', now()) - interval '8 hours'
        and access_session.expires_at > timezone('utc', now())
    );
$$;

create or replace function public.start_access_session()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  started_at timestamptz := clock_timestamp();
  current_user_id uuid := auth.uid();
  auth_session uuid := public.current_auth_session_id();
  session_id uuid;
  session_expires_at timestamptz;
begin
  if current_user_id is null or auth_session is null or not exists (
    select 1 from public.veterinarians where id = current_user_id
  ) then
    perform public.log_server_event(
      'access_session_start', 'start_access_session', 'authentication_required', started_at
    );
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  -- D1: several devices at once. Only a previous access session of this same Auth session
  -- is replaced (a retried start, for instance), never another device's.
  update public.access_sessions
  set revoked_at = timezone('utc', now())
  where auth_session_id = auth_session and revoked_at is null;

  insert into public.access_sessions (veterinarian_id, auth_session_id)
  values (current_user_id, auth_session)
  returning id, expires_at into session_id, session_expires_at;

  perform public.log_server_event(
    'access_session_start', 'start_access_session', 'ok', started_at,
    jsonb_build_object('sessionId', session_id)
  );

  return jsonb_build_object('id', session_id, 'expiresAt', session_expires_at);
end;
$$;

create or replace function public.touch_access_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  started_at timestamptz := clock_timestamp();
  touched boolean;
begin
  update public.access_sessions
  set last_activity_at = timezone('utc', now()),
      expires_at = timezone('utc', now()) + interval '8 hours'
  where id = p_session_id
    and veterinarian_id = auth.uid()
    and auth_session_id = public.current_auth_session_id()
    and revoked_at is null
    and last_activity_at > timezone('utc', now()) - interval '8 hours';

  touched := found;

  perform public.log_server_event(
    'access_session_touch', 'touch_access_session',
    case when touched then 'ok' else 'authentication_required' end,
    started_at, jsonb_build_object('sessionId', p_session_id)
  );

  return touched;
end;
$$;

-- Restoring a Supabase session (reload, relaunch) resumes only the access session bound to
-- that same Auth session. Returns null when there is none, and the app then signs out.
create or replace function public.current_access_session()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object('id', access_session.id, 'expiresAt', access_session.expires_at)
  from public.access_sessions access_session
  where access_session.veterinarian_id = auth.uid()
    and access_session.auth_session_id = public.current_auth_session_id()
    and access_session.revoked_at is null
    and access_session.last_activity_at > timezone('utc', now()) - interval '8 hours'
    and access_session.expires_at > timezone('utc', now());
$$;

grant execute on function public.current_access_session() to authenticated;

-- Logout ends only this device's access session (D1). Idempotent, like the Auth sign-out
-- that follows it (contracts/auth-session.md).
create or replace function public.revoke_current_access_session()
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  started_at timestamptz := clock_timestamp();
begin
  update public.access_sessions
  set revoked_at = timezone('utc', now())
  where veterinarian_id = auth.uid()
    and auth_session_id = public.current_auth_session_id()
    and revoked_at is null;

  perform public.log_server_event(
    'access_session_revoke', 'revoke_current_access_session', 'ok', started_at
  );

  return true;
end;
$$;

grant execute on function public.revoke_current_access_session() to authenticated;
```

`create or replace` conserva los grants de `is_active_access`, `start_access_session` y `touch_access_session` que concedió la migración 005.

- [ ] **Step 6: Aplicar, regenerar tipos y verificar que pasa**

```bash
supabase db reset
bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json
bun run db:types
supabase test db
SUPABASE_LIVE_TESTS=1 bun run test:integration
bun run typecheck
```

Expected:

- `supabase test db` pasa, con 15 aserciones en `005`. `001` y `002` mantienen su `plan()`.
- Las suites vivas pasan, incluida la de dos dispositivos.
- `typecheck` pasa: `rpc("current_access_session")` ya está tipada.

- [ ] **Step 7: La prueba de expiración envejece solo su propia sesión (D1)**

Las pruebas e2e corren en paralelo y varias inician sesión como Ana. Hoy la prueba `unsaved notes survive an expired session…` de `tests/e2e/web/auth.spec.ts` envejece **todas** las sesiones vivas de Ana (`veterinarian_id=eq.${userId}`), incluidas las de otras pruebas en curso. Debe envejecer solo la de su propio contexto.

En esa prueba, reemplaza:

```ts
    const { userId } = await readSupabaseSession(page);
```

por:

```ts
    const { accessToken } = await readSupabaseSession(page);
    // Age only this page's access session: other tests hold Ana's sessions in parallel (D1).
    const authSessionId = (
      JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")) as {
        session_id?: string;
      }
    ).session_id;
    if (!authSessionId) {
      throw new Error("The access token carries no session_id claim.");
    }
```

Y reemplaza:

```ts
        `/rest/v1/access_sessions?veterinarian_id=eq.${userId}&revoked_at=is.null`,
```

por:

```ts
        `/rest/v1/access_sessions?auth_session_id=eq.${authSessionId}&revoked_at=is.null`,
```

Si `userId` se usa más adelante en esa misma prueba, conserva también `userId` en la desestructuración. `bunx biome ci .` avisa si queda una variable sin usar.

Run: `bunx biome ci . && bun run test:e2e:web -- --project=chromium`

Expected: PASS en toda la suite en paralelo, incluidas la de recarga y la de expiración con restauración del borrador.

- [ ] **Step 8: Documentar el vínculo en el modelo de datos**

En `specs/001-identidad-y-acceso/data-model.md`, sección «Sesión de acceso», reemplaza la fila:

```markdown
| `token_hash` | `bytea` | Único; hash de un token opaco aleatorio, nunca el token en claro |
```

por:

```markdown
| `token_hash` | `bytea` | Único; nonce interno aleatorio. El vínculo con Auth es `auth_session_id` |
| `auth_session_id` | `uuid` | `session_id` del JWT de Supabase Auth que inició la sesión; obligatorio y único mientras está activa; solo un JWT de esa sesión de Auth autoriza acceso clínico |
```

- [ ] **Step 9: Commit**

Marca T077 como `[X]`.

```bash
git add supabase/migrations/006_access_session_binding.sql supabase/tests/005_access_session_binding.sql supabase/tests/001_identity_access.sql supabase/tests/002_attribution_immutability.sql tests/integration/auth/access-session.test.ts tests/e2e/web/auth.spec.ts specs/001-identidad-y-acceso/data-model.md src/lib/supabase/database.types.ts specs/001-identidad-y-acceso/tasks.md
git commit -m "fix: bind access sessions to the Supabase Auth session (T077)"
```

---

### Task 6: Restaurar y cerrar solo la sesión propia en el cliente (T078)

**Files:**
- Create: `tests/unit/auth/current-access-session.test.ts`
- Modify: `src/features/auth/access-session-service.ts` (al final)
- Modify: `src/features/auth/auth-provider.tsx` (`loadIdentity` y los dos `signOut` de recuperación)
- Modify: `src/features/auth/auth-service.ts` (`AuthClient.auth.signOut`, `signOut`, `signInWithPassword`)
- Modify: `tests/integration/auth/auth-contract.test.ts` (prueba de logout)
- Modify: `tests/integration/auth/access-session.test.ts` (el logout imita al de la app)
- Modify: `specs/001-identidad-y-acceso/contracts/auth-session.md`

**Interfaces:**
- Consumes: las RPC `current_access_session()`, que devuelve `{ id, expiresAt } | null`, y `revoke_current_access_session()`, ambas de la Task 5.
- Produces:

```ts
export type CurrentAccessSession = { id: string; expiresAt: string };
export async function getCurrentAccessSession(
  client: AccessSessionRpcClient,
): Promise<CurrentAccessSession | null>;
```

- [ ] **Step 1: Escribir la prueba que falla**

`tests/unit/auth/current-access-session.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  type AccessSessionRpcClient,
  getCurrentAccessSession,
} from "@/features/auth/access-session-service";

function rpcReturning(data: unknown, error: { message: string } | null = null) {
  const calls: string[] = [];
  const client: AccessSessionRpcClient = {
    rpc: async <T>(functionName: string) => {
      calls.push(functionName);
      return { data: data as T | null, error };
    },
  };
  return { client, calls };
}

describe("getCurrentAccessSession (review #4, finding 5)", () => {
  test("resumes the access session bound to the current Auth session", async () => {
    const { client, calls } = rpcReturning({
      id: "session-1",
      expiresAt: "2026-09-11T20:00:00.000Z",
    });
    expect(await getCurrentAccessSession(client)).toEqual({
      id: "session-1",
      expiresAt: "2026-09-11T20:00:00.000Z",
    });
    expect(calls).toEqual(["current_access_session"]);
  });

  test("returns null when this Auth session has no live access session", async () => {
    const { client } = rpcReturning(null);
    expect(await getCurrentAccessSession(client)).toBeNull();
  });

  test("returns null for a malformed payload instead of trusting it", async () => {
    const { client } = rpcReturning({ id: 42 });
    expect(await getCurrentAccessSession(client)).toBeNull();
  });

  test("surfaces an RPC failure", async () => {
    const { client } = rpcReturning(null, { message: "network down" });
    await expect(getCurrentAccessSession(client)).rejects.toThrow("network down");
  });
});
```

- [ ] **Step 2: Ejecutarla y verificar que falla**

Run: `bun test tests/unit/auth/current-access-session.test.ts`

Expected: FAIL con `Export named 'getCurrentAccessSession' not found` o similar.

- [ ] **Step 3: Implementar**

Al final de `src/features/auth/access-session-service.ts`:

```ts
export type CurrentAccessSession = { id: string; expiresAt: string };

/**
 * The access session bound to the Auth session of the current JWT, or null. A restored
 * Supabase session must resume only this one: the newest non-revoked row of the
 * veterinarian could belong to another device.
 */
export async function getCurrentAccessSession(
  client: AccessSessionRpcClient,
): Promise<CurrentAccessSession | null> {
  const { data, error } = await client.rpc<unknown>("current_access_session");
  if (error) {
    throw new Error(error.message);
  }
  if (!data || typeof data !== "object") {
    return null;
  }
  const { id, expiresAt } = data as { id?: unknown; expiresAt?: unknown };
  return typeof id === "string" && typeof expiresAt === "string" ? { id, expiresAt } : null;
}
```

- [ ] **Step 4: Ejecutar la prueba y verificar que pasa**

Run: `bun test tests/unit/auth/current-access-session.test.ts`

Expected: PASS, con 4 pruebas.

- [ ] **Step 5: Usarla en `loadIdentity`**

En `src/features/auth/auth-provider.tsx`:

1. Agrega el import:

```ts
import {
  type AccessSessionRpcClient,
  getCurrentAccessSession,
} from "@/features/auth/access-session-service";
```

2. Después de `const AuthContext = createContext<AuthContextValue | null>(null);`, agrega:

```ts
const accessSessionClient = supabase as unknown as AccessSessionRpcClient;
```

3. En `loadIdentity`, reemplaza:

```ts
  let sessionId = accessSessionId;
  if (!sessionId) {
    const { data: accessSession, error: sessionError } = await supabase
      .from("access_sessions")
      .select("id")
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sessionError) {
      throw sessionError;
    }
    sessionId = accessSession?.id;
  }
  if (!sessionId) {
    return null;
  }
```

por:

```ts
  // Only the access session bound to *this* Auth session may be resumed: the newest
  // non-revoked row could belong to another device (review #4, finding 5).
  const sessionId =
    accessSessionId ?? (await getCurrentAccessSession(accessSessionClient))?.id;
  if (!sessionId) {
    return null;
  }
```

Run: `bunx biome check --write src/features/auth/auth-provider.tsx && bun run typecheck`

Expected: PASS. Biome ordena los imports.

- [ ] **Step 6: Actualizar el contrato**

En `specs/001-identidad-y-acceso/contracts/auth-session.md`, reemplaza:

```markdown
La función `is_active_access(auth.uid())`, usada por las policies RLS, devuelve falso cuando no existe
una sesión no revocada cuya actividad tenga menos de ocho horas. Por tanto, una llamada directa que
evite Expo Router sigue siendo denegada.
```

por:

```markdown
La función `is_active_access(auth.uid())`, usada por las policies RLS, devuelve falso cuando no existe
una sesión no revocada cuya actividad tenga menos de ocho horas y que esté ligada al `session_id` del
JWT de la petición. Por tanto, una llamada directa que evite Expo Router sigue siendo denegada, y un
token de otra sesión de Auth del mismo veterinario tampoco pasa.

## Restauración de sesión

Al reabrir la app o recargar la web con una sesión de Supabase restaurada, la app llama a
`current_access_session()`. La función devuelve la sesión de acceso ligada al `session_id` del JWT
actual, o `null`. Con `null`, la app cierra la sesión de Supabase de este dispositivo y conduce al
login. Iniciar sesión en otro dispositivo no afecta a las sesiones existentes.
```

- [ ] **Step 7: Escribir la prueba de logout que falla (D1)**

En `tests/integration/auth/auth-contract.test.ts`, reemplaza la prueba `makes logout safe to call repeatedly` completa por:

```ts
  test("logout ends only this device's session and is safe to call repeatedly (D1)", async () => {
    const scopes: unknown[] = [];
    const rpcCalls: string[] = [];
    const client = makeClient({
      signOut: async (options) => {
        scopes.push(options?.scope);
        return { error: null };
      },
    });
    const clientWithTrace = {
      ...client,
      rpc: async <T>(name: string) => {
        rpcCalls.push(name);
        return { data: true as T, error: null };
      },
    };

    await signOut(clientWithTrace);
    await signOut(clientWithTrace);
    expect(scopes).toEqual(["local", "local"]);
    expect(rpcCalls).toEqual(["revoke_current_access_session", "revoke_current_access_session"]);
  });
```

Run: `bun test tests/integration/auth/auth-contract.test.ts`

Expected: FAIL. `scopes` es `[undefined, undefined]` y `rpcCalls` contiene `revoke_access_sessions`.

- [ ] **Step 8: Cerrar solo el dispositivo actual**

En `src/features/auth/auth-service.ts`:

1. En el tipo `AuthClient`, reemplaza:

```ts
    signOut: () => Promise<{ error: unknown | null }>;
```

por:

```ts
    signOut: (options?: { scope?: "global" | "local" | "others" }) => Promise<{
      error: unknown | null;
    }>;
```

2. En el `catch` de `signInWithPassword`, reemplaza:

```ts
    await client.auth.signOut();
```

por:

```ts
    await client.auth.signOut({ scope: "local" });
```

3. Reemplaza el comienzo de `signOut`:

```ts
export async function signOut(client: AuthClient): Promise<void> {
  await client.rpc<boolean>("revoke_access_sessions");
  const { error } = await client.auth.signOut();
```

por:

```ts
export async function signOut(client: AuthClient): Promise<void> {
  // D1: a veterinarian may be signed in on several devices, so logout ends only this one.
  // supabase.auth.signOut() defaults to scope "global", which would end every device.
  await client.rpc<boolean>("revoke_current_access_session");
  const { error } = await client.auth.signOut({ scope: "local" });
```

En `src/features/auth/auth-provider.tsx`, reemplaza las dos apariciones de:

```ts
            await supabase.auth.signOut();
```

por:

```ts
            await supabase.auth.signOut({ scope: "local" });
```

Una está en `hydrate`, cuando no hay sesión de acceso viva, y otra en `signIn`, cuando la identidad no se puede cargar. Ninguna de las dos debe cerrar otros dispositivos.

En `tests/integration/auth/access-session.test.ts`, la prueba `after logout the previous token is denied clinical access (FR-061, SC-039)` debe hacer el mismo logout que la app. Reemplaza:

```ts
    await ana.client.rpc("revoke_access_sessions");
    await ana.client.auth.signOut();
```

por:

```ts
    await ana.client.rpc("revoke_current_access_session");
    await ana.client.auth.signOut({ scope: "local" });
```

En `specs/001-identidad-y-acceso/contracts/auth-session.md`, sección «Logout», reemplaza:

```markdown
La app llama a `revoke_access_sessions()` y después a `supabase.auth.signOut()`. Ambas operaciones
son idempotentes. Tras logout, RLS debe rechazar cualquier lectura o escritura clínica con la sesión
anterior.
```

por:

```markdown
Un veterinario puede tener sesiones abiertas en varios dispositivos a la vez. El logout cierra solo la
del dispositivo actual: la app llama a `revoke_current_access_session()` y después a
`supabase.auth.signOut({ scope: 'local' })`. Ambas operaciones son idempotentes. Tras logout, RLS debe
rechazar cualquier lectura o escritura clínica con la sesión anterior, y las sesiones de otros
dispositivos siguen activas. `revoke_access_sessions()` cierra la sesión en todos los dispositivos.
```

Run: `bun test tests/integration/auth/auth-contract.test.ts && bun run typecheck`

Expected: PASS.

- [ ] **Step 9: Verificar el flujo completo**

```bash
bun run test
SUPABASE_LIVE_TESTS=1 bun run test:integration
bun run test:e2e:web -- --project=chromium
```

Expected: PASS. Incluye la prueba e2e de identidad tras recargar, de la #3, y la de logout, que ahora solo revoca la sesión de su propio contexto.

- [ ] **Step 10: Commit**

Marca T078 como `[X]`.

```bash
git add src/features/auth tests/unit/auth/current-access-session.test.ts tests/integration/auth specs/001-identidad-y-acceso/contracts/auth-session.md specs/001-identidad-y-acceso/tasks.md
git commit -m "fix: resume and end only this device's access session (T078)"
```

---

### Task 7: Borradores válidos en SecureStore (T079)

**Files:**
- Create: `tests/unit/storage/draft-key.test.ts`
- Modify: `src/lib/storage/drafts.ts:8-10` (`draftStorageKey`)
- Modify: `src/features/clinical/draft-preserver.tsx` (las tres llamadas a `flush`)
- Modify: `tests/e2e/web/auth.spec.ts` (prefijo de la clave en dos `startsWith`)

**Interfaces:**
- Produces: `draftStorageKey(veterinarianId: string, consultationId: string): string`. Mantiene la firma, y la clave cumple `/^[\w.-]+$/`.

- [ ] **Step 1: Escribir la prueba que falla**

`tests/unit/storage/draft-key.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import type { AuthStorage } from "@/lib/storage/auth-storage";
import { createDraftStorage, draftStorageKey } from "@/lib/storage/drafts";

// expo-secure-store's isValidKey (packages/expo-secure-store/src/SecureStore.ts).
const SECURE_STORE_KEY = /^[\w.-]+$/;

/** In-memory storage that rejects keys exactly as SecureStore does on iOS and Android. */
function secureStoreLikeStorage(): AuthStorage {
  const values = new Map<string, string>();
  const ensureValidKey = (key: string) => {
    if (!SECURE_STORE_KEY.test(key)) {
      throw new Error("Invalid key provided to SecureStore.");
    }
  };
  return {
    getItem: async (key) => {
      ensureValidKey(key);
      return values.get(key) ?? null;
    },
    setItem: async (key, value) => {
      ensureValidKey(key);
      values.set(key, value);
    },
    removeItem: async (key) => {
      ensureValidKey(key);
      values.delete(key);
    },
  };
}

const VET = "a2a2a2a2-0000-0000-0000-0000000000a2";
const CONSULTATION = "d2d2d2d2-0000-0000-0000-0000000000d1";

describe("draft storage on native (review #4, finding 8)", () => {
  test("a draft key is a valid SecureStore key", () => {
    expect(draftStorageKey(VET, CONSULTATION)).toMatch(SECURE_STORE_KEY);
  });

  test("a route param with unsafe characters still yields a valid key", () => {
    expect(draftStorageKey(VET, "consulta:1/../x")).toMatch(SECURE_STORE_KEY);
  });

  test("a draft round-trips through SecureStore-like storage", async () => {
    const drafts = createDraftStorage(secureStoreLikeStorage());
    const draft = { notes: "Paciente estable", updatedAt: "2026-09-11T12:00:00.000Z" };

    await drafts.save(VET, CONSULTATION, draft);
    expect(await drafts.load(VET, CONSULTATION)).toEqual(draft);

    await drafts.remove(VET, CONSULTATION);
    expect(await drafts.load(VET, CONSULTATION)).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutarla y verificar que falla**

Run: `bun test tests/unit/storage/draft-key.test.ts`

Expected: FAIL.

- Las dos primeras pruebas fallan porque la clave contiene `:`.
- La tercera falla con `Invalid key provided to SecureStore.`

- [ ] **Step 3: Implementar la clave**

En `src/lib/storage/drafts.ts`, reemplaza:

```ts
export function draftStorageKey(veterinarianId: string, consultationId: string): string {
  return `diklass:draft:${veterinarianId}:${consultationId}`;
}
```

por:

```ts
// SecureStore keys may only contain alphanumerics, ".", "-" and "_", and the consultation id
// comes from a route param, so every other character is replaced. Segments never contain
// ".", which keeps the separator unambiguous.
const keySegment = (value: string) => value.replace(/[^\w-]/g, "_");

export function draftStorageKey(veterinarianId: string, consultationId: string): string {
  return `diklass.draft.${keySegment(veterinarianId)}.${keySegment(consultationId)}`;
}
```

- [ ] **Step 4: Ejecutar las pruebas de borrador y verificar que pasan**

Run: `bun test tests/unit/storage tests/unit/clinical`

Expected: PASS. Pasan `draft-key.test.ts`, `draft-storage.test.ts` y `draft-lifecycle.test.ts`.

- [ ] **Step 5: Reportar las escrituras fallidas en vez de dejarlas sin capturar**

En `src/features/clinical/draft-preserver.tsx`, después de `const DRAFT_DEBOUNCE_MS = 500;`, agrega:

```ts
// A failed write must not become an unhandled rejection: report it (Constitution IV).
function flushDraft(session: DraftSession) {
  session.flush().catch((error: unknown) => {
    void captureClientError(errorReporter, {
      error,
      operation: "save_draft",
      requestId: makeRequestId(),
    });
  });
}
```

Luego haz tres reemplazos.

1. Reemplaza:

```ts
    const timeout = setTimeout(() => void session.flush(), DRAFT_DEBOUNCE_MS);
```

por:

```ts
    const timeout = setTimeout(() => flushDraft(session), DRAFT_DEBOUNCE_MS);
```

2. Reemplaza:

```ts
    if (session && !isSessionActive) {
      void session.flush();
    }
```

por:

```ts
    if (session && !isSessionActive) {
      flushDraft(session);
    }
```

3. Reemplaza:

```ts
    () => () => {
      void session?.flush();
    },
```

por:

```ts
    () => () => {
      if (session) {
        flushDraft(session);
      }
    },
```

La prueba e2e de expiración busca la clave por prefijo. En `tests/e2e/web/auth.spec.ts`, reemplaza las dos apariciones de:

```ts
key.startsWith("diklass:draft:")
```

por:

```ts
key.startsWith("diklass.draft.")
```

Run: `bun run typecheck && bunx biome ci . && bun run test:e2e:web -- --project=chromium`

Expected: PASS. La prueba e2e de expiración con restauración del borrador sigue pasando en web.

- [ ] **Step 6: Commit**

Marca T079 como `[X]`.

```bash
git add src/lib/storage/drafts.ts src/features/clinical/draft-preserver.tsx tests/unit/storage/draft-key.test.ts tests/e2e/web/auth.spec.ts specs/001-identidad-y-acceso/tasks.md
git commit -m "fix: use SecureStore-safe draft keys and report failed draft writes (T079)"
```

---

### Task 8: Guard de atribución en snake_case (T080)

**Files:**
- Modify: `src/lib/attribution/types.ts:13-22` (`ATTRIBUTION_CONTROL_FIELDS`)
- Modify: `tests/unit/clinical/attribution-guards.test.ts` (reescritura)
- Modify: `tests/integration/attribution/shared-clinic.test.ts` (primer `describe`)

**Interfaces:**
- Produces: `ATTRIBUTION_CONTROL_FIELDS` pasa a tener los nombres de columna de `clinical_records`. `AttributionControlField` se deriva de la lista, así que cambia con ella.

- [ ] **Step 1: Reescribir la prueba**

`tests/unit/clinical/attribution-guards.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { AttributionInputError, assertNoClientAttributionFields } from "@/lib/attribution/guards";

const ATTRIBUTION_COLUMNS = [
  "actor_id",
  "created_by",
  "created_at",
  "updated_by",
  "updated_at",
  "approved_by",
  "approved_at",
];

describe("clinical attribution input (review #4, finding 11)", () => {
  test.each(ATTRIBUTION_COLUMNS)("rejects %s, as a PostgREST payload names it", (column) => {
    expect(() =>
      assertNoClientAttributionFields({ record_type: "patient", [column]: "another-vet" }),
    ).toThrow(AttributionInputError);
  });

  test("names the offending columns", () => {
    try {
      assertNoClientAttributionFields({ record_type: "epicrisis", approved_by: "vet-ana" });
      throw new Error("expected the guard to reject approved_by");
    } catch (error) {
      expect(error).toBeInstanceOf(AttributionInputError);
      expect((error as AttributionInputError).fields).toEqual(["approved_by"]);
    }
  });

  test("allows the domain columns a client must send, clinic_id included", () => {
    expect(() =>
      assertNoClientAttributionFields({
        clinic_id: "00000000-0000-0000-0000-000000000001",
        record_type: "patient",
        content: { name: "Luna" },
        status: "draft",
      }),
    ).not.toThrow();
  });
});
```

En `tests/integration/attribution/shared-clinic.test.ts`, reemplaza:

```ts
      assertNoClientAttributionFields({ note: "consulta", actorId: "vet-ana" }),
```

por:

```ts
      assertNoClientAttributionFields({ note: "consulta", created_by: "vet-ana" }),
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `bun test tests/unit/clinical/attribution-guards.test.ts tests/integration/attribution/shared-clinic.test.ts`

Expected: FAIL.

- Las siete pruebas `rejects …` fallan, porque ningún nombre snake_case está en la lista.
- `names the offending columns` falla.
- `allows … clinic_id included` pasa.
- La prueba no viva de `shared-clinic` falla.

- [ ] **Step 3: Implementar**

En `src/lib/attribution/types.ts`, reemplaza:

```ts
export const ATTRIBUTION_CONTROL_FIELDS = [
  "actorId",
  "createdBy",
  "createdAt",
  "updatedBy",
  "updatedAt",
  "approvedBy",
  "approvedAt",
  "clinicId",
] as const;
```

por:

```ts
/**
 * Attribution columns of `clinical_records`, named as PostgREST receives them. The database
 * enforces them too (column grants and triggers); this guard fails earlier, with a clearer
 * error. `clinic_id` is not here: a client must send it.
 */
export const ATTRIBUTION_CONTROL_FIELDS = [
  "actor_id",
  "created_by",
  "created_at",
  "updated_by",
  "updated_at",
  "approved_by",
  "approved_at",
] as const;
```

- [ ] **Step 4: Ejecutar y verificar que pasa, y buscar llamadores en camelCase**

```bash
bun test tests/unit/clinical/attribution-guards.test.ts tests/integration/attribution/shared-clinic.test.ts
git grep -n "assertNoClientAttributionFields" -- src tests
bun run typecheck
```

Expected:

- Las pruebas pasan.
- El `grep` solo muestra `clinical-mutations.ts`, `guards.ts` y las dos pruebas. Si aparece otro llamador que construya el payload en camelCase, pásalo a snake_case.
- `typecheck` pasa.

- [ ] **Step 5: Commit**

Marca T080 como `[X]`.

```bash
git add src/lib/attribution/types.ts tests/unit/clinical/attribution-guards.test.ts tests/integration/attribution/shared-clinic.test.ts specs/001-identidad-y-acceso/tasks.md
git commit -m "fix: guard the snake_case attribution columns PostgREST receives (T080)"
```

---

### Task 9: `report-client-error` usable desde la web (T081)

**Files:**
- Create: `supabase/functions/report-client-error/handler.ts`
- Create: `supabase/functions/report-client-error/deno.json`
- Create: `tests/unit/observability/report-client-error-handler.test.ts`
- Create: `tests/integration/observability/report-client-error.test.ts`
- Modify: `supabase/functions/report-client-error/index.ts` (reescritura)
- Modify: `tsconfig.json` (`allowImportingTsExtensions`)

**Interfaces:**
- Consumes: el payload que envía `reportClientError` (`src/lib/observability/client-error-reporter.ts`): `{ operation, requestId, error: { name } }`, más la cabecera `x-request-id`.
- Produces (la Task 10 los extiende):

```ts
export const corsHeaders: Record<string, string>;
export const MAX_BODY_BYTES = 2048;
export type ReportDependencies = { log: (line: string) => void; randomId: () => string };
export async function handleClientErrorReport(request: Request, deps: ReportDependencies): Promise<Response>;
```

- [ ] **Step 1: Escribir las pruebas unitarias que fallan**

`tests/unit/observability/report-client-error-handler.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  corsHeaders,
  handleClientErrorReport,
  MAX_BODY_BYTES,
} from "../../../supabase/functions/report-client-error/handler";

const FUNCTION_URL = "http://localhost:54321/functions/v1/report-client-error";

function harness() {
  const lines: string[] = [];
  return {
    lines,
    deps: {
      log: (line: string) => {
        lines.push(line);
      },
      randomId: () => "generated-id",
    },
  };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(FUNCTION_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const validReport = { operation: "sign_in", requestId: "req-1", error: { name: "TypeError" } };

describe("report-client-error handler (review #4, finding 13)", () => {
  test("answers the CORS preflight a browser sends before invoking", async () => {
    const { deps, lines } = harness();
    const response = await handleClientErrorReport(
      new Request(FUNCTION_URL, { method: "OPTIONS" }),
      deps,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-headers")).toContain("x-request-id");
    expect(lines).toEqual([]);
  });

  test("accepts a valid report with CORS headers and logs identifiers only", async () => {
    const { deps, lines } = harness();
    const response = await handleClientErrorReport(
      post(
        { ...validReport, error: { name: "TypeError", message: "Luna, 12 kg" } },
        { "x-request-id": "req-header" },
      ),
      deps,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      corsHeaders["Access-Control-Allow-Origin"],
    );
    expect(await response.json()).toEqual({ accepted: true, requestId: "req-header" });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({
      event: "client_error",
      requestId: "req-header",
      operation: "sign_in",
      error: { name: "TypeError" },
    });
    expect(lines[0]).not.toContain("Luna");
  });

  test("rejects methods other than POST", async () => {
    const { deps, lines } = harness();
    const response = await handleClientErrorReport(
      new Request(FUNCTION_URL, { method: "GET" }),
      deps,
    );
    expect(response.status).toBe(405);
    expect(lines).toEqual([]);
  });

  test("rejects malformed JSON and payloads outside the schema", async () => {
    const { deps, lines } = harness();
    expect((await handleClientErrorReport(post("{not json"), deps)).status).toBe(400);
    expect((await handleClientErrorReport(post({ operation: "sign_in" }), deps)).status).toBe(400);
    expect(
      (
        await handleClientErrorReport(
          post({ ...validReport, operation: "drop table; --" }),
          deps,
        )
      ).status,
    ).toBe(400);
    expect(lines).toEqual([]);
  });

  test("rejects an oversized body before parsing it", async () => {
    const { deps, lines } = harness();
    const response = await handleClientErrorReport(post("x".repeat(MAX_BODY_BYTES + 1)), deps);
    expect(response.status).toBe(413);
    expect(lines).toEqual([]);
  });

  test("replaces an unsafe request id with a generated one", async () => {
    const { deps } = harness();
    const response = await handleClientErrorReport(
      post({ ...validReport, requestId: "bad id with spaces" }, { "x-request-id": "a".repeat(500) }),
      deps,
    );
    expect(await response.json()).toEqual({ accepted: true, requestId: "generated-id" });
  });
});
```

- [ ] **Step 2: Ejecutarlas y verificar que fallan**

Run: `bun test tests/unit/observability/report-client-error-handler.test.ts`

Expected: FAIL con `Cannot find module '../../../supabase/functions/report-client-error/handler'`.

- [ ] **Step 3: Implementar el handler**

`supabase/functions/report-client-error/handler.ts`:

```ts
import { z } from "zod";

/**
 * Every header supabase.functions.invoke sends from a browser must be allowed, or the
 * preflight fails and no report is sent (supabase.com/docs/guides/functions/cors).
 */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const MAX_BODY_BYTES = 2048;

const identifier = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[\w.-]+$/);

// Only identifiers travel: an error message can carry clinical content. Unknown keys are
// stripped by the schema, so they never reach the log.
export const clientErrorReportSchema = z.object({
  operation: identifier,
  requestId: z.string().min(1).max(160).optional(),
  error: z.object({ name: identifier }),
});

export type ReportDependencies = {
  log: (line: string) => void;
  randomId: () => string;
};

const respond = (body: Record<string, unknown>, status: number) =>
  Response.json(body, { status, headers: corsHeaders });

const safeRequestId = (value: string | null | undefined) =>
  value && value.length <= 160 && /^[\w.-]+$/.test(value) ? value : null;

export async function handleClientErrorReport(
  request: Request,
  deps: ReportDependencies,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const headerRequestId = safeRequestId(request.headers.get("x-request-id"));
  if (request.method !== "POST") {
    return respond({ code: "METHOD_NOT_ALLOWED", requestId: headerRequestId ?? deps.randomId() }, 405);
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return respond({ code: "PAYLOAD_TOO_LARGE", requestId: headerRequestId ?? deps.randomId() }, 413);
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    candidate = undefined;
  }
  const parsed = clientErrorReportSchema.safeParse(candidate);
  if (!parsed.success) {
    return respond({ code: "INVALID_INPUT", requestId: headerRequestId ?? deps.randomId() }, 400);
  }

  // The header wins so the id matches the SQL logs, which read x-request-id (request_id()).
  const requestId = headerRequestId ?? safeRequestId(parsed.data.requestId) ?? deps.randomId();
  deps.log(
    JSON.stringify({
      event: "client_error",
      requestId,
      operation: parsed.data.operation,
      error: { name: parsed.data.error.name },
      timestamp: new Date().toISOString(),
    }),
  );
  return respond({ accepted: true, requestId }, 200);
}
```

`supabase/functions/report-client-error/deno.json`:

```json
{
  "imports": {
    "zod": "npm:zod@^4.0.1"
  }
}
```

Reescribe `supabase/functions/report-client-error/index.ts`:

```ts
import { handleClientErrorReport } from "./handler.ts";

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

Deno.serve((request) =>
  handleClientErrorReport(request, {
    // Never persist request bodies, auth headers, tokens, or clinical content.
    log: (line) => console.error(line),
    randomId: () => crypto.randomUUID(),
  }),
);
```

Deno exige la extensión `.ts` en imports relativos, y `tsc` solo la acepta con esta opción. En `tsconfig.json`, dentro de `compilerOptions`, agrega esta línea antes de `"types"` (con `noEmit`, que viene de `expo/tsconfig.base`, es inocua):

```json
    "allowImportingTsExtensions": true,
```

- [ ] **Step 4: Ejecutar las pruebas unitarias y verificar que pasan**

Run: `bun test tests/unit/observability/report-client-error-handler.test.ts && bun run typecheck && bunx biome ci .`

Expected: PASS, con 6 pruebas, y `typecheck` y Biome limpios.

- [ ] **Step 5: Escribir la prueba viva**

`tests/integration/observability/report-client-error.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { anonymousClient, isLiveSupabase } from "../live-supabase";

const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const functionUrl = `${baseUrl}/functions/v1/report-client-error`;

describe.skipIf(!isLiveSupabase)("report-client-error against local Supabase", () => {
  test("a browser preflight from the web app's origin is allowed", async () => {
    const response = await fetch(functionUrl, {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:8083",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers":
          "authorization, apikey, content-type, x-client-info, x-request-id",
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  test("the app's reporter reaches the function", async () => {
    const { error } = await anonymousClient().functions.invoke("report-client-error", {
      body: { operation: "sign_in", requestId: "live-test", error: { name: "TypeError" } },
      headers: { "x-request-id": "live-test" },
    });
    expect(error).toBeNull();
  });
});
```

- [ ] **Step 6: Ejecutarla contra el stack local**

`supabase start` levanta `edge-runtime` con las funciones de `supabase/functions`. Reinicia el stack para que tome el código nuevo:

```bash
supabase stop && supabase start
bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json
SUPABASE_LIVE_TESTS=1 bun test tests/integration/observability/report-client-error.test.ts
```

Expected: PASS, con 2 pruebas.

Si el preflight responde `401`, el gateway está exigiendo JWT también en `OPTIONS`. En ese caso:

1. Agrega a `supabase/config.toml`:

```toml
[functions.report-client-error]
verify_jwt = false
```

2. Documenta en el commit por qué se desactivó. La función no toca datos (D2) y la Task 10 limita la tasa.
3. Vuelve a ejecutar.

- [ ] **Step 7: Commit**

Marca T081 como `[X]`.

```bash
git add supabase/functions/report-client-error tsconfig.json tests/unit/observability/report-client-error-handler.test.ts tests/integration/observability/report-client-error.test.ts specs/001-identidad-y-acceso/tasks.md
git commit -m "fix: make report-client-error reachable from the web and validate its payload (T081)"
```

---

### Task 10: Límite de tasa de `report-client-error` (T082)

**Files:**
- Create: `supabase/tests/006_client_error_quota.sql`
- Create: `supabase/migrations/007_client_error_quota.sql`
- Modify: `supabase/functions/report-client-error/handler.ts` (dependencia `consumeQuota`)
- Modify: `supabase/functions/report-client-error/index.ts` (cliente con service role)
- Modify: `supabase/functions/report-client-error/deno.json` (import de supabase-js)
- Modify: `tests/unit/observability/report-client-error-handler.test.ts` (`harness` y pruebas nuevas)
- Modify: `src/lib/supabase/database.types.ts` (regenerado)

**Interfaces:**
- Consumes: `ReportDependencies` y `handleClientErrorReport` de la Task 9.
- Produces:
  - `public.consume_client_error_quota(p_bucket_key text, p_limit integer default 30) returns boolean`, que solo puede llamar `service_role`.
  - `ReportDependencies` pasa a ser `{ log; randomId; consumeQuota: (bucketKey: string) => Promise<boolean> }`.
  - `CLIENT_ERROR_REPORTS_PER_MINUTE = 30`.

- [ ] **Step 1: Escribir la suite pgTap que falla**

`supabase/tests/006_client_error_quota.sql`:

```sql
begin;
select plan(5);

-- now() is fixed for the whole transaction, so every call lands in the same minute window.
select is(
  (select bool_and(public.consume_client_error_quota('ip:198.51.100.7', 3))
   from generate_series(1, 3)),
  true,
  'reports within the per-minute limit are accepted'
);
select is(
  public.consume_client_error_quota('ip:198.51.100.7', 3),
  false,
  'the report over the limit is refused'
);
select is(
  public.consume_client_error_quota('ip:203.0.113.9', 3),
  true,
  'another caller keeps its own quota'
);
select function_privs_are('public', 'consume_client_error_quota', array['text', 'integer'],
  'anon', array[]::text[], 'anon cannot consume quota directly');
select function_privs_are('public', 'consume_client_error_quota', array['text', 'integer'],
  'authenticated', array[]::text[], 'authenticated cannot consume quota directly');

select * from finish();
rollback;
```

- [ ] **Step 2: Ejecutarla y verificar que falla**

Run: `supabase test db`

Expected: FAIL en `006_client_error_quota.sql`, con `function public.consume_client_error_quota(unknown, integer) does not exist`.

- [ ] **Step 3: Escribir la migración**

`supabase/migrations/007_client_error_quota.sql`:

```sql
-- Review #4 follow-up (T082): bound the log volume report-client-error can produce.
--
-- The anon key is public and passes verify_jwt, so without a quota anyone could flood the
-- logs. The counter lives in a schema the Data API does not expose; only the Edge
-- Function, with the service role, consumes it.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.client_error_quota (
  bucket_key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket_key, window_start)
);

create or replace function public.consume_client_error_quota(
  p_bucket_key text,
  p_limit integer default 30
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_window timestamptz := date_trunc('minute', timezone('utc', now()));
  total integer;
begin
  insert into private.client_error_quota as quota (bucket_key, window_start, hits)
  values (p_bucket_key, current_window, 1)
  on conflict (bucket_key, window_start) do update set hits = quota.hits + 1
  returning hits into total;

  -- Old windows are useless once the minute has passed; keep the table small.
  delete from private.client_error_quota
  where window_start < current_window - interval '10 minutes';

  return total <= p_limit;
end;
$$;

-- 005 already closes new functions by default; stated here so the intent is explicit.
revoke execute on function public.consume_client_error_quota(text, integer)
  from public, anon, authenticated;
grant execute on function public.consume_client_error_quota(text, integer) to service_role;
```

- [ ] **Step 4: Aplicar y verificar que pasa**

```bash
supabase db reset
bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json
supabase test db
bun run db:types
```

Expected: PASS, con 5 aserciones en `006`. `database.types.ts` gana `consume_client_error_quota` en `Functions`.

- [ ] **Step 5: Extender las pruebas del handler, que fallan**

En `tests/unit/observability/report-client-error-handler.test.ts`, reemplaza la función `harness` completa por:

```ts
function harness(consume: (bucketKey: string) => Promise<boolean> = async () => true) {
  const lines: string[] = [];
  const keys: string[] = [];
  return {
    lines,
    keys,
    deps: {
      log: (line: string) => {
        lines.push(line);
      },
      randomId: () => "generated-id",
      consumeQuota: async (bucketKey: string) => {
        keys.push(bucketKey);
        return consume(bucketKey);
      },
    },
  };
}
```

Y agrega estas pruebas al final del `describe`:

```ts
  test("refuses a caller over the quota with 429 and CORS headers", async () => {
    const { deps, lines } = harness(async () => false);
    const response = await handleClientErrorReport(post(validReport), deps);
    expect(response.status).toBe(429);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(lines).toEqual([]);
  });

  test("keys the quota by the caller's forwarded IP", async () => {
    const { deps, keys } = harness();
    await handleClientErrorReport(
      post(validReport, { "x-forwarded-for": "198.51.100.7, 10.0.0.1" }),
      deps,
    );
    expect(keys).toEqual(["ip:198.51.100.7"]);
  });

  test("fails open when the quota store is unavailable", async () => {
    const { deps } = harness(async () => {
      throw new Error("database unavailable");
    });
    expect((await handleClientErrorReport(post(validReport), deps)).status).toBe(200);
  });

  test("a preflight never consumes quota", async () => {
    const { deps, keys } = harness();
    await handleClientErrorReport(new Request(FUNCTION_URL, { method: "OPTIONS" }), deps);
    expect(keys).toEqual([]);
  });
```

Run: `bun test tests/unit/observability/report-client-error-handler.test.ts`

Expected: FAIL.

- Fallan `refuses a caller over the quota…` (responde 200) y `keys the quota…` (`keys` vacío).
- Las demás pasan: el handler todavía ignora `consumeQuota`.

- [ ] **Step 6: Implementar la cuota en el handler**

En `supabase/functions/report-client-error/handler.ts`:

1. Reemplaza el tipo:

```ts
export type ReportDependencies = {
  log: (line: string) => void;
  randomId: () => string;
};
```

por:

```ts
export const CLIENT_ERROR_REPORTS_PER_MINUTE = 30;

export type ReportDependencies = {
  log: (line: string) => void;
  randomId: () => string;
  /** Resolves false once the caller has used up its per-minute quota. */
  consumeQuota: (bucketKey: string) => Promise<boolean>;
};

// A quota outage must not hide client errors: fail open. The log volume per request stays
// bounded by MAX_BODY_BYTES either way.
async function withinQuota(deps: ReportDependencies, bucketKey: string): Promise<boolean> {
  try {
    return await deps.consumeQuota(bucketKey);
  } catch {
    return true;
  }
}

const callerBucketKey = (request: Request) =>
  `ip:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"}`;
```

2. En `handleClientErrorReport`, reemplaza:

```ts
  const raw = await request.text();
```

por:

```ts
  // Counted before parsing, so a flood of invalid payloads is limited too.
  if (!(await withinQuota(deps, callerBucketKey(request)))) {
    return respond({ code: "RATE_LIMITED", requestId: headerRequestId ?? deps.randomId() }, 429);
  }

  const raw = await request.text();
```

Run: `bun test tests/unit/observability/report-client-error-handler.test.ts`

Expected: PASS, con 10 pruebas.

- [ ] **Step 7: Conectar la cuota en la función**

`supabase/functions/report-client-error/deno.json`:

```json
{
  "imports": {
    "zod": "npm:zod@^4.0.1",
    "@supabase/supabase-js": "npm:@supabase/supabase-js@^2.57.4"
  }
}
```

Reescribe `supabase/functions/report-client-error/index.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { CLIENT_ERROR_REPORTS_PER_MINUTE, handleClientErrorReport } from "./handler.ts";

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get: (name: string) => string | undefined };
};

// The Edge runtime provides both variables. The service role only touches the quota counter,
// never clinical data.
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

Deno.serve((request) =>
  handleClientErrorReport(request, {
    // Never persist request bodies, auth headers, tokens, or clinical content.
    log: (line) => console.error(line),
    randomId: () => crypto.randomUUID(),
    consumeQuota: async (bucketKey) => {
      const { data, error } = await admin.rpc("consume_client_error_quota", {
        p_bucket_key: bucketKey,
        p_limit: CLIENT_ERROR_REPORTS_PER_MINUTE,
      });
      if (error) {
        throw new Error(error.message);
      }
      return data === true;
    },
  }),
);
```

- [ ] **Step 8: Verificar contra el stack local**

```bash
supabase stop && supabase start
bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json
SUPABASE_LIVE_TESTS=1 bun run test:integration
bun run typecheck && bunx biome ci .
```

Expected: PASS. Las dos pruebas vivas de `report-client-error` siguen verdes con la cuota activa.

- [ ] **Step 9: Commit**

Marca T082 como `[X]`.

```bash
git add supabase/migrations/007_client_error_quota.sql supabase/tests/006_client_error_quota.sql supabase/functions/report-client-error tests/unit/observability/report-client-error-handler.test.ts src/lib/supabase/database.types.ts specs/001-identidad-y-acceso/tasks.md
git commit -m "fix: rate-limit report-client-error per caller IP (T082)"
```

---

### Task 11: Provisioning robusto y seed limpio (T083)

**Files:**
- Create: `scripts/lib/provisioning.ts`
- Create: `tests/unit/scripts/provisioning.test.ts`
- Modify: `scripts/provision-veterinarians.ts` (reescritura)
- Modify: `supabase/seed.sql` (reescritura)

**Interfaces:**
- Produces:

```ts
export function isLocalSupabaseUrl(url: string): boolean;
export function normalizeEmail(email: string): string;
export type AuthUserPage = { users: { id: string; email?: string | null }[] };
export async function findUserIdByEmail(
  listPage: (page: number) => Promise<AuthUserPage>,
  email: string,
  perPage: number,
): Promise<string | undefined>;
```

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/unit/scripts/provisioning.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  findUserIdByEmail,
  isLocalSupabaseUrl,
  normalizeEmail,
} from "../../../scripts/lib/provisioning";

describe("isLocalSupabaseUrl", () => {
  test.each(["http://127.0.0.1:54321", "http://localhost:54321", "http://[::1]:54321"])(
    "%s is local",
    (url) => {
      expect(isLocalSupabaseUrl(url)).toBe(true);
    },
  );

  test.each(["https://abcd.supabase.co", "http://127.0.0.1.evil.test", "not a url"])(
    "%s is not local",
    (url) => {
      expect(isLocalSupabaseUrl(url)).toBe(false);
    },
  );
});

describe("findUserIdByEmail", () => {
  test("matches regardless of case and surrounding spaces", async () => {
    const id = await findUserIdByEmail(
      async () => ({ users: [{ id: "u1", email: "Vet.Ana@Example.test" }] }),
      " vet.ana@example.test ",
      1000,
    );
    expect(id).toBe("u1");
    expect(normalizeEmail(" Vet.Ana@Example.test ")).toBe("vet.ana@example.test");
  });

  test("walks every page until the user appears", async () => {
    const pages = [
      [
        { id: "u1", email: "a@x.test" },
        { id: "u2", email: "b@x.test" },
      ],
      [{ id: "u3", email: "c@x.test" }],
    ];
    const requested: number[] = [];
    const id = await findUserIdByEmail(
      async (page) => {
        requested.push(page);
        return { users: pages[page - 1] ?? [] };
      },
      "c@x.test",
      2,
    );
    expect(id).toBe("u3");
    expect(requested).toEqual([1, 2]);
  });

  test("stops after the last page when the user does not exist", async () => {
    const pages = [
      [
        { id: "u1", email: "a@x.test" },
        { id: "u2", email: "b@x.test" },
      ],
      [{ id: "u3", email: "c@x.test" }],
    ];
    const requested: number[] = [];
    const id = await findUserIdByEmail(
      async (page) => {
        requested.push(page);
        return { users: pages[page - 1] ?? [] };
      },
      "missing@x.test",
      2,
    );
    expect(id).toBeUndefined();
    expect(requested).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Ejecutarlas y verificar que fallan**

Run: `bun test tests/unit/scripts/provisioning.test.ts`

Expected: FAIL con `Cannot find module '../../../scripts/lib/provisioning'`.

- [ ] **Step 3: Implementar las funciones puras**

`scripts/lib/provisioning.ts`:

```ts
const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "[::1]", "host.docker.internal"]);

/** Synthetic accounts with known passwords must never reach a real project by accident. */
export function isLocalSupabaseUrl(url: string): boolean {
  try {
    return LOCAL_HOSTNAMES.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type AuthUserPage = { users: { id: string; email?: string | null }[] };

/** Auth compares emails case-insensitively and paginates users; so does this lookup. */
export async function findUserIdByEmail(
  listPage: (page: number) => Promise<AuthUserPage>,
  email: string,
  perPage: number,
): Promise<string | undefined> {
  const target = normalizeEmail(email);
  for (let page = 1; ; page += 1) {
    const { users } = await listPage(page);
    const match = users.find((user) => user.email && normalizeEmail(user.email) === target);
    if (match) {
      return match.id;
    }
    if (users.length < perPage) {
      return undefined;
    }
  }
}
```

Run: `bun test tests/unit/scripts/provisioning.test.ts`

Expected: PASS, con 9 pruebas.

- [ ] **Step 4: Reescribir el script**

`scripts/provision-veterinarians.ts`:

```ts
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { findUserIdByEmail, isLocalSupabaseUrl, normalizeEmail } from "./lib/provisioning";

type Fixture = { email: string; password: string; displayName: string };

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const clinicId = "00000000-0000-0000-0000-000000000001";
const args = process.argv.slice(2);
const PER_PAGE = 1000;

if (!url || !serviceRoleKey) {
  throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorios para provisioning.");
}
if (!isLocalSupabaseUrl(url) && !args.includes("--allow-remote")) {
  throw new Error(
    `${url} no es un Supabase local. Usa --allow-remote solo para el backend sintético de e2e.`,
  );
}

const fixtureFlag = args.indexOf("--fixture");
const fixturePath =
  fixtureFlag === -1 ? "tests/fixtures/veterinarians.json" : args[fixtureFlag + 1];
if (!fixturePath) {
  throw new Error("Falta la ruta de --fixture.");
}

const fixtures = JSON.parse(await readFile(fixturePath, "utf8")) as Fixture[];
const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

for (const fixture of fixtures) {
  const email = normalizeEmail(fixture.email);
  const created = await admin.auth.admin.createUser({
    email,
    password: fixture.password,
    email_confirm: true,
  });
  let userId = created.data.user?.id;

  if (!userId) {
    userId = await findUserIdByEmail(
      async (page) => {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
        if (error) {
          throw error;
        }
        return data;
      },
      email,
      PER_PAGE,
    );
    if (!userId) {
      throw created.error ?? new Error(`No se pudo provisionar ${email}`);
    }
    // Re-running keeps the fixture authoritative: a changed password takes effect.
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password: fixture.password,
      email_confirm: true,
    });
    if (updateError) {
      throw updateError;
    }
  }

  const { error } = await admin.from("veterinarians").upsert({
    id: userId,
    clinic_id: clinicId,
    identifier: email,
    display_name: fixture.displayName,
  });
  if (error) {
    throw error;
  }
  console.info(`Provisioned synthetic veterinarian: ${email}`);
}
```

- [ ] **Step 5: Limpiar el seed**

Reescribe `supabase/seed.sql`:

```sql
insert into public.clinics (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Clínica Sintética Diklass')
on conflict (id) do update set name = excluded.name;

-- Clinical records are never seeded: the attribution trigger requires an authenticated
-- veterinarian (auth.uid()), and seed.sql runs before any account is provisioned.
```

- [ ] **Step 6: Verificar el comportamiento real**

```bash
supabase db reset
bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json
bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json
SUPABASE_URL=https://example.supabase.co SUPABASE_SERVICE_ROLE_KEY=not-a-key bun scripts/provision-veterinarians.ts; echo "exit=$?"
SUPABASE_LIVE_TESTS=1 bun run test:integration
```

Expected:

- `db reset` termina sin errores.
- La primera ejecución del provisioning imprime las dos cuentas.
- La segunda también: toma el camino de actualizar la contraseña, sin error.
- La ejecución contra un host remoto termina con `no es un Supabase local` y `exit=1`.
- Las suites vivas pasan.

- [ ] **Step 7: Commit**

Marca T083 como `[X]`.

```bash
git add scripts tests/unit/scripts/provisioning.test.ts supabase/seed.sql specs/001-identidad-y-acceso/tasks.md
git commit -m "fix: harden synthetic provisioning and drop the dead seed insert (T083)"
```

---

### Task 12: Verificación final y PR

**Files:**
- Modify: `specs/001-identidad-y-acceso/quickstart.md` (sección de evidencia)

- [ ] **Step 1: Todas las compuertas desde cero**

```bash
supabase stop && supabase start
supabase db reset
bun run provision:veterinarians -- --fixture tests/fixtures/veterinarians.json
bunx biome ci .
bun run typecheck
bun run test
supabase test db
bun run db:types && git diff --exit-code src/lib/supabase/database.types.ts
SUPABASE_LIVE_TESTS=1 bun run test:integration
bun run test:e2e:web -- --project=chromium
bun run test:e2e:web -- --project=firefox
bun run test:e2e:web -- --project=webkit
```

Expected: todo PASS. Anota los conteos: pruebas unitarias, aserciones pgTap por archivo, suites vivas y Playwright por navegador.

- [ ] **Step 2: Registrar la evidencia**

En la tabla de evidencia de `specs/001-identidad-y-acceso/quickstart.md`, agrega una fila por compuerta con la fecha de ejecución y el conteo real del Step 1. Por ejemplo: `supabase test db | 2026-09-1X | N/N aserciones pgTap (001–006)`.

- [ ] **Step 3: Revisar el diff completo**

Run: `git log --oneline origin/feat/001-convergencia-fase-7-8..HEAD && git diff --stat origin/feat/001-convergencia-fase-7-8..HEAD`

Expected: 13 commits, de Task 0 a Task 12, y solo los archivos listados en «Estructura de archivos».

- [ ] **Step 4: Commit de la evidencia**

```bash
git add specs/001-identidad-y-acceso/quickstart.md
git commit -m "docs: record verification evidence for the PR #4 review follow-up"
```

- [ ] **Step 5: Push y PR (confirmar con el usuario antes)**

- Si la #3 ya está mergeada, la PR apunta a `main`.
- Si no, apunta a `feat/001-convergencia-fase-7-8`, y se rebasa sobre `main` cuando la #3 entre.

```bash
git push -u origin fix/001-cierre-revision-pr4
gh pr create --base main --title "fix: cerrar la revisión de la PR #4 (T073–T083)" --body-file <archivo con resumen, tabla hallazgo → tarea → prueba, y evidencia>
```
