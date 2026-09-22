# Tasks: Identidad y acceso

> **Estado trasladado el 2026-09-16:** las marcas y la evidencia proceden del registro anterior y no han sido verificadas por esta migración documental. Se conservan 49 tareas, 48 marcadas y T045 pendiente. La aceptación de US12 y SC-040/SC-041/SC-042/SC-044 es conjunta con registro clínico longitudinal; identidad sigue parcialmente implementada y pendiente de aceptación. Ninguna marca ni declaración histórica de compuerta constituye una nueva prueba de la aplicación.

**Entrada**: documentos de diseño de este cambio abierto.

**Prerequisites**: [design.md](design.md), [spec.md](specs/identidad-y-acceso/spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Organization**: Tasks are grouped by user story. Every implementation task has an exact path and
test tasks precede the behavior they cover.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicializar la aplicación Expo universal y las herramientas adoptadas.

- [x] 1.1 T001 Scaffold Expo SDK 57 universal con Bun, React Native y Expo Router en `package.json`, `app.json`, `src/app/_layout.tsx` y `src/app/index.tsx`
- [x] 1.2 T002 Configure TypeScript strict, alias `@/*` y tipos de Expo en `tsconfig.json` y `expo-env.d.ts`
- [x] 1.3 T003 Configure scripts `typecheck`, `lint`, `test`, `test:integration`, `test:e2e:web` y `test:e2e:native` en `package.json`
- [x] 1.4 T004 [P] Configure Biome 2.2.4 con formatter, lint e imports en `biome.json`
- [x] 1.5 T005 [P] Configure Playwright para Expo Web en `playwright.config.ts` y `tests/e2e/web/fixtures.ts`
- [x] 1.6 T006 [P] Configure workspace y comandos base de Maestro en `maestro/config.yaml` y `tests/e2e/native/README.md`
- [x] 1.7 T007 [P] Add GitHub Actions CI, Dependabot y variables documentadas en `.github/workflows/ci.yml`, `.github/dependabot.yml` y `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cimientos compartidos que deben completarse antes de las historias.

**CRITICAL**: No comenzar trabajo de historia hasta terminar esta fase.

- [x] 2.1 T008 [P] Write failing unit tests for generic authentication errors and indistinguishable credential failures in `tests/unit/auth/auth-errors.test.ts`
- [x] 2.2 T009 [P] Write failing unit tests for the eight-hour inactivity policy and session transitions in `tests/unit/auth/access-session.test.ts`
- [x] 2.3 T010 [P] Write failing unit tests for platform storage adapters and draft isolation by veterinarian in `tests/unit/storage/auth-storage.test.ts` and `tests/unit/storage/draft-storage.test.ts`
- [x] 2.4 T011 [P] Write failing SQL tests for authenticated clinic access, anonymous denial, actor stamping and immutable attribution in `supabase/tests/001_identity_access.sql`
- [x] 2.5 T012 Create Supabase local configuration and deterministic synthetic fixtures in `supabase/config.toml` and `supabase/seed.sql`
- [x] 2.6 T013 Implement shared error types, normalized auth errors and structured logger contracts in `src/lib/errors.ts` and `src/lib/observability/logger.ts`
- [x] 2.7 T014 Implement Supabase browser client and native/web auth-storage adapters in `src/lib/supabase/client.ts` and `src/lib/storage/auth-storage.ts`
- [x] 2.8 T015 Implement initial identity, clinic, access-session and audit schema with RLS, helper functions and triggers in `supabase/migrations/001_identity_access.sql`
- [x] 2.9 T016 Implement TanStack Query provider and query defaults for React Native AppState in `src/lib/query/query-client.tsx`
- [x] 2.10 T017 Implement Zustand store boundaries for local UI/session metadata without tokens or server cache in `src/stores/session-store.ts` and `src/stores/ui-store.ts`
- [x] 2.11 T018 Implement shared TanStack Form + Zod setup and reusable field error mapping in `src/lib/forms/form.ts` and `src/lib/forms/errors.ts`

**Checkpoint**: Foundation ready; identity stories can now be implemented.

---

## Phase 3: User Story 11 - Acceso autenticado del veterinario (Priority: P1) MVP

**Goal**: Un veterinario provisionado puede iniciar/cerrar sesión, operar solo mientras su sesión
está activa y recuperar un borrador después de expirar por inactividad.

**Independent Test**: Con una cuenta sintética, ejecutar login válido, credenciales inválidas,
logout, llamada protegida directa, expiración controlada y restauración de borrador en web y en un
development build nativo.

### Tests for User Story 11 (TDD: write first and observe failing)

- [x] 3.1 T019 [P] [US11] Write contract tests for `signInWithPassword`, `start_access_session`, generic error normalization and no-signup behavior in `tests/integration/auth/auth-contract.test.ts`
- [x] 3.2 T020 [P] [US11] Write integration tests for logout, inactivity expiration, `touch_access_session` and protected RLS denial in `tests/integration/auth/access-session.test.ts`
- [x] 3.3 T021 [P] [US11] Write Playwright tests for login, indistinguishable failures, logout and direct protected-route denial in `tests/e2e/web/auth.spec.ts`
- [x] 3.4 T022 [P] [US11] Write Maestro flows for native login, logout, expiry dialog and protected-operation denial in `tests/e2e/native/auth.yaml`
- [x] 3.5 T023 [P] [US11] Write component-contract tests for accessible login fields, focus/error states and session-expired draft preservation in `tests/unit/auth/login-screen.test.ts` and `tests/unit/clinical/draft-preserver.test.ts`

### Implementation for User Story 11

- [x] 3.6 T024 [US11] Implement Supabase login/logout/session lifecycle and generic credential error mapping in `src/features/auth/auth-service.ts`
- [x] 3.7 T025 [US11] Implement access-session start/touch/revoke calls and inactivity state machine in `src/features/auth/access-session-service.ts`
- [x] 3.8 T026 [US11] Implement authenticated session provider and Zustand synchronization without storing tokens in `src/features/auth/auth-provider.tsx` and `src/stores/session-store.ts`
- [x] 3.9 T027 [US11] Implement Expo Router public/protected layouts and redirect behavior in `src/app/(auth)/_layout.tsx` and `src/app/(protected)/_layout.tsx`
- [x] 3.10 T028 [US11] Implement accessible Spanish login screen with generic errors and no registration path in `src/app/(auth)/login.tsx` and `src/components/auth/login-form.tsx`
- [x] 3.11 T029 [US11] Implement protected home screen with current veterinarian identity and idempotent logout in `src/app/(protected)/home.tsx` and `src/components/auth/logout-button.tsx`
- [x] 3.12 T030 [US11] Implement session activity detection, reauthentication dialog and save blocking after expiry in `src/features/auth/use-session-activity.ts` and `src/components/auth/session-expired-dialog.tsx`
- [x] 3.13 T031 [US11] Implement platform draft persistence/restoration keyed by veterinarian and consultation in `src/lib/storage/drafts.ts` and `src/features/clinical/draft-preserver.tsx`
- [x] 3.14 T032 [US11] Implement client error reporting with request correlation and secret/content redaction in `src/lib/observability/client-error-reporter.ts` and `supabase/functions/report-client-error/index.ts`

**Checkpoint (declaración histórica, no verificada por la migración)**: US11 passes independently in web and native development build. Véanse las limitaciones y T045 pendiente en [quickstart.md](quickstart.md#limitaciones-observadas-y-discrepancias-de-evidencia).

---

## Phase 4: User Story 12 - Atribución verificable en la clínica compartida (Priority: P1)

**Goal**: La infraestructura permite que cualquier veterinario de la clínica vea/atienda registros
compartidos y que cada acción conserve actor y momento inmutables, incluyendo correcciones.

**Independent Test**: Dos contextos autenticados crean/leen un registro clínico de prueba, intentan
suplantar al actor y modificar atribución, y verifican el evento correctivo separado. La integración
con Paciente/Consulta/Epicrisis se cierra junto con la especificación de [registro clínico longitudinal](../implementar-registro-clinico-longitudinal/specs/registro-clinico-longitudinal/spec.md).

### Tests for User Story 12 (TDD: write first and observe failing)

- [x] 4.1 T033 [P] [US12] Write SQL integration tests for shared-clinic reads, cross-veterinarian care, actor derivation and append-only audit events in `supabase/tests/002_attribution_immutability.sql`
- [x] 4.2 T034 [P] [US12] Write integration tests for two authenticated Supabase clients and rejected actor impersonation in `tests/integration/attribution/shared-clinic.test.ts`
- [x] 4.3 T035 [P] [US12] Write Playwright two-context test for shared records, immutable attribution and correction history in `tests/e2e/web/attribution.spec.ts`
- [x] 4.4 T036 [P] [US12] Write Maestro two-account flow for shared-clinic visibility and protected attribution UI in `tests/e2e/native/attribution.yaml`

### Implementation for User Story 12

- [x] 4.5 T037 [US12] Implement reusable clinical attribution types, forbidden-field guards and correction links in `src/lib/attribution/types.ts` and `src/lib/attribution/guards.ts`
- [x] 4.6 T038 [US12] Implement Supabase helpers that omit client actor fields and expose attribution metadata in `src/lib/attribution/clinical-mutations.ts`
- [x] 4.7 T039 [US12] Extend migrations with clinical-record contract, approved-record immutability and correction audit trigger in `supabase/migrations/002_clinical_attribution.sql`
- [x] 4.8 T040 [US12] Add deterministic shared-clinic attribution fixture and verification query in `supabase/seed.sql` and `supabase/tests/fixtures/attribution.sql`
- [x] 4.9 T041 [US12] Render actor, timestamp and immutable/correction states in `src/components/clinical/attribution-badge.tsx` and `src/components/clinical/correction-history.tsx`

**Checkpoint (declaración histórica, no aceptación conjunta)**: US12 infrastructure is independently verified; domain screens from especificación de [registro clínico longitudinal](../implementar-registro-clinico-longitudinal/specs/registro-clinico-longitudinal/spec.md) can
reuse the contract without changing attribution rules.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Compuertas finales de calidad, seguridad y documentación.

- [x] 5.1 T042 [P] Add WCAG 2.2 AA labels, focus order, contrast and platform accessibility identifiers in `src/components/auth/` and `src/components/clinical/`
- [x] 5.2 T043 [P] Add responsive web variants and native platform variants without duplicating business rules in `src/components/` and `src/app/`
- [x] 5.3 T044 [P] Add dependency/security checks and verify no secrets, tokens or clinical content enter logs in `.github/workflows/ci.yml` and `src/lib/observability/`
- [ ] 5.4 T045 Run full web matrix and native Maestro flows, recording evidence required by `quickstart.md`
- [x] 5.5 T046 Validate implementation against requirements, data model and contracts and update completion notes in `quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup**: No dependencies.
- **Foundational**: Depends on Setup and blocks all stories.
- **US11**: Depends on Foundational; it is the MVP.
- **US12**: Depends on Foundational and can be developed after US11 for the first integrated demo;
  its domain verification completes with especificación de [registro clínico longitudinal](../implementar-registro-clinico-longitudinal/specs/registro-clinico-longitudinal/spec.md).
- **Polish**: Depends on the desired story checkpoints.

### Parallel Opportunities

- T004–T007 can proceed in parallel after T001–T003 establish the project manifest.
- T008–T011 are independent red tests and can proceed in parallel.
- T019–T023 are independent red tests for US11.
- T033–T036 are independent red tests for US12.
- T042–T044 can proceed in parallel after both story checkpoints.

### Within Each User Story

Tests MUST be written and observed failing before implementation. Then follow model/schema → service
→ provider/navigation → UI → integration. A task touching the same file as an earlier task remains
sequential even when its phase is otherwise parallelizable.

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational.
2. Complete US11 through T032.
3. Stop and validate the login, logout, expiry, direct-denial and draft scenarios independently.

### Incremental Delivery

1. Add US12 attribution infrastructure and verify it with synthetic records.
2. Integrate Paciente/Consulta/Epicrisis when implementing especificación de [registro clínico longitudinal](../implementar-registro-clinico-longitudinal/specs/registro-clinico-longitudinal/spec.md) without changing the attribution
   contract.
3. Run all cross-cutting quality gates and native/web acceptance flows.

## Notes

- `[P]` means parallelizable only when file/dependency constraints permit it.
- `[US11]` maps to User Story 11 and `[US12]` maps to User Story 12.
- TanStack DB is intentionally absent from implementation tasks; it remains a future persistence
  decision until offline synchronization is specified.
- Every completed task must be marked `[x]` before moving to the next checkpoint.

---

## Phase 6: Convergence

**Propósito**: cerrar las brechas detectadas por la revisión cruzada del código frente a `specs/identidad-y-acceso/spec.md`,
`design.md` y la [constitución](../../../docs/constitution.md). Las brechas y sus marcas se conservan como registro histórico.

- [x] 6.1 T047 CRITICAL: Reconcile the constitution's pinned Expo SDK 56 in `docs/constitution.md` (Restricciones de Aplicación Web) with the Expo SDK 57 actually shipped in `package.json`, `design.md` and `research.md` — either amend the constitution with a recorded migration note or revert the code to SDK 56 per Constitution: Restricciones de Aplicación Web (contradicts)
- [x] 6.2 T048 CRITICAL: Extend `.github/workflows/ci.yml` so the `web-e2e` job (or a new job) also runs the Firefox and WebKit Playwright projects already defined in `playwright.config.ts`, at minimum on push to `main`, so protected flows are verified in all three engines per Constitution: Restricciones de Aplicación Web (contradicts)
- [x] 6.3 T049 Add the `native-e2e` CI job designed in `design.md` ("CI de GitHub", job 5) to `.github/workflows/ci.yml`, running the Maestro flows in `tests/e2e/native/auth.yaml` and `tests/e2e/native/attribution.yaml` against Maestro Cloud on `main`, nightly or manual dispatch per plan: CI de GitHub (missing)

---

## Phase 7: Convergence

**Propósito**: cerrar las brechas detectadas por un segundo pase de `/speckit-converge` entre el código actual y lo que exigen `specs/identidad-y-acceso/spec.md`,
`design.md`, los contratos y la [constitución](../../../docs/constitution.md). Las marcas se conservan como registro histórico.

- [x] 7.1 T050 CRITICAL: Restore a green `bun run typecheck` by creating the gluestack v3 UI primitives that `src/app/(protected)/home.tsx`, `src/components/auth/login-form.tsx`, `src/components/auth/logout-button.tsx`, `src/components/auth/session-expired-dialog.tsx`, `src/components/clinical/attribution-badge.tsx` and `src/components/clinical/correction-history.tsx` import (`src/components/ui/box.tsx`, `text.tsx`, `heading.tsx`, `vstack.tsx`, `button.tsx`, `input.tsx`, `form-control.tsx`) — 19 `TS2307` errors currently make the login and home screens unbuildable — and remove the `!src/components/ui` exclusion from `biome.json` so the new files stay under the lint gate per Constitution: Flujo de Trabajo de Desarrollo, compuertas automatizadas (contradicts)
- [x] 7.2 T051 CRITICAL: Align the UI stack with the pinned gluestack-ui v3 + NativeWind setup the components already assume — replace `@gluestack-ui/themed`/`@gluestack-ui/config` v1 in `package.json`, add `nativewind`/`tailwindcss` as declared dependencies, and add the missing `tailwind.config.js`, `src/global.css`, `metro.config.js` and `babel.config.js` wiring so the `className` props in `src/components/` are actually applied per Constitution: Restricciones de Aplicación Web (contradicts)
- [x] 7.3 T052 CRITICAL: Wire `reportClientError` from `src/lib/observability/client-error-reporter.ts` into the client failure paths that currently swallow errors in the UI (`src/features/auth/auth-provider.tsx`, `src/features/auth/auth-service.ts`, `src/features/auth/use-session-activity.ts`, `src/components/auth/login-form.tsx`) sharing the same `requestId`, and make `src/lib/observability/logger.ts` emit outside `__DEV__`, so client errors reach a central destination per Constitution IV (contradicts)
- [x] 7.4 T053 CRITICAL: Extend `public.deny_attribution_mutation()` in a new `supabase/migrations/003_attribution_hardening.sql` so an `INSERT` into `public.clinical_records` also rejects or derives `updated_by`, `updated_at`, `approved_by` and `approved_at` — verified today that a veterinarian can insert a record with `status = 'approved'` and `approved_by` pointing at a different veterinarian, registering a clinical action in another professional's name per FR-064, SC-042, US12/AC4 (contradicts)
- [x] 7.5 T054 Add a server-side approval path — a `security definer` RPC in `supabase/migrations/003_attribution_hardening.sql` that stamps `approved_by = auth.uid()`/`approved_at = now()` and records the `epicrisis_approved` audit event — because an `UPDATE` setting those columns currently raises `ATTRIBUTION_IMMUTABLE`, leaving the spoofable INSERT of T053 as the only way to approve a record per FR-063, contracts/clinical-attribution.md (missing)
- [x] 7.6 T055 Relax the `active clinic veterinarians can update draft records` policy in `supabase/migrations/002_clinical_attribution.sql` (via the new migration) so its `with check` no longer requires `created_by = auth.uid()`: any active veterinarian of the clinic must be able to modify a non-approved shared record, which today is rejected by RLS per FR-066, US12/AC6 (contradicts)
- [x] 7.7 T056 Let an active clinic veterinarian read the identity of their peers — add a `veterinarians` SELECT policy scoped to the shared `clinic_id` in the new migration — and render `display_name` instead of the raw `actorId` UUID in `src/components/clinical/attribution-badge.tsx` and `src/components/clinical/correction-history.tsx`, so an attribution actually shows who performed the action per US12/AC2, data-model.md (partial)
- [x] 7.8 T057 Replace the existence-only `has_table`/`has_function` assertions in `supabase/tests/001_identity_access.sql` and `supabase/tests/002_attribution_immutability.sql` with behavioral pgTap assertions covering anonymous denial, revoked and inactivity-expired session denial, shared-clinic reads across two veterinarians, and rejection of `UPDATE`/`DELETE` on `public.clinical_audit_events` per SC-039, SC-045, FR-067 (partial)
- [x] 7.9 T058 Implement the real two-authenticated-client integration test in `tests/integration/attribution/shared-clinic.test.ts`, which today asserts only the client-side guard: open two Supabase clients for the synthetic veterinarians, verify cross-veterinarian visibility, rejected actor impersonation and immutable attribution against a live local instance per SC-042, SC-044 (partial)
- [x] 7.10 T059 Mount the draft preserver end to end: add the `src/app/(protected)/consultations/[id].tsx` screen the plan's project structure names, use `useDraftPreserver` from `src/features/clinical/draft-preserver.tsx` there, and cover expiry-then-restore in `tests/e2e/web/auth.spec.ts` — the hook currently has no call site and nothing verifies that unsaved clinical content survives an expired session per FR-061, SC-047, US11/AC5 (partial)
- [x] 7.11 T060 Constrain `public.clinical_audit_events.action` and `entity_type` to the taxative enumeration of `data-model.md` with a CHECK constraint in the new migration, and change `public.audit_clinical_record()` in `supabase/migrations/002_clinical_attribution.sql` to emit those actions instead of the out-of-enumeration `clinical_record_created`/`clinical_record_updated` it writes today per FR-063, data-model.md (partial)
- [x] 7.12 T061 Extend `tests/e2e/web/auth.spec.ts` with a successful login for a provisioned account, an explicit logout followed by a denied protected operation, and identical error output for a wrong password and an unknown identifier against the local backend — the file currently covers only client-side validation and an unauthenticated redirect per US11/AC1–AC4, quickstart escenarios 1–2 (partial)
- [x] 7.13 T062 Add a regression test (pgTap in `supabase/tests/` or integration in `tests/integration/auth/`) proving that an account self-registered through Supabase Auth — possible since `supabase/config.toml` sets `enable_signup = true` — cannot start an access session nor read or write clinical records, so the "sin autoregistro" assumption is enforced by a check rather than by a comment per spec Assumptions, FR-062 (partial)
- [ ] 7.14 T063 Make the native e2e evidence of T045 obtainable: add `eas.json` with an `e2e` build profile, document and register the `EXPO_TOKEN` and `MAESTRO_CLOUD_API_KEY` secrets used by `.github/workflows/native-e2e.yml`, then run the flows in `tests/e2e/native/auth.yaml` and `tests/e2e/native/attribution.yaml` and record the result in `quickstart.md` per T045, quickstart "Evidencia mínima" (partial)
- [x] 7.15 T064 Add a measurement of the login-to-operational budget to the web suite (`tests/e2e/web/auth.spec.ts` or a dedicated spec) asserting the veterinarian is able to operate in under 30 s, since no performance budget from `design.md` is verified anywhere today per SC-043, plan: Performance Goals (missing)
- [x] 7.16 T065 Add an automated accessibility gate to the web suite and to `.github/workflows/ci.yml` (for example an axe-core scan of `/login` and `/home`) so WCAG 2.2 AA is enforced by a check rather than by hand-written labels alone per Constitution: Restricciones de Aplicación Web (missing)

---

## Phase 8: Convergence

**Propósito**: cerrar las brechas detectadas por un tercer pase de `/speckit-converge` entre el código actual y lo que exigen `specs/identidad-y-acceso/spec.md`,
`design.md`, los contratos y la [constitución](../../../docs/constitution.md). Son brechas distintas de las que siguen abiertas en la fase 7. Las marcas se conservan como registro histórico.

- [x] 8.1 T066 CRITICAL: Emit structured, machine-readable logs with a correlation id from the server-side SQL functions in `supabase/migrations/001_identity_access.sql` (`start_access_session`, `touch_access_session`, `revoke_access_session`, `insert_clinical_audit_event`) — via `raise log` of a JSON payload carrying `requestId`, operation, authenticated user, clinic, result and duration, and never password, token or clinical content — since today only `supabase/functions/report-client-error/index.ts` carries a `requestId` and every SQL function is silent per Constitution IV, plan: Observabilidad y manejo de errores (missing)
- [x] 8.2 T067 CRITICAL: Stop the client heartbeat from defeating the server-side inactivity window in `src/features/auth/use-session-activity.ts` — the 60 s `setInterval` calls `touch_access_session` on a timer rather than on real interaction, so `last_activity_at`/`expires_at` are refreshed every minute while the app is open and the database-side 8 h expiry can never fire; after the UI shows the expiry dialog a direct PostgREST call still passes `is_active_access`. Touch only on debounced real user interaction (including native taps, not just `AppState` changes) and cover the bypass with a test per FR-061, FR-067, SC-045, contracts/auth-session.md (contradicts)
- [x] 8.3 T068 Close the forgeable-audit-event path: `public.insert_clinical_audit_event(text, uuid, text, jsonb, uuid)` in `supabase/migrations/001_identity_access.sql` is `security definer` and granted to `authenticated` while no code in `src/` calls it, so any active veterinarian can append an arbitrary event for any `entity_type`/`entity_id`/`action`/`supersedes_event_id` onto records they never touched. Revoke the `authenticated` grant in the new migration (triggers keep calling it internally) or constrain its arguments, and add a pgTap assertion that a direct RPC call is rejected per FR-063, data-model.md (append-only), contracts/clinical-attribution.md (contradicts)
- [x] 8.4 T069 Complete the draft lifecycle in `src/features/clinical/draft-preserver.tsx`: `useDraftPreserver` only saves and returns early on `!isSessionActive`, so the pending debounced write is cleared by the effect cleanup exactly when the session expires, and there is no restore-on-mount nor removal after a successful save or explicit close. Implement the documented `editing → restored → saved|discarded` cycle and flush the pending draft when the session expires instead of dropping it per FR-061, SC-047, data-model.md (Borrador no persistido en base de datos) (partial)
- [x] 8.5 T070 Replace the stub-only `tests/integration/auth/access-session.test.ts`, which asserts only that three RPC names are invoked against an in-memory client, with integration coverage against a live local Supabase: logout followed by denied clinical access, inactivity expiration, `touch_access_session` returning false for a revoked or expired session, and RLS denial of a protected read per SC-039, FR-061, contracts/auth-session.md (partial)
- [x] 8.6 T071 Extend `tests/unit/auth/login-screen.test.ts` beyond the `loginSchema` parse it asserts today with the component contract T023 declared — focus order across the login fields and the announced error state after a failed submit — which the axe scan of T065 cannot verify per US11/AC2, Constitution: Restricciones de Aplicación Web (partial)
- [x] 8.7 T072 Prevent `public.is_active_access(p_user_id uuid default auth.uid())` in `supabase/migrations/001_identity_access.sql` from answering for an arbitrary uuid: it must stay executable by `authenticated` for the RLS policies, but should ignore or reject a `p_user_id` different from `auth.uid()` so a veterinarian cannot probe whether a named colleague currently has a live session per Constitution V, spec Assumptions (Sin trazabilidad de accesos) (partial)

---

## Phase 9: Review follow-up (PR #4)

**Propósito**: cerrar los hallazgos de la revisión de código de la PR #4 que la PR #3 deja abiertos
(https://github.com/pbadillatorrealba-idia/diklass/pull/4#pullrequestreview-5180031684). Las marcas se conservan como registro histórico.

- [x] 9.1 T073 Pin `oven-sh/setup-bun` and `supabase/setup-cli` by commit SHA, and the Supabase CLI to `2.117.0`, in `.github/workflows/ci.yml` and `.github/workflows/native-e2e.yml`, guarded by `tests/unit/ci/pinned-actions.test.ts` per `design.md`: CI de GitHub (contradicts)
- [x] 9.2 T074 Generate `src/lib/supabase/database.types.ts` with `bun run db:types` instead of maintaining it by hand, and fail the `database` CI job when it drifts from the migrations (partial)
- [x] 9.3 T075 Stamp `created_at` on INSERT, reject `status` changes outside `approve_clinical_record`, reject clinical-record updates without an authenticated veterinarian, and restrict `authenticated` to column-level INSERT/UPDATE grants on `public.clinical_records` in `supabase/migrations/004_attribution_columns.sql` per FR-064, SC-042, data-model.md (contradicts)
- [x] 9.4 T076 Revoke `EXECUTE` on every `public` function from `PUBLIC`, `anon` and `authenticated` (now and by default), grant back only the RLS helpers and app RPCs, and fix `search_path` on the remaining invoker functions in `supabase/migrations/005_function_privileges.sql` per Supabase lints 0011/0028 (partial)
- [x] 9.5 T077 Bind every access session to the Supabase Auth `session_id` of the JWT that started it, allow concurrent sessions across devices, make `is_active_access`/`touch_access_session` honour only that binding, and add `current_access_session()` and `revoke_current_access_session()` in `supabase/migrations/006_access_session_binding.sql` per FR-061, FR-067, contracts/auth-session.md (contradicts)
- [x] 9.6 T078 Resume only the access session bound to the current Auth session on restore (`getCurrentAccessSession` in `src/features/auth/access-session-service.ts`), and make logout end only the current device (`revoke_current_access_session()` + `signOut({ scope: "local" })`) in `src/features/auth/` per FR-061, contracts/auth-session.md (contradicts)
- [x] 9.7 T079 Make `draftStorageKey` produce valid SecureStore keys and report failed draft writes instead of leaving unhandled rejections in `src/lib/storage/drafts.ts` and `src/features/clinical/draft-preserver.tsx` per FR-061, SC-047 (contradicts)
- [x] 9.8 T080 Check the snake_case attribution columns PostgREST receives in `ATTRIBUTION_CONTROL_FIELDS` (`src/lib/attribution/types.ts`) and stop blocking `clinic_id` per contracts/clinical-attribution.md (contradicts)
- [x] 9.9 T081 Handle the CORS preflight, restrict to `POST`, cap the body size and validate the payload with Zod in `supabase/functions/report-client-error` per Constitution IV (partial)
- [x] 9.10 T082 Rate-limit `report-client-error` per caller IP with `public.consume_client_error_quota` in `supabase/migrations/007_client_error_quota.sql` (missing)
- [x] 9.11 T083 Make `scripts/provision-veterinarians.ts` refuse non-local URLs without `--allow-remote`, match emails case-insensitively across every page and resync passwords on re-run, and drop the dead `clinical_records` insert from `supabase/seed.sql` (partial)
