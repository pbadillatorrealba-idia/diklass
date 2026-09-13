# Investigación y decisiones técnicas

**Feature**: Identidad y acceso
**Fecha**: 2026-09-09

El repositorio no contiene código de aplicación. Estas decisiones describen una base nueva para una
PoC móvil universal, con iOS, Android y un target web app-like.

## Decisiones adoptadas

### 1. Bun + TypeScript + Biome

- **Decisión**: Bun 1.4.0 será runtime, package manager, task runner y test runner. TypeScript será
  el lenguaje; `tsc --noEmit` ejecutará la comprobación estática. Biome 2.2.4 cubrirá formatter,
  linter y organización de imports.
- **Rationale**: Bun concentra el tooling y reduce tiempos de instalación/ejecución. Bun transpila
  TypeScript, pero no sustituye al typechecker de `tsc`; Biome tampoco sustituye tipos ni pruebas.
- **Alternativas consideradas**: Node/npm/pnpm + ESLint/Prettier ofrecen un ecosistema más
  conservador, pero agregan herramientas separadas. Se mantiene la posibilidad de sumar ESLint si
  una regla específica de React Native no queda cubierta por Biome.
- **Fuentes primarias consultadas**: [Bun toolkit](https://github.com/oven-sh/bun/blob/bun-v1.4.0/docs/index.mdx),
  [TypeScript compiler](https://www.typescriptlang.org/docs/handbook/compiler-options.html) y
  [Biome](https://biomejs.dev/guides/getting-started/).

### 2. Expo universal sobre React Native

- **Decisión**: Expo SDK 57, React Native y Expo Router para iOS, Android y web. Expo es el
  framework/toolchain; React Native es la capa de UI nativa; Expo Router es navegación y deep links.
- **Rationale**: Permite desarrollar una app móvil nativa y compartir lógica/componentes con una web
  app-like mediante React Native Web. Expo Router soporta rutas universales y builds web estáticas.
- **Alternativas consideradas**: Flutter ofrece UI nativa compilada pero obliga a Dart y a un stack
  separado del futuro frontend React. Ionic/Capacitor acelera un webview, pero es menos apropiado
  para captura de audio y UX nativa clínica. Next.js queda fuera como framework principal; podría
  agregarse después para una web pública/SEO sin cambiar backend.
- **Fuente primaria consultada**: [Expo Router y web](https://github.com/expo/expo/tree/sdk-56/docs/pages/router).

### 3. Gluestack UI como sistema visual

- **Decisión**: Probar gluestack-ui v3 como kit base de componentes, con componentes copiados y
  adaptados en `src/components/ui`.
- **Rationale**: Tiene componentes universales para React Native/Expo y web, temas y variantes por
  plataforma. El modelo copy-pasteable permite adaptar accesibilidad y comportamiento clínico sin
  quedar bloqueados por la API de una caja negra.
- **Alternativas consideradas**:
  - **Tamagui**: candidato fuerte para compartir tokens, temas y layouts; introduce un sistema de
    estilos/compiler más amplio y queda como alternativa si gluestack no cubre la UX.
  - **React Native Paper**: muy rápido y maduro para móvil Material 3, pero menos adecuado como
    lenguaje visual universal propio.
  - **NativeWind**: excelente para utilidades Tailwind, pero es una capa de estilos, no un kit
    completo; además su v5 actual aparece como preview.
- **Fuente primaria consultada**: [gluestack-ui v3](https://github.com/gluestack/gluestack-ui/tree/v3.0.0).

### 4. Estado remoto, local y formularios

- **Decisión**: TanStack Query v5 para estado remoto/cache/mutaciones de Supabase; Zustand v5 para
  estado local de UI, navegación y preferencias; TanStack Form v1 + Zod v4 para formularios y
  schemas compartidos.
- **Rationale**: Cada herramienta tiene una frontera clara: Query no se usa como store de UI,
  Zustand no duplica el cache ni almacena tokens, y Zod valida tanto campos como payloads antes de
  cruzar fronteras de confianza. TanStack Form soporta validadores Zod y componentes React Native.
- **Fuente primaria consultada**: [TanStack Query React Native](https://tanstack.com/query/v5/docs/framework/react/react-native),
  [TanStack Form validation](https://tanstack.com/form/v1/docs/framework/react/guides/validation),
  [Zod](https://zod.dev/) y [Zustand](https://github.com/pmndrs/zustand).

### 5. Supabase para Auth, Postgres y RLS

- **Decisión**: Supabase Auth para cuentas provisionadas; Supabase PostgreSQL para identidad,
  clínica, sesiones y eventos de atribución; RLS/triggers como enforcement. El cliente universal usa
  `@supabase/supabase-js`; SecureStore guarda sesión nativa y un adaptador web maneja el target web.
- **Rationale**: Se evita construir Auth propio y las reglas críticas viven fuera de la UI. Las
  funciones SQL de sesión permiten que RLS rechace operaciones después de ocho horas de inactividad.
  Edge Functions se reservarán para operaciones que requieran secretos o coordinación server-side.
- **Alternativas consideradas**: Backend Node separado con ORM y Auth propio añade infraestructura y
  caminos de bypass. Firebase ofrece Auth/Firestore, pero el modelo relacional, RLS y la trazabilidad
  append-only encajan mejor en PostgreSQL.

### 6. Tests, E2E y CI

- **Decisión**: Bun test para unidades e integración de cliente; pruebas SQL contra Supabase local
  para RLS/triggers; Playwright 1.61.0 para Expo Web en Chromium/Firefox/WebKit; Maestro para e2e
  nativo de iOS/Android; GitHub Actions para ejecutar typecheck, Biome, tests, Supabase local,
  Playwright web y Maestro Cloud en las ejecuciones nativas seleccionadas.
- **Rationale**: Maestro opera sobre la capa de accesibilidad, soporta React Native en ambas
  plataformas y permite mantener flows YAML sin instrumentar el código TypeScript. Playwright se
  mantiene para el target web porque ofrece aislamiento y asserts específicos del navegador.
- **CI**: calidad, tipos, unit e integración correrán en cada pull request; Playwright Chromium en
  cada pull request y Firefox/WebKit en la matriz completa; Maestro Cloud en `main`, nightly o
  ejecución manual para no convertir cada pull request en un build móvil costoso.
- **Fuentes primarias consultadas**: [Maestro React Native](https://github.com/mobile-dev-inc/maestro-docs/blob/main/introduction/get-started/supported-platform/react-native.md),
  [Maestro CLI](https://github.com/mobile-dev-inc/maestro-docs/blob/main/maestro-cli/maestro-cli-commands-and-options.md),
  [Playwright](https://playwright.dev/docs/intro) y [GitHub Actions](https://docs.github.com/en/actions).

### 7. Persistencia futura con TanStack DB

- **Decisión**: TanStack DB no entra en la primera iteración. Se documentará como evolución para
  colecciones reactivas, mutaciones optimistas, persistencia local-first y sincronización eventual.
- **Rationale**: La feature actual solo exige conservar borradores y aún no define resolución de
  conflictos, retención local ni comportamiento offline. Agregar DB ahora ampliaría el alcance y el
  riesgo de datos clínicos duplicados.
- **Fuente primaria consultada**: [TanStack DB](https://tanstack.com/db/latest).

## Recomendaciones adicionales

1. **Maestro para e2e nativo**: Playwright queda para web; Maestro es más liviano para validar login,
   logout y navegación en un development build de Expo. Detox solo sería preferible si aparecen
   pruebas nativas muy sensibles a sincronización/render.
2. **Expo SecureStore**: usarlo para tokens y datos pequeños de sesión; no guardar tokens en Zustand.
3. **React Native Testing Library**: evaluar si Bun test no ofrece suficiente ergonomía para tests de
   componentes; puede convivir con Bun como ejecutor si el entorno queda compatible.
4. **Sentry u OpenTelemetry**: agregar observabilidad remota después de definir el destino, sin
   registrar audio, contraseñas, tokens ni contenido clínico.
5. **EAS Build/Submit/Update**: usar EAS para builds reproducibles y distribución; no ejecutar builds
   móviles completos en cada pull request.

## Incertidumbres resueltas

| Área | Resolución |
|---|---|
| Runtime/tooling | Bun 1.4.0 |
| Lenguaje/typecheck | TypeScript strict + `tsc --noEmit` |
| Formato/lint | Biome 2.2.4 |
| App móvil/web | Expo SDK 57 + React Native + Expo Router |
| UI | gluestack-ui v3, en evaluación práctica |
| Datos remotos/locales | TanStack Query v5 + Zustand v5 |
| Formularios | TanStack Form v1 + Zod v4 |
| Backend | Supabase Auth/Postgres/RLS |
| Tests/CI | Bun test + Playwright web + Maestro nativo + GitHub Actions |
| Persistencia offline | Diferida; TanStack DB documentado como evolución |
