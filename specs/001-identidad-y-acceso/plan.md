# Implementation Plan: Identidad y acceso

**Branch**: `001-identidad-y-acceso` | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-identidad-y-acceso/spec.md`

## Summary

Se construirá una aplicación móvil nativa para iOS y Android con destino web compartido. La base
será Expo sobre React Native, con Expo Router y gluestack-ui para obtener una experiencia rápida,
funcional y reutilizable entre plataformas. Bun será runtime y package manager; TypeScript y
`tsc --noEmit` cubrirán la seguridad estática, y Biome cubrirá formato, lint e imports.

TanStack Query gestionará el estado remoto de Supabase; Zustand quedará reservado para estado local
de UI y sesión; TanStack Form + Zod validará formularios y payloads. Bun test cubrirá unidades e
integración rápida, y Playwright cubrirá el target web. GitHub Actions ejecutará las compuertas de
calidad. TanStack DB se documentará como una evolución para persistencia local-first/offline, no como
dependencia inicial.

Supabase Auth/PostgreSQL/RLS proporcionará autenticación, clínica compartida y enforcement del lado
servidor. Los triggers de PostgreSQL fijarán el actor y el momento de cada mutación clínica. La
implementación se limita a identidad, acceso y la infraestructura de atribución reusable; no
implementa todavía las entidades completas de la spec 002 ni el ciclo de vida de cuentas.

## Technical Context

**Language/Version**: TypeScript en modo `strict`; Bun 1.4.0 como runtime, package manager y task
runner; `tsc --noEmit` como typecheck.

**Primary Dependencies**: Expo SDK 57, React Native, Expo Router, gluestack-ui v3,
`@supabase/supabase-js`, `@tanstack/react-query` v5, Zustand v5, `@tanstack/react-form` v1, Zod
v4, Biome 2.2.4, Bun test y `@playwright/test`. `expo-secure-store` se usará para credenciales y
sesión nativa. Supabase CLI y Docker son herramientas de desarrollo local.

**Storage**: Supabase PostgreSQL para clínica, veterinarios, sesiones de acceso y eventos de
atribución; almacenamiento seguro nativo para sesión y borradores pequeños; `sessionStorage` para
borradores web. TanStack DB queda documentado para una futura capa persistente/offline.

**Testing**: Bun test para unidades y pruebas de integración de cliente; Supabase local para RLS,
triggers y funciones SQL; Playwright 1.61.0 para e2e de Expo Web en Chromium, Firefox y WebKit;
Maestro para e2e nativo de iOS/Android.

**Target Platform**: iOS 16+, Android API 26+ y web mediante React Native Web. Builds nativos con
EAS cuando se implemente la distribución; Supabase local durante desarrollo y Supabase gestionado
o compatible para el PoC.

**Project Type**: Aplicación móvil universal con target web, en un único repositorio.

**Performance Goals**: Arranque usable en menos de 3 s en el dispositivo de demostración después de
la respuesta inicial; acceso completo desde login en menos de 30 s para SC-043; operaciones de
consulta con p95 menor de 500 ms excluyendo red externa bajo 10 usuarios concurrentes; actualización
local de formularios sin bloqueo perceptible.

**Constraints**: Sesión de acceso con inactividad máxima de 8 h; ninguna mutación clínica sin sesión
válida; ningún secreto en cliente o logs; RLS y checks del servidor; registros aprobados inmutables;
UI WCAG 2.2 AA y controles accesibles; español; datos sintéticos; sin autoregistro, modo anónimo,
multi-clínica ni roles diferenciados.

**Scale/Scope**: Una clínica, 10–50 veterinarios provisionados, hasta 10.000 pacientes sintéticos
y 10 usuarios concurrentes. Compartir código entre móvil y web es objetivo, pero las pantallas
pueden tener variantes por plataforma cuando el patrón de interacción lo exija.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Antes de la investigación

- **I. Desarrollo dirigido por especificación — PASS**: este plan parte de `spec.md`; tareas y
  código se generarán después de los artefactos de diseño.
- **II. Pruebas primero — PASS**: cada slice comienza con pruebas rojas de lógica, RLS o interfaz
  antes de implementar la conducta.
- **III. Simplicidad y YAGNI — PASS**: una app Expo universal y Supabase cubren el alcance; Query,
  Zustand y Form tienen fronteras explícitas para evitar duplicación de estado.
- **IV. Observabilidad — PASS**: funciones/Edge Functions y clientes server-side emitirán eventos
  estructurados con `requestId`; fallas del cliente se reportarán a un destino central.
- **V. Seguridad y protección de datos — PASS**: SecureStore protege sesión nativa, Zod valida
  fronteras, RLS/triggers protegen persistencia y ningún check de UI será autoridad.
- **Restricciones web/móvil — PASS**: WCAG 2.2 AA, responsive en web, accesibilidad nativa, matriz
  Chromium/Firefox/WebKit y presupuestos de rendimiento definidos arriba.

**Resultado del gate**: PASS. No hay aclaraciones técnicas pendientes que bloqueen Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-identidad-y-acceso/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md             # creado por /speckit-tasks
```

