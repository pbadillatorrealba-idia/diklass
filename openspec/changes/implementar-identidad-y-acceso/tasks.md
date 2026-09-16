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