### Source Code (repository root)

```text
src/app/
├── _layout.tsx
├── (auth)/login.tsx
├── (protected)/_layout.tsx
├── (protected)/index.tsx
└── (protected)/consultations/[id].tsx
src/
├── components/ui/                 # componentes gluestack-ui adaptados
├── components/forms/
├── features/auth/
├── features/clinical/
├── lib/auth/
├── lib/api/
├── lib/forms/
├── lib/observability/
├── lib/query/
├── lib/storage/
└── stores/                        # Zustand, solo estado local
supabase/
├── migrations/
├── seed.sql
└── tests/001_identity_access.sql
tests/
├── unit/
├── integration/
├── e2e/web/
└── e2e/native/                  # flows YAML de Maestro
.github/workflows/ci.yml
app.config.ts
biome.json
package.json
bun.lock
tsconfig.json
playwright.config.ts
```

**Structure Decision**: Se elige una app Expo universal. `src/app/` define navegación con Expo Router;
`src/` separa features, UI y estado; `supabase/` contiene migraciones, seed y pruebas de base;
`tests/` separa lógica, integración y web e2e. Los componentes visuales se construyen con
gluestack-ui y pueden incorporar variantes `.web`, `.ios` o `.android` cuando no exista una
interacción universal adecuada.

## Fronteras de las tecnologías

- **Bun**: runtime de scripts/backend, instalación, scripts, bundling de herramientas y test
  runner. Expo sigue usando Metro para empaquetar la app móvil/web y Hermes como runtime nativo.
- **TypeScript + `tsc --noEmit`**: contrato estático del proyecto. Bun transpila TypeScript, pero no
  sustituye al compilador para comprobar tipos.
- **Biome**: formatter, linter y organización de imports. No sustituye a `tsc` ni a las pruebas.
- **TanStack Query**: estado remoto, cache, invalidación, mutaciones y sincronización con Supabase;
  integrará el cambio de `AppState` nativo para refrescar al volver a foreground.
- **Zustand**: preferencias de UI, estado de navegación y señales de sesión; no almacenará tokens
  ni duplicará el cache de Query.
- **TanStack Form + Zod**: estado de formularios y schemas compartidos entre UI, validación de
  entrada y contratos; se rechaza payload inválido antes de enviarlo y también en la base/API.
- **Gluestack UI**: componentes copiable/adaptables, tema, tokens y estilos universales; la capa
  `src/components/ui` será dueña de las adaptaciones clínicas.

## Enfoque de implementación

1. **Fundación móvil universal**: inicializar Expo SDK 57 con Bun, Expo Router, TypeScript strict,
   gluestack-ui y target web; configurar Biome, `tsc --noEmit` y Bun test.
2. **Identidad provisionada**: crear Supabase Auth, perfiles de veterinario, cliente universal de
   Supabase y adaptadores de SecureStore/web. No habrá endpoint de signup.
3. **Sesión de acceso**: crear `access_sessions`, funciones SQL para iniciar, tocar y revocar
   sesión, y políticas RLS que denieguen operaciones cuando la inactividad supere 8 h. Expo Router
   solo protege navegación; Supabase es la autoridad.
4. **Atribución reusable**: crear RLS y triggers para `created_by`/`created_at`, modificaciones,
   aprobaciones, eventos append-only y correcciones. Las acciones del cliente nunca envían el actor.
5. **Datos y formularios**: configurar Query para Supabase, Zustand para estado local, TanStack Form
   + Zod para formularios y una persistencia inicial de borradores con adaptadores por plataforma.
6. **Calidad y CI**: agregar `.github/workflows/ci.yml` para instalar Bun fijado, ejecutar Biome,
   `tsc --noEmit`, Bun test, integración de Supabase y Playwright web. Los secretos solo provendrán
   de GitHub Environments/Secrets.
7. **Verificación**: escribir pruebas rojas antes de cada implementación y validar la matriz de
   escenarios de [`quickstart.md`](quickstart.md) con Playwright en web y Maestro en development
   builds nativos. Documentar TanStack DB como evolución cuando el alcance requiera
   persistencia/offline real.

## CI de GitHub

El workflow `.github/workflows/ci.yml` se ejecutará en pull requests y pushes a `main` con jobs
paralelizables:

1. `quality`: checkout, setup Bun 1.4.0 fijado, `bun install --frozen-lockfile`, `bunx biome ci .`
   y `bun run typecheck` (`tsc --noEmit`).
2. `unit`: `bun test` con cobertura de reglas de identidad, atribución, storage y formularios.
3. `database`: Supabase CLI + Docker, `supabase start`, `supabase db reset` y pruebas de RLS,
   triggers y funciones SQL.
4. `web-e2e`: exportar/levantar Expo Web, instalar Playwright y ejecutar Chromium en cada PR;
   Firefox y WebKit se ejecutan en la matriz completa o en pushes a `main` para controlar tiempo.
5. `native-e2e`: en `main`, nightly o ejecución manual, construir los artefactos nativos y ejecutar
   los flows Maestro en Maestro Cloud; las credenciales viven en GitHub Secrets.
6. `dependency-audit`: alertas de Dependabot y auditoría de dependencias compatible con Bun.

Las acciones de terceros se fijarán por commit SHA cuando se implemente el workflow. Los builds
nativos EAS no bloquearán cada pull request: se reservarán para `main`, tags o una ejecución manual.

## Trazabilidad de diseño

| Requisitos | Decisión que los cubre | Artefacto verificable |
|---|---|---|
| FR-059, FR-060 | Supabase Auth + error genérico | `contracts/auth-session.md`, e2e web |
| FR-061 | Sesión RLS + SecureStore/storage de borrador | `data-model.md`, integración y e2e |
| FR-062, FR-067 | RLS y funciones SQL, no solo Expo Router | `contracts/auth-session.md`, pruebas directas |
| FR-063, FR-064 | actor derivado de `auth.uid()` + triggers | `data-model.md`, `contracts/clinical-attribution.md` |
| FR-066 | `clinic_id` común y policy de pertenencia | integración de dos veterinarios |
| SC-039–SC-047 | Unit, integración, Playwright web, Maestro nativo y CI | `quickstart.md`, `.github/workflows/ci.yml` |

## Observabilidad y manejo de errores

Las funciones SQL/Edge Functions y cualquier operación server-side emitirán eventos estructurados
con `requestId`, operación, usuario autenticado si existe, clínica, resultado y duración; nunca
contraseña, token ni contenido clínico. El cliente reportará errores no sensibles con el mismo
`requestId`. Supabase Auth, RLS y validación Zod devolverán códigos de error estables sin revelar
existencia de cuentas.

## Complejidad requerida por el principio III

No hay violaciones constitucionales. La complejidad añadida está limitada a piezas exigidas por la
feature:

| Pieza | Por qué es necesaria | Alternativa más simple descartada |
|---|---|---|
| Expo universal + React Native Web | Permite móvil nativo y web futura con una sola base UI | SPA web no satisface el objetivo móvil; dos apps duplican la PoC |
| Supabase Auth/PostgreSQL/RLS | FR-059, FR-066 y FR-067 requieren identidad y enforcement fuera del cliente | Auth/permiso en Zustand o UI no protege llamadas directas |
| `access_sessions` + funciones SQL | FR-061 exige inactividad y revocación en servidor | Expirar solo tokens de Auth no representa inactividad |
| Query + Zustand + Form | Separa estado remoto, local y formulario sin duplicar responsabilidades | Un store global único mezcla cache, formularios y UI |
| Gluestack UI | Acelera componentes y consistencia universal móvil/web | Componentes propios completos retrasan la PoC |

## Evolución documentada: TanStack DB

TanStack DB queda como opción posterior para persistencia local-first, colecciones reactivas,
mutaciones optimistas y eventual sincronización con Postgres. No se incluye en la primera iteración
porque el requisito actual solo exige conservar borradores durante una sesión/expiración; introducir
sincronización offline ahora agregaría conflictos, retención local y un modelo de resolución que la
spec todavía no exige.

## Constitution Check posterior a Phase 1

- **I–V y restricciones móvil/web — PASS**: el diseño sigue la spec, conserva test-first, protege
  Auth/RLS fuera de la UI, define observabilidad, evita secretos y fija accesibilidad multiplataforma.
- La constitución se actualizó de 1.1.0 a 1.2.0 para reflejar el stack móvil universal y CI; no se
  relajó ningún gate.

**Resultado final del gate**: PASS. El diseño está listo para `/speckit-tasks`.

## Complexity Tracking

Las justificaciones de las capas requeridas están en **Complejidad requerida por el principio III**.
No se registra ninguna violación de la constitución.
